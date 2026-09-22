import { describe, expect, it } from "vitest";
import { createNovelParser, parseNovel, type NovelCharacter } from "@/rendering/novel";

const characters: NovelCharacter[] = [
  { id: "sage", name: "Sage Harrow", triggers: "Sage" },
  { id: "nyx", name: "Nyxadra", triggers: "Nyx, dragon" },
];
const speakers = (text: string, cards = characters) => parseNovel(text, cards).filter(f => f.kind === "dialogue").map(f => f.speakerId);

describe("visual novel dialogue attribution", () => {
  it("recognizes explicit speakers without any AID highlighting", () => {
    expect(speakers('Sage says, "Welcome." Nyx replies: “Hello!”')).toEqual(["sage", "nyx"]);
    expect(speakers('"Hello," whispered Nyxadra.')).toEqual(["nyx"]);
    expect(speakers('Sage Harrow: «Come in.»')).toEqual(["sage"]);
  });
  it("does not mistake names inside speech or mentioned listeners for speakers", () => {
    expect(speakers('"Sage says hello."')).toEqual([null]);
    expect(speakers('Sage watches Nyx. "Hello."')).toEqual([null]);
    expect(speakers('Nyx tells Sage, "Hello."')).toEqual(["nyx"]);
    expect(speakers('"Hello," Sage says to Nyx.')).toEqual(["sage"]);
  });
  it("keeps unattributed and contradictory speech unknown", () => {
    expect(speakers('Sage says, "Hello," Nyx replies.')).toEqual([null]);
    expect(speakers('Sage enters.\n"Hello."\nShe says, "Goodbye."')).toEqual([null, null]);
  });
  it("rejects shared triggers and matches whole names", () => {
    const cards = [...characters, { id: "other", name: "Dragon Two", triggers: "dragon" }];
    expect(speakers('Dragon says, "Hi."', cards)).toEqual([null]);
    expect(speakers('OldSage says, "Hi."')).toEqual([null]);
    expect(speakers('SAGE whispers softly, "Hi."')).toEqual(["sage"]);
  });
  it("preserves narration, quotations and incomplete streaming text", () => {
    const text = 'Sage says, "Hello."\nThe door opens.\n"An unfinished';
    expect(parseNovel(text, characters).map(f => f.text)).toEqual(['Sage says,', '"Hello."', 'The door opens.', '"An unfinished']);
    expect(parseNovel("", characters)).toEqual([]);
  });
  it("labels same-paragraph pronoun inference and ignores names in speech", () => {
    const frames = parseNovel('Nyxadra grips the sink. "Sage is not trouble," she mutters.', characters);
    expect(frames.find(f => f.kind === "dialogue")).toMatchObject({ speakerId: "nyx", inferred: true });
    expect(speakers('Nyxadra looks at Sage. "Hello," she mutters.')).toEqual([null]);
    expect(speakers('Nyxadra grips the sink.\n"Hello," she mutters.')).toEqual(["nyx"]);
  });
});

const cast: NovelCharacter[] = [
  ...characters,
  { id: "coral", name: "Coral", triggers: "Corrilygos, food, drinks" },
  { id: "sera", name: "Serastra", triggers: "Sera, chef, kitchen" },
  { id: "player", name: "You", triggers: "you" },
];
const dialogue = (text: string) => parseNovel(text, cast).filter(f => f.kind === "dialogue");

