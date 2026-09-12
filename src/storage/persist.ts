import type { Adventure } from "@/shared/types";

// How adventures are laid out in chrome.storage.local, and how a change is turned into writes.
//
// Adventures used to be one blob under a single "adventures" key. Every card edit then cloned and
// rewrote every adventure, and with inline images that is easily a hundred megabytes serialised
// because someone renamed a card. Each adventure now has its own key, so a change costs one
// adventure, and the store diff below decides which ones.
//
// Pure, so the diff and the layout are unit-tested; Storage wires them to the actual store.

export const ADVENTURE_KEY_PREFIX = "adventure:";

/** The single-blob key used before per-adventure keys. Read once, migrated, then removed. */
export const LEGACY_ADVENTURES_KEY = "adventures";

export const adventureKey = (id: string) => ADVENTURE_KEY_PREFIX + id;

export const isAdventureKey = (key: string) => key.startsWith(ADVENTURE_KEY_PREFIX);

/**
 * Pulls the raw adventures out of a whole-storage snapshot, from per-adventure keys and from the
 * legacy blob if one is still there. A per-adventure entry wins over the legacy one for the same
 * id, so an interrupted migration cannot roll a newer adventure back to its older copy.
 * `legacy` reports whether the blob was present, which is the cue to migrate it.
 */
export function readAdventures(snapshot: Record<string, unknown>): {
  raw: Record<string, unknown>;
  legacy: boolean;
} {
  const raw: Record<string, unknown> = {};

  const blob = snapshot[LEGACY_ADVENTURES_KEY];
  const legacy = Boolean(blob && typeof blob === "object");
  if (legacy) {
    for (const [id, value] of Object.entries(blob as Record<string, unknown>)) raw[id] = value;
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (isAdventureKey(key) && value && typeof value === "object") {
      raw[key.slice(ADVENTURE_KEY_PREFIX.length)] = value;
    }
  }

  return { raw, legacy };
}

/**
 * Which adventures to write and which keys to drop, comparing by object identity. Every update in
 * Storage replaces an adventure with a new object and leaves the others as they were, so identity
 * is exactly "did this one change", with no deep comparison of a blob that can hold megabytes of
 * base64.
 */
export function diffAdventures(
  persisted: Record<string, Adventure>,
  current: Record<string, Adventure>
): { changed: Adventure[]; removed: string[] } {
  const changed: Adventure[] = [];
  for (const [id, adventure] of Object.entries(current)) {
    if (persisted[id] !== adventure) changed.push(adventure);
  }
  const removed = Object.keys(persisted).filter((id) => !(id in current));
  return { changed, removed };
}
