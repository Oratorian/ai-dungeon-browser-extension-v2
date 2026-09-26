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
  it("keeps Elarion, Serastra and Sage through attributed speech and participant narration", () => {
    const characters = [
      { id: "elarion", name: "Elarion", triggers: "you" },
      { id: "sera", name: "Serastra", triggers: "" },
      { id: "sage", name: "Sage", triggers: "" },
      { id: "absent", name: "Vespera", triggers: "" },
    ];
    const text = `You adjust your cuff with a single, deliberate motion. Serastra emerges to deliver an order, but your attention remains fixed on Sage's warning.
"I am merely a connoisseur of observation, Sage," you reply.
Your voice is quiet, velvet smooth despite the late hour.
Sage: "That's what I'm afraid of. Vespera would agree."
Sage exhales sharply. She doesn't look at you directly now; instead, she pivots toward a table.`;
    const stages = createNovelStageTracker(characters)(parseNovel(text));
    expect(stages.length).toBeGreaterThan(4);
    expect(stages.every(stage => JSON.stringify(stage) === JSON.stringify(["elarion", "sera", "sage", null]))).toBe(true);
  });
  it("ends conversation carry for unrelated narration, a different cast, or a new passage", () => {
    expect(track('Nyx and Sage wait.\n"Welcome," Sage says.\nCoral enters.').at(-1)).toEqual(["coral", null, null, null]);
    expect(track('Nyx and Sage wait.\n"Welcome," Sage says.\nThe room is empty.').at(-1)).toEqual([null, null, null, null]);
    expect(createNovelStageTracker(cast)([
      ...parseNovel('Nyx and Sage wait.\n"Welcome," Sage says.'), ...parseNovel('Her voice is quiet.'),
    ]).at(-1)).toEqual([null, null, null, null]);
  });
  it("shows a character through its you alias", () => {
    const tracker = createNovelStageTracker([{ id: "elarion", name: "Elarion", triggers: "Elarion, you" }]);
    expect(tracker(parseNovel('You: "Hello."'))).toEqual([["elarion", null, null, null]]);
    expect(tracker(parseNovel('You say, "Hello."'))).toEqual([["elarion", null, null, null]]);
  });
  it("retains listeners across labeled turns without adding people mentioned in dialogue", () => {
    expect(track('Nyx and Sage wait.\nSage: "Coral is annoying."\nNyx: "I agree."\nThe room is empty.'))
      .toEqual([["nyx", "sage", null, null], ["nyx", "sage", null, null],
        ["nyx", "sage", null, null], [null, null, null, null]]);
  });
  it("adds a new labeled speaker while keeping existing listeners", () => {
    expect(track('Sage waits.\nNyx: "Hello."'))
      .toEqual([["sage", null, null, null], ["sage", "nyx", null, null]]);
  });
  it("keeps Sage through the pronoun-led continuation from the browser passage", () => {
    const text = `Sage's lips press into a thin line, her attention focused on the parchment. Her scarred eye narrows slightly, the only betrayal of the wariness creeping into her usually composed demeanor. After a long moment, she lowers the note with a slow, deliberate motion, her fingers brushing against the edge of the paper as if assessing its weight.

"Curated entertainment," she echoes, her voice edged with something that isn't quite skepticism, but isn't quite acceptance either. Her gaze flicks back to you, sharp and measuring. "So. A diplomat who recognizes intellectual performance instead of just pouring brandy. That's... unusual." She hesitates, her head tilting slightly.`;
    const stages = track(text);
    expect(stages).toHaveLength(9);
    expect(stages.every(stage => stage[0] === "sage" && stage.slice(1).every(id => id === null))).toBe(true);
  });
  it("bridges only one paragraph with a clear pronoun cue and preserves the character's side", () => {
    expect(track('Nyx and Sage wait.\nSage reads.\nHer eyes narrow.\nShe waits.'))
      .toEqual([["nyx", "sage", null, null], [null, "sage", null, null], [null, "sage", null, null], [null, null, null, null]]);
  });
  it("does not carry ambiguous casts, unrelated narration, quoted pronouns or a different response", () => {
    for (const text of ['Nyx and Sage wait.\n"Hello," she says.', 'Sage waits.\nThe stranger enters. She smiles.', 'Sage waits.\n"She is late."', 'Sage waits.\n"Hello."']) {
      expect(track(text).at(-1)).toEqual([null, null, null, null]);
    }
    expect(createNovelStageTracker(cast)([...parseNovel('Sage waits.'), ...parseNovel('"Hello," she says.')]).at(-1))
      .toEqual([null, null, null, null]);
    expect(track('Sage waits.\nCoral waves. She smiles.').at(-1)).toEqual(["coral", null, null, null]);
  });
  it("resolves identical continuation text separately for each preceding character", () => {
    expect(track('Sage waits.\nShe smiles.\nCoral waits.\nShe smiles.'))
      .toEqual([["sage",null,null,null], ["sage",null,null,null], ["coral",null,null,null], ["coral",null,null,null]]);
  });
  it("keeps the paragraph's cast through narration and quotes, including names after speech", () => {
    const text = 'Nyx rinses the pods. She whispers, "A crescendo of cream." Coral nods.';
    expect(track(text)).toEqual(Array.from({length: 3}, () => ["nyx", "coral", null, null]));
    expect(track('"Hello," Nyx says.')).toEqual([["nyx", null, null, null]]);
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
  it("ignores dialogue mentions throughout streaming but includes subsequent narration", () => {
    expect(track('Nyx says, "Hello')).toEqual([["nyx", null, null, null]]);
    expect(track('Nyx says, "Hello Coral')).toEqual([["nyx", null, null, null]]);
    expect(track('Nyx says, "Hello Coral."')).toEqual([["nyx", null, null, null]]);
    expect(track('Nyx says, "Hello Coral." Coral waves.'))
      .toEqual([["nyx", "coral", null, null], ["nyx", "coral", null, null]]);
  });
  it.each(['"Coral is annoying."', '“Coral is annoying.”', '«Coral is annoying.»'])("adds the labeled speaker, not the subject of dialogue: %s", quote => {
    expect(track(`Sage: ${quote}`)).toEqual([["sage", null, null, null]]);
  });
  it("keeps multiple labeled speakers and narration-based presence", () => {
    expect(track('Sage: "Coral is annoying." Nyx: "I agree."'))
      .toEqual([["sage", "nyx", null, null], ["sage", "nyx", null, null]]);
    expect(track('Coral waits. Sage: "Coral is annoying."'))
      .toEqual([["coral", "sage", null, null], ["coral", "sage", null, null]]);
  });
  it("matches full aliases and ignores ambiguous shared triggers", () => {
    expect(track("The kitchen is empty.\nNyxie's chair is empty.\nNYX waves."))
      .toEqual([[null, null, null, null], [null, null, null, null], ["nyx", null, null, null]]);
    const tracker = createNovelStageTracker([{id:"mary", name:"Mary Ann", triggers:""}, {id:"ann", name:"Ann", triggers:""}]);
    expect(tracker(parseNovel("Mary Ann appears."))).toEqual([["mary",null,null,null]]);
  });
});
