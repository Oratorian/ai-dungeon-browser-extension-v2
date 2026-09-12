<script lang="ts">
  import Field from "@/ui/components/field.svelte";
  import Switch from "@/ui/components/switch.svelte";
  import Slider from "@/ui/components/slider.svelte";
  import Select from "@/ui/components/select.svelte";
  import { settings } from "@/storage";
  import { getRemainingCredit, OPENROUTER_MODELS, OPENROUTER_DEFAULT_MODEL } from "@/media/openrouter";
  import { verifyKey as verifyCivitaiKey, resolveModel, CivitaiError, SCHEDULERS } from "@/media/civitai";

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

  // Pasting a model link is the sane way in: the AIR's ecosystem segment is the base model, which is
  // not something a user can reliably guess from the page (an ordinary-looking checkpoint can be
  // "anima" rather than "sdxl"), and a wrong guess is a rejected job.
  let modelLink = $state("");
  let resolving = $state(false);
  let resolved = $state("");
  let resolveWarning = $state("");
  let appliedDefaults = $state("");
  let resolveError = $state("");

  async function lookup() {
    resolving = true;
    resolved = "";
    resolveWarning = "";
    appliedDefaults = "";
    resolveError = "";
    try {
      const model = await resolveModel(modelLink);
      $settings.civitaiModel = model.air;
      resolved = `${model.name} (${model.version}), base ${model.baseModel}`;

      // Adopt the settings the model's own samples were made with. A fine-tuned checkpoint often
      // wants very different numbers from the generic default, and the author's are the best guess
      // available without generating anything.
      const { steps, cfgScale, scheduler } = model.defaults;
      if (steps) $settings.civitaiSteps = steps;
      if (cfgScale) $settings.civitaiCfgScale = cfgScale;
      if (scheduler) $settings.civitaiScheduler = scheduler;
      appliedDefaults = [
        steps ? `${steps} steps` : null,
        cfgScale ? `CFG ${cfgScale}` : null,
        scheduler ? (SCHEDULERS.find((x) => x.value === scheduler)?.label ?? scheduler) : null,
      ]
        .filter(Boolean)
        .join(", ");
      // Still applied, since the list of supported bases is ours and will age, but worth saying
      // before a generation is paid for and then fails with no reason given.
      if (model.support === "unknown") {
        resolveWarning =
          `${model.baseModel} is not a base we have seen generate. It may work; if it fails, the ` +
          `Buzz is still spent, so try one image before relying on it.`;
      }
      modelLink = "";
    } catch (e) {
      resolveError = e instanceof CivitaiError ? e.message : e instanceof Error ? e.message : String(e);
    } finally {
      resolving = false;
    }
  }

  const civitai = $derived($settings.imageGenProvider === "civitai");
  const modelItems = OPENROUTER_MODELS.map((m) => ({
    value: m.value,
    label: m.note ? `${m.label} (${m.note})` : m.label,
  }));

  const schedulerItems = SCHEDULERS.map((s) => ({ value: s.value, label: s.label }));

  // Starts in whichever mode the stored value implies, then the user drives it. Not derived: once
  // they have chosen to type an id, the field must not vanish the moment it stops matching a listed
  // one, which is exactly while they are still typing it.
  let useCustomModel = $state(!OPENROUTER_MODELS.some((m) => m.value === $settings.imageGenModel));

  function toggleCustomModel() {
    useCustomModel = !useCustomModel;
    // Coming back to the list with an id that is not on it would leave the control blank.
    if (!useCustomModel && !OPENROUTER_MODELS.some((m) => m.value === $settings.imageGenModel)) {
      $settings.imageGenModel = OPENROUTER_DEFAULT_MODEL;
    }
  }
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
    label="Model"
    info="Paste a Civitai model link and the exact identifier is looked up for you.<br>Guessing it by hand is unreliable: the identifier encodes the <b>base model</b>, so a normal-looking checkpoint can be <code>anima</code> rather than <code>sdxl</code>, and a wrong guess is simply rejected."
  >
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={modelLink}
        placeholder="https://civitai.com/models/..."
        class="bg-theme-neutral-100 flex-1 min-w-0 min-h-11 p-3 outline-0 rounded-xl text-sm"
      />
      <button
        onclick={lookup}
        disabled={resolving || !modelLink.trim()}
        class="px-3 rounded-xl text-sm shrink-0 bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme transition-colors disabled:opacity-40"
      >
        {resolving ? "..." : "Look up"}
      </button>
    </div>
  </Field>

  {#if resolveError}
    <span class="text-xs text-pretty-red">{resolveError}</span>
  {:else if resolved}
    <span class="text-xs text-pretty-green">Using {resolved}</span>
    {#if resolveWarning}
      <span class="text-xs text-pretty-orange">{resolveWarning}</span>
    {/if}
  {/if}

  <Field label="Model ID" info="The resolved identifier that is actually sent. You can paste one directly if you have it.">
    <input
      type="text"
      bind:value={$settings.civitaiModel}
      class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-xs font-mono"
    />
  </Field>

  {#if appliedDefaults}
    <span class="text-xs text-theme-neutral-700">Adopted from this model's samples: {appliedDefaults}</span>
  {/if}

  <Field
    label="Sampler"
    info="Civitai combines the sampler and its noise schedule into one choice, so the Karras entries are the Karras schedule.<br>Set automatically from a model's sample images when they say."
  >
    <Select bind:value={$settings.civitaiScheduler} items={schedulerItems} ariaLabel="Sampler" />
  </Field>

  <Field label="Steps" info="How many sampling steps. More is slower and costs more Buzz, with diminishing returns past roughly 30.">
    <Slider bind:value={$settings.civitaiSteps} min={5} max={60} step={1} />
  </Field>

  <Field
    label="CFG Scale"
    info="How closely the image follows the prompt.<br>Low is loose and often more natural, high is literal and can look overcooked."
  >
    <Slider bind:value={$settings.civitaiCfgScale} min={1} max={20} step={1} />
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
    info="Every image model OpenRouter currently offers, cheapest first.<br>A model that only returns text will say so rather than producing an image."
  >
    {#if useCustomModel}
      <input
        type="text"
        bind:value={$settings.imageGenModel}
        placeholder="provider/model-id"
        class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-sm font-mono"
      />
    {:else}
      <Select bind:value={$settings.imageGenModel} items={modelItems} ariaLabel="Image model" />
    {/if}
  </Field>

  <button
    onclick={toggleCustomModel}
    class="text-xs text-theme-neutral-700 hover:text-theme-neutral-900 place-self-start ml-4 transition-colors"
  >
    {useCustomModel ? "Choose from the list" : "Use a custom model id"}
  </button>
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
