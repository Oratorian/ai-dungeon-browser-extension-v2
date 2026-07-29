// Remote images are served by the Trinetra image host (purpose-built for AI Dungeon images).
// A stored remote image is just the canonical URL string; it renders the same as an uploaded
// data URI via <img src>. Users may paste either a bare image ID or a full Trinetra URL.

export const TRINETRA_HOST = "trinetra.mahesvara.cloud";
const TRINETRA_BASE = `https://${TRINETRA_HOST}/i/`;

// A Trinetra image ID: the short token after /i/. Kept permissive (letters, digits, - and _)
// so we don't reject valid ids, but strict enough to catch obviously-wrong input.
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type ParsedImageUrl = { ok: true; url: string } | { ok: false; error: string };

/**
 * Normalises user input into a canonical Trinetra image URL.
 *
 * Accepts:
 *  - a bare image id, e.g. "9fSO19PJJtAW"
 *  - a full Trinetra URL, e.g. "https://trinetra.mahesvara.cloud/i/9fSO19PJJtAW"
 *    (with or without scheme, trailing slashes, or query/hash which are dropped)
 *
 * Rejects any other host.
 */
export function parseImageInput(input: string): ParsedImageUrl {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter an image ID or Trinetra URL." };

  // Looks like a URL (has a scheme or a slash) -> must be a Trinetra URL.
  if (/[/:]/.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      return { ok: false, error: "That doesn't look like a valid URL." };
    }

    if (parsed.hostname !== TRINETRA_HOST) {
      return { ok: false, error: `Only ${TRINETRA_HOST} images are supported.` };
    }

    const id = parsed.pathname.replace(/^\/i\//, "").replace(/^\//, "").replace(/\/+$/, "");
    if (!id || !ID_PATTERN.test(id)) {
      return { ok: false, error: "Couldn't find a valid image ID in that URL." };
    }
    return { ok: true, url: TRINETRA_BASE + id };
  }

  // Otherwise treat it as a bare image id.
  if (!ID_PATTERN.test(trimmed)) {
    return { ok: false, error: "Invalid image ID." };
  }
  return { ok: true, url: TRINETRA_BASE + trimmed };
}
