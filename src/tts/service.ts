import { get, writable } from "svelte/store";
import { LocalNarrator } from "./client";
import type { NarrationOptions } from "./queue";
import { ttsErrorCategory } from "./diagnostics";

type TtsState = {
  phase: "off" | "checking" | "missing" | "loading" | "ready" | "error";
  message: string;
};
export const ttsState = writable<TtsState>({ phase: "off", message: "Off" });
let enabled = false;
let narrator: LocalNarrator | undefined;
let initialization: Promise<void> | undefined;
let cacheComplete: boolean | null = null;
let lastFailure = "none";
let lastGenerationMs: number | null = null;
let completed = 0;
let failed = 0;
const requests = new Set<number>();
let nextRequest = 0;
const startedRequests = new Map<number, number>();

export function ttsDiagnostics() {
  const oldest = Math.min(...startedRequests.values());
  return { phase: get(ttsState).phase, enginePresent: !!narrator, initializing: !!initialization,
    cacheComplete, lastFailure, lastGenerationMs, completed, failed, pending: requests.size,
    pendingMs: requests.size ? Math.round(performance.now() - oldest) : 0,
    runtime: narrator?.diagnostics?.() ?? null };
}

function createNarrator() {
  const client = new LocalNarrator(message => {
    if (narrator === client) ttsState.update(state => ({ ...state, message }));
  }, message => {
    if (narrator === client) {
      lastFailure = "connection: " + ttsErrorCategory(message);
      ttsState.set({ phase: "error", message });
    }
  });
  narrator = client;
  return client;
}

async function load(client: LocalNarrator, download: boolean) {
  ttsState.set({ phase: "loading", message: download ? "Initializing TTS..." : "Loading cached TTS models..." });
  try {
    await client.initialize(download);
    if (narrator === client) ttsState.set({ phase: "ready", message: "TTS is fully available." });
  } catch (error) {
    if (narrator === client) lastFailure = "initialization: " + ttsErrorCategory(error);
    if (narrator === client) ttsState.set({ phase: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

/** Enablement checks real extension cache contents, never a persisted 'downloaded' flag. */
export function configureTts(value: boolean) {
  if (enabled === value) return;
  enabled = value;
  narrator?.dispose(); narrator = undefined; initialization = undefined;
  requests.clear(); startedRequests.clear(); cacheComplete = null;
  if (!value) { ttsState.set({ phase: "off", message: "Off" }); return; }
  const client = createNarrator();
  ttsState.set({ phase: "checking", message: "Checking downloaded models..." });
  void client.cached().then(cached => {
    if (narrator !== client || initialization) return;
    cacheComplete = cached;
    if (cached) {
      const task = load(client, false);
      initialization = task;
      void task.finally(() => { if (initialization === task) initialization = undefined; });
    } else ttsState.set({ phase: "missing", message: "ONNX models are not fully downloaded. Click Initialize TTS." });
  }).catch(error => {
    if (narrator === client) lastFailure = "cache check: " + ttsErrorCategory(error);
    if (narrator === client) ttsState.set({ phase: "error", message: String(error) });
  });
}

/** Explicit download action, shared by settings and the reader. */
export function initializeTts(): Promise<void> {
  configureTts(true);
  if (initialization) return initialization;
  if (get(ttsState).phase === "ready") return Promise.resolve();
  if (get(ttsState).phase === "error") { narrator?.dispose(); narrator = undefined; }
  const client = narrator ?? createNarrator();
  const task = load(client, true);
  initialization = task;
  void task.finally(() => { if (initialization === task) initialization = undefined; });
  return task;
}

export async function generateNarration(text: string, options: NarrationOptions) {
  if (!narrator || get(ttsState).phase !== "ready") throw new Error("Initialize TTS before reading aloud.");
  const client = narrator;
  // Speaker labels are visual cues, not spoken dialogue. Keep the quote itself
  // intact, including names the character actually says inside it.
  text = text.replace(/^\s*[\p{L}\p{N}][\p{L}\p{N}\s.'’\-]*:\s*(?=["“«])/u, "");
  text = text.replace(/^\s*You\s+say,\s*(?=["“«])/iu, "");
  const id = ++nextRequest;
  const started = performance.now();
  requests.add(id); startedRequests.set(id, started);
  try {
    const audio = await client.generate(text, options);
    if (narrator === client) { completed++; lastGenerationMs = Math.round(performance.now() - started); }
    return audio;
  } catch (error) {
    if (narrator === client) { failed++; lastFailure = "synthesis: " + ttsErrorCategory(error); }
    throw error;
  } finally { requests.delete(id); startedRequests.delete(id); }
}
