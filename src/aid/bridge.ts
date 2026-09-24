import { writable } from "svelte/store";
import { AID_MSG, EMPTY_STATS, type AidDetected, type AidMessage } from "@/aid/protocol";

// Story cards passively detected from the AI Dungeon page (via the page-world interceptor).
// Ephemeral and session-only: the Import tab reads this store. It stays empty until an adventure
// with story cards is observed, so if AID changes its API the tab simply shows "nothing detected"
// and the rest of the extension is unaffected.
export const aidDetected = writable<AidDetected>({
  shortId: null,
  scenarioId: null,
  title: null,
  cards: [],
  stats: EMPTY_STATS,
});

let connected = false;

/**
 * The adventure name from the browser tab title, used when AI Dungeon's response carries no title of
 * its own (its queries only return the fields they ask for, and the title is not always among them).
 * Returns null for the bare site title, so a missing name stays missing rather than becoming
 * "AI Dungeon".
 */
function pageTitle(): string | null {
  // Escapes rather than literal dashes so the separator set survives any re-encoding of this file.
  const stripped = document.title.replace(/\s*[|–—-]\s*AI Dungeon\s*$/i, "").trim();
  return stripped && !/^ai dungeon$/i.test(stripped) ? stripped : null;
}

/**
 * Wire the content script to the page-world interceptor: receive captured cards, and ask for any
 * that were captured before the content script loaded (the interceptor installs at document_start,
 * the UI content script a bit later). Safe to call once from content-script startup.
 */
export function connectAidBridge() {
  if (connected) return;
  connected = true;

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return; // only messages posted into this page
    const d = ev.data as AidMessage | undefined;
    if (!d || d.source !== AID_MSG.SOURCE || d.kind !== AID_MSG.UPDATE) return;
    aidDetected.set({
      shortId: d.shortId,
      scenarioId: d.scenarioId ?? null,
      title: d.title ?? pageTitle(),
      scenarioTitle: typeof d.scenarioTitle === "string" ? d.scenarioTitle.trim() || null : null,
      cards: d.cards,
      stats: d.stats ?? EMPTY_STATS,
    });
  });

  // Pull whatever the interceptor already captured for the open adventure.
  window.postMessage({ source: AID_MSG.SOURCE, kind: AID_MSG.REQUEST } as AidMessage, "*");
}
