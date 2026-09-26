<script lang="ts">
  import type { Snippet } from "svelte";
  let { label, icon, description = "", children }: { label: string; icon: string; description?: string; children: Snippet } = $props();
</script>

<section class="settings-card bg-theme-neutral-100 border border-theme-neutral-200">
  <header>
    <span aria-hidden="true" class="font-symbol text-pretty-theme">{icon}</span>
    <div><h3>{label}</h3>{#if description}<p class="text-theme-neutral-800">{description}</p>{/if}</div>
  </header>
  <div class="controls">{@render children()}</div>
</section>

<style>
  .settings-card { border-radius:16px; padding:24px; min-width:0; }
  header { display:flex; align-items:flex-start; gap:12px; margin-bottom:24px; }
  header > span { font-size:24px; padding-top:2px; }
  h3 { font-size:18px; font-weight:650; }
  p { font-size:13px; line-height:1.6; margin-top:4px; }
  .controls { display:flex; flex-direction:column; gap:24px; min-width:0; }
  @media(max-width:760px) { .settings-card { padding:18px; } }
</style>
