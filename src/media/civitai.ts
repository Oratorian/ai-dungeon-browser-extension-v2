// Image generation through Civitai's orchestrator, as an alternative to OpenRouter.
//
// The contract below was read off Civitai's own SDK types (@civitai/client) and then confirmed
// against the live API, because two details are easy to get wrong from the type names alone:
// `prompt` sits directly on `input` rather than inside a `params` object, and the request envelope
// requires a `workflowTemplate`. Both are rejected with a 400 otherwise.
//
// Unlike OpenRouter, this is asynchronous: submitting returns a workflow that is merely "scheduled",
// and the image appears on a later poll. The resulting blob URL also carries an expiry, so it is
// downloaded here and handed back as a data URI. Storing Civitai's URL on a card would leave the
// user with images that quietly stop loading.

const API_BASE = "https://orchestration.civitai.com/v2/consumer";

const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 300_000; // observed: a busy queue can run past two minutes before settling
const POLL_FAILURES_ALLOWED = 3; // a blip while polling must not abandon a job already paid for

export class CivitaiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "CivitaiError";
  }
}

export type CivitaiResult = {
  dataUri: string;
  /** Buzz spent, Civitai's own currency, not a monetary amount. */
  buzz: number | null;
};

/**
 * SDXL is trained on fixed resolution buckets, and off-bucket sizes produce visibly worse images, so
 * an aspect ratio maps to the nearest official bucket rather than to arbitrary dimensions.
 */
const BUCKETS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:2": { width: 1216, height: 832 },
  "2:3": { width: 832, height: 1216 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "4:3": { width: 1152, height: 896 },
  "3:4": { width: 896, height: 1152 },
};

export function dimensionsFor(aspectRatio: string) {
  return BUCKETS[aspectRatio] ?? BUCKETS["1:1"];
}

function describe(status: number, body: any): CivitaiError {
  if (status === 401 || status === 403) return new CivitaiError("Civitai rejected the API key.", status);
  if (status === 402) return new CivitaiError("Not enough Buzz for this generation.", status);
  if (status === 429) return new CivitaiError("Civitai is rate limiting you, wait a moment.", status);

  // A 400 carries per-field validation errors, which say far more than the status does.
  const errors = body?.errors;
  if (errors && typeof errors === "object") {
    const first = Object.entries(errors)[0];
    if (first) {
      const [field, messages] = first as [string, string[]];
      return new CivitaiError(`Civitai rejected the request (${field}): ${[messages].flat()[0]}`, status);
    }
  }
  return new CivitaiError(body?.title ? `Civitai: ${body.title}` : `Civitai request failed (${status}).`, status);
}

async function call(key: string, path: string, init?: RequestInit): Promise<any> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
  } catch {
    throw new CivitaiError("Couldn't reach Civitai. Check your connection.");
  }

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* a non-JSON body is only interesting when the status is bad, handled below */
  }

  if (!response.ok) throw describe(response.status, body);
  return body;
}

/** Downloads a finished image into a data URI, following the blob host's redirect. */
async function toDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new CivitaiError(`Couldn't download the generated image (${response.status}).`);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new CivitaiError("Couldn't read the generated image."));
    reader.readAsDataURL(blob);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates one image: submit, poll until the workflow settles, then download the result.
 *
 * Named for its provider because src/media is auto-imported globally, so a bare `generateImage`
 * would collide with OpenRouter's and one would silently win.
 *
 * `onStage` reports progress, since this routinely takes a minute and a silent button looks broken.
 */
