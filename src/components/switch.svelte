<script lang="ts">
  import { Switch } from "bits-ui";
  type Props = {
    checked: boolean;
  };

  let { checked = $bindable() }: Props = $props();
</script>

<div class="flex items-center space-x-3 place-self-end">
  <Switch.Root
    bind:checked
    class="data-[state=checked]:bg-pretty-theme bg-theme-neutral-100 hover:bg-pretty-theme/40 data-[state=unchecked]:shadow-mini-inset focus-visible:outline-hidden inline-flex h-9 min-h-9 w-15 shrink-0 cursor-pointer items-center rounded-full px-0.75 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Switch.Thumb
      class="bg-white data-[state=unchecked]:shadow-mini pointer-events-none block size-7.5 shrink-0 rounded-full transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0"
    />
  </Switch.Root>
</div>
