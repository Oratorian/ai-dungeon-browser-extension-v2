<script lang="ts">
  import Field from "@/ui/components/field.svelte";
  import Slider from "@/ui/components/slider.svelte";
  import { settings, Storage } from "@/storage";
  import { compressStoredImages, isInlineImage, formatBytes, type CompressStats } from "@/media/compress";
  import type { Adventure } from "@/shared/types";

  // Images added from Trinetra are stored as links and cost nothing. Images uploaded from a device are
  // stored inline as base64 inside the adventure, and a few full-resolution photos will push a card
  // set into hundreds of megabytes, which is then parsed on every AI Dungeon tab and rewritten on
  // every card edit. This panel finds those and re-encodes them in place.

  let adventures = $state<Record<string, Adventure>>({});
  Storage.adventures.subscribe((value) => (adventures = value));

  let running = $state(false);
  let result = $state<CompressStats | null>(null);

  /** How many inline images there are, and what they currently cost, across every adventure. */
  const inline = $derived.by(() => {
    let count = 0;
    let bytes = 0;
    for (const adventure of Object.values(adventures)) {
      for (const card of Object.values(adventure.storyCards)) {
        for (const source of [...card.icons, ...card.graphics]) {
          if (!isInlineImage(source)) continue;
          count++;
          bytes += source.length;
        }
      }
    }
    return { count, bytes };
  });

  async function run() {
    running = true;
    result = null;
    try {
      result = await compressStoredImages();
    } finally {
      running = false;
    }
  }

  const saved = $derived(result ? Math.max(0, result.before - result.after) : 0);
</script>

<Field
  label="Quality"
  info="Re-encoding quality, 0 is smallest and 100 is best looking.<br>85 is usually indistinguishable from the original."
>
  <Slider bind:value={$settings.compressionQuality} min={10} max={100} step={5} />
</Field>

<Field label="Max Icon Size" info="Longest edge for inline icons, in pixels. Icons render small, so they rarely need more.">
  <Slider bind:value={$settings.compressionResolutionIcon} min={64} max={512} step={32} />
</Field>

<Field label="Max Graphic Size" info="Longest edge for inline graphics, in pixels. These show in tooltips and the focus panel.">
  <Slider bind:value={$settings.compressionResolutionGraphic} min={256} max={2048} step={128} />
</Field>

<div class="flex flex-col gap-2 p-3 bg-theme-neutral-100 rounded-xl">
  {#if inline.count === 0}
    <span class="text-sm text-theme-neutral-700">
      No images are stored inline. Everything is linked, which is already the cheapest option.
    </span>
  {:else}
    <span class="text-sm text-theme-neutral-800">
      <span class="font-bold">{inline.count}</span>
      image{inline.count !== 1 ? "s" : ""} stored inline, using
      <span class="font-bold">{formatBytes(inline.bytes)}</span>.
    </span>
    <span class="text-xs text-theme-neutral-700">
      Re-encodes them at the sizes above, across every adventure. Images stored as links are left
      alone, and anything that would not get smaller is kept as it is. This cannot be undone, so
      export anything you would want back first.
    </span>

    <button
      onclick={run}
      disabled={running}
      class="flex items-center justify-center gap-2 px-3 py-2 mt-1 rounded-lg transition-colors text-sm
             bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme disabled:opacity-60"
    >
      <span class="font-symbol text-base">{running ? "hourglass" : "compress"}</span>
      {running ? "Compressing..." : "Compress inline images"}
    </button>
  {/if}

  {#if result}
    <span class="text-sm text-pretty-green">
      {#if result.compressed === 0}
        Nothing to do, every inline image was already at or below these limits.
      {:else}
        Compressed {result.compressed} image{result.compressed !== 1 ? "s" : ""}, saving
        <span class="font-bold">{formatBytes(saved)}</span>.
      {/if}
      {#if result.failed > 0}
        <span class="text-pretty-red">{result.failed} could not be read and were left alone.</span>
      {/if}
    </span>
  {/if}
</div>
