<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { settings } from "@/storage";
  import { listFolders, listImages, TrinetraError, type TrinetraFolder, type TrinetraImage } from "@/media/trinetra";

  // Browse the user's Trinetra images and insert one as a link. The API key is set once under
  // Settings > Extension > Trinetra rather than here, and the picker reopens in whichever folder it
  // was last in, so editing several cards from the same folder does not mean clicking down the same
  // path for every one of them.

  type Props = {
    // Called with the selected image's Trinetra URL. Returns true if it was accepted (not over the
    // limit) so the picker can reflect state.
    onselect: (url: string) => boolean;
    canAddMore?: boolean;
    onclose: () => void;
  };

  let { onselect, canAddMore = true, onclose }: Props = $props();

  // Images picked this session (by Trinetra id), so we can show them as already-added.
  let addedIds = $state<Set<string>>(new Set());

  const apiKey = $derived(($settings.trinetraApiKey ?? "").trim());

  let loading = $state(false);
  let error = $state("");

  let folders = $state<TrinetraFolder[]>([]);
  let currentFolderId = $state<number | null>(null); // null = root
  let images = $state<TrinetraImage[]>([]);

  const subfolders = $derived(folders.filter((f) => f.parent_id === currentFolderId));
  const currentFolder = $derived(currentFolderId === null ? null : (folders.find((f) => f.id === currentFolderId) ?? null));

  // Root > ... > current, so a picker that reopens three folders deep still says where it is.
  const path = $derived.by(() => {
    const chain: TrinetraFolder[] = [];
    let folder = currentFolder;
    while (folder) {
      chain.unshift(folder);
      const parentId = folder.parent_id;
      folder = parentId == null ? null : (folders.find((f) => f.id === parentId) ?? null);
    }
    return chain;
  });

  async function loadFolder(folderId: number | null) {
    if (!apiKey) return;
    loading = true;
    error = "";
    try {
      // The folder list is loaded once; images are refreshed on every navigation.
      if (folders.length === 0) folders = await listFolders(apiKey);
      // A remembered folder that has since been deleted falls back to the root rather than erroring.
      if (folderId !== null && !folders.some((f) => f.id === folderId)) folderId = null;
      currentFolderId = folderId;
      $settings.trinetraLastFolderId = folderId;
      images = (await listImages(apiKey, folderId, { limit: 100 })).items;
    } catch (e) {
      error = e instanceof TrinetraError ? e.message : "Failed to load images.";
    } finally {
      loading = false;
    }
  }

  // Store the image as a Trinetra link (not embedded) so adventure exports stay small; it loads
  // live from Trinetra when the card renders.
  function pick(img: TrinetraImage) {
    if (!canAddMore || addedIds.has(img.id)) return;
    const accepted = onselect(img.url);
    if (accepted) addedIds = new Set(addedIds).add(img.id);
  }

  // Open where the user last was. Done once on mount rather than in an effect: the previous effect
  // was keyed on `loading`, so a bad key or a network blip flipped it back to false and re-ran the
  // connection attempt in a loop.
  onMount(() => {
    if (apiKey) loadFolder(untrack(() => $settings.trinetraLastFolderId));
  });
</script>

<div class="flex flex-col gap-3 w-full bg-theme-neutral-100 rounded-xl p-3">
  <div class="flex items-center justify-between">
    <span class="text-sm font-bold text-theme-neutral-800">Trinetra Images</span>
    <button onclick={onclose} class="font-symbol text-lg text-theme-neutral-700 hover:text-theme-neutral-900">close</button>
  </div>

  {#if !apiKey}
    <span class="text-xs text-theme-neutral-700">
      Add your Trinetra API key under <b>Settings &rsaquo; Extension &rsaquo; Trinetra</b> to browse your uploaded images
      here and insert them as links.
    </span>
  {:else}
    <!-- Breadcrumb: every segment is clickable, so backing out is one click from anywhere. -->
    <div class="flex items-center gap-1 text-xs text-theme-neutral-700 min-w-0 flex-wrap">
      <button
        onclick={() => loadFolder(null)}
        class="hover:text-theme-neutral-900 {currentFolderId === null ? 'font-bold text-theme-neutral-900' : ''}"
      >
        Root
      </button>
      {#each path as folder (folder.id)}
        <span class="font-symbol text-sm">chevron_right</span>
        <button
          onclick={() => loadFolder(folder.id)}
          class="truncate max-w-32 hover:text-theme-neutral-900 {folder.id === currentFolderId ? 'font-bold text-theme-neutral-900' : ''}"
        >
          {folder.name}
        </button>
      {/each}
    </div>

    {#if error}
      <div class="flex items-center gap-2 px-1">
        <span class="text-xs text-pretty-red">{error}</span>
        <button onclick={() => loadFolder(currentFolderId)} class="text-xs text-pretty-theme hover:underline shrink-0">Retry</button>
      </div>
    {/if}

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
            <button
              onclick={() => pick(img)}
              disabled={added || !canAddMore}
              title={img.original_name}
              class="relative aspect-square rounded-lg overflow-hidden bg-theme-neutral-300 group disabled:cursor-not-allowed"
              class:opacity-40={added || !canAddMore}
            >
              <img src={img.thumb_url} alt={img.original_name} class="w-full h-full object-cover" loading="lazy" />
              {#if added}
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
