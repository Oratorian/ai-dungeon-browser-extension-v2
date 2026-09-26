<script lang="ts">
  /* Components */
  import Color from "@/ui/components/color.svelte";
  import Field from "@/ui/components/field.svelte";
  import SettingsCard from "@/ui/components/settings_card.svelte";
  import { setContext } from "svelte";
  import Slider from "@/ui/components/slider.svelte";
  import Select from "@/ui/components/select.svelte";
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
  import VnVoiceProfile from "@/ui/components/vn_voice_profile.svelte";
  import { narratorVoices } from "@/tts/voices";
  import { MENTION_CARD_TYPES, type MentionCardType } from "@/aid/mentions";

  /* Storage */
  import { settings } from "@/storage";

  /* Other */
  import { extensionState, type SettingsSection } from "@/shared/state.svelte";


  setContext("settings-inline-help", true);
  const sections: { id: SettingsSection; icon: string; label: string; description: string }[] = [
    { id: "extension", icon: "tune", label: "Everyday controls", description: "Make the extension comfortable to use." },
    { id: "cards", icon: "sticker", label: "Story appearance", description: "Choose how names, pictures and story text look." },
    { id: "novel", icon: "theater_comedy", label: "Visual Novel", description: "Read your adventure as a scene with characters and dialogue." },
    { id: "speech", icon: "record_voice_over", label: "Voices & speech", description: "Set up reading aloud and choose how your characters sound." },
    { id: "writing", icon: "alternate_email", label: "Writing", description: "Find character and place names while writing your next action." },
    { id: "audio", icon: "cadence", label: "Sounds", description: "Set the mood with sounds attached to your story cards." },
    { id: "images", icon: "photo_library", label: "Images", description: "Connect your image library and manage your pictures." },
    { id: "libraries", icon: "folder_open", label: "Card libraries", description: "Choose where to get shared card sets and updates." },
    { id: "diagnostics", icon: "stethoscope", label: "Troubleshooting", description: "Find useful details when something is not working." },
  ];
  const current = $derived(sections.find(section => section.id === extensionState.settingsSection) ?? sections[0]!);
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

