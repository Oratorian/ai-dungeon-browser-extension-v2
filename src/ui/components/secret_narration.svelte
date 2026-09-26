<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import { settings } from "@/storage";
  import { playedAdventureId } from "@/aid/adventure";
  import { extensionState } from "@/shared/state.svelte";
  import { installKonamiCode } from "@/shared/konami";
  import { readNovelPassages } from "@/rendering/novel_dom";
  import { parseNovel } from "@/rendering/novel";
  import { NarrationQueue, narrationQueueSize } from "@/tts/queue";
  import { generateNarration, ttsState } from "@/tts/service";
  import { configureNarrationPlayback, narrationWav } from "@/tts/playback";
  import TtsSettings from "./tts_settings.svelte";
  import TtsVoiceSettings from "./tts_voice_settings.svelte";
  import Slider from "./slider.svelte";

  let notice = $state(false);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let unlocked = $state(false);
  let open = $state(false);
  let reading = $state(false);
  let message = $state("");
  let player = $state<HTMLAudioElement>();
  let url = $state("");
  let queue: NarrationQueue | undefined;
  let lines: string[] = [];
  let index = 0;
  let request = 0;
  const outside = $derived(!$settings.visualNovelMode);
  const ready = $derived($settings.novelTtsEnabled && $ttsState.phase === "ready");

  onMount(() => installKonamiCode(window, () => {
    unlocked = true; open = true; notice = true;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice = false, 6000);
  }));
  onDestroy(() => clearTimeout(noticeTimer));

  function clearAudio() {
    player?.pause();
    if (player) { player.onended = null; player.onerror = null; player.removeAttribute("src"); player.load(); }
    player = undefined;
    if (url) URL.revokeObjectURL(url);
    url = "";
  }
  function stop() {
    request++;
    queue?.dispose(); queue = undefined;
    clearAudio(); reading = false; message = "";
  }
  // A settings change or adventure switch invalidates queued audio. VN owns playback while enabled.
  const configuration = $derived(JSON.stringify([outside, ready, $playedAdventureId,
    $settings.novelTtsVoice, $settings.novelTtsSteps, $settings.novelTtsPitch,
    $settings.novelTtsQueue, $settings.novelTtsAccelerated, $settings.novelTtsThreads]));
  $effect(() => { configuration; untrack(stop); });
  $effect(() => { const volume = $settings.volume; if (player) player.volume = Math.max(0, Math.min(1, volume / 100)); });
  onDestroy(stop);

  function advance(token: number) {
    if (token !== request || !queue) return;
    clearAudio();
    if (index >= lines.length) { stop(); message = "Finished reading."; return; }
    queue.setWindow(lines.slice(index, index + narrationQueueSize($settings.novelTtsQueue) + 1));
    playReady(token);
  }
  function playReady(token: number) {
    if (token !== request || player || !queue) return;
    const text = lines[index]!;
    const audio = queue.get(text);
    if (!audio) { message = `Preparing line ${index + 1} of ${lines.length}...`; return; }
    url = URL.createObjectURL(narrationWav(audio, $settings.novelTtsPitch));
    player = new Audio(url);
    configureNarrationPlayback(player, audio.sampleRate, $settings.novelTtsPitch, $settings.volume);
    player.onended = () => { if (token === request) { index++; advance(token); } };
    player.onerror = () => { if (token === request) { stop(); message = "Audio could not be played. Try reading again."; } };
    message = `Reading line ${index + 1} of ${lines.length}.`;
    void player.play().catch(() => { if (token === request) { open = true; message = "Audio ready. Press Play below."; } });
  }
  function readLatest() {
    stop();
    const output = document.getElementById("gameplay-output");
    const latest = output && readNovelPassages(output).at(-1);
    if (!latest) { message = "No story response is loaded yet."; return; }
    lines = parseNovel(latest.text).map(frame => frame.text);
    index = 0;
    if (!lines.length || !ready || !outside) return;
    reading = true;
    const token = request;
    const options = { voice: $settings.novelTtsVoice, steps: $settings.novelTtsSteps };
    queue = new NarrationQueue(text => generateNarration(text, options), (text, error) => {
      if (token !== request) return;
      if (error) { stop(); message = `Narration failed: ${error}`; return; }
      if (text === lines[index]) playReady(token);
    });
    advance(token);
  }
</script>

<svelte:window onkeydowncapture={(event) => { if (event.key === "Escape") open = false; }} />

{#if notice}
  <div class="unlock-notice" role="status">Story narration unlocked! {outside ? "Look for the voice button at the bottom left." : "Exit VN to use the voice button at the bottom left."}</div>
{/if}

{#if unlocked && outside && !extensionState.isEditorOpen}
  <aside class="secret-narration">
    {#if open}
      <section id="secret-narration-settings" aria-label="Story narration settings" class="bg-theme-neutral-0 text-theme-neutral-900">
        <header><strong>Story narration unlocked</strong><button aria-label="Close narration settings" onclick={() => open = false}>Close</button></header>
        <p>Read the latest loaded response without entering VN. Wait for the response to finish before reading. Settings are shared with VN.</p>
        <TtsSettings grid />
        <TtsVoiceSettings />
        <label class="volume">Volume<Slider ariaLabel="Narration volume" bind:value={$settings.volume} /></label>
        <div class="controls">
          <button disabled={!ready || reading} onclick={readLatest}>Read latest response</button>
          <button disabled={!reading} onclick={stop}>Stop</button>
          {#if player}<button onclick={() => { void player?.play().catch(() => message = "Playback blocked. Try again."); }}>Play</button>{/if}
        </div>
        {#if message}<p role="status">{message}</p>{/if}
      </section>
    {/if}
    <button class="narration-puck" aria-label="Story narration" title="Story narration" aria-expanded={open} aria-controls="secret-narration-settings" onclick={() => open = !open}>
      <span class="font-symbol" aria-hidden="true">record_voice_over</span>
    </button>
  </aside>
{/if}

<style>
  .unlock-notice { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 1100; max-width: calc(100vw - 32px); padding: 12px 20px; border: 1px solid #f8ae2c; border-radius: 12px; background: #202b34; color: #fff; font: 14px 'IBM Plex Sans', sans-serif; pointer-events: none; }
  .secret-narration { position: fixed; left: 16px; bottom: 16px; z-index: 950; font: 14px 'IBM Plex Sans', sans-serif; }
  .narration-puck { width: 48px; height: 48px; border-radius: 50%; background: #202b34; color: #f8ae2c; }
  section { position: absolute; bottom: 60px; left: 0; width: min(480px, calc(100vw - 32px)); max-height: calc(100dvh - 100px); overflow: auto; padding: 16px; border: 1px solid #65717b; border-radius: 12px; box-shadow: 0 12px 32px #0008; }
  header, .controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  p { margin: 12px 0; font-size: 12px; }
  button { cursor: pointer; border: 1px solid #64727c; border-radius: 8px; padding: 8px 12px; }
  button:disabled { opacity: .4; cursor: default; }
  button:focus-visible { outline: 2px solid #f8ae2c; outline-offset: 2px; }
  .volume { display: flex; flex-direction: column; gap: 8px; margin: 12px 8px; }
</style>
