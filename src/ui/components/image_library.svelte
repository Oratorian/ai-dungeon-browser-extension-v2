<script lang="ts">
  import { parseImageInput } from "@/media/image_url";
  import TrinetraPicker from "./trinetra_picker.svelte";
  import ImageGenerator from "./image_generator.svelte";
  import { settings } from "@/storage";
  import { compressInlineImage } from "@/media/compress";

  type Props = {
    images?: string[];
    onchange?: (images: string[]) => void;
    label?: string;
    maxImages?: number;
    selectedIndex?: number | null;
    onselect?: (index: number) => void;
  };

  let { images = $bindable([]), onchange, label = "Image", maxImages = 6, selectedIndex = null, onselect }: Props = $props();

  let fileInput: HTMLInputElement;

  // Add flow: null = closed, "menu" = choose source, "url" = url entry, "trinetra" = image picker.
  let addMode = $state<null | "menu" | "url" | "trinetra" | "generate">(null);
  let urlValue = $state("");
  let urlError = $state("");

  let full = $derived(images.length >= maxImages);
  // Icons render in a small square box; graphics in a tooltip. Decides the size limit and crop.
  const square = $derived(label === "Icon");

  function openMenu() {
    if (full) return;
    addMode = "menu";
  }

  function closeAdd() {
    addMode = null;
    urlValue = "";
    urlError = "";
  }

  function startUpload() {
    closeAdd();
    fileInput?.click();
  }

  function startUrl() {
    addMode = "url";
    urlValue = "";
    urlError = "";
  }

  function startTrinetra() {
    addMode = "trinetra";
  }

  function startGenerate() {
    addMode = "generate";
  }

  // The generator hands back whatever it produced: a Trinetra URL, or a compressed data URI.
  function addGenerated(url: string) {
    if (images.length >= maxImages) return;
    addImage(url);
    closeAdd();
  }

  // Called by the picker with the image's Trinetra URL. Returns whether it was added.
  function addFromPicker(url: string): boolean {
    if (images.length >= maxImages || images.includes(url)) return false;
    addImage(url);
    return true;
  }

  function addImage(src: string) {
    if (images.length >= maxImages) return;
    images = [...images, src];
    onchange?.(images);
    onselect?.(images.length - 1);
  }

  function submitUrl() {
    const parsed = parseImageInput(urlValue);
    if (!parsed.ok) {
      urlError = parsed.error;
      return;
    }
    if (images.length >= maxImages) {
      urlError = "Maximum number of images reached.";
      return;
    }
    // Store the Trinetra URL as a link (not embedded) so adventure exports stay small; the image
    // loads live from Trinetra when the card renders.
    addImage(parsed.url);
    closeAdd();
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (images.length >= maxImages) break;

      const reader = new FileReader();
      reader.onload = async () => {
        const raw = reader.result as string;
        // Compressed on the way in when enabled, so a full-resolution photo never lands in storage.
        // compressInlineImage keeps the original if the result would not be smaller, so this is
        // safe to run on anything.
        addImage(
          $settings.compressOnUpload
            ? await compressInlineImage(
                raw,
                square ? $settings.compressionResolutionIcon : $settings.compressionResolutionGraphic,
                $settings.compressionQuality,
                square
              )
            : raw
        );
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
      onclick={openMenu}
      disabled={full}
      class="flex items-center gap-1 px-3 py-1.5 bg-pretty-theme/20 hover:bg-pretty-theme/30 disabled:opacity-40 disabled:cursor-not-allowed text-pretty-theme rounded-lg transition-colors text-sm"
    >
      <span class="font-symbol text-base text-pretty-theme">add</span>
      Add {label}
    </button>
  </div>

  {#if addMode === "menu"}
    <!-- Rendered inline (not an absolute popover) so it can't be clipped by the card
         dialog's overflow-y-auto, regardless of where this library sits in the dialog. -->
    <div class="flex flex-wrap gap-2">
      <button
        onclick={startUpload}
        class="flex items-center gap-2 px-3 py-2 text-sm text-theme-neutral-800 bg-theme-neutral-100 hover:bg-theme-neutral-300 rounded-lg transition-colors"
      >
        <span class="font-symbol text-base">upload</span>
        Upload file
      </button>
      <button
        onclick={startUrl}
        class="flex items-center gap-2 px-3 py-2 text-sm text-theme-neutral-800 bg-theme-neutral-100 hover:bg-theme-neutral-300 rounded-lg transition-colors"
      >
        <span class="font-symbol text-base">link</span>
        Paste URL
      </button>
      <button
        onclick={startTrinetra}
        class="flex items-center gap-2 px-3 py-2 text-sm text-theme-neutral-800 bg-theme-neutral-100 hover:bg-theme-neutral-300 rounded-lg transition-colors"
      >
        <span class="font-symbol text-base">photo_library</span>
        Browse Trinetra
      </button>
      {#if ($settings.imageGenProvider === "civitai" ? $settings.civitaiKey : $settings.imageGenKey).trim()}
        <button
          onclick={startGenerate}
          class="flex items-center gap-2 px-3 py-2 text-sm text-theme-neutral-800 bg-theme-neutral-100 hover:bg-theme-neutral-300 rounded-lg transition-colors"
        >
          <span class="font-symbol text-base">auto_awesome</span>
          Generate
        </button>
      {/if}
    </div>
  {/if}

  {#if addMode === "url"}
    <div class="flex flex-col gap-1">
      <div class="flex gap-2">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          bind:value={urlValue}
          onkeydown={(e) => {
            if (e.key === "Enter") submitUrl();
            if (e.key === "Escape") closeAdd();
          }}
          oninput={() => (urlError = "")}
          autofocus
          placeholder="Image ID or trinetra.mahesvara.cloud URL"
          class="flex-1 min-w-0 bg-theme-neutral-100 h-9 px-3 rounded-lg outline-0 text-sm"
        />
        <button
          onclick={submitUrl}
          class="px-3 py-1.5 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 transition-all text-sm"
        >
          Add
        </button>
        <button
          onclick={closeAdd}
          class="px-3 py-1.5 rounded-lg hover:bg-theme-neutral-300 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
      {#if urlError}
        <span class="text-xs text-pretty-red px-1">{urlError}</span>
      {/if}
      <span class="text-xs text-theme-neutral-700 px-1">
        Only <a
          href="https://trinetra.mahesvara.cloud/#register"
          target="_blank"
          rel="noopener noreferrer"
          class="text-pretty-theme hover:underline">Trinetra</a
        > image URLs are supported.
      </span>
    </div>
  {/if}

  {#if addMode === "trinetra"}
    <TrinetraPicker selectedUrls={images} onselect={addFromPicker} canAddMore={!full} onclose={closeAdd} />
  {/if}

  {#if addMode === "generate"}
    <div class="flex flex-col gap-2 p-2 bg-theme-neutral-200 rounded-xl">
      <ImageGenerator onaccept={addGenerated} square={label === "Icon"} disabled={full} />
      <button onclick={closeAdd} class="text-xs text-theme-neutral-700 hover:text-theme-neutral-900 place-self-end">
        Close
      </button>
    </div>
  {/if}

  <div>
    {#if images.length === 0}
      <div class="flex flex-col items-center justify-center h-20 text-theme-neutral-700 bg-theme-neutral-300 rounded-xl">
        <span class="font-symbol text-2xl">image</span>
        <span class="text-xs">No {label.toLowerCase()}s yet</span>
      </div>
    {:else}
      <div class="image-previews" class:portrait-previews={label === "Graphic"}>
        {#each images as image, index (index)}
          <div class="image-preview" class:selected={selectedIndex === index}>
            {#snippet thumbnail()}
            <img
              src={image}
              alt="{label} {index + 1}"
              class="preview-image"
              onerror={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = "none";
                const ph = img.nextElementSibling as HTMLElement | null;
                if (ph) ph.style.display = "flex";
              }}
            />
            <div
              class="absolute inset-0 hidden flex-col items-center justify-center text-theme-neutral-700 pointer-events-none"
            >
              <span class="font-symbol text-2xl">broken_image</span>
            </div>
            {/snippet}
            {#if onselect}
              <button class="preview-select" aria-label="Edit {label.toLowerCase()} {index + 1}" aria-pressed={selectedIndex === index}
                title={label === "Icon" ? "Click to link this icon to a graphic" : "Click to edit picture switching"} onclick={() => onselect?.(index)}>
                {@render thumbnail()}
              </button>
            {:else}
              {@render thumbnail()}
            {/if}
            <button
              onclick={() => deleteImage(index)}
              class="delete-pill" aria-label="Remove {label.toLowerCase()} {index + 1}" title="Remove this picture"
            >
              <span class="font-symbol text-lg" aria-hidden="true">delete</span>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .image-previews { display: flex; flex-wrap: wrap; gap: 12px; }
  .image-preview { position: relative; flex-shrink: 0; width: 80px; height: 80px; border: 2px solid transparent; border-radius: 12px; background: var(--color-theme-neutral-300); }
  .portrait-previews .image-preview { width: 112px; height: 144px; }
  .preview-image { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; }
  .portrait-previews .preview-image { object-fit: contain; }
  .preview-select { display: block; width: 100%; height: 100%; padding: 0; border: 0; border-radius: 10px; background: transparent; cursor: pointer; }
  .preview-select:hover { background: #ffffff0d; }
  .image-preview.selected { border-color: var(--color-pretty-theme, #f8ae2c); }
  .delete-pill { position: absolute; z-index: 1; top: 5px; right: 5px; display: flex; align-items: center; justify-content: center; width: 28px; height: 24px; padding: 0; border: 1px solid #ffffff40; border-radius: 20px; background: #10171ddd; color: #eeb8b8; cursor: pointer; }
  .delete-pill:hover { background: #782c34; color: #fff; }
  .preview-select:focus-visible, .delete-pill:focus-visible { outline: 2px solid var(--color-pretty-theme, #f8ae2c); outline-offset: 3px; }
</style>
