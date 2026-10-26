export type NovelPortraitPlacement = { left: number; bottom: number; width: number; height: number };

/** Fit the visible cast in CSS pixels, sharing a height and bottom baseline. */
export function layoutNovelPortraits(width: number, height: number, ratios: (number | undefined)[]): NovelPortraitPlacement[] {
  const count = ratios.length;
  if (!count) return [];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ratios.map(() => ({ left: 0, bottom: 0, width: 0, height: 0 }));
  }
  // Leave room for the portrait outline/shadow at the sides of the stage.
  const inset = Math.min(12, width * 0.02);
  const available = width - inset * 2;
  const overlapLimit = count > 2 ? 0.06 : 0;
  const aspects = ratios.map(value => value !== undefined && Number.isFinite(value) && value > 0 ? value : 0.65);
  const totalAspect = aspects.reduce((sum, ratio) => sum + ratio, 0);
  const adjacentAspect = aspects.slice(1).reduce((sum, ratio, index) => sum + Math.min(ratio, aspects[index]!), 0);
  const pictureHeight = Math.min(height, available / (totalAspect - adjacentAspect * overlapLimit));
  // Width-limited portraits can become much shorter than the viewport. Keep
  // their heads in the scene instead of sinking the whole group behind the
  // reading bar. This depends only on the cast and viewport, never text height.
  const bottom = Math.max(0, height / 2 - pictureHeight);
  const pictures = aspects.map(ratio => ({ width: pictureHeight * ratio, height: pictureHeight }));
  const free = available - totalAspect * pictureHeight;
  const gap = Math.max(0, free) / (count + 1);
  const overlap = free < 0 && adjacentAspect > 0 ? -free / (adjacentAspect * pictureHeight) : 0;
  let left = inset + gap;
  return pictures.map((picture, index) => {
    const placement = { left, bottom, ...picture };
    const next = pictures[index + 1];
    left += picture.width + gap - (next ? Math.min(picture.width, next.width) * overlap : 0);
    return placement;
  });
}
