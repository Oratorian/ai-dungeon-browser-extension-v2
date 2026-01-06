<script lang="ts">
  import { Storage } from "@/utils/storage";
  import { ResponseType, StoryCard } from "@/utils/types";
  import DOMPurify from "dompurify";
  import { parseResponse } from "@/utils/parser";
  import Highlight from "./highlight.svelte";
  import Focus from "./focus.svelte";

  type Props = {
    rawHtml: string;
    type: ResponseType;
  };

  let { rawHtml, type }: Props = $props();

  let text = $derived(DOMPurify.sanitize(rawHtml));
  let map = $state(new Map<string, StoryCard>());

  Storage.cardMap.subscribe((value) => {
    map = value;
  });

  let chunks = $derived(parseResponse(text, map));
</script>

{#if type === ResponseType.LastAction}
  <Focus />{/if}<span>
  {#each chunks as chunk, i (i)}
    {#if chunk.type === "card"}
      {#if chunk.card.limit === "none" || (type === ResponseType.Action && chunk.card.limit === "action_only") || (type !== ResponseType.Action && chunk.card.limit === "story_only")}
        <Highlight card={chunk.card} text={chunk.content} />
      {:else}
        {chunk.content}
      {/if}
    {:else if chunk.type === "bold"}
      <b>{chunk.content}</b>
    {:else if chunk.type === "italic"}
      <em>{chunk.content}</em>
    {:else if chunk.type === "underline"}
      <u>{chunk.content}</u>
    {:else if chunk.type === "strikethrough"}
      <s>{chunk.content}</s>
    {:else}
      {chunk.content}
    {/if}
  {/each}
</span>
