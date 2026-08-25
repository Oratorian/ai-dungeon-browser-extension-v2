<script lang="ts">
  import Card from "@/ui/components/card.svelte";
  import Grid from "@/ui/components/grid.svelte";
  import AdventurePicker from "@/ui/components/adventure_picker.svelte";
  import StoryCardEditor from "@/ui/components/story_card_editor.svelte";
  import { Storage } from "@/storage";
  import type { Adventure } from "@/shared/types";
  import Field from "@/ui/components/field.svelte";
  import { playedAdventureId } from "@/aid/adventure";
  import { versionInfo, checkForUpdate, RELEASES_URL, type VersionInfo } from "@/shared/version";
  import { get } from "svelte/store";

  let adventures = $state<Record<string, Adventure>>({});
  let selectedId = $state<string | null>(null);
  // The AI Dungeon adventure currently in the URL (reactive, so the button tracks navigation). Used
  // to retro-link an older card set to the adventure being played (see aid/adventure.ts).
  let playedId = $state<string | null>(null);
  // Installed version + whether GitHub has a newer release (see shared/version.ts).
  let vinfo = $state<VersionInfo>({ current: "", latest: null, updateAvailable: false });

  Storage.adventures.subscribe((a) => (adventures = a));
  Storage.selectedAdventureId.subscribe((id) => (selectedId = id));
  playedAdventureId.subscribe((v) => (playedId = v));
  versionInfo.subscribe((v) => (vinfo = v));
  checkForUpdate();

  const year = new Date().getFullYear();

  const selectedAdventure = $derived(selectedId ? (adventures[selectedId] ?? null) : null);
  const storyCards = $derived(selectedAdventure ? Object.values(selectedAdventure.storyCards) : []);

  function handleAddStoryCard() {
    if (!selectedId) return;
    const card = Storage.createStoryCard(selectedId, "New Story Card");
    if (card) {
      Storage.openStoryCardEditor(selectedId, card.id);
    }
  }

  function stampAdventureId() {
    if (!selectedAdventure || !playedId) return;
    Storage.setAidShortId(selectedAdventure.id, playedId);
  }

  function unbindAdventureId() {
    if (!selectedAdventure) return;
    Storage.setAidShortId(selectedAdventure.id, null);
  }
</script>

<div class="flex flex-col gap-4">
  <Field label="Adventure Picker">
    <AdventurePicker />
  </Field>

  {#if selectedAdventure}
    <!-- Auto-load link: bind this card set to the AI Dungeon adventure it belongs to. -->
    <div class="flex items-center justify-between gap-2 px-3 py-2 bg-theme-neutral-200 rounded-lg">
      {#if selectedAdventure.aidShortId}
        <span class="text-xs text-theme-neutral-800 flex items-center gap-1.5 min-w-0">
          <span class="font-symbol text-base text-pretty-theme">bolt</span>
          <span class="truncate">Auto-loads when you play this AI Dungeon adventure</span>
        </span>
        <button onclick={unbindAdventureId} class="text-xs text-theme-neutral-700 hover:text-pretty-red shrink-0">
          Unbind
        </button>
      {:else}
        <span class="text-xs text-theme-neutral-700 min-w-0 truncate">Not linked to an AI Dungeon adventure</span>
        <button
          onclick={stampAdventureId}
          disabled={!playedId}
          title={playedId ? "" : "Open the adventure in AI Dungeon first"}
          class="text-xs px-2 py-1.5 bg-pretty-theme text-theme-neutral-0 rounded-md hover:opacity-90 disabled:opacity-40 transition-all shrink-0"
        >
          Stamp Adventure-ID for autoload
        </button>
      {/if}
    </div>

    <div class="flex items-center justify-between px-2">
      <span class="text-sm text-theme-neutral-700">
        {storyCards.length} story card{storyCards.length !== 1 ? "s" : ""}
      </span>
    </div>

    <Grid>
      <Card placeholder={true} onclick={handleAddStoryCard} />
      {#each storyCards as card (card.id)}
        <Card storyCard={card} adventureId={selectedAdventure.id} />
      {/each}
    </Grid>
  {:else}
    <!-- 
    <div class="flex flex-col items-center justify-center py-16 text-theme-neutral-700">
      <span class="font-symbol text-6xl mb-4">explore</span>
      <span class="text-lg font-bold mb-2">No Adventure Selected</span>
      <span class="text-sm text-center max-w-xs">
        Select an existing adventure or create a new one to start adding story cards.
      </span>
    </div>-->
  {/if}

  <!-- Footer: installed version + copyright, with a green update badge when GitHub has a newer one. -->
  <div class="flex flex-col items-center gap-1 pt-6 pb-1 text-theme-neutral-700">
    {#if vinfo.updateAvailable}
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-pretty-green/15 text-pretty-green text-xs font-bold hover:bg-pretty-green/25 transition-colors"
      >
        <span class="font-symbol text-sm">arrow_circle_up</span>
        New version available{vinfo.latest ? ` (v${vinfo.latest})` : ""}
      </a>
    {/if}
    <span class="text-xs text-theme-neutral-800">Dungeon Extension v2 &middot; v{vinfo.current}</span>
    <span class="text-[10px]">&copy; {year} Oratorian</span>
  </div>
</div>

<!-- Story Card Editor Dialog -->
<StoryCardEditor />
