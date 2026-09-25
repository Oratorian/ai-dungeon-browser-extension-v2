// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readNovelPassages, rememberNovelSource } from "@/rendering/novel_dom";

describe("visual novel story source", () => {
  it.each([
    ["Say", "w_comment", 'You say, "All good, accidents happen."'],
    ["Do", "w_run", "You sigh."],
    ["Story", "w_book", "The sun rises."],
    ["Guide", "w_compass", "Introduce the visitor."],
  ])("reads %s actions once when AID provides a hidden replay label", (_mode, icon, prose) => {
    const output = document.createElement("div");
    output.innerHTML = `<div id="transition-opacity"><div></div><span id="action-icon" aria-hidden="true">${icon}</span><div><span id="replay" hidden data-gameplay-replay-label="true">Action ${prose} </span><span aria-labelledby="replay" role="heading"><span id="action-text">${prose} </span></span></div></div>`;
    const row = output.firstElementChild as HTMLElement;
    const source = row.lastElementChild as HTMLElement;
    expect(readNovelPassages(output).map(p => p.text)).toEqual([prose]);
    rememberNovelSource(row, source);
    source.style.display = "none";
    row.prepend(document.createTextNode("Extension-rendered copy"));
    expect(readNovelPassages(output).map(p => p.text)).toEqual([prose]);
  });
  it("excludes replay labels surrounding regular and latest story sections", () => {
    const output = document.createElement("div");
    output.innerHTML = '<div><span id="section" hidden data-gameplay-replay-label="true">Story section: Dawn arrives.</span><span aria-labelledby="section"><span id="transition-opacity"><span>Dawn arrives.</span></span></span></div><div><span id="latest" hidden data-gameplay-replay-label="true">Last action: A visitor appears.</span><span id="transition-opacity" aria-labelledby="latest"><span>A visitor appears.</span></span></div>';
    expect(readNovelPassages(output).map(p => p.text)).toEqual(["Dawn arrives.", "A visitor appears."]);
  });
  it.each([
    ["w_run", "You look at her."],
    ["w_comment", 'You say, "What if ... I am not?"'],
  ])("reads the live alpha action row once, excluding %s", (icon, text) => {
    const output = document.createElement("div");
    output.innerHTML = `<div id="transition-opacity"><div></div><span id="action-icon" aria-hidden="true">${icon}</span><div><span role="heading" aria-level="3"><span id="action-text"></span></span></div></div>`;
    const container = output.firstElementChild as HTMLElement;
    const source = container.lastElementChild as HTMLElement;
    source.querySelector("span")!.setAttribute("aria-label", `Action ${text} `);
    source.querySelector("#action-text")!.textContent = text + " ";
    expect(readNovelPassages(output).map(p => p.text)).toEqual([text]);
    rememberNovelSource(container, source);
    source.style.display = "none";
    source.before(source.cloneNode(true));
    expect(readNovelPassages(output).map(p => p.text)).toEqual([text]);
  });
  it("reads the supplied standalone Say block without an ID or accessibility label", () => {
    const output = document.createElement("div");
    output.innerHTML = `<div class="is_View _pos-relative _fd-column _fs-1 _w-10037" style="font-size: 18px; font-family: IBMPlexSansGameplay; line-height: 31.9667px; letter-spacing: normal;"><!----><!----><span style="color: inherit;"><!----><span><span><span>You say, "What if ... I am not?" </span></span></span></span></div>`;
    expect(readNovelPassages(output).map(p => p.text)).toEqual(['You say, "What if ... I am not?"']);
  });
  it("keeps styled player actions between known story passages without duplicating nested hosts", () => {
    const output = document.createElement("div");
    output.innerHTML = `<div style="font-size:18px;font-family:serif;line-height:32px">
      <span id="transition-opacity"><div style="font-size:18px;font-family:serif;line-height:32px">Before.</div></span>
      <div style="font-size:18px;font-family:serif;line-height:32px"><span>You open the gate.</span></div>
      <span id="transition-opacity"><span>After.</span></span></div>`;
    expect(readNovelPassages(output).map(p => p.text)).toEqual(["Before.", "You open the gate.", "After."]);
  });
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
  it("reads Do, Say and Story rows in order without requiring an animation wrapper", () => {
    const output = document.createElement("div");
    output.innerHTML = `<div id="transition-opacity"><span>The gate is closed.</span></div>
      <div aria-label="Action: You open the gate."><span>w_run</span><span>You </span><span>open the gate.</span><button>Edit</button></div>
      <div aria-label='Action You say, hello.'><span aria-hidden="true">speech icon</span>You say, <em>hello.</em></div>
      <div aria-label="Action: Dawn arrives."><span id="transition-opacity"><span>Dawn arrives.</span></span></div>`;
    expect(readNovelPassages(output).map(p => p.text)).toEqual([
      "The gate is closed.", "You open the gate.", "You say, hello.", "Dawn arrives.",
    ]);
  });
  it("ignores stale or empty remembered sources while action text arrives", () => {
    const output = document.createElement("div");
    output.innerHTML = '<span id="transition-opacity"><span></span><span>w_run</span><span>You run.</span></span>';
    const container = output.firstElementChild as HTMLElement;
    const empty = container.firstElementChild as HTMLElement;
    rememberNovelSource(container, empty);
    expect(readNovelPassages(output)[0]?.text).toBe("You run.");
    empty.textContent = "Old text";
    empty.remove();
    expect(readNovelPassages(output)[0]?.text).toBe("You run.");
  });
});
