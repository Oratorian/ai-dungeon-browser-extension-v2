<script lang="ts">
  import { settings, Storage } from "@/utils/storage";
  import { parseRepo, listJsonFiles, fetchAdventureName, fetchFileText, GitHubError, type GitHubFile } from "@/utils/github";

  type Props = {
    onimported?: () => void;
  };

  let { onimported }: Props = $props();

  type FileRow = GitHubFile & { name: string | null; nameResolved: boolean; importing: boolean };

  let selectedRepo = $state<string | null>(null);
  let files = $state<FileRow[]>([]);
  let loading = $state(false);
  let error = $state("");
  let importError = $state("");
  let truncated = $state(false);
  // Bumped whenever we open a repo or go back, so stale async name/list results bail out.
  let loadGen = 0;

  function formatSize(bytes: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function repoLabel(entry: string): string {
    return parseRepo(entry)?.label ?? entry;
  }

  async function openRepo(entry: string) {
    const gen = ++loadGen;
    selectedRepo = entry;
    files = [];
    error = "";
    importError = "";
    truncated = false;
    loading = true;

    const parsed = parseRepo(entry);
    if (!parsed) {
      error = "That repo entry looks invalid; fix it in Settings.";
      loading = false;
      return;
    }

    try {
      const listing = await listJsonFiles(parsed);
      if (gen !== loadGen) return;
      truncated = listing.truncated;
      files = listing.files.map((f) => ({ ...f, name: null, nameResolved: false, importing: false }));
      loading = false;
      resolveNames(gen);
    } catch (e) {
      if (gen !== loadGen) return;
      error = e instanceof GitHubError ? e.message : "Couldn't load that repo.";
      loading = false;
    }
  }

  // Resolves friendly adventure names for the current file list, a few at a time, updating rows in
  // place by index (so the reactive array element updates). Guarded by `gen` so navigating away
  // stops it touching a stale list.
  async function resolveNames(gen: number) {
    let next = 0;
    const worker = async () => {
      while (true) {
        const idx = next++;
        if (idx >= files.length || gen !== loadGen) return;
        const name = await fetchAdventureName(files[idx]).catch(() => null);
        if (gen !== loadGen) return;
        files[idx].name = name;
        files[idx].nameResolved = true;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  function back() {
    loadGen++;
    selectedRepo = null;
    files = [];
    error = "";
    importError = "";
  }

  async function importFile(row: FileRow) {
    if (row.importing) return;
    row.importing = true;
    importError = "";
    try {
      const text = await fetchFileText(row);
      const result = Storage.importAdventure(text);
      if (result.success && result.adventure) {
        Storage.selectAdventure(result.adventure.id);
        onimported?.();
      } else {
        importError = `${row.name ?? row.filename}: ${result.error ?? "not a valid adventure export."}`;
      }
    } catch (e) {
      importError = e instanceof GitHubError ? e.message : "Couldn't import that file.";
    } finally {
      row.importing = false;
    }
  }
</script>

<div class="flex flex-col gap-2 w-full">
  {#if importError}
    <div class="flex items-center gap-2 p-3 bg-pretty-red/20 text-pretty-red rounded-lg">
      <span class="font-symbol">error</span>
      <span class="text-sm">{importError}</span>
    </div>
  {/if}

  {#if selectedRepo === null}
    <!-- Repo picker -->
    {#if $settings.scenarioRepos.length === 0}
      <div class="flex flex-col items-center justify-center py-8 text-theme-neutral-700">
        <span class="font-symbol text-3xl mb-2">folder_off</span>
        <span class="text-sm">No repos configured</span>
        <span class="text-xs opacity-60">Add one in Settings → Scenarios → GitHub Repos</span>
      </div>
    {:else}
      <span class="text-xs text-theme-neutral-700 px-1">Choose a repo to browse its shared adventures.</span>
      <div class="scrollable-content flex flex-col gap-1 max-h-64 overflow-y-auto">
        {#each $settings.scenarioRepos as entry (entry)}
          <button
            onclick={() => openRepo(entry)}
            class="flex items-center gap-2 p-2 bg-theme-neutral-300 hover:bg-theme-neutral-400 rounded-lg transition-colors text-left"
          >
            <span class="font-symbol text-lg text-theme-neutral-700 shrink-0">folder</span>
            <span class="flex-1 min-w-0 text-sm truncate">{repoLabel(entry)}</span>
            <span class="font-symbol text-lg text-theme-neutral-700 shrink-0">chevron_right</span>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- File list for the selected repo -->
    <div class="flex items-center gap-2">
      <button
        onclick={back}
        class="flex items-center justify-center size-8 rounded-md hover:bg-theme-neutral-300 transition-colors shrink-0"
        title="Back to repos"
      >
        <span class="font-symbol text-lg">arrow_back</span>
      </button>
      <span class="flex-1 min-w-0 text-sm font-bold truncate">{repoLabel(selectedRepo)}</span>
      {#if !loading}
        <span class="text-xs text-theme-neutral-700 shrink-0">
          {files.length} file{files.length !== 1 ? "s" : ""}
        </span>
      {/if}
    </div>

    {#if loading}
      <div class="flex flex-col items-center justify-center py-8 text-theme-neutral-700">
        <span class="font-symbol text-3xl mb-2 animate-spin">progress_activity</span>
        <span class="text-sm">Loading files…</span>
      </div>
    {:else if error}
      <div class="flex items-center gap-2 p-3 bg-pretty-red/20 text-pretty-red rounded-lg">
        <span class="font-symbol">error</span>
        <span class="text-sm">{error}</span>
      </div>
    {:else if files.length === 0}
      <div class="flex flex-col items-center justify-center py-8 text-theme-neutral-700">
        <span class="font-symbol text-3xl mb-2">find_in_page</span>
        <span class="text-sm">No .json files found</span>
      </div>
    {:else}
      {#if truncated}
        <div class="flex items-center gap-2 p-2 bg-pretty-theme/15 text-pretty-theme rounded-lg text-xs">
          <span class="font-symbol text-base">warning</span>
          <span>This repo's tree is large; some files may be missing.</span>
        </div>
      {/if}
      <div class="scrollable-content flex flex-col gap-1 max-h-64 overflow-y-auto">
        {#each files as row (row.path)}
          <div class="flex items-center gap-2 p-2 bg-theme-neutral-300 hover:bg-theme-neutral-400 rounded-lg transition-colors group">
            <span class="font-symbol text-lg text-theme-neutral-700 shrink-0">description</span>
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-sm truncate {!row.nameResolved ? 'opacity-70' : ''}" title={row.path}>
                {row.name ?? row.filename}
              </span>
              <span class="text-xs text-theme-neutral-700 truncate">
                {row.name ? row.filename : row.path}{row.size ? ` • ${formatSize(row.size)}` : ""}
              </span>
            </div>
            <button
              onclick={() => importFile(row)}
              disabled={row.importing}
              class="flex items-center gap-1 px-3 py-1.5 bg-pretty-theme/20 hover:bg-pretty-theme/30 disabled:opacity-50 text-pretty-theme rounded-lg transition-colors text-sm shrink-0"
            >
              {#if row.importing}
                <span class="font-symbol text-base animate-spin">progress_activity</span>
                Importing…
              {:else}
                <span class="font-symbol text-base">download</span>
                Import
              {/if}
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
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
