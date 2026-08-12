<script lang="ts">
  import { Select, type WithoutChildren } from "bits-ui";

  type Props = WithoutChildren<Select.RootProps> & {
    placeholder?: string;
    items: { value: string; label: string; disabled?: boolean }[];
    contentProps?: WithoutChildren<Select.ContentProps>;
    icon?: string;
    ariaLabel?: string;
  };

  let { value = $bindable(), items, contentProps, placeholder, icon, ariaLabel, allowDeselect, ...restProps }: Props = $props();

  const selectedLabel = $derived(items.find((item) => item.value === value)?.label);
</script>

<Select.Root type="single" onValueChange={(v) => (value = v)} {items} {allowDeselect}>
  <Select.Trigger
    class="h-input p-3 rounded-9px bg-theme-neutral-400 hover:bg-theme-neutral-500 text-white data-placeholder:text-foreground-alt/50 inline-flex touch-none select-none items-center px-2.75 text-sm transition-colors rounded-xl"
    aria-label={ariaLabel}
  >
    {#if icon}
      <span class="text-theme-neutral-800 mr-2.25 font-symbol">{icon}</span>
    {/if}
    {selectedLabel}
    <span class="text-theme-neutral-800 ml-auto font-symbol">expand_all</span>
  </Select.Trigger>
  <Select.Portal>
    <Select.Content
      class="bg-theme-neutral-400 shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 outline-hidden z-50 h-fit max-h-(--bits-select-content-available-height) w-(--bits-select-anchor-width) min-w-(--bits-select-anchor-width) select-none rounded-xl px-1 py-3 data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1"
    >
      <Select.ScrollUpButton class="flex w-full items-center justify-center">
        <span class="text-theme-neutral-700 mr-2.25 font-symbol">keyboard_arrow_up</span>
      </Select.ScrollUpButton>
      <Select.Viewport>
        {#each items as item, i (i + item.value)}
          <Select.Item
            class="outline-hidden hover:bg-theme-neutral-500 rounded-xl data-disabled:opacity-50 flex h-10 w-full select-none items-center py-3 pl-5 pr-1.5 text-sm capitalize cursor-pointer"
            value={item.value}
            label={item.label}
          >
            {#snippet children({ selected })}
              {item.label}
              {#if selected}
                <div class="ml-auto">
                  <span class="font-symbol">check</span>
                </div>
              {/if}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
      <Select.ScrollDownButton class="flex w-full items-center justify-center">
        <span class="text-theme-neutral-800 text-xl mr-2.25 font-symbol">keyboard_arrow_down</span>
      </Select.ScrollDownButton>
    </Select.Content>
  </Select.Portal>
</Select.Root>
