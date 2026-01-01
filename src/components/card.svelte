<script lang="ts">
  import { Storage } from "@/utils/storage";
  import type { StoryCard } from "@/utils/types";

  let card: HTMLDivElement;

  function onmousemove(e: MouseEvent) {
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPct = x / rect.width;
    const yPct = y / rect.height;
    const rX = (0.5 - yPct) * 15;
    const rY = (xPct - 0.5) * 15;

    card.style.setProperty("--rx", `${rX}deg`);
    card.style.setProperty("--ry", `${rY}deg`);
    card.style.setProperty("--tx", `${xPct * 100}%`);
    card.style.setProperty("--ty", `${yPct * 100}%`);
  }

  function onmouseleave() {
    if (!card) return;
    card.style.removeProperty("--rx");
    card.style.removeProperty("--ry");
    card.style.removeProperty("--tx");
    card.style.removeProperty("--ty");
  }

  type Props = {
    placeholder?: boolean;
    storyCard?: StoryCard;
    adventureId?: string;
    onclick?: () => void;
  };

  let { placeholder, storyCard, adventureId, onclick }: Props = $props();

  function getArrayLength(value: unknown): number {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return 0;
  }

  function getArrayItem(value: unknown, index: number): string | null {
    if (Array.isArray(value) && value[index]) return value[index];
    if (value && typeof value === "object") {
      const values = Object.values(value) as string[];
      return values[index] ?? null;
    }
    return null;
  }

  const iconsLength = $derived(storyCard ? getArrayLength(storyCard.icons) : 0);
  const graphicsLength = $derived(storyCard ? getArrayLength(storyCard.graphics) : 0);
  const hasGraphic = $derived(graphicsLength > 0);
  const currentGraphic = $derived(hasGraphic ? getArrayItem(storyCard?.graphics, storyCard?.graphicIndex ?? 0) : null);
  const hasIcon = $derived(iconsLength > 0);
  const currentIcon = $derived(hasIcon ? getArrayItem(storyCard?.icons, storyCard?.iconIndex ?? 0) : null);

  const typeIcons: Record<string, string> = {
    character: "sentiment_excited",
    location: "explore",
    item: "apparel",
    faction: "sword_rose",
    event: "domino_mask",
    race: "skull",
  };

  const typeIcon = $derived(storyCard?.type ? (typeIcons[storyCard.type] ?? "help") : "help");

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (adventureId && storyCard) {
      Storage.deleteStoryCard(adventureId, storyCard.id);
    }
  }

  function handleClick() {
    if (onclick) {
      onclick();
    } else if (adventureId && storyCard) {
      Storage.openStoryCardEditor(adventureId, storyCard.id);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }
</script>

<div
  bind:this={card}
  role="button"
  tabindex="0"
  {onmousemove}
  {onmouseleave}
  onclick={handleClick}
  onkeydown={handleKeydown}
  class="card-3d relative w-full aspect-2/3 rounded-xl shadow-2xl overflow-hidden cursor-pointer transform-gpu group
  {placeholder ? 'bg-pretty-orange/20' : hasGraphic ? 'bg-cover bg-center' : 'bg-cover bg-pretty-theme/20'}"
  style={hasGraphic && currentGraphic ? `background-image: url(${currentGraphic})` : ""}
>
  {#if !placeholder}
    <div class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent z-5"></div>
  {/if}

  <div class="relative z-10 h-full flex flex-col items-center justify-end p-4 text-white">
    {#if placeholder}
      <div class="flex-1 flex flex-col items-center justify-center">
        <h2 class="text-2xl text-pretty-orange font-symbol">add_2</h2>
        <p class="text-14px text-pretty-orange mt--2 text-center">Add characters, locations, and more</p>
      </div>
    {:else if storyCard}
      <div class="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1">
        <span class="font-symbol text-sm text-pretty-theme">{typeIcon}</span>
        <span class="text-xs capitalize">{storyCard.type || "unknown"}</span>
      </div>

      {#if currentIcon}
        <div
          class="absolute aspect-square w-11.25 h-11.25 top-3 right-3 size-8 rounded-lg overflow-hidden border border-white/20"
        >
          <img src={currentIcon} alt="Icon" class="w-full h-full object-cover" />
        </div>
      {/if}

      <!--
      <button
        onclick={handleDelete}
        class="absolute top-3 w-11.25 right-3 p-2 aspect-square rounded-lg opacity-0 group-hover:opacity-100 transition-all {currentIcon
          ? 'top-16'
          : ''}"
      >
        <span class="font-symbol text-xl hover:text-pretty-red">delete_forever</span>
      </button> -->

      <div class="w-full text-center">
        <h2 class="text-lg font-bold tracking-wide uppercase font-plex text-shadow-lg truncate">
          {storyCard.name}
        </h2>
        {#if iconsLength > 0 || graphicsLength > 0}
          <p class="text-xs opacity-60 mt-1">
            {iconsLength} icon{iconsLength !== 1 ? "s" : ""} •
            {graphicsLength} graphic{graphicsLength !== 1 ? "s" : ""}
          </p>
        {:else}
          <p class="text-xs opacity-60 mt-1">Click to edit</p>
        {/if}
      </div>
    {:else}
      <h2 class="text-2xl font-bold tracking-widest uppercase font-plex text-shadow-lg">Elara</h2>
      <p class="text-xs opacity-60 mt-2">b1e7e2c4-8e2a-4c5a-9f2e-7c8b1d2e3f4a</p>
    {/if}
  </div>
</div>

<style>
  .card-3d {
    transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
    transition: transform 0s;
  }

  .card-3d:not(:hover) {
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .card-3d::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 20;
    border-radius: inherit;
    background: radial-gradient(
      circle at var(--tx, 50%) var(--ty, 50%),
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.06) 22%,
      transparent 38%
    );
    mix-blend-mode: overlay;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }

  .card-3d:hover::after {
    opacity: 1;
  }
</style>
