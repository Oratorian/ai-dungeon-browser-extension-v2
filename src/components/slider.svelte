<script lang="ts">
  import { Slider } from "bits-ui";

  type Props = {
    value: number;
    min?: number;
    max?: number;
    step?: number;
  };

  let { value = $bindable(), min = 0, max = 100, step }: Props = $props();
</script>

<div class="flex flex-row gap-2 justify-center place-items-center w-full">
  <input
    type="number"
    bind:value
    class="aspect-square w-11 h-11 bg-theme-neutral-100 rounded-xl outline-0 justify-center place-items-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] text-center"
  />
  <Slider.Root type="single" bind:value {min} {max} {step} class="relative flex w-full touch-none select-none items-center">
    <span class="bg-theme-neutral-100 relative h-2 w-full grow cursor-pointer overflow-hidden rounded-full">
      <Slider.Range class="bg-pretty-theme absolute h-full" />
    </span>
    <Slider.Thumb
      index={0}
      class="bg-theme-neutral-900 hover:bg-pretty-theme focus-visible:ring-foreground  data-active:border-dark-40 focus-visible:outline-hidden data-active:scale-[0.98] block size-6.25 cursor-pointer rounded-full border-4 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    />
  </Slider.Root>
</div>
