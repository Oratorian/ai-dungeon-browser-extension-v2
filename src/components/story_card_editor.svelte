<script lang="ts">
  import { Dialog } from "bits-ui";
  import { Storage } from "@/utils/storage";
  import { AudioManager } from "@/utils/audio_manager";
  import type { Adventure, StoryCard } from "@/utils/types";
  import Field from "./field.svelte";
  import Item from "./item.svelte";
  import Row from "./row.svelte";
  import ImageLibrary from "./image_library.svelte";
  import Switch from "./switch.svelte";
  import Select from "./select.svelte";
  import Color from "./color.svelte";
  import AudioSelect from "./audio_select.svelte";
  import { onDestroy } from "svelte";

  let isOpen = $state(false);
  let adventureId = $state<string | null>(null);
  let storyCardId = $state<string | null>(null);
  let storyCard = $state<StoryCard | null>(null);

  let name = $state("");
  let triggers = $state("");
  let type = $state("character");
  let icons = $state<string[]>([]);
  let graphics = $state<string[]>([]);
  let colorSelection = $state<string>("");
  let color = $state<string>("#f8ae2c");
  let limit = $state<string>("none");
  let preset = $state<string>("default");
  let audioClips = $state<string[]>([]);

  const storyCardTypes = [
    { value: "character", label: "Character", icon: "sentiment_excited" },
    { value: "location", label: "Location", icon: "explore" },
    { value: "race", label: "Race", icon: "skull" },
    { value: "item", label: "Item", icon: "apparel" },
    { value: "faction", label: "Faction", icon: "sword_rose" },
    { value: "event", label: "Event", icon: "domino_mask" },
  ];

  function ensureArray(value: unknown): string[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  Storage.editingStoryCard.subscribe((editing) => {
    if (editing) {
      adventureId = editing.adventureId;
      storyCardId = editing.storyCardId;
      const card = Storage.getStoryCard(editing.adventureId, editing.storyCardId);
      if (card) {
        storyCard = card;
        name = card.name;
        triggers = card.triggers;
        type = card.type || "character";
        icons = ensureArray(card.icons);
        graphics = ensureArray(card.graphics);
        colorSelection = card.useCustomColor ? "custom" : "global";
        color = card.color;
        limit = card.limit;
        preset = card.preset;
        audioClips = AudioManager.validateClipIds(ensureArray(card.audioClips));
        isOpen = true;
      }
    } else {
      isOpen = false;
      adventureId = null;
      storyCardId = null;
      storyCard = null;
    }
  });

  Storage.adventures.subscribe((adventures) => {
    if (adventureId && storyCardId) {
      const adventure = adventures[adventureId];
      if (adventure && adventure.storyCards[storyCardId]) {
        storyCard = adventure.storyCards[storyCardId];
      }
    }
  });

  // Stop audio when editor closes
  onDestroy(() => {
    AudioManager.stop();
  });

  function handleClose() {
    AudioManager.stop();
    Storage.closeStoryCardEditor();
  }

  function handleSave() {
    if (!adventureId || !storyCardId) return;

    Storage.updateStoryCard(adventureId, storyCardId, {
      name: name.trim() || "Untitled Card",
      triggers: triggers || "",
      type,
      icons,
      graphics,
      iconIndex: icons.length > 0 ? Math.min(storyCard?.iconIndex ?? 0, icons.length - 1) : 0,
      graphicIndex: graphics.length > 0 ? Math.min(storyCard?.graphicIndex ?? 0, graphics.length - 1) : 0,
      useCustomColor: colorSelection === "custom" ? true : false,
      color: color || "#f8ae2c",
      limit: limit,
      preset: preset,
      audioClips: audioClips,
    });

    handleClose();
  }

  function handleDelete() {
    if (!adventureId || !storyCardId) return;
    Storage.deleteStoryCard(adventureId, storyCardId);
    handleClose();
  }

  function handleIconsChange(newIcons: string[]) {
    icons = newIcons;
  }

  function handleGraphicsChange(newGraphics: string[]) {
    graphics = newGraphics;
  }

  function handleAudioChange(newAudioClips: string[]) {
    audioClips = newAudioClips;
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      handleClose();
    }
  }

  const currentTypeIcon = $derived(storyCardTypes.find((t) => t.value === type)?.icon ?? "help");
  const hasGraphic = $derived(graphics.length > 0);
  const previewGraphic = $derived(hasGraphic ? graphics[0] : null);
</script>

<Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 bg-black/60 z-50 animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <Dialog.Content
      trapFocus={false}
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[85vh] overflow-y-auto bg-theme-neutral-200 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4"
    >
      <div
        class="relative h-32 bg-cover bg-center rounded-t-2xl overflow-hidden"
        style={previewGraphic ? `background-image: url(${previewGraphic})` : ""}
      >
        {#if !previewGraphic}
          <div class="absolute inset-0 bg-linear-to-br from-pretty-theme/30 to-pretty-purple/30"></div>
        {/if}
        <div class="absolute inset-0 bg-linear-to-t from-theme-neutral-200 to-transparent"></div>

        <div class="absolute top-4 right-4 flex gap-2">
          <button onclick={handleDelete} class="p-2 rounded-lg transition-colors" title="Delete story card">
            <span
              class="aspect-square font-symbol text-2xl text-shadow-lg transition hover:text-pretty-red opacity-50 hover:opacity-100"
              >delete
            </span>
          </button>
          <button onclick={handleClose} class="p-2 rounded-lg transition-colors">
            <span class="font-symbol text-2xl transition text-shadow-lg opacity-50 hover:opacity-100">close</span>
          </button>
        </div>

        <div class="absolute bottom-4 left-6 flex items-center gap-3">
          <div class="size-12 rounded-xl bg-pretty-theme/20 flex items-center justify-center border-2 border-pretty-theme">
            <span class="font-symbol text-2xl text-pretty-theme">{currentTypeIcon}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-theme-neutral-900 uppercase">{type}</span>
            <span class="text-lg font-bold truncate max-w-48">{name || "Untitled Card"}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 p-6">
        <Item foldout icon="cadence" label="SFX">
          <Field label="Audio Clips" info="Sound effects that play when this card is focused.">
            <AudioSelect selectedIds={audioClips} onchange={handleAudioChange} maxSelections={4} />
          </Field>
        </Item>

        <Item foldout expanded icon="edit" label="Basics">
          <Field label="Name">
            <input
              type="text"
              bind:value={name}
              placeholder="Enter a name..."
              class="w-full h-11 px-4 bg-theme-neutral-100 rounded-xl outline-none"
            />
          </Field>

          <Field label="Triggers">
            <input
              type="text"
              bind:value={triggers}
              placeholder="Enter some triggers..."
              class="w-full h-11 px-4 bg-theme-neutral-100 rounded-xl outline-none"
            />
          </Field>

          <Field label="Type">
            <div class="grid grid-cols-3 gap-2">
              {#each storyCardTypes as cardType (cardType.value)}
                <button
                  onclick={() => (type = cardType.value)}
                  class="flex flex-col items-center gap-1 p-3 rounded-xl transition-colors {type === cardType.value
                    ? 'bg-pretty-theme/20 text-pretty-theme'
                    : 'bg-theme-neutral-300 hover:bg-theme-neutral-400'}"
                >
                  <span class="font-symbol text-xl">{cardType.icon}</span>
                  <span class="text-xs">{cardType.label}</span>
                </button>
              {/each}
            </div>
          </Field>
        </Item>

        <Item foldout icon="text_fields" label="Text">
          <Row>
            <Field label="Limit To">
              <Select
                bind:value={limit}
                type="single"
                icon="disabled_visible"
                items={[
                  { value: "none", label: "None" },
                  { value: "story_only", label: "Story" },
                  { value: "action_only", label: "Action" },
                ]}
              />
            </Field>

            <Field label="Color Mode">
              <Select
                type="single"
                bind:value={colorSelection}
                icon="colorize"
                items={[
                  { value: "global", label: "Global" },
                  { value: "custom", label: "Custom" },
                ]}
              />
            </Field>
          </Row>

          {#if colorSelection === "custom"}
            <Field label="Color">
              <Color bind:value={color} />
            </Field>
          {/if}
        </Item>

        <Item foldout icon="image" label="Media">
          <Field label="Icons" info="Small images shown inline in the story text.">
            <ImageLibrary images={icons} onchange={handleIconsChange} label="Icon" maxImages={6} />
          </Field>

          <Field label="Graphics" info="Large images shown in the focus view.">
            <ImageLibrary images={graphics} onchange={handleGraphicsChange} label="Graphic" maxImages={4} />
          </Field>
        </Item>

        <div class="flex gap-2 justify-end pt-2">
          <button onclick={handleClose} class="px-4 py-2 rounded-lg hover:bg-theme-neutral-300 transition-colors">
            Cancel
          </button>
          <button
            onclick={handleSave}
            class="px-4 py-2 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
