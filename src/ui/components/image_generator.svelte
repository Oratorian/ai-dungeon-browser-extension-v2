<script lang="ts">
  import { settings } from "@/storage";
  import { generateWithOpenRouter, getRemainingCredit, OpenRouterError } from "@/media/openrouter";
  import { generateWithCivitai, CivitaiError } from "@/media/civitai";
  import { ASPECT_RATIOS } from "@/media/image_gen";
  import { uploadImage, TrinetraError } from "@/media/trinetra";
  import { compressInlineImage } from "@/media/compress";

  // Generate a card image from a prompt. Where the result lands is the user's choice, and the two
  // options have genuinely different costs: uploading to Trinetra stores a link and costs nothing
  // locally, while keeping it in the card stores the whole image and needs compressing first, or a
  // single generated image adds a megabyte or two to every load of every AI Dungeon tab.

  type Props = {
    /** Called with the finished image, either a Trinetra URL or a compressed data URI. */
    onaccept: (url: string) => void;
    /** Icons are square and small; graphics are larger and free-form. */
    square?: boolean;
    disabled?: boolean;
  };

  let { onaccept, square = false, disabled = false }: Props = $props();

  let prompt = $state("");
  let busy = $state(false);
  let stage = $state("");
  let error = $state("");
  let preview = $state<string | null>(null);
  let cost = $state<number | null>(null);
  let buzz = $state<number | null>(null);
  let credit = $state<number | null | undefined>(undefined);

  const civitai = $derived($settings.imageGenProvider === "civitai");
  const hasKey = $derived(
    (civitai ? $settings.civitaiKey : $settings.imageGenKey).trim().length > 0
  );
  const canUpload = $derived($settings.trinetraApiKey.trim().length > 0);
  // Uploading needs a Trinetra key as well; fall back to inline rather than failing at the end.
  const willUpload = $derived($settings.imageGenUpload && canUpload);

  async function run() {
    if (busy || disabled) return;
    busy = true;
    error = "";
    preview = null;
    cost = null;
    buzz = null;
    stage = "Generating...";

    try {
      let dataUri: string;

      if (civitai) {
        // Asynchronous and priced in Buzz, so it reports its own stage as it goes.
        const result = await generateWithCivitai(
          $settings.civitaiKey,
          $settings.civitaiModel,
          prompt,
          $settings.imageGenRatio,
          $settings.civitaiNegativePrompt,
          (s) => (stage = s)
        );
        dataUri = result.dataUri;
        buzz = result.buzz;
      } else {
        const result = await generateWithOpenRouter(
          $settings.imageGenKey,
          $settings.imageGenModel,
          prompt,
          $settings.imageGenRatio
        );
        dataUri = result.dataUri;
        cost = result.cost;
      }

      let stored: string;
      if (willUpload) {
        stage = "Uploading to Trinetra...";
        const uploaded = await uploadImage($settings.trinetraApiKey, dataUri, `generated-${Date.now()}.png`);
        stored = uploaded.url;
      } else {
        stage = "Compressing...";
        stored = await compressInlineImage(
          dataUri,
          square ? $settings.compressionResolutionIcon : $settings.compressionResolutionGraphic,
          $settings.compressionQuality,
          square
        );
      }

      preview = stored;
      // Refreshing the balance is a courtesy, never a reason to fail after a paid generation.
      // Civitai's consumer API exposes no balance, so this is OpenRouter only.
      if (!civitai) credit = await getRemainingCredit($settings.imageGenKey);
    } catch (e) {
      if (e instanceof OpenRouterError || e instanceof CivitaiError || e instanceof TrinetraError) error = e.message;
      else error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
      stage = "";
    }
  }

  function accept() {
    if (!preview) return;
    onaccept(preview);
    preview = null;
    prompt = "";
  }
</script>

<div class="flex flex-col gap-2">
  {#if !hasKey}
    <span class="text-xs text-theme-neutral-700">
      Add a {civitai ? "Civitai" : "OpenRouter"} API key under <b>Settings &rsaquo; Extension &rsaquo; Image Generation</b>
      to generate images from a prompt. Generations are billed to your own account.
    </span>
  {:else}
    <textarea
      bind:value={prompt}
      rows="2"
      placeholder="Describe the image, e.g. a weathered elven ranger, forest at dusk"
      class="w-full p-3 rounded-xl bg-theme-neutral-100 outline-0 text-sm resize-y"
    ></textarea>

    <div class="flex items-center gap-2">
      <select
        bind:value={$settings.imageGenRatio}
        class="bg-theme-neutral-100 rounded-lg px-2 py-1.5 text-xs outline-0 shrink-0"
      >
        {#each ASPECT_RATIOS as ratio}
          <option value={ratio}>{ratio}</option>
        {/each}
      </select>

      <span class="text-xs text-theme-neutral-700 truncate">
        {willUpload ? "Uploads to Trinetra" : "Stored in the card"}
      </span>

      <button
        onclick={run}
        disabled={busy || disabled || !prompt.trim()}
        class="flex items-center gap-1 px-3 py-1.5 ml-auto rounded-lg text-sm shrink-0 transition-colors
               bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme disabled:opacity-40"
      >
        <span class="font-symbol text-base">{busy ? "hourglass" : "auto_awesome"}</span>
        {busy ? stage || "Working..." : "Generate"}
      </button>
    </div>

    {#if $settings.imageGenUpload && !canUpload}
      <span class="text-xs text-pretty-orange">
        Trinetra upload is selected but no Trinetra key is set, so this will be stored in the card instead.
      </span>
    {/if}

    {#if error}
      <span class="text-xs text-pretty-red">{error}</span>
    {/if}

    {#if preview}
      <div class="flex items-center gap-3 p-2 bg-theme-neutral-100 rounded-xl">
        <img src={preview} alt="Generated preview" class="size-20 object-cover rounded-lg shrink-0" />
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <span class="text-xs text-theme-neutral-700">
            {#if cost !== null}Cost ${cost.toFixed(4)}{/if}
            {#if buzz !== null}{buzz} Buzz{/if}
            {#if credit !== undefined}
              {cost !== null ? " · " : ""}{credit === null ? "Unlimited credit" : `$${credit.toFixed(2)} left`}
            {/if}
          </span>
          <div class="flex gap-2">
            <button
              onclick={accept}
              class="px-3 py-1.5 rounded-lg text-sm bg-pretty-theme text-theme-neutral-0 hover:opacity-90 transition-all"
            >
              Use it
            </button>
            <button
              onclick={() => (preview = null)}
              class="px-3 py-1.5 rounded-lg text-sm text-theme-neutral-700 hover:text-pretty-red transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>
