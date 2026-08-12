import { writable } from "svelte/store";

interface FocusAudioState {
  lastFocusCardId: string | null;
  wasManuallyPaused: boolean;
  currentClipIndex: number;
}

function createFocusAudioState() {
  const { subscribe, set, update } = writable<FocusAudioState>({
    lastFocusCardId: null,
    wasManuallyPaused: false,
    currentClipIndex: 0,
  });

  return {
    subscribe,
    setFocusCard: (id: string | null) => update((state) => ({ ...state, lastFocusCardId: id })),
    setManuallyPaused: (paused: boolean) => update((state) => ({ ...state, wasManuallyPaused: paused })),
    setClipIndex: (index: number) => update((state) => ({ ...state, currentClipIndex: index })),
    reset: () => set({ lastFocusCardId: null, wasManuallyPaused: false, currentClipIndex: 0 }),
  };
}

export const focusAudioState = createFocusAudioState();
