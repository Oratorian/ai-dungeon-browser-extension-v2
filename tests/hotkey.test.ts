import { describe, it, expect } from "vitest";
import { hotkeyFromEvent, matchesHotkey, hotkeyParts } from "@/shared/hotkey";

const ev = (key: string, mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>> = {}) =>
  ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods }) as KeyboardEvent;

describe("hotkeyFromEvent", () => {
  it("names modifiers in a fixed order and uppercases a letter", () => {
    expect(hotkeyFromEvent(ev("f", { shiftKey: true, ctrlKey: true }))).toBe("Ctrl+Shift+F");
    expect(hotkeyFromEvent(ev("7", { altKey: true, metaKey: true }))).toBe("Alt+Meta+7");
  });

  it("refuses a key with no Ctrl, Alt or Meta, so typing can never trigger it", () => {
    expect(hotkeyFromEvent(ev("f"))).toBeNull();
    expect(hotkeyFromEvent(ev("F", { shiftKey: true }))).toBeNull();
  });

  it("refuses a modifier pressed on its own", () => {
    expect(hotkeyFromEvent(ev("Control", { ctrlKey: true }))).toBeNull();
    expect(hotkeyFromEvent(ev("Shift", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it("keeps named keys and spells out Space", () => {
    expect(hotkeyFromEvent(ev("F1", { ctrlKey: true }))).toBe("Ctrl+F1");
    expect(hotkeyFromEvent(ev(" ", { altKey: true }))).toBe("Alt+Space");
  });
});

describe("matchesHotkey", () => {
  it("matches only the exact combination", () => {
    expect(matchesHotkey(ev("f", { ctrlKey: true, shiftKey: true }), "Ctrl+Shift+F")).toBe(true);
    expect(matchesHotkey(ev("f", { ctrlKey: true }), "Ctrl+Shift+F")).toBe(false);
    expect(matchesHotkey(ev("g", { ctrlKey: true, shiftKey: true }), "Ctrl+Shift+F")).toBe(false);
  });

  it("never matches when no hotkey is set", () => {
    expect(matchesHotkey(ev("f", { ctrlKey: true }), "")).toBe(false);
  });
});

describe("hotkeyParts", () => {
  it("splits for display and is empty for none", () => {
    expect(hotkeyParts("Ctrl+Shift+F")).toEqual(["Ctrl", "Shift", "F"]);
    expect(hotkeyParts("")).toEqual([]);
  });
});
