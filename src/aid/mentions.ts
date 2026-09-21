import type { AidCard } from "./protocol";

export type MentionQuery = { start: number; end: number; query: string };
export type MentionName = { name: string; type: string; search: string };

/** Only an @ at a word boundary starts a mention, never the middle of an email address. */
export function mentionAtCaret(text: string, caret: number, selectionEnd = caret): MentionQuery | null {
  if (caret !== selectionEnd || caret < 0 || caret > text.length) return null;
  const match = text.slice(0, caret).match(/(?:^|[\s([{"'])@([^@\r\n]*)$/u);
  if (!match) return null;
  const query = match[1]!;
  // Include the remaining word when completing in the middle of an existing @name.
  const remainder = text.slice(caret).match(/^[\p{L}\p{M}\p{N}_'-]*/u)![0];
  return { start: caret - query.length - 1, end: caret + remainder.length, query: query.trim() };
}

/** Build once per API update, keeping typing cheap even with many story cards. */
export function indexMentionNames(cards: AidCard[]): MentionName[] {
  const unique = new Map<string, MentionName>();
  for (const card of cards) {
    const name = card.name.trim().replace(/\s+/g, " ");
    const search = name.toLocaleLowerCase();
    if (name && !unique.has(search)) unique.set(search, { name, type: card.type, search });
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function matchMentionNames(names: MentionName[], query: string, limit = 8): MentionName[] {
  const search = query.trim().toLocaleLowerCase();
  const prefix: MentionName[] = [], other: MentionName[] = [];
  for (const name of names) {
    if (name.search.startsWith(search)) prefix.push(name);
    else if (name.search.includes(search)) other.push(name);
  }
  return [...prefix, ...other].slice(0, limit);
}

export function completeMention(text: string, query: MentionQuery, name: string) {
  const tail = text.slice(query.end);
  const insert = name + (!tail || /^[\p{L}\p{N}_]/u.test(tail) ? " " : "");
  return { text: text.slice(0, query.start) + insert + tail, caret: query.start + insert.length, insert };
}

/** Notify React's controlled textarea while preserving native undo where supported. */
export function insertMention(input: HTMLTextAreaElement, query: MentionQuery, name: string) {
  const completed = completeMention(input.value, query, name);
  input.focus({ preventScroll: true });
  input.setSelectionRange(query.start, query.end);
  // insertText still supplies the browser's undo transaction for a programmatic completion.
  try { document.execCommand("insertText", false, completed.insert); } catch { /* use the native setter below */ }
  if (input.value !== completed.text) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, completed.text);
  }
  input.setSelectionRange(completed.caret, completed.caret);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: completed.insert }));
}
