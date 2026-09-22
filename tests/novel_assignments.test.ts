import { describe, expect, it } from "vitest";
import { parseNovel } from "@/rendering/novel";
import { resolveNovelAssignments } from "@/rendering/novel_assignments";
import { createNovelStageTracker } from "@/rendering/novel_stage";

const cast = [
  { id: "bartender", name: "The bartender", triggers: "" },
  ...["Sage", "Nyx", "Coral", "Serastra"].map(name => ({ id: name, name, triggers: "" })),
];
const track = createNovelStageTracker(cast);
const source = {};
const read = (text: string, node = source) => parseNovel(text).map((frame, offset) => ({ ...frame, source: node, offset }));

describe("local paragraph character assignments", () => {
  it("shows an assigned character through every line of only that paragraph", () => {
    const frames = read('She smiles. "Welcome."\n\nShe waits.');
    const choices = [{ source, offset: 0, paragraph: frames[0]!.paragraph, characterId: "bartender" }];
    expect(track(frames, resolveNovelAssignments(frames, choices)))
      .toEqual([["bartender", null, null, null], ["bartender", null, null, null], [null, null, null, null]]);
  });
  it("does not apply the same text's assignment to another paragraph or another response", () => {
    const frames = read('She smiles.\nShe smiles.');
    const choices = [{ source, offset: 0, paragraph: "She smiles.", characterId: "bartender" }];
    expect(resolveNovelAssignments(frames, choices)).toEqual({ 0: "bartender" });
    expect(resolveNovelAssignments(read("She smiles.", {}), choices)).toEqual({});
    expect(resolveNovelAssignments(read("She leaves."), choices)).toEqual({});
  });
  it("prioritizes the assignment while retaining automatic characters within four slots", () => {
    const frames = read("Sage Nyx Coral Serastra.");
    expect(track(frames, { 0: "bartender" })[0]).toEqual(["bartender", "Sage", "Nyx", "Coral"]);
    expect(track(frames, { 0: "Sage" })[0]).toEqual(["Sage", "Nyx", "Coral", "Serastra"]);
  });
  it("restores automatic matching when cleared and ignores deleted characters", () => {
    const frames = read("She smiles.");
    expect(track(frames, { 0: "bartender" })[0]).toContain("bartender");
    expect(track(frames, {})[0]).toEqual([null, null, null, null]);
    expect(track(frames, { 0: "deleted" })[0]).toEqual([null, null, null, null]);
  });
});
