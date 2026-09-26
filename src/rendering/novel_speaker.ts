import type { NovelCharacter, NovelFrame } from "./novel";
import { speechVerb } from "./novel";

/** Resolve labels and explicit speech attributions without treating dialogue mentions as speakers. */
export function novelSpeakers(frames: NovelFrame[], characters: NovelCharacter[]): (string | null)[] {
  const aliases = new Map<string, Set<string>>();
  for (const character of characters) {
    for (const value of [character.name, ...character.triggers.split(",")]) {
      const alias = value.trim().toLowerCase();
      if (!alias) continue;
      const owners = aliases.get(alias) ?? new Set<string>();
      owners.add(character.id);
      aliases.set(alias, owners);
    }
  }
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = [...aliases.keys()].sort((a, b) => b.length - a.length).map(escape).join("|") || "(?!)";
  const boundary = "(?<![\\p{L}\\p{N}_])";
  const adverbs = "(?:\\s+[\\p{L}]+ly){0,2}";
  const prefix = new RegExp(`${boundary}(${names})(?:\\s*:\\s*|${adverbs}\\s+${speechVerb}${adverbs}\\s*[,;:]?\\s*)$`, "iu");
  const suffix = new RegExp(`^\\s*[,;]?\\s*(?:(${names})${adverbs}\\s+${speechVerb}|${speechVerb}${adverbs}\\s+(${names}))(?![\\p{L}\\p{N}_])`, "iu");
  let paragraph = "";
  let offset = 0;
  let spans: { start: number; end: number; speaker: string | null }[] = [];
  return frames.map(frame => {
    if (frame.startsParagraph || paragraph !== frame.paragraph) {
      paragraph = frame.paragraph;
      offset = 0;
      spans = [];
      const quotes = [...paragraph.matchAll(/"[^"\n]*(?:"|$)|“[^”\n]*(?:”|$)|«[^»\n]*(?:»|$)/gu)];
      for (let i = 0; i < quotes.length; i++) {
        const match = quotes[i]!;
        const previous = quotes[i - 1];
        const end = match.index + match[0].length;
        // Search only narration immediately beside this quote, never inside another quote.
        const before = paragraph.slice(previous ? previous.index + previous[0].length : 0, match.index);
        const after = paragraph.slice(end, quotes[i + 1]?.index ?? paragraph.length);
        const leading = prefix.exec(before);
        const trailing = suffix.exec(after);
        // An explicit unknown label should not borrow a known trailing attribution.
        const name = leading?.[1] ?? (/[:]\s*$/u.test(before) ? "" : trailing?.[1] ?? trailing?.[2] ?? "");
        const owners = aliases.get(name.toLowerCase());
        spans.push({ start: match.index, end,
          speaker: owners?.size === 1 ? [...owners][0]! : null });
      }
    }
    const start = paragraph.indexOf(frame.text, offset);
    if (start < 0) return null;
    offset = start + frame.text.length;
    const overlapping = spans.filter(span => span.start < offset && span.end > start);
    const speaker = overlapping[0]?.speaker;
    return speaker && overlapping.every(span => span.speaker === speaker) ? speaker : null;
  });
}
