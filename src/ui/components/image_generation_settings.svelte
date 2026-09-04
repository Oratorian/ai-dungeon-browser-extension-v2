<script lang="ts">
  import Field from "@/ui/components/field.svelte";
  import Switch from "@/ui/components/switch.svelte";
  import { settings } from "@/storage";
  import { getRemainingCredit, DEFAULT_MODEL } from "@/media/openrouter";

  // Key, model and destination for prompt-based image generation. The generator itself lives on each
  // card's image list, since that is where a generated image is actually wanted.

  let checking = $state(false);
  let status = $state("");

  const hasTrinetra = $derived($settings.trinetraApiKey.trim().length > 0);

  async function checkKey() {
    checking = true;
    status = "";
    try {
      const credit = await getRemainingCredit($settings.imageGenKey);
      if (credit === undefined) status = "That key was not accepted.";
      else if (credit === null) status = "Key works, no credit limit on this account.";
      else status = `Key works, $${credit.toFixed(2)} remaining.`;
    } finally {
      checking = false;
    }
  }
</script>

<Field
  label="OpenRouter API Key"
  info="Your own key from openrouter.ai.<br>Generations are billed to <b>your</b> account, and the key is stored locally like every other extension setting."
>
  <input
    type="password"
    bind:value={$settings.imageGenKey}
    placeholder="sk-or-..."
    class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-sm"
  />
</Field>

{#if $settings.imageGenKey.trim()}
  <div class="flex items-center gap-2">
    <button
      onclick={checkKey}
      disabled={checking}
      class="px-3 py-1.5 rounded-lg text-sm bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme transition-colors disabled:opacity-60"
    >
      {checking ? "Checking..." : "Check key"}
    </button>
    {#if status}<span class="text-xs text-theme-neutral-700">{status}</span>{/if}
  </div>
{/if}

<Field
  label="Model"
  info="Any image-capable model id from OpenRouter.<br>A model that only returns text will report that rather than producing an image."
>
  <input
    type="text"
    bind:value={$settings.imageGenModel}
    placeholder={DEFAULT_MODEL}
    class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-sm font-mono"
  />
</Field>

<Field
  label="Upload to Trinetra"
  info="Where a generated image is kept.<br><b>On</b>: uploaded to Trinetra, and the card stores only the link, which costs nothing locally.<br><b>Off</b>: compressed and stored inside the card, which is simpler but grows your local storage.<br><em>Needs a Trinetra API key, set under Story Cards where you browse images.</em>"
>
  <Switch bind:checked={$settings.imageGenUpload} />
</Field>

{#if $settings.imageGenUpload && !hasTrinetra}
  <span class="text-xs text-pretty-orange">
    No Trinetra API key is set, so generated images will be stored in the card until you add one.
  </span>
{/if}
