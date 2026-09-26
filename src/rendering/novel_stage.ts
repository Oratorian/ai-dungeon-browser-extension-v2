import type { NovelCharacter, NovelFrame } from "./novel";
import { novelSpeakers } from "./novel_speaker";

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
    const speakers = novelSpeakers(frames, cast);
    const dialogueParagraphs = new Set(frames.filter((_, index) => speakers[index]).map(frame => frame.paragraph));
    const paragraphCast = new Map<string, string[]>();
    let previousNamedCharacter: string | null = null;
    let conversation = false;
    let currentCast: string[] = [];
    return frames.map(frame => {
      if (frame.startsPassage) { previousNamedCharacter = null; conversation = false; }
      let mentioned = paragraphCast.get(frame.paragraph);
      if (!mentioned) {
        const triggered = new Set<string>();
        // Dialogue can discuss absent characters. Only narration and speaker labels
        // establish presence; unfinished streaming quotes are excluded as well.
        const sceneText = frame.paragraph.replace(/"[^"\n]*(?:"|$)|“[^”\n]*(?:”|$)|«[^»\n]*(?:»|$)/gu, " ");
        for (const match of pattern ? sceneText.matchAll(pattern) : []) {
          const owners = aliases.get(match[0].toLowerCase())!;
          if (owners.size !== 1) continue;
          triggered.add([...owners][0]!);
        }
        mentioned = [...triggered].slice(0, 4);
        paragraphCast.set(frame.paragraph, mentioned);
      }
      if (frame.startsParagraph) {
        // An attributed quotation also changes the speaker, not the room's cast.
        // In particular, native prose may use '"..." you reply' instead of a label.
        const dialogue = dialogueParagraphs.has(frame.paragraph)
          || (mentioned.length > 0 && /["“«]/u.test(frame.paragraph));
        const existing = slots.filter((id): id is string => id !== null);
        const continuesConversation = conversation && existing.length > 0 && (
          mentioned.length > 0 ? mentioned.every(id => existing.includes(id))
            : /^(?:you|your|she|her|he|his|they|their)\b/iu.test(frame.paragraph.trim())
        );
        // Narration about an established participant ('Your voice is quiet...')
        // keeps listeners present. Unrelated narration or a new cast resets this.
        // Prioritize explicit presence when all four slots are already occupied.
        currentCast = dialogue || continuesConversation
          ? [...new Set([...mentioned, ...existing])].slice(0, 4)
          : mentioned.length ? mentioned : previousNamedCharacter && continuesCharacter(frame.paragraph) ? [previousNamedCharacter] : [];
        conversation = dialogue || continuesConversation;
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
