<script lang="ts">
  import { Popover } from "bits-ui";

  type Props = {
    value?: string;
    onchange?: (color: string) => void;
  };

  let { value = $bindable("#f8ae2c"), onchange }: Props = $props();

  const presetColors = [
    { hex: "#f8ae2c", name: "Orange" },
    { hex: "#f3194d", name: "Red" },
    { hex: "#23c361", name: "Green" },
    { hex: "#ff0bd6", name: "Pink" },
    { hex: "#b35ae9", name: "Purple" },
    { hex: "#0bb0ff", name: "Blue" },
    { hex: "#ffffff", name: "White" },
    { hex: "#000000", name: "Black" },
  ];

  function handleColorChange(color: string) {
    value = color;
    onchange?.(color);
  }
</script>

<Popover.Root>
  <Popover.Trigger
    class="flex items-center gap-2 h-11 px-3 rounded-xl bg-theme-neutral-400 hover:bg-theme-neutral-500 transition-colors"
    aria-label="Open color picker"
  >
    <span class="size-6 rounded-md border-2 border-theme-neutral-500" style="background-color: {value};"></span>
    <span class="text-sm uppercase font-mono">{value}</span>
    <span class="font-symbol text-theme-neutral-800 ml-auto">palette</span>
  </Popover.Trigger>

  <Popover.Content
    sideOffset={8}
    class="z-50 bg-theme-neutral-300 rounded-xl p-3 shadow-popover animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
  >
    <div class="flex flex-col gap-3 w-fit">
      <div class="flex items-center gap-2">
        <label class="relative cursor-pointer">
          <input
            type="color"
            bind:value
            oninput={(e) => handleColorChange(e.currentTarget.value)}
            class="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Custom color picker"
          />
          <span
            class="block size-11 rounded-lg border-2 border-theme-neutral-500 hover:border-pretty-theme transition-colors"
            style="background-color: {value};"
          ></span>
        </label>
        <input
          type="text"
          {value}
          oninput={(e) => handleColorChange(e.currentTarget.value)}
          class="flex-1 h-11 px-3 bg-theme-neutral-100 rounded-lg outline-0 font-mono text-sm uppercase"
          maxlength="7"
          aria-label="Hex color value"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        {#each presetColors as color}
          <button
            onclick={() => handleColorChange(color.hex)}
            class="size-9 rounded-lg border-2 transition-transform hover:scale-110 {value === color.hex
              ? 'border-pretty-theme'
              : 'border-theme-neutral-500'}"
            style="background-color: {color.hex};"
            aria-label="Select {color.name}"
            title={color.name}
          ></button>
        {/each}
      </div>
    </div>
  </Popover.Content>
</Popover.Root>
