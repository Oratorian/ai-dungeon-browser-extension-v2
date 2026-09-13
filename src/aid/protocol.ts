// Shared protocol between the page-world interceptor (src/entrypoints/interceptor.ts) and the
// content-script bridge (src/utils/aid_import.ts). Deliberately dependency-free (no svelte, no
// storage) so the injected page script stays tiny and self-contained.
//
// The interceptor forwards ONLY the story-card skeleton the extension actually needs
// (id, type, name, triggers). It never reads or sends entries, images, memory, author's note, or
// any other adventure content, and it never modifies AI Dungeon's requests or responses.

export type AidCard = {
  /** AI Dungeon's story-card id (stable across edits); used to de-duplicate a capture. */
  id: string;
  /** AID card type, e.g. "character", "location", "faction". Drives the import type filter. */
  type: string;
  /** AID "title" -> our card name. */
  name: string;
  /** AID "keys" -> our comma-separated triggers. */
  triggers: string;
};

/**
 * What the tap saw, so the diagnostics report can tell the failure modes apart when no cards turn
 * up: no GraphQL traffic seen at all (we are not intercepting), traffic but none carrying story
 * cards (AI Dungeon fetches them some other way now), or payloads that carry them but from which we
 * extracted nothing (our search is wrong). Counts only, no content.
 */
export type AidStats = {
  /** GraphQL responses read. */
  responses: number;
  /** ...of which contained the storyCards key. */
  withStoryCards: number;
  /** Objects carrying a storyCards array that the search actually found. */
  holders: number;
};

export type AidDetected = {
  shortId: string | null;
  /**
   * The id of the scenario the adventure was started from, when AI Dungeon's response names it.
   * Every adventure started or duplicated from one scenario shares it, which is what lets a card
   * set follow the scenario rather than one adventure. Opaque: whatever id form the payload
   * carried, compared only for equality.
   */
  scenarioId: string | null;
  title: string | null;
  cards: AidCard[];
  stats: AidStats;
};

export const EMPTY_STATS: AidStats = { responses: 0, withStoryCards: 0, holders: 0 };

export const AID_MSG = {
  /** window.postMessage tag so we ignore unrelated page messages. */
  SOURCE: "de-aid-import",
  /** interceptor -> content: freshly captured cards. */
  UPDATE: "update",
  /** content -> interceptor: replay whatever was captured before the content script loaded. */
  REQUEST: "request",
} as const;

export type AidMessage =
  | {
      source: typeof AID_MSG.SOURCE;
      kind: typeof AID_MSG.UPDATE;
      shortId: string | null;
      scenarioId: string | null;
      title: string | null;
      cards: AidCard[];
      stats: AidStats;
    }
  | { source: typeof AID_MSG.SOURCE; kind: typeof AID_MSG.REQUEST };

/** Reduce AID's raw storyCards array to the id/type/name/triggers skeleton, dropping empty cards. */
export function sanitizeCards(raw: unknown): AidCard[] {
  if (!Array.isArray(raw)) return [];
  const out: AidCard[] = [];
  for (const c of raw as any[]) {
    if (!c || typeof c !== "object") continue;
    const name = typeof c.title === "string" ? c.title.trim() : "";
    const triggers = typeof c.keys === "string" ? c.keys : "";
    // Normalize a missing type to "other" here so the import filter (which groups by type) and the
    // stored card agree; an empty type would otherwise display as "other" but save as "character".
    const type = typeof c.type === "string" && c.type.trim() ? c.type : "other";
    if (!name && !triggers.trim()) continue; // nothing to match on
    const id = c.id != null ? String(c.id) : `${type}:${name}`;
    out.push({ id, type, name, triggers });
  }
  return out;
}
