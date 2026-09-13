<script lang="ts">
  import { Storage } from "@/storage";
  import { ResponseType, type StoryCard } from "@/shared/types";
  import { parseResponse } from "@/rendering/parser";
  import { RESPONSE_SANITIZE_CONFIG, sanitizeResponseHtml } from "@/rendering/sanitize";
  import Highlight from "./highlight.svelte";
  import Focus from "./focus.svelte";
  import { safeHtml } from "@/ui/actions/safe_html";

  /* Storage */
  import { settings } from "@/storage";

  type Props = {
    rawHtml: string;
    type: ResponseType;
  };

  let { rawHtml, type }: Props = $props();

  // Reduced to text, inline formatting and line breaks before the parser sees it; see
  // rendering/sanitize.ts for why every attribute has to go.
  const SANITIZE_CONFIG = RESPONSE_SANITIZE_CONFIG;

  let text = $derived(sanitizeResponseHtml(rawHtml));
  let map = $state(new Map<string, StoryCard>());

  Storage.cardMap.subscribe((value) => {
    map = value;
  });

  let chunks = $derived(parseResponse(text, map));
</script>

{#if type === ResponseType.LastAction}
  <Focus />{/if}<span style="color: {$settings.customTextColor ? $settings.textColor : 'inherit'}">
  {#each chunks as chunk, i (i)}
    {#if chunk.type === "card"}
      {#if chunk.card.limit === "none" || (type === ResponseType.Action && (chunk.card.limit === "action_only" || (chunk.card.limit === "protagonist" && i === 0))) || (type !== ResponseType.Action && chunk.card.limit === "story_only")}
        <Highlight card={chunk.card} text={chunk.content} />
      {:else}
        <span use:safeHtml={{ html: chunk.content, config: SANITIZE_CONFIG }}></span>
      {/if}
    {:else if chunk.type === "bold"}
      <b use:safeHtml={{ html: chunk.content, config: SANITIZE_CONFIG }}></b>
    {:else if chunk.type === "italic"}
      <em use:safeHtml={{ html: chunk.content, config: SANITIZE_CONFIG }}></em>
    {:else if chunk.type === "underline"}
      <u use:safeHtml={{ html: chunk.content, config: SANITIZE_CONFIG }}></u>
    {:else if chunk.type === "strikethrough"}
      <s use:safeHtml={{ html: chunk.content, config: SANITIZE_CONFIG }}></s>
    {:else}
      <span use:safeHtml={{ html: chunk.content, config: SANITIZE_CONFIG }}></span>
    {/if}
  {/each}
</span>
