<script lang="ts">
  import Card from "@/components/card.svelte";
  import Grid from "@/components/grid.svelte";
  import AdventurePicker from "@/components/adventure_picker.svelte";
  import StoryCardEditor from "@/components/story_card_editor.svelte";
  import { Storage } from "@/utils/storage";
  import type { Adventure, StoryCard } from "@/utils/types";
  import Field from "@/components/field.svelte";

  let selectedAdventure = $state<Adventure | null>(null);

  Storage.selectedAdventureId.subscribe((id) => {
    if (id) {
      const unsub = Storage.adventures.subscribe((adventures) => {
        selectedAdventure = adventures[id] ?? null;
      });
    } else {
      selectedAdventure = null;
    }
  });

  Storage.adventures.subscribe((adventures) => {
    const id = selectedAdventure?.id;
    if (id && adventures[id]) {
      selectedAdventure = adventures[id];
    }
  });

  const storyCards = $derived(selectedAdventure ? Object.values(selectedAdventure.storyCards) : []);

  function handleAddStoryCard() {
    if (!selectedAdventure) return;
    const card = Storage.createStoryCard(selectedAdventure.id, "New Story Card");
    if (card) {
      Storage.openStoryCardEditor(selectedAdventure.id, card.id);
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Field label="Adventure Picker">
    <AdventurePicker />
  </Field>

  {#if selectedAdventure}
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
</div>

<!-- Story Card Editor Dialog -->
<StoryCardEditor />
