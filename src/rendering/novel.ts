export type NovelCharacter = { id: string; name: string; triggers: string; portrait?: string };
export type NovelFrame = { text: string; kind: "narration" | "dialogue" };

const quoted = /"[^"\n]+"|“[^”\n]+”|«[^»\n]+»/gu;

/** Split loaded text into reader lines without inferring a speaker or carrying character context. */
export function parseNovel(text: string): NovelFrame[] {
  const frames: NovelFrame[] = [];
  const narration = (value: string) => {
    if (value.trim()) frames.push({ text: value.trim(), kind: "narration" });
  };
  for (const paragraph of text.split(/\n+/).filter(p => p.trim())) {
    let end = 0;
    for (const quote of paragraph.matchAll(quoted)) {
      narration(paragraph.slice(end, quote.index));
      frames.push({ text: quote[0], kind: "dialogue" });
      end = quote.index! + quote[0].length;
    }
    narration(paragraph.slice(end));
  }
  return frames;
}
