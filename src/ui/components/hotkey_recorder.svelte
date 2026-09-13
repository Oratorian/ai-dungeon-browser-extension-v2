<script lang="ts">
  import { hotkeyFromEvent, hotkeyParts } from "@/shared/hotkey";

  // A key-combination field: click it, press the combination, done. Escape cancels, Backspace or
  // Delete clears. Lives in our shadow root, so the keys it hears never reach AI Dungeon's page.

  type Props = {
    value: string;
    ariaLabel?: string;
  };

  let { value = $bindable(), ariaLabel = "Keyboard shortcut" }: Props = $props();

  let recording = $state(false);
  // Shown briefly when a press had no Ctrl/Alt/Meta and was refused for that reason.
  let needsModifier = $state(false);

  const parts = $derived(hotkeyParts(value));

  function onKeyDown(e: KeyboardEvent) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      recording = false;
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      value = "";
      recording = false;
      return;
    }

    const combo = hotkeyFromEvent(e);
    if (combo) {
      value = combo;
      recording = false;
      needsModifier = false;
    } else if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      // A key without a modifier: keep listening, but say why nothing happened.
      needsModifier = true;
    }
  }

  function onBlur() {
    recording = false;
    needsModifier = false;
  }
</script>

<div class="flex items-center gap-2 place-self-end">
  <button
    type="button"
    onclick={() => (recording = !recording)}
    onkeydown={onKeyDown}
    onblur={onBlur}
    aria-label={ariaLabel}
    title={recording ? "Press the combination; Escape cancels, Backspace clears" : "Click, then press a combination"}
    class="h-input min-w-40 px-3 rounded-xl text-sm inline-flex items-center justify-center gap-1 transition-colors
           {recording
      ? 'bg-pretty-theme/20 ring-2 ring-pretty-theme text-theme-neutral-900'
      : 'bg-theme-neutral-400 hover:bg-theme-neutral-500 text-white'}"
  >
    {#if recording}
      <span class="text-xs">{needsModifier ? "Hold Ctrl, Alt or Meta too" : "Press keys..."}</span>
    {:else if parts.length}
      {#each parts as part, i (i)}
        {#if i > 0}<span class="text-theme-neutral-700">+</span>{/if}
        <kbd class="px-1.5 py-0.5 rounded-md bg-theme-neutral-200 text-xs font-bold">{part}</kbd>
      {/each}
    {:else}
      <span class="text-theme-neutral-800 text-xs">None</span>
    {/if}
  </button>
  {#if value && !recording}
    <button
      type="button"
      onclick={() => (value = "")}
      aria-label="Clear shortcut"
      title="Clear"
      class="font-symbol text-lg text-theme-neutral-700 hover:text-pretty-red transition-colors"
    >
      close
    </button>
  {/if}
</div>
