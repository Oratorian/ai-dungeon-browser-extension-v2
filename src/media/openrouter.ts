// Image generation through OpenRouter, for filling a story card's icon or portrait from a prompt.
//
// Called straight from the page rather than through the background: OpenRouter answers a preflight
// with Access-Control-Allow-Origin * and permits Authorization, Content-Type and X-Title, so a
// content-script fetch works on Firefox MV2 and Chrome MV3 alike. Trinetra needs the background
// because its API refuses the preflight; this one does not.
//
// The user brings their own key and pays for their own generations, so every failure here has to say
// what went wrong plainly: a silent failure spends money and shows nothing for it.

const API_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export type GeneratedImage = {
  /** A data: URI, ready to be compressed and stored, or uploaded to Trinetra. */
  dataUri: string;
  /** What this generation cost, in USD, when OpenRouter reports it. */
  cost: number | null;
};

/**
 * Every model OpenRouter lists as producing image output, cheapest first.
 *
 * Not a curation: there are only seven. The upstream project's shortlist named flux.2-klein-4b,
 * flux.2-pro and seedream-4.5, none of which resolve, and there is nothing to swap them for, since
 * OpenRouter carries no Black Forest Labs, Stability, Midjourney, Ideogram or Recraft image models at
 * all, and every ByteDance model it does carry outputs text. So the whole roster fits in one list.
 *
 * Preview aliases are left out where a stable id exists, since a preview is exactly what gets retired
 * and breaks first run. Order is OpenRouter's own image_output rate. Deliberately no per-image
 * prices: that rate is per token and an image is worth roughly a thousand of them, so any figure here
 * would be a guess presented as fact.
 */
export const OPENROUTER_MODELS: { value: string; label: string; note: string }[] = [
  { value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini", note: "cheapest" },
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana", note: "good default" },
  { value: "google/gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite", note: "" },
  { value: "openai/gpt-5.4-image-2", label: "GPT-5.4 Image 2", note: "" },
  { value: "openai/gpt-5-image", label: "GPT-5 Image", note: "" },
  { value: "google/gemini-3.1-flash-image", label: "Nano Banana 2", note: "" },
  { value: "google/gemini-3-pro-image", label: "Nano Banana Pro", note: "best, priciest" },
];

function friendlyStatus(status: number, detail?: string): string {
  if (status === 401) return "OpenRouter rejected the API key.";
  if (status === 402) return "Your OpenRouter balance is too low for this generation.";
  if (status === 429) return "OpenRouter is rate limiting you, wait a moment and try again.";
  if (status === 400) return detail ? "OpenRouter rejected the request: " + detail : "OpenRouter rejected the request.";
  return detail ? "OpenRouter failed (" + status + "): " + detail : "OpenRouter failed (" + status + ").";
}

/**
 * Generates one image. Resolves to a data URI so the caller can decide where it lives, either
 * compressed into the card or uploaded to Trinetra and kept as a link.
 *
 * Named for its provider because src/media is auto-imported globally, so a bare `generateImage`
 * would collide with Civitai's and one would silently win.
 */
export async function generateWithOpenRouter(
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio: string
): Promise<GeneratedImage> {
  if (!apiKey.trim()) throw new OpenRouterError("Add your OpenRouter API key first.");
  if (!prompt.trim()) throw new OpenRouterError("Write a prompt first.");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Identifies the caller in OpenRouter's dashboard, so a user can see what these charges were.
        "X-Title": "Dungeon Extension v2 Resurrected",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        image_config: { aspect_ratio: aspectRatio },
      }),
    });
  } catch {
    throw new OpenRouterError("Couldn't reach OpenRouter. Check your connection.");
  }

  const raw = await response.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new OpenRouterError("OpenRouter returned something unreadable.");
  }

  if (!response.ok) {
    throw new OpenRouterError(friendlyStatus(response.status, data?.error?.message), response.status);
  }

  const dataUri = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:")) {
    // A model that only returns text, or one that refused the prompt, lands here. Surface the text
    // if there is any, since it usually explains itself.
    const text = data?.choices?.[0]?.message?.content;
    throw new OpenRouterError(
      typeof text === "string" && text.trim()
        ? "That model returned text instead of an image: " + text.slice(0, 200)
        : "That model returned no image. Check it is an image-capable model."
    );
  }

  const cost = typeof data?.usage?.cost === "number" ? data.usage.cost : null;
  return { dataUri, cost };
}

/** Remaining credit on the key, or null when the account has no limit. Never throws. */
export async function getRemainingCredit(apiKey: string): Promise<number | null | undefined> {
  try {
    const response = await fetch(`${API_BASE}/auth/key`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return undefined;
    const data = await response.json();
    const remaining = data?.data?.limit_remaining;
    return remaining === null ? null : typeof remaining === "number" ? remaining : undefined;
  } catch {
    return undefined; // a balance we cannot read is not worth failing a generation over
  }
}