<div class="settings-workspace">
  <aside class="settings-sidebar bg-theme-neutral-100">
    <div class="settings-brand"><span class="text-pretty-theme text-xs font-bold uppercase tracking-widest">Dungeon Extension</span><h1>Make it yours</h1><p class="text-theme-neutral-800">Your story. Your setup.</p></div>
    <nav aria-label="Settings categories">
      {#each sections as section}
        <button aria-current={current.id === section.id ? "page" : undefined} onclick={() => extensionState.settingsSection = section.id} class:active={current.id === section.id}>
          <span aria-hidden="true" class="font-symbol">{section.icon}</span><span>{section.label}</span>
        </button>
      {/each}
    </nav>
    <p class="save-note text-theme-neutral-800"><span aria-hidden="true" class="font-symbol">check_circle</span>Changes save automatically.</p>
  </aside>
  {#key current.id}
  <section class="settings-content" aria-label={current.label}>
    <header><span class="text-pretty-theme text-xs font-bold uppercase tracking-widest">Settings</span><h2>{current.label}</h2><p class="text-theme-neutral-800">{current.description}</p></header>
    {#if current.id === "extension"}
<SettingsCard icon="drag_pan" label="Floating Button" description="Your shortcut to cards, stamping and Visual Novel Mode.">
    <Field
      label="Toggle Shortcut"
      info="Shows or hides the floating button for this page session. Refreshing or reopening the page always brings it back. The ring's <b>Hide until refresh</b> action also hides it.<br>Click the field and press a combination with Ctrl, Alt or Meta. Backspace clears it."
    >
      <HotkeyRecorder bind:value={$settings.floatingButtonHotkey} ariaLabel="Floating button toggle shortcut" />
    </Field>

      <Field
        label="Quick Actions"
        info="Hovering the button brings up four actions: <b>Sets</b>, <b>Stamp</b>, <b>Visual Novel Mode</b>, and <b>Hide until refresh</b>. Click the fox itself to open the editor.<br><em>Off: the button only opens the editor where you last left it.</em>"
      >
        <Switch bind:checked={$settings.floatingButtonQuickActions} />
      </Field>

      <Field label="Compact Corner Layout" info="Arrange two quick actions vertically and two horizontally beside the fox in an L shape, facing into the screen. Off uses the curved ring layout.">
        <Switch bind:checked={$settings.floatingButtonCompactLayout} />
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
  </SettingsCard>
<SettingsCard icon="motion_mode" label="Card Effects" description="Add a little movement to the cards in the editor.">
    <Field
      label="Tilt Angle"
      info="How far a story card tilts as you move the cursor across it, in degrees.<br>Set it to <b>0</b> to hold the cards still.<br><em>This is the card tiles in this editor, not anything in your story.</em>"
    >
      <Slider bind:value={$settings.cardTiltAngle} min={0} max={45} />
    </Field>

    <Field label="Shine" info="Whether a soft highlight follows the cursor across a card">
      <Switch bind:checked={$settings.cardShine} />
    </Field>
  </SettingsCard>
    {/if}
    {#if current.id === "cards"}
<SettingsCard icon="sticker" label="Icons" description="The small pictures beside highlighted names in your story.">
    <Field label="Size" info="Icon size in pixels">
      <Slider bind:value={$settings.iconSize} min={0} max={40} />
    </Field>

    <Field label="Roundness" info="Round off the corners. Choose 0 for square corners or 100 for a circle.">
      <Slider bind:value={$settings.iconRoundness} />
    </Field>

    <Field label="Thickness" info="How thick the outline around each icon is. Choose 0 for no outline.">
      <Slider bind:value={$settings.iconThickness} min={0} max={16} />
    </Field>
  </SettingsCard>
<SettingsCard icon="text_fields" label="Text" description="Make the story easier to read, your way.">
    <Field label="Bold Names" info="Make matching names stand out with thicker letters.">
      <Switch bind:checked={$settings.highlightBold} />
    </Field>

    <Field
      label="Story text formatting"
      info="Give text wrapped in special marks its intended style: **bold**, *italic*, ~underlined~ or ~~crossed out~~. This works throughout the story, not just on card names."
    >
      <Switch bind:checked={$settings.highlightMarkdown} />
    </Field>

    <Field label="Custom Text Color" info="Pick your own color for the story text instead of using the usual one.">
      <Switch bind:checked={$settings.customTextColor} />
    </Field>

    <Field label="Highlight Color" info="The starting highlight color for new cards. You can still give each card its own color.">
      <Color bind:value={$settings.iconColor} />
    </Field>

    {#if $settings.customTextColor}
      <Field label="Text Color" info="Color of the normal, non-highlighted text">
        <Color bind:value={$settings.textColor} />
      </Field>
    {/if}
  </SettingsCard>
<SettingsCard icon="tooltip" label="Hover previews" description="The card preview that appears when you hover over a highlighted name.">
    <Field label="Hide Delay" info="How long the preview stays visible after you move away. A larger number gives you more time to read it.">
      <Slider bind:value={$settings.tooltipDelay} min={0} max={2000} step={25} />
    </Field>

    <Field label="Max Width" info="How wide the card preview can be, in pixels.">
      <Slider bind:value={$settings.tooltipWidth} min={0} max={1280} step={32} />
    </Field>

    <Field label="Max Height" info="How tall the card preview can be, in pixels.">
      <Slider bind:value={$settings.tooltipHeight} min={0} max={1280} step={32} />
    </Field>
  </SettingsCard>
<SettingsCard icon="eye_tracking" label="Focus" description="Keep a card picture visible beside the story.">
    <Field
      label="Allow Focus"
      info="Hover over a highlighted name, then click the eye icon on its preview to keep the picture beside the latest story response. This also lets cards play their attached background sounds."
    >
      <Switch bind:checked={$settings.highlightFocus} />
    </Field>

    <Field label="Max Height" info="How tall the pinned picture area can be, in pixels.">
      <Slider bind:value={$settings.focusHeight} max={1280} step={32} />
    </Field>
  </SettingsCard>
    {/if}
    {#if current.id === "novel"}
<SettingsCard icon="theater_comedy" label="Visual Novel Mode" description="">
    <Field label="Enable Visual Novel Mode" info="Show your story as a scene with character pictures and a line-by-line reader. Exit VN brings you back to the normal story and remembers where you stopped.">
      <Switch bind:checked={$settings.visualNovelMode} />
    </Field>
    <p class="text-sm text-theme-neutral-800">Use Settings inside Visual Novel Mode to change speaker tracking, background blur and character glow. Add portraits to your story cards to see your characters in the scene.</p>
  </SettingsCard>
    {/if}
    {#if current.id === "speech"}
<SettingsCard icon="record_voice_over" label="Speech engine" description="">
    <p class="text-sm text-theme-neutral-800">Turn on TTS to read your story aloud in English. Click Initialize TTS to get the voices ready. The first setup downloads about 380 MB; later visits reuse those files. Your story is not sent to an online voice service.</p>
    <TtsSettings grid />
  </SettingsCard>
<SettingsCard icon="schedule" label="Reading ahead" description="">
  <div class="control-grid">
    <Field label="Voice quality" info="Lower numbers prepare speech faster. Higher numbers spend a little longer refining the sound. Start with 5 and increase it if you prefer the result.">
      <Select ariaLabel="Generation steps" allowDeselect={false} bind:value={() => String($settings.novelTtsSteps), value => $settings.novelTtsSteps = Number(value)} items={[5,6,7,8,9,10].map(value => ({value:String(value),label:String(value)}))} />
    </Field>
    <Field label="Lines to prepare ahead" info="Get the next few lines ready while you listen. A bigger number can help avoid pauses, but uses more memory. Only text already in your story can be prepared.">
      <Slider ariaLabel="Narration queue" bind:value={$settings.novelTtsQueue} min={1} max={20} step={1} />
    </Field>
  </div>
</SettingsCard>
<SettingsCard icon="graphic_eq" label="Voices" description="">
  <p class="text-sm text-theme-neutral-800">These voices are used in Visual Novel Mode. With Track Speakers on, a character uses the male or female voice chosen here, based on their story card's Gender. If Gender is None, the narrator reads their lines. Speed and pitch are remembered for each voice.</p>
  <VnVoiceProfile label="Narrator" bind:voice={() => $settings.novelTtsVoice, value => $settings.novelTtsVoice = value === "F5" ? "F5" : "M5"} items={[{value:"M5",label:"Male"},{value:"F5",label:"Female"}]} />
  <div class="control-grid">
    <VnVoiceProfile label="Male characters" bind:voice={$settings.novelTtsMaleVoice} items={narratorVoices.filter(voice => /^M[1-4]$/.test(voice.value))} />
    <VnVoiceProfile label="Female characters" bind:voice={$settings.novelTtsFemaleVoice} items={narratorVoices.filter(voice => /^F[1-4]$/.test(voice.value))} />
  </div>
</SettingsCard>
    {/if}
    {#if current.id === "writing"}
<SettingsCard icon="alternate_email" label="Story Card Autocomplete" description="Type @ in the action box to look up a name.">
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
  </SettingsCard>
    {/if}
    {#if current.id === "audio"}
<SettingsCard icon="cadence" label="Story sounds" description="Choose how loud your story sounds and how smoothly they repeat.">
    <Field label="Volume">
      <Slider bind:value={$settings.volume} />
    </Field>
    <Field
      label="Smooth sound repeats"
      info="Blend the end of a sound into the start when it repeats. A higher number makes the blend longer; 1000 means one second. Choose 0 for no blending. Changes apply the next time the sound starts."
    >
      <Slider bind:value={$settings.audioCrossfade} min={0} max={3000} step={50} />
    </Field>
    <AudioLibrary />
  </SettingsCard>
    {/if}
    {#if current.id === "images"}
<SettingsCard icon="photo_library" label="Trinetra" description="Use pictures from your Trinetra account.">
    <TrinetraSettings />
  </SettingsCard>
<SettingsCard icon="auto_awesome" label="Image Generation" description="Connect an image service to create pictures for your cards.">
    <ImageGenerationSettings />
  </SettingsCard>
<SettingsCard icon="compress" label="Image Compression" description="Make picture files smaller so they take up less space.">
    <ImageCompression />
  </SettingsCard>
    {/if}
    {#if current.id === "libraries"}
<SettingsCard icon="folder_open" label="Shared card collections" description="Add shared card collections hosted on GitHub.">
    <ScenarioRepos />
  </SettingsCard>
    {/if}
    {#if current.id === "diagnostics"}
<SettingsCard icon="stethoscope" label="Diagnostics" description="Check what the extension is doing and collect details for a bug report.">
    <Diagnostics />
  </SettingsCard>
    {/if}
  </section>
  {/key}
</div>
<style>
  .settings-workspace { display:grid; grid-template-columns:230px minmax(0,1fr); flex:1; min-height:0; overflow:hidden; }
  .settings-sidebar { display:flex; flex-direction:column; gap:24px; padding:28px 16px 16px; overflow-y:auto; border-right:1px solid #ffffff12; }
  .settings-brand { padding:0 12px; }
  h1 { font-size:24px; font-weight:700; margin:8px 0 4px; }
  .settings-brand p,.save-note { font-size:12px; }
  nav { display:flex; flex-direction:column; gap:5px; }
  nav button { display:flex; align-items:center; gap:12px; text-align:left; padding:12px; border:1px solid transparent; border-radius:10px; font-size:14px; cursor:pointer; }
  nav button:hover { background:#ffffff09; }
  nav button.active { background:#f8ae2c15; border-color:#f8ae2c50; color:#f8ae2c; font-weight:600; }
  nav .font-symbol { font-size:22px; }
  button:focus-visible { outline:2px solid #f8ae2c; outline-offset:2px; }
  .save-note { display:flex; align-items:center; gap:8px; margin-top:auto; padding:12px; }
  .settings-content { overflow-y:auto; overscroll-behavior:contain; min-width:0; padding:32px; display:flex; flex-direction:column; gap:20px; scrollbar-width:thin; }
  header { margin-bottom:4px; }
  h2 { font-size:30px; font-weight:700; margin:6px 0; }
  header p { font-size:14px; line-height:1.6; }
  .control-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
  @media(max-width:760px) {
    .settings-workspace { grid-template-columns:1fr; grid-template-rows:auto minmax(0,1fr); }
    .settings-sidebar { padding:10px; gap:0; overflow:hidden; border-right:0; border-bottom:1px solid #ffffff12; }
    .settings-brand,.save-note { display:none; }
    nav { flex-direction:row; overflow-x:auto; padding:3px; }
    nav button { flex-shrink:0; padding:9px 12px; }
    .settings-content { padding:20px 16px; }
    .control-grid { grid-template-columns:1fr; }
  }
</style>
