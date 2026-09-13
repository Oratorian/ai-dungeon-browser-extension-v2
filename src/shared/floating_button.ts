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
 * The quick actions sit on a circle around the puck. Which part of that circle is usable depends
 * on where the puck is parked: in the open all of it, against an edge the half facing inward, in
 * a corner a quarter. The circle is sampled every few degrees and each sample kept if a button
 * there stays inside the viewport; the longest unbroken run of survivors is the usable arc, and
 * the buttons are spread evenly across it, so a puck in the open gets the plain cross and one in a
 * corner gets all its buttons fanned through the quarter that faces the screen. When the arc is
 * too short for the buttons to sit side by side, the radius grows until they do. The order of the
 * buttons along the arc is always clockwise, so the sequence of actions never changes.
 * ------------------------------------------------------------------------------------------- */

const ARC_STEP = 5; // degrees between samples
const MAX_RADIUS_GROWTH = 3; // the radius may grow to this multiple of the requested one

export type RingLayoutInput = {
  /** Puck centre, viewport coordinates. */
  cx: number;
  cy: number;
  /** Distance from the puck centre to each ring button's centre, at least. */
  radius: number;
  /** Ring button diameter. */
  buttonSize: number;
  /** Smallest clearance between two neighbouring buttons. */
  gap: number;
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

export type RingLayout = {
  /** The radius actually used; the requested one unless the arc was too short. */
  radius: number;
  /** One slot per button, clockwise along the usable arc. */
  slots: RingSlot[];
};

type Arc = { full: true } | { full: false; start: number; span: number };

/** The longest unbroken run of usable samples, treated as a circle. */
function usableArc(ok: boolean[]): Arc | null {
  const n = ok.length;
  if (ok.every(Boolean)) return { full: true };
  if (!ok.some(Boolean)) return null;
  let best = { start: 0, len: 0 };
  let runStart = -1;
  // Walk twice around so a run crossing north is seen whole.
  for (let i = 0; i < 2 * n; i++) {
    if (ok[i % n]) {
      if (runStart < 0) runStart = i;
      const len = Math.min(i - runStart + 1, n);
      if (len > best.len) best = { start: runStart % n, len };
    } else {
      runStart = -1;
    }
  }
  return { full: false, start: best.start * ARC_STEP, span: (best.len - 1) * ARC_STEP };
}

export function ringLayout(input: RingLayoutInput): RingLayout {
  const { cx, cy, buttonSize, gap, vw, vh, margin, count } = input;
  const half = buttonSize / 2;
  const minChord = buttonSize + gap;
  const maxRadius = input.radius * MAX_RADIUS_GROWTH;

  const fitsAt = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    const x = cx + Math.sin(rad) * r;
    const y = cy - Math.cos(rad) * r;
    return x - half >= margin && x + half <= vw - margin && y - half >= margin && y + half <= vh - margin;
  };

  const build = (angles: number[], r: number): RingLayout => ({
    radius: r,
    slots: angles.map((angle) => {
      const rad = (angle * Math.PI) / 180;
      // `|| 0` turns the -0 that Math.round makes of a tiny negative into a plain 0.
      return { angle, dx: Math.round(Math.sin(rad) * r) || 0, dy: Math.round(-Math.cos(rad) * r) || 0 };
    }),
  });

  const spread = (arc: Arc): number[] => {
    if (count <= 0) return [];
    if (arc.full) return Array.from({ length: count }, (_, i) => (i * 360) / count);
    if (count === 1) return [(arc.start + arc.span / 2) % 360];
    return Array.from({ length: count }, (_, i) => (arc.start + (arc.span * i) / (count - 1)) % 360);
  };

  let radius = input.radius;
  let angles: number[] = spread({ full: true });
  // A larger radius can shorten the arc, which asks for a larger radius again; a few rounds settle
  // it for any real viewport, and the cap stops a tiny one from running away.
  for (let round = 0; round < 4; round++) {
    const ok: boolean[] = [];
    for (let a = 0; a < 360; a += ARC_STEP) ok.push(fitsAt(a, radius));
    const arc = usableArc(ok);
    if (!arc) break; // nothing fits at all: fall through with whatever we have
    angles = spread(arc);
    const step = arc.full ? 360 / count : count > 1 ? arc.span / (count - 1) : 360;
    const needed = step >= 180 ? 0 : minChord / (2 * Math.sin((step * Math.PI) / 360));
    if (needed <= radius + 0.5 || radius >= maxRadius) break;
    radius = Math.min(maxRadius, Math.ceil(needed));
  }
  return build(angles, radius);
}
