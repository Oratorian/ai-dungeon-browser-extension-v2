import { describe, it, expect } from "vitest";
import { ringLayout, floatingButtonSize, FLOATING_BUTTON_DEFAULT_SIZE } from "@/shared/floating_button";

// A 1000x800 viewport, ring radius 60, buttons 36 wide, 16px edge margin, four actions.
const base = { radius: 60, buttonSize: 36, vw: 1000, vh: 800, margin: 16, count: 4 };
const angles = (slots: { angle: number }[]) => slots.map((s) => s.angle);

describe("ringLayout", () => {
  it("gives a puck in the open the plain cross, clockwise from north", () => {
    expect(angles(ringLayout({ ...base, cx: 500, cy: 400 }))).toEqual([0, 90, 180, 270]);
  });

  it("drops the slot that would leave the viewport on the right edge and uses a diagonal instead", () => {
    // Puck centre 40px from the right edge: east (x = 1020) is out, so the diagonals toward the
    // inside take over, in clockwise order.
    const slots = ringLayout({ ...base, cx: 960, cy: 400 });
    expect(angles(slots)).toEqual([0, 180, 225, 270]);
    for (const s of slots) expect(960 + s.dx + 18).toBeLessThanOrEqual(1000 - 16);
  });

  it("keeps only the inward quarter plus its diagonal in a corner", () => {
    // Bottom-right corner: south and east are out, as are SE, SW, NE. What is left: N, W, NW.
    expect(angles(ringLayout({ ...base, cx: 960, cy: 760 }))).toEqual([0, 270, 315]);
  });

  it("puts the same first choices in the same places regardless of count", () => {
    const two = ringLayout({ ...base, cx: 500, cy: 400, count: 2 });
    expect(angles(two)).toEqual([0, 90]);
  });

  it("offsets point the right way: north is up, east is right", () => {
    const [north, east] = ringLayout({ ...base, cx: 500, cy: 400, count: 2 });
    expect(north).toMatchObject({ angle: 0, dx: 0, dy: -60 });
    expect(east).toMatchObject({ angle: 90, dx: 60, dy: 0 });
  });
});

describe("floatingButtonSize", () => {
  it("clamps into range and falls back for junk", () => {
    expect(floatingButtonSize(10)).toBe(24);
    expect(floatingButtonSize(999)).toBe(128);
    expect(floatingButtonSize(50.4)).toBe(50);
    expect(floatingButtonSize("64")).toBe(FLOATING_BUTTON_DEFAULT_SIZE);
    expect(floatingButtonSize(undefined)).toBe(FLOATING_BUTTON_DEFAULT_SIZE);
  });
});
