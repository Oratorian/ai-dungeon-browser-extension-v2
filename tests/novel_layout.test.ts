import { expect, it } from "vitest";
import { layoutNovelPortraits } from "@/rendering/novel_layout";

function expectFit(width: number, height: number, ratios: number[]) {
  const placements = layoutNovelPortraits(width, height, ratios);
  expect(placements).toHaveLength(ratios.length);
  for (const [index, picture] of placements.entries()) {
    expect(picture.left).toBeGreaterThanOrEqual(0);
    expect(picture.left + picture.width).toBeLessThanOrEqual(width + 0.00001);
    expect(picture.height).toBeGreaterThan(0);
    expect(picture.height).toBeLessThanOrEqual(height);
    expect(picture.bottom).toBeGreaterThanOrEqual(0);
    expect(picture.bottom + picture.height).toBeLessThanOrEqual(height);
    expect(picture.width / picture.height).toBeCloseTo(ratios[index]!);
    const next = placements[index + 1];
    if (next) {
      const overlap = picture.left + picture.width - next.left;
      expect(overlap).toBeLessThanOrEqual(Math.min(picture.width, next.width) * 0.06 + 0.00001);
    }
  }
  return placements;
}

it("fits one to four portraits on narrow, laptop, desktop and 4K stages", () => {
  for (const [width, height] of [[366, 480], [1302, 440], [1856, 750], [3776, 1800]]) {
    for (let count = 1; count <= 4; count++) expectFit(width!, height!, [0.42, 0.57, 0.78, 1.12].slice(0, count));
  }
});

it("scales four wide bust portraits down instead of covering neighboring characters", () => {
  const pictures = expectFit(1200, 720, [1.12, 1.12, 1.12, 1.12]);
  expect(pictures.every(picture => picture.width < 330 && picture.height < 300)).toBe(true);
});

it("centers a single remaining character and gives two characters separate space", () => {
  const single = expectFit(1200, 600, [0.6])[0]!;
  expect(single.left + single.width / 2).toBeCloseTo(600);
  const pair = expectFit(1200, 600, [0.6, 0.8]);
  expect(pair[0]!.left + pair[0]!.width).toBeLessThan(pair[1]!.left);
});

it("uses more room after resizing and keeps each picture's proportions", () => {
  const ratios = [0.42, 0.57, 0.78, 1.12];
  const small = expectFit(1200, 350, ratios);
  const tall = expectFit(1200, 700, ratios);
  const wide = expectFit(2400, 1400, ratios);
  for (const index of ratios.keys()) {
    expect(tall[index]!.height).toBeGreaterThanOrEqual(small[index]!.height);
    expect(wide[index]!.height).toBeGreaterThan(tall[index]!.height);
  }
});

it("keeps the cast at one shared height while preserving different image proportions", () => {
  const [narrow, wide] = expectFit(1200, 700, [0.4, 2]);
  expect(narrow!.height).toBe(wide!.height);
  expect(narrow!.bottom).toBe(wide!.bottom);
  expect(wide!.width).toBeGreaterThan(narrow!.width);
});

it("handles empty stages, initial zero measurements and pictures that have not loaded", () => {
  expect(layoutNovelPortraits(1200, 700, [])).toEqual([]);
  expect(layoutNovelPortraits(0, 700, [0.6])).toEqual([{ left: 0, bottom: 0, width: 0, height: 0 }]);
  expect(layoutNovelPortraits(1200, 0, [0.6])).toEqual([{ left: 0, bottom: 0, width: 0, height: 0 }]);
  const pending = layoutNovelPortraits(1200, 700, [undefined, 0, NaN, -1]);
  expect(pending.every(picture => Number.isFinite(picture.left) && picture.width > 0 && picture.height > 0)).toBe(true);
});

it("keeps small width-limited groups out of the reading bar without lifting desktop portraits", () => {
  const narrow = expectFit(366, 660, [0.42, 0.57, 0.78, 1.12]);
  expect(narrow.every(picture => picture.bottom > 150 && picture.bottom === narrow[0]!.bottom)).toBe(true);
  const desktop = expectFit(1856, 990, [0.42, 0.57, 0.78, 1.12]);
  expect(desktop.every(picture => picture.bottom === 0)).toBe(true);
});
