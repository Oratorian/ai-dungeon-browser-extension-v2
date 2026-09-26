import { describe, expect, it } from "vitest";
import { parseNovel } from "@/rendering/novel";

describe("visual novel reader lines", () => {
  it.each(["Dr.", "Mr.", "Mrs.", "Ms.", "Mx.", "Prof.", "Rev.", "Capt.", "Lt.", "Gen."])("keeps %s with the character name", title => {
    const sentence = `${title} Smith opens the door.`;
    expect(parseNovel(`${sentence} Everyone follows.`).map(frame => frame.text)).toEqual([sentence, "Everyone follows."]);
  });
  it("preserves titles inside dialogue, speaker labels and speech attribution", () => {
    for (const sentence of ['Dr. Smith: "Welcome."', '"Hello, Mrs. Smith!"', '"Ready?" Dr. Smith asks.', 'Prof. Dr. Müller nods.']) {
      expect(parseNovel(`${sentence} The door opens.`).map(frame => frame.text)).toEqual([sentence, "The door opens."]);
    }
  });
  it("preserves Unicode, spacing, paragraph boundaries and unfinished titles", () => {
    expect(parseNovel("🌙 Mr. O’Neill meets Dr.  Élodie.\nMrs.").map(frame => frame.text))
      .toEqual(["🌙 Mr. O’Neill meets Dr.  Élodie.", "Mrs."]);
    expect(parseNovel("The name is Endr. Smith leaves.").map(frame => frame.text)).toEqual(["The name is Endr.", "Smith leaves."]);
  });
  it("preserves narration, quotations and incomplete streaming text", () => {
    expect(parseNovel('Sage says, "Hello."\nThe door opens.\n"An unfinished').map(({text, kind}) => ({text, kind}))).toEqual([
      { text: 'Sage says, "Hello."', kind: "dialogue" },
      { text: "The door opens.", kind: "narration" },
      { text: '"An unfinished', kind: "narration" },
    ]);
  });
  it("supports curly quotes and guillemets without assigning speakers", () => {
    expect(parseNovel('Nyx: “Hello.” Coral: «Welcome!»').map(f => f.text))
      .toEqual(["Nyx: “Hello.”", "Coral: «Welcome!»"]);
  });
  it("keeps attribution with the quote", () => {
    expect(parseNovel('"Hello," Nyx says. "Goodbye."').map(f => f.text))
      .toEqual(['"Hello," Nyx says.', '"Goodbye."']);
  });
  it("ignores blank paragraphs and never carries context between calls", () => {
    expect(parseNovel(" \n\n ")).toEqual([]);
    parseNovel('Nyx says, "Hello."');
    expect(parseNovel('"Goodbye."')).toEqual([{ text: '"Goodbye."', kind: "dialogue", paragraph: '"Goodbye."', startsParagraph: true, startsPassage: true }]);
  });
});
