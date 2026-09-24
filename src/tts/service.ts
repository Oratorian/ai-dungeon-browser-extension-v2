import { get, writable } from "svelte/store";
import { LocalNarrator } from "./client";
import type { NarrationOptions } from "./queue";

type TtsState = {
  phase: "off" | "checking" | "missing" | "loading" | "ready" | "error";
  message: string;
};
export const ttsState = writable<TtsState>({ phase: "off", message: "Off" });
let enabled = false;
let narrator: LocalNarrator | undefined;
let initialization: Promise<void> | undefined;

function createNarrator() {
  const client = new LocalNarrator(message => {
    if (narrator === client) ttsState.update(state => ({ ...state, message }));
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
    if (narrator === client) ttsState.set({ phase: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

/** Enablement checks real extension cache contents, never a persisted 'downloaded' flag. */
export function configureTts(value: boolean) {
  if (enabled === value) return;
  enabled = value;
  narrator?.dispose(); narrator = undefined; initialization = undefined;
  if (!value) { ttsState.set({ phase: "off", message: "Off" }); return; }
  const client = createNarrator();
  ttsState.set({ phase: "checking", message: "Checking downloaded models..." });
  void client.cached().then(cached => {
    if (narrator !== client || initialization) return;
    if (cached) {
      const task = load(client, false);
      initialization = task;
      void task.finally(() => { if (initialization === task) initialization = undefined; });
    } else ttsState.set({ phase: "missing", message: "ONNX models are not fully downloaded. Click Initialize TTS." });
  }).catch(error => {
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
  const speech = text.match(/^\s*(You say),\s*(["\u201c][\s\S]+)$/i);
  if (!speech?.[2]) return client.generate(text, options);

  // Generate dialogue independently so the action label cannot affect its delivery.
  // Keep both parts in one ready queue entry so playback never waits between them.
  const introduction = await client.generate(`${speech[1]}.`, options);
  const dialogue = await client.generate(speech[2], options);
  if (introduction.sampleRate !== dialogue.sampleRate) throw new Error("Narration sample rates do not match.");
  const pause = Math.round(introduction.sampleRate * 0.5);
  const samples = new Float32Array(introduction.samples.length + pause + dialogue.samples.length);
  samples.set(introduction.samples);
  samples.set(dialogue.samples, introduction.samples.length + pause);
  return { samples, sampleRate: introduction.sampleRate };
}
