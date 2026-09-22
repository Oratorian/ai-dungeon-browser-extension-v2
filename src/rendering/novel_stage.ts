import type { NovelCharacter, NovelFrame } from "./novel";

export type NovelStage = [string | null, string | null];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compile once per card-set change. Each result is an independent snapshot, so Back/Next and
 * jumps reconstruct the scene without leaking characters from lines the reader hasn't reached. */
export function createNovelStageTracker(characters: NovelCharacter[]) {
  const cast = characters.filter(c => c.id !== "player" && c.name.trim().toLowerCase() !== "you");
  const castIds = new Set(cast.map(c => c.id));
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

  return (frames: NovelFrame[], overrides: Record<number, string> = {}): NovelStage[] => {
    const slots: NovelStage = [null, null];
    return frames.map((frame, line) => {
      const triggered = new Set<string>();
      for (const match of pattern ? frame.text.matchAll(pattern) : []) {
        const owners = aliases.get(match[0].toLowerCase())!;
        if (owners.size !== 1) continue;
        triggered.add([...owners][0]!);
      }
      const speaker = overrides[line] ?? frame.speakerId;
      // Attribution is outside the quote in many passages. Keep the identified speaker on
      // stage throughout their dialogue, even when their name is absent from the quote itself.
      const dialogueSpeaker = frame.kind === "dialogue" && speaker && castIds.has(speaker) ? speaker : null;
      if (dialogueSpeaker) triggered.add(dialogueSpeaker);
      const visible = [...triggered].slice(0, 2);
      if (dialogueSpeaker && !visible.includes(dialogueSpeaker)) visible[1] = dialogueSpeaker;
      for (const slot of [0, 1] as const) if (!visible.includes(slots[slot]!)) slots[slot] = null;
      for (const id of visible) if (!slots.includes(id)) slots[slots.indexOf(null)] = id;
      return [...slots] as NovelStage;
    });
  };
}
