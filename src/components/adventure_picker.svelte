<script lang="ts">
  import { Dialog, DropdownMenu } from "bits-ui";
  import { Storage } from "@/utils/storage";
  import type { Adventure } from "@/utils/types";

  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);

  Storage.adventures.subscribe((value) => {
    adventures = value;
  });

  Storage.selectedAdventureId.subscribe((value) => {
    selectedId = value;
  });

  let isCreateDialogOpen = $state(false);
  let isDeleteDialogOpen = $state(false);
  let isRenameDialogOpen = $state(false);
  let newAdventureName = $state("");
  let adventureToDelete = $state<Adventure | null>(null);
  let adventureToRename = $state<Adventure | null>(null);
  let renameValue = $state("");

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

<div class="flex flex-col gap-2 w-full">
  <div class="flex items-center gap-2">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        class="flex items-center gap-2 flex-1 h-12 px-4 bg-theme-neutral-200 hover:bg-theme-neutral-300 rounded-xl transition-colors"
      >
        <span class="font-symbol text-xl text-theme-neutral-800">hiking</span>
        <span class="flex-1 text-left truncate">
          {selectedAdventure?.name ?? "Select Adventure"}
        </span>
        <span class="font-symbol text-theme-neutral-700">unfold_more</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          class="z-50 min-w-56 max-h-80 overflow-y-auto bg-theme-neutral-300 rounded-xl p-2 shadow-popover animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
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
                onSelect={() => Storage.selectAdventure(adventure.id)}
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
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

          <DropdownMenu.Item
            class="flex items-center gap-2 p-2 rounded-lg hover:bg-pretty-theme/20 cursor-pointer transition-colors text-pretty-theme"
            onSelect={() => (isCreateDialogOpen = true)}
          >
            <span class="font-symbol text-lg">add</span>
            <span class="text-sm">Create New Adventure</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </div>
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
