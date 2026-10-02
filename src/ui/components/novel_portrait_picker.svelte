<script lang="ts">
  import { onMount } from "svelte";
  import type { NovelCard } from "@/rendering/novel_cards";
  import type { PortraitChoice } from "@/rendering/novel_portraits";

  let { card, current, choice, onchoose, onlock, onauto, onclose }: {
    card: NovelCard; current?: string; choice?: PortraitChoice;
    onchoose: (id: string) => void; onlock: (locked: boolean) => void;
    onauto: () => void; onclose: () => void;
  } = $props();
  let closeButton: HTMLButtonElement;
  onMount(() => closeButton?.focus());
</script>

<div class="portrait-picker">
  <button class="backdrop" aria-label="Close picture picker" onclick={onclose}></button>
  <div class="picker-panel" role="dialog" tabindex="-1" aria-label="Pictures for {card.name}">
    <div class="heading"><strong>{card.name}</strong><button bind:this={closeButton} onclick={onclose} aria-label="Close picture picker">×</button></div>
    <p>Choose a picture for this adventure.</p>
    <div class="pictures" role="group" aria-label="Saved pictures">
      {#each card.portraits ?? [] as portrait, index (index)}
        <button aria-pressed={current === portrait.id} onclick={() => onchoose(portrait.id)}>
          <img src={portrait.image} alt={portrait.name} />
          <span>{portrait.name}</span>
        </button>
      {/each}
    </div>
    <label class="lock"><input type="checkbox" checked={choice?.locked ?? false} onchange={event => onlock(event.currentTarget.checked)} /> Lock this picture</label>
    <p class="help">{choice?.locked ? "This picture stays until you choose another or turn off the lock." : "Matching phrases in later narration can change the picture."}</p>
    <button class="automatic" onclick={onauto}>Use default &amp; automatic switching</button>
    <p class="help">Add pictures and optional matching phrases in this character's story card.</p>
  </div>
</div>

<style>
  .portrait-picker { position: absolute; inset: 0; z-index: 20; }
  button { cursor: pointer; font: inherit; color: inherit; border: 1px solid #65717b; border-radius: 8px; padding: 8px 12px; background: #202b34; }
  button:hover { background: #35434e; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--color-pretty-theme, #f8ae2c); outline-offset: 3px; }
  .backdrop { position: absolute; inset: 0; width: 100%; height: 100%; background: #0007; border: 0; border-radius: 0; }
  .backdrop:hover { background: #0007; }
  .picker-panel { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); box-sizing: border-box; width: min(460px, calc(100% - 32px)); max-height: calc(100dvh - 48px); overflow: auto; padding: 20px; border: 1px solid #65717b; border-radius: 12px; background: #141e27; box-shadow: 0 12px 32px #0008; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 18px; }
  p { margin: 12px 0; line-height: 1.5; }
  .pictures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .pictures button { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px; }
  .pictures button[aria-pressed="true"] { border-color: var(--color-pretty-theme, #f8ae2c); box-shadow: inset 0 0 0 1px var(--color-pretty-theme, #f8ae2c); }
  .pictures img { width: 100%; height: min(180px, 24dvh); object-fit: contain; }
  .pictures span { max-width: 100%; overflow-wrap: anywhere; }
  .lock { display: flex; align-items: center; gap: 8px; margin-top: 16px; cursor: pointer; }
  .lock input { accent-color: var(--color-pretty-theme, #f8ae2c); width: 18px; height: 18px; }
  .help { font-size: 12px; color: #b9c2c8; }
  .automatic { width: 100%; }
  :global(.lynx-vn) .picker-panel { background: #10151e; border-color: #3b414c; }
  :global(.lynx-vn) button { background: #1d2532; border-color: #3b414c; }
  :global(.lynx-vn) .backdrop { background: #0007; border: 0; }
</style>
