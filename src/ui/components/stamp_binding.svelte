<script lang="ts">
  import { Storage } from "@/storage";
  import type { Adventure } from "@/shared/types";
  import { playedAdventureId, playedScenarioId } from "@/aid/adventure";

  // How the selected card set is bound to what is being played, and the buttons to change that.
  // Shown on the Adventure tab and in the floating button's Stamp popover, so the two never drift.
  //
  // A scenario stamp makes the set load for every adventure started or duplicated from that
  // scenario, which is what most people want; an adventure stamp pins it to one adventure and takes
  // precedence, for the odd adventure that needs its own set.

  type Props = {
    // Popover use: no set selected is a state to explain rather than render nothing for.
    standalone?: boolean;
  };

  let { standalone = false }: Props = $props();

  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);
  // The AI Dungeon adventure in the URL, and the scenario it came from once the page tap read it.
  let playedId = $state<string | null>(null);
  let scenarioId = $state<string | null>(null);

  Storage.adventures.subscribe((a) => (adventures = a));
  Storage.selectedAdventureId.subscribe((id) => (selectedId = id));
  playedAdventureId.subscribe((v) => (playedId = v));
  playedScenarioId.subscribe((v) => (scenarioId = v));

  const selected = $derived(selectedId ? (adventures[selectedId] ?? null) : null);

  const stampedScenario = $derived(!!selected?.aidScenarioId);
  const stampedAdventure = $derived(!!selected?.aidShortId);
  const stamped = $derived(stampedScenario || stampedAdventure);
  // Whether the stamps point at what is open right now, so a set bound to some other story is not
  // described as loading for this one.
  const stampMatchesOpen = $derived(
    (stampedAdventure && selected?.aidShortId === playedId) ||
      (stampedScenario && !!scenarioId && selected?.aidScenarioId === scenarioId)
  );
  const stampSummary = $derived(
    stampedScenario && stampedAdventure
      ? "Auto-loads for every adventure of its scenario, and for one adventure by id"
      : stampedScenario
        ? "Auto-loads for every adventure started from its scenario"
        : "Auto-loads for one AI Dungeon adventure"
  );

  function stampScenarioId() {
    if (!selected || !scenarioId) return;
    Storage.setAidScenarioId(selected.id, scenarioId);
  }

  function stampAdventureId() {
    if (!selected || !playedId) return;
    Storage.setAidShortId(selected.id, playedId);
  }

  function unbind() {
    if (!selected) return;
    Storage.setAidShortId(selected.id, null);
    Storage.setAidScenarioId(selected.id, null);
  }
</script>

{#if !selected}
  {#if standalone}
    <div class="flex items-center gap-2 px-3 py-2 bg-theme-neutral-200 rounded-lg text-xs text-theme-neutral-700">
      <span class="font-symbol text-base">info</span>
      <span>No card set selected. Pick one under Sets first.</span>
    </div>
  {/if}
{:else}
  <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-theme-neutral-200 rounded-lg">
    {#if standalone}
      <span class="w-full text-xs font-bold text-theme-neutral-900 truncate">{selected.name}</span>
    {/if}
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
          title={playedId ? "Auto-load this set for this one AI Dungeon adventure only" : "Open the adventure in AI Dungeon first"}
          class="text-xs px-2 py-1.5 bg-theme-neutral-300 text-theme-neutral-900 rounded-md hover:bg-theme-neutral-400 disabled:opacity-40 transition-all"
        >
          This adventure only
        </button>
      </span>
    {/if}
  </div>
{/if}
