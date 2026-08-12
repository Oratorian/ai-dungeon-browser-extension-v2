import { writable } from "svelte/store";
import { Debug } from "@/shared/debug";
import { Storage } from "@/storage";

// Tracks which AI Dungeon adventure is being played and auto-selects the extension adventure that
// was imported from it, so story-card highlighting follows the adventure on screen without the user
// switching manually on the Adventure tab. See Storage.selectAdventureByAidId.

/**
 * The AI Dungeon adventure shortId currently in the URL, kept reactive so the UI (the Stamp button,
 * the import match check) tracks AI Dungeon's client-side navigation. Updated by
 * autoSelectPlayedAdventure, which content.ts polls.
 */
export const playedAdventureId = writable<string | null>(null);

/** The AI Dungeon adventure shortId from the current URL, or null. Reuses the shared URL parser. */
export function playedShortId(): string | null {
  return Debug.getAdventureId() || null;
}

// Only act when the played adventure actually changes, so a manual pick made within one adventure is
// respected (we don't re-select on every poll tick). `undefined` = not checked yet.
let lastShortId: string | null | undefined = undefined;

/**
 * Reconciles the selected extension adventure with the one currently being played, and keeps
 * playedAdventureId in sync. Safe to call repeatedly (idempotent between navigations); a caller
 * polls it on an interval because AI Dungeon routes client-side without a page reload.
 *
 * Call only AFTER Storage.load() has run, otherwise the store is empty, nothing matches, and the
 * change-guard latches so no later poll re-checks.
 */
export function autoSelectPlayedAdventure(): void {
  const shortId = playedShortId();
  if (shortId === lastShortId) return;
  lastShortId = shortId;
  playedAdventureId.set(shortId);
  if (shortId) Storage.selectAdventureByAidId(shortId);
}
