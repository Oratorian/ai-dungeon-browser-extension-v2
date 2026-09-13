/**
 * Keyboard shortcuts recorded and matched inside the extension, independent of the browser's own
 * extension-shortcut settings (which cannot be edited from a content script, and which Firefox
 * ignores for a temporary add-on anyway). A hotkey is stored as text like "Ctrl+Shift+F": the
 * modifiers in a fixed order, then one key. An empty string means none.
 *
 * At least one of Ctrl, Alt or Meta is required, so a shortcut can never be a plain letter that
 * would fire while someone types their story.
 */

export type ModifierName = "Ctrl" | "Alt" | "Shift" | "Meta";

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph", "OS"]);

/** Which of the key's identifiers is worth storing: letters uppercased, everything else as named. */
function keyName(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  if (e.key === "Unidentified" || e.key === "Dead") return null;
  if (e.key.length === 1) {
    // Letters and digits: layout-independent enough and readable ("F", "7"). A space is "Space".
    if (e.key === " ") return "Space";
    return e.key.toUpperCase();
  }
  return e.key; // "F1", "Escape", "ArrowUp", ...
}

/**
 * The hotkey a key event describes, or null when it is not one we accept: a modifier on its own,
 * or a key with no Ctrl/Alt/Meta held.
 */
export function hotkeyFromEvent(e: KeyboardEvent): string | null {
  const key = keyName(e);
  if (!key) return null;
  if (!e.ctrlKey && !e.altKey && !e.metaKey) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

/** Whether a key event is exactly the given hotkey (same modifiers, same key). */
export function matchesHotkey(e: KeyboardEvent, hotkey: string): boolean {
  if (!hotkey) return false;
  return hotkeyFromEvent(e) === hotkey;
}

/** The parts of a stored hotkey, for display as key caps. */
export function hotkeyParts(hotkey: string): string[] {
  return hotkey ? hotkey.split("+") : [];
}
