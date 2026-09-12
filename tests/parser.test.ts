import { describe, it, expect, beforeEach } from "vitest";
import { parseResponse, buildCardMap } from "@/rendering/parser";
import { settings } from "@/storage";
import type { StoryCard } from "@/shared/types";

// The parser is the core of the whole extension: it decides what gets highlighted. It is also the
// piece most likely to regress quietly, since a regex change can stop matching without any error.

const card = (name: string, triggers = ""): StoryCard => ({
  id: name,
  name,
  triggers,
  type: "character",
  icons: [],
  iconIndex: 0,
  graphics: [],
  graphicIndex: 0,
  useCustomColor: false,
  color: "#f8ae2c",
  limit: "none",
  preset: "default",
  audioClips: [],
});

const mapOf = (...cards: StoryCard[]) => buildCardMap(Object.fromEntries(cards.map((c) => [c.id, c])));

const types = (text: string, map: Map<string, StoryCard>) => parseResponse(text, map).map((c) => c.type);
const contents = (text: string, map: Map<string, StoryCard>) => parseResponse(text, map).map((c) => c.content);

describe("buildCardMap", () => {
  it("keys every card by its lowercased name", () => {
    const map = mapOf(card("Elara"));
    expect(map.get("elara")?.name).toBe("Elara");
    expect(map.has("Elara")).toBe(false);
  });

  it("adds each comma-separated trigger, trimmed and lowercased, ignoring empties", () => {
    const map = mapOf(card("Elara", " the ranger , Ranger,, "));
    expect(map.get("the ranger")?.name).toBe("Elara");
    expect(map.get("ranger")?.name).toBe("Elara");
    expect(map.size).toBe(3);
  });
});

describe("parseResponse", () => {
  beforeEach(() => {
    settings.update((s) => ({ ...s, highlightMarkdown: true }));
  });

  it("returns nothing for empty text", () => {
    expect(parseResponse("", mapOf(card("Elara")))).toEqual([]);
  });

  it("splits a card name out of prose, keeping the surrounding text", () => {
    const chunks = parseResponse("Then Elara drew her bow.", mapOf(card("Elara")));
    expect(chunks.map((c) => c.type)).toEqual(["text", "card", "text"]);
    expect(chunks.map((c) => c.content)).toEqual(["Then ", "Elara", " drew her bow."]);
  });

  it("matches case-insensitively but preserves the text as written", () => {
    expect(contents("ELARA waved", mapOf(card("Elara")))).toEqual(["ELARA", " waved"]);
  });

  it("matches on a trigger word as well as the name", () => {
    expect(types("the ranger nodded", mapOf(card("Elara", "ranger")))).toEqual(["text", "card", "text"]);
  });

  it("does not match a name buried inside a longer word", () => {
    expect(types("Elarabeth smiled", mapOf(card("Elara")))).toEqual(["text"]);
  });

  it("keeps a possessive with the name so the highlight covers it", () => {
    expect(contents("Elara's bow", mapOf(card("Elara")))).toEqual(["Elara's", " bow"]);
  });

  it("prefers the longest matching key when one contains another", () => {
    const map = mapOf(card("Sword"), card("Sword of Dawn"));
    const chunks = parseResponse("the Sword of Dawn gleamed", map);
    const cardChunk = chunks.find((c) => c.type === "card");
    expect(cardChunk?.content).toBe("Sword of Dawn");
  });

  it("renders **bold** as a bold chunk when markdown is on", () => {
    const chunks = parseResponse("a **loud** noise", mapOf());
    expect(chunks.map((c) => [c.type, c.content])).toEqual([
      ["text", "a "],
      ["bold", "loud"],
      ["text", " noise"],
    ]);
  });

  it("leaves markdown markers as plain text when markdown is off", () => {
    settings.update((s) => ({ ...s, highlightMarkdown: false }));
    const chunks = parseResponse("a **loud** noise", mapOf());
    expect(chunks.every((c) => c.type === "text")).toBe(true);
    expect(chunks.map((c) => c.content).join("")).toBe("a **loud** noise");
  });

  it("recognises italic, underline and strikethrough", () => {
    const map = mapOf();
    expect(types("*a* ~b~ ~~c~~", map).filter((t) => t !== "text")).toEqual(["italic", "underline", "strikethrough"]);
  });
});
