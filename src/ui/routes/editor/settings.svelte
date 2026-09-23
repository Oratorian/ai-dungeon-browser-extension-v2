<script lang="ts">
  /* Components */
  import Color from "@/ui/components/color.svelte";
  import Field from "@/ui/components/field.svelte";
  import Item from "@/ui/components/item.svelte";
  import Slider from "@/ui/components/slider.svelte";
  import Switch from "@/ui/components/switch.svelte";
  import HotkeyRecorder from "@/ui/components/hotkey_recorder.svelte";
  import { FLOATING_BUTTON_MIN_SIZE, FLOATING_BUTTON_MAX_SIZE } from "@/shared/floating_button";
  import AudioLibrary from "@/ui/components/audio_library.svelte";
  import ScenarioRepos from "@/ui/components/scenario_repos.svelte";
  import Diagnostics from "@/ui/components/diagnostics.svelte";
  import ImageCompression from "@/ui/components/image_compression.svelte";
  import ImageGenerationSettings from "@/ui/components/image_generation_settings.svelte";
  import TrinetraSettings from "@/ui/components/trinetra_settings.svelte";
  import TtsSettings from "@/ui/components/tts_settings.svelte";
  import TtsPreview from "@/ui/components/tts_preview.svelte";
  import { MENTION_CARD_TYPES, type MentionCardType } from "@/aid/mentions";

  /* Storage */
  import { settings } from "@/storage";

  /* Other */
  import { extensionState, type SettingsSection } from "@/shared/state.svelte";
  import { fade } from "svelte/transition";

  // Two groups, split by what a setting acts on rather than by what it happens to be called:
  //
  //  - "Extension" is the extension's own behaviour and upkeep. Nothing here changes what your story
  //    looks like while you play.
  //  - "Story Cards" is everything that changes what appears in the story itself.
  //
  // Text sits in the second group even though markdown formatting applies to all story text and not
  // only to cards: it is part of the same rendering pass, and someone hunting for it will look
  // alongside the other things that change how the story reads.

  const sections: { id: SettingsSection; icon: string; label: string }[] = [
    { id: "extension", icon: "extension", label: "Extension" },
    { id: "cards", icon: "sticker", label: "Story Cards" },
  ];

  // Send the floating button back to its default corner, for when it has been parked somewhere
  // awkward (or off the edge of a screen that has since gotten smaller).
  function resetFloatingPosition() {
    $settings = { ...$settings, floatingButtonX: -1, floatingButtonY: -1 };
  }

  function toggleAutocompleteType(type: MentionCardType) {
    const selected = $settings.storyCardAutocompleteTypes;
    $settings.storyCardAutocompleteTypes = selected.includes(type)
      ? selected.filter(value => value !== type)
      : [...selected, type];
  }
</script>

<div class="flex gap-1 p-1 bg-theme-neutral-200 rounded-xl">
  {#each sections as section (section.id)}
    {@const active = extensionState.settingsSection === section.id}
    <button
      onclick={() => (extensionState.settingsSection = section.id)}
      class="flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors {active
        ? 'bg-theme-neutral-0 text-pretty-theme font-bold'
        : 'text-theme-neutral-800 hover:bg-theme-neutral-300'}"
    >
      <span class="font-symbol text-lg">{section.icon}</span>
      {section.label}
    </button>
  {/each}
</div>