export async function generateWithCivitai(
  key: string,
  model: string,
  prompt: string,
  aspectRatio: string,
  negativePrompt = "",
  onStage?: (stage: string) => void
): Promise<CivitaiResult> {
  if (!key.trim()) throw new CivitaiError("Add your Civitai API key first.");
  if (!prompt.trim()) throw new CivitaiError("Write a prompt first.");

  const { width, height } = dimensionsFor(aspectRatio);

  // Counted from submission, so the wait includes queueing rather than only the generating part.
  const startedAt = Date.now();
  const elapsed = () => {
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
  };

  onStage?.("Submitting...");
  const submitted = await call(key, "/workflows", {
    method: "POST",
    body: JSON.stringify({
      workflowTemplate: "txt2img",
      steps: [
        {
          $type: "textToImage",
          input: {
            model,
            quantity: 1,
            prompt,
            ...(negativePrompt.trim() ? { negativePrompt } : {}),
            scheduler: "EulerA",
            steps: 20,
            cfgScale: 7,
            width,
            height,
            clipSkip: 2,
          },
        },
      ],
    }),
  });

  const id = submitted?.id;
  if (!id) throw new CivitaiError("Civitai accepted the job but returned no workflow id.");

  // Reported by the submit response, so it is known even if the generation later fails.
  const buzz = Array.isArray(submitted?.transactions?.list)
    ? submitted.transactions.list.reduce((sum: number, t: any) => sum + (Number(t?.amount) || 0), 0)
    : null;

  const deadline = Date.now() + POLL_TIMEOUT;
  let workflow = submitted;
  let pollFailures = 0;

  while (workflow?.status !== "succeeded") {
    if (workflow?.status === "failed" || workflow?.status === "canceled") {
      // Deliberately not promising a refund: Civitai charges on submit, and whether a failure is
      // credited back is their policy, not something this can observe.
      throw new CivitaiError(
        `Generation ${workflow.status} on Civitai's side. If this model's base is not one their ` +
          `generator supports, it will fail every time; check your Buzz balance on civitai.com.`
      );
    }
    if (Date.now() > deadline) {
      throw new CivitaiError("Civitai is taking unusually long. The job may still finish in your Civitai account.");
    }

    await wait(POLL_INTERVAL);

    try {
      workflow = await call(key, `/workflows/${id}`);
      pollFailures = 0;
    } catch (e) {
      // The job is running and already paid for, so a blip on one poll is not a reason to abandon it.
      if (++pollFailures > POLL_FAILURES_ALLOWED) throw e;
      continue;
    }

    // Deliberately not using estimatedProgressRate. Despite the shape, it is not cumulative progress:
    // watching one job it ran 0.41, 1, 0.67, 0.09, 0.49, 1, so anything derived from it counts up,
    // snaps back to zero and counts up again. Elapsed time only ever increases, and on a queue where
    // a generation can take two minutes it is the number a waiting user actually wants.
    onStage?.(`${workflow?.status === "processing" ? "Generating" : "Queued"} ${elapsed()}`);
  }

  const image = workflow?.steps?.[0]?.output?.images?.[0];
  const url = image?.url ?? image?.previewUrl;
  if (!url || image?.available === false) {
    throw new CivitaiError("Civitai finished but produced no usable image.");
  }

  onStage?.("Downloading...");
  return { dataUri: await toDataUri(url), buzz };
}

/** Whether a key is accepted, used by the settings panel's check button. */
export async function verifyKey(key: string): Promise<boolean> {
  try {
    await call(key, "/workflows?take=1");
    return true;
  } catch {
    return false;
  }
}

const WEB_API = "https://civitai.com/api/v1";

/**
 * How likely a base model is to actually generate.
 *
 * This matters because a job on an unsupported base is still accepted, still charged, still runs to
 * completion, and only then reports "failed" with no reason attached anywhere in the response. The
 * cost of finding out by trying is real Buzz, so it is worth saying up front.
 */
export type GenerationSupport = "supported" | "unknown" | "unsupported";

/** Bases confirmed to work. An SDXL checkpoint generated in seconds. */
const SUPPORTED_BASES = ["sd 1", "sd1", "sdxl", "pony", "illustrious", "noobai", "flux", "sd 3", "sd3"];

/**
 * Bases observed to fail every time. Anima checkpoints were charged, ran to completion and failed on
 * every attempt, with Civitai's own default parameters as well as ours.
 */
const UNSUPPORTED_BASES = ["anima"];

