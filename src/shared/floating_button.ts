import type { PublicPath } from "wxt/browser";

/**
 * The floating button is drawn from the extension icon at whatever size the user sets. The range
 * keeps it usable: below the minimum it is hard to hit, above the maximum it covers the story.
 */
export const FLOATING_BUTTON_MIN_SIZE = 24;
export const FLOATING_BUTTON_MAX_SIZE = 128;
export const FLOATING_BUTTON_DEFAULT_SIZE = 45;

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

/* ---------------------------------------------------------------------------------------------
 * Ring layout
 *
 * The quick actions sit on a circle around the puck. Which points of that circle are usable
 * depends on where the puck is parked: in the open all of them, against an edge only the half
 * facing inward, in a corner only the quarter. Rather than special-case corners and edges, every
 * candidate angle is tried and kept only if a button placed there stays inside the viewport. The
 * cardinal points are tried first so a puck in the open gets the plain cross, and the survivors are
 * handed out in clockwise order, so the sequence of actions around the ring never changes, only
 * how much of the circle they occupy.
 * ------------------------------------------------------------------------------------------- */

/** Degrees clockwise from north. Cardinals first (the cross), then the diagonals as fallbacks. */
export const RING_ANGLES = [0, 90, 180, 270, 45, 135, 225, 315] as const;

export type RingLayoutInput = {
  /** Puck centre, viewport coordinates. */
  cx: number;
  cy: number;
  /** Distance from the puck centre to each ring button's centre. */
  radius: number;
  /** Ring button diameter. */
  buttonSize: number;
  /** Viewport. */
  vw: number;
  vh: number;
  /** Clearance kept from every viewport edge. */
  margin: number;
  /** How many buttons need a place. */
  count: number;
};

export type RingSlot = {
  /** Degrees clockwise from north. */
  angle: number;
  /** Offset of the button's centre from the puck's centre, in px. */
  dx: number;
  dy: number;
};

/**
 * Where each ring button goes, clockwise. Returns fewer than `count` slots only when the puck is
 * so hemmed in (a tiny viewport) that not even the diagonals fit; the caller then shows what fits.
 */
export function ringLayout(input: RingLayoutInput): RingSlot[] {
  const { cx, cy, radius, buttonSize, vw, vh, margin, count } = input;
  const half = buttonSize / 2;
  const chosen: RingSlot[] = [];
  for (const angle of RING_ANGLES) {
    if (chosen.length >= count) break;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.sin(rad) * radius;
    const dy = -Math.cos(rad) * radius;
    const x = cx + dx;
    const y = cy + dy;
    const fits = x - half >= margin && x + half <= vw - margin && y - half >= margin && y + half <= vh - margin;
    // `|| 0` turns the -0 that Math.round makes of a tiny negative into a plain 0.
    if (fits) chosen.push({ angle, dx: Math.round(dx) || 0, dy: Math.round(dy) || 0 });
  }
  return chosen.sort((a, b) => a.angle - b.angle);
}
