<script lang="ts">
  import { slide } from "svelte/transition";

  type Props = {
    children?: any;
    foldout?: boolean;
    expanded?: boolean;
    icon?: string;
    label?: string;
  };

  let { children, foldout = false, expanded = false, icon, label }: Props = $props();
  let isOpen = $state(expanded);
</script>

<div class="flex flex-col w-full h-fit bg-theme-neutral-200 rounded-xl overflow-hidden">
  {#if foldout}
    <button
      onclick={() => (isOpen = !isOpen)}
      class="flex items-center gap-2 p-3 w-full hover:bg-theme-neutral-300 transition-colors"
    >
      {#if icon}
        <span class="font-symbol text-xl text-theme-neutral-800">{icon}</span>
      {/if}
      {#if label}
        <span class="font-bold text-sm">{label}</span>
      {/if}
      <span class="font-symbol text-xl text-theme-neutral-800 ml-auto transition-transform {isOpen ? 'rotate-180' : ''}">
        expand_more
      </span>
    </button>
    {#if isOpen}
      <div transition:slide={{ duration: 200 }} class="flex flex-col gap-2 p-2">
        {@render children?.()}
      </div>
    {/if}
  {:else}
    <div class="flex flex-col gap-2 p-2">
      {@render children?.()}
    </div>
  {/if}
</div>
