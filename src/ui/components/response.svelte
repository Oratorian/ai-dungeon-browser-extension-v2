<script lang="ts">
  import { Storage } from "@/storage";
  import { ResponseType, type StoryCard } from "@/shared/types";
  import DOMPurify from "dompurify";
  import { parseResponse } from "@/rendering/parser";
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

  // AI Dungeon injects transparent theme/spacer <img> elements whose class is atomic-CSS soup full
  // of underscores (e.g. "_View _pos-relative _fd-column ..."). Our markdown parser treats those
  // underscores as italic/bold markers and shreds the tags, leaking raw class/src/style text into
  // the story. So we sanitize down to plain text plus inline formatting and line breaks, dropping
  // every attribute and the spacer images before anything reaches the parser. This also keeps us
  // resilient to AID reshuffling its presentational markup.
  const SANITIZE_CONFIG = {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "strike", "del", "mark", "sup", "sub", "code", "span", "p", "br"],
    ALLOWED_ATTR: [],
  };

  let text = $derived(DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG));
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
