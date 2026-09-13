import DOMPurify from "dompurify";

/**
 * What survives of AI Dungeon's markup before the response parser sees it: plain text, inline
 * formatting and line breaks. Nothing else, and no attributes at all.
 *
 * AI Dungeon's presentational markup is atomic-CSS class soup full of underscores, and its
 * accessibility attributes repeat the visible text (a player action carries an aria-label with the
 * whole action in it, plus aria-level). The parser runs markdown regexes over the serialized HTML,
 * so any attribute that gets through is fair game for a `*...*` or `_..._` match, which then splits
 * the tag in half and leaks the attribute's tail into the story as text. Everyone has seen the
 * class-soup version of that; the aria-label version appeared the day AI Dungeon added the label.
 *
 * ALLOWED_ATTR: [] is not enough on its own: DOMPurify lets every aria-* and data-* attribute
 * through by default regardless of the allowlist, so both switches are turned off explicitly.
 */
export const RESPONSE_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "strike", "del", "mark", "sup", "sub", "code", "span", "p", "br"],
  ALLOWED_ATTR: [] as string[],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
};

/** AI Dungeon's response markup reduced to what the parser may see. */
export function sanitizeResponseHtml(html: string): string {
  return DOMPurify.sanitize(html, RESPONSE_SANITIZE_CONFIG);
}
