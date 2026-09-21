<script lang="ts">
  import { Dialog, DropdownMenu } from "bits-ui";
  import { Storage } from "@/storage";
  import type { Adventure } from "@/shared/types";
  import GithubImport from "@/ui/components/github_import.svelte";
  import { contentVersion, newerVersion, nextContentVersion } from "@/storage/github_updates";

  import { githubUpdates, githubUpdateErrors, githubCheckedVersions, checkingGitHubUpdates, checkGitHubUpdates } from "@/media/github_updates";
  import { reviewUpdate } from "./github_update_dialog.svelte";
  import { onDestroy } from "svelte";

  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);

  const unsubscribeAdventures = Storage.adventures.subscribe((value) => {
    adventures = value;
  });

  const unsubscribeSelected = Storage.selectedAdventureId.subscribe((value) => {
    selectedId = value;
  });

  onDestroy(() => { unsubscribeAdventures(); unsubscribeSelected(); });

  let isCreateDialogOpen = $state(false);
  let isDeleteDialogOpen = $state(false);
  let isRenameDialogOpen = $state(false);
  let isImportDialogOpen = $state(false);
  let newAdventureName = $state("");
  let adventureToDelete = $state<Adventure | null>(null);
  let adventureToRename = $state<Adventure | null>(null);
  let renameValue = $state("");
  let importError = $state<string | null>(null);
  let importMode = $state<"local" | "github">("local");
  let fileInput: HTMLInputElement;
  let pickerOpen = $state(false);
  let exportDialogOpen = $state(false);
  let exportTargetId = $state<string | null>(null);
  let exportVersion = $state("");
  let exportError = $state("");
  const exportTarget = $derived(exportTargetId ? adventures[exportTargetId] : undefined);
  const currentExportVersion = $derived(exportTarget?.contentVersion ?? "1");
  const validExportBump = $derived(contentVersion(exportVersion) !== null && newerVersion(exportVersion.trim(), currentExportVersion));

  const adventureList = $derived(Object.values(adventures).sort((a, b) => b.createdAt - a.createdAt));

  const selectedAdventure = $derived(selectedId ? adventures[selectedId] : null);

  function handleCreate() {
    if (!newAdventureName.trim()) return;
    const adventure = Storage.createAdventure(newAdventureName);
    Storage.selectAdventure(adventure.id);
    newAdventureName = "";
    isCreateDialogOpen = false;
  }

  function handleDelete() {
    if (!adventureToDelete) return;
    Storage.deleteAdventure(adventureToDelete.id);
    adventureToDelete = null;
    isDeleteDialogOpen = false;
  }

  function handleRename() {
    if (!adventureToRename || !renameValue.trim()) return;
    Storage.updateAdventure(adventureToRename.id, { name: renameValue.trim() });
    adventureToRename = null;
    renameValue = "";
    isRenameDialogOpen = false;
  }

  function handleExport(adventure: Adventure) {
    exportTargetId = adventure.id;
    exportVersion = nextContentVersion(adventure.contentVersion);
    exportError = "";
    pickerOpen = false;
    exportDialogOpen = true;
  }

  function downloadExport(bump: boolean) {
    if (bump && !validExportBump) return;
    exportError = "";
    try {
      const adventure = exportTarget;
      if (!adventure) throw new Error("This adventure no longer exists.");
      const version = bump ? contentVersion(exportVersion)! : undefined;
      const json = Storage.exportAdventure(adventure.id, version);
      if (!json) throw new Error("This adventure no longer exists.");
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      try {
        a.href = url;
        a.download = `${adventure.name.replace(/[^a-z0-9]/gi, "_")}_adventure.json`;
        document.body.appendChild(a);
        a.click();
      } finally {
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (version) Storage.updateAdventure(adventure.id, { contentVersion: version });
      exportDialogOpen = false;
    } catch (error) {
      exportError = error instanceof Error ? error.message : "Couldn't export this adventure.";
    }
  }

  function handleImportClick() {
    fileInput?.click();
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = Storage.importAdventure(text);

      if (result.success && result.adventure) {
        Storage.selectAdventure(result.adventure.id);
        isImportDialogOpen = false;
        importError = null;
      } else {
        importError = result.error ?? "Unknown error";
      }
    } catch {
      importError = "Failed to read file";
    }

    input.value = "";
  }

  function openDeleteDialog(adventure: Adventure) {
    adventureToDelete = adventure;
    isDeleteDialogOpen = true;
  }

  function openRenameDialog(adventure: Adventure) {
    adventureToRename = adventure;
    renameValue = adventure.name;
    isRenameDialogOpen = true;
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<input bind:this={fileInput} type="file" accept=".json" onchange={handleFileSelect} class="hidden" />

<div class="flex flex-col gap-2 w-full">
  <div class="flex items-center gap-2">
    <DropdownMenu.Root bind:open={pickerOpen} onOpenChange={(open) => { if (open) void checkGitHubUpdates(); }}>
      <DropdownMenu.Trigger
        class="flex items-center gap-2 flex-1 h-12 px-4 bg-theme-neutral-200 hover:bg-theme-neutral-300 rounded-xl transition-colors"
      >
        <span class="font-symbol text-xl text-theme-neutral-800">hiking</span>
        <span class="flex-1 text-left truncate">
          {selectedAdventure?.name ?? "Select Adventure"}
        </span>
        {#if selectedId && $githubUpdates[selectedId]}
          <span class="shrink-0 rounded-full px-2 py-0.5 text-xs bg-pretty-theme/20 text-pretty-theme">Update available</span>
        {/if}
        <span class="font-symbol text-theme-neutral-700">unfold_more</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          class="z-50 min-w-56 max-h-80 overflow-y-auto bg-theme-neutral-300 rounded-xl p-2 shadow-popover animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          {#if $checkingGitHubUpdates}
            <div class="px-2 py-1 text-xs text-theme-neutral-700" role="status">Checking GitHub updates…</div>
          {/if}
          {#if adventureList.some(a => $githubUpdateErrors[a.id])}
            {#each adventureList.filter(a => $githubUpdateErrors[a.id]) as failed (failed.id)}
              <div class="px-2 py-1 text-xs text-pretty-red max-w-sm" role="status">{failed.name}: {$githubUpdateErrors[failed.id]}</div>
            {/each}
          {/if}
          {#if adventureList.length === 0}
            <div class="flex flex-col items-center py-6 text-theme-neutral-700">
              <span class="font-symbol text-3xl mb-2">explore_off</span>
              <span class="text-sm">No adventures yet</span>
            </div>
          {:else}
            {#each adventureList as adventure (adventure.id)}
              <DropdownMenu.Item
                class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-neutral-400 cursor-pointer group transition-colors {selectedId ===
                adventure.id
                  ? 'bg-theme-neutral-400'
                  : ''}"
                onSelect={() => { Storage.selectAdventure(adventure.id); reviewUpdate(adventure); }}
              >
                <span
                  class="font-symbol text-lg {selectedId === adventure.id ? 'text-pretty-theme' : 'text-theme-neutral-700'}"
                >
                  {selectedId === adventure.id ? "check_circle" : "book"}
                </span>
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-sm truncate">{adventure.name}</span>
                  <span class="text-xs text-theme-neutral-700">
                    {Object.keys(adventure.storyCards).length} cards • {formatDate(adventure.createdAt)}
                  </span>
                </div>
                {#if $githubUpdates[adventure.id]}
                  <span class="shrink-0 rounded-full px-2 py-0.5 text-xs bg-pretty-theme/20 text-pretty-theme">Update available</span>
                {/if}
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    role="button"
                    tabindex="0"
                    onclick={(e) => {
                      e.stopPropagation();
                      handleExport(adventure);
                    }}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleExport(adventure);
                      }
                    }}
                    class="p-1 hover:bg-theme-neutral-500 rounded-md transition-colors cursor-pointer"
                    title="Export adventure"
                  >
                    <span class="font-symbol text-base">upload</span>
                  </div>
                  <div
                    role="button"
                    tabindex="0"
                    onclick={(e) => {
                      e.stopPropagation();
                      openRenameDialog(adventure);
                    }}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        openRenameDialog(adventure);
                      }
                    }}
                    class="p-1 hover:bg-theme-neutral-500 rounded-md transition-colors cursor-pointer"
                  >
                    <span class="font-symbol text-base">edit</span>
                  </div>
                  <div
                    role="button"
                    tabindex="0"
                    onclick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(adventure);
                    }}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        openDeleteDialog(adventure);
                      }
                    }}
                    class="p-1 hover:bg-pretty-red rounded-md transition-colors cursor-pointer"
                  >
                    <span class="font-symbol text-base">delete</span>
                  </div>
                </div>
              </DropdownMenu.Item>
            {/each}
          {/if}

          <DropdownMenu.Separator class="h-px bg-theme-neutral-400 my-2" />

          {#if adventureList.some(a => a.githubSource)}
            <DropdownMenu.Item
              disabled={$checkingGitHubUpdates}
              onSelect={() => { void checkGitHubUpdates(true); }}
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-neutral-400 cursor-pointer text-pretty-theme"
            >
              <span class="font-symbol text-lg">refresh</span>
              <span class="text-sm">Check for updates now</span>
            </DropdownMenu.Item>
          {/if}

          <DropdownMenu.Item
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-pretty-theme/20 cursor-pointer transition-colors text-pretty-theme"
            onSelect={() => (isCreateDialogOpen = true)}
          >
            <span class="font-symbol text-lg">add</span>
            <span class="text-sm">Create New Adventure</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-theme-neutral-400 cursor-pointer transition-colors"
            onSelect={() => {
              importMode = "local";
              importError = null;
              isImportDialogOpen = true;
            }}
          >
            <span class="font-symbol text-lg">download</span>
            <span class="text-sm">Import Adventure</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </div>
  {#if selectedAdventure?.githubSource}
    <div class="px-2 text-xs text-theme-neutral-700" role="status" aria-live="polite">
      {#if $checkingGitHubUpdates}
        Checking GitHub updates…
      {:else if selectedId && $githubUpdateErrors[selectedId]}
        <span class="text-pretty-red">{$githubUpdateErrors[selectedId]}</span>
      {:else if selectedId && $githubCheckedVersions[selectedId]}
        Installed v{selectedAdventure.githubSource.version}.
        {#if selectedId && $githubUpdates[selectedId]}
          Version {$githubUpdates[selectedId]?.version} available.
        {:else}
          No newer version found in the last check.
        {/if}
      {/if}
    </div>
  {/if}
</div>

<Dialog.Root bind:open={isCreateDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 bg-black/60 z-50 animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <Dialog.Content
      trapFocus={false}
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-theme-neutral-200 rounded-2xl p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4"
    >
      <Dialog.Title class="text-lg font-bold mb-4">Create New Adventure</Dialog.Title>
      <Dialog.Description class="text-sm text-theme-neutral-700 mb-4">
        Give your adventure a memorable name. You can change it later.
      </Dialog.Description>

      <input
        type="text"
        bind:value={newAdventureName}
        placeholder="Adventure name..."
        class="w-full h-12 px-4 bg-theme-neutral-100 rounded-xl outline-none mb-4"
        onkeydown={(e) => e.key === "Enter" && handleCreate()}
      />

      <div class="flex gap-2 justify-end">
        <button
          onclick={() => (isCreateDialogOpen = false)}
          class="px-4 py-2 rounded-lg hover:bg-theme-neutral-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={handleCreate}
          disabled={!newAdventureName.trim()}
          class="px-4 py-2 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Create
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={isDeleteDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 bg-black/60 z-50 animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <Dialog.Content
      trapFocus={false}
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-theme-neutral-200 rounded-2xl p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4"
    >
      <Dialog.Title class="text-lg font-bold mb-4 text-pretty-red">Delete Adventure</Dialog.Title>
      <Dialog.Description class="text-sm text-theme-neutral-700 mb-4">
        Are you sure you want to delete <strong class="text-white">{adventureToDelete?.name}</strong>? This will remove all {Object.keys(
          adventureToDelete?.storyCards ?? {}
        ).length} story cards. This action cannot be undone.
      </Dialog.Description>

      <div class="flex gap-2 justify-end">
        <button
          onclick={() => (isDeleteDialogOpen = false)}
          class="px-4 py-2 rounded-lg hover:bg-theme-neutral-300 transition-colors"
        >
          Cancel
        </button>
        <button onclick={handleDelete} class="px-4 py-2 bg-pretty-red text-white rounded-lg hover:opacity-90 transition-all">
          Delete
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={exportDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/60 z-50" />
    <Dialog.Content class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-theme-neutral-200 rounded-2xl p-6 shadow-2xl">
      <Dialog.Title class="text-lg font-bold mb-3">Export {exportTarget?.name ?? "adventure"}</Dialog.Title>
      <Dialog.Description class="text-sm text-theme-neutral-700 mb-4">
        Current version: {currentExportVersion}. Bump the version when sharing updated cards so GitHub subscribers can detect the update. Your chosen version will be remembered for the next export.
      </Dialog.Description>
      <form onsubmit={(e) => { e.preventDefault(); downloadExport(true); }}>
        <label for="adventure-export-version" class="block text-sm mb-2">New version</label>
        <input id="adventure-export-version" type="text" bind:value={exportVersion}
          aria-describedby="adventure-export-version-help" aria-invalid={!validExportBump}
          class="w-full h-12 px-4 bg-theme-neutral-100 rounded-xl outline-none" />
        <p id="adventure-export-version-help" class="text-xs text-theme-neutral-700 mt-2">
          Enter a higher version, such as 2 or 9.2.1.
        </p>
        {#if exportError}<p role="alert" class="text-sm text-pretty-red mt-3">{exportError}</p>{/if}
        <div class="flex flex-wrap gap-2 justify-end mt-4">
          <button type="button" onclick={() => exportDialogOpen = false} class="px-3 py-2 rounded-lg hover:bg-theme-neutral-300">Cancel</button>
          <button type="button" onclick={() => downloadExport(false)} disabled={!exportTarget} class="px-3 py-2 rounded-lg hover:bg-theme-neutral-300">Export current version</button>
          <button type="submit" disabled={!exportTarget || !validExportBump} class="px-3 py-2 rounded-lg bg-pretty-theme text-theme-neutral-0 disabled:opacity-50">Bump &amp; export</button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={isRenameDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 bg-black/60 z-50 animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-theme-neutral-200 rounded-2xl p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4"
    >
      <Dialog.Title class="text-lg font-bold mb-4">Rename Adventure</Dialog.Title>

      <input
        type="text"
        bind:value={renameValue}
        placeholder="Adventure name..."
        class="w-full h-12 px-4 bg-theme-neutral-100 rounded-xl outline-none mb-4"
        onkeydown={(e) => e.key === "Enter" && handleRename()}
      />

      <div class="flex gap-2 justify-end">
        <button
          onclick={() => (isRenameDialogOpen = false)}
          class="px-4 py-2 rounded-lg hover:bg-theme-neutral-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onclick={handleRename}
          disabled={!renameValue.trim()}
          class="px-4 py-2 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Save
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={isImportDialogOpen}>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 bg-black/60 z-50 animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <Dialog.Content
      trapFocus={false}
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-theme-neutral-200 rounded-2xl p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4"
    >
      <Dialog.Title class="text-lg font-bold mb-2">Import Adventure</Dialog.Title>
      <Dialog.Description class="text-sm text-theme-neutral-700 mb-4">
        Import from a local file or a configured GitHub repo.
      </Dialog.Description>

      <div class="flex gap-1 p-1 bg-theme-neutral-100 rounded-xl mb-4">
        <button
          onclick={() => (importMode = "local")}
          class="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-sm transition-colors {importMode ===
          'local'
            ? 'bg-theme-neutral-300'
            : 'hover:bg-theme-neutral-200'}"
        >
          <span class="font-symbol text-base">upload_file</span>
          Local file
        </button>
        <button
          onclick={() => (importMode = "github")}
          class="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-sm transition-colors {importMode ===
          'github'
            ? 'bg-theme-neutral-300'
            : 'hover:bg-theme-neutral-200'}"
        >
          <span class="font-symbol text-base">cloud_download</span>
          From GitHub
        </button>
      </div>

      {#if importMode === "local"}
        {#if importError}
          <div class="flex items-center gap-2 p-3 mb-4 bg-pretty-red/20 text-pretty-red rounded-lg">
            <span class="font-symbol">error</span>
            <span class="text-sm">{importError}</span>
          </div>
        {/if}

        <button
          onclick={handleImportClick}
          class="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-theme-neutral-400 hover:border-pretty-theme rounded-xl transition-colors"
        >
          <span class="font-symbol text-2xl text-theme-neutral-700">upload_file</span>
          <span class="text-theme-neutral-700">Click to select file</span>
        </button>
      {:else}
        <GithubImport
          onimported={() => {
            isImportDialogOpen = false;
            importError = null;
          }}
        />
      {/if}

      <div class="flex gap-2 justify-end mt-4">
        <button
          onclick={() => {
            isImportDialogOpen = false;
            importError = null;
          }}
          class="px-4 py-2 rounded-lg hover:bg-theme-neutral-300 transition-colors"
        >
          {importMode === "github" ? "Close" : "Cancel"}
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
