<script lang="ts">
  import { tick, untrack } from "svelte";
  import { Storage, settings } from "@/storage";
  import { aidDetected } from "@/aid/bridge";
  import { playedAdventureId, playedShortId } from "@/aid/adventure";
  import { extensionState, type SettingsSection } from "@/shared/state.svelte";
  import { Tab } from "@/shared/types";
  import { parseNovel, type NovelCharacter, type NovelFrame } from "@/rendering/novel";
  import { readNovelPassages } from "@/rendering/novel_dom";

  const adventures = Storage.adventures;
  const selected = Storage.selectedAdventureId;
  type Frame = NovelFrame & { source: HTMLElement; offset: number };
  let frames = $state<Frame[]>([]);
  let index = $state(0);
  let paused = $state(false);
  let scene: HTMLElement | undefined = $state();
  let overrides = $state<Record<number, string>>({});
  let output: HTMLElement | null = null;
  let lastSignature = "";
  let sourceIds = new WeakMap<HTMLElement, number>();
  let nextSourceId = 0;
  let corrections = new WeakMap<HTMLElement, Map<number, { text: string; speaker: string }>>();

  const characters = $derived.by(() => {
    const cards = $selected ? Object.values($adventures[$selected]?.storyCards ?? {}) : [];
    const result: NovelCharacter[] = cards.filter(c => c.type.trim().toLowerCase() === "character")
      .map(c => ({ id: c.id, name: c.name, triggers: c.triggers, portrait: c.graphics[c.graphicIndex] || c.icons[c.iconIndex] }));
    if ($aidDetected.shortId === $playedAdventureId) {
      for (const card of $aidDetected.cards.filter(c => c.type.trim().toLowerCase() === "character")) {
        if (cards.some(c => c.aidId === card.id) || result.some(c => c.name.toLowerCase() === card.name.toLowerCase())) continue;
        result.push({ id: `aid:${card.id}`, name: card.name, triggers: card.triggers });
      }
    }
    result.push({ id: "player", name: "You", triggers: "you" });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  });
  const frame = $derived(frames[index]);
  const speakerId = $derived(overrides[index] ?? frame?.speakerId ?? "");
  const speaker = $derived(characters.find(c => c.id === speakerId));
  const stageSpeaker = $derived.by(() => {
    if (frame?.kind === "dialogue") return speaker;
    for (let i = index - 1; i >= 0 && frames[i]?.source === frame?.source; i--) {
      if (frames[i]?.kind === "dialogue") {
        const id = overrides[i] ?? frames[i]?.speakerId;
        return characters.find(c => c.id === id);
      }
    }
    return undefined;
  });
  const active = $derived($settings.visualNovelMode && !!$playedAdventureId && !extensionState.isEditorOpen);

  function refresh() {
    if (playedShortId() !== $playedAdventureId) return;
    const currentOutput = document.querySelector<HTMLElement>("#gameplay-output");
    if (currentOutput !== output) { output = currentOutput; lastSignature = ""; }
    const passages = output ? readNovelPassages(output) : [];
    const signature = JSON.stringify(passages.map(p => {
      if (!sourceIds.has(p.element)) sourceIds.set(p.element, ++nextSourceId);
      return [sourceIds.get(p.element), p.text];
    }));
    if (signature === lastSignature) return;
    lastSignature = signature;
    const previous = frames[index];
    frames = passages.flatMap(p => parseNovel(p.text, characters).map((f, offset) => ({ ...f, source: p.element, offset })));
    const retained = previous ? frames.findIndex(f => f.source === previous.source && f.offset === previous.offset) : -1;
    const latest = passages.at(-1)?.element;
    index = retained >= 0 ? retained : Math.max(0, frames.findIndex(f => f.source === latest));
    overrides = Object.fromEntries(frames.flatMap((f, i) => {
      const correction = corrections.get(f.source)?.get(f.offset);
      return correction?.text === f.text ? [[i, correction.speaker]] : [];
    }));
  }

  $effect(() => {
    const enabled = $settings.visualNovelMode;
    const adventure = $playedAdventureId;
    const set = $selected;
    untrack(() => {
      frames = []; index = 0; paused = false; overrides = {}; lastSignature = "";
      output = null; corrections = new WeakMap(); sourceIds = new WeakMap(); nextSourceId = 0;
    });
    if (!enabled || !adventure) return;
    let queued = 0;
    const schedule = () => {
      if (!queued) queued = requestAnimationFrame(() => { queued = 0; refresh(); });
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => output?.contains(record.target) || [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof HTMLElement && (node.id === "gameplay-output" || node.querySelector("#gameplay-output"))))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    untrack(refresh);
    return () => { observer.disconnect(); cancelAnimationFrame(queued); };
  });

  $effect(() => {
    characters;
    untrack(() => { lastSignature = ""; if ($settings.visualNovelMode) refresh(); });
  });

  // The scene is a modal reader. Keep the covered game out of the tab order, and restore its
  // previous state when returning to the textbox or opening extension settings.
  $effect(() => {
    if (!active || paused) return;
    const previous = new Map<HTMLElement, boolean>();
    const isolate = () => {
      for (const child of document.body.children) {
        if (!(child instanceof HTMLElement) || child.tagName.toLowerCase() === "de-editor-anchor" || previous.has(child)) continue;
        previous.set(child, child.inert); child.inert = true;
      }
    };
    isolate();
    const observer = new MutationObserver(isolate);
    observer.observe(document.body, { childList: true });
    void tick().then(() => { if (active && !paused) scene?.focus(); });
    return () => { observer.disconnect(); previous.forEach((inert, element) => element.inert = inert); };
  });

  function correct(value: string) {
    if (!frame) return;
    const map = corrections.get(frame.source) ?? new Map();
    map.set(frame.offset, { text: frame.text, speaker: value }); corrections.set(frame.source, map);
    overrides = { ...overrides, [index]: value };
  }
  async function resume() {
    refresh();
    paused = false;
    await tick();
    scene?.focus();
  }
  async function write() {
    paused = true;
    await tick();
    document.querySelector<HTMLTextAreaElement>("#game-text-input")?.focus();
  }
  function latest() {
    const source = frames.at(-1)?.source;
    index = Math.max(0, frames.findIndex(f => f.source === source));
  }
  function key(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Tab" && scene) {
      const controls = [...scene.querySelectorAll<HTMLElement>("button:not(:disabled), select")];
      const focused = (scene.getRootNode() as ShadowRoot).activeElement;
      if (event.shiftKey && (focused === controls[0] || focused === scene)) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && focused === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
      return;
    }
    if (event.target !== scene || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (!["ArrowLeft", "ArrowRight", " ", "Escape"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape") write();
    else index = Math.max(0, Math.min(frames.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
  }
  function openSettings() {
    extensionState.editorTab = Tab.Settings;
    extensionState.settingsSection = "extension" satisfies SettingsSection;
    extensionState.isEditorOpen = true;
  }
</script>

{#if active}
  {#if paused}
    <button class="resume" onclick={resume}>Resume visual novel</button>
  {:else}
    <div class="novel" role="dialog" aria-modal="true" aria-label="Visual novel" tabindex="-1" bind:this={scene} onkeydown={key}>
      <header>
        <span class="title">VISUAL NOVEL <small>Story reader</small></span>
        <div class="tools">
          <button onclick={openSettings}>Settings</button>
          <button onclick={() => $settings.visualNovelMode = false}>Exit mode</button>
          <button class="accent" onclick={write}>Write action</button>
        </div>
      </header>
      <div class="stage">
        {#if stageSpeaker?.portrait}
          <img src={stageSpeaker.portrait} alt={stageSpeaker.name} class="portrait" />
        {:else}
          <div class="placeholder" aria-hidden="true">{stageSpeaker ? stageSpeaker.name.slice(0, 1) : "✦"}</div>
        {/if}
        <span class="stage-caption">{stageSpeaker ? stageSpeaker.name : frame?.kind === "dialogue" ? "Unknown speaker" : "Narration"}</span>
      </div>
      <div class="dialogue">
        <div class="speaker-row">
          <strong>{speaker ? speaker.name : frame?.kind === "dialogue" ? "Unknown speaker" : "Narrator"}
            {#if frame?.inferred && overrides[index] === undefined}<small>Inferred speaker</small>{/if}
          </strong>
          {#if frame?.kind === "dialogue"}
            <label>Speaker
              <select aria-label="Dialogue speaker" value={speakerId} onchange={e => correct(e.currentTarget.value)}>
                <option value="">Unknown speaker</option>
                {#each characters as character (character.id)}<option value={character.id}>{character.name}</option>{/each}
              </select>
            </label>
          {/if}
        </div>
        <p class="prose" aria-live="polite">{frame?.text ?? "Waiting for story text. Use Write action to return to the game."}</p>
        <footer>
          <button onclick={() => index--} disabled={index === 0 || !frames.length}>Back</button>
          <span>{frames.length ? `${index + 1} / ${frames.length}` : "No passage loaded"}</span>
          <button onclick={latest} disabled={!frames.length}>Latest passage</button>
          <button class="accent" onclick={() => index++} disabled={index >= frames.length - 1}>Next</button>
        </footer>
      </div>
    </div>
  {/if}
{/if}

<style>
  .novel { position: fixed; inset: 0; z-index: 900; display: flex; flex-direction: column; padding: clamp(12px, 3vw, 32px); gap: 16px; color: #eee8de; background: radial-gradient(ellipse at 50% 40%, #344347, #10171d 75%); font-family: 'IBM Plex Sans', sans-serif; }
  header, .tools, .speaker-row, footer { display: flex; align-items: center; gap: 12px; }
  header, .speaker-row { justify-content: space-between; flex-wrap: wrap; }
  .title { letter-spacing: .16em; font-size: 13px; color: #f8ae2c; }
  small { display: block; color: #aeb9be; letter-spacing: .04em; margin-top: 4px; }
  button, select { border: 1px solid #64727c; border-radius: 8px; padding: 8px 14px; background: #202b34; color: #eee8de; cursor: pointer; font: inherit; }
  button:hover:enabled { background: #35434e; }
  button:focus-visible, select:focus-visible { outline: 2px solid #f8ae2c; outline-offset: 3px; }
  button:disabled { opacity: .4; cursor: default; }
  .accent { background: #f8ae2c; color: #191c22; border-color: #f8ae2c; }
  .accent:hover:enabled { background: #ffc761; }
  .stage { flex: 1; min-height: 0; position: relative; display: flex; justify-content: center; align-items: center; overflow: hidden; }
  .portrait { width: 100%; height: 100%; object-fit: contain; object-position: center bottom; }
  .placeholder { font: 100px Georgia, serif; color: #a3b6b8; opacity: .6; }
  .stage-caption { position: absolute; bottom: 8px; padding: 6px 16px; background: #10171dcc; border-radius: 20px; }
  .dialogue { width: min(100%, 1080px); align-self: center; max-height: 55%; display: flex; flex-direction: column; gap: 16px; background: #141e27f5; border: 1px solid #65717b; border-top: 2px solid #f8ae2c; border-radius: 14px; padding: clamp(14px, 3vw, 28px); box-shadow: 0 16px 48px #0005; }
  strong { color: #f8ae2c; font-size: 20px; }
  label { display: flex; align-items: center; gap: 8px; color: #b9c2c8; font-size: 13px; }
  select { max-width: min(45vw, 260px); padding: 6px; }
  .prose { overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 3em; font: clamp(18px, 2vw, 25px)/1.6 Georgia, serif; margin: 0; }
  footer { flex-wrap: wrap; flex-shrink: 0; }
  footer span { margin-right: auto; color: #b9c2c8; font-size: 13px; }
  .resume { position: fixed; bottom: 16px; left: 16px; z-index: 900; border-color: #f8ae2c; }
  @media (max-width: 500px) { .novel { gap: 10px; } .tools { gap: 6px; } button { padding: 7px 10px; font-size: 13px; } .dialogue { max-height: 65%; gap: 10px; } .stage-caption { font-size: 13px; } }
</style>
