<script lang="ts">
  import { Tab } from "@/utils/types";
  import { Label } from "bits-ui";
  import { fly, slide } from "svelte/transition";

  type TabButton = {
    icon: string;
    label: string;
    tab: Tab;
  };

  const tabBtns: TabButton[] = [
    {
      icon: "swords",
      label: "Adventure",
      tab: Tab.Adventure,
    },
    {
      icon: "discover_tune",
      label: "Settings",
      tab: Tab.Settings,
    },
  ];
</script>

<div class="flex w-full h-15 border-b border-theme-neutral-100">
  {#each tabBtns as btn}
    {@const isActive = extensionState.editorTab === btn.tab}
    <button
      onclick={() => {
        extensionState.editorTab = btn.tab;
      }}
      class="btn-tab flex-1 {isActive
        ? 'border-pretty-theme hover:bg-theme-neutral-100'
        : 'hover:border-theme-neutral-200 hover:bg-theme-neutral-100'}"
    >
      <span class="font-symbol text-xl text-theme-neutral-800">{btn.icon}</span>
      {#if isActive}
        <span
          in:fly={{ duration: 200, y: 8 }}
          class="font-bold {isActive ? 'text-shadow-theme-neutral-900' : 'text-theme-neutral-800 '}"
        >
          {btn.label}
        </span>
      {/if}
    </button>
  {/each}
  <button
    onclick={() => {
      extensionState.isEditorOpen = false;
    }}
    class="btn-tab aspect-square hover:bg-pretty-red"
  >
    <span class="font-symbol text-xl">close</span>
  </button>
</div>
