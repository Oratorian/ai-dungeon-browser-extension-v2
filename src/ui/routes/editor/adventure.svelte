<script lang="ts">
  import Card from "@/ui/components/card.svelte";
  import Grid from "@/ui/components/grid.svelte";
  import AdventurePicker from "@/ui/components/adventure_picker.svelte";
  import StoryCardEditor from "@/ui/components/story_card_editor.svelte";
  import { Storage } from "@/storage";
  import type { Adventure, StoryCard } from "@/shared/types";
  import Field from "@/ui/components/field.svelte";
  import { playedAdventureId, playedScenarioId } from "@/aid/adventure";
  import { cardTypeMeta, cardTypeOrder } from "@/shared/card_types";
  import { slide } from "svelte/transition";

  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);
  // The AI Dungeon adventure currently in the URL (reactive, so the button tracks navigation). Used
  // to retro-link an older card set to the adventure being played (see aid/adventure.ts).
  let playedId = $state<string | null>(null);
  // The scenario that adventure was started from, once the page tap has read it (null until then).
  let scenarioId = $state<string | null>(null);

  Storage.adventures.subscribe((a) => (adventures = a));
  Storage.selectedAdventureId.subscribe((id) => (selectedId = id));
  playedAdventureId.subscribe((v) => (playedId = v));
  playedScenarioId.subscribe((v) => (scenarioId = v));

  const selectedAdventure = $derived(selectedId ? (adventures[selectedId] ?? null) : null);

  /* How the selected set is bound. A scenario stamp makes it load for every adventure started or
     duplicated from that scenario, which is what most people want; an adventure stamp pins it to
     one adventure and takes precedence, for the odd adventure that needs its own set. */
  const stampedScenario = $derived(!!selectedAdventure?.aidScenarioId);
  const stampedAdventure = $derived(!!selectedAdventure?.aidShortId);
  const stamped = $derived(stampedScenario || stampedAdventure);
  // Whether the stamps point at what is open right now, so a set bound to some other story is not
  // described as loading for this one.
  const stampMatchesOpen = $derived(
    (stampedAdventure && selectedAdventure?.aidShortId === playedId) ||
      (stampedScenario && !!scenarioId && selectedAdventure?.aidScenarioId === scenarioId)
  );
  const stampSummary = $derived(
    stampedScenario && stampedAdventure
      ? "Auto-loads for every adventure of its scenario, and for one adventure by id"
      : stampedScenario
        ? "Auto-loads for every adventure started from its scenario"
        : "Auto-loads for one AI Dungeon adventure"
  );
  const storyCards = $derived(selectedAdventure ? Object.values(selectedAdventure.storyCards) : []);

  /* Browsing state. A big card set is unusable as one flat list, so it is grouped by type, each
     group collapsible, with a search box and per-type filters over the top. */

  let query = $state("");
  // Empty means "no filter": every type shows. Reassigned rather than mutated, since Svelte does not
  // track mutations of a Set held in $state.
  let activeTypes = $state<Set<string>>(new Set());
  // Which groups are open. Everything starts closed so a large set opens as a short list of types
  // you can take in at once, rather than the wall of cards this replaced.
  let expanded = $state<Set<string>>(new Set());

  const needle = $derived(query.trim().toLowerCase());

  const matching = $derived(
    storyCards.filter((card) => {
      const type = card.type || "";
      if (activeTypes.size > 0 && !activeTypes.has(type)) return false;
      if (!needle) return true;
      // Triggers are searched too: they are what the card actually matches on in the story, and are
      // often what you remember when the card's name isn't.
      return card.name.toLowerCase().includes(needle) || card.triggers.toLowerCase().includes(needle);
    })
  );

  /** Every type present in the set, with its total, so a filtered-out type keeps its chip. */
  const typeCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const card of storyCards) {
      const type = card.type || "";
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([type, count]) => ({ type, count, meta: cardTypeMeta(type) }))
      .sort((a, b) => cardTypeOrder(a.type) - cardTypeOrder(b.type) || a.type.localeCompare(b.type));
  });

  const groups = $derived.by(() => {
    const map = new Map<string, StoryCard[]>();
    for (const card of matching) {
      const type = card.type || "";
      const cards = map.get(type);
      if (cards) cards.push(card);
      else map.set(type, [card]);
    }
    return [...map.entries()]
      .map(([type, cards]) => ({
        type,
        meta: cardTypeMeta(type),
        cards: cards.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => cardTypeOrder(a.type) - cardTypeOrder(b.type) || a.type.localeCompare(b.type));
  });

  // While searching every group opens: a hit hidden inside a collapsed group reads as no hit at all.
  // A lone group is always open too, since collapsing the only thing on screen serves no purpose.
  const isOpen = (type: string) => Boolean(needle) || groups.length === 1 || expanded.has(type);

  // Switching adventures starts fresh, so a type left open in one card set does not silently decide
  // how the next one opens.
  $effect(() => {
    selectedId;
    expanded = new Set();
  });

  function toggleGroup(type: string) {
    const next = new Set(expanded);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    expanded = next;
  }

  function setAllGroups(open: boolean) {
    expanded = open ? new Set(groups.map((g) => g.type)) : new Set();
  }

  function toggleType(type: string) {
    const next = new Set(activeTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    activeTypes = next;
  }

  function handleAddStoryCard() {
    if (!selectedId) return;
    const card = Storage.createStoryCard(selectedId, "New Story Card");
    if (card) {
      Storage.openStoryCardEditor(selectedId, card.id);
    }
  }

  function stampScenarioId() {
    if (!selectedAdventure || !scenarioId) return;
    Storage.setAidScenarioId(selectedAdventure.id, scenarioId);
  }

  function stampAdventureId() {
    if (!selectedAdventure || !playedId) return;
    Storage.setAidShortId(selectedAdventure.id, playedId);
  }

  function unbind() {
    if (!selectedAdventure) return;
    Storage.setAidShortId(selectedAdventure.id, null);
    Storage.setAidScenarioId(selectedAdventure.id, null);
  }
</script>

<div class="flex flex-col gap-4">
  <Field label="Adventure Picker">
    <AdventurePicker />
  </Field>

  {#if selectedAdventure}
    <!-- Auto-load link: bind this card set to the scenario (every adventure started from it) or to
         the one AI Dungeon adventure that is open. -->
    <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-theme-neutral-200 rounded-lg">
      {#if stamped}
        <span class="text-xs text-theme-neutral-800 flex items-center gap-1.5 min-w-0">
          <span class="font-symbol text-base {stampMatchesOpen || !playedId ? 'text-pretty-theme' : 'text-theme-neutral-600'}"
            >bolt</span
          >
          <span class="truncate">
            {stampSummary}{playedId && !stampMatchesOpen ? " (not the one open now)" : ""}
          </span>
        </span>
        <span class="flex items-center gap-3 shrink-0">
          {#if !stampedScenario && scenarioId}
            <button
              onclick={stampScenarioId}
              title="Also load this set for every adventure started or duplicated from the open adventure's scenario"
              class="text-xs text-pretty-theme hover:underline"
            >
              Also follow scenario
            </button>
          {/if}
          <button onclick={unbind} class="text-xs text-theme-neutral-700 hover:text-pretty-red">Unbind</button>
        </span>
      {:else}
        <span class="text-xs text-theme-neutral-700 min-w-0 truncate">Not linked to an AI Dungeon adventure</span>
        <span class="flex items-center gap-1.5 shrink-0">
          <button
            onclick={stampScenarioId}
            disabled={!scenarioId}
            title={scenarioId
              ? "Auto-load this set for every adventure started or duplicated from the open adventure's scenario"
              : playedId
                ? "AI Dungeon has not told us which scenario this adventure came from yet; reload the page or stamp the adventure instead"
                : "Open the adventure in AI Dungeon first"}
            class="text-xs px-2 py-1.5 bg-pretty-theme text-theme-neutral-0 rounded-md hover:opacity-90 disabled:opacity-40 transition-all"
          >
            Stamp Scenario
          </button>
          <button
            onclick={stampAdventureId}
            disabled={!playedId}
            title={playedId
              ? "Auto-load this set for this one AI Dungeon adventure only"
              : "Open the adventure in AI Dungeon first"}
            class="text-xs px-2 py-1.5 bg-theme-neutral-300 text-theme-neutral-900 rounded-md hover:bg-theme-neutral-400 disabled:opacity-40 transition-all"
          >
            This adventure only
          </button>
        </span>
      {/if}
    </div>

    <!-- Search + add -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1 min-w-0">
        <span
          class="font-symbol text-lg text-theme-neutral-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          search
        </span>
        <input
          type="text"
          bind:value={query}
          placeholder="Search name or triggers"
          class="bg-theme-neutral-100 w-full min-h-11 pl-10 pr-9 py-3 outline-0 rounded-xl text-sm"
        />
        {#if query}
          <button
            onclick={() => (query = "")}
            aria-label="Clear search"
            class="font-symbol text-lg text-theme-neutral-700 hover:text-theme-neutral-900 absolute right-2 top-1/2 -translate-y-1/2"
          >
            close
          </button>
        {/if}
      </div>

      <button
        onclick={handleAddStoryCard}
        title="Add a story card"
        class="flex items-center gap-1 px-3 min-h-11 bg-pretty-theme text-theme-neutral-0 rounded-xl hover:opacity-90 transition-all text-sm font-bold shrink-0"
      >
        <span class="font-symbol text-lg">add</span>
        Card
      </button>
    </div>

    <!-- Type filters. No selection means everything shows, so the default needs no explanation. -->
    {#if typeCounts.length > 1}
      <div class="flex flex-wrap gap-1.5">
        {#each typeCounts as entry (entry.type)}
          {@const on = activeTypes.has(entry.type)}
          <button
            onclick={() => toggleType(entry.type)}
            class="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-lg text-xs transition-colors {on
              ? 'bg-pretty-theme/20 text-pretty-theme'
              : 'bg-theme-neutral-200 text-theme-neutral-800 hover:bg-theme-neutral-300'}"
          >
            <span class="font-symbol text-base">{entry.meta.icon}</span>
            <span class="capitalize">{entry.meta.label}</span>
            <span class="{on ? 'text-pretty-theme/70' : 'text-theme-neutral-700'}">{entry.count}</span>
          </button>
        {/each}
        {#if activeTypes.size > 0}
          <button
            onclick={() => (activeTypes = new Set())}
            class="px-2.5 py-1.5 rounded-lg text-xs text-theme-neutral-700 hover:text-theme-neutral-900"
          >
            Clear
          </button>
        {/if}
      </div>
    {/if}

    <div class="flex items-center justify-between px-2">
      <span class="text-sm text-theme-neutral-700">
        {#if matching.length === storyCards.length}
          {storyCards.length} story card{storyCards.length !== 1 ? "s" : ""}
        {:else}
          {matching.length} of {storyCards.length} story cards
        {/if}
      </span>

      <!-- Hidden while searching, when every group is force-opened and these would do nothing. -->
      {#if groups.length > 1 && !needle}
        <div class="flex gap-2 text-xs">
          <button class="text-pretty-theme hover:underline" onclick={() => setAllGroups(true)}>Expand all</button>
          <button class="text-theme-neutral-700 hover:underline" onclick={() => setAllGroups(false)}>Collapse all</button>
        </div>
      {/if}
    </div>

    {#if groups.length === 0}
      <div class="flex flex-col items-center justify-center py-10 text-theme-neutral-700 gap-2">
        <span class="font-symbol text-5xl">{storyCards.length === 0 ? "note_stack_add" : "search_off"}</span>
        <span class="text-sm font-bold">
          {storyCards.length === 0 ? "No story cards yet" : "Nothing matches"}
        </span>
        <span class="text-xs text-center max-w-xs">
          {storyCards.length === 0
            ? "Add a card, or bring your existing ones over from the Import tab."
            : "Try a different search, or clear the type filters."}
        </span>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each groups as group (group.type)}
          {@const open = isOpen(group.type)}
          <div class="flex flex-col bg-theme-neutral-200 rounded-xl overflow-hidden">
            <button
              onclick={() => toggleGroup(group.type)}
              class="flex items-center gap-2 p-3 w-full hover:bg-theme-neutral-300 transition-colors"
            >
              <span class="font-symbol text-xl text-theme-neutral-800">{group.meta.icon}</span>
              <span class="font-bold text-sm capitalize">{group.meta.label}</span>
              <span class="text-sm text-theme-neutral-700">{group.cards.length}</span>
              <span
                class="font-symbol text-xl text-theme-neutral-800 ml-auto transition-transform {open
                  ? 'rotate-180'
                  : ''}"
              >
                expand_more
              </span>
            </button>

            {#if open}
              <div transition:slide={{ duration: 200 }} class="p-2 pt-0">
                <Grid>
                  {#each group.cards as card (card.id)}
                    <Card storyCard={card} adventureId={selectedAdventure.id} />
                  {/each}
                </Grid>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Story Card Editor Dialog -->
<StoryCardEditor />