describe("speaker patterns from the browser adventure", () => {
  it("resolves She whispers after Nyxadra rinses, despite earlier ambiguous narration", () => {
    const passage = 'The kitchen hums around you as you continue wiping down the marble counter, the soft murmur of running water and the occasional clink of a dish meeting the warm glow of the dimming hearth. Coral remains nestled in your pocket, her tiny body a comforting weight against your chest, her wings occasionally twitching in irritated little spasms.\n\nNyxadra rinses the last of the vanilla pods, her orange eyes darting to you before returning to her task. She whispers, "A crescendo of cream," testing the words as if trying to imagine a world where such a thing could exist without chaos. She finishes drying the vanilla pods with deliberate care, then hesitates, her tiny claws hovering over the stack of clean dishes.';
    expect(dialogue(passage)).toEqual([{ text: '"A crescendo of cream,"', kind: "dialogue", speakerId: "nyx", inferred: true }]);
    expect(dialogue(passage.replace("rinses", "rinsed"))[0]?.speakerId).toBe("nyx");
  });
  it("uses an action beat and a possessive body-part subject before speech", () => {
    expect(dialogue('Coral lets out a dramatic gasp, her wings fluttering. "Sarcasm! I am being mocked!" She flops backward.')[0])
      .toMatchObject({ speakerId: "coral", inferred: true });
    expect(dialogue('From your pocket, a chirp erupts. Coral\'s head pops up. "I heard that, Nyxadra!"')[0]?.speakerId).toBe("coral");
  });
  it("continues the same speaker across quotes within a paragraph", () => {
    expect(dialogue('Nyxadra sighs. "She is loud," she whispers. "Everything is a symphony."').map(f => f.speakerId)).toEqual(["nyx", "nyx"]);
    expect(dialogue('"A crescendo," you repeat softly. "A bold claim."').map(f => f.speakerId)).toEqual(["player", "player"]);
  });
  it("carries a clear narrative subject into the following pronoun-attributed paragraph", () => {
    expect(dialogue('Serastra dismantles the apparatus. She wipes it clean. Her golden eyes flick up as you approach.\n\n"Cleanup," she says. "Wipe the counters first."').map(f => f.speakerId)).toEqual(["sera", "sera"]);
    expect(dialogue('Serastra gives a stiff nod and pivots away.\n\n"Fine," she rasps. "But I am blaming you."').map(f => f.speakerId)).toEqual(["sera", "sera"]);
  });
  it("does not let a listener or possessive name replace the acting subject", () => {
    expect(dialogue('Serastra descends from her perch. She hovers inches from Coral\'s nose. "An artist," she repeats.')[0]?.speakerId).toBe("sera");
    expect(dialogue('"A visionary," Serastra adds, as the heat makes Coral shrink back. "An artist of chaos."').map(f => f.speakerId)).toEqual(["sera", "sera"]);
  });
  it("resolves a third-person pronoun to the NPC rather than the player", () => {
    expect(dialogue('You slide Coral into your pocket, where she curls up. She peeks over the edge.\n\n"Mmm," she purrs. "This is nice."').map(f => f.speakerId)).toEqual(["coral", "coral"]);
    expect(dialogue('Nyxadra jumps at your words. Her eyes dart toward you. "Coral is not trouble," she mutters.')[0]?.speakerId).toBe("nyx");
  });
  it("prioritizes names over environmental highlighting triggers", () => {
    expect(dialogue('Serastra stands in the kitchen beside the dragon statue. "Welcome," she says.')[0]?.speakerId).toBe("sera");
    expect(dialogue('The kitchen is quiet. "Hello," she says.')[0]?.speakerId).toBeNull();
    expect(dialogue('The crimson dragon says, "Hello."')[0]?.speakerId).toBeNull();
  });
  it("switches speaker when another character takes an action", () => {
    expect(dialogue('Nyxadra sighs. "Too loud," she whispers. Coral gasps. "I heard that!"').map(f => f.speakerId)).toEqual(["nyx", "coral"]);
    expect(dialogue('Nyxadra sighs. "Too loud," she whispers.\nCoral gasps. "I heard that!"').map(f => f.speakerId)).toEqual(["nyx", "coral"]);
  });
  it("leaves a changed or ambiguous subject unresolved", () => {
    expect(dialogue('Coral stiffens, her eyes darting toward Serastra. The crimson dragon is hovering nearby.\n"Stubborn?" she echoes.')[0]?.speakerId).toBeNull();
    expect(dialogue('Nyxadra and Coral stand together. "Hello," she whispers.')[0]?.speakerId).toBeNull();
    expect(dialogue('Nyxadra leaves.\nThe room falls silent.\n"Hello," she whispers.')[0]?.speakerId).toBeNull();
  });
  it("does not assume the next paragraph or next response has the same speaker", () => {
    expect(dialogue('"Hello," Nyxadra says.\n"Goodbye."').map(f => f.speakerId)).toEqual(["nyx", null]);
    dialogue('Nyxadra stands by the sink.');
    expect(dialogue('"Hello," she whispers.')[0]?.speakerId).toBeNull();
  });
  it("uses extension trigger aliases as subjects and explicit speakers", () => {
    expect(dialogue(' Corrilygos gasps. "I heard that!"')[0]?.speakerId).toBe("coral");
    expect(dialogue('The chef whispers to Nyx, "Stay here."')[0]?.speakerId).toBe("sera");
    expect(dialogue('Sage quietly says to Nyx, "Stay here."')[0]?.speakerId).toBe("sage");
  });
  it("prefers a whole name over a shorter trigger embedded inside it", () => {
    const cards = [{ id: "mary", name: "Mary Ann", triggers: "" }, { id: "ann", name: "Ann", triggers: "" }];
    expect(parseNovel('Mary Ann gasps. "Hello."', cards).find(f => f.kind === "dialogue")?.speakerId).toBe("mary");
    expect(parseNovel('Mary Ann says, "Hello."', cards).find(f => f.kind === "dialogue")?.speakerId).toBe("mary");
  });
  it("reuses matchers without retaining a speaker from an earlier response", () => {
    const parse = createNovelParser(cast);
    parse('Coral gasps. "Hello!"');
    expect(parse('"Hello," she says.')[0]?.speakerId).toBeNull();
    expect(parse('Nyxadra sighs. "Quiet," she whispers.').find(f => f.kind === "dialogue")?.speakerId).toBe("nyx");
  });
});
