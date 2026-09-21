import { describe, expect, it } from "vitest";
import { parseNovel, type NovelCharacter } from "@/rendering/novel";

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
    expect(speakers('Nyx tells Sage, "Hello."')).toEqual([null]);
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
});
