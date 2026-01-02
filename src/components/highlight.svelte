<script lang="ts">
  import type { StoryCard } from "@/utils/types";
  import { settings, Storage } from "@/utils/storage";
  import { fly } from "svelte/transition";
  import "@/utils/state.svelte";

  type Props = {
    card: StoryCard;
    text: string;
  };

  let { card, text }: Props = $props();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  let hovering = $state(false);
  let hideDelay = $derived($settings.tooltipDelay);

  function handleEnter() {
    if (timeoutId) clearTimeout(timeoutId);
    hovering = true;
  }

  function handleLeave() {
    timeoutId = setTimeout(() => {
      hovering = false;
    }, hideDelay);
  }

  let icons = $derived(card.icons);
  let icon = $derived(icons[card.iconIndex]);
  let graphic = $derived(card.graphics[card.graphicIndex]);
  let iconSize = $derived($settings.iconSize);
  let color = $derived(card.useCustomColor ? card.color : $settings.iconColor);
  let border = $derived(`${$settings.iconThickness}px solid ${color}`);
  let borderRadius = $derived(`${$settings.iconRoundness / 2}%`);
  let toolTipWidth = $derived(`${$settings.tooltipWidth}px`);
  let tooltipHeight = $derived(`${$settings.tooltipHeight}px`);
  let adventureId = $derived(Storage.selectedAdventureId);
  let bold = $derived($settings.highlightBold);
</script>

<span
  style:color
  role="tooltip"
  onmouseenter={handleEnter}
  onmouseleave={handleLeave}
  class="relative inline-flex items-baseline whitespace-nowrap gap-2"
  style:font-weight={bold ? "bold" : "inherit"}
>
  {#if graphic && hovering}
    <div
      transition:fly={{ duration: 200, y: 16, delay: 20 }}
      onmouseenter={handleEnter}
      onclick={(event: MouseEvent) => {
        event.stopPropagation();
        if (card.graphics.length <= 1) return;
        const nextIndex = (card.graphicIndex + 1) % card.graphics.length;
        Storage.updateStoryCard($adventureId!, card.id, { graphicIndex: nextIndex });
      }}
      style="position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); border-radius: 8px;"
      tabindex="-1"
      role="button"
      class="transition hover:brightness-110 z-10"
      onkeydown={() => {}}
    >
      <img
        src={graphic}
        alt="Highlight graphic"
        style:border-radius={"5%"}
        style="display: block; width: max-content; max-width: {toolTipWidth}; max-height: {tooltipHeight};"
      />
      {#if $settings.highlightFocus}
        <button
          onclick={(event: MouseEvent) => {
            event.stopPropagation();
            extensionState.focusCardId = card.id;
            hovering = false;
          }}
          class="absolute! top-3! right-3!"
        >
          <span class="font-symbol text-shadow-lg transition text-white opacity-50 hover:opacity-100 font-normal text-3xl"
            >eye_tracking</span
          >
        </button>
      {/if}
    </div>
  {/if}

  {#if icons.length > 1 && hovering}
    <div
      role="tooltip"
      onmouseenter={handleEnter}
      transition:fly={{ duration: 200, y: -16 }}
      class="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-10 flex gap-1 p-1"
    >
      {#each icons as src, i}
        <button
          onclick={(event: MouseEvent) => {
            event.stopPropagation();
            Storage.updateStoryCard($adventureId!, card.id, { iconIndex: i });
          }}
          class="group cursor-pointer overflow-hidden bg-transparent p-0 border-none leading-none"
        >
          <img
            {src}
            alt=""
            class="min-w-24 min-h-24 aspect-square object-cover transition group-hover:brightness-110"
            style:border-radius={"5%"}
          />
        </button>
      {/each}
    </div>
  {/if}

  {#if icon}
    <img
      src={icon}
      alt="Highlight icon"
      style:width={`${iconSize}px`}
      style:border-radius={borderRadius}
      style:border
      class="aspect-square object-cover self-center"
    />
  {/if}{text}
</span>
