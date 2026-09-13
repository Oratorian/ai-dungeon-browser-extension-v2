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
    class="h-10 min-w-44 px-3 rounded-xl text-sm inline-flex items-center justify-center gap-1.5 transition-colors
           {recording
      ? 'bg-pretty-theme/20 ring-2 ring-pretty-theme text-theme-neutral-900'
      : 'bg-theme-neutral-400 hover:bg-theme-neutral-500 text-white'}"
  >
    {#if recording}
      <span class="text-sm">{needsModifier ? "Hold Ctrl, Alt or Meta too" : "Press keys..."}</span>
    {:else if parts.length}
      {#each parts as part, i (i)}
        {#if i > 0}<span class="text-base font-bold text-white/80">+</span>{/if}
        <kbd class="px-2 py-1 rounded-md bg-theme-neutral-200 ring-1 ring-theme-neutral-600 text-sm font-bold">{part}</kbd>
      {/each}
    {:else}
      <span class="text-theme-neutral-800 text-sm">None</span>
    {/if}
  </button>
  {#if value && !recording}
    <button
      type="button"
      onclick={() => (value = "")}
      aria-label="Remove shortcut"
      title="Remove the shortcut"
      class="font-symbol text-xl text-theme-neutral-800 hover:text-pretty-red transition-colors"
    >
      delete
    </button>
  {/if}
</div>
