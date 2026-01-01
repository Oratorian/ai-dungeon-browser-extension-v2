<script lang="ts">
  import { ScrollArea } from "bits-ui";

  type Props = {
    children?: any;
  };

  let { children }: Props = $props();
</script>

<ScrollArea.Root class="shadow-card relative overflow-hidden rounded-[10px] px-4 py-4">
  <ScrollArea.Viewport class="h-full w-full">
    <div class="flex flex-1 p-2 flex-col gap-2">
      {@render children?.()}
    </div>
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar
    orientation="vertical"
    hidden
    class="bg-theme-neutral-100 hover:bg-theme-neutral-200 data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out-0 data-[state=visible]:fade-in-0 flex w-2.5 touch-none select-none rounded-full border-l border-l-transparent p-px transition-all duration-200 hover:w-3"
  >
    <ScrollArea.Thumb class="bg-pretty-theme/0 flex-1 rounded-full" />
  </ScrollArea.Scrollbar>
  <ScrollArea.Scrollbar
    orientation="horizontal"
    class="bg-muted hover:bg-dark-10 flex h-2.5 touch-none select-none rounded-full border-t border-t-transparent p-px transition-all duration-200 hover:h-3 "
  >
    <ScrollArea.Thumb class="bg-muted-foreground rounded-full" />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner />
</ScrollArea.Root>
