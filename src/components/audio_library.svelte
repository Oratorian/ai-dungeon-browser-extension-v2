<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { AudioClip } from "@/utils/types";
  import { Storage } from "@/utils/storage";
  import { AudioManager } from "@/utils/audio_manager";
  import { onDestroy } from "svelte";

  let fileInput: HTMLInputElement;
  let currentlyPlaying = $state<string | null>(null);

  let audioFiles = $state<AudioClip[]>([]);
  Storage.audioLibrary.subscribe((value) => {
    audioFiles = value;
  });

  AudioManager.currentlyPlaying.subscribe((value) => {
    currentlyPlaying = value;
  });

  onDestroy(() => {
    AudioManager.stop();
  });

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function getTotalSize(): number {
    return audioFiles.reduce((acc, file) => acc + file.size, 0);
  }

  function handleAddClick() {
    fileInput?.click();
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of files) {
      if (!file.type.startsWith("audio/")) continue;

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;

        const audio = new Audio(base64);
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => resolve();
        });

        const newFile: AudioClip = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          duration: audio.duration,
          data: base64,
        };

        Storage.audioLibrary.update((files) => [...files, newFile]);
      };
      reader.readAsDataURL(file);
    }

    input.value = "";
  }

  function deleteFile(id: string) {
    if (currentlyPlaying === id) {
      AudioManager.stop();
    }
    Storage.audioLibrary.update((files) => files.filter((f) => f.id !== id));
    // Clean up any story cards that reference this audio
    AudioManager.cleanupInvalidReferences();
  }
</script>

<div class="flex flex-col gap-2 w-full">
  <input bind:this={fileInput} type="file" accept="audio/*" multiple onchange={handleFileSelect} class="hidden" />

  <div class="flex items-center justify-between px-2">
    <span class="text-xs text-theme-neutral-700">
      {audioFiles.length} file{audioFiles.length !== 1 ? "s" : ""} • {formatSize(getTotalSize())}
    </span>
    <button
      onclick={handleAddClick}
      class="flex items-center gap-1 px-3 py-1.5 bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme rounded-lg transition-colors text-sm"
    >
      <span class="font-symbol text-base text-pretty-theme">add</span>
      Add Audio
    </button>
  </div>

  <div class="scrollable-content flex flex-col gap-1 max-h-48 overflow-y-auto">
    {#if audioFiles.length === 0}
      <div class="flex flex-col items-center justify-center py-8 text-theme-neutral-700">
        <span class="font-symbol text-3xl mb-2">library_music</span>
        <span class="text-sm">No audio files yet</span>
        <span class="text-xs opacity-60">Click "Add Audio" to get started</span>
      </div>
    {:else}
      {#each audioFiles as file (file.id)}
        <div
          class="flex items-center gap-2 p-2 bg-theme-neutral-300 hover:bg-theme-neutral-400 rounded-lg transition-colors group"
        >
          <button
            onclick={() => AudioManager.toggle(file.id)}
            class="flex items-center justify-center size-8 rounded-md bg-theme-neutral-100 hover:bg-pretty-theme hover:text-theme-neutral-0 transition-colors"
          >
            <span class="font-symbol text-lg">
              {currentlyPlaying === file.id ? "stop" : "play_arrow"}
            </span>
          </button>

          <div class="flex flex-col flex-1 min-w-0">
            <span class="text-sm truncate" title={file.name}>{file.name}</span>
            <span class="text-xs text-theme-neutral-700">
              {formatDuration(file.duration)} • {formatSize(file.size)}
            </span>
          </div>

          <Tooltip.Provider>
            <Tooltip.Root delayDuration={300}>
              <Tooltip.Trigger>
                <button
                  onclick={() => deleteFile(file.id)}
                  class="flex items-center justify-center size-8 rounded-md opacity-0 group-hover:opacity-100 hover:bg-pretty-red hover:text-shadow-theme-neutral-900 transition-all"
                >
                  <span class="font-symbol text-lg">delete</span>
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content sideOffset={4} class="bg-theme-neutral-100 px-2 py-1 rounded-md text-xs shadow-popover z-50">
                Delete
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .scrollable-content {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .scrollable-content::-webkit-scrollbar {
    display: none;
  }
</style>
