<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { Storage, settings } from "@/storage";
  import { playedAdventureId, playedShortId } from "@/aid/adventure";
  import { continueStory, retryStory, browseRetryHistory, closeRetryHistory, retryHistoryCount } from "@/aid/action_input";
  import { extensionState, type SettingsSection } from "@/shared/state.svelte";
  import { Tab } from "@/shared/types";
  import { parseNovel, type NovelCharacter, type NovelFrame } from "@/rendering/novel";
  import { readNovelPassages } from "@/rendering/novel_dom";
  import { createNovelStageTracker } from "@/rendering/novel_stage";
  import { resolveNovelAssignments, type NovelAssignment } from "@/rendering/novel_assignments";
  import NovelComposer from "./novel_composer.svelte";
  import { configureNarrationPlayback, narrationWav } from "@/tts/playback";
  import { configureTts, generateNarration, initializeTts, ttsState } from "@/tts/service";
  import { NarrationQueue, StableNarrationWindow, narrationQueueSize } from "@/tts/queue";
  import { firstContinuationFrame, retainedNovelIndex, splitNarratedFrames, trackRetriedPassage } from "@/rendering/novel_narration";

  const adventures = Storage.adventures;
  const selected = Storage.selectedAdventureId;
  type Frame = NovelFrame & { source: HTMLElement; offset: number };
  let frames = $state<Frame[]>([]);
  let index = $state(0);
  let paused = $state(false);
  let composing = $state(false);
  let assigning = $state(false);
  let newCharacterName = $state("");
  let assignments = $state<NovelAssignment[]>([]);
  let continuing = $state(false);
  let composerBusy = $state(false);
  let actionError = $state("");
  let continueController: AbortController | undefined;
  let scene: HTMLElement | undefined = $state();
  let output: HTMLElement | null = null;
  let lastSignature = "";
  let sourceIds = new WeakMap<HTMLElement, number>();
  let nextSourceId = 0;
  let narrationQueue = $state<NarrationQueue>();
  let narrationScheduler = $state<StableNarrationWindow>();
  let narrationStatus = $state("");
  let narrationVersion = $state(0);
  let narrationMuted = $state(false);
  let narrationAudio: HTMLAudioElement | undefined;
  let narrationUrl: string | undefined;
  let playbackToken = 0;
  let continuationSnapshot = $state<string[] | null>(null);
  let retryTracker = $state<ReturnType<typeof trackRetriedPassage> | null>(null);
  let historyOpen = $state(false);
  let historyCount = $state(0);
  let historyController: AbortController | undefined;
  let readWithoutAudio = $state(false);
  const ttsReady = $derived($ttsState.phase === "ready");
  const narrationEnabled = $derived($settings.novelTtsEnabled);
  const novelEnabled = $derived($settings.visualNovelMode);
  const narratorVoice = $derived($settings.novelTtsVoice);
  const narratorSteps = $derived($settings.novelTtsSteps);

  $effect(() => {
    configureTts(narrationEnabled);
  });
  onDestroy(() => configureTts(false));
  $effect(() => {
    const message = $ttsState.message;
    untrack(() => { if (!narrationQueue?.get(frame?.text ?? "")) narrationStatus = message; });
  });

  function stopNarration() {
    playbackToken++;
    narrationAudio?.pause();
    narrationAudio = undefined;
    if (narrationUrl) URL.revokeObjectURL(narrationUrl);
    narrationUrl = undefined;
  }

  function playNarration() {
    stopNarration();
    const audio = frame && narrationQueue?.get(frame.text);
    if (!audio || !active || paused || historyOpen || continuing || continuationSnapshot || retryTracker || narrationMuted) return;
    const token = playbackToken;
    narrationUrl = URL.createObjectURL(narrationWav(audio, $settings.novelTtsPitch));
    narrationAudio = new Audio(narrationUrl);
    configureNarrationPlayback(narrationAudio, audio.sampleRate, $settings.novelTtsPitch, $settings.volume);
    void narrationAudio.play().catch(() => {
      if (token === playbackToken) narrationStatus = "Audio ready. Click Read line to play.";
    });
  }

  $effect(() => {
    const enabled = novelEnabled && narrationEnabled && ttsReady && !!$playedAdventureId;
    const adventure = $playedAdventureId;
    const voice = narratorVoice;
    const steps = narratorSteps;
    if (!enabled) return;
    let alive = true;
    const queue = new NarrationQueue(text => generateNarration(text, { voice, steps }), (text, error) => {
      if (!alive) return;
      if (text === frame?.text) narrationStatus = error ? `Narration failed: ${error}` : "Audio ready";
      narrationVersion++;
    });
    narrationQueue = queue;
    const scheduler = new StableNarrationWindow(texts => queue.setWindow(texts));
    narrationScheduler = scheduler;
    return () => {
      alive = false; stopNarration(); scheduler.dispose(); queue.dispose();
      narrationQueue = undefined; narrationScheduler = undefined;
    };
  });

  // Compare text, not frame objects/paragraph metadata: streaming later text must
  // not keep postponing synthesis of an already-complete sentence.
  const queueSize = $derived(narrationQueueSize($settings.novelTtsQueue));
  const narrationWindow = $derived(JSON.stringify(retryTracker ? [] : frames.slice(index, index + queueSize + 1).map(f => f.text)));
  $effect(() => {
    const scheduler = narrationScheduler;
    const texts: string[] = JSON.parse(narrationWindow);
    // Keep useful cached audio across Continue and settings/composer transitions.
    untrack(() => scheduler?.setWindow(texts));
  });

  $effect(() => {
    const text = narrationText;
    const position = index;
    const visible = active && !paused && !continuing && !continuationSnapshot && !retryTracker && !narrationMuted;
    const queue = narrationQueue;
    untrack(stopNarration);
    if (!visible || !text || !queue) return;
    untrack(() => { narrationStatus = queue.get(text) ? "Audio ready" : "Preparing narration..."; });
    untrack(playNarration);
  });

  $effect(() => {
    const version = narrationVersion;
    // A prefetched line finishing must not restart the currently playing line.
    untrack(() => { if (!narrationAudio) playNarration(); });
  });

  const characters = $derived.by(() => {
    const cards = $selected ? Object.values($adventures[$selected]?.storyCards ?? {}) : [];
    const result: NovelCharacter[] = cards.filter(c => c.type.trim().toLowerCase() === "character")
      .map(c => ({ id: c.id, name: c.name, triggers: c.triggers, portrait: c.graphics[c.graphicIndex] || c.icons[c.iconIndex] }));
    return result.sort((a, b) => a.name.localeCompare(b.name));
  });
  const frame = $derived(frames[index]);
  // Opening native action controls can remount identical story DOM. Depend on
  // the text value so a replacement frame does not restart its cached audio.
  const narrationText = $derived(frame?.text);
  const bufferingNarration = $derived.by(() => {
    narrationVersion;
    return !!(ttsReady && $settings.novelTtsEnabled && !narrationMuted && frame && !readWithoutAudio
      && !narrationQueue?.get(frame.text) && !narrationQueue?.hasFailed(frame.text));
  });
  const upcomingNarration = $derived.by(() => {
    narrationVersion;
    const upcoming = frames.slice(index + 1, index + queueSize + 1);
    return { ready: upcoming.filter(frame => narrationQueue?.get(frame.text)).length, total: upcoming.length };
  });
  const paragraphIndex = $derived.by(() => {
    for (let i = index; i >= 0; i--) if (frames[i]?.startsParagraph) return i;
    return -1;
  });
  const paragraphFrame = $derived(frames[paragraphIndex]);
  const resolvedAssignments = $derived(resolveNovelAssignments(frames, assignments));
  const assignedId = $derived(characters.some(c => c.id === resolvedAssignments[paragraphIndex]) ? resolvedAssignments[paragraphIndex] : "");
  const trackStage = $derived(createNovelStageTracker(characters));
  const stages = $derived(trackStage(frames, resolvedAssignments));
  const stageCharacters = $derived((stages[index] ?? [null, null, null, null]).map(id => characters.find(c => c.id === id)));
  const active = $derived($settings.visualNovelMode && !!$playedAdventureId && !extensionState.isEditorOpen);

  function refresh() {
    if (playedShortId() !== $playedAdventureId) return;
    historyCount = retryHistoryCount();
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
    frames = passages.flatMap(p => {
      const parsed = parseNovel(p.text);
      return ($settings.novelTtsEnabled ? splitNarratedFrames(parsed) : parsed)
        .map((f, offset) => ({ ...f, source: p.element, offset }));
    });
    assignments = assignments.filter(a => frames.some(f => f.startsParagraph && f.source === a.source && f.offset === a.offset && f.paragraph === a.paragraph));
    const retained = previous ? retainedNovelIndex(previous, index, frames) : -1;
    const latest = passages.at(-1)?.element;
    index = retained >= 0 ? retained : Math.max(0, frames.findIndex(f => f.source === latest));
    if (continuationSnapshot) {
      const next = firstContinuationFrame(continuationSnapshot, frames.map(f => f.text));
      if (next >= 0) { index = next; continuationSnapshot = null; readWithoutAudio = false; }
    }
    if (retryTracker) {
      const replacement = retryTracker(passages);
      if (replacement >= 0) {
        index = Math.max(0, frames.findIndex(f => f.source === passages[replacement]!.element));
        retryTracker = null; readWithoutAudio = false;
      }
    }
  }

  $effect(() => {
    const enabled = novelEnabled;
    const adventure = $playedAdventureId;
    const set = $selected;
    const narrated = narrationEnabled;
    untrack(() => {
      continueController?.abort(); continuing = false; actionError = "";
      historyController?.abort(); closeRetryHistory(); historyOpen = false; historyCount = 0;
      continuationSnapshot = null; retryTracker = null; readWithoutAudio = false;
      assignments = []; assigning = false; newCharacterName = "";
      frames = []; index = 0; paused = false; composing = false; lastSignature = "";
      output = null; sourceIds = new WeakMap(); nextSourceId = 0;
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
    return () => { observer.disconnect(); cancelAnimationFrame(queued); continueController?.abort(); historyController?.abort(); closeRetryHistory(); };
  });

  function assignCharacter(characterId: string) {
    if (!paragraphFrame) return;
    assignments = assignments.filter(a => a.source !== paragraphFrame.source || a.offset !== paragraphFrame.offset);
    if (characterId) assignments = [...assignments, { source: paragraphFrame.source, offset: paragraphFrame.offset, paragraph: paragraphFrame.paragraph, characterId }];
  }

  function editAssignedCard(characterId: string) {
    if (!$selected) return;
    extensionState.editorTab = Tab.Adventure;
    extensionState.isEditorOpen = true;
    Storage.openStoryCardEditor($selected, characterId);
  }

  function createCharacter() {
    if (!$selected || !newCharacterName.trim()) return;
    const card = Storage.createStoryCard($selected, newCharacterName.trim());
    if (!card) return;
    assignCharacter(card.id);
    newCharacterName = "";
    editAssignedCard(card.id);
  }


  async function continueReading() {
    if (continuing || retryTracker || (composing && composerBusy) || playedShortId() !== $playedAdventureId) return;
    continuing = true; actionError = "";
    continuationSnapshot = frames.map(f => f.text);
    const controller = new AbortController();
    continueController = controller;
    try {
      await continueStory(controller.signal);
      if (!controller.signal.aborted) { composing = false; refresh(); }
    }
    catch (e) { if (!controller.signal.aborted) { actionError = (e as Error).message; continuationSnapshot = null; } }
    finally { if (!controller.signal.aborted) continuing = false; }
  }

  function submitting() {
    // Snapshot before the native Send click: an action may be inserted synchronously.
    refresh();
    continuationSnapshot = frames.map(f => f.text);
    stopNarration();
  }

  async function retryReading() {
    if (continuing || retryTracker || continuationSnapshot || (composing && composerBusy) || playedShortId() !== $playedAdventureId) return;
    refresh();
    const passages = output ? readNovelPassages(output) : [];
    if (!passages.length) return;
    retryTracker = trackRetriedPassage(passages);
    stopNarration();
    narrationScheduler?.setWindow([]);
    narrationQueue?.setWindow([]);
    continuing = true; actionError = "";
    const controller = new AbortController();
    continueController = controller;
    try {
      await retryStory(controller.signal);
      if (!controller.signal.aborted) { composing = false; refresh(); }
    } catch (e) {
      if (!controller.signal.aborted) { retryTracker = null; actionError = (e as Error).message; }
    } finally { if (!controller.signal.aborted) continuing = false; }
  }

  function submitted() {
    composing = false;
    refresh();
  }

  async function showRetryHistory() {
    if (historyOpen || continuing || retryTracker || continuationSnapshot || (composing && composerBusy)) return;
    const adventure = playedShortId();
    const before = output ? readNovelPassages(output) : [];
    const audio = narrationAudio;
    const resumeAudio = !!audio && !audio.paused && !audio.ended;
    audio?.pause();
    historyOpen = true; actionError = "";
    const controller = new AbortController();
    historyController = controller;
    try {
      await tick(); // Release the VN modal's inert state before opening the native picker.
      await browseRetryHistory(controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) actionError = (e as Error).message;
    } finally {
      if (historyController === controller) {
        historyController = undefined;
        closeRetryHistory(); historyOpen = false;
        if (playedShortId() === adventure && active) {
          refresh();
          const after = output ? readNovelPassages(output) : [];
          const replacement = trackRetriedPassage(before)(after);
          if (replacement >= 0) {
            stopNarration(); narrationScheduler?.setWindow([]); narrationQueue?.setWindow([]);
            index = Math.max(0, frames.findIndex(f => f.source === after[replacement]!.element));
            readWithoutAudio = false;
            // Re-arm even if the selected response starts with the same sentence.
            narrationScheduler?.setWindow(frames.slice(index, index + queueSize + 1).map(f => f.text));
          } else if (resumeAudio && narrationAudio === audio) {
            void audio!.play().catch(() => { narrationStatus = "Audio ready. Click Read line to play."; });
          }
          await tick(); scene?.focus();
        }
      }
    }
  }

  function navigate(next: number) {
    next = Math.max(0, Math.min(frames.length - 1, next));
    if (next === index) return;
    continuationSnapshot = null; retryTracker = null; readWithoutAudio = false;
    index = next;
  }

  // The scene is a modal reader. Keep the covered game out of the tab order, and restore its
  // previous state when returning to the textbox or opening extension settings.
  $effect(() => {
    if (!active || paused || historyOpen) return;
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

  function portraitFade(node: Element) {
    return fade(node, { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180 });
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
    continuationSnapshot = null; retryTracker = null; readWithoutAudio = false;
    const source = frames.at(-1)?.source;
    index = Math.max(0, frames.findIndex(f => f.source === source));
  }
  function key(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Tab" && scene) {
      const controls = [...scene.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled)")];
      const focused = (scene.getRootNode() as ShadowRoot).activeElement;
      if (event.shiftKey && (focused === controls[0] || focused === scene)) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && focused === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
      return;
    }
    if (event.target !== scene || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (!["ArrowLeft", "ArrowRight", " ", "Escape"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape") write();
    else navigate(index + (event.key === "ArrowLeft" ? -1 : 1));
  }
  function openSettings() {
    extensionState.editorTab = Tab.Settings;
    extensionState.settingsSection = "extension" satisfies SettingsSection;
    extensionState.isEditorOpen = true;
  }
</script>

{#if active}
  {#if historyOpen}
    <button class="resume" onclick={() => { closeRetryHistory(); historyController?.abort(); }}>Return to visual novel</button>
  {:else if paused}
    <button class="resume" onclick={resume}>Resume visual novel</button>
  {:else}
    <div class="novel" role="dialog" aria-modal="true" aria-label="Visual novel" tabindex="-1" bind:this={scene} onkeydown={key}>
      <header>
        <span class="title">VISUAL NOVEL <small>Story reader</small></span>
        <div class="tools">
          <button onclick={openSettings}>Settings</button>
          <button onclick={() => $settings.visualNovelMode = false}>Exit mode</button>
          <button onclick={write}>Return to game</button>
        </div>
      </header>
      <div class="stage" role="group" aria-label="Characters in the scene">
        {#each stageCharacters as character, slot (slot)}
          <div class="stage-slot" data-side={slot % 2 === 0 ? "left" : "right"} style:grid-column={[2, 3, 1, 4][slot]}>
            {#if character}
              {#key character.id}
                <div class="stage-character" transition:portraitFade>
                  {#if character.portrait}
                    <img src={character.portrait} alt={character.name} class="portrait" />
                  {:else}
                    <div class="placeholder" aria-hidden="true">{character.name.slice(0, 1)}</div>
                  {/if}
                  <span class="stage-caption">{character.name}</span>
                </div>
              {/key}
            {/if}
          </div>
        {/each}
      </div>
      <div class="dialogue">
        <div class="assignment-tools">
          <button aria-expanded={assigning} onclick={() => assigning = !assigning} disabled={!frame}>Assign character{assignedId ? " (assigned)" : ""}</button>
        </div>
        {#if assigning && frame}
          <div class="assignment-panel">
            <label>Character for this paragraph
              <select aria-label="Character for this paragraph" value={assignedId} onchange={e => assignCharacter(e.currentTarget.value)}>
                <option value="">Automatic characters only</option>
                {#each characters.filter(c => c.id !== "player" && c.name.trim().toLowerCase() !== "you") as character (character.id)}
                  <option value={character.id}>{character.name}</option>
                {/each}
              </select>
            </label>
            <p>This choice lasts for this loaded paragraph, until its text changes or the reader is reset. It does not add name or pronoun triggers.</p>
            {#if assignedId}<button onclick={() => editAssignedCard(assignedId)}>Edit character artwork</button>{/if}
            {#if $selected}
              <div class="create-character">
                <input aria-label="New character name" placeholder="New character name" bind:value={newCharacterName} />
                <button disabled={!newCharacterName.trim()} onclick={createCharacter}>Create and edit character</button>
              </div>
              <p>New character cards are saved in your selected set.</p>
            {:else}
              <p>Select a card set in the editor before creating a character.</p>
            {/if}
          </div>
        {/if}
        <p class="prose" class:with-composer={composing} aria-live="polite">{retryTracker ? "Waiting for the replacement response..." : bufferingNarration ? "Preparing narration for this line..." : frame?.text ?? "Waiting for story text. Use Actions to take a turn."}</p>
        {#if continuationSnapshot}<p class="narration-controls" role="status">Waiting for the continuation...</p>{/if}
        {#if $settings.novelTtsEnabled}
          <div class="narration-controls">
            {#if bufferingNarration && !retryTracker}<button onclick={() => readWithoutAudio = true}>Read now</button>{/if}
            {#if !ttsReady}
              <button onclick={() => void initializeTts()} disabled={$ttsState.phase === "checking" || $ttsState.phase === "loading"}>Initialize TTS</button>
            {/if}
            <button onclick={() => { narrationMuted = false; if (frame) narrationQueue?.retry(frame.text); playNarration(); }} disabled={!frame || !ttsReady || !!retryTracker}>Read line</button>
            <button aria-pressed={narrationMuted} onclick={() => { narrationMuted = !narrationMuted; if (narrationMuted) stopNarration(); }}>{narrationMuted ? "Unmute" : "Mute"}</button>
            <span role="status">{narrationStatus}</span>
            <span class="queue-badge" role="status" title="Generated audio for the next available lines, excluding the current line">{upcomingNarration.ready}/{upcomingNarration.total} upcoming lines ready</span>
          </div>
        {/if}
        {#if composing}
          <NovelComposer blocked={continuing || !!retryTracker} onbusychange={busy => composerBusy = busy} onclose={() => composing = false}
            onsubmitting={submitting} onsubmitted={submitted} onsubmitfailed={() => { continuationSnapshot = null; }} />
        {/if}
        {#if actionError}<p role="alert" class="action-error">{actionError}</p>{/if}
        <footer>
          <button onclick={() => navigate(index - 1)} disabled={index === 0 || !frames.length}>Back</button>
          <span>{frames.length ? `${index + 1} / ${frames.length}` : "No passage loaded"}</span>
          <button onclick={() => latest()} disabled={!frames.length}>Latest passage</button>
          <button class="accent" onclick={() => navigate(index + 1)} disabled={index >= frames.length - 1}>Next</button>
          <div class="retry-control" role="group" aria-label="Retry controls">
            <button onclick={retryReading} title="Regenerate AI Dungeon's latest response" disabled={!frames.length || continuing || !!retryTracker || !!continuationSnapshot || (composing && composerBusy)}>{retryTracker ? "Retrying..." : "Retry"}</button>
            {#if historyCount > 1}<button class="retry-count" onclick={showRetryHistory} aria-label={`Retry history: ${historyCount} responses`} title="Choose an existing retry response" disabled={continuing || !!retryTracker || !!continuationSnapshot || (composing && composerBusy)}>{historyCount}</button>{/if}
          </div>
          <button onclick={continueReading} disabled={continuing || !!retryTracker || (composing && composerBusy)}>{continuing && !retryTracker ? "Continuing..." : "Continue"}</button>
          <button class="accent" aria-expanded={composing} disabled={continuing || !!retryTracker || (composing && composerBusy)} onclick={() => composing = !composing}>Actions</button>
        </footer>
      </div>
    </div>
  {/if}
{/if}

<style>
  .novel { position: fixed; inset: 0; z-index: 900; display: flex; flex-direction: column; padding: clamp(12px, 3vw, 32px); gap: 16px; color: #eee8de; background: radial-gradient(ellipse at 50% 40%, #344347, #10171d 75%); font-family: 'IBM Plex Sans', sans-serif; }
  header, .tools, footer { display: flex; align-items: center; gap: 12px; }
  header { justify-content: space-between; flex-wrap: wrap; }
  .title { letter-spacing: .16em; font-size: 13px; color: #f8ae2c; }
  small { display: block; color: #aeb9be; letter-spacing: .04em; margin-top: 4px; }
  button { border: 1px solid #64727c; border-radius: 8px; padding: 8px 14px; background: #202b34; color: #eee8de; cursor: pointer; font: inherit; }
  button:hover:enabled { background: #35434e; }
  button:focus-visible { outline: 2px solid #f8ae2c; outline-offset: 3px; }
  button:disabled { opacity: .4; cursor: default; }
  .accent { background: #f8ae2c; color: #191c22; border-color: #f8ae2c; }
  .accent:hover:enabled { background: #ffc761; }
  .stage { flex: 1; min-height: 0; width: min(100%, 1440px); align-self: center; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(4px, 1vw, 16px); overflow: hidden; }
  .stage-slot { position: relative; grid-row: 1; min-width: 0; min-height: 0; }
  .stage-character { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; }
  .portrait { width: 100%; height: 100%; object-fit: contain; object-position: center bottom; }
  .placeholder { font: 100px Georgia, serif; color: #a3b6b8; opacity: .6; }
  .stage-caption { position: absolute; bottom: 8px; max-width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 16px; background: #10171dcc; border: 1px solid transparent; border-radius: 20px; }
  .dialogue { width: min(100%, 1080px); align-self: center; max-height: 55%; display: flex; flex-direction: column; gap: 16px; background: #141e27f5; border: 1px solid #65717b; border-top: 2px solid #f8ae2c; border-radius: 14px; padding: clamp(14px, 3vw, 28px); box-shadow: 0 16px 48px #0005; }
  .prose { overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 3em; font: clamp(18px, 2vw, 25px)/1.6 Georgia, serif; margin: 0; }
  .prose.with-composer { min-height: 0; max-height: 14vh; }
  .dialogue { overflow: auto; }
  .action-error { color: #ffadb2; margin: 0; font-size: 13px; }
  .narration-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; color: #b9c2c8; }
  .queue-badge { padding: 3px 8px; border: 1px solid #59636b; border-radius: 999px; background: #20272c; color: #e2e8ec; font-variant-numeric: tabular-nums; }
  .assignment-tools { display: flex; justify-content: flex-end; }
  .assignment-panel { display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid #65717b; padding-bottom: 12px; }
  .assignment-panel p { margin: 0; color: #b9c2c8; font-size: 12px; }
  .assignment-panel label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
  .assignment-panel select, .assignment-panel input { min-width: 0; max-width: 100%; padding: 8px; background: #202b34; color: #eee8de; border: 1px solid #64727c; border-radius: 8px; font: inherit; }
  .assignment-panel select:focus-visible, .assignment-panel input:focus-visible { outline: 2px solid #f8ae2c; }
  .create-character { display: flex; flex-wrap: wrap; gap: 8px; }
  footer { flex-wrap: wrap; flex-shrink: 0; }
  .retry-control { display: inline-flex; flex-shrink: 0; }
  .retry-control button { border-radius: 0; }
  .retry-control button:first-child { border-radius: 8px 0 0 8px; }
  .retry-control button:last-child { border-radius: 0 8px 8px 0; }
  .retry-control button:only-child { border-radius: 8px; }
  .retry-control .retry-count { border-left: 0; min-width: 38px; padding-inline: 10px; font-variant-numeric: tabular-nums; }
  footer span { margin-right: auto; color: #b9c2c8; font-size: 13px; }
  .resume { position: fixed; bottom: 16px; left: 16px; z-index: 900; border-color: #f8ae2c; }
  @media (max-width: 500px) { .novel { gap: 10px; } .tools { gap: 6px; } button { padding: 7px 10px; font-size: 13px; } .dialogue { max-height: 65%; gap: 10px; } .stage-caption { font-size: 13px; } }
</style>
