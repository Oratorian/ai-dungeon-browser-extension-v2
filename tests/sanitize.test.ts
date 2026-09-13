// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeResponseHtml } from "@/rendering/sanitize";
import { parseResponse } from "@/rendering/parser";

// The response parser runs markdown regexes over serialized HTML, so anything the sanitizer lets
// through as an attribute can be split by a `*...*` match and leak into the story as text. These
// pin the two markups AI Dungeon has actually served that did exactly that.

describe("sanitizeResponseHtml", () => {
  it("strips the aria-label AI Dungeon puts on a player action, which repeats the action text", () => {
    // Served on 2026-09-13, after a live AID patch: the action text once in aria-label (with its own
    // quotes escaped) and once as the content. The stray `"` inside the label is what showed up on
    // screen as `mother."" aria-level="3">You say, "`.
    const action = '*I step back* But you are right, I am late, sorry mother."';
    const html =
      `<span role="heading" aria-label="${action.replace(/"/g, "&quot;")}" aria-level="3">` +
      `You say, "${action}"</span>`;

    const clean = sanitizeResponseHtml(html);
    expect(clean).not.toContain("aria-");
    expect(clean).toBe(`<span>You say, "${action}"</span>`);
  });

  it("strips class soup and spacer images, keeping inline formatting", () => {
    const html =
      '<img class="_View _pos-relative _fd-column" src="x.png">' +
      '<span class="_dsp-inline _fs-italic" data-x="1"><em>quiet</em> words</span><br>';
    expect(sanitizeResponseHtml(html)).toBe("<span><em>quiet</em> words</span><br>");
  });

  it("leaves the parser nothing to split but the visible text", () => {
    const html = '<span aria-label="*a* b" aria-level="3">You say, "*a* b"</span>';
    const chunks = parseResponse(sanitizeResponseHtml(html), new Map());
    const joined = chunks.map((c) => c.content).join("");
    expect(joined).toBe('<span>You say, "a b"</span>');
    expect(chunks.some((c) => c.type === "italic" && c.content === "a")).toBe(true);
    expect(joined).not.toContain("aria");
  });
});
