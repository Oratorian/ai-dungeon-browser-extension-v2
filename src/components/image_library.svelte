<script lang="ts">
  type Props = {
    images?: string[];
    onchange?: (images: string[]) => void;
    label?: string;
    maxImages?: number;
  };

  let { images = $bindable([]), onchange, label = "Image", maxImages = 6 }: Props = $props();

  let fileInput: HTMLInputElement;

  function handleAddClick() {
    fileInput?.click();
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (images.length >= maxImages) break;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        images = [...images, base64];
        onchange?.(images);
      };
      reader.readAsDataURL(file);
    }

    input.value = "";
  }

  function deleteImage(index: number) {
    images = images.filter((_, i) => i !== index);
    onchange?.(images);
  }
</script>

<input bind:this={fileInput} type="file" accept="image/*" multiple onchange={handleFileSelect} class="hidden" />

<div class="flex flex-col gap-3 w-full">
  <div class="flex items-center justify-between h-9">
    <span class="text-xs text-theme-neutral-700">
      {images.length}/{maxImages}
      {label.toLowerCase()}{images.length !== 1 ? "s" : ""}
    </span>
    <button
      onclick={handleAddClick}
      disabled={images.length >= maxImages}
      class="flex items-center gap-1 px-3 py-1.5 bg-pretty-theme/20 hover:bg-pretty-theme/30 disabled:opacity-40 disabled:cursor-not-allowed text-pretty-theme rounded-lg transition-colors text-sm"
    >
      <span class="font-symbol text-base text-pretty-theme">add</span>
      Add {label}
    </button>
  </div>

  <div class="h-20">
    {#if images.length === 0}
      <div class="flex flex-col items-center justify-center h-20 text-theme-neutral-700 bg-theme-neutral-300 rounded-xl">
        <span class="font-symbol text-2xl">image</span>
        <span class="text-xs">No {label.toLowerCase()}s yet</span>
      </div>
    {:else}
      <div class="flex gap-2">
        {#each images as image, index (index)}
          <div class="relative size-20 rounded-xl overflow-hidden bg-theme-neutral-300 group shrink-0">
            <img src={image} alt="{label} {index + 1}" class="w-full h-full object-cover" />
            <button
              onclick={() => deleteImage(index)}
              class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span class="font-symbol text-2xl text-pretty-red">delete</span>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
