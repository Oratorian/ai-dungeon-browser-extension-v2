import { describe, expect, it, vi } from "vitest";
import { parseNovel } from "@/rendering/novel";
import { firstContinuationFrame, retainedNovelIndex, splitNarratedFrames, trackRetriedPassage } from "@/rendering/novel_narration";
import { StableNarrationWindow } from "@/tts/queue";

describe("narrated continuation", () => {
  it("waits through Retry removal and selects the replacement, not the preceding action", () => {
    const action = { element: {} as HTMLElement, text: "You wave." };
    const response = { element: {} as HTMLElement, text: "Old response. Old ending." };
    const track = trackRetriedPassage([action, response]);
    expect(track([action, response])).toBe(-1);
    expect(track([action, { ...response, element: {} as HTMLElement }])).toBe(-1);
    expect(track([action])).toBe(-1);
    expect(track([])).toBe(-1);
    expect(track([{ element: {} as HTMLElement, text: "New response." }])).toBe(0);
  });
  it("handles in-place Retry edits and an identical replacement after removal", () => {
    const response = { element: {} as HTMLElement, text: "Old response." };
    expect(trackRetriedPassage([response])([{ ...response, text: "New response." }])).toBe(0);
    const track = trackRetriedPassage([response]);
    expect(track([])).toBe(-1);
    expect(track([{ ...response, element: {} as HTMLElement }])).toBe(0);
  });
  it("keeps paragraph metadata and never cuts a sentence at an arbitrary word limit", () => {
    const paragraph = "The door opens. A traveler arrives. " + "Footsteps echo through the hall, ".repeat(30);
    const frames = splitNarratedFrames(parseNovel(paragraph));
    expect(frames.slice(0, 2).map(f => f.text)).toEqual(["The door opens.", "A traveler arrives."]);
    expect(frames.every(f => f.paragraph === paragraph)).toBe(true);
    expect(frames).toHaveLength(3);
    expect(frames.filter(f => f.startsParagraph)).toHaveLength(1);
    expect(frames.filter(f => f.startsPassage)).toHaveLength(1);
    expect(frames.map(f => f.text).join(" ")).toBe(paragraph.trim());
  });
  it("keeps the reported quotation and its narration in one generated line", () => {
    const sentence = '"You have a very strange way of speaking for someone who was wearing rags three days ago," she says, her voice dropping into a low, warning register.';
    const paragraph = sentence + " However, the edge is not as sharp as it usually is.";
    const frames = splitNarratedFrames(parseNovel(paragraph));
    expect(frames.map(f => f.text)).toEqual([sentence, "However, the edge is not as sharp as it usually is."]);
    expect(frames[0]?.startsParagraph).toBe(true);
    expect(frames[1]?.startsParagraph).toBeUndefined();
  });
  it.each([
    '"Why?" she asks.',
    '“Stay!” Nyx whispers, her voice trembling.',
    '«Wait!» said the guard.',
    '"Go," she says, "before it is too late."',
    'Sage says, "Follow me."',
    '"' + "There is a long road ahead, ".repeat(12) + 'so stay close," she says.',
  ])("keeps speech tags intact through both reader and TTS splitting: %s", sentence => {
    expect(splitNarratedFrames(parseNovel(sentence)).map(f => f.text)).toEqual([sentence]);
  });
  it("keeps an independent action after dialogue as its own sentence", () => {
    expect(splitNarratedFrames(parseNovel('"Hello!" The door opens.')).map(f => f.text))
      .toEqual(['"Hello!"', "The door opens."]);
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
  it("finds new actions when older history is virtualized or reformatted during Send", () => {
    const before = ["Older text.", "Previous paragraph.", "Last sentence."];
    expect(firstContinuationFrame(before, ["Previous paragraph.", "Last sentence."])).toBe(-1);
    expect(firstContinuationFrame(before, ["Previous paragraph.", "Last sentence.", "You wave.", "She waves back."])).toBe(2);
    expect(firstContinuationFrame(before, ["Last sentence.", "You wave."])).toBe(1);
    expect(firstContinuationFrame(before, ["Changed older formatting.", "Last sentence.", "You wave."])).toBe(2);
    expect(firstContinuationFrame(["Old\ntext."], ["Old text.", "You wave."])).toBe(1);
    expect(firstContinuationFrame(["Older text.", "An unfinished"], ["An unfinished sentence."])).toBe(0);
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
