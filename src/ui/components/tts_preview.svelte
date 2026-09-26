<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { settings } from "@/storage";
  import { generateNarration, ttsState } from "@/tts/service";
  import { configureNarrationPlayback, narrationWav } from "@/tts/playback";
  import type { NarratorVoice } from "@/tts/voices";
  let { voice }: { voice?: NarratorVoice } = $props();
  const selectedVoice = $derived(voice ?? $settings.novelTtsVoice);

  const example = "Moonlight spilled across the ruined gate. Beyond it, a single lantern flickered... and someone whispered your name.";
  let generating = $state(false);
  let previewUrl = $state("");
  let message = $state("");
  let player: HTMLAudioElement | undefined = $state();
  let request = 0;
  const ready = $derived($settings.novelTtsEnabled && $ttsState.phase === "ready");
  const selection = $derived(JSON.stringify([ready, selectedVoice, $settings.novelTtsSteps, $settings.novelTtsPitch]));

  function stop() {
    request++;
    player?.pause();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = ""; generating = false; message = "";
  }
  $effect(() => { selection; untrack(stop); });
  onDestroy(stop);

  async function preview() {
    if (!ready || generating) return;
    stop();
    const token = request;
    const options = { voice: selectedVoice, steps: $settings.novelTtsSteps };
    const pitch = $settings.novelTtsPitch;
    const volume = $settings.volume;
    generating = true; message = "Generating preview...";
    try {
      const audio = await generateNarration(example, options);
      if (token !== request) return;
      previewUrl = URL.createObjectURL(narrationWav(audio, pitch));
      await tick();
      if (token !== request || !player) return;
      configureNarrationPlayback(player, audio.sampleRate, pitch, volume);
      message = "Preview ready. Replay it using the audio controls.";
      try { await player.play(); }
      catch { if (token === request) message = "Preview ready. Press Play in the audio controls."; }
    } catch (error) {
      if (token === request) message = error instanceof Error ? error.message : String(error);
    } finally { if (token === request) generating = false; }
  }
</script>

<div class="flex flex-col gap-2 p-2">
  <div class="flex gap-2" title="Hear a short sample using your chosen voice, generation steps, and pitch.">
    <button onclick={preview} disabled={!ready || generating}
      class="flex-1 rounded-lg p-2 bg-theme-neutral-100 hover:bg-theme-neutral-300 disabled:opacity-50 disabled:cursor-default">That's how it sounds like</button>
    {#if generating || previewUrl}
      <button onclick={stop} class="rounded-lg p-2 bg-theme-neutral-100 hover:bg-theme-neutral-300">Stop preview</button>
    {/if}
  </div>
  <p class="text-xs text-theme-neutral-800">{example}</p>
  {#if !ready}<p class="text-xs text-theme-neutral-800">{$settings.novelTtsEnabled ? "Click Initialize TTS to prepare the voice, then try a sample." : "Turn on Enable TTS to try a voice sample."}</p>{/if}
  {#if previewUrl}<audio aria-label="Narration preview" controls src={previewUrl} bind:this={player} class="w-full"></audio>{/if}
  {#if message}<p role="status" class="text-xs text-theme-neutral-800">{message}</p>{/if}
</div>
