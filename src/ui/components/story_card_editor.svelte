<script lang="ts">
  import { Dialog } from "bits-ui";
  import { STORY_CARD_TYPES } from "@/shared/card_types";
  import { Storage } from "@/storage";
  import { AudioManager } from "@/audio/manager";
  import type { Adventure, StoryCard } from "@/shared/types";
  import { graphicIds, readGraphicVariants, remapGraphicVariants, readIconGraphics, remapIconGraphics } from "@/shared/portrait_variants";
  import Field from "./field.svelte";
  import SettingsCard from "./settings_card.svelte";
  import Row from "./row.svelte";
  import ImageLibrary from "./image_library.svelte";
  import Switch from "./switch.svelte";
  import Select from "./select.svelte";
  import Color from "./color.svelte";
  import AudioSelect from "./audio_select.svelte";
  import { onDestroy, setContext, tick } from "svelte";
  setContext("settings-inline-help", true);

  let isOpen = $state(false);
  let adventureId = $state<string | null>(null);
  let storyCardId = $state<string | null>(null);
  let storyCard = $state<StoryCard | null>(null);

  let name = $state("");
  let triggers = $state("");
  let type = $state("character");
  let gender = $state("none");
  let icons = $state<string[]>([]);
  let iconIndex = $state(0);
  let iconGraphics = $state<(string | null)[]>([]);
  let editingIcon = $state<number | null>(null);
  let graphics = $state<string[]>([]);
  let graphicVariants = $state<NonNullable<StoryCard["graphicVariants"]>>([]);
  let graphicIndex = $state(0);
  let editingGraphic = $state<number | null>(null);
  const editingVariant = $derived(editingGraphic === null ? undefined : graphicVariants[editingGraphic]);
  let iconMenu = $state<HTMLDivElement>();
  let pictureNameInput = $state<HTMLInputElement>();
  let colorSelection = $state<string>("");
  let color = $state<string>("#f8ae2c");
  let limit = $state<string>("none");
  let preset = $state<string>("default");
  let audioClips = $state<string[]>([]);

  // Shared with the Adventure tab's grouping, see shared/card_types.ts.
  const storyCardTypes = STORY_CARD_TYPES;

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
        gender = card.gender ?? "none";
        icons = ensureArray(card.icons);
        iconIndex = card.iconIndex;
        graphics = ensureArray(card.graphics);
        graphicVariants = readGraphicVariants(card.graphicVariants, graphics.length);
        iconGraphics = readIconGraphics(card.iconGraphics, icons.length, graphics);
        editingIcon = null;
        graphicIndex = card.graphicIndex;
        editingGraphic = null;
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
      const card = adventure?.storyCards[storyCardId];
      if (card) {
        storyCard = card;
      }
    }
  });

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
      gender: gender === "male" || gender === "female" ? gender : "none",
      icons,
      iconGraphics,
      graphics,
      graphicVariants,
      iconIndex: icons.length > 0 ? Math.min(iconIndex, icons.length - 1) : 0,
      graphicIndex: graphics.length > 0 ? Math.min(graphicIndex, graphics.length - 1) : 0,
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
    const editingImage = editingIcon === null ? undefined : icons[editingIcon];
    const nextEditing = editingImage ? newIcons.indexOf(editingImage) : -1;
    editingIcon = nextEditing < 0 ? null : nextEditing;
    iconGraphics = remapIconGraphics(icons, newIcons, iconGraphics);
    iconIndex = Math.max(0, newIcons.indexOf(icons[iconIndex] ?? ""));
    icons = newIcons;
  }

  function handleGraphicsChange(newGraphics: string[]) {
    const editingImage = editingGraphic === null ? undefined : graphics[editingGraphic];
    const nextEditing = editingImage ? newGraphics.indexOf(editingImage) : -1;
    editingGraphic = nextEditing < 0 ? null : nextEditing;
    graphicVariants = remapGraphicVariants(graphics, newGraphics, graphicVariants);
    graphicIndex = Math.max(0, newGraphics.indexOf(graphics[graphicIndex] ?? ""));
    graphics = newGraphics;
    iconGraphics = readIconGraphics(iconGraphics, icons.length, graphics);
  }

  async function editAddedImage(kind: "icon" | "graphic", index: number) {
    const adventure = adventureId;
    const card = storyCardId;
    if (kind === "icon") editingIcon = index;
    else editingGraphic = index;
    // The menu and its input only exist after Svelte has rendered the new picture.
    await tick();
    if (!isOpen || adventureId !== adventure || storyCardId !== card ||
      (kind === "icon" ? editingIcon : editingGraphic) !== index) return;
    const control = kind === "icon" ? iconMenu?.querySelector<HTMLButtonElement>("[data-select-trigger]") : pictureNameInput;
    const menu = kind === "icon" ? iconMenu : pictureNameInput?.closest(".picture-rule");
    menu?.scrollIntoView({ block: "nearest", inline: "nearest" });
    control?.focus({ preventScroll: true });
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
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-[1160px] h-[90vh] flex flex-col overflow-hidden bg-theme-neutral-200 rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4"
    >
      <div
        class="relative h-32 shrink-0 bg-cover bg-center rounded-t-2xl overflow-hidden"
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
          <button aria-label="Close card editor" onclick={handleClose} class="p-2 rounded-lg transition-colors">
            <span class="font-symbol text-2xl transition text-shadow-lg opacity-50 hover:opacity-100">close</span>
          </button>
        </div>

        <div class="absolute bottom-4 left-6 flex items-center gap-3">
          <div class="size-12 rounded-xl bg-pretty-theme/20 flex items-center justify-center border-2 border-pretty-theme">
            <span class="font-symbol text-2xl text-pretty-theme">{currentTypeIcon}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-theme-neutral-900 uppercase">{type}</span>
            <Dialog.Title class="text-xl font-bold truncate max-w-[65vw]">{name || "Untitled Card"}</Dialog.Title>
          </div>
        </div>
      </div>

      <Dialog.Description class="px-6 py-3 text-sm text-theme-neutral-800 shrink-0">Choose how this card looks and sounds in your story. Click Save Changes when you are done.</Dialog.Description>
      <div class="card-edit-grid">
        <SettingsCard icon="edit" label="Basics" description="The name and words that connect this card to your story.">
          <Field label="Name">
            <input
              type="text"
              bind:value={name}
              placeholder="Enter a name..."
              class="w-full h-11 px-4 bg-theme-neutral-100 rounded-xl outline-none"
            />
          </Field>

          <Field label="Matching words" info="Separate names or nicknames with commas. When these words appear in your story, the extension can highlight them using this card.">
            <input
              type="text"
              bind:value={triggers}
              placeholder="Enter some triggers..."
              class="w-full h-11 px-4 bg-theme-neutral-100 rounded-xl outline-none"
            />
          </Field>

          <Field label="Gender" info="In Visual Novel Mode, this chooses the male or female character voice when Track Speakers is on. None uses the narrator instead.">
            <Select ariaLabel="Gender" allowDeselect={false} bind:value={gender}
              items={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "none", label: "None" }]} />
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
        </SettingsCard>
