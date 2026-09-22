import { describe, expect, it } from "vitest";
import { createNovelStageTracker } from "@/rendering/novel_stage";
import { parseNovel, type NovelCharacter } from "@/rendering/novel";

const cast: NovelCharacter[] = [
  { id: "nyx", name: "Nyxadra", triggers: "Nyx, dragon, kitchen" },
  { id: "coral", name: "Coral", triggers: "Corrilygos" },
  { id: "sera", name: "Serastra", triggers: "chef, kitchen" },
  { id: "sage", name: "Sage", triggers: "" },
  { id: "faelar", name: "Faelar", triggers: "" },
];
const track = (text: string) => createNovelStageTracker(cast)(parseNovel(text));

describe("paragraph-based visual novel scenes", () => {
  it("keeps the paragraph's cast through narration and quotes, including names after speech", () => {
    const text = 'Nyx rinses the pods. She whispers, "A crescendo of cream." Coral nods.';
    expect(track(text)).toEqual(Array.from({length: 3}, () => ["nyx", "coral", null, null]));
    expect(track('"Hello," Nyx says.')).toEqual([["nyx", null, null, null], ["nyx", null, null, null]]);
  });
  it("updates the cast at paragraph boundaries, preserving recurring characters' slots", () => {
    expect(track('Nyx meets Coral.\n\nCoral welcomes Serastra.\n\nThe room is quiet.'))
      .toEqual([["nyx", "coral", null, null], ["sera", "coral", null, null], [null, null, null, null]]);
  });
  it("does not borrow mentions from a following paragraph or response", () => {
    expect(track('"Hello."\n\nNyx arrives.')).toEqual([[null, null, null, null], ["nyx", null, null, null]]);
    const tracker = createNovelStageTracker(cast);
    expect(tracker([...parseNovel("Nyx arrives."), ...parseNovel('"Hello."')]))
      .toEqual([["nyx", null, null, null], [null, null, null, null]]);
  });
  it("caps the paragraph cast at four in mention order and keeps it stable across quotes", () => {
    expect(track('Nyx Coral Serastra Sage Faelar. "Welcome."'))
      .toEqual([["nyx", "coral", "sera", "sage"], ["nyx", "coral", "sera", "sage"]]);
  });
  it("reconstructs independent snapshots after edits and handles repeated paragraph text", () => {
    const tracker = createNovelStageTracker(cast);
    const frames = parseNovel("Nyx Coral\n\nSage\n\nNyx Coral");
    expect(tracker(frames)).toEqual([["nyx", "coral", null, null], ["sage", null, null, null], ["nyx", "coral", null, null]]);
    expect(tracker(parseNovel("Coral"))).toEqual([["coral", null, null, null]]);
    expect(tracker([])).toEqual([]);
  });
  it("updates the entire paragraph cast as streamed text adds a mention", () => {
    expect(track('Nyx says, "Hello')).toEqual([["nyx", null, null, null]]);
    expect(track('Nyx says, "Hello Coral."')).toEqual([["nyx", "coral", null, null], ["nyx", "coral", null, null]]);
  });
  it("matches full aliases and ignores ambiguous shared triggers", () => {
    expect(track("The kitchen is empty.\nNyxie's chair is empty.\nNYX waves."))
      .toEqual([[null, null, null, null], [null, null, null, null], ["nyx", null, null, null]]);
    const tracker = createNovelStageTracker([{id:"mary", name:"Mary Ann", triggers:""}, {id:"ann", name:"Ann", triggers:""}]);
    expect(tracker(parseNovel("Mary Ann appears."))).toEqual([["mary",null,null,null]]);
  });
});
