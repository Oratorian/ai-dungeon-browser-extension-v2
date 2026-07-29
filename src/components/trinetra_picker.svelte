<script lang="ts">
  import { settings } from "@/utils/storage";
  import {
    getMe,
    listFolders,
    listImages,
    fetchImageAsDataUri,
    TrinetraError,
    type TrinetraFolder,
    type TrinetraImage,
  } from "@/utils/trinetra";

  type Props = {
    // Called with the selected image encoded as a base64 data URI. Returns true if it was
    // accepted (not over the limit) so the picker can reflect state.
    onselect: (dataUri: string) => boolean;
    canAddMore?: boolean;
    onclose: () => void;
  };

  let { onselect, canAddMore = true, onclose }: Props = $props();

  // Images picked this session (by Trinetra id), so we can show them as already-added.
  let addedIds = $state<Set<string>>(new Set());
  // Id currently being downloaded/encoded, for per-tile loading feedback.
  let pickingId = $state<string | null>(null);

  // API key lives in settings so it's entered once and remembered.
  let apiKey = $derived($settings.trinetraApiKey ?? "");
  let keyInput = $state("");

  let authed = $state(false);
  let loading = $state(false);
  let error = $state("");

  let folders = $state<TrinetraFolder[]>([]);
  let currentFolderId = $state<number | null>(null); // null = root
  let images = $state<TrinetraImage[]>([]);

  // Subfolders of the current folder.
  let subfolders = $derived(folders.filter((f) => f.parent_id === currentFolderId));
  let currentFolder = $derived(currentFolderId === null ? null : folders.find((f) => f.id === currentFolderId));
  let parentOfCurrent = $derived(currentFolder ? (currentFolder.parent_id ?? null) : null);

  async function connect() {
    const key = (keyInput || apiKey).trim();
    if (!key) {
      error = "Enter your Trinetra API key.";
      return;
    }
    loading = true;
    error = "";
    try {
      await getMe(key);
      // Persist the working key.
      $settings.trinetraApiKey = key;
      authed = true;
      await loadFolder(null);
    } catch (e) {
      error = e instanceof TrinetraError ? e.message : "Failed to connect to Trinetra.";
      authed = false;
    } finally {
      loading = false;
    }
  }

  async function loadFolder(folderId: number | null) {
    const key = ($settings.trinetraApiKey ?? "").trim();
    if (!key) return;
    loading = true;
    error = "";
    try {
      // Load the folder list once; refresh images every navigation.
      if (folders.length === 0) folders = await listFolders(key);
      currentFolderId = folderId;
      const list = await listImages(key, folderId, { limit: 100 });
      images = list.items;
    } catch (e) {
      error = e instanceof TrinetraError ? e.message : "Failed to load images.";
    } finally {
      loading = false;
    }
  }

  function forgetKey() {
    $settings.trinetraApiKey = "";
    authed = false;
    folders = [];
    images = [];
    currentFolderId = null;
    keyInput = "";
  }

  async function pick(img: TrinetraImage) {
    if (!canAddMore || pickingId || addedIds.has(img.id)) return;
    pickingId = img.id;
    error = "";
    try {
      // Download the full-resolution image and store it inline (base64) so the card is
      // self-contained and doesn't depend on Trinetra staying up.
      const dataUri = await fetchImageAsDataUri(img.url);
      const accepted = onselect(dataUri);
      if (accepted) addedIds = new Set(addedIds).add(img.id);
    } catch (e) {
      error = e instanceof TrinetraError ? e.message : "Failed to add image.";
    } finally {
      pickingId = null;
    }
  }

  // If a key is already saved, connect immediately.
  $effect(() => {
    if (apiKey && !authed && !loading) connect();
  });
</script>

<div class="flex flex-col gap-3 w-full bg-theme-neutral-100 rounded-xl p-3">
  <div class="flex items-center justify-between">
    <span class="text-sm font-bold text-theme-neutral-800">Trinetra Images</span>
    <button onclick={onclose} class="font-symbol text-lg text-theme-neutral-700 hover:text-theme-neutral-900">close</button>
  </div>

  {#if !authed}
    <div class="flex flex-col gap-2">
      <span class="text-xs text-theme-neutral-700">
        Enter your API key from
        <a
          href="https://trinetra.mahesvara.cloud/#register"
          target="_blank"
          rel="noopener noreferrer"
          class="text-pretty-theme hover:underline">trinetra.mahesvara.cloud</a
        >
        (API tab).
      </span>
      <div class="flex gap-2">
        <input
          bind:value={keyInput}
          type="password"
          placeholder="tri_..."
          onkeydown={(e) => e.key === "Enter" && connect()}
          class="flex-1 min-w-0 bg-theme-neutral-300 h-9 px-3 rounded-lg outline-0 text-sm"
        />
        <button
          onclick={connect}
          disabled={loading}
          class="px-3 py-1.5 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 disabled:opacity-40 transition-all text-sm"
        >
          {loading ? "..." : "Connect"}
        </button>
      </div>
      {#if error}<span class="text-xs text-pretty-red px-1">{error}</span>{/if}
    </div>
  {:else}
    <!-- Breadcrumb / navigation -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1 text-xs text-theme-neutral-700 min-w-0">
        {#if currentFolderId !== null}
          <button onclick={() => loadFolder(parentOfCurrent)} class="font-symbol text-base hover:text-theme-neutral-900">
            arrow_back
          </button>
        {/if}
        <span class="truncate">{currentFolder ? currentFolder.name : "Root"}</span>
      </div>
      <button onclick={forgetKey} class="text-xs text-theme-neutral-700 hover:text-pretty-red shrink-0">Sign out</button>
    </div>

    {#if error}<span class="text-xs text-pretty-red px-1">{error}</span>{/if}

    <div class="max-h-64 overflow-y-auto flex flex-col gap-2">
      <!-- Subfolders -->
      {#if subfolders.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each subfolders as folder (folder.id)}
            <button
              onclick={() => loadFolder(folder.id)}
              class="flex items-center gap-1 px-2 py-1.5 bg-theme-neutral-300 hover:bg-theme-neutral-100 rounded-lg text-xs text-theme-neutral-800 transition-colors"
            >
              <span class="font-symbol text-base">folder</span>
              <span class="truncate max-w-32">{folder.name}</span>
              <span class="text-theme-neutral-700">({folder.image_count})</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Image grid -->
      {#if loading}
        <div class="flex items-center justify-center h-20 text-theme-neutral-700 text-sm">Loading...</div>
      {:else if images.length === 0}
        <div class="flex items-center justify-center h-20 text-theme-neutral-700 text-sm">No images here.</div>
      {:else}
        <div class="grid grid-cols-4 gap-2">
          {#each images as img (img.id)}
            {@const added = addedIds.has(img.id)}
            {@const busy = pickingId === img.id}
            <button
              onclick={() => pick(img)}
              disabled={added || busy || !canAddMore || pickingId !== null}
              title={img.original_name}
              class="relative aspect-square rounded-lg overflow-hidden bg-theme-neutral-300 group disabled:cursor-not-allowed"
              class:opacity-40={added || (!canAddMore && !busy)}
            >
              <img src={img.thumb_url} alt={img.original_name} class="w-full h-full object-cover" loading="lazy" />
              {#if busy}
                <div class="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span class="font-symbol text-xl text-white animate-spin">progress_activity</span>
                </div>
              {:else if added}
                <div class="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span class="font-symbol text-xl text-white">check</span>
                </div>
              {:else}
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span class="font-symbol text-xl text-white">add</span>
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
