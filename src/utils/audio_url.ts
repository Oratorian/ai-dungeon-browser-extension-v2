// Remote ambient audio comes from Pixabay. Two inputs are supported:
//  - a friendly sound-effect PAGE url (pixabay.com/sound-effects/...): we fetch the page and read
//    the direct audio link from its JSON-LD <script type="application/ld+json"> (schema.org
//    AudioObject), which is stable SEO markup.
//  - a direct cdn.pixabay.com audio url (what the page resolves to), used as-is.
// The resolved audio url is stored as the clip's `data`; AudioManager fetches + decodes it the
// same way it handles an uploaded base64 clip, so playback needs no changes.

export const PIXABAY_PAGE_HOST = "pixabay.com";
export const PIXABAY_AUDIO_HOST = "cdn.pixabay.com";

export type PixabayInput =
  | { kind: "cdn"; url: string }
  | { kind: "page"; url: string }
  | { kind: "error"; error: string };

/** Classifies pasted input as a direct CDN audio url, a Pixabay page url, or invalid. */
export function classifyPixabayInput(input: string): PixabayInput {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "error", error: "Paste a Pixabay sound URL." };

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { kind: "error", error: "That doesn't look like a valid URL." };
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === PIXABAY_AUDIO_HOST) {
    if (!/\/audio\//.test(parsed.pathname) || !/\.(mp3|ogg|wav|m4a)$/i.test(parsed.pathname)) {
      return { kind: "error", error: "That doesn't look like a Pixabay audio file." };
    }
    return { kind: "cdn", url: parsed.toString() };
  }

  if (host === PIXABAY_PAGE_HOST) {
    if (!/\/sound-effects\/|\/music\//.test(parsed.pathname)) {
      return { kind: "error", error: "Use a Pixabay sound-effect or music page URL." };
    }
    return { kind: "page", url: parsed.toString() };
  }

  return { kind: "error", error: "Only Pixabay URLs are supported." };
}

/** Derives a display name from a direct CDN url (filename query or path). */
export function nameFromCdnUrl(url: string): string {
  try {
    const u = new URL(url);
    const base = u.searchParams.get("filename") || u.pathname.split("/").pop() || "Pixabay audio";
    return base.replace(/\.[a-z0-9]+$/i, "");
  } catch {
    return "Pixabay audio";
  }
}

/** Parses an ISO-8601 duration like "PT0M13.035094S" into seconds. */
export function parseIsoDuration(iso: unknown): number {
  if (typeof iso !== "string") return 0;
  const m = iso.match(/PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (parseFloat(h ?? "0") || 0) * 3600 + (parseFloat(min ?? "0") || 0) * 60 + (parseFloat(s ?? "0") || 0);
}

// Recursively finds a schema.org AudioObject with a contentUrl inside a parsed JSON-LD value.
function findAudioObject(node: any): any | null {
  if (!node || typeof node !== "object") return null;
  if (node["@type"] === "AudioObject" && typeof node.contentUrl === "string") return node;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findAudioObject(item);
      if (found) return found;
    }
    return null;
  }
  if (node["@graph"]) return findAudioObject(node["@graph"]);
  return null;
}

export type ResolvedPixabayAudio = { url: string; name: string; duration: number };

/**
 * Fetches a Pixabay sound-effect page and extracts the direct audio url from its JSON-LD.
 * Requires the pixabay.com host permission. Throws with a friendly message on failure.
 */
export async function resolvePixabayPage(pageUrl: string): Promise<ResolvedPixabayAudio> {
  let res: Response;
  try {
    res = await fetch(pageUrl, {
      headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    });
  } catch {
    throw new Error("Couldn't reach Pixabay.");
  }
  if (!res.ok) throw new Error(`Pixabay returned ${res.status}. Try the direct CDN link instead.`);

  const html = await res.text();
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const audio = findAudioObject(data);
    if (audio) {
      // Only trust a contentUrl that points at Pixabay's audio CDN.
      let host = "";
      try {
        host = new URL(audio.contentUrl).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      if (host !== PIXABAY_AUDIO_HOST) continue;
      return {
        url: audio.contentUrl,
        name: typeof audio.name === "string" ? audio.name.replace(/\s*\|.*$/, "").trim() : nameFromCdnUrl(audio.contentUrl),
        duration: parseIsoDuration(audio.duration),
      };
    }
  }

  throw new Error("Couldn't find an audio link on that page.");
}
