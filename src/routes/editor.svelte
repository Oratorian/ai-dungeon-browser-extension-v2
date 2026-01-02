<script lang="ts">
  /* Lib */
  import { BitsConfig } from "bits-ui";

  /* Other */
  import { extensionState } from "@/utils/state.svelte";

  /* Routes */
  import Settings from "./editor/settings.svelte";
  import Tabs from "@/components/tabs.svelte";
  import { Tab } from "@/utils/types";
  import Adventure from "./editor/adventure.svelte";
  import ScrollArea from "@/components/scroll_area.svelte";
  import { fade, fly } from "svelte/transition";

  /* Editor */
  let portal: HTMLElement | undefined = $state();
</script>

{#if extensionState.isEditorOpen}
  <div
    transition:fade={{ duration: 150 }}
    class="flex fixed w-screen h-screen bg-theme-neutral-0/80 justify-center place-items-center z-1000"
  >
    <div
      transition:fly={{ duration: 200, y: 32 }}
      class="flex flex-col fixed w-[95vw] max-w-160 h-[95vh] bg-theme-neutral-0 rounded-2xl border border-theme-neutral-100 overflow-hidden"
    >
      <Tabs />
      <BitsConfig defaultPortalTo={portal}>
        <ScrollArea>
          {#if extensionState.editorTab === Tab.Adventure}
            <Adventure />
          {/if}

          {#if extensionState.editorTab === Tab.Settings}
            <Settings />
          {/if}
        </ScrollArea>
      </BitsConfig>
    </div>
  </div>
{/if}
<div bind:this={portal} class="absolute inset-0 z-10001 pointer-events-none"></div>
