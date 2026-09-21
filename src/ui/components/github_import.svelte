<script lang="ts">
  import { settings, Storage } from "@/storage";
  import { parseRepo, listJsonFiles, fetchAdventureName, fetchSourceFileText, GitHubError, type GitHubFile } from "@/media/github";

  import { get } from "svelte/store";
  import { checkGitHubFile, githubUpdates, installGitHubUpdate } from "@/media/github_updates";
  import { newerVersion, contentVersion } from "@/storage/github_updates";

  type Props = {
    onimported?: () => void;
  };

  let { onimported }: Props = $props();

  type FileRow = GitHubFile & { name: string | null; nameResolved: boolean; importing: boolean; targetId?: string; localVersion?: string; remoteVersion?: string; updateError?: string };

  let selectedRepo = $state<string | null>(null);
  let files = $state<FileRow[]>([]);
  let loading = $state(false);
  let error = $state("");
  let importError = $state("");
  let truncated = $state(false);
  // Bumped whenever we open a repo or go back, so stale async name/list results bail out.
  let loadGen = 0;

  function repoIdentity(entry: string): string {
    const p = parseRepo(entry)!;
    return `${p.owner.toLowerCase()}/${p.repo.toLowerCase()}@${p.branch ?? "HEAD"}`;
  }

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
        const file = files[idx];
        if (!file || gen !== loadGen) return;
        const name = await fetchAdventureName(file).catch(() => null);
        if (gen !== loadGen) return;
        file.name = name;
        file.nameResolved = true;
        const linked = Object.values(get(Storage.adventures)).find(a =>
          a.githubSource?.repo === repoIdentity(selectedRepo!) && a.githubSource.path === file.path && a.githubSource.release === file.release);
        if (linked?.githubSource) {
          file.targetId = linked.id;
          file.localVersion = linked.githubSource.version;
          try {
            const version = await checkGitHubFile(repoIdentity(selectedRepo!), file);
            if (gen !== loadGen) return;
            if (version) file.remoteVersion = version;
            else file.updateError = "No valid version found in the file header.";
          } catch { if (gen === loadGen) file.updateError = "Update check failed. Reopen this repo to retry."; }
        }
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

  async function importFile(row: FileRow, mode?: "merge" | "overwrite") {
    const repo = selectedRepo;
    const gen = loadGen;
    if (!repo) return;
    if (row.importing) return;
    row.importing = true;
    importError = "";
    try {
      if (mode) {
        const update = row.targetId ? get(githubUpdates)[row.targetId] : undefined;
        if (!update || update.version !== row.remoteVersion || update.installed !== row.localVersion) {
          throw new Error("This update changed. Reopen this repo to check again.");
        }
        const adventure = await installGitHubUpdate(row.targetId!, update, mode);
        if (gen !== loadGen) return;
        Storage.selectAdventure(adventure.id);
        onimported?.();
        return;
      }
      const source = { repo: repoIdentity(repo), path: row.path, release: row.release };
      const text = await fetchSourceFileText(source, row);
      if (gen !== loadGen) return;
      const data = JSON.parse(text);
      if (data.adventure && contentVersion(data.version)) {
        const adventure = Storage.importGitHubAdventure(text, source);
        Storage.selectAdventure(adventure.id);
        onimported?.();
      } else {
        const result = Storage.importAdventure(text);
        if (!result.success || !result.adventure) throw new Error(result.error ?? "Invalid export.");
        Storage.selectAdventure(result.adventure.id);
        onimported?.();
      }
    } catch (e) {
      importError = e instanceof Error ? e.message : "Couldn't import that file.";
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
            {#if row.targetId}
              <div class="flex flex-col gap-1 text-xs max-w-64">
                {#if row.updateError}
                  <span class="text-pretty-red">{row.updateError}</span>
                {:else if !row.remoteVersion}
                  <span>Checking for updates…</span>
                {:else if newerVersion(row.remoteVersion, row.localVersion!)}
                  <span>Update available: {row.localVersion} → {row.remoteVersion}</span>
                  <span>Merge adds new cards and keeps yours. Overwrite replaces all cards, including local edits and additions. Your set name and bindings stay.</span>
                  <div class="flex gap-2">
                    <button class="p-2 bg-pretty-theme/20 rounded-lg" disabled={row.importing} onclick={() => importFile(row, "merge")}>Merge</button>
                    <button class="p-2 bg-pretty-red/20 rounded-lg" disabled={row.importing} onclick={() => importFile(row, "overwrite")}>Overwrite</button>
                  </div>
                {:else}
                  <span>Imported v{row.localVersion}; no newer version.</span>
                {/if}
              </div>
            {:else}
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
            {/if}
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
