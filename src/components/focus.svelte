<script lang="ts">
  import { Popover, Slider } from "bits-ui";
  import { Storage, settings } from "@/utils/storage";
  import { AudioManager } from "@/utils/audio_manager";
  import type { StoryCard } from "@/utils/types";
  import { onDestroy, onMount } from "svelte";
  import { focusAudioState } from "@/utils/audio_focus";
  import { fade, fly, slide } from "svelte/transition";

  let focusCardId = $derived(extensionState.focusCardId);
  let validAudioClips = $state<string[]>([]);
  let currentlyPlaying = $state<string | null>(null);
  let isPopoverOpen = $state(false);

  let unsubCurrentlyPlaying: (() => void) | null = null;
  let unsubAdventures: (() => void) | null = null;
  let unsubFocusAudioState: (() => void) | null = null;
  let adventures = $state<Record<string, import("@/utils/types").Adventure>>({});

  let persistentState = $state({ lastFocusCardId: null as string | null, wasManuallyPaused: false, currentClipIndex: 0 });

  let card = $derived.by(() => {
    const id = focusCardId;
    if (!id) return null;
    const selectedId = Storage.getSelectedAdventure()?.id;
    if (!selectedId) return null;
    return adventures[selectedId]?.storyCards[id] ?? null;
  });

  let graphic = $derived(card?.graphics?.[card?.graphicIndex ?? 0]);

  onMount(() => {
    unsubCurrentlyPlaying = AudioManager.currentlyPlaying.subscribe((value) => {
      currentlyPlaying = value;
    });
    unsubAdventures = Storage.adventures.subscribe((value) => {
      adventures = value;
    });
    unsubFocusAudioState = focusAudioState.subscribe((value) => {
      persistentState = value;
    });
  });

  onDestroy(() => {
    unsubCurrentlyPlaying?.();
    unsubAdventures?.();
    unsubFocusAudioState?.();
  });

  $effect(() => {
    const id = focusCardId;

    if (id !== persistentState.lastFocusCardId) {
      focusAudioState.setFocusCard(id);
      focusAudioState.setManuallyPaused(false);

      if (id && card && card.audioClips && card.audioClips.length > 0) {
        const validated = AudioManager.validateClipIds(card.audioClips);
        validAudioClips = validated;

        if (validated.length > 0) {
          focusAudioState.setClipIndex(0);
          AudioManager.play(validated[0]);
        } else {
          focusAudioState.setClipIndex(0);
          AudioManager.stop();
        }
      } else {
        validAudioClips = [];
        focusAudioState.setClipIndex(0);
        AudioManager.stop();
      }
    }
  });

  $effect(() => {
    if (card && card.audioClips) {
      const validated = AudioManager.validateClipIds(card.audioClips);

      if (JSON.stringify(validated) !== JSON.stringify(validAudioClips)) {
        validAudioClips = validated;

        if (persistentState.currentClipIndex >= validated.length) {
          focusAudioState.setClipIndex(Math.max(0, validated.length - 1));
        }
      }
    } else {
      if (validAudioClips.length > 0) {
        validAudioClips = [];
      }
    }
  });

  function getClipName(clipId: string): string {
    const clip = AudioManager.getClipById(clipId);
    return clip?.name ?? "Unknown";
  }

  function playClip(index: number) {
    if (index >= 0 && index < validAudioClips.length) {
      focusAudioState.setClipIndex(index);
      focusAudioState.setManuallyPaused(false);
      AudioManager.play(validAudioClips[index]);
    }
  }

  function playNext() {
    const nextIndex = (persistentState.currentClipIndex + 1) % validAudioClips.length;
    playClip(nextIndex);
  }

  function playPrevious() {
    const prevIndex = (persistentState.currentClipIndex - 1 + validAudioClips.length) % validAudioClips.length;
    playClip(prevIndex);
  }

  function togglePlayback() {
    if (validAudioClips.length === 0) return;
    const currentClipId = validAudioClips[persistentState.currentClipIndex];

    if (isPlaying) {
      focusAudioState.setManuallyPaused(true);
    } else {
      focusAudioState.setManuallyPaused(false);
    }

    AudioManager.toggle(currentClipId);
  }

  let currentClipId = $derived(validAudioClips[persistentState.currentClipIndex] ?? null);
  let isPlaying = $derived(currentClipId && currentlyPlaying === currentClipId);

  $effect(() => {
    if (extensionState.isEditorOpen && isPlaying) {
      focusAudioState.setManuallyPaused(true);
    }
  });

  $effect(() => {
    if (extensionState.isEditorOpen) return;
    if (validAudioClips.length === 0) return;

    if (currentlyPlaying === null && persistentState.lastFocusCardId === focusCardId && !persistentState.wasManuallyPaused) {
      if (validAudioClips.length === 1) {
        AudioManager.play(validAudioClips[0]);
      } else {
        playNext();
      }
    }
  });
</script>

