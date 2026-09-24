import type { NovelCharacter, NovelFrame } from "./novel";

/** Resolve dialogue labels and native Say actions, including longer quotations. */
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
  let paragraph = "";
  let offset = 0;
  let spans: { start: number; end: number; speaker: string | null }[] = [];
  return frames.map(frame => {
    if (frame.startsParagraph || paragraph !== frame.paragraph) {
      paragraph = frame.paragraph;
      offset = 0;
      spans = [];
      // Consume unlabeled quotes too, so names mentioned inside dialogue cannot become labels.
      const quotes = /(?:([^:\n"“”«».!?]+):\s*|\b(You)\s+say,\s*)?("[^"\n]*(?:"|$)|“[^”\n]*(?:”|$)|«[^»\n]*(?:»|$))/giu;
      for (const match of paragraph.matchAll(quotes)) {
        const owners = aliases.get((match[1] ?? match[2] ?? "").trim().toLowerCase());
        spans.push({ start: match.index, end: match.index + match[0].length,
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
