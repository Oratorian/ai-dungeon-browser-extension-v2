import { describe, expect, it } from "vitest";
import { parseNovel } from "@/rendering/novel";
import { novelSpeakers } from "@/rendering/novel_speaker";

const characters = [
  { id: "sage", name: "Sage Harrow", triggers: "Sage" },
  { id: "elarion", name: "Elarion", triggers: "you" },
];
const speakers = (text: string) => novelSpeakers(parseNovel(text), characters);

describe("explicit VN speakers", () => {
  it("keeps focus through a multi-sentence quote and clears it for narration", () => {
    expect(speakers('Sage: "Careful, Elarion. You will regret that." She smiles.'))
      .toEqual(["sage", "sage", null]);
  });
  it("switches speakers within a paragraph and supports quote styles and aliases", () => {
    expect(speakers('SAGE: “Hello.” Elarion: «Welcome!»')).toEqual(["sage", "elarion"]);
  });
  it("does not infer speakers from mentions, unknown labels or unlabeled dialogue", () => {
    expect(speakers('Sage smiles.\nGuest: "Hello."\n"Sage: hello."')).toEqual([null, null, null]);
  });
  it("ignores ambiguous aliases", () => {
    expect(novelSpeakers(parseNovel('Sage: "Hello."'), [...characters,
      { id: "other", name: "Other", triggers: "Sage" }])).toEqual([null]);
  });
  it("handles unfinished streaming quotes without carrying focus into another paragraph", () => {
    expect(speakers('Sage: "Wait\nThe door opens.')).toEqual(["sage", null]);
  });
});
