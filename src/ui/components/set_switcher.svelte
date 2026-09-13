<script lang="ts">
  import { Storage } from "@/storage";
  import type { Adventure } from "@/shared/types";

  // The floating button's Sets popover: switch the active card set, start a new one, or bring one
  // in, without opening the editor. A user who duplicates adventures often does this a lot, and the
  // editor is a detour for it. Renaming, deleting and exporting stay on the Adventure tab.

  type Props = {
    /** Open the editor's Import tab (AI Dungeon sync). */
    onsync: () => void;
  };

  let { onsync }: Props = $props();

  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);
  Storage.adventures.subscribe((a) => (adventures = a));
  Storage.selectedAdventureId.subscribe((id) => (selectedId = id));

  const list = $derived(Object.values(adventures).sort((a, b) => b.createdAt - a.createdAt));

  let creating = $state(false);
  let newName = $state("");
  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  function create() {
    const name = newName.trim();
    if (!name) return;
    const adventure = Storage.createAdventure(name);
    Storage.selectAdventure(adventure.id);
    newName = "";
    creating = false;
  }

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = Storage.importAdventure(await file.text());
      if (result.success && result.adventure) {
        Storage.selectAdventure(result.adventure.id);
        importError = null;
      } else {
        importError = result.error ?? "Unknown error";
      }
    } catch {
      importError = "Failed to read file";
    }
    input.value = "";
  }
</script>

<input bind:this={fileInput} type="file" accept=".json" onchange={onFile} class="hidden" />

<div class="flex flex-col gap-1">
  {#if list.length === 0}
    <div class="flex flex-col items-center py-4 text-theme-neutral-700">
      <span class="font-symbol text-2xl mb-1">explore_off</span>
      <span class="text-xs">No card sets yet</span>
    </div>
  {:else}
    <div class="flex flex-col gap-0.5 max-h-56 overflow-y-auto pr-1">
      {#each list as adventure (adventure.id)}
        {@const active = adventure.id === selectedId}
        <button
          onclick={() => Storage.selectAdventure(adventure.id)}
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors {active
            ? 'bg-theme-neutral-400'
            : 'hover:bg-theme-neutral-300'}"
        >
          <span class="font-symbol text-base {active ? 'text-pretty-theme' : 'text-theme-neutral-700'}">
            {active ? "check_circle" : "book"}
          </span>
          <span class="flex flex-col flex-1 min-w-0">
            <span class="text-sm truncate">{adventure.name}</span>
            <span class="text-xs text-theme-neutral-700">
              {Object.keys(adventure.storyCards).length} cards{adventure.aidScenarioId
                ? ", follows scenario"
                : adventure.aidShortId
                  ? ", one adventure"
                  : ""}
            </span>
          </span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="h-px bg-theme-neutral-400 my-1"></div>

  {#if creating}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        create();
      }}
      class="flex items-center gap-1.5"
    >
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value={newName}
        autofocus
        placeholder="Set name..."
        onkeydown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            creating = false;
          }
        }}
        class="flex-1 min-w-0 h-8 px-2 bg-theme-neutral-100 rounded-lg text-sm outline-none"
      />
      <button
        type="submit"
        disabled={!newName.trim()}
        class="h-8 px-2.5 bg-pretty-theme text-theme-neutral-0 rounded-lg text-xs hover:opacity-90 disabled:opacity-40"
      >
        Create
      </button>
    </form>
  {:else}
    <button
      onclick={() => (creating = true)}
      class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-pretty-theme hover:bg-pretty-theme/15 transition-colors"
    >
      <span class="font-symbol text-base">add</span>
      New set
    </button>
  {/if}

  <button
    onclick={onsync}
    class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-theme-neutral-300 transition-colors"
    title="Pull the open adventure's story cards from AI Dungeon"
  >
    <span class="font-symbol text-base">sync</span>
    Import from AI Dungeon
  </button>

  <button
    onclick={() => fileInput.click()}
    class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-theme-neutral-300 transition-colors"
    title="Restore a set from a .json export"
  >
    <span class="font-symbol text-base">upload_file</span>
    Import file
  </button>

  {#if importError}
    <div class="flex items-center gap-2 px-2 py-1.5 bg-pretty-red/20 text-pretty-red rounded-lg text-xs">
      <span class="font-symbol text-base">error</span>
      <span>{importError}</span>
    </div>
  {/if}
</div>
