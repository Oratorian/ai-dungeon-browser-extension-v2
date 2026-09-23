import type { NovelFrame } from "./novel";

export type NovelLocation = { id: string; name: string; triggers: string; background?: string };
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const subject = String.raw`\b(?:you|we|i)\s+(?:(?:finally|now|quietly|slowly|quickly|carefully|cautiously)\s+)*`;
const article = String.raw`\s+(?:the\s+)?$`;
const arrive = new RegExp(subject + String.raw`(?:enter(?:ed)?|reach(?:ed)?|(?:step|stepped|walk|walked|run|ran|move|moved|head|headed|return|returned|travel|traveled|travelled|arrive|arrived)\s+(?:back\s+)?(?:into|inside|to|at)|(?:are|am|stand|stood|sit|sat|remain|wait|waited)\s+(?:still\s+)?(?:in|inside|at|within)|find\s+yourself\s+(?:in|inside|at)|found\s+yourself\s+(?:in|inside|at))` + article, "iu");
const depart = new RegExp(subject + String.raw`(?:leave|left|exit|exited|depart(?:ed)?\s+from|(?:step|stepped|walk|walked)\s+out\s+of)` + article, "iu");
const sceneStart = /^(?:\s*(?:inside|within|at|in)\s+(?:the\s+)?|\s*location:\s*(?:the\s+)?)$/iu;

/** Conservative local inference, not a speaker or world-state model. Only narration
 * establishing a setting or explicit player movement changes the carried location. */
export function createNovelLocationTracker(locations: NovelLocation[]) {
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
      // Work line by line: a later movement in the same paragraph must not move
      // the background before the player reaches that sentence.
      const narration = frame.text.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu, "");
      // Streaming unclosed dialogue is not a setting cue either.
      const text = narration.replace(/["“«][\s\S]*$/u, "");
      if (/\b(?:if|unless|whether|remember|remembered|recall|recalled|imagine|imagined|dream|dreamed)\b/iu.test(text)) return current;
      let moved = false;
      for (const match of pattern ? text.matchAll(pattern) : []) {
        const owners = aliases.get(match[0].toLowerCase())!;
        if (owners.size !== 1) continue;
        const id = [...owners][0]!;
        const before = text.slice(0, match.index);
        const after = text.slice(match.index + match[0].length);
        const movement = moved ? before.replace(/^[\s\S]*\band\s+(?:then\s+)?/iu, "you ") : before;
        if (arrive.test(movement) || sceneStart.test(before)
          || (!current && /^(?:the)?$/iu.test(before.trim()) && /^\s+(?:is|was|hums|smells|feels|bustles)\b/iu.test(after))) { current = id; moved = true; }
        else if (id === current && depart.test(before)) { current = null; moved = true; }
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
