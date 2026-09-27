import type { NovelFrame } from "./novel";

export type NovelLocation = { id: string; name: string; type: string; triggers: string; background?: string };
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Resolve mentioned location names/triggers against card types, including dialogue.
 * Keep the latest matching location until another location is mentioned. */
export function createNovelLocationTracker(cards: NovelLocation[]) {
  const locations = cards.filter(card => card.type.trim().toLowerCase() === "location");
  const aliases = new Map<string, Set<string>>();
  for (const location of locations) for (const value of [location.name, ...location.triggers.split(",")]) {
    const alias = value.trim().toLowerCase();
    if (!alias) continue;
    const owners = aliases.get(alias) ?? new Set<string>();
    owners.add(location.id); aliases.set(alias, owners);
  }
  const keys = [...aliases.keys()].sort((a, b) => b.length - a.length);
  const pattern = keys.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${keys.map(escape).join("|")})(?![\\p{L}\\p{N}_])`, "giu") : null;
  return (frames: NovelFrame[], seed: string | null = null): (string | null)[] => {
    let current = locations.some(l => l.id === seed) ? seed : null;
    return frames.map(frame => {
      for (const match of pattern ? frame.text.matchAll(pattern) : []) {
        const owners = aliases.get(match[0].toLowerCase())!;
        if (owners.size === 1) current = [...owners][0]!;
      }
      return current;
    });
  };
}

/** Retain the setting just before the surviving text when AID virtualizes old passages. */
export function retainedLocationSeed(before: NovelFrame[], locations: (string | null)[], after: NovelFrame[], seed: string | null): string | null {
  if (!after.length) return seed;
  const start = before.findIndex(frame => frame.text === after[0]!.text);
  return start > 0 ? locations[start - 1] ?? seed : start === 0 ? seed : null;
}
