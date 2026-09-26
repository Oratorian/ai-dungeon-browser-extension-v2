<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import { settings } from "@/storage";
  import { playedAdventureId } from "@/aid/adventure";
  import { extensionState } from "@/shared/state.svelte";
  import { installKonamiCode } from "@/shared/konami";
  import { readNovelPassages } from "@/rendering/novel_dom";
  import { parseNovel } from "@/rendering/novel";
  import { createStoryAutoplay } from "@/rendering/story_autoplay";
  import { NarrationQueue, narrationQueueSize } from "@/tts/queue";
  import { generateNarration, ttsState } from "@/tts/service";
  import { narratorVoice } from "@/tts/voices";
  import { configureNarrationPlayback, narrationWav } from "@/tts/playback";
  import TtsSettings from "./tts_settings.svelte";
  import TtsVoiceSettings from "./tts_voice_settings.svelte";
  import Slider from "./slider.svelte";

  let notice = $state(false);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let unlocked = $state(false);
  let open = $state(false);
  let reading = $state(false);
  let paused = $state(false);
  let autoplay = $state(true);
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
    clearAudio(); reading = false; paused = false; message = "";
  }
  function togglePause() {
    if (!reading) return;
    paused = !paused;
    if (paused) { player?.pause(); message = "Narration paused."; }
    else if (player) {
      const token = request;
      message = `Reading line ${index + 1} of ${lines.length}.`;
      void player.play().catch(() => {
        if (token === request) { paused = true; message = "Playback blocked. Press Play to try again."; }
      });
    }
  }
  // A settings change or adventure switch invalidates queued audio. VN owns playback while enabled.
  const configuration = $derived(JSON.stringify([outside, ready, $playedAdventureId,
    $settings.secretTtsVoice, $settings.novelTtsSteps, $settings.novelTtsPitch,
    $settings.novelTtsQueue, $settings.novelTtsAccelerated, $settings.novelTtsThreads]));
  $effect(() => { configuration; untrack(stop); });
  $effect(() => { const volume = $settings.volume; if (player) player.volume = Math.max(0, Math.min(1, volume / 100)); });
  onDestroy(stop);

  function passages() {
    const output = document.getElementById("gameplay-output");
    return output ? readNovelPassages(output).map(passage => passage.text) : [];
  }
  $effect(() => {
    if (!unlocked || !autoplay || !outside || !ready || !$playedAdventureId) return;
    const poll = createStoryAutoplay(untrack(passages));
    const timer = setInterval(() => {
      // Native Continue controls are disabled during generation. Also require
      // a quiet text window, since availability can update before the final DOM render.
      const controls = [...document.querySelectorAll<HTMLElement>('[aria-label="Command: continue"]')]
        .filter(control => !control.closest('[hidden], [aria-hidden="true"]'));
      const busy = controls.length > 0 && controls.every(control => control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true");
      const next = poll(passages(), performance.now(), busy);
      if (next) narrate(next.text, !next.replace);
    }, 400);
    return () => clearInterval(timer);
  });

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
    message = paused ? "Audio ready. Narration paused." : `Reading line ${index + 1} of ${lines.length}.`;
    if (!paused) void player.play().catch(() => {
      if (token === request) { paused = true; message = "Audio ready. Press Play."; }
    });
  }
  function readLatest() {
    const latest = passages().at(-1);
    if (!latest) { message = "No story response is loaded yet."; return; }
    narrate(latest);
  }
  function narrate(text: string, append = false) {
    const next = parseNovel(text).map(frame => frame.text);
    if (append && reading && queue) {
      lines.push(...next);
      queue.setWindow(lines.slice(index, index + narrationQueueSize($settings.novelTtsQueue) + 1));
      return;
    }
    stop();
    lines = next;
    index = 0;
    if (!lines.length || !ready || !outside) return;
    reading = true;
    const token = request;
    const options = { voice: narratorVoice($settings.secretTtsVoice), steps: $settings.novelTtsSteps };
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
        <div class="panel-intro">
        <header><strong>Story narration unlocked</strong><button aria-label="Close narration settings" onclick={() => open = false}>Close</button></header>
        <p>Read without entering VN. Autoplay reads new passages after the text settles. Voice is saved separately; other settings are shared with VN.</p>
        <button class="autoplay-toggle" role="switch" aria-checked={autoplay} onclick={() => { autoplay = !autoplay; if (!autoplay) stop(); }}><span>Autoplay new passages</span><span>{autoplay ? "On" : "Off"}</span></button>
        </div>
        <TtsSettings grid />
        <TtsVoiceSettings hiddenNarrator />
        <label class="volume">Volume<Slider ariaLabel="Narration volume" bind:value={$settings.volume} /></label>
        <div class="controls">
          <button disabled={!ready || reading} onclick={readLatest}>Read latest response</button>
        </div>
      </section>
    {/if}
    <div class="playback-controls">
    <button class="narration-puck" aria-label="Story narration" title="Story narration" aria-expanded={open} aria-controls="secret-narration-settings" onclick={() => open = !open}>
      <span class="font-symbol" aria-hidden="true">record_voice_over</span>
    </button>
    <button disabled={!reading && !ready} aria-label={paused || !reading ? "Play narration" : "Pause narration"} onclick={() => reading ? togglePause() : readLatest()}>{paused || !reading ? "Play" : "Pause"}</button>
    <button disabled={!reading} aria-label="Stop narration" onclick={stop}>Stop</button>
    </div>
    {#if message}<div class="playback-status" role="status">{message}</div>{/if}
  </aside>
{/if}

<style>
  .unlock-notice { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 1100; max-width: calc(100vw - 32px); padding: 12px 20px; border: 1px solid #f8ae2c; border-radius: 12px; background: #202b34; color: #fff; font: 14px 'IBM Plex Sans', sans-serif; pointer-events: none; }
  .secret-narration { position: fixed; left: 16px; bottom: 16px; z-index: 950; width: min(224px, calc(100vw - 32px)); font: 14px/1.4 'IBM Plex Sans', sans-serif; }
  .playback-controls { box-sizing: border-box; display: grid; grid-template-columns: 40px repeat(2, minmax(0, 1fr)); align-items: center; gap: 6px; padding: 6px; border: 1px solid #465761; border-radius: 14px; background: #202b34; color: #eee8de; box-shadow: 0 4px 16px #0004; }
  .playback-controls button { display: flex; align-items: center; justify-content: center; height: 40px; min-width: 0; padding: 0 8px; background: #283640; color: #eee8de; }
  .playback-controls button:hover:enabled { background: #354650; border-color: #a0b1bb; }
  .playback-controls .narration-puck { padding: 0; color: #f8ae2c; }
  .narration-puck .font-symbol { display: block; font-size: 24px; line-height: 1; color: inherit; }
  .playback-status { box-sizing: border-box; width: 100%; margin-top: 6px; padding: 6px 10px; border: 1px solid #465761; border-radius: 8px; background: #202b34; color: #d4dfe5; font-size: 12px; overflow-wrap: anywhere; }
  section { box-sizing: border-box; position: absolute; bottom: calc(100% + 12px); left: 0; width: min(480px, calc(100vw - 32px)); max-height: calc(100dvh - 160px); overflow: auto; padding: 16px; border: 1px solid #65717b; border-radius: 12px; box-shadow: 0 12px 32px #0008; }
  .panel-intro { padding: 0 8px 12px; }
  .autoplay-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 44px; text-align: left; }
  .controls { padding: 0 8px 8px; }
  .controls button { width: 100%; }
  header, .controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  p { margin: 12px 0; font-size: 12px; }
  button { box-sizing: border-box; cursor: pointer; border: 1px solid #64727c; border-radius: 8px; padding: 8px 12px; font: inherit; }
  button:disabled { opacity: .4; cursor: default; }
  button:focus-visible { outline: 2px solid #f8ae2c; outline-offset: 2px; }
  .volume { display: flex; flex-direction: column; gap: 8px; margin: 12px 8px; }
</style>
