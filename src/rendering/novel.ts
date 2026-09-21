/** Local, conservative dialogue attribution. No model calls or story text sent elsewhere. */
export type NovelCharacter = { id: string; name: string; triggers: string; portrait?: string };
export type NovelFrame = { text: string; kind: "narration" | "dialogue"; speakerId: string | null };

const speech = "(?:says?|said|asks?|asked|repl(?:y|ies|ied)|whispers?|whispered|murmurs?|murmured|shouts?|shouted|calls?|called|answers?|answered|adds?|added|exclaims?|exclaimed|mutters?|muttered|continues?|continued)";
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ambiguous aliases are excluded instead of assigning them to whichever card comes last. */
function aliases(characters: NovelCharacter[]) {
  const owners = new Map<string, Set<string>>();
  for (const character of characters) {
    for (const value of [character.name, ...character.triggers.split(",")]) {
      const alias = value.trim().toLocaleLowerCase();
      if (!alias) continue;
      const ids = owners.get(alias) ?? new Set<string>();
      ids.add(character.id);
      owners.set(alias, ids);
    }
  }
  return [...owners].filter(([, ids]) => ids.size === 1)
    .map(([alias, ids]) => ({ alias, id: [...ids][0]! }))
    .sort((a, b) => b.alias.length - a.alias.length);
}

export function parseNovel(text: string, characters: NovelCharacter[]): NovelFrame[] {
  const names = aliases(characters);
  const frames: NovelFrame[] = [];
  function speaker(before: string, after: string, hasNextQuote: boolean): string | null {
    const ids = new Set<string>();
    for (const { alias, id } of names) {
      const name = `(?<![\\p{L}\\p{N}_])${escape(alias)}(?![\\p{L}\\p{N}_])`;
      // Attribution must directly border the quote. A mentioned listener is not the speaker.
      const preceding = new RegExp(`(?:${name}\\s+${speech}(?:\\s+\\p{L}+ly)?\\s*[:,]?|${name}\\s*:)\\s*$`, "iu");
      const following = new RegExp(`^\\s*[,;.!?]?\\s*(?:${name}\\s+${speech}|${speech}\\s+${name})(?![\\p{L}\\p{N}_])`, "iu");
      if (preceding.test(before) || (following.test(after) && !(hasNextQuote && preceding.test(after)))) ids.add(id);
    }
    return ids.size === 1 ? [...ids][0]! : null;
  }
  function narration(value: string) {
    if (value.trim()) frames.push({ text: value.trim(), kind: "narration", speakerId: null });
  }
  // Paragraphs prevent attribution leaking across unrelated scenes or turns. Incomplete streamed
  // quotes stay as narration until the closing quote arrives; no story content is discarded.
  for (const paragraph of text.split(/\n+/).filter(p => p.trim())) {
    const quotes = [...paragraph.matchAll(/"[^"\n]+"|“[^”\n]+”|«[^»\n]+»/gu)];
    let end = 0;
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i]!;
      const start = quote.index!;
      const nextStart = quotes[i + 1]?.index ?? paragraph.length;
      const before = paragraph.slice(end, start);
      const after = paragraph.slice(start + quote[0].length, nextStart);
      narration(before);
      frames.push({ text: quote[0], kind: "dialogue", speakerId: speaker(before, after, i + 1 < quotes.length) });
      end = start + quote[0].length;
    }
    narration(paragraph.slice(end));
  }
  return frames;
}
