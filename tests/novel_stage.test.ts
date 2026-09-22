import { describe, expect, it } from "vitest";
import { createNovelStageTracker } from "@/rendering/novel_stage";
import { parseNovel, type NovelCharacter, type NovelFrame } from "@/rendering/novel";

const cast: NovelCharacter[] = [
  { id: "nyx", name: "Nyxadra", triggers: "Nyx, dragon, kitchen" },
  { id: "coral", name: "Coral", triggers: "Corrilygos" },
  { id: "sera", name: "Serastra", triggers: "chef, kitchen" },
];
const line = (text: string): NovelFrame => ({ text, kind: "narration" });

describe("visual novel stage progression", () => {
  it("adds triggered characters left then right and removes absent characters", () => {
    const snapshots = createNovelStageTracker(cast)([line("Nyx rinses the dishes."), line("Nyx watches Corrilygos peek out."), line("The room is quiet.")]);
    expect(snapshots).toEqual([["nyx", null], ["nyx", "coral"], [null, null]]);
    expect(snapshots[0]).toEqual(["nyx", null]);
  });
  it("keeps recurring characters on their side and reuses vacated slots", () => {
    expect(createNovelStageTracker(cast)([line("Nyx meets Coral."), line("Coral waits."), line("Serastra meets Coral.")]))
      .toEqual([["nyx", "coral"], [null, "coral"], ["sera", "coral"]]);
    expect(createNovelStageTracker(cast)([line("Nyx meets Coral."), line("Coral greets Nyx.")]))
      .toEqual([["nyx", "coral"], ["nyx", "coral"]]);
  });
  it("uses the first two mentions, without prioritizing a speaker", () => {
    expect(createNovelStageTracker(cast)([line('"Nyx, Coral, welcome," Serastra says.')]))
      .toEqual([["nyx", "coral"]]);
  });
  it("does not carry a speaker into an untriggered quote", () => {
    for (const text of ['Nyx says, "Hello."', '"Hello," Nyx says.']) {
      const frames = parseNovel(text);
      const stages = createNovelStageTracker(cast)(frames);
      expect(stages[frames.findIndex(f => f.kind === "dialogue")]).toEqual([null, null]);
    }
    const frames = parseNovel('Nyx grips the sink. "Coral is not trouble," she mutters.');
    expect(createNovelStageTracker(cast)(frames)).toEqual([["nyx", null], ["coral", null], [null, null]]);
  });
  it("matches full aliases and ignores ambiguous shared triggers", () => {
    expect(createNovelStageTracker(cast)([line("The kitchen is empty."), line("Nyxie's chair is empty."), line("NYX waves.")]))
      .toEqual([[null, null], [null, null], ["nyx", null]]);
    const tracker = createNovelStageTracker([{ id: "mary", name: "Mary Ann", triggers: "" }, { id: "ann", name: "Ann", triggers: "" }]);
    expect(tracker([line("Mary Ann appears.")])).toEqual([["mary", null]]);
  });
  it("does not retain state across another adventure, retry or edited text", () => {
    const track = createNovelStageTracker(cast);
    track([line("Nyx arrives.")]);
    expect(track([line("Coral arrives.")])).toEqual([["coral", null]]);
  });
});
