import { splitNovelSentences, type NovelFrame } from "./novel";

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
  let common = 0;
  while (common < before.length && common < after.length && before[common] === after[common]) common++;
  if (common === before.length) return common < after.length ? common : -1;
  if (common === before.length - 1 && after[common]?.startsWith(before[common]!)) return common;
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
