type BookmarkFrame = { text: string; paragraph: string };
export type NovelBookmark = { index: number; text: string; paragraph: string };

export function readNovelBookmark(value: unknown): NovelBookmark | undefined {
  if (!value || typeof value !== "object") return;
  const bookmark = value as Partial<NovelBookmark>;
  if (typeof bookmark.index !== "number" || !Number.isInteger(bookmark.index) || bookmark.index < 0
    || typeof bookmark.text !== "string" || typeof bookmark.paragraph !== "string") return;
  return { index: bookmark.index, text: bookmark.text, paragraph: bookmark.paragraph };
}

export function createNovelBookmark(frames: BookmarkFrame[], index: number): NovelBookmark | undefined {
  const frame = frames[index];
  return frame ? { index, text: frame.text, paragraph: frame.paragraph } : undefined;
}

/** Prefer the saved passage over page numbers, which change as history is loaded or edited. */
export function restoreNovelBookmark(bookmark: NovelBookmark, frames: BookmarkFrame[]): number {
  const index = Number.isInteger(bookmark?.index) ? Math.max(0, bookmark.index) : 0;
  const nearest = (matches: number[]) => matches.reduce((best, next) =>
    Math.abs(next - index) < Math.abs(best - index) ? next : best);
  for (const matches of [
    frames.flatMap((frame, i) => frame.text === bookmark?.text && frame.paragraph === bookmark?.paragraph ? [i] : []),
    frames.flatMap((frame, i) => frame.text === bookmark?.text ? [i] : []),
    frames.flatMap((frame, i) => frame.paragraph === bookmark?.paragraph ? [i] : []),
  ]) if (matches.length) return nearest(matches);
  return Math.max(0, Math.min(index, frames.length - 1));
}
