<script lang="ts">
  import { settings } from "@/storage";
  import { configureTts, initializeTts, ttsState } from "@/tts/service";
  $effect(() => configureTts($settings.novelTtsEnabled));
  const ready = $derived($ttsState.phase === "ready");
  const busy = $derived($ttsState.phase === "loading" || $ttsState.phase === "checking");
  const label = $derived(!$settings.novelTtsEnabled ? "Off" : ready ? "On (fully available)"
    : $ttsState.phase === "missing" ? "On (ONNX models not downloaded)" : "On (not ready)");
  function initialize() { $settings.novelTtsEnabled = true; void initializeTts(); }
</script>

<div class="flex flex-col gap-2 px-2">
  <button role="checkbox" aria-label="Enable TTS" aria-checked={!$settings.novelTtsEnabled ? false : ready ? true : "mixed"}
    onclick={() => $settings.novelTtsEnabled = !$settings.novelTtsEnabled}
    class="flex items-center justify-between gap-3 rounded-lg p-3 bg-theme-neutral-100">
    <span>Enable TTS</span>
    <span class:ready class:pending={$settings.novelTtsEnabled && !ready} class="state">{label}</span>
  </button>
  <button onclick={initialize} disabled={busy || ready}
    class="rounded-lg p-2 bg-theme-neutral-100 hover:bg-theme-neutral-300 disabled:opacity-50 disabled:cursor-default">
    {busy ? "Initializing TTS..." : ready ? "TTS initialized" : "Initialize TTS"}
  </button>
  <p role="status" class="text-xs text-theme-neutral-800">{$ttsState.message}</p>
</div>

<style>
  .state { color: #b9c2c8; }
  .state.pending { color: #f8ae2c; }
  .state.ready { color: #77d69b; }
</style>
