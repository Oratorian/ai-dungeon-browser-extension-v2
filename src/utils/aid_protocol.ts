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

export type AidDetected = {
  shortId: string | null;
  title: string | null;
  cards: AidCard[];
};

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
      title: string | null;
      cards: AidCard[];
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
    const type = typeof c.type === "string" ? c.type : "";
    if (!name && !triggers.trim()) continue; // nothing to match on
    const id = c.id != null ? String(c.id) : `${type}:${name}`;
    out.push({ id, type, name, triggers });
  }
  return out;
}
