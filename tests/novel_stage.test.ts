import { describe, expect, it } from "vitest";
import { createNovelStageTracker } from "@/rendering/novel_stage";
import { parseNovel, type NovelCharacter, type NovelFrame } from "@/rendering/novel";

const cast: NovelCharacter[] = [
  { id: "nyx", name: "Nyxadra", triggers: "Nyx, dragon, kitchen" },
  { id: "coral", name: "Coral", triggers: "Corrilygos" },
  { id: "sera", name: "Serastra", triggers: "chef, kitchen" },
  { id: "player", name: "You", triggers: "you" },
];
const narration = (text: string): NovelFrame => ({ text, kind: "narration", speakerId: null });
const dialogue = (text: string, speakerId: string | null = null): NovelFrame => ({ text, kind: "dialogue", speakerId });

describe("visual novel stage progression", () => {
  it("adds triggered characters left then right, even during narration", () => {
    const snapshots = createNovelStageTracker(cast)([narration("Nyx rinses the dishes."), narration("Nyx watches Corrilygos peek out."), dialogue('"Hello!"')]);
    expect(snapshots).toEqual([["nyx", null], ["nyx", "coral"], [null, null]]);
    expect(snapshots[0]).toEqual(["nyx", null]);
  });
  it("keeps recurring characters on their side and reuses vacated slots", () => {
    expect(createNovelStageTracker(cast)([narration("Nyx meets Coral."), narration("Coral waits."), narration("Serastra meets Coral.")]))
      .toEqual([["nyx", "coral"], [null, "coral"], ["sera", "coral"]]);
    expect(createNovelStageTracker(cast)([narration("Nyx meets Coral."), narration("Coral greets Nyx.")]))
      .toEqual([["nyx", "coral"], ["nyx", "coral"]]);
  });
  it("gives the speaking character a slot when several names are mentioned", () => {
    expect(createNovelStageTracker(cast)([dialogue('"Nyx, Coral, Serastra, welcome!"', "sera")])[0]).toEqual(["nyx", "sera"]);
  });
  it("removes characters immediately when the next line has no matching trigger", () => {
    expect(createNovelStageTracker(cast)([narration("Coral waves."), narration("The room is quiet.")]))
      .toEqual([["coral", null], [null, null]]);
  });
  it("shows the detected or corrected speaker but excludes player and missing cards", () => {
    const frames = [narration("You wait."), dialogue("Hello", "nyx"), dialogue("Goodbye", "player")];
    expect(createNovelStageTracker(cast)(frames)).toEqual([[null, null], ["nyx", null], [null, null]]);
    expect(createNovelStageTracker(cast)(frames, { 1: "coral" })).toEqual([[null, null], ["coral", null], [null, null]]);
    expect(createNovelStageTracker(cast)(frames, { 1: "" })).toEqual([[null, null], [null, null], [null, null]]);
    expect(createNovelStageTracker(cast)([dialogue("Hello", "deleted")])).toEqual([[null, null]]);
  });
  it("retains the speaker's side during speech and removes them after unrelated narration", () => {
    expect(createNovelStageTracker(cast)([narration("Coral greets Nyx."), dialogue('"Hello!"', "nyx"), narration("The room is quiet.")]))
      .toEqual([["coral", "nyx"], [null, "nyx"], [null, null]]);
    expect(createNovelStageTracker(cast)([dialogue('"Coral, Serastra, listen."', "nyx")])).toEqual([["coral", "nyx"]]);
  });
  it("shows speakers attributed before or after straight and curly quotes", () => {
    for (const text of ['Nyx says, "Hello."', '"Hello," Nyx says.', 'Nyx whispers, “Hello.”', '“Hello,” whispered Nyx.']) {
      const frames = parseNovel(text, cast);
      const stages = createNovelStageTracker(cast)(frames);
      const index = frames.findIndex(f => f.kind === "dialogue");
      expect(frames[index]?.speakerId).toBe("nyx");
      expect(stages[index]).toContain("nyx");
    }
  });
  it("keeps an inferred speaker alongside a character mentioned in their dialogue", () => {
    const frames = parseNovel('Nyx grips the sink. "Coral is not trouble," she mutters.', cast);
    const index = frames.findIndex(f => f.kind === "dialogue");
    expect(frames[index]).toMatchObject({ speakerId: "nyx", inferred: true });
    expect(createNovelStageTracker(cast)(frames)[index]).toEqual(["nyx", "coral"]);
  });
  it("matches full aliases and ignores ambiguous shared triggers", () => {
    expect(createNovelStageTracker(cast)([narration("The kitchen is empty."), narration("Nyxie's chair is empty."), narration("NYX waves.")]))
      .toEqual([[null, null], [null, null], ["nyx", null]]);
    const tracker = createNovelStageTracker([{ id: "mary", name: "Mary Ann", triggers: "" }, { id: "ann", name: "Ann", triggers: "" }]);
    expect(tracker([narration("Mary Ann appears.")])).toEqual([["mary", null]]);
  });
  it("does not retain state across another adventure, retry or edited text", () => {
    const track = createNovelStageTracker(cast);
    track([narration("Nyx arrives.")]);
    expect(track([narration("Coral arrives.")])).toEqual([["coral", null]]);
  });
});
