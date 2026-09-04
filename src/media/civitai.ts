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

/**
 * Civitai's sampler list. It folds the sampler and its noise schedule into one value, so "DPM++ 2M"
 * and "DPM++ 2M Karras" are separate entries rather than two fields.
 */
export const SCHEDULERS: { value: string; label: string }[] = [
  { value: "eulerA", label: "Euler a" },
  { value: "euler", label: "Euler" },
  { value: "lms", label: "LMS" },
  { value: "heun", label: "Heun" },
  { value: "dpM2", label: "DPM2" },
  { value: "dpM2A", label: "DPM2 a" },
  { value: "dpM2SA", label: "DPM++ 2S a" },
  { value: "dpM2M", label: "DPM++ 2M" },
  { value: "dpmsde", label: "DPM++ SDE" },
  { value: "dpmFast", label: "DPM fast" },
  { value: "dpmAdaptive", label: "DPM adaptive" },
  { value: "lmsKarras", label: "LMS Karras" },
  { value: "dpM2Karras", label: "DPM2 Karras" },
  { value: "dpM2AKarras", label: "DPM2 a Karras" },
  { value: "dpM2SAKarras", label: "DPM++ 2S a Karras" },
  { value: "dpM2MKarras", label: "DPM++ 2M Karras" },
  { value: "dpmsdeKarras", label: "DPM++ SDE Karras" },
  { value: "ddim", label: "DDIM" },
  { value: "plms", label: "PLMS" },
  { value: "uniPC", label: "UniPC" },
  { value: "lcm", label: "LCM" },
  { value: "ddpm", label: "DDPM" },
  { value: "deis", label: "DEIS" },
];

/**
 * Maps a sampler name as written in image metadata ("DPM++ 2M Karras") onto Civitai's enum value.
 * Comparing with punctuation and case stripped is enough, because the enum names are the same words.
 */
function schedulerFrom(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;
  const flatten = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = flatten(name);
  return SCHEDULERS.find((s) => flatten(s.value) === target || flatten(s.label) === target)?.value;
}

export function dimensionsFor(aspectRatio: string) {
  return BUCKETS[aspectRatio] ?? BUCKETS["1:1"];
}

function describe(status: number, body: any): CivitaiError {
  if (status === 401 || status === 403) return new CivitaiError("Civitai rejected the API key.", status);
  if (status === 402) return new CivitaiError("Not enough Buzz for this generation.", status);
  if (status === 429) return new CivitaiError("Civitai is rate limiting you, wait a moment.", status);

  const errors = body?.errors;
  if (errors && typeof errors === "object") {
    // `messages` is Civitai's general refusal, not a complaint about one field, and it is the useful
    // one: an unrunnable model is refused here with "X is not enabled for generation", for free,
    // before anything is charged. Naming a field alongside it would only obscure it.
    const general = Array.isArray((errors as any).messages) ? (errors as any).messages[0] : null;
    if (typeof general === "string" && general.trim()) return new CivitaiError(general, status);

    // Anything else is a per-field validation error, worth naming the field for.
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
export type CivitaiParams = {
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  scheduler?: string;
};

export async function generateWithCivitai(
  key: string,
  model: string,
  prompt: string,
  aspectRatio: string,
  params: CivitaiParams = {},
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
            // Anything omitted is filled in by Civitai's own defaults, which is better than sending
            // a guess of our own.
            ...(params.negativePrompt?.trim() ? { negativePrompt: params.negativePrompt } : {}),
            ...(params.scheduler ? { scheduler: params.scheduler } : {}),
            ...(params.steps ? { steps: params.steps } : {}),
            ...(params.cfgScale ? { cfgScale: params.cfgScale } : {}),
            width,
            height,
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
 * Bases that cannot generate *through this API*. Tested across seven Anima checkpoints: every one
 * failed. Two were refused at submit with "X is not enabled for generation", which costs nothing;
 * the other five were accepted, charged, run, and then failed with no reason given anywhere in the
 * response.
 *
 * Worth being precise about the cause, because it is not that the models are unrunnable: Civitai's
 * own web generator runs them. That UI is driven by their internal API, while this is the public
 * consumer one, which offers a single "textToImage" step and an opaque workflowTemplate name with no
 * way to enumerate the alternatives. An architecture shipping a separate text encoder and VAE, as
 * Anima does, evidently needs a workflow this path cannot express.
 *
 * So the practical position stands even though the reason is different: these fail here, some of
 * them after taking the user's Buzz, and warning up front is the only protection available.
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
  /**
   * The settings the model's own sample images were made with, where they agree. These are the
   * author's numbers rather than a house default, which for a fine-tuned checkpoint is usually the
   * difference between a good image and a muddy one.
   */
  defaults: { steps?: number; cfgScale?: number; scheduler?: string };
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
    defaults: defaultsFromSamples(version?.images),
    air,
    name: version?.model?.name ?? "Unknown model",
    version: version?.name ?? "",
    baseModel,
    type,
    support: supportFor(baseModel),
  };
}

/**
 * Reads generation settings off a version's sample images, taking the most common value for each.
 * Most images carry the parameters they were made with; some carry a raw workflow dump instead,
 * which has no such fields and is simply skipped.
 */
function defaultsFromSamples(images: unknown): { steps?: number; cfgScale?: number; scheduler?: string } {
  if (!Array.isArray(images)) return {};

  const commonest = <T>(values: T[]): T | undefined => {
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  const metas = images.map((i: any) => i?.meta).filter((m: any) => m && typeof m === "object");

  const steps = commonest(metas.map((m: any) => m.steps).filter((v: any) => typeof v === "number" && v > 0));
  const cfgScale = commonest(metas.map((m: any) => m.cfgScale).filter((v: any) => typeof v === "number" && v > 0));
  const scheduler = commonest(metas.map((m: any) => schedulerFrom(m.sampler)).filter(Boolean) as string[]);

  return {
    ...(steps ? { steps } : {}),
    ...(cfgScale ? { cfgScale } : {}),
    ...(scheduler ? { scheduler } : {}),
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
