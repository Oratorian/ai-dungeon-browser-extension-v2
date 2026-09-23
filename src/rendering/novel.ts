export type NovelCharacter = { id: string; name: string; triggers: string; portrait?: string };
export type NovelFrame = { text: string; kind: "narration" | "dialogue"; paragraph: string; startsParagraph?: true; startsPassage?: true };

const quoted = /"[^"\n]+"|“[^”\n]+”|«[^»\n]+»/u;
const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const speechVerb = "(?:says?|said|asks?|asked|repl(?:y|ies|ied)|answers?|answered|whispers?|whispered|murmurs?|murmured|mutters?|muttered|shouts?|shouted|yells?|yelled|calls?|called|adds?|added|warns?|warned|continues?|continued|tells?|told|exclaims?|exclaimed|insists?|insisted|demands?|demanded|stammers?|stammered)";
const speechTag = new RegExp(`^(?:(?:[\\p{L}][\\p{L}'’\\-]*\\s+){1,5}${speechVerb}|${speechVerb})\\b`, "iu");

/** Keep a quotation and its speech tag together even after a question or exclamation mark.
 * This groups prose for reading; it does not assign or infer a character. */
export function splitNovelSentences(paragraph: string): string[] {
  const sentences: string[] = [];
  for (const { segment } of sentenceSegmenter.segment(paragraph)) {
    const previous = sentences.at(-1);
    if (previous && /["”»][,;:]?\s*$/u.test(previous) && speechTag.test(segment.trimStart())) {
      sentences[sentences.length - 1] = previous + segment;
    } else sentences.push(segment);
  }
  return sentences.map(sentence => sentence.trim()).filter(Boolean);
}

/** Split loaded text into reader lines without inferring a speaker or carrying character context. */
export function parseNovel(text: string): NovelFrame[] {
  const frames: NovelFrame[] = [];
  for (const paragraph of text.split(/\n+/).filter(p => p.trim())) {
    const first = frames.length;
    for (const sentence of splitNovelSentences(paragraph)) {
      frames.push({ text: sentence, kind: quoted.test(sentence) ? "dialogue" : "narration", paragraph });
    }
    if (frames[first]) frames[first].startsParagraph = true;
  }
  if (frames[0]) frames[0].startsPassage = true;
  return frames;
}
