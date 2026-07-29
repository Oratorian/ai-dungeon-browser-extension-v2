<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { AudioClip } from "@/utils/types";
  import { Storage } from "@/utils/storage";
  import { AudioManager } from "@/utils/audio_manager";
  import { classifyPixabayInput, resolvePixabayPage, nameFromCdnUrl } from "@/utils/audio_url";
  import { onDestroy } from "svelte";

  let fileInput: HTMLInputElement;
  let currentlyPlaying = $state<string | null>(null);

  // Add flow: null = closed, "menu" = choose source, "url" = paste a Pixabay URL.
  let addMode = $state<null | "menu" | "url">(null);
  let urlValue = $state("");
  let urlError = $state("");
  let urlBusy = $state(false);

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

  function openMenu() {
    addMode = "menu";
  }

  function closeAdd() {
    addMode = null;
    urlValue = "";
    urlError = "";
  }

  function startUpload() {
    closeAdd();
    fileInput?.click();
  }

  function startUrl() {
    addMode = "url";
    urlValue = "";
    urlError = "";
  }

  // Streams a remote Pixabay clip: we store the URL (not the bytes). A pasted sound-effect PAGE
  // url is resolved to its direct audio link via the page's JSON-LD; a direct cdn.pixabay.com url
  // is used as-is. We fetch + decode once here to capture accurate duration/size and to confirm
  // it plays; AudioManager later streams it via the same fetch.
  async function addUrl() {
    if (urlBusy) return;
    const input = classifyPixabayInput(urlValue);
    if (input.kind === "error") {
      urlError = input.error;
      return;
    }
    urlBusy = true;
    urlError = "";
    let ctx: AudioContext | null = null;
    try {
      let audioUrl: string;
      let name: string;
      if (input.kind === "page") {
        const resolved = await resolvePixabayPage(input.url);
        audioUrl = resolved.url;
        name = resolved.name;
      } else {
        audioUrl = input.url;
        name = nameFromCdnUrl(input.url);
      }

      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error(`Couldn't download the audio (${res.status}).`);
      const arrayBuffer = await res.arrayBuffer();
      const size = arrayBuffer.byteLength;
      ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      const clip: AudioClip = {
        id: crypto.randomUUID(),
        name,
        size,
        duration: decoded.duration,
        data: audioUrl,
      };
      Storage.audioLibrary.update((files) => [...files, clip]);
      closeAdd();
    } catch (e) {
      urlError = e instanceof Error && e.message ? e.message : "Couldn't load that audio.";
    } finally {
      ctx?.close();
      urlBusy = false;
    }
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
      onclick={openMenu}
      class="flex items-center gap-1 px-3 py-1.5 bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme rounded-lg transition-colors text-sm"
    >
      <span class="font-symbol text-base text-pretty-theme">add</span>
      Add Audio
    </button>
  </div>

  {#if addMode === "menu"}
    <div class="flex flex-wrap gap-2 px-2">
      <button
        onclick={startUpload}
        class="flex items-center gap-2 px-3 py-2 text-sm text-theme-neutral-800 bg-theme-neutral-100 hover:bg-theme-neutral-300 rounded-lg transition-colors"
      >
        <span class="font-symbol text-base">upload</span>
        Upload file
      </button>
      <button
        onclick={startUrl}
        class="flex items-center gap-2 px-3 py-2 text-sm text-theme-neutral-800 bg-theme-neutral-100 hover:bg-theme-neutral-300 rounded-lg transition-colors"
      >
        <span class="font-symbol text-base">link</span>
        Pixabay URL
      </button>
    </div>
  {/if}

  {#if addMode === "url"}
    <div class="flex flex-col gap-1 px-2">
      <div class="flex gap-2">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          bind:value={urlValue}
          onkeydown={(e) => {
            if (e.key === "Enter") addUrl();
            if (e.key === "Escape") closeAdd();
          }}
          oninput={() => (urlError = "")}
          disabled={urlBusy}
          autofocus
          placeholder="Paste a Pixabay sound-effect page URL"
          class="flex-1 min-w-0 bg-theme-neutral-100 h-9 px-3 rounded-lg outline-0 text-sm disabled:opacity-50"
        />
        <button
          onclick={addUrl}
          disabled={urlBusy}
          class="px-3 py-1.5 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all text-sm"
        >
          {urlBusy ? "Adding..." : "Add"}
        </button>
        <button
          onclick={closeAdd}
          class="px-3 py-1.5 rounded-lg hover:bg-theme-neutral-300 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
      {#if urlError}
        <span class="text-xs text-pretty-red px-1">{urlError}</span>
      {/if}
      <span class="text-xs text-theme-neutral-700 px-1">
        Open a track on
        <a
          href="https://pixabay.com/sound-effects/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-pretty-theme hover:underline">Pixabay</a
        >
        and paste its page URL, the direct download link works too.
      </span>
    </div>
  {/if}

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
            <span class="flex items-center gap-1 text-sm truncate" title={file.name}>
              {#if file.data.startsWith("http")}
                <span class="font-symbol text-sm text-theme-neutral-700 shrink-0" title="Streamed from a URL">link</span>
              {/if}
              <span class="truncate">{file.name}</span>
            </span>
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
