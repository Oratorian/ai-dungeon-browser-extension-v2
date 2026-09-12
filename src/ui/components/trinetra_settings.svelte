<script lang="ts">
  import Field from "@/ui/components/field.svelte";
  import { settings } from "@/storage";
  import { getMe, TrinetraError } from "@/media/trinetra";

  // The Trinetra API key, entered once here and used by the image picker on every card, by
  // generated-image uploads, and by nothing else. It used to be entered inside the picker itself,
  // which meant the sign-in lived three clicks deep in a card editor and the generation settings
  // had to point users there to find it.

  let checking = $state(false);
  let status = $state("");
  let failed = $state(false);

  const hasKey = $derived(($settings.trinetraApiKey ?? "").trim().length > 0);

  async function check() {
    checking = true;
    status = "";
    failed = false;
    try {
      const me = await getMe($settings.trinetraApiKey.trim());
      status = `Connected as ${me.username}.`;
    } catch (e) {
      failed = true;
      status = e instanceof TrinetraError ? e.message : "Couldn't reach Trinetra.";
    } finally {
      checking = false;
    }
  }

  function signOut() {
    $settings.trinetraApiKey = "";
    // The remembered folder belongs to the account that is being signed out of.
    $settings.trinetraLastFolderId = null;
    status = "";
    failed = false;
  }
</script>

<Field
  label="API Key"
  info="From <b>trinetra.mahesvara.cloud</b>, under the API tab of your account.<br>Lets you browse your uploaded images from any card, insert them as links, and upload generated images. Stored locally like every other setting."
>
  <input
    type="password"
    bind:value={$settings.trinetraApiKey}
    placeholder="tri_..."
    onkeydown={(e) => e.key === "Enter" && hasKey && check()}
    class="bg-theme-neutral-100 w-full min-h-11 p-3 outline-0 rounded-xl text-sm"
  />
</Field>

{#if hasKey}
  <div class="flex items-center gap-2 flex-wrap">
    <button
      onclick={check}
      disabled={checking}
      class="px-3 py-1.5 rounded-lg text-sm bg-pretty-theme/20 hover:bg-pretty-theme/30 text-pretty-theme transition-colors disabled:opacity-60"
    >
      {checking ? "Checking..." : "Check key"}
    </button>
    <button onclick={signOut} class="px-3 py-1.5 rounded-lg text-sm text-theme-neutral-700 hover:text-pretty-red transition-colors">
      Sign out
    </button>
    {#if status}
      <span class="text-xs {failed ? 'text-pretty-red' : 'text-pretty-green'}">{status}</span>
    {/if}
  </div>
{:else}
  <span class="text-xs text-theme-neutral-700">
    No account? Register at
    <a href="https://trinetra.mahesvara.cloud/#register" target="_blank" rel="noopener noreferrer" class="text-pretty-theme hover:underline">
      trinetra.mahesvara.cloud
    </a>.
  </span>
{/if}
