<script lang="ts">
  import Field from "@/ui/components/field.svelte";
  import { aidDetected } from "@/aid/bridge";
  import { playedAdventureId, playedScenarioId, playedShortId } from "@/aid/adventure";
  import { Storage } from "@/storage";
  import type { Adventure } from "@/shared/types";
  import { EMPTY_STATS, type AidCard, type AidDetected } from "@/aid/protocol";

  // Story cards passively detected from the open AI Dungeon adventure (via the page interceptor).
  let detected = $state<AidDetected>({ shortId: null, scenarioId: null, title: null, cards: [], stats: EMPTY_STATS });
  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);
  let selectedTypes = $state<Set<string>>(new Set());
  let result = $state<{ imported: number; updated: number; skipped: number; adventureName: string } | null>(null);
  // AI Dungeon adventure currently in the URL (reactive), used for the match check and binding.
  let playedId = $state<string | null>(null);
  playedAdventureId.subscribe((v) => (playedId = v));
  // The scenario the open adventure was started from, once the page tap has read it.
  let scenarioId = $state<string | null>(null);
  playedScenarioId.subscribe((v) => (scenarioId = v));
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
  const importedShortId = $derived(playedId ?? detected.shortId);
  // True when the currently selected adventure is already the one bound to that adventure, by its
  // id or by the scenario it came from (a duplicate of an adventure imported before).
  const targetMatches = $derived(
    (!!target?.aidShortId && !!importedShortId && target.aidShortId === importedShortId) ||
      (!!target?.aidScenarioId && !!scenarioId && target.aidScenarioId === scenarioId)
  );

  // Default the "Create new adventure" toggle: create a fresh one UNLESS the selected adventure is
  // already the match for what's being imported (then merging into it is the whole point, so leave
  // it unchecked). Recomputed when that context changes; a manual toggle sticks until then.
  let scenarioKey = "";
  $effect(() => {
    const key = `${target?.id ?? ""}|${target?.aidShortId ?? ""}|${target?.aidScenarioId ?? ""}|${importedShortId ?? ""}|${scenarioId ?? ""}`;
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

  // Passive capture only sees what AI Dungeon fetches over the network, so a cached adventure switch
  // can leave the last capture pointing at a different adventure than the one now on screen. Gate on
  // the URL id so we never show (or import) another adventure's cards. Read the URL fresh (with
  // playedId as the reactive trigger) so a normal switch converges the moment the capture lands,
  // instead of briefly hiding valid cards while the 1s poll catches up.
  const detectedMatchesPlayed = $derived.by(() => {
    void playedId; // recompute when the URL poll changes (covers a cached switch with no new capture)
    const url = playedShortId();
    return !url || !detected.shortId || detected.shortId === url;
  });

  // Explain, in plain language, what the toggle will do and why it defaulted the way it did.
  const checkboxHint = $derived.by(() => {
    const targetName = target?.name ?? "the selected adventure";
    if (createScenario) {
      if (!target)
        return scenarioId
          ? `A new adventure "${newAdventureName}" will be created and linked to this AI Dungeon adventure and its scenario, so it also loads for duplicates and restarts.`
          : `A new adventure "${newAdventureName}" will be created and linked to this AI Dungeon adventure.`;
      if (targetMatches) return `"${targetName}" already matches this adventure, but a separate new one will be created.`;
      return `The selected "${targetName}" is a different adventure, so a new one is created and linked, keeping cards out of the wrong one.`;
    }
    if (targetMatches) return `"${targetName}" is already linked to this adventure, so cards will merge into it.`;
    if (target) return `Cards will merge into the selected "${targetName}", which is not linked to this AI Dungeon adventure.`;
    return `No adventure is selected, so a new one will be created anyway.`;
  });

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
    // named after the AI Dungeon adventure and bind it to that adventure's shortId and, when known,
    // to its scenario, so it auto-loads on play (and on every duplicate or restart of the scenario)
    // and the import never lands in a previously-selected (wrong) adventure. Otherwise merge into
    // the selected adventure, leaving its existing links untouched.
    let adventure;
    if (createScenario || !target) {
      adventure = Storage.createAdventure(newAdventureName);
      Storage.selectAdventure(adventure.id);
      if (importedShortId) Storage.setAidShortId(adventure.id, importedShortId);
      if (scenarioId) Storage.setAidScenarioId(adventure.id, scenarioId);
    } else {
      adventure = target;
    }

    const res = Storage.importStoryCards(
      adventure.id,
      selectedCards.map((c) => ({ id: c.id, name: c.name, type: c.type, triggers: c.triggers }))
    );
    result = { ...res, adventureName: adventure.name };
  }
</script>

<div class="flex flex-col gap-4">
  <Field
    label="Import from AI Dungeon"
    info="Reads the story cards from the adventure you have open in AI Dungeon and adds them to the selected adventure (a new one is created if none is selected). Only name, type, and triggers are imported. Cards you already have are updated in place rather than duplicated, so importing again keeps their triggers current while your icons, portraits and audio stay as they are."
  >
    <div class="flex flex-col gap-3 bg-theme-neutral-100 rounded-xl p-3">
      {#if detected.cards.length === 0 || !detectedMatchesPlayed}
        <div class="flex flex-col items-center justify-center py-10 text-theme-neutral-700 gap-2">
          <span class="font-symbol text-5xl">{detectedMatchesPlayed ? "download" : "sync_problem"}</span>
          {#if !detectedMatchesPlayed}
            <span class="text-sm font-bold">Cards are for a different adventure</span>
            <span class="text-xs text-center max-w-xs">
              The detected cards belong to another adventure (AI Dungeon likely loaded this one from cache). Reload the
              page to detect the adventure you're playing now.
            </span>
          {:else}
            <span class="text-sm font-bold">No story cards detected</span>
            <span class="text-xs text-center max-w-xs">
              Cards are read from AI Dungeon's own traffic as it loads them, so open your story cards in AI Dungeon
              once, or refresh the adventure, and they will show up here ready to import.
            </span>
          {/if}
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
            <span class="text-xs text-theme-neutral-700">{checkboxHint}</span>
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
            <span class="font-bold">{result.adventureName}</span>{#if result.updated > 0}, updated
              <span class="font-bold">{result.updated}</span>{/if}{#if result.skipped > 0},
              <span class="font-bold">{result.skipped}</span> already up to date{/if}.
          </div>
        {/if}
      {/if}
    </div>
  </Field>
</div>
