import { splitNovelSentences, type NovelFrame } from "./novel";

type RetryPassage = { element: HTMLElement; text: string };

/** Retry replaces the last passage, sometimes removing it before streaming its replacement. */
export function trackRetriedPassage(before: RetryPassage[]) {
  const original = before.at(-1);
  const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
  const oldText = normalize(original?.text ?? "");
  let removed = false;
  return (after: RetryPassage[]): number => {
    if (!original) return -1;
    const last = after.at(-1);
    if (!last) { removed = true; return -1; }
    // Do not mistake the preceding player action for the replacement when the
    // old response disappears. Older virtualized history may also be removed.
    if (before.slice(0, -1).some(p => p.element === last.element || normalize(p.text) === normalize(last.text))) {
      removed = true;
      return -1;
    }
    if (!removed && normalize(last.text) === oldText) return -1;
    return after.length - 1;
  };
}

/** Short stable sentences can be synthesized while the rest of a response streams. */
export function splitNarratedFrames(frames: NovelFrame[]): NovelFrame[] {
  return frames.flatMap(frame => {
    // The engine already handles long inputs. A word-count cutoff here breaks
    // dialogue attribution and prosody, so reader boundaries stay grammatical.
    const chunks = splitNovelSentences(frame.text);
    return chunks.map((text, index) => ({
      ...frame, text,
      startsParagraph: index === 0 ? frame.startsParagraph : undefined,
      startsPassage: index === 0 ? frame.startsPassage : undefined,
    }));
  });
}

/** Continue may append a passage or extend the final sentence in the existing passage. */
export function firstContinuationFrame(before: string[], after: string[]): number {
  // The gameplay list is virtualized. Earlier passages can disappear or be
  // remounted while Send is in flight; anchor to the retained tail, not only
  // an unchanged prefix of the entire loaded history.
  const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
  before = before.map(normalize);
  after = after.map(normalize);
  let common = 0;
  while (common < before.length && common < after.length && before[common] === after[common]) common++;
  if (common === before.length) return common < after.length ? common : -1;
  if (common === before.length - 1 && after[common]?.startsWith(before[common]!)) return common;
  const tail = before.at(-1);
  if (tail) {
    const anchor = after.findLastIndex(text => text === tail);
    if (anchor >= 0) return anchor + 1 < after.length ? anchor + 1 : -1;
    const extended = after.findLastIndex(text => text.startsWith(tail));
    if (extended >= 0) return extended;
  }
  return -1;
}

/** React may replace source elements without changing the reader's place. */
export function retainedNovelIndex<T extends { text: string; source: HTMLElement; offset: number }>(
  previous: T, oldIndex: number, frames: T[],
): number {
  const exact = frames.findIndex(f => f.source === previous.source && f.offset === previous.offset);
  if (exact >= 0) return exact;
  if (frames[oldIndex]?.text === previous.text) return oldIndex;
  const matching = frames.findIndex(f => f.text === previous.text);
  return matching >= 0 ? matching : Math.max(0, Math.min(oldIndex, frames.length - 1));
}
