import { describe, expect, it, vi } from "vitest";
import { parseNovel } from "@/rendering/novel";
import { firstContinuationFrame, retainedNovelIndex, splitNarratedFrames } from "@/rendering/novel_narration";
import { StableNarrationWindow } from "@/tts/queue";

describe("narrated continuation", () => {
  it("keeps paragraph metadata while splitting long narration into bounded sentences", () => {
    const paragraph = "The door opens. A traveler arrives. " + "Footsteps echo through the hall, ".repeat(30);
    const frames = splitNarratedFrames(parseNovel(paragraph));
    expect(frames.slice(0, 2).map(f => f.text)).toEqual(["The door opens.", "A traveler arrives."]);
    expect(frames.every(f => f.text.length <= 240 && f.paragraph === paragraph)).toBe(true);
    expect(frames.filter(f => f.startsParagraph)).toHaveLength(1);
    expect(frames.filter(f => f.startsPassage)).toHaveLength(1);
    expect(frames.map(f => f.text).join(" ")).toBe(paragraph.trim());
  });
  it("waits without rewinding and selects only the first new continuation frame", () => {
    const before = ["Old first sentence.", "Old last sentence."];
    expect(firstContinuationFrame(before, before)).toBe(-1);
    expect(firstContinuationFrame(before, [...before, "New sentence.", "Another sentence."])).toBe(2);
    expect(firstContinuationFrame(["An unfinished"], ["An unfinished sentence."])).toBe(0);
    expect(firstContinuationFrame(before, [])).toBe(-1);
    expect(firstContinuationFrame(before, ["Unrelated replacement."])).toBe(-1);
  });
  it("retains the selected sentence when React replaces passage elements", () => {
    const previous = { source: {} as HTMLElement, offset: 1, text: "Last sentence." };
    const source = {} as HTMLElement;
    const frames = [{ source, offset: 0, text: "First sentence." }, { source, offset: 1, text: "Last sentence." }];
    expect(retainedNovelIndex(previous, 1, frames)).toBe(1);
  });
  it("starts stable early text while later tokens are still streaming", () => {
    vi.useFakeTimers();
    try {
      const update = vi.fn();
      const window = new StableNarrationWindow(update);
      window.setWindow(["Complete sentence.", "A"]);
      vi.advanceTimersByTime(200);
      window.setWindow(["Complete sentence.", "A new"]);
      vi.advanceTimersByTime(200);
      window.setWindow(["Complete sentence.", "A new traveler"]);
      vi.advanceTimersByTime(100);
      expect(update).toHaveBeenLastCalledWith(["Complete sentence."]);
      window.dispose();
      vi.advanceTimersByTime(1000);
      expect(update).toHaveBeenLastCalledWith(["Complete sentence."]);
    } finally { vi.useRealTimers(); }
  });
});
