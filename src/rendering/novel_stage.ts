import type { NovelCharacter, NovelFrame } from "./novel";

// Fill alternating sides: inner left, inner right, outer left, outer right.
export type NovelStage = [string | null, string | null, string | null, string | null];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A pronoun at the start of narration can continue the previous paragraph's lone character.
// Ignore an opening quote so "Hello," she echoes qualifies, but "She left" alone does not.
function continuesCharacter(paragraph: string): boolean {
  const narration = paragraph.trim().replace(/^(?:"[^"\n]+"|“[^”\n]+”|«[^»\n]+»)\s*[,;.!?]?\s*/u, "");
  return /^(?:she|her|he|his|they|their)\b/iu.test(narration);
}

/** Compile once per card-set change. Each result is an independent snapshot, so Back/Next and
 * jumps reconstruct the scene. All reader lines in a paragraph share its cast. */
export function createNovelStageTracker(characters: NovelCharacter[]) {
  const cast = characters.filter(c => c.id !== "player" && c.name.trim().toLowerCase() !== "you");
  const aliases = new Map<string, Set<string>>();
  for (const character of cast) {
    for (const value of [character.name, ...character.triggers.split(",")]) {
      const alias = value.trim().toLowerCase();
      if (!alias) continue;
      const owners = aliases.get(alias) ?? new Set<string>();
      owners.add(character.id); aliases.set(alias, owners);
    }
  }
  const keys = [...aliases.keys()].sort((a, b) => b.length - a.length);
  // Ambiguous aliases remain in the pattern to consume their whole phrase, preventing a shorter
  // alias inside them from accidentally selecting a character.
  const pattern = keys.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${keys.map(escape).join("|")})(?![\\p{L}\\p{N}_])`, "giu") : null;

  return (frames: NovelFrame[]): NovelStage[] => {
    const slots: NovelStage = [null, null, null, null];
    const paragraphCast = new Map<string, string[]>();
    let previousNamedCharacter: string | null = null;
    let currentCast: string[] = [];
    return frames.map(frame => {
      if (frame.startsPassage) previousNamedCharacter = null;
      let mentioned = paragraphCast.get(frame.paragraph);
      if (!mentioned) {
        const triggered = new Set<string>();
        for (const match of pattern ? frame.paragraph.matchAll(pattern) : []) {
          const owners = aliases.get(match[0].toLowerCase())!;
          if (owners.size !== 1) continue;
          triggered.add([...owners][0]!);
        }
        mentioned = [...triggered].slice(0, 4);
        paragraphCast.set(frame.paragraph, mentioned);
      }
      if (frame.startsParagraph) {
        currentCast = mentioned.length ? mentioned : previousNamedCharacter && continuesCharacter(frame.paragraph) ? [previousNamedCharacter] : [];
        // Only bridge one paragraph. A new explicit mention is needed before another carry.
        previousNamedCharacter = mentioned.length === 1 ? mentioned[0]! : null;
      }
      const visible = currentCast;
      for (const slot of [0, 1, 2, 3] as const) if (!visible.includes(slots[slot]!)) slots[slot] = null;
      for (const id of visible) if (!slots.includes(id)) slots[slots.indexOf(null)] = id;
      return [...slots] as NovelStage;
    });
  };
}
