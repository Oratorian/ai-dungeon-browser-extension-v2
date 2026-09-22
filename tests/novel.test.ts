import { describe, expect, it } from "vitest";
import { parseNovel } from "@/rendering/novel";

describe("visual novel reader lines", () => {
  it("preserves narration, quotations and incomplete streaming text", () => {
    expect(parseNovel('Sage says, "Hello."\nThe door opens.\n"An unfinished').map(({text, kind}) => ({text, kind}))).toEqual([
      { text: "Sage says,", kind: "narration" },
      { text: '"Hello."', kind: "dialogue" },
      { text: "The door opens.", kind: "narration" },
      { text: '"An unfinished', kind: "narration" },
    ]);
  });
  it("supports curly quotes and guillemets without assigning speakers", () => {
    expect(parseNovel('Nyx: “Hello.” Coral: «Welcome!»').map(f => f.text))
      .toEqual(["Nyx:", "“Hello.”", "Coral:", "«Welcome!»"]);
  });
  it("preserves attribution after a quote as ordinary text", () => {
    expect(parseNovel('"Hello," Nyx says. "Goodbye."').map(f => f.text))
      .toEqual(['"Hello,"', "Nyx says.", '"Goodbye."']);
  });
  it("ignores blank paragraphs and never carries context between calls", () => {
    expect(parseNovel(" \n\n ")).toEqual([]);
    parseNovel('Nyx says, "Hello."');
    expect(parseNovel('"Goodbye."')).toEqual([{ text: '"Goodbye."', kind: "dialogue", paragraph: '"Goodbye."' }]);
  });
});
