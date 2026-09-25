<script lang="ts">
  import { settings } from "@/storage";
  import { configureTts, initializeTts, ttsState } from "@/tts/service";
  import Select from "./select.svelte";
  let { grid = false, disableInitializeWhenOff = false }: { grid?: boolean; disableInitializeWhenOff?: boolean } = $props();
  $effect(() => configureTts($settings.novelTtsEnabled, $settings.novelTtsAccelerated, $settings.novelTtsThreads));
  const ready = $derived($ttsState.phase === "ready");
  const busy = $derived($ttsState.phase === "loading" || $ttsState.phase === "checking");
  const label = $derived(!$settings.novelTtsEnabled ? "Off" : ready ? "On (ready)"
    : $ttsState.phase === "missing" ? "On (download needed)" : "On (setup needed)");
  function initialize() {
    $settings.novelTtsEnabled = true;
    configureTts(true, $settings.novelTtsAccelerated, $settings.novelTtsThreads);
    void initializeTts();
  }
</script>

<div class="tts-actions gap-2 px-2" class:grid>
  <button role="checkbox" aria-label="Enable TTS" title="Read the story aloud using a voice generated on your computer." aria-checked={!$settings.novelTtsEnabled ? false : ready ? true : "mixed"}
    onclick={() => $settings.novelTtsEnabled = !$settings.novelTtsEnabled}
    class="enable flex items-center justify-between gap-3 rounded-lg p-3 bg-theme-neutral-100">
    <span>Enable TTS</span>
    <span class:ready class:pending={$settings.novelTtsEnabled && !ready} class="state">{label}</span>
  </button>
  <button onclick={initialize} title="Prepare the voices for reading. The first setup downloads the voice files; later setups reuse them." disabled={busy || ready || (disableInitializeWhenOff && !$settings.novelTtsEnabled)}
    class="rounded-lg p-2 bg-theme-neutral-100 hover:bg-theme-neutral-300 disabled:opacity-50 disabled:cursor-default">
    {busy ? "Initializing TTS..." : ready ? "TTS initialized" : "Initialize TTS"}
  </button>
  <p role="status" class="text-xs text-theme-neutral-800">{$ttsState.message}</p>
    <div class="acceleration">
      <div class="acceleration-row">
      <div class="acceleration-field">
        <span class="text-xs text-theme-neutral-800">Accelerated TTS</span>
      <button role="switch" aria-checked={$settings.novelTtsAccelerated} aria-label="Accelerated TTS"
        onclick={() => $settings.novelTtsAccelerated = !$settings.novelTtsAccelerated}
        class="flex w-full items-center justify-between gap-3 rounded-lg p-3 bg-theme-neutral-100">
        <span>{$settings.novelTtsAccelerated ? "On" : "Off"}</span>
      </button>
      </div>
      {#if $settings.novelTtsAccelerated}
        <div class="acceleration-field" title="How many parts of your processor can work on speech at once. Start with 2; try 4 or 6 if speech is too slow.">
          <span class="text-xs text-theme-neutral-800">Threads</span>
          <Select ariaLabel="TTS threads" allowDeselect={false} portal={false}
            bind:value={() => String($settings.novelTtsThreads), value => $settings.novelTtsThreads = Number(value)}
            items={[2, 4, 6].map(threads => ({ value: String(threads), label: String(threads) }))} />
        </div>
      {/if}
      </div>
      <p class="text-xs text-theme-neutral-800">{import.meta.env.BROWSER === "firefox"
        ? "Prepare speech faster by using more of your processor. Requires the Windows TTS Helper and an extra tab."
        : "Prepare speech faster by using more of your processor. No extra app or tab needed."}</p>
      {#if $settings.novelTtsAccelerated && import.meta.env.BROWSER === "firefox"}
        <details class="text-xs text-theme-neutral-800">
          <summary>How to set up faster speech in Firefox</summary>
          <p><a href="https://github.com/Oratorian/ai-dungeon-browser-extension-v2/releases/download/TTS-Helper/DungeonExtension-TTS-Helper-Setup-windows-x64.exe"
            target="_blank" rel="noopener noreferrer" class="text-pretty-theme hover:underline">Download Windows TTS Helper</a></p>
          <p>Download and run the installer once. Firefox will open a helper tab beside your story when needed. Keep that tab open while listening. Turn TTS off or close the story to stop it. If you change acceleration or threads, click Initialize TTS again if asked.</p>
        </details>
      {/if}
    </div>
</div>

<style>
  .tts-actions { display: flex; flex-direction: column; }
  .tts-actions.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid .enable { flex-direction: column; justify-content: center; gap: 4px; }
  .grid .state { font-size: 12px; }
  .grid p { grid-column: 1 / -1; }
  .acceleration { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .acceleration-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: end; }
  .acceleration-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .acceleration-field button { min-height: 44px; }
  summary { cursor: pointer; }
  .state { color: #b9c2c8; }
  .state.pending { color: #f8ae2c; }
  .state.ready { color: #77d69b; }
</style>
