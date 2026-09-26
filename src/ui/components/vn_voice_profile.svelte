<script lang="ts">
  import { settings } from "@/storage";
  import { narratorVoice } from "@/tts/voices";
  import Select from "./select.svelte";
  import Slider from "./slider.svelte";
  import TtsPreview from "./tts_preview.svelte";
  let { label, voice = $bindable(), items }: { label: string; voice: string; items: { value: string; label: string }[] } = $props();
  const profile = $derived($settings.novelTtsVoiceProfiles[voice] ?? { speed: 1, pitch: $settings.novelTtsPitch });
  function update(field: "speed" | "pitch", value: number) {
    $settings.novelTtsVoiceProfiles = { ...$settings.novelTtsVoiceProfiles, [voice]: { ...profile, [field]: value } };
  }
</script>

<fieldset disabled={!$settings.novelTtsEnabled} class="profile">
  <legend>{label}</legend>
  <Select ariaLabel={label + " voice"} portal={false} allowDeselect={false} bind:value={voice} {items} />
  <div class="adjustments">
    <label>Speed ({profile.speed}×)<Slider ariaLabel={label + " speed"} bind:value={() => profile.speed, value => update("speed", value)} min={0.5} max={2} step={0.05} /></label>
    <label>Pitch<Slider ariaLabel={label + " pitch"} bind:value={() => profile.pitch, value => update("pitch", value)} min={-3} max={3} step={0.5} /></label>
  </div>
  <TtsPreview voice={narratorVoice(voice)} pitch={profile.pitch} speed={profile.speed} />
</fieldset>

<style>
  .profile { display: flex; flex-direction: column; gap: 8px; min-width: 0; border: 1px solid #59636b; border-radius: 8px; padding: 10px; }
  legend { font-size: 13px; padding: 0 4px; }
  .adjustments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  label { display: flex; flex-direction: column; gap: 6px; min-width: 0; font-size: 12px; }
  .profile:disabled { opacity: .4; }
</style>
