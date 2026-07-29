<script lang="ts">
  import { parseImageInput } from "@/utils/image_url";
  import { fetchImageAsDataUri, TrinetraError } from "@/utils/trinetra";
  import TrinetraPicker from "./trinetra_picker.svelte";

  type Props = {
    images?: string[];
    onchange?: (images: string[]) => void;
    label?: string;
    maxImages?: number;
  };

  let { images = $bindable([]), onchange, label = "Image", maxImages = 6 }: Props = $props();

  let fileInput: HTMLInputElement;

  // Add flow: null = closed, "menu" = choose source, "url" = url entry, "trinetra" = image picker.
  let addMode = $state<null | "menu" | "url" | "trinetra">(null);
  let urlValue = $state("");
  let urlError = $state("");
  let urlBusy = $state(false);

  let full = $derived(images.length >= maxImages);

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

  // Called by the picker with a base64 data URI. Returns whether it was added.
  function addFromPicker(dataUri: string): boolean {
    if (images.length >= maxImages) return false;
    addImage(dataUri);
    return true;
  }

  function addImage(src: string) {
    if (images.length >= maxImages) return;
    images = [...images, src];
    onchange?.(images);
  }

  async function submitUrl() {
    if (urlBusy) return;
    const parsed = parseImageInput(urlValue);
    if (!parsed.ok) {
      urlError = parsed.error;
      return;
    }
    if (images.length >= maxImages) {
      urlError = "Maximum number of images reached.";
      return;
    }
    urlBusy = true;
    urlError = "";
    try {
      // Download and store inline (base64) so the image is self-contained.
      const dataUri = await fetchImageAsDataUri(parsed.url);
      addImage(dataUri);
      closeAdd();
    } catch (e) {
      urlError = e instanceof TrinetraError ? e.message : "Couldn't download that image.";
    } finally {
      urlBusy = false;
    }
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
        addImage(reader.result as string);
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
          disabled={urlBusy}
          autofocus
          placeholder="Image ID or trinetra.mahesvara.cloud URL"
          class="flex-1 min-w-0 bg-theme-neutral-100 h-9 px-3 rounded-lg outline-0 text-sm disabled:opacity-50"
        />
        <button
          onclick={submitUrl}
          disabled={urlBusy}
          class="px-3 py-1.5 bg-pretty-theme text-theme-neutral-0 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all text-sm"
        >
          {urlBusy ? "Adding..." : "Add"}
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
    <TrinetraPicker onselect={addFromPicker} canAddMore={!full} onclose={closeAdd} />
  {/if}

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
            <img
              src={image}
              alt="{label} {index + 1}"
              class="w-full h-full object-cover"
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
