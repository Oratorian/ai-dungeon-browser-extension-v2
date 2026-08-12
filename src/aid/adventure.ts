import { Storage } from "@/storage";

// Tracks which AI Dungeon adventure is being played and auto-selects the extension adventure that
// was imported from it, so story-card highlighting follows the adventure on screen without the user
// switching manually on the Adventure tab. See Storage.selectAdventureByAidId.

/** The AI Dungeon adventure shortId from the current URL, e.g. /adventure/<shortId>/slug/play. */
export function playedShortId(): string | null {
  const m = location.pathname.match(/\/adventure\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Only act when the played adventure actually changes, so a manual pick made within one adventure is
// respected (we don't re-select on every poll tick). `undefined` = not checked yet.
let lastShortId: string | null | undefined = undefined;

/**
 * Reconciles the selected extension adventure with the one currently being played. Safe to call
 * repeatedly (idempotent between navigations). AI Dungeon routes client-side, so the URL changes
 * without a page reload; a caller polls this on an interval.
 */
export function autoSelectPlayedAdventure(): void {
  const shortId = playedShortId();
  if (shortId === lastShortId) return;
  lastShortId = shortId;
  if (shortId) Storage.selectAdventureByAidId(shortId);
}
