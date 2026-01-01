<script lang="ts">
  import { Popover, Tooltip } from "bits-ui";
  import { Storage } from "@/utils/storage";
  import { AudioManager } from "@/utils/audio_manager";
  import type { AudioClip } from "@/utils/types";

  type Props = {
    selectedIds?: string[];
    onchange?: (ids: string[]) => void;
    maxSelections?: number;
  };

  let { selectedIds = $bindable([]), onchange, maxSelections = 4 }: Props = $props();

  let audioClips = $state<AudioClip[]>([]);
  let currentlyPlaying = $state<string | null>(null);
  let isOpen = $state(false);

  Storage.audioLibrary.subscribe((value) => {
    audioClips = value;
    // Auto-validate when library changes
    const validIds = AudioManager.validateClipIds(selectedIds);
    if (validIds.length !== selectedIds.length) {
      selectedIds = validIds;
      onchange?.(selectedIds);
    }
  });

  AudioManager.currentlyPlaying.subscribe((value) => {
    currentlyPlaying = value;
  });

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function toggleSelection(clipId: string) {
    if (selectedIds.includes(clipId)) {
      selectedIds = selectedIds.filter((id) => id !== clipId);
    } else if (selectedIds.length < maxSelections) {
      selectedIds = [...selectedIds, clipId];
    }
    onchange?.(selectedIds);
  }

  function removeSelection(clipId: string) {
    selectedIds = selectedIds.filter((id) => id !== clipId);
    onchange?.(selectedIds);
  }

  function getClipName(clipId: string): string {
    return audioClips.find((c) => c.id === clipId)?.name ?? "Unknown";
  }

  function handleOpenChange(open: boolean) {
    isOpen = open;
    if (!open) {
      AudioManager.stop();
    }
  }
</script>

<div class="flex flex-col gap-2 w-full">
  <!-- Selected clips display -->
  {#if selectedIds.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each selectedIds as clipId (clipId)}
        {@const clip = audioClips.find((c) => c.id === clipId)}
        {#if clip}
          <div class="flex items-center gap-1.5 px-2 py-1 bg-theme-neutral-300 rounded-lg text-sm group">
            <button
              onclick={() => AudioManager.toggle(clipId)}
              class="font-symbol text-base hover:text-pretty-theme transition-colors"
            >
              {currentlyPlaying === clipId ? "stop" : "play_arrow"}
            </button>
            <span class="truncate max-w-24">{clip.name}</span>
            <button
              onclick={() => removeSelection(clipId)}
              class="font-symbol text-base opacity-0 group-hover:opacity-100 hover:text-pretty-red transition-all"
            >
              close
            </button>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <Popover.Root bind:open={isOpen} onOpenChange={handleOpenChange}>
    <Popover.Trigger
      disabled={selectedIds.length >= maxSelections}
      class="flex items-center justify-center gap-1 w-full h-11 px-4 bg-theme-neutral-100 hover:bg-theme-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
    >
      <span class="font-symbol text-lg">library_music</span>
      <span class="text-sm">
        {selectedIds.length === 0 ? "Add Audio" : `Add More (${selectedIds.length}/${maxSelections})`}
      </span>
    </Popover.Trigger>

    <Popover.Content
      sideOffset={8}
      class="z-50 w-72 max-h-80 overflow-y-auto bg-theme-neutral-300 rounded-xl p-2 shadow-popover animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
    >
      {#if audioClips.length === 0}
        <div class="flex flex-col items-center py-6 text-theme-neutral-700">
          <span class="font-symbol text-3xl mb-2">library_music</span>
          <span class="text-sm">No audio clips available</span>
          <span class="text-xs opacity-60 mt-1">Add some in Settings → Audio</span>
        </div>
      {:else}
        <div class="flex flex-col gap-1">
          {#each audioClips as clip (clip.id)}
            {@const isSelected = selectedIds.includes(clip.id)}
            <div
              class="flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer {isSelected
                ? 'bg-pretty-theme/20'
                : 'hover:bg-theme-neutral-400'}"
            >
              <button
                onclick={(e) => {
                  e.stopPropagation();
                  AudioManager.toggle(clip.id);
                }}
                class="flex items-center justify-center size-8 rounded-md bg-theme-neutral-100 hover:bg-pretty-theme hover:text-theme-neutral-0 transition-colors shrink-0"
              >
                <span class="font-symbol text-lg">
                  {currentlyPlaying === clip.id ? "stop" : "play_arrow"}
                </span>
              </button>

              <button onclick={() => toggleSelection(clip.id)} class="flex flex-col flex-1 min-w-0 text-left">
                <span class="text-sm truncate">{clip.name}</span>
                <span class="text-xs text-theme-neutral-700">
                  {formatDuration(clip.duration)}
                </span>
              </button>

              <span class="font-symbol text-lg {isSelected ? 'text-pretty-theme' : 'text-theme-neutral-600'}">
                {isSelected ? "check_circle" : "radio_button_unchecked"}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
