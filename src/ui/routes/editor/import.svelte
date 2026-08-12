<script lang="ts">
  import Field from "@/ui/components/field.svelte";
  import { aidDetected } from "@/aid/bridge";
  import { playedShortId } from "@/aid/adventure";
  import { Storage } from "@/storage";
  import type { Adventure } from "@/shared/types";
  import type { AidCard, AidDetected } from "@/aid/protocol";

  // Story cards passively detected from the open AI Dungeon adventure (via the page interceptor).
  let detected = $state<AidDetected>({ shortId: null, title: null, cards: [] });
  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);
  let selectedTypes = $state<Set<string>>(new Set());
  let result = $state<{ imported: number; skipped: number; adventureName: string } | null>(null);
  // Import into a fresh adventure (default) rather than whatever is currently selected, so switching
  // AI Dungeon adventures never dumps cards into the wrong extension adventure.
  let createScenario = $state(true);

  aidDetected.subscribe((v) => {
    detected = v;
    result = null; // a fresh capture invalidates the last import summary
  });
  Storage.adventures.subscribe((a) => (adventures = a));
  Storage.selectedAdventureId.subscribe((id) => (selectedId = id));

  // Import target: the adventure selected on the Adventure tab, or null (we create one on import).
  const target = $derived(selectedId ? (adventures[selectedId] ?? null) : null);
  const newAdventureName = $derived(detected.title?.trim() || "Imported Adventure");

  // The shortId of the adventure being imported (URL first, captured id as fallback).
  const importedShortId = $derived(playedShortId() ?? detected.shortId);
  // True when the currently selected adventure is already the one bound to that adventure.
  const targetMatches = $derived(!!target?.aidShortId && !!importedShortId && target.aidShortId === importedShortId);

  // Default the "Create new adventure" toggle: create a fresh one UNLESS the selected adventure is
  // already the match for what's being imported (then merging into it is the whole point, so leave
  // it unchecked). Recomputed when that context changes; a manual toggle sticks until then.
  let scenarioKey = "";
  $effect(() => {
    const key = `${target?.id ?? ""}|${target?.aidShortId ?? ""}|${importedShortId ?? ""}`;
    if (key !== scenarioKey) {
      scenarioKey = key;
      createScenario = !targetMatches;
    }
  });

  // Group detected cards by type for the filter.
  const groups = $derived.by(() => {
    const map = new Map<string, AidCard[]>();
    for (const c of detected.cards) {
      const t = c.type || "other";
      const arr = map.get(t);
      if (arr) arr.push(c);
      else map.set(t, [c]);
    }
    return [...map.entries()].map(([type, cards]) => ({ type, cards })).sort((a, b) => a.type.localeCompare(b.type));
  });

  // Default every type to selected; reset only when the set of types actually changes.
  let typesKey = "";
  $effect(() => {
    const key = groups.map((g) => g.type).join("|");
    if (key !== typesKey) {
      typesKey = key;
      selectedTypes = new Set(groups.map((g) => g.type));
    }
  });

  const selectedCards = $derived(detected.cards.filter((c) => selectedTypes.has(c.type || "other")));

  function toggleType(type: string) {
    const next = new Set(selectedTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    selectedTypes = next;
  }

  function setAll(on: boolean) {
    selectedTypes = on ? new Set(groups.map((g) => g.type)) : new Set();
  }

  function doImport() {
    if (selectedCards.length === 0) return;

    // With "Create new adventure" on (default), or when nothing is selected, make a fresh adventure
    // named after the AI Dungeon adventure and bind it to that adventure's shortId, so it auto-loads
    // on play and the import never lands in a previously-selected (wrong) adventure. Otherwise merge
    // into the selected adventure, leaving its existing link untouched.
    let adventure;
    if (createScenario || !target) {
      adventure = Storage.createAdventure(newAdventureName);
      Storage.selectAdventure(adventure.id);
      if (importedShortId) Storage.updateAdventure(adventure.id, { aidShortId: importedShortId });
    } else {
      adventure = target;
    }

    const res = Storage.importStoryCards(
      adventure.id,
      selectedCards.map((c) => ({ name: c.name, type: c.type, triggers: c.triggers }))
    );
    result = { ...res, adventureName: adventure.name };
  }
</script>

<div class="flex flex-col gap-4">
  <Field
    label="Import from AI Dungeon"
    info="Reads the story cards from the adventure you have open in AI Dungeon and adds them to the selected adventure (a new one is created if none is selected). Only name, type, and triggers are imported; cards that already exist by name are skipped."
  >
    <div class="flex flex-col gap-3 bg-theme-neutral-100 rounded-xl p-3">
      {#if detected.cards.length === 0}
        <div class="flex flex-col items-center justify-center py-10 text-theme-neutral-700 gap-2">
          <span class="font-symbol text-5xl">download</span>
          <span class="text-sm font-bold">No story cards detected</span>
          <span class="text-xs text-center max-w-xs">
            Open an adventure in AI Dungeon (or refresh it) and its story cards will show up here, ready to import.
          </span>
        </div>
      {:else}
        <!-- Source + target -->
        <div class="flex flex-col gap-1 text-sm">
          <div class="text-theme-neutral-800">
            From <span class="font-bold">{detected.title ?? "current adventure"}</span>
            <span class="text-theme-neutral-700">
              ({detected.cards.length} card{detected.cards.length !== 1 ? "s" : ""})
            </span>
          </div>
          {#if createScenario || !target}
            <div class="text-theme-neutral-700 text-xs">
              Into a new adventure <span class="font-bold text-theme-neutral-800">{newAdventureName}</span>
            </div>
          {:else}
            <div class="text-theme-neutral-800">Into <span class="font-bold">{target.name}</span></div>
          {/if}
        </div>

        <!-- Create-new-adventure toggle: keeps an import from landing in a previously-selected set -->
        <button
          onclick={() => (createScenario = !createScenario)}
          class="flex items-start gap-2 p-2 rounded-lg text-left transition-colors {createScenario
            ? 'bg-theme-neutral-300'
            : 'bg-theme-neutral-200 hover:bg-theme-neutral-300'}"
        >
          <span class="font-symbol text-lg mt-0.5 {createScenario ? 'text-pretty-theme' : 'text-theme-neutral-700'}">
            {createScenario ? "check_box" : "check_box_outline_blank"}
          </span>
          <span class="flex flex-col">
            <span class="text-sm text-theme-neutral-800">Create new adventure</span>
            <span class="text-xs text-theme-neutral-700">
              Recommended. Imports into a fresh adventure linked to this AI Dungeon adventure, instead of the one
              currently selected.
            </span>
          </span>
        </button>

        <!-- Type filter -->
        <div class="flex items-center justify-between">
          <span class="text-xs uppercase font-bold text-theme-neutral-800">Card types</span>
          <div class="flex gap-2 text-xs">
            <button class="text-pretty-theme hover:underline" onclick={() => setAll(true)}>All</button>
            <button class="text-theme-neutral-700 hover:underline" onclick={() => setAll(false)}>None</button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          {#each groups as group (group.type)}
            {@const checked = selectedTypes.has(group.type)}
            <button
              onclick={() => toggleType(group.type)}
              class="flex items-center gap-2 p-2 rounded-lg text-sm transition-colors {checked
                ? 'bg-theme-neutral-300'
                : 'bg-theme-neutral-200 hover:bg-theme-neutral-300'}"
            >
              <span class="font-symbol text-lg {checked ? 'text-pretty-theme' : 'text-theme-neutral-700'}">
                {checked ? "check_box" : "check_box_outline_blank"}
              </span>
              <span class="capitalize text-theme-neutral-800">{group.type}</span>
              <span class="ml-auto text-xs text-theme-neutral-700">{group.cards.length}</span>
            </button>
          {/each}
        </div>

        <!-- Action -->
        <button
          onclick={doImport}
          disabled={selectedCards.length === 0}
          class="mt-1 px-3 py-2 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 disabled:opacity-40 transition-all text-sm font-bold"
        >
          Import {selectedCards.length} card{selectedCards.length !== 1 ? "s" : ""}
        </button>

        {#if result}
          <div class="text-xs text-theme-neutral-800 px-1">
            Imported <span class="font-bold text-pretty-theme">{result.imported}</span> into
            <span class="font-bold">{result.adventureName}</span>{#if result.skipped > 0}, skipped
              <span class="font-bold">{result.skipped}</span> already present{/if}.
          </div>
        {/if}
      {/if}
    </div>
  </Field>
</div>
