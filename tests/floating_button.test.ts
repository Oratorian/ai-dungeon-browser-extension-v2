import { describe, it, expect } from "vitest";
import { ringLayout, floatingButtonSize, FLOATING_BUTTON_DEFAULT_SIZE, type RingLayoutInput } from "@/shared/floating_button";

// A 1000x800 viewport, ring radius 60, buttons 36 wide with a 6px gap, 16px edge margin, four
// actions.
const base: Omit<RingLayoutInput, "cx" | "cy"> = { radius: 60, buttonSize: 36, gap: 6, vw: 1000, vh: 800, margin: 16, count: 4 };
const angles = (layout: { slots: { angle: number }[] }) => layout.slots.map((s) => s.angle);

/** Every button inside the viewport, with the margin. */
function allFit(input: RingLayoutInput, layout: ReturnType<typeof ringLayout>) {
  const half = input.buttonSize / 2;
  return layout.slots.every((s) => {
    const x = input.cx + s.dx;
    const y = input.cy + s.dy;
    return x - half >= input.margin && x + half <= input.vw - input.margin && y - half >= input.margin && y + half <= input.vh - input.margin;
  });
}

/** Gap in degrees between each pair of neighbours along the arc. */
function steps(layout: ReturnType<typeof ringLayout>) {
  const a = angles(layout);
  return a.slice(1).map((v, i) => (v - a[i]! + 360) % 360);
}

describe("ringLayout", () => {
  it("gives a puck in the open the plain cross, clockwise from north, at the requested radius", () => {
    const layout = ringLayout({ ...base, cx: 500, cy: 400 });
    expect(angles(layout)).toEqual([0, 90, 180, 270]);
    expect(layout.radius).toBe(60);
  });

  it("spreads all four evenly through the inward half on an edge", () => {
    const input = { ...base, cx: 960, cy: 400 };
    const layout = ringLayout(input);
    expect(layout.slots).toHaveLength(4);
    expect(allFit(input, layout)).toBe(true);
    // Even spacing, and the fan is symmetric about west (270).
    const gaps = steps(layout);
    for (const g of gaps) expect(Math.abs(g - gaps[0]!)).toBeLessThanOrEqual(ARC_TOLERANCE);
    // Unwrapped: the arc runs from south round through west to north, where the last angle is 0.
    const first = angles(layout)[0]!;
    const last = first + gaps.reduce((sum, g) => sum + g, 0);
    expect(Math.abs(((first + last) / 2) % 360 - 270)).toBeLessThanOrEqual(ARC_TOLERANCE);
  });

  it("keeps all four buttons in a corner, fanned through the quarter that faces the screen", () => {
    const input = { ...base, cx: 960, cy: 760 };
    const layout = ringLayout(input);
    expect(layout.slots).toHaveLength(4);
    expect(allFit(input, layout)).toBe(true);
    // Everything lies between west (270) and north (0/360), and nothing was dropped.
    for (const a of angles(layout)) expect(a >= 270 || a === 0).toBe(true);
    const gaps = steps(layout);
    for (const g of gaps) expect(Math.abs(g - gaps[0]!)).toBeLessThanOrEqual(ARC_TOLERANCE);
  });

  it("pushes the radius out when a short arc cannot seat the buttons side by side", () => {
    const input = { ...base, cx: 960, cy: 760 };
    const layout = ringLayout(input);
    // Four 36px buttons plus gaps need more than 60px of radius across a 90 degree arc.
    expect(layout.radius).toBeGreaterThan(60);
    // ...and neighbours do not overlap at the radius chosen.
    for (let i = 1; i < layout.slots.length; i++) {
      const a = layout.slots[i - 1]!;
      const b = layout.slots[i]!;
      expect(Math.hypot(a.dx - b.dx, a.dy - b.dy)).toBeGreaterThanOrEqual(base.buttonSize + base.gap - 1);
    }
  });

  it("orders the buttons clockwise along the arc whatever the count", () => {
    const two = ringLayout({ ...base, cx: 500, cy: 400, count: 2 });
    expect(angles(two)).toEqual([0, 180]);
    const three = ringLayout({ ...base, cx: 960, cy: 400, count: 3 });
    expect(steps(three).every((g) => g > 0 && g < 180)).toBe(true);
  });

  it("offsets point the right way: north is up, east is right", () => {
    const { slots } = ringLayout({ ...base, cx: 500, cy: 400 });
    expect(slots[0]).toMatchObject({ angle: 0, dx: 0, dy: -60 });
    expect(slots[1]).toMatchObject({ angle: 90, dx: 60, dy: 0 });
  });
});

// Angles are sampled every 5 degrees, so spacing can be off by up to one sample.
const ARC_TOLERANCE = 5;

describe("floatingButtonSize", () => {
  it("clamps into range and falls back for junk", () => {
    expect(floatingButtonSize(10)).toBe(24);
    expect(floatingButtonSize(999)).toBe(128);
    expect(floatingButtonSize(50.4)).toBe(50);
    expect(floatingButtonSize("64")).toBe(FLOATING_BUTTON_DEFAULT_SIZE);
    expect(floatingButtonSize(undefined)).toBe(FLOATING_BUTTON_DEFAULT_SIZE);
  });
});
