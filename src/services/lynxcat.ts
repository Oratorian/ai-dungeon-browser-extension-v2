import { writable, get } from "svelte/store";
import { aidDetected } from "@/aid/bridge";
import { EMPTY_STATS } from "@/aid/protocol";
import { playedAdventureId, playedScenarioId } from "@/aid/adventure";
import { Storage } from "@/storage";
import { lynxRunId } from "./site";
import { lynxCards } from "./lynxcat_cards";
export const lynxImportError = writable("");
export const lynxImportLoading = writable(false);
let lastRun: string | null | undefined;
let controller: AbortController | undefined;
let generation = 0;
export async function refreshLynxCards() {
  const runId = lynxRunId(location.pathname);
  const request = ++generation;
  controller?.abort();
  controller = new AbortController();
  lynxImportError.set("");
  aidDetected.set({ shortId: runId, scenarioId: null, title: null, cards: [], stats: EMPTY_STATS });
  playedScenarioId.set(null);
  if (!runId) { lynxImportLoading.set(false); return; }
  lynxImportLoading.set(true);
  try {
    const read = async (suffix: string) => {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}${suffix}`, { credentials: "same-origin", signal: controller!.signal });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Log in to LynxCatAI and open your story, then try again." : `LynxCatAI could not load the cards (${response.status}). Try refreshing.`);
      return response.json();
    };
    const [elements, run] = await Promise.all([read("/elements"), read("")]);
    if (request !== generation || runId !== lynxRunId(location.pathname)) return;
    if (!elements || !Array.isArray(elements.dynamicCards) || run?.run?.id !== runId) throw new Error("The story data was not in the expected format. Refresh your story and try again.");
    const storyId = typeof run.run.storyId === "string" ? run.run.storyId : null;
    playedScenarioId.set(storyId);
    aidDetected.set({ shortId: runId, scenarioId: storyId, title: typeof run.run.title === "string" ? run.run.title : run.story?.title ?? null, scenarioTitle: run.story?.title ?? null, cards: lynxCards(elements.dynamicCards), stats: { responses: 2, withStoryCards: 1, holders: 1 } });
    if (get(Storage.selectedAdventureId) === null) Storage.selectAdventureByLynxId(runId, storyId);
  } catch (error) {
    if (request === generation && !controller.signal.aborted) lynxImportError.set(error instanceof Error ? error.message : "Could not read the story cards. Try again.");
  } finally { if (request === generation) lynxImportLoading.set(false); }
}
export function followLynxStory() {
  const runId = lynxRunId(location.pathname);
  if (runId === lastRun) return;
  lastRun = runId;
  playedAdventureId.set(runId);
  playedScenarioId.set(null);
  if (!Storage.selectAdventureByLynxId(runId, null)) Storage.selectAdventure(null);
  void refreshLynxCards();
}
export function disconnectLynx() { generation++; controller?.abort(); }
