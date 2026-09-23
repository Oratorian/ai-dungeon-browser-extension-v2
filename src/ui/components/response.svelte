<script lang="ts">
  import { Storage } from "@/storage";
  import { ResponseType } from "@/shared/types";
  import { parseResponseHtml, type ResponseNode } from "@/rendering/response_tree";
  import Highlight from "./highlight.svelte";
  import Focus from "./focus.svelte";

  /* Storage */
  import { settings } from "@/storage";

  type Props = {
    rawHtml: string;
    type: ResponseType;
  };

  let { rawHtml, type }: Props = $props();

  const cardMap = Storage.cardMap;
  let nodes = $derived(parseResponseHtml(rawHtml, $cardMap));
</script>

{#snippet renderNodes(children: ResponseNode[])}
  {#each children as node, position (position)}
    {#if node.type === "element"}
      {#if node.tag === "br"}
        <br />
      {:else}
        <svelte:element this={node.tag}>{@render renderNodes(node.children)}</svelte:element>
      {/if}
    {:else}
      {@const chunk = node.chunk}
      {#if chunk.type === "card"}
        {#if chunk.card.limit === "none" || (type === ResponseType.Action && (chunk.card.limit === "action_only" || (chunk.card.limit === "protagonist" && node.index === 0))) || (type !== ResponseType.Action && chunk.card.limit === "story_only")}
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
    {/if}
  {/each}
{/snippet}

{#if type === ResponseType.LastAction}<Focus />{/if}
<span style="color: {$settings.customTextColor ? $settings.textColor : 'inherit'}">
  {@render renderNodes(nodes)}
</span>
