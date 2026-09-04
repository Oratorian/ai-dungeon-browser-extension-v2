<script lang="ts">
  import Field from "@/ui/components/field.svelte";
  import Switch from "@/ui/components/switch.svelte";
  import { settings } from "@/storage";
  import { getRemainingCredit } from "@/media/openrouter";
  import { verifyKey as verifyCivitaiKey } from "@/media/civitai";

  // Provider, key and destination for prompt-based image generation. The generator itself lives on
  // each card's image list, since that is where a generated image is actually wanted.
  //
  // The two providers work differently enough to be worth knowing about: OpenRouter answers in one
  // call and bills in dollars, Civitai queues a job, bills in Buzz, and takes a model AIR rather than
  // a plain model name.

  const providers = [
    { id: "openrouter" as const, label: "OpenRouter", hint: "One call, billed in $" },
    { id: "civitai" as const, label: "Civitai", hint: "Queued job, billed in Buzz" },
  ];

  let checking = $state(false);
  let status = $state("");

  const civitai = $derived($settings.imageGenProvider === "civitai");
  const hasTrinetra = $derived($settings.trinetraApiKey.trim().length > 0);

  async function checkKey() {
    checking = true;
    status = "";
    try {
      if (civitai) {
        status = (await verifyCivitaiKey($settings.civitaiKey)) ? "Key works." : "That key was not accepted.";
      } else {
        const credit = await getRemainingCredit($settings.imageGenKey);
        if (credit === undefined) status = "That key was not accepted.";
        else if (credit === null) status = "Key works, no credit limit on this account.";
        else status = `Key works, $${credit.toFixed(2)} remaining.`;
      }
    } finally {
      checking = false;
    }
  }
</script>

<Field label="Provider" info="Where images are generated. Each uses its own API key and its own model naming.">
  <div class="flex gap-1 p-1 bg-theme-neutral-100 rounded-xl">
    {#each providers as provider (provider.id)}
      {@const active = $settings.imageGenProvider === provider.id}
      <button
        onclick={() => {
          $settings.imageGenProvider = provider.id;
          status = "";
        }}
        class="flex flex-col flex-1 items-center px-3 py-2 rounded-lg text-sm transition-colors {active
          ? 'bg-theme-neutral-0 text-pretty-theme font-bold'
          : 'text-theme-neutral-800 hover:bg-theme-neutral-300'}"
      >
        {provider.label}
        <span class="text-[10px] font-normal text-theme-neutral-700">{provider.hint}</span>
      </button>
    {/each}
  </div>
</Field>

{#if civitai}
  <Field
    label="Civitai API Key"
    info="From your Civitai account settings.<br>Generations cost <b>Buzz</b> from your own account, and the key is stored locally like every other setting."
  >
    <input
      type="password"
      bind:value={$settings.civitaiKey}
      class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-sm"
    />
  </Field>

  <Field
    label="Model (AIR)"
    info="Civitai addresses models by AIR, not by name.<br>Find it on a model's page, in the form <code>urn:air:sdxl:checkpoint:civitai:&lt;model&gt;@&lt;version&gt;</code>.<br>The default is SDXL 1.0 base."
  >
    <input
      type="text"
      bind:value={$settings.civitaiModel}
      class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-xs font-mono"
    />
  </Field>

  <Field label="Negative Prompt" info="Applied to every Civitai generation, for the things you never want in an image.">
    <input
      type="text"
      bind:value={$settings.civitaiNegativePrompt}
      class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-sm"
    />
  </Field>
{:else}
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

  <Field
    label="Model"
    info="Any image-capable model id from OpenRouter.<br>A model that only returns text will report that rather than producing an image."
  >
    <input
      type="text"
      bind:value={$settings.imageGenModel}
      class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-sm font-mono"
    />
  </Field>
{/if}

{#if (civitai ? $settings.civitaiKey : $settings.imageGenKey).trim()}
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
  label="Upload to Trinetra"
  info="Where a generated image is kept.<br><b>On</b>: uploaded to Trinetra, and the card stores only the link, which costs nothing locally.<br><b>Off</b>: compressed and stored inside the card, which is simpler but grows your local storage.<br><em>Needs a Trinetra API key, set where you browse images on a card.</em>"
>
  <Switch bind:checked={$settings.imageGenUpload} />
</Field>

{#if $settings.imageGenUpload && !hasTrinetra}
  <span class="text-xs text-pretty-orange">
    No Trinetra API key is set, so generated images will be stored in the card until you add one.
  </span>
{/if}
