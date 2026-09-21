// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readNovelPassages, rememberNovelSource } from "@/rendering/novel_dom";

describe("visual novel story source", () => {
  it("reads the hidden original without duplicated highlights and preserves paragraphs", () => {
    const output = document.createElement("div");
    output.innerHTML = '<span id="transition-opacity"><span><p>Sage says,</p><p>“Welcome.”<br>Come in.</p></span></span>';
    const container = output.firstElementChild as HTMLElement;
    const original = container.firstElementChild as HTMLElement;
    rememberNovelSource(container, original);
    original.style.display = "none";
    const tooltip = document.createElement("span");
    tooltip.textContent = "Duplicated highlights and tooltip";
    container.prepend(tooltip);
    expect(readNovelPassages(output)[0]?.text).toBe('Sage says,\n“Welcome.”\nCome in.');
    original.append(document.createTextNode("Streaming text"));
    expect(readNovelPassages(output)[0]?.text).toContain("Streaming text");
    container.remove();
    expect(readNovelPassages(output)).toEqual([]);
  });
  it("reads animated or not-yet-rendered text past player-action spacers", () => {
    const output = document.createElement("div");
    output.innerHTML = '<span id="transition-opacity"><span></span><span>w_run</span><span>You say, "Hi."</span></span>';
    expect(readNovelPassages(output)[0]?.text).toBe('You say, "Hi."');
  });
});