function supportFor(baseModel: string): GenerationSupport {
  const base = baseModel.toLowerCase();
  if (UNSUPPORTED_BASES.some((known) => base.startsWith(known))) return "unsupported";
  // Loose match: Civitai writes these as "SDXL 1.0", "Flux.1 D", "Pony" and so on.
  if (SUPPORTED_BASES.some((known) => base.startsWith(known))) return "supported";
  // Neither list. Allowed through, because both lists are ours and will age as Civitai adds support,
  // and refusing something that works would be worse than a warning that is sometimes unnecessary.
  return "unknown";
}

export type ResolvedModel = {
  air: string;
  /** e.g. "One obsession", for confirming the right thing was pasted. */
  name: string;
  /** e.g. "Anima2.9B v1". */
  version: string;
  /** e.g. "Anima". Worth showing: it decides which resolutions suit the model. */
  baseModel: string;
  /** "Checkpoint", "LORA", ... Only a checkpoint can be the model of a job. */
  type: string;
  /** Whether this base is known to generate. See GenerationSupport. */
  support: GenerationSupport;
};

/**
 * Turns a Civitai model page URL, or a bare version id, into the AIR the orchestrator wants.
 *
 * Nobody should have to assemble an AIR by hand: the ecosystem segment is the base model, not the
 * family you would guess from the page. A model whose page looks like any other SDXL checkpoint can
 * be `urn:air:anima:...`, and getting it wrong is a rejected job rather than an obvious mistake.
 * Civitai returns the canonical AIR on the version itself, so this asks rather than constructs.
 *
 * Public endpoint, no key required.
 */
export async function resolveModel(input: string): Promise<ResolvedModel> {
  const trimmed = input.trim();
  if (!trimmed) throw new CivitaiError("Paste a Civitai model link or version id.");

  // Already an AIR: nothing to look up.
  if (trimmed.startsWith("urn:air:")) {
    throw new CivitaiError("That is already an AIR, paste a model link instead to check it.");
  }

  let versionId: string | null = null;

  if (/^\d+$/.test(trimmed)) {
    versionId = trimmed;
  } else {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      throw new CivitaiError("That does not look like a Civitai link.");
    }
    if (!/(^|\.)civitai\.com$/i.test(url.hostname)) throw new CivitaiError("That link is not on civitai.com.");

    versionId = url.searchParams.get("modelVersionId");

    // A link without ?modelVersionId points at the model, so take its newest version.
    if (!versionId) {
      const modelId = url.pathname.match(/\/models\/(\d+)/)?.[1];
      if (!modelId) throw new CivitaiError("Couldn't find a model id in that link.");
      const model = await fetchJson(`${WEB_API}/models/${modelId}`);
      versionId = model?.modelVersions?.[0]?.id != null ? String(model.modelVersions[0].id) : null;
      if (!versionId) throw new CivitaiError("That model has no published versions.");
    }
  }

  const version = await fetchJson(`${WEB_API}/model-versions/${versionId}`);
  const air = version?.air;
  if (typeof air !== "string") throw new CivitaiError("Civitai did not return an AIR for that version.");

  const type = version?.model?.type ?? "Unknown";
  if (type !== "Checkpoint") {
    throw new CivitaiError(`That is a ${type}, not a checkpoint. Generation needs a checkpoint model.`);
  }

  const baseModel = version?.baseModel ?? "Unknown";

  return {
    air,
    name: version?.model?.name ?? "Unknown model",
    version: version?.name ?? "",
    baseModel,
    type,
    support: supportFor(baseModel),
  };
}

async function fetchJson(url: string): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new CivitaiError("Couldn't reach Civitai. Check your connection.");
  }
  if (response.status === 404) throw new CivitaiError("Civitai has no such model or version.");
  if (!response.ok) throw new CivitaiError(`Civitai lookup failed (${response.status}).`, response.status);
  try {
    return await response.json();
  } catch {
    throw new CivitaiError("Civitai returned something unreadable.");
  }
}
