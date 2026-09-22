// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ACTION_MODES, continueStory, openActionInput, readActionInput, setActionMode, submitAction, writeActionDraft } from "@/aid/action_input";

let sent: { value: string; mode: string | null }[];
beforeEach(() => {
  document.body.innerHTML = `<textarea id="game-text-input"></textarea><button aria-label="Change input mode"><span>Do</span></button><div role="button" aria-label="Submit action" aria-disabled="true"></div><div id="menu"></div>`;
  sent = [];
  const field = document.querySelector<HTMLTextAreaElement>("textarea")!;
  // React's value tracker must be bypassed for the input event to represent a change.
  const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!;
  let tracked = "";
  Object.defineProperty(field, "value", { get() { return native.get!.call(this); }, set(value) { tracked = value; native.set!.call(this, value); } });
  field.addEventListener("input", () => {
    if (field.value !== tracked) {
      tracked = field.value;
      document.querySelector('[aria-label="Submit action"]')!.setAttribute("aria-disabled", String(!tracked.trim()));
    }
  });
  document.querySelector<HTMLElement>('[aria-label="Submit action"]')!.onclick = () => sent.push({ value: field.value, mode: readActionInput().mode });
  document.querySelector<HTMLElement>('[aria-label="Change input mode"]')!.onclick = () => {
    const menu = document.querySelector("#menu")!;
    menu.replaceChildren();
    for (const mode of ACTION_MODES) {
      const option = document.createElement("button");
      option.setAttribute("aria-label", `Set to '${mode}' mode`);
      option.onclick = () => {
        document.querySelector('[aria-label="Change input mode"] span')!.textContent = mode;
        menu.replaceChildren();
      };
      menu.append(option);
    }
    const close = document.createElement("button");
    close.setAttribute("aria-label", "Close 'Input Mode' menu");
    close.onclick = () => menu.replaceChildren();
    menu.append(close);
  };
});

describe("visual novel native action adapter", () => {
  it("opens a collapsed input even when the textarea remains mounted without aria-hidden", async () => {
    const mode = document.querySelector('[aria-label="Change input mode"]')!;
    mode.remove();
    const open = document.createElement("button"); open.setAttribute("aria-label", "Command: take a turn");
    let opened = 0;
    open.onclick = () => { opened++; document.body.append(mode); };
    document.body.append(open);
    expect(readActionInput().available).toBe(false);
    expect((await openActionInput(new AbortController().signal)).available).toBe(true);
    expect(opened).toBe(1);
    expect(sent).toEqual([]);
  });
  it("opens controls that mount after the initial attempt", async () => {
    const mode = document.querySelector('[aria-label="Change input mode"]')!;
    mode.remove();
    const open = document.createElement("button"); open.setAttribute("aria-label", "Command: take a turn");
    open.onclick = () => document.body.append(mode);
    const timer = setTimeout(() => document.body.append(open), 60);
    try { expect((await openActionInput(new AbortController().signal)).mode).toBe("Do"); }
    finally { clearTimeout(timer); }
    expect(sent).toEqual([]);
  });
  it("continues through the native command without submitting or changing the draft", async () => {
    writeActionDraft("Keep my draft");
    const command = document.createElement("button");
    command.setAttribute("aria-label", "Command: continue");
    let continued = 0;
    command.onclick = () => continued++;
    document.body.append(command);
    await continueStory(new AbortController().signal);
    expect(continued).toBe(1);
    expect(readActionInput().value).toBe("Keep my draft");
    expect(sent).toEqual([]);
    const controller = new AbortController(); controller.abort();
    await expect(continueStory(controller.signal)).rejects.toThrow();
    expect(continued).toBe(1);
  });
  it("reveals the native Continue command and restores a draft cleared by closing the input", async () => {
    writeActionDraft("Keep my draft");
    const close = document.createElement("button"); close.setAttribute("aria-label", "Close text input");
    let continued = 0;
    close.onclick = () => {
      writeActionDraft("");
      const command = document.createElement("button"); command.setAttribute("aria-label", "Command: continue");
      command.onclick = () => continued++;
      document.body.append(command);
    };
    document.body.append(close);
    await continueStory(new AbortController().signal);
    expect(continued).toBe(1);
    expect(readActionInput().value).toBe("Keep my draft");
    expect(sent).toEqual([]);
  });
  it("never clicks a disabled native Continue command", async () => {
    const command = document.createElement("div");
    command.setAttribute("aria-label", "Command: continue");
    command.setAttribute("aria-disabled", "true");
    let continued = 0;
    command.onclick = () => continued++;
    document.body.append(command);
    const controller = new AbortController();
    const pending = continueStory(controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(continued).toBe(0);
    expect(sent).toEqual([]);
  });
  it("does not Continue when the adventure changed while revealing native commands", async () => {
    const close = document.createElement("button"); close.setAttribute("aria-label", "Close text input");
    let continued = 0;
    const route = location.pathname;
    close.onclick = () => {
      const command = document.createElement("button"); command.setAttribute("aria-label", "Command: continue");
      command.onclick = () => continued++;
      document.body.append(command);
      history.pushState({}, "", "/adventure/other/play");
    };
    document.body.append(close);
    try { await expect(continueStory(new AbortController().signal)).rejects.toThrow("adventure changed"); }
    finally { history.replaceState({}, "", route); }
    expect(continued).toBe(0);
  });
  it("changes all four modes without sending or clearing the draft", async () => {
    const signal = new AbortController().signal;
    writeActionDraft("My existing draft");
    for (const mode of ACTION_MODES) {
      await setActionMode(mode, signal);
      expect(readActionInput()).toMatchObject({ value: "My existing draft", mode, canSubmit: true });
    }
    expect(sent).toEqual([]);
  });
  it("sends exactly through the native button with the requested mode and React draft", async () => {
    await submitAction("Hello there", "Say", new AbortController().signal);
    expect(sent).toEqual([{ value: "Hello there", mode: "Say" }]);
  });
  it("never sends empty, cancelled or disabled actions", async () => {
    await expect(submitAction(" ", "Do", new AbortController().signal)).rejects.toThrow("Write an action");
    const abort = new AbortController(); abort.abort();
    await expect(submitAction("Must not send", "Guide", abort.signal)).rejects.toThrow();
    document.querySelector<HTMLTextAreaElement>("textarea")!.readOnly = true;
    await expect(submitAction("Must not send", "Do", new AbortController().signal)).rejects.toThrow("not ready");
    expect(sent).toEqual([]);
  });
  it("opens a collapsed native input without submitting", async () => {
    const field = document.querySelector("textarea")!;
    field.setAttribute("aria-hidden", "true");
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Command: take a turn");
    button.onclick = () => field.removeAttribute("aria-hidden");
    document.body.append(button);
    await openActionInput(new AbortController().signal);
    expect(field.hasAttribute("aria-hidden")).toBe(false);
    expect(sent).toEqual([]);
  });
  it("does not submit into a different adventure after an asynchronous mode change", async () => {
    const previous = location.pathname;
    const button = document.querySelector<HTMLElement>('[aria-label="Change input mode"]')!;
    const open = button.onclick!;
    button.onclick = event => {
      open.call(button, event);
      history.pushState({}, "", "/adventure/another/play");
    };
    try {
      await expect(submitAction("Stay in my adventure", "Say", new AbortController().signal)).rejects.toThrow("adventure changed");
      expect(sent).toEqual([]);
    } finally { history.replaceState({}, "", previous); }
  });
});
