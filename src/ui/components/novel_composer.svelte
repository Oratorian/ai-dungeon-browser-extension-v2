<script lang="ts">
  import { onMount } from "svelte";
  import { ACTION_MODES, openActionInput, readActionInput, setActionMode, submitAction, writeActionDraft, type ActionMode } from "@/aid/action_input";
  import { playedShortId } from "@/aid/adventure";

  let { onclose, onsubmitted, blocked = false, onbusychange = () => {} }: { onclose: () => void; onsubmitted: () => void; blocked?: boolean; onbusychange?: (busy: boolean) => void } = $props();
  let draft = $state("");
  let mode = $state<ActionMode | null>(null);
  let placeholder = $state("Write your action...");
  let busy = $state(true);
  let ready = $state(false);
  let error = $state("");
  let field: HTMLTextAreaElement | undefined = $state();
  let signal: AbortSignal;
  let adventure: string | null;
  let localOnly = $state(false);
  $effect(() => { onbusychange(busy); });

  function sync() {
    if (playedShortId() !== adventure) return;
    const state = readActionInput();
    if (!localOnly) draft = state.value;
    mode = state.mode;
    placeholder = state.placeholder;
    ready = state.available && state.canSubmit;
  }
  onMount(() => {
    const controller = new AbortController();
    signal = controller.signal;
    adventure = playedShortId();
    sync();
    void openActionInput(signal).then(() => { sync(); field?.focus(); })
      .catch(e => { if (!signal.aborted) error = e.message; })
      .finally(() => { if (!signal.aborted) busy = false; });
    const timer = setInterval(() => {
      if (playedShortId() !== adventure) { controller.abort(); onclose(); return; }
      if (!busy && !blocked) sync();
    }, 200);
    return () => { controller.abort(); clearInterval(timer); };
  });
  function changed(value: string) {
    draft = value;
    try { writeActionDraft(value); localOnly = false; error = ""; }
    catch (e) { localOnly = true; error = (e as Error).message; }
  }
  async function choose(value: ActionMode) {
    if (busy || blocked) return;
    busy = true; error = "";
    try { await setActionMode(value, signal); sync(); }
    catch (e) { if (!signal.aborted) error = (e as Error).message; }
    finally { if (!signal.aborted) { busy = false; field?.focus(); } }
  }
  async function send() {
    if (busy || blocked || !mode || !draft.trim()) return;
    busy = true; error = "";
    try {
      await submitAction(draft, mode, signal);
      if (!signal.aborted) onsubmitted();
    } catch (e) { if (!signal.aborted) { error = (e as Error).message; busy = false; } }
  }
</script>

<div class="composer">
  <div class="modes" role="group" aria-label="Action mode">
    {#each ACTION_MODES as value}
      <button aria-pressed={mode === value} disabled={busy || blocked} onclick={() => choose(value)}>{value}</button>
    {/each}
  </div>
  <textarea aria-label="Visual novel action" bind:this={field} value={draft} {placeholder} rows="3" disabled={busy || blocked}
    oninput={event => changed(event.currentTarget.value)}></textarea>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="controls">
    <span>Enter adds a new line.</span>
    <button onclick={onclose} disabled={busy || blocked}>Read story</button>
    <button class="send" onclick={send} disabled={busy || blocked || !mode || !draft.trim() || (!ready && !localOnly)}>Send {mode ?? "action"}</button>
  </div>
</div>

<style>
  .composer { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .modes, .controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  button { cursor: pointer; border: 1px solid #64727c; background: #202b34; color: #eee8de; border-radius: 8px; padding: 7px 14px; font: inherit; }
  button[aria-pressed="true"], .send { background: #f8ae2c; color: #191c22; border-color: #f8ae2c; }
  button:disabled { opacity: .4; cursor: default; }
  button:focus-visible, textarea:focus-visible { outline: 2px solid #f8ae2c; outline-offset: 2px; }
  textarea { width: 100%; min-height: 70px; max-height: 24vh; resize: vertical; color: #eee8de; background: #0e171f; border: 1px solid #64727c; border-radius: 8px; padding: 10px; font: 18px/1.5 'IBM Plex Sans', sans-serif; }
  .controls span { margin-right: auto; color: #b9c2c8; font-size: 12px; }
  .error { color: #ffadb2; margin: 0; font-size: 13px; }
  @media (max-width: 500px) { button { padding: 7px 10px; font-size: 13px; } }
</style>
