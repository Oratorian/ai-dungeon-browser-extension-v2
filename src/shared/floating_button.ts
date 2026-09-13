import type { PublicPath } from "wxt/browser";

/**
 * The floating button is drawn from the extension icon at whatever size the user sets. The range
 * keeps it usable: below the minimum it is hard to hit, above the maximum it covers the story.
 */
export const FLOATING_BUTTON_MIN_SIZE = 24;
export const FLOATING_BUTTON_MAX_SIZE = 128;
export const FLOATING_BUTTON_DEFAULT_SIZE = 44;

/** Whatever is stored, coerced into the allowed range (a non-number falls to the default). */
export function floatingButtonSize(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : FLOATING_BUTTON_DEFAULT_SIZE;
  return Math.min(FLOATING_BUTTON_MAX_SIZE, Math.max(FLOATING_BUTTON_MIN_SIZE, n));
}

/**
 * Always the largest shipped icon: the browser scales it down to the drawn size, which looks
 * smoother than scaling a small file up and stays sharp on HiDPI screens up to the maximum size.
 */
export const FLOATING_BUTTON_ICON: PublicPath = "/icon/128.png";
