import { writable } from "svelte/store";
import { AID_MSG, type AidDetected, type AidMessage } from "./aid_protocol";

// Story cards passively detected from the AI Dungeon page (via the page-world interceptor).
// Ephemeral and session-only: the Import tab reads this store. It stays empty until an adventure
// with story cards is observed, so if AID changes its API the tab simply shows "nothing detected"
// and the rest of the extension is unaffected.
export const aidDetected = writable<AidDetected>({ shortId: null, title: null, cards: [] });

let connected = false;

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
    aidDetected.set({ shortId: d.shortId, title: d.title, cards: d.cards });
  });

  // Pull whatever the interceptor already captured for the open adventure.
  window.postMessage({ source: AID_MSG.SOURCE, kind: AID_MSG.REQUEST } as AidMessage, "*");
}
