import type { NovelFrame } from "./novel";
import type { NovelCard } from "./novel_cards";
import { readNovelBookmark, restoreNovelBookmark, type NovelBookmark } from "./novel_bookmark";

export type PortraitChoice = { portrait: string; locked: boolean; anchor?: NovelBookmark };
export type PortraitChoices = Record<string, PortraitChoice>;
export type PortraitMatch = { portrait: string; at: number };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrases = (value: string) => value.split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
const pattern = (values: string[], global = false) => new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${values.sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\p{N}_])`, global ? "giu" : "iu");

/** Only explicit narration about one unambiguous character can change a picture. */
export function createNovelPortraitTracker(cards: NovelCard[]) {
  const characters = cards.filter(card => card.type.trim().toLowerCase() === "character");
  const owners = new Map<string, Set<string>>();
  for (const card of characters) for (const alias of phrases(`${card.name},${card.triggers}`)) {
    const ids = owners.get(alias) ?? new Set<string>();
    ids.add(card.id); owners.set(alias, ids);
  }
  const names = owners.size ? pattern([...owners.keys()], true) : null;
  const rules = characters.flatMap(card => (card.portraits ?? []).flatMap(portrait => {
    const triggers = phrases(portrait.triggers);
    return triggers.length ? [{ card: card.id, portrait: portrait.id, match: pattern(triggers) }] : [];
  }));
  return (frames: NovelFrame[], seed: Record<string, PortraitMatch> = {}) => {
    const timeline: Record<string, PortraitMatch>[] = [];
    let current: Record<string, PortraitMatch> = Object.fromEntries(Object.entries(seed)
      .filter(([id, match]) => characters.some(card => card.id === id && card.portraits?.some(portrait => portrait.id === match.portrait))));
    let paragraph = "", masked = "", offset = 0;
    for (const [at, frame] of frames.entries()) {
      if (frame.startsParagraph || paragraph !== frame.paragraph) {
        paragraph = frame.paragraph; offset = 0;
        // Mask the whole paragraph before slicing frames. A quote can span several
        // sentences, so checking each frame for a pair of quotes is insufficient.
        masked = paragraph.replace(/"[^"]*(?:"|$)|“[^”]*(?:”|$)|«[^»]*(?:»|$)/gu,
          match => " ".repeat(match.length));
      }
      const start = paragraph.indexOf(frame.text, offset);
      const narration = start >= 0 ? masked.slice(start, start + frame.text.length) : "";
      if (start >= 0) offset = start + frame.text.length;
      if (names && narration.trim()) {
        // Treat separate clauses independently, but avoid inferring which of two named
        // characters owns an outfit when both appear in the same clause.
        for (const clause of narration.split(/;|\b(?:while|whereas)\b/iu)) {
          const mentioned = new Set<string>();
          let ambiguous = false;
          for (const match of clause.matchAll(names)) {
            const ids = owners.get(match[0].toLowerCase())!;
            if (ids.size !== 1) ambiguous = true;
            for (const id of ids) mentioned.add(id);
          }
          if (ambiguous || mentioned.size !== 1) continue;
          const id = [...mentioned][0]!;
          const matches = rules.filter(rule => rule.card === id && rule.match.test(clause));
          // Conflicting rules leave the current picture alone.
          if (matches.length === 1) current = { ...current, [id]: { portrait: matches[0]!.portrait, at } };
        }
      }
      timeline.push(current);
    }
    return timeline;
  };
}

export function readPortraitChoices(value: unknown, cards: NovelCard[]): PortraitChoices {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: PortraitChoices = {};
  for (const card of cards) {
    if (card.type.trim().toLowerCase() !== "character") continue;
    const item = (value as Record<string, Partial<PortraitChoice>>)[card.id];
    if (!item || typeof item.portrait !== "string" || typeof item.locked !== "boolean"
      || !card.portraits?.some(portrait => portrait.id === item.portrait)) continue;
    result[card.id] = { portrait: item.portrait, locked: item.locked, anchor: readNovelBookmark(item.anchor) };
  }
  return result;
}

/** Locked manual choices win. Unlocked choices yield only to a later narration match. */
export function novelPortrait(card: NovelCard, automatic: PortraitMatch | undefined, choice: PortraitChoice | undefined, frames: NovelFrame[]) {
  const manual = card.portraits?.find(portrait => portrait.id === choice?.portrait);
  let anchor = -1;
  if (choice?.anchor && frames.some(frame => frame.text === choice.anchor?.text)) {
    anchor = restoreNovelBookmark(choice.anchor, frames);
  }
  const picked = manual && (choice?.locked || !automatic || automatic.at <= anchor)
    ? manual : card.portraits?.find(portrait => portrait.id === automatic?.portrait);
  return { image: picked?.image ?? card.image, id: picked?.id ?? card.portraits?.find(portrait => portrait.image === card.image)?.id };
}