<SettingsCard icon="image" label="Media" description="Choose the pictures readers will see.">
          <Field label="Icons" info="Small images shown inline in the story text.">
            <ImageLibrary images={icons} onchange={handleIconsChange} label="Icon" maxImages={6}
              selectedIndex={editingIcon} onselect={index => editingIcon = editingIcon === index ? null : index}
              onadd={index => editAddedImage("icon", index)} />
            {#if icons.length > 0}<span class="text-xs text-theme-neutral-700">Click an icon to choose which picture it belongs to.</span>{/if}
          </Field>
          {#if editingIcon !== null && icons[editingIcon]}
            <Field label="Icon {(editingIcon ?? 0) + 1} picture" info="This icon appears when its picture is active. Any graphic keeps it available for every picture. If a picture has no matching icon, an icon set to Any graphic is used, or the picture itself.">
              {@const linkedGraphic = graphics.find((image, index) => graphicIds(graphics)[index] === iconGraphics[editingIcon ?? 0])}
              <div bind:this={iconMenu} class="flex flex-col gap-2">
                <Select ariaLabel="Graphic for icon" allowDeselect={false}
                  bind:value={() => iconGraphics[editingIcon ?? 0] ?? "__any", value => { if (editingIcon !== null) iconGraphics[editingIcon] = value === "__any" ? null : value ?? null; }}
                  items={[{ value: "__any", label: "Any graphic" }, ...graphics.map((image, index) => ({ value: graphicIds(graphics)[index]!, label: graphicVariants[index]?.name || `Picture ${index + 1}` }))]} />
                {#if linkedGraphic}<img class="linked-preview" src={linkedGraphic} alt="Linked graphic" />{/if}
              </div>
            </Field>
          {/if}

          <Field label="Graphics" info="Pictures used when you focus this card and in Visual Novel Mode. For location cards, these can become the scene background.">
            <ImageLibrary images={graphics} onchange={handleGraphicsChange} label="Graphic" maxImages={4}
              selectedIndex={editingGraphic} onselect={type.trim().toLowerCase() === "character" ? index => editingGraphic = editingGraphic === index ? null : index : undefined}
              onadd={type.trim().toLowerCase() === "character" ? index => editAddedImage("graphic", index) : undefined} />
            {#if type.trim().toLowerCase() === "character" && graphics.length > 0}
              <span class="text-xs text-theme-neutral-700">Click a picture to edit its switching settings.</span>
            {/if}
          </Field>
          {#if type.trim().toLowerCase() === "character" && editingVariant}
            <Field label="Picture switching" info="Matching phrases change the picture in VN and normal story mode when narration names this character. Spoken words do not change pictures. Separate phrases with commas. In VN you can also click the character's name to choose a picture manually.">
                  <div class="picture-rule">
                    <div>
                      <label>Picture {(editingGraphic ?? 0) + 1} name
                        <input bind:this={pictureNameInput} bind:value={editingVariant.name} placeholder="For example: Red uniform" />
                      </label>
                      <label>Matching phrases
                        <input bind:value={editingVariant.triggers} placeholder="red uniform, wearing armor" />
                      </label>
                    </div>
                  </div>
            </Field>
          {/if}
        </SettingsCard>
<SettingsCard icon="text_fields" label="Text" description="Decide where this card highlights text and which color it uses.">
          <Row>
            <Field label="Limit To">
              <Select
                bind:value={limit}
                icon="disabled_visible"
                items={[
                  { value: "none", label: "None" },
                  { value: "story_only", label: "Story" },
                  { value: "action_only", label: "Action" },
                  { value: "protagonist", label: "Protagonist" },
                ]}
              />
            </Field>

            <Field label="Color Mode">
              <Select
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
        </SettingsCard>
<SettingsCard icon="cadence" label="Sounds" description="Add sounds to play when you focus this card.">
          <Field label="Audio Clips" info="Sound effects that play when this card is focused.">
            <AudioSelect selectedIds={audioClips} onchange={handleAudioChange} maxSelections={4} />
          </Field>
        </SettingsCard>


      </div>
        <div class="flex gap-2 justify-end p-4 border-t border-theme-neutral-300 shrink-0">
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
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .linked-preview { width: 112px; height: 144px; object-fit: contain; border-radius: 12px; background: #0003; }
  .picture-rule { display: flex; align-items: center; gap: 12px; }
  .picture-rule > div { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 6px; }
  .picture-rule label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
  .picture-rule input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ffffff40; border-radius: 8px; background: #0003; color: inherit; font: inherit; }
  .card-edit-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; padding:8px 24px 24px; overflow-y:auto; min-height:0; flex:1; align-items:start; }
  @media(max-width:800px) { .card-edit-grid { grid-template-columns:1fr; padding:8px 16px 16px; } }
</style>
