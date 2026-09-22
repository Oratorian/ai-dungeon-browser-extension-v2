import { describe, expect, it } from "vitest";
import { createNovelStageTracker } from "@/rendering/novel_stage";
import { parseNovel, type NovelCharacter, type NovelFrame } from "@/rendering/novel";

const cast: NovelCharacter[] = [
  { id: "nyx", name: "Nyxadra", triggers: "Nyx, dragon, kitchen" },
  { id: "coral", name: "Coral", triggers: "Corrilygos" },
  { id: "sera", name: "Serastra", triggers: "chef, kitchen" },
  { id: "sage", name: "Sage", triggers: "" },
  { id: "faelar", name: "Faelar", triggers: "" },
  { id: "lys", name: "Lysandra", triggers: "Lys" },
];
const line = (text: string): NovelFrame => ({ text, kind: "narration" });
const track = (texts: string[]) => createNovelStageTracker(cast)(texts.map(line));

describe("visual novel stage progression", () => {
  it("fills four alternating left/right slots and keeps characters through unmentioned lines", () => {
    expect(track(["Nyx arrives.", "Coral arrives.", "Serastra arrives.", "Sage arrives.", "The room is quiet."]))
      .toEqual([
        ["nyx", null, null, null], ["nyx", "coral", null, null],
        ["nyx", "coral", "sera", null], ["nyx", "coral", "sera", "sage"], ["nyx", "coral", "sera", "sage"],
      ]);
  });
  it("replaces the least recently mentioned resident only when a newcomer needs space", () => {
    expect(track(["Nyx Coral Serastra Sage", "Nyx waves.", "Faelar arrives."]).at(-1))
      .toEqual(["nyx", "faelar", "sera", "sage"]);
  });
  it("protects characters mentioned later in the current line and keeps their positions", () => {
    expect(track(["Nyx Coral Serastra Sage", "Faelar greets Nyx."]).at(-1))
      .toEqual(["nyx", "faelar", "sera", "sage"]);
    expect(track(["Nyx Coral Serastra Sage", "Faelar and Lys greet Nyx and Sage."]).at(-1))
      .toEqual(["nyx", "faelar", "lys", "sage"]);
  });
  it("never exceeds four or churns residents when a line mentions more than four", () => {
    expect(track(["Nyx Coral Serastra Sage Faelar Lys"])[0]).toEqual(["nyx", "coral", "sera", "sage"]);
    expect(track(["Nyx Coral Serastra Sage", "Faelar Nyx Coral Serastra Sage"])[1])
      .toEqual(["nyx", "coral", "sera", "sage"]);
  });
  it("preserves earlier snapshots for Back and reconstructs after edits or a different adventure", () => {
    const tracker = createNovelStageTracker(cast);
    const snapshots = tracker(["Nyx Coral Serastra Sage", "Faelar arrives."].map(line));
    expect(snapshots[0]).toEqual(["nyx", "coral", "sera", "sage"]);
    expect(snapshots[1]).toEqual(["faelar", "coral", "sera", "sage"]);
    expect(tracker([line("Coral arrives.")])).toEqual([["coral", null, null, null]]);
    expect(tracker([])).toEqual([]);
  });
  it("keeps mentioned characters through quoted dialogue without inferring future speakers", () => {
    expect(createNovelStageTracker(cast)(parseNovel('Nyx says, "Hello."')))
      .toEqual([["nyx", null, null, null], ["nyx", null, null, null]]);
    expect(createNovelStageTracker(cast)(parseNovel('"Hello," Nyx says.')))
      .toEqual([[null, null, null, null], ["nyx", null, null, null]]);
  });
  it("matches full aliases and ignores ambiguous shared triggers", () => {
    expect(track(["The kitchen is empty.", "Nyxie's chair is empty.", "NYX waves."]))
      .toEqual([[null, null, null, null], [null, null, null, null], ["nyx", null, null, null]]);
    const tracker = createNovelStageTracker([{ id: "mary", name: "Mary Ann", triggers: "" }, { id: "ann", name: "Ann", triggers: "" }]);
    expect(tracker([line("Mary Ann appears.")])).toEqual([["mary", null, null, null]]);
  });
});
