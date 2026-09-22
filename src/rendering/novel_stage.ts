import type { NovelCharacter, NovelFrame } from "./novel";

// Fill alternating sides: inner left, inner right, outer left, outer right.
export type NovelStage = [string | null, string | null, string | null, string | null];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compile once per card-set change. Each result is an independent snapshot, so Back/Next and
 * jumps reconstruct the scene without leaking characters from lines the reader hasn't reached. */
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
    const lastMention = new Map<string, number>();
    let sequence = 0;
    return frames.map(frame => {
      const triggered = new Set<string>();
      for (const match of pattern ? frame.text.matchAll(pattern) : []) {
        const owners = aliases.get(match[0].toLowerCase())!;
        if (owners.size !== 1) continue;
        triggered.add([...owners][0]!);
      }
      for (const id of triggered) lastMention.set(id, ++sequence);
      for (const id of triggered) {
        if (slots.includes(id)) continue;
        let slot = slots.indexOf(null);
        if (slot < 0) {
          // Keep everyone mentioned in this line. Replace only an older, unmentioned resident.
          let oldest = Infinity;
          slots.forEach((resident, i) => {
            if (resident && !triggered.has(resident) && lastMention.get(resident)! < oldest) {
              slot = i; oldest = lastMention.get(resident)!;
            }
          });
        }
        if (slot >= 0) slots[slot] = id;
      }
      return [...slots] as NovelStage;
    });
  };
}
