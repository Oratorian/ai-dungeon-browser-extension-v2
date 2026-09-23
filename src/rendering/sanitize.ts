import DOMPurify from "dompurify";

/**
 * What survives of AI Dungeon's markup before the response parser sees it: plain text, inline
 * formatting and line breaks. Nothing else, and no attributes at all.
 *
 * AI Dungeon's presentational markup is atomic-CSS class soup full of underscores, and its
 * accessibility attributes repeat the visible text (a player action carries an aria-label with the
 * whole action in it, plus aria-level). Keep only story formatting. The response renderer walks
 * this sanitized tree and matches cards/markdown on text nodes, never serialized HTML syntax.
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

export function sanitizeResponseFragment(html: string): DocumentFragment {
  return DOMPurify.sanitize(html, { ...RESPONSE_SANITIZE_CONFIG, RETURN_DOM_FRAGMENT: true });
}
