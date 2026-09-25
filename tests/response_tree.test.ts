// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { parseResponseHtml, type ResponseNode } from "@/rendering/response_tree";
import { buildCardMap } from "@/rendering/parser";
import { settings } from "@/storage";
import type { StoryCard } from "@/shared/types";

const cards = (...names: string[]) => buildCardMap(Object.fromEntries(names.map(name => [name, {
  id: name, name, triggers: "", type: "character", icons: [], iconIndex: 0, graphics: [], graphicIndex: 0,
  useCustomColor: false, color: "#f8ae2c", limit: "none", preset: "default", audioClips: [],
} satisfies StoryCard])));
function chunks(nodes: ResponseNode[]): Extract<ResponseNode, { type: "chunk" }>[] {
  return nodes.flatMap(node => node.type === "element" ? chunks(node.children) : [node]);
}
const text = (nodes: ResponseNode[]) => chunks(nodes).map(node => node.chunk.content).join("");
const matches = (nodes: ResponseNode[]) => chunks(nodes).filter(node => node.chunk.type === "card").map(node => node.chunk.content);

beforeEach(() => settings.update(value => ({ ...value, highlightMarkdown: true })));

describe("response text-node matching", () => {
  it.each([
    ["Say", 'You say, "All good, accidents happen."'],
    ["Do", "You sigh."],
    ["Story", "You watch the sun rise."],
    ["Guide", "You meet the visitor in the next scene."],
  ])("does not render a hidden replay label as a duplicate %s action", (_mode, prose) => {
    const result = parseResponseHtml(`<span id="replay" hidden data-gameplay-replay-label="true">Action ${prose} </span><span aria-labelledby="replay" role="heading" aria-level="3"><span id="action-text">${prose} </span></span>`, cards("You"));
    expect(text(result)).toBe(prose + " ");
    expect(matches(result)).toEqual(["You"]);
  });
  it("never treats aria-label or aria-level as the character Aria", () => {
    const prose = 'You were mesmerized. "I-..." you could not finish the sentence.';
    const html = `<span role="heading" aria-label="Action ${prose.replaceAll('"', '&quot;')}" aria-level="3">${prose}</span>`;
    const result = parseResponseHtml(html, cards("Aria", "Action"));
    expect(text(result)).toBe(prose);
    expect(matches(result)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("aria-");
  });
  it("highlights actual Aria mentions exactly once while ignoring repeated attribute text", () => {
    const result = parseResponseHtml('<span aria-label="Aria says hello" data-aria="Aria">Aria says hello to ARIA.</span>', cards("Aria"));
    expect(text(result)).toBe("Aria says hello to ARIA.");
    expect(matches(result)).toEqual(["Aria", "ARIA"]);
  });
  it("keeps formatting elements intact even when a card is named Span or Mark", () => {
    const result = parseResponseHtml('<span><strong>Aria</strong><br><mark>Span meets Mark.</mark></span>', cards("Aria", "Span", "Mark"));
    expect(matches(result)).toEqual(["Aria", "Span", "Mark"]);
    expect(result[0]).toMatchObject({ type: "element", tag: "span", children: [
      { type: "element", tag: "strong" }, { type: "element", tag: "br" }, { type: "element", tag: "mark" },
    ] });
  });
  it("decodes entities before matching and keeps escaped markup as literal text", () => {
    const result = parseResponseHtml('Ar&#105;a &amp; friends see &lt;img src=x onerror=alert(1)&gt;.', cards("Aria", "amp"));
    expect(matches(result)).toEqual(["Aria"]);
    expect(text(result)).toBe('Aria & friends see <img src=x onerror=alert(1)>.');
    expect(result.every(node => node.type === "chunk")).toBe(true);
  });
  it("keeps literal attribute-like prose and markdown without stripping character names", () => {
    const result = parseResponseHtml('Aria reads the words aria-label. She speaks **softly**.', cards("Aria"));
    expect(text(result)).toBe('Aria reads the words aria-label. She speaks softly.');
    expect(matches(result)).toEqual(["Aria", "aria"]);
    expect(chunks(result).some(node => node.chunk.type === "bold" && node.chunk.content === "softly")).toBe(true);
  });
});
