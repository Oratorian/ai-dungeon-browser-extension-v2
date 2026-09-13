import { get, writable } from "svelte/store";
import { Debug } from "@/shared/debug";
import { Storage } from "@/storage";
import { aidDetected } from "@/aid/bridge";

// Tracks which AI Dungeon adventure is being played and auto-selects the extension adventure that
// was imported from it, so story-card highlighting follows the adventure on screen without the user
// switching manually on the Adventure tab. See Storage.selectAdventureByAidId.

/**
 * The AI Dungeon adventure shortId currently in the URL, kept reactive so the UI (the Stamp button,
 * the import match check) tracks AI Dungeon's client-side navigation. Updated by
 * autoSelectPlayedAdventure, which content.ts polls.
 */
export const playedAdventureId = writable<string | null>(null);

/**
 * The id of the scenario the played adventure was started from, once the page tap has read it off
 * AI Dungeon's adventure response; null until then, or when AID's query does not carry it. Only
 * ever the scenario of the adventure in the URL: a capture left over from the previous adventure is
 * ignored, so a set is never stamped with a stranger's scenario.
 */
export const playedScenarioId = writable<string | null>(null);

/** The scenario id the page tap reports for the adventure in the URL, or null. */
export function playedScenarioIdNow(): string | null {
  const shortId = playedShortId();
  const detected = get(aidDetected);
  if (!shortId || !detected.scenarioId) return null;
  return detected.shortId === shortId ? detected.scenarioId : null;
}

/** The AI Dungeon adventure shortId from the current URL, or null. Reuses the shared URL parser. */
export function playedShortId(): string | null {
  return Debug.getAdventureId() || null;
}

// Only act when the played adventure actually changes, so a manual pick made within one adventure is
// respected (we don't re-select on every poll tick). `undefined` = not checked yet.
let lastShortId: string | null | undefined = undefined;
// The scenario id already acted on for lastShortId, so a late-arriving id is applied exactly once.
let lastScenarioId: string | null = null;

/**
 * Reconciles the selected extension adventure with the one currently being played, and keeps
 * playedAdventureId / playedScenarioId in sync. Safe to call repeatedly (idempotent between
 * navigations); a caller polls it on an interval because AI Dungeon routes client-side without a
 * page reload.
 *
 * The scenario id arrives a moment after the URL changes (the tap has to see AID's adventure
 * response first), so a scenario-stamped set is picked up on a later tick. That late pick only
 * fills an empty selection: if nothing was bound by shortId the navigation cleared the selection,
 * and a set the user chose by hand in the meantime is left alone.
 *
 * Call only AFTER Storage.load() has run, otherwise the store is empty, nothing matches, and the
 * change-guard latches so no later poll re-checks.
 */
export function autoSelectPlayedAdventure(): void {
  const shortId = playedShortId();
  const scenarioId = playedScenarioIdNow();

  if (shortId !== lastShortId) {
    lastShortId = shortId;
    lastScenarioId = scenarioId;
    playedAdventureId.set(shortId);
    playedScenarioId.set(scenarioId);
    if (!shortId) return; // not on an adventure page: leave the current selection alone
    // Select the card set linked to this adventure (or its scenario), or clear to an empty state if
    // it was never added, so we do not keep highlighting the previous adventure's cards on an
    // unrelated story.
    if (!Storage.selectAdventureByAidId(shortId, scenarioId)) Storage.selectAdventure(null);
    return;
  }

  if (scenarioId !== lastScenarioId) {
    lastScenarioId = scenarioId;
    playedScenarioId.set(scenarioId);
    if (shortId && scenarioId && get(Storage.selectedAdventureId) === null) {
      Storage.selectAdventureByAidId(shortId, scenarioId);
    }
  }
}