{#if extensionState.settingsSection === "extension"}
<div in:fade={{ duration: 120 }} class="flex flex-col gap-4">
<Field label="Extension">
  <Item foldout icon="theater_comedy" label="Visual Novel Mode">
    <Field label="Enable Visual Novel Mode" info="Read the loaded story as scenes with character portraits and Back/Next dialogue controls. Write action opens Do, Say, Story and Guide inside the scene. Return to game exposes AI Dungeon's normal controls.">
      <Switch bind:checked={$settings.visualNovelMode} />
    </Field>
    <Field label="Browser narration" info="Generate English narration locally. Initialize TTS downloads about 380 MiB of models through the background helper and loads both voices. Downloaded files are cached and load automatically next time TTS is enabled. Story text stays in your browser.">
      <TtsSettings />
    </Field>
    <Field label="Narrator voice">
      <select aria-label="Narrator voice" bind:value={$settings.novelTtsVoice} class="p-2 rounded-lg bg-theme-neutral-200">
        <option value="M5">M5</option><option value="F5">F5</option>
      </select>
    </Field>
    <Field label="Generation steps" info="Fewer steps generate faster; more steps refine the audio.">
      <select aria-label="Generation steps" bind:value={$settings.novelTtsSteps} class="p-2 rounded-lg bg-theme-neutral-200">
        {#each [5, 6, 7, 8, 9, 10] as steps}<option value={steps}>{steps}</option>{/each}
      </select>
    </Field>
    <Field label="Narrator pitch" info="Lower or raise the voice by up to three semitones while keeping the original reading speed. Zero uses the original voice.">
      <select aria-label="Narrator pitch" bind:value={$settings.novelTtsPitch} class="p-2 rounded-lg bg-theme-neutral-200">
        {#each [-3, -2, -1, 0, 1, 2, 3] as pitch}<option value={pitch}>{pitch > 0 ? `+${pitch}` : pitch}{pitch === 0 ? " (original)" : ""}</option>{/each}
      </select>
    </Field>
    <TtsPreview />
    <p class="text-xs text-theme-neutral-800">Uses names, triggers and portraits from your selected extension card set. Each paragraph sets the scene with up to four matching characters, two on each side. Portraits stay through its narration and dialogue, then fade when the next paragraph changes the cast. No AI calls are needed.</p>
  </Item>
  <Item foldout icon="alternate_email" label="Story Card Autocomplete">
    <Field label="Enable Autocomplete" info="Type @ in AI Dungeon's action textbox to find story-card names from the current adventure. Click a name, or use the arrow keys and Enter or Tab to insert it. Escape closes the suggestions.">
      <Switch bind:checked={$settings.storyCardAutocomplete} />
    </Field>
    <Field label="Card Types" info="Choose which story-card types appear in the suggestions. Custom includes user-defined types.">
      <div class="flex justify-end gap-3 text-xs">
        <button class="text-pretty-theme hover:underline" onclick={() => $settings.storyCardAutocompleteTypes = MENTION_CARD_TYPES.map(type => type.value)}>All</button>
        <button class="text-theme-neutral-800 hover:underline" onclick={() => $settings.storyCardAutocompleteTypes = []}>None</button>
      </div>
      <div role="group" aria-label="Autocomplete card types" class="grid grid-cols-2 gap-2">
        {#each MENTION_CARD_TYPES as type (type.value)}
          {@const selected = $settings.storyCardAutocompleteTypes.includes(type.value)}
          <button aria-pressed={selected} aria-label={type.label} onclick={() => toggleAutocompleteType(type.value)}
            class="flex items-center gap-2 p-2 rounded-lg text-sm transition-colors {selected ? 'bg-pretty-theme/20 text-pretty-theme' : 'bg-theme-neutral-100 hover:bg-theme-neutral-300'}">
            <span aria-hidden="true" class="font-symbol text-lg">{selected ? 'check_box' : 'check_box_outline_blank'}</span>
            {type.label}
          </button>
        {/each}
      </div>
      {#if $settings.storyCardAutocompleteTypes.length === 0}
        <span class="text-xs text-theme-neutral-800">Select at least one type to show suggestions.</span>
      {/if}
    </Field>
  </Item>
  <Item foldout icon="drag_pan" label="Floating Button">
    <Field
      label="Show Floating Button"
      info="Shows a small draggable button over the game that opens this editor.<br>- <b>Click</b> it to open the editor<br>- <b>Drag</b> it anywhere you like; it stays put<br><em>With it off, the editor opens with Ctrl+Shift+L, and the toggle shortcut below brings the button back.</em>"
    >
      <Switch bind:checked={$settings.floatingButton} />
    </Field>

    <Field
      label="Toggle Shortcut"
      info="A key combination that shows or hides the floating button while you play, so it can get out of the way mid-story without a trip back here.<br>Click the field and press the combination. It needs Ctrl, Alt or Meta in it, so typing never triggers it. Backspace clears it."
    >
      <HotkeyRecorder bind:value={$settings.floatingButtonHotkey} ariaLabel="Floating button toggle shortcut" />
    </Field>

    {#if $settings.floatingButton}
      <Field
        label="Quick Actions"
        info="Hovering the button brings up a ring of quick actions around it: <b>Sets</b> to switch, create or import a card set, <b>Stamp</b> to bind the set to the story you are playing, <b>AID Sync</b> and <b>Settings</b>. Sets and Stamp open right there; click one to pin it open.<br><em>Off: the button only opens the editor where you last left it.</em>"
      >
        <Switch bind:checked={$settings.floatingButtonQuickActions} />
      </Field>

      <Field label="Size" info="How large the button is drawn, in pixels. The shortcuts scale with it.">
        <Slider bind:value={$settings.floatingButtonSize} min={FLOATING_BUTTON_MIN_SIZE} max={FLOATING_BUTTON_MAX_SIZE} step={1} />
      </Field>

      <Field label="Position" info="Moves the button back to the bottom-right corner">
        <button
          onclick={resetFloatingPosition}
          class="flex items-center gap-1 px-3 py-1.5 place-self-end bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme rounded-lg transition-colors text-sm"
        >
          <span class="font-symbol text-base">restart_alt</span>
          Reset Position
        </button>
      </Field>
    {/if}
  </Item>

  <Item foldout icon="motion_mode" label="Card Effects">
    <Field
      label="Tilt Angle"
      info="How far a story card tilts as you move the cursor across it, in degrees.<br>Set it to <b>0</b> to hold the cards still.<br><em>This is the card tiles in this editor, not anything in your story.</em>"
    >
      <Slider bind:value={$settings.cardTiltAngle} min={0} max={45} />
    </Field>

    <Field label="Shine" info="Whether a soft highlight follows the cursor across a card">
      <Switch bind:checked={$settings.cardShine} />
    </Field>
  </Item>

  <Item foldout icon="folder_open" label="GitHub Repos">
    <ScenarioRepos />
  </Item>

  <Item foldout icon="photo_library" label="Trinetra">
    <TrinetraSettings />
  </Item>

  <Item foldout icon="auto_awesome" label="Image Generation">
    <ImageGenerationSettings />
  </Item>

  <Item foldout icon="compress" label="Image Compression">
    <ImageCompression />
  </Item>

  <Item foldout icon="stethoscope" label="Diagnostics">
    <Diagnostics />
  </Item>
</Field>
</div>
{:else}
<div in:fade={{ duration: 120 }} class="flex flex-col gap-4">
<Field label="Story Cards">
  <Item foldout icon="sticker" label="Icons">
    <Field label="Size" info="Icon size in pixels">
      <Slider bind:value={$settings.iconSize} min={0} max={40} />
    </Field>

    <Field label="Roundness" info="Icon roundness percentage">
      <Slider bind:value={$settings.iconRoundness} />
    </Field>

    <Field label="Thickness" info="Icon border thickness in pixels">
      <Slider bind:value={$settings.iconThickness} min={0} max={16} />
    </Field>
  </Item>

  <Item foldout icon="text_fields" label="Text">
    <Field label="Bold Names" info="Whether highlighted names <b>are bold</b>">
      <Switch bind:checked={$settings.highlightBold} />
    </Field>

    <Field
      label="Markdown Formatting"
      info="Whether custom formatting is applied to <b>all</b> story text, not only to cards, with rules for:<br>- <b>Bold</b> <code>(**)</code><br>- <b>Italic</b> <code>(*)</code><br>- <b>Underline</b> <code>(~)</code><br>- <b>Strikethrough</b> <code>(~~)</code>"
    >
      <Switch bind:checked={$settings.highlightMarkdown} />
    </Field>

    <Field label="Custom Text Color" info="Whether to use a custom text color">
      <Switch bind:checked={$settings.customTextColor} />
    </Field>

    <Field label="Highlight Color" info="Default color value for new cards">
      <Color bind:value={$settings.iconColor} />
    </Field>

    {#if $settings.customTextColor}
      <Field label="Text Color" info="Color of the normal, non-highlighted text">
        <Color bind:value={$settings.textColor} />
      </Field>
    {/if}
  </Item>

  <Item foldout icon="tooltip" label="Tooltip">
    <Field label="Hide Delay" info="Amount of milliseconds after which the tooltip hides itself">
      <Slider bind:value={$settings.tooltipDelay} min={0} max={2000} step={25} />
    </Field>

    <Field label="Max Width" info="Maximum width of the tooltip">
      <Slider bind:value={$settings.tooltipWidth} min={0} max={1280} step={32} />
    </Field>

    <Field label="Max Height" info="Maximum height of the tooltip">
      <Slider bind:value={$settings.tooltipHeight} min={0} max={1280} step={32} />
    </Field>
  </Item>

  <Item foldout icon="eye_tracking" label="Focus">
    <Field
      label="Allow Focus"
      info="Whether to enable the focus system which allows you to:<br>- Hover over a highlighted text thingy<br>- See the <span class='de-icon-tip'>eye_tracking</span> in the upper right corner<br>- Click it to pin its graphic to the last response<br>- <em>Also enables the SFX feature for ambience</em>"
    >
      <Switch bind:checked={$settings.highlightFocus} />
    </Field>

    <Field label="Max Height" info="Maximum height of the focus container">
      <Slider bind:value={$settings.focusHeight} max={1280} step={32} />
    </Field>
  </Item>

  <Item foldout icon="cadence" label="SFX">
    <Field label="Volume">
      <Slider bind:value={$settings.volume} />
    </Field>
    <Field
      label="Loop Crossfade"
      info="How much each loop overlaps the previous one, in milliseconds.<br>A longer crossfade hides the <b>fade-out</b> that many clips have at their end.<br>Set to <b>0</b> for a plain gapless loop. Takes effect the next time a clip starts."
    >
      <Slider bind:value={$settings.audioCrossfade} min={0} max={3000} step={50} />
    </Field>
    <AudioLibrary />
  </Item>
</Field>
</div>
{/if}
