<script lang="ts">
  import { settings } from "@/storage";
  import Select from "./select.svelte";
  import Slider from "./slider.svelte";
  import TtsPreview from "./tts_preview.svelte";
</script>

<fieldset class="voice-options" disabled={!$settings.novelTtsEnabled} inert={!$settings.novelTtsEnabled} aria-label="TTS voice settings">
  <div class="voice-option" title="Choose the voice that reads the story aloud.">
    <span>Voice</span>
    <Select ariaLabel="Narrator voice" allowDeselect={false} portal={false}
      bind:value={() => $settings.novelTtsVoice, value => $settings.novelTtsVoice = value === "F5" ? "F5" : "M5"}
      items={[{ value: "M5", label: "Male" }, { value: "F5", label: "Female" }]} />
  </div>
  <div class="voice-option" title="Lower values prepare speech faster. Higher values spend more time refining how it sounds.">
    <span>Generation steps</span>
    <Select ariaLabel="Generation steps" allowDeselect={false} portal={false}
      bind:value={() => String($settings.novelTtsSteps), value => $settings.novelTtsSteps = Number(value)}
      items={[5, 6, 7, 8, 9, 10].map(steps => ({ value: String(steps), label: String(steps) }))} />
  </div>
  <div class="voice-option" title="Make the voice lower or higher without changing reading speed. Zero keeps the original voice."><span>Pitch</span><Slider ariaLabel="Narrator pitch" bind:value={$settings.novelTtsPitch} min={-3} max={3} step={0.5} /></div>
  <div class="voice-option" title="How many upcoming lines to prepare in advance. A larger queue can reduce waiting as you read, but uses more memory and work up front."><span>Queue</span><Slider ariaLabel="Narration queue" bind:value={$settings.novelTtsQueue} min={1} max={20} step={1} /></div>
  <div class="voice-preview"><TtsPreview /></div>
</fieldset>

<style>
  .voice-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-width: 0; padding: 8px; margin: 0; border: 0; }
  .voice-option { display: flex; flex-direction: column; gap: 8px; min-width: 0; font-size: 13px; }
  .voice-preview { grid-column: 1 / -1; min-width: 0; }
  .voice-options:disabled { opacity: 0.4; }
</style>
