<script lang="ts">
  import Card from "@/ui/components/card.svelte";
  import SettingsCard from "@/ui/components/settings_card.svelte";
  import { setContext } from "svelte";
  setContext("settings-inline-help", true);
  import AdventurePicker from "@/ui/components/adventure_picker.svelte";
  import StoryCardEditor from "@/ui/components/story_card_editor.svelte";
  import { Storage } from "@/storage";
  import type { Adventure, StoryCard } from "@/shared/types";
  import Field from "@/ui/components/field.svelte";
  import StampBinding from "@/ui/components/stamp_binding.svelte";
  import { cardTypeMeta, cardTypeOrder } from "@/shared/card_types";
  import { slide } from "svelte/transition";

  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);
  Storage.adventures.subscribe((a) => (adventures = a));
  Storage.selectedAdventureId.subscribe((id) => (selectedId = id));
  const selectedAdventure = $derived(selectedId ? (adventures[selectedId] ?? null) : null);

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

</script>

<header class="page-heading"><div class="heading-copy"><span class="text-pretty-theme text-xs font-bold uppercase tracking-widest">Your collection</span><h1>Story cards</h1><p class="text-theme-neutral-800">Bring your cast and places to life with pictures, highlights and sounds.</p></div>
  {#if selectedAdventure}
  <div class="heading-controls">
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
          aria-label="Search story cards"
          placeholder="Search names or matching words"
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
        Add card
      </button>
    </div>

    <!-- Type filters. No selection means everything shows, so the default needs no explanation. -->
    {#if typeCounts.length > 1}
      <div class="flex flex-wrap gap-1.5">
        {#each typeCounts as entry (entry.type)}
          {@const on = activeTypes.has(entry.type)}
          <button
            aria-pressed={on}
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

  </div>
  {/if}
</header>
<div class="cards-workspace">
  <aside class="collection-sidebar">
  <SettingsCard icon="collections_bookmark" label="Card set" description="Choose the collection you want to work on. Each set keeps its own cards and pictures.">
  <Field label="Selected set">
    <AdventurePicker />
  </Field>

  </SettingsCard>
  {#if selectedAdventure}
    <SettingsCard icon="approval" label="Use in your story" description="Link this set to your adventure so the right cards are ready when you play."><StampBinding /></SettingsCard>
  {/if}
  <p class="text-sm text-theme-neutral-800 leading-relaxed">New here? Open Card sync to bring in names from AI Dungeon, then open a card to add its pictures and sounds.</p>
  </aside>
  <section class="collection-content" aria-label="Story card collection">
  {#if selectedAdventure}

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
            ? "Add a card, or bring your existing ones over from Card sync."
            : "Try a different search, or clear the type filters."}
        </span>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each groups as group (group.type)}
          {@const open = isOpen(group.type)}
          <div class="flex flex-col bg-theme-neutral-200 rounded-xl overflow-hidden">
            <button
              aria-expanded={open}
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
                <div class="card-grid">
                  {#each group.cards as card (card.id)}
                    <Card storyCard={card} adventureId={selectedAdventure.id} />
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <SettingsCard icon="style" label="Start your collection" description="Choose or create a card set on the left. You can also bring in cards from your open AI Dungeon story using Card sync."><p class="text-sm text-theme-neutral-800">Your card pictures and sounds stay in the extension, ready to use while you play.</p></SettingsCard>
  {/if}
  </section>
</div>

<!-- Story Card Editor Dialog -->
<StoryCardEditor />

<style>
  .page-heading { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.2fr); gap:32px; align-items:center; padding:8px 8px 24px; }
  .heading-copy { min-width:0; }
  .heading-controls { display:flex; flex-direction:column; gap:16px; min-width:0; }
  h1 { font-size:30px; font-weight:700; margin:6px 0; }
  .page-heading p { font-size:14px; line-height:1.6; }
  .cards-workspace { display:grid; grid-template-columns:300px minmax(0,1fr); gap:24px; align-items:start; }
  .collection-sidebar,.collection-content { display:flex; flex-direction:column; gap:20px; min-width:0; }
  .card-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
  @media(max-width:800px) { .cards-workspace,.page-heading { grid-template-columns:1fr; } .page-heading { gap:20px; } }
</style>
