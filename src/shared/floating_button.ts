import type { PublicPath } from "wxt/browser";

/**
 * The floating button is drawn from the extension icon, and the manifest ships the icon at these
 * sizes, so these are the sizes a user can pick for it: each one maps to a PNG that needs no
 * scaling on a 1x screen.
 */
export const FLOATING_BUTTON_SIZES = [16, 32, 64, 96, 128] as const;

export type FloatingButtonSize = (typeof FLOATING_BUTTON_SIZES)[number];

export const FLOATING_BUTTON_DEFAULT_SIZE: FloatingButtonSize = 64;

/** Whatever is stored, coerced back onto a shipped size (an unknown value falls to the default). */
export function floatingButtonSize(value: unknown): FloatingButtonSize {
  return (FLOATING_BUTTON_SIZES as readonly number[]).includes(value as number)
    ? (value as FloatingButtonSize)
    : FLOATING_BUTTON_DEFAULT_SIZE;
}

/**
 * The icon file to draw a button of `size` CSS pixels with: the smallest shipped size that still
 * covers the physical pixels at the given device pixel ratio, so a 64px button on a 2x screen loads
 * the 128px icon rather than upscaling the 64px one.
 */
export function floatingButtonIconFile(size: number, dpr: number): PublicPath {
  const wanted = Math.ceil(size * Math.max(1, dpr));
  const largest = FLOATING_BUTTON_SIZES[FLOATING_BUTTON_SIZES.length - 1];
  const file = FLOATING_BUTTON_SIZES.find((s) => s >= wanted) ?? largest;
  return `/icon/${file}.png` as PublicPath;
}
