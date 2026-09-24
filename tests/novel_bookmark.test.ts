import { describe, expect, it } from "vitest";
import { createNovelBookmark, readNovelBookmark, restoreNovelBookmark } from "@/rendering/novel_bookmark";

const frame = (text: string, paragraph = text) => ({ text, paragraph });
describe("VN reading bookmarks", () => {
  it("ignores malformed stored positions", () => {
    for (const value of [null, {}, { index: -1, text: "x", paragraph: "x" }, { index: 1.5, text: "x", paragraph: "x" }]) {
      expect(readNovelBookmark(value)).toBeUndefined();
    }
    const bookmark = { index: 2, text: "Saved", paragraph: "Saved" };
    expect(readNovelBookmark(bookmark)).toEqual(bookmark);
  });
  it("restores the passage when new history shifts page numbers", () => {
    const original = [frame("First"), frame("Saved"), frame("Last")];
    const bookmark = createNovelBookmark(original, 1)!;
    expect(restoreNovelBookmark(bookmark, [frame("Earlier"), ...original])).toBe(2);
  });
  it("distinguishes repeated dialogue by its paragraph", () => {
    const bookmark = createNovelBookmark([frame("Yes.", "Yes. She smiles.")], 0)!;
    expect(restoreNovelBookmark(bookmark, [frame("Yes.", "Yes. He nods."), frame("Yes.", "Yes. She smiles.")])).toBe(1);
  });
  it("falls back to the nearest valid page after a replacement or deletion", () => {
    const bookmark = { index: 8, text: "Deleted", paragraph: "Deleted" };
    expect(restoreNovelBookmark(bookmark, [frame("New"), frame("End")])).toBe(1);
    expect(restoreNovelBookmark(bookmark, [])).toBe(0);
    expect(createNovelBookmark([], 0)).toBeUndefined();
  });
  it("uses the nearest occurrence for identical repeated passages", () => {
    expect(restoreNovelBookmark({ index: 3, text: "Again", paragraph: "Again" },
      [frame("Again"), frame("Other"), frame("Again")])).toBe(2);
  });
});
