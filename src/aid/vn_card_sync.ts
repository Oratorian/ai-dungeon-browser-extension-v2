import { get, writable } from "svelte/store";
import { settings } from "@/storage";
import { playedShortId } from "./adventure";
import { aidDetected } from "./bridge";
import { VN_CARD_MESSAGE } from "./vn_card";

export const vnCardError = writable("");
let completed = "";
let pending: { id: string; key: string; deadline: number } | undefined;
let failed = "";
let connected = false;
let desired = "";
const managed = new Set<string>();

function instructionsEnabled() {
  const value = get(settings);
  return value.visualNovelMode && value.novelStoryCardInstructions !== false;
}

/** A saved preference is not consent to resume VN in a newly opened page. */
export function startVnCardSession() {
  settings.update(value => ({ ...value, visualNovelMode: false }));
  syncVnCard();
}

/** Called independently of VN visibility so Exit mode can disable the native card. */
export function syncVnCard(retry = false) {
  if (!connected) {
    connected = true;
    window.addEventListener("message", event => {
      const result = event.data;
      if (event.source !== window || event.origin !== location.origin || result?.source !== VN_CARD_MESSAGE
        || result.kind !== "result" || result.id !== pending?.id || !pending) return;
      if (result.error) {
        failed = result.waiting ? "" : pending.key;
        vnCardError.set(String(result.error));
      } else { completed = pending.key; vnCardError.set(""); }
      const finishedKey = pending.key;
      pending = undefined;
      // Send a queued exit immediately after an in-flight enable completes.
      if (finishedKey !== `${playedShortId()}:${instructionsEnabled()}`) syncVnCard();
    });
  }
  if (retry) { failed = ""; completed = ""; }
  if (pending && Date.now() > pending.deadline) {
    failed = pending.key; pending = undefined;
    vnCardError.set("VN Mode card save timed out. Refresh the page and retry.");
  }
  const shortId = playedShortId();
  if (!shortId) return;
  const enabled = instructionsEnabled();
  const detected = get(aidDetected);
  if (enabled || detected.shortId === shortId && detected.cards.some(card => card.name === "VN Mode")) managed.add(shortId);
  if (!enabled && !managed.has(shortId)) return;
  const key = `${shortId}:${enabled}`;
  // Results from a previous visit to this mode must not suppress a fresh toggle.
  // An unsuccessful save may also have reached the server before its response failed.
  if (key !== desired) {
    desired = key; completed = ""; failed = ""; vnCardError.set("");
  }
  if (pending) return;
  if (key === completed || key === failed) return;
  const id = crypto.randomUUID();
  pending = { id, key, deadline: Date.now() + 25000 };
  window.postMessage({ source: VN_CARD_MESSAGE, kind: "set", shortId, enabled, id }, location.origin);
}