{#if card && graphic}
  <div
    transition:fade={{ duration: 400 }}
    onclick={(event: MouseEvent) => {
      event.stopPropagation();
      if (!card || card.graphics.length <= 1) return;
      const nextIndex = (card.graphicIndex + 1) % card.graphics.length;
      const selectedId = Storage.getSelectedAdventure()?.id;
      if (selectedId) {
        Storage.updateStoryCard(selectedId, card.id, { graphicIndex: nextIndex });
      }
    }}
    role="toolbar"
    tabindex="0"
    onkeydown={() => {}}
    class="group flex aspect-3/2 w-full bg-center bg-cover bg-no-repeat rounded-xl relative group"
    style="background-image: url({graphic}); cursor: {card.graphics.length <= 1 ? 'default' : 'pointer'};"
  >
    <div class="flex gap-3 justify-end relative w-full h-fit mt-auto p-3 transition opacity-0 group-hover:opacity-100">
      {#if validAudioClips.length > 0}
        <Popover.Root bind:open={isPopoverOpen}>
          <Popover.Trigger
            onclick={(event: MouseEvent) => {
              event.stopPropagation();
            }}
          >
            <span
              class="font-symbol text-3xl text-shadow-lg opacity-50 hover:opacity-100 {isPopoverOpen
                ? 'text-pretty-orange opacity-100!'
                : ''}"
            >
              {isPlaying ? "volume_up" : "volume_off"}
            </span>
          </Popover.Trigger>

          <Popover.Content
            onclick={(event: MouseEvent) => {
              event.stopPropagation();
            }}
            side="top"
            sideOffset={8}
            class="flex flex-col gap-0 z-50 w-72 bg-theme-neutral-200 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            <div class="flex items-center gap-3 p-3 bg-theme-neutral-100">
              <div class="flex items-center justify-center size-10 bg-pretty-theme/20 rounded-xl">
                <span class="font-symbol text-xl text-pretty-theme">music_note</span>
              </div>
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-xs text-theme-neutral-700 uppercase font-bold">Now Playing</span>
                <span class="text-sm truncate">{getClipName(currentClipId ?? "")}</span>
              </div>
            </div>

            <div class="flex flex-col gap-3 p-3">
              <div class="flex items-center justify-center gap-3">
                <button
                  onclick={playPrevious}
                  disabled={validAudioClips.length <= 1}
                  class="flex items-center justify-center size-12 transition-colors"
                >
                  <span class="font-symbol text-2xl">skip_previous</span>
                </button>

                <button
                  onclick={togglePlayback}
                  class="flex items-center justify-center size-12 bg-pretty-theme transition-all"
                >
                  <span class="font-symbol text-2xl">
                    {isPlaying ? "pause" : "play_arrow"}
                  </span>
                </button>

                <button
                  onclick={playNext}
                  disabled={validAudioClips.length <= 1}
                  class="flex items-center justify-center size-12 transition-colors"
                >
                  <span class="font-symbol text-3xl">skip_next</span>
                </button>
              </div>

              <div class="flex items-center gap-3">
                <span class="font-symbol text-lg text-theme-neutral-700">volume_down</span>
                <Slider.Root
                  type="single"
                  bind:value={$settings.volume}
                  min={0}
                  max={100}
                  class="relative flex w-full touch-none select-none items-center"
                >
                  <span class="bg-theme-neutral-100 relative h-2 w-full grow cursor-pointer overflow-hidden rounded-full">
                    <Slider.Range class="bg-pretty-theme absolute h-full" />
                  </span>
                  <Slider.Thumb
                    index={0}
                    class="bg-theme-neutral-900 hover:bg-pretty-theme focus-visible:outline-hidden block size-5 cursor-pointer rounded-full shadow-sm transition-colors"
                  />
                </Slider.Root>
                <span class="font-symbol text-lg text-theme-neutral-700">volume_up</span>
              </div>

              {#if validAudioClips.length > 1}
                <div class="flex flex-col gap-1">
                  <span class="text-xs text-theme-neutral-700 uppercase font-bold px-1">Tracks</span>
                  <div class="flex flex-col gap-1 max-h-36 overflow-y-auto">
                    {#each validAudioClips as clipId, i (clipId)}
                      {@const isCurrentTrack = i === persistentState.currentClipIndex}
                      <button
                        onclick={() => playClip(i)}
                        class="flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left {isCurrentTrack
                          ? 'bg-pretty-theme/20'
                          : 'bg-theme-neutral-300 hover:bg-theme-neutral-400'}"
                      >
                        <span class="font-symbol text-lg {isCurrentTrack ? 'text-pretty-theme' : 'text-theme-neutral-700'}">
                          {isCurrentTrack && isPlaying ? "equalizer" : "music_note"}
                        </span>
                        <span class="text-sm truncate flex-1">{getClipName(clipId)}</span>
                        {#if isCurrentTrack}
                          <span class="font-symbol text-lg text-pretty-theme">check</span>
                        {/if}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </Popover.Content>
        </Popover.Root>
      {/if}

      <span
        onclick={(event: MouseEvent) => {
          event.stopPropagation();
          extensionState.focusCardId = null;
        }}
        role="button"
        tabindex="0"
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            extensionState.focusCardId = null;
          }
        }}
        class="font-symbol text-3xl text-shadow-lg hover:text-pretty-red opacity-50 hover:opacity-100 transition-colors cursor-pointer select-none"
      >
        close
      </span>
    </div>
  </div>
{/if}
