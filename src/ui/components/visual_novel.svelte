<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { Storage, settings } from "@/storage";
  import { playedAdventureId, playedShortId } from "@/aid/adventure";
  import { aidDetected } from "@/aid/bridge";
  import { continueStory, retryStory, retryStoryWithChanges, browseRetryHistory, closeRetryHistory, retryHistoryCount } from "@/aid/action_input";
  import { extensionState } from "@/shared/state.svelte";
  import { parseNovel, type NovelCharacter, type NovelFrame } from "@/rendering/novel";
  import { readNovelPassages } from "@/rendering/novel_dom";
  import { createNovelStageTracker } from "@/rendering/novel_stage";
  import { novelSpeakers } from "@/rendering/novel_speaker";
  import { vnCardError, syncVnCard } from "@/aid/vn_card_sync";
  import { createNovelLocationTracker, retainedLocationSeed, type NovelLocation } from "@/rendering/novel_location";
  import Select from "./select.svelte";
  import Slider from "./slider.svelte";
  import TtsSettings from "./tts_settings.svelte";
  import TtsPreview from "./tts_preview.svelte";
  import NovelComposer from "./novel_composer.svelte";
  import { configureNarrationPlayback, narrationWav } from "@/tts/playback";
  import { configureTts, generateNarration, initializeTts, ttsState } from "@/tts/service";
  import { NarrationQueue, StableNarrationWindow, narrationQueueSize } from "@/tts/queue";
  import { registerNarrationDiagnostics } from "@/tts/diagnostics";
  import { createNovelBookmark, readNovelBookmark, restoreNovelBookmark, type NovelBookmark } from "@/rendering/novel_bookmark";
  import { firstContinuationFrame, retainedNovelIndex, splitNarratedFrames, trackRetriedPassage } from "@/rendering/novel_narration";

  const adventures = Storage.adventures;
  const selected = Storage.selectedAdventureId;
  type Frame = NovelFrame & { source: HTMLElement; offset: number };
  let frames = $state<Frame[]>([]);
  let index = $state(0);
  let frameAdventure = $state("");
  let pendingBookmark: NovelBookmark | undefined;
  let jumpOpen = $state(false);
  let jumpPage = $state<number | undefined>(1);
  let jumpInput: HTMLInputElement | undefined = $state();
  let jumpButton: HTMLButtonElement | undefined = $state();
  $effect(() => {
    const bookmark = createNovelBookmark(frames, index);
    const adventure = frameAdventure;
    if (bookmark && adventure) void chrome.storage.local.set({ [`vn-position:${adventure}`]: bookmark }).catch(() => {});
  });
  let composing = $state(false);
  let retryEditing = $state(false);
  let retryInstruction = $state("");
  let locationOverride = $state("__auto");
  let locationMenuOpen = $state(false);
  let settingsOpen = $state(false);
  let settingsButton: HTMLButtonElement | undefined = $state();
  let locationSeed = $state<string | null>(null);
  let failedBackground = $state("");
  let continuing = $state(false);
  let composerBusy = $state(false);
  let actionError = $state("");
  let continueController: AbortController | undefined;
  let scene: HTMLElement | undefined = $state();
  let readerHeight = $state(220);
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
    configureTts(narrationEnabled, $settings.novelTtsAccelerated, $settings.novelTtsThreads);
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
    if (!audio || !active || historyOpen || continuing || continuationSnapshot || retryTracker || narrationMuted) return;
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
    const unregister = registerNarrationDiagnostics(() => ({ ...queue.diagnostics(),
      upcomingReady: upcomingNarration.ready, upcomingTotal: upcomingNarration.total,
      muted: narrationMuted, buffering: bufferingNarration,
      playing: !!narrationAudio && !narrationAudio.paused && !narrationAudio.ended,
    }));
    return () => {
      unregister();
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
    const visible = active && !continuing && !continuationSnapshot && !retryTracker && !narrationMuted;
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
  const storyMetadata = $derived($playedAdventureId && $aidDetected.shortId === $playedAdventureId ? $aidDetected : null);
  const scenarioName = $derived(storyMetadata?.scenarioTitle || storyMetadata?.title || "Adventure");
  const adventureName = $derived(storyMetadata?.title || "Adventure");
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
  const trackStage = $derived(createNovelStageTracker(characters));
  const stages = $derived(trackStage(frames));
  const stageCharacters = $derived((stages[index] ?? [null, null, null, null]).map(id => characters.find(c => c.id === id)));
  const speakers = $derived($settings.novelStoryCardInstructions !== false ? novelSpeakers(frames, characters) : []);
  const speaker = $derived(stageCharacters.some(character => character?.id === speakers[index]) ? speakers[index] : null);
  const locations: NovelLocation[] = $derived(($selected ? Object.values($adventures[$selected]?.storyCards ?? {}) : [])
    .filter(card => card.type.trim().toLowerCase() === "location")
    .map(card => ({ id: card.id, name: card.name, triggers: card.triggers, background: card.graphics[card.graphicIndex] || card.graphics[0] }))
    .sort((a, b) => a.name.localeCompare(b.name)));
  const trackLocation = $derived(createNovelLocationTracker(locations));
  const locationTimeline = $derived(trackLocation(frames, locationSeed));
  const automaticLocation = $derived(locations.find(location => location.id === locationTimeline[index]));
  const currentLocation = $derived(locationOverride === "__auto" ? automaticLocation : locations.find(location => location.id === locationOverride));
  const background = $derived(currentLocation?.background && currentLocation.background !== failedBackground ? currentLocation.background : undefined);
  const available = $derived($settings.visualNovelMode && !!$playedAdventureId && !extensionState.isEditorOpen);
  const active = $derived(available && !extensionState.novelMinimized);

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
    const previousFrames = frames;
    const previousLocations = locationTimeline;
    frames = passages.flatMap(p => {
      const parsed = parseNovel(p.text);
      return ($settings.novelTtsEnabled ? splitNarratedFrames(parsed) : parsed)
        .map((f, offset) => ({ ...f, source: p.element, offset }));
    });
    locationSeed = retainedLocationSeed(previousFrames, previousLocations, frames, locationSeed);
    const retained = previous ? retainedNovelIndex(previous, index, frames) : -1;
    const latest = passages.at(-1)?.element;
    index = retained >= 0 ? retained : pendingBookmark && frames.length
      ? restoreNovelBookmark(pendingBookmark, frames)
      : Math.max(0, frames.findIndex(f => f.source === latest));
    if (frames.length) pendingBookmark = undefined;
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
      extensionState.novelMinimized = false;
      continueController?.abort(); continuing = false; actionError = "";
      historyController?.abort(); closeRetryHistory(); historyOpen = false; historyCount = 0;
      continuationSnapshot = null; retryTracker = null; readWithoutAudio = false;
      frameAdventure = adventure ?? ""; pendingBookmark = undefined;
      frames = []; index = 0; composing = false; lastSignature = "";
      retryEditing = false; retryInstruction = ""; settingsOpen = false; jumpOpen = false;
      locationMenuOpen = false; locationOverride = "__auto"; locationSeed = null; failedBackground = "";
      output = null; sourceIds = new WeakMap(); nextSourceId = 0;
    });
    if (!enabled || !adventure) return;
    let queued = 0;
    let disposed = false;
    let loaded = false;
    const schedule = () => {
      if (loaded && !queued) queued = requestAnimationFrame(() => { queued = 0; refresh(); });
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => output?.contains(record.target) || [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof HTMLElement && (node.id === "gameplay-output" || node.querySelector("#gameplay-output"))))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    void chrome.storage.local.get(`vn-position:${adventure}`).then(saved => {
      if (!disposed) pendingBookmark = readNovelBookmark(saved[`vn-position:${adventure}`]);
    }).catch(() => {}).finally(() => {
      if (disposed) return;
      loaded = true; refresh();
    });
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(queued); continueController?.abort(); historyController?.abort(); closeRetryHistory(); };
  });

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

  async function retryReading(instruction?: string) {
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
      if (instruction !== undefined) await retryStoryWithChanges(instruction, controller.signal);
      else await retryStory(controller.signal);
      if (!controller.signal.aborted) { composing = false; retryEditing = false; retryInstruction = ""; refresh(); }
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
    if (!active || historyOpen) return;
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
    void tick().then(() => { if (active) scene?.focus(); });
    return () => { observer.disconnect(); previous.forEach((inert, element) => element.inert = inert); };
  });

  function portraitFade(node: Element) {
    return fade(node, { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180 });
  }
  async function exitNovel() {
    extensionState.novelMinimized = false;
    stopNarration();
    narrationScheduler?.dispose();
    narrationQueue?.dispose();
    $settings.visualNovelMode = false;
    await tick();
    document.querySelector<HTMLTextAreaElement>("#game-text-input")?.focus();
  }
  async function minimizeNovel(event: MouseEvent) {
    event.preventDefault();
    stopNarration();
    settingsOpen = false; locationMenuOpen = false; jumpOpen = false;
    extensionState.novelMinimized = true;
    await tick();
    document.querySelector<HTMLTextAreaElement>("#game-text-input")?.focus();
  }
  async function openJump() {
    jumpPage = index + 1;
    jumpOpen = true;
    await tick();
    jumpInput?.focus(); jumpInput?.select();
  }
  function closeJump() { jumpOpen = false; jumpButton?.focus(); }
  function jump() {
    if (!Number.isInteger(jumpPage) || !jumpPage || jumpPage < 1 || jumpPage > frames.length) return;
    navigate(jumpPage - 1);
    closeJump();
  }
  function latest() {
    continuationSnapshot = null; retryTracker = null; readWithoutAudio = false;
    const source = frames.at(-1)?.source;
    index = Math.max(0, frames.findIndex(f => f.source === source));
  }
  function key(event: KeyboardEvent) {
    if (!active || historyOpen) return;
    if (event.key === "Escape" && jumpOpen) {
      event.preventDefault(); event.stopPropagation(); closeJump(); return;
    }
    if (event.key === "Escape" && settingsOpen) {
      event.preventDefault(); event.stopPropagation(); closeSettings(); return;
    }
    if (event.key === "Escape" && locationMenuOpen) {
      event.preventDefault(); event.stopPropagation(); scene?.focus(); locationMenuOpen = false; return;
    }
    event.stopPropagation();
    if (event.key === "Tab" && scene) {
      const controls = [...scene.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex='0']")].filter(control => !control.closest("[inert], [hidden]") && control.getClientRects().length);
      const focused = (scene.getRootNode() as ShadowRoot).activeElement;
      if (event.shiftKey && (focused === controls[0] || focused === scene)) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && focused === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    const origin = event.composedPath()[0];
    const target = origin instanceof Element ? origin : null;
    // Keep Space usable after clicking reader controls, without stealing it from
    // the composer, retry instructions, or location picker.
    if (event.key === " " && !target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="option"], .location-control, .vn-settings-control, .page-jump')) {
      event.preventDefault();
      if (!event.repeat) navigate(index + 1);
      return;
    }
    if (target !== scene) return;
    if (!["ArrowLeft", "ArrowRight", " ", "Escape"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape") void exitNovel();
    else navigate(index + (event.key === "ArrowLeft" ? -1 : 1));
  }
  function closeSettings() {
    settingsOpen = false;
    settingsButton?.focus();
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === " " && !event.defaultPrevented) key(event); }} />

{#if $vnCardError}
  <div class="vn-card-error" role="alert">VN Mode story card: {$vnCardError} <button onclick={() => syncVnCard(true)}>Retry</button></div>
{/if}
{#if available && extensionState.novelMinimized}
  <button class="resume" onclick={() => extensionState.novelMinimized = false}>Return to VN</button>
{/if}
{#if active}
  {#if historyOpen}
    <button class="resume" onclick={() => { closeRetryHistory(); historyController?.abort(); }}>Return to visual novel</button>
  {:else}
    <div class="novel" style:--reader-height={`${readerHeight}px`} role="dialog" aria-modal="true" aria-label="Visual novel" tabindex="-1" bind:this={scene} onkeydown={key}>
      <svg class="portrait-filters" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="novel-portrait-depth" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
            <!-- Sum the alpha neighborhood to expand the silhouette, then keep only its outer rim. -->
            <feConvolveMatrix in="SourceAlpha" order="5" kernelMatrix="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1" divisor="1" edgeMode="none" preserveAlpha="false" result="expanded" />
            <feComposite in="expanded" in2="SourceAlpha" operator="out" result="rim" />
            <feGaussianBlur in="rim" stdDeviation="0.8" result="soft-rim" />
            <feFlood flood-color="#f2dfc4" flood-opacity={$settings.novelGlow ? 0.7 : 0} result="outline-color" />
            <feComposite in="outline-color" in2="soft-rim" operator="in" result="outline" />
            <feDropShadow in="SourceAlpha" dx="3" dy="7" stdDeviation="9" flood-color="#05090d" flood-opacity="0.8" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      {#if background}
        {#key background}<img class="location-backdrop" class:no-blur={!$settings.novelBlur} src={background} alt="" aria-hidden="true" onerror={() => failedBackground = background ?? ""} transition:portraitFade />{/key}
        <div class="location-shade" aria-hidden="true"></div>
      {/if}
      <header>
        <span class="title"><span class="scenario-name" title={scenarioName}>{scenarioName}</span>{#if storyMetadata?.scenarioTitle}<small title={adventureName}>{adventureName}</small>{/if}</span>
        <div class="tools">
          <div class="vn-settings-control">
            <button bind:this={settingsButton} aria-expanded={settingsOpen} aria-controls="novel-settings-panel" onclick={() => settingsOpen = !settingsOpen}>Settings</button>
            {#if settingsOpen}
              <section id="novel-settings-panel" class="vn-settings-panel" aria-label="Visual novel settings">
                <div class="settings-heading"><strong>VN settings</strong><button onclick={closeSettings} aria-label="Close VN settings">Close</button></div>
                <div class="visual-options" role="group" aria-label="Visual effects">
                  <button role="switch" aria-checked={$settings.novelBlur} aria-label="Background blur" onclick={() => $settings.novelBlur = !$settings.novelBlur} title="Blur the background to make characters stand out. Turn off for a sharper background.">Blur: {$settings.novelBlur ? "On" : "Off"}</button>
                  <button role="switch" aria-checked={$settings.novelGlow} aria-label="Character glow" onclick={() => $settings.novelGlow = !$settings.novelGlow} title="Add a light outline around characters so they are easier to see.">Glow: {$settings.novelGlow ? "On" : "Off"}</button>
                </div>
                <div class="instruction-options">
                  <button role="switch" aria-checked={$settings.novelStoryCardInstructions} aria-label="Track Speakers" onclick={() => $settings.novelStoryCardInstructions = !$settings.novelStoryCardInstructions}>Track Speakers: {$settings.novelStoryCardInstructions ? "On" : "Off"}</button>
                  <small>Asks the AI to put names before dialogue so VN can highlight who is speaking. Might take 2 or 3 turns to take effect. Turning this off removes the extra writing instructions.</small>
                </div>
                <TtsSettings grid disableInitializeWhenOff />
                <fieldset class="voice-options" disabled={!$settings.novelTtsEnabled} inert={!$settings.novelTtsEnabled} aria-label="TTS voice settings">
                  <div class="voice-option" title="Choose the voice that reads the story aloud.">
                    <span>Voice</span>
                    <Select ariaLabel="Narrator voice" allowDeselect={false} portal={false}
                      bind:value={() => $settings.novelTtsVoice, value => $settings.novelTtsVoice = value === "F5" ? "F5" : "M5"}
                      items={[{ value: "M5", label: "Male" }, { value: "F5", label: "Female" }]} />
                  </div>
                  <div class="voice-option" title="Lower values prepare speech faster. Higher values spend more time refining how it sounds.">
                    <span>Generation steps</span>
                    <Select ariaLabel="Generation steps" allowDeselect={false} portal={false}
                      bind:value={() => String($settings.novelTtsSteps), value => $settings.novelTtsSteps = Number(value)}
                      items={[5, 6, 7, 8, 9, 10].map(steps => ({ value: String(steps), label: String(steps) }))} />
                  </div>
                  <div class="voice-option" title="Make the voice lower or higher without changing reading speed. Zero keeps the original voice."><span>Pitch</span><Slider ariaLabel="Narrator pitch" bind:value={$settings.novelTtsPitch} min={-3} max={3} step={0.5} /></div>
                  <div class="voice-option" title="How many upcoming lines to prepare in advance. A larger queue can reduce waiting as you read, but uses more memory and work up front."><span>Queue</span><Slider ariaLabel="Narration queue" bind:value={$settings.novelTtsQueue} min={1} max={20} step={1} /></div>
                  <div class="voice-preview"><TtsPreview /></div>
                </fieldset>
              </section>
            {/if}
          </div>
          <button onclick={exitNovel} oncontextmenu={minimizeNovel} title="Exit VN. Right-click to temporarily return to the story.">Exit VN</button>
          <div class="location-control" role="group" aria-label="Location controls"
            onmouseenter={() => locationMenuOpen = true}
            onmouseleave={(event) => { if (!event.currentTarget.querySelector(".location-panel")?.matches(":focus-within")) locationMenuOpen = false; }}
            onfocusin={() => locationMenuOpen = true}
            onfocusout={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) locationMenuOpen = false; }}>
            <button aria-expanded={locationMenuOpen} aria-controls="novel-location-panel" onclick={() => locationMenuOpen = true}>Location</button>
            <div id="novel-location-panel" class="location-panel" hidden={!locationMenuOpen}>
              <Select ariaLabel="Scene location" portal={false} allowDeselect={false} bind:value={locationOverride}
                items={[{ value: "__auto", label: `Automatic: ${automaticLocation?.name ?? "Unknown location"}` }, { value: "__none", label: "No background" }, ...locations.map(location => ({ value: location.id, label: location.name }))]} />
              <small>{locationOverride !== "__auto" ? "Manual background; select Automatic to resume tracking." : "Location tracked from story text."}{currentLocation && !background ? " No location artwork available." : ""}</small>
            </div>
          </div>
        </div>
      </header>
      <div class="stage" role="group" aria-label="Characters in the scene">
        {#each stageCharacters as character, slot (slot)}
          <div class="stage-slot" class:speaking={!!speaker && character?.id === speaker} data-edge={stageCharacters.filter(Boolean).length <= 2 ? (slot === 0 ? "left" : "right") : slot === 2 ? "left" : slot === 3 ? "right" : "middle"} style:grid-column={stageCharacters.filter(Boolean).length <= 2 ? ["1 / 3", "3 / 5", "1", "4"][slot] : String([2, 3, 1, 4][slot])}>
            {#if character}
              {#key character.id}
                <div class="stage-character" class:dimmed={$settings.novelStoryCardInstructions !== false && character.id !== speaker} transition:portraitFade>
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
      <div class="reading-shade" aria-hidden="true"></div>
      <div class="reader-panels" bind:clientHeight={readerHeight}>
        {#if $settings.novelTtsEnabled}
        <aside class="voice-panel" aria-label="Narration controls" aria-describedby="novel-audio-hint">
          <div id="novel-audio-menu" class="narration-controls audio-menu">
            {#if !ttsReady}<button onclick={() => void initializeTts()} disabled={$ttsState.phase === "checking" || $ttsState.phase === "loading"}>Initialize TTS</button>{/if}
            {#if bufferingNarration && !retryTracker}<button onclick={() => readWithoutAudio = true}>Read now</button>{/if}
            <button onclick={() => { narrationMuted = false; if (frame) narrationQueue?.retry(frame.text); playNarration(); }} disabled={!frame || !ttsReady || !!retryTracker}>Read line</button>
            <button aria-pressed={narrationMuted} onclick={() => { narrationMuted = !narrationMuted; if (narrationMuted) stopNarration(); }}>{narrationMuted ? "Unmute" : "Mute"}</button>
            <span role="status">{narrationStatus}</span>
            <span class="queue-badge" role="status" title="Generated audio for the next available lines, excluding the current line">{upcomingNarration.ready}/{upcomingNarration.total} upcoming lines ready</span>
          </div>
          <small id="novel-audio-hint" class="hover-hint">Hover here for audio controls</small>
        </aside>
        {/if}
      <div class="dialogue">
        <p class="prose" aria-live="polite">{retryTracker ? "Waiting for the replacement response..." : bufferingNarration ? "Preparing narration for this line..." : frame?.text ?? "Waiting for story text. Use Actions to take a turn."}</p>
        {#if continuationSnapshot}<p class="narration-controls" role="status">Waiting for the continuation...</p>{/if}
        {#if retryEditing}
          <form class="retry-instructions" onsubmit={event => { event.preventDefault(); void retryReading(retryInstruction); }}>
            <label for="vn-retry-instructions">What should the AI change?</label>
            <textarea id="vn-retry-instructions" bind:value={retryInstruction} maxlength="1000" rows="2" placeholder="Tell the AI what to change..." disabled={continuing || !!retryTracker}></textarea>
            <div class="tools">
              <button type="button" onclick={() => retryEditing = false} disabled={continuing || !!retryTracker}>Cancel</button>
              <button class="accent" type="submit" disabled={!retryInstruction.trim() || continuing || !!retryTracker}>Retry with these changes</button>
            </div>
          </form>
        {/if}
        {#if actionError}<p role="alert" class="action-error">{actionError}</p>{/if}

      </div>
        <footer>
          <div class="reading-controls" role="group" aria-label="Reading position">
            <div class="page-jump">
              <button class="page-counter" bind:this={jumpButton} onclick={() => jumpOpen ? closeJump() : openJump()} disabled={!frames.length} aria-label={`Jump to page, current page ${index + 1} of ${frames.length}`} aria-expanded={jumpOpen} aria-controls="novel-page-jump" title="Jump to page">{frames.length ? `${index + 1} / ${frames.length}` : "No passage loaded"}</button>
              {#if jumpOpen}
                <form id="novel-page-jump" class="jump-panel" onsubmit={event => { event.preventDefault(); jump(); }}>
                  <label for="novel-page-number">Page (1-{frames.length})</label>
                  <input id="novel-page-number" type="number" min="1" max={frames.length} step="1" required bind:value={jumpPage} bind:this={jumpInput} />
                  <div class="jump-actions"><button type="submit">Go</button><button type="button" onclick={() => { latest(); closeJump(); }}>Jump to latest</button><button type="button" onclick={closeJump}>Cancel</button></div>
                </form>
              {/if}
            </div>
            <button onclick={() => navigate(index - 1)} disabled={index === 0 || !frames.length}>Back</button>
          <button class="accent" aria-keyshortcuts="Space" title="Next (Space)" onclick={() => navigate(index + 1)} disabled={index >= frames.length - 1}>Next</button>
          </div>
          <div class="generation-controls" role="group" aria-label="Story generation">
          <div class="retry-control" role="group" aria-label="Retry controls">
            <button onclick={() => retryReading()} title="Regenerate AI Dungeon's latest response" disabled={!frames.length || continuing || !!retryTracker || !!continuationSnapshot || (composing && composerBusy)}>{retryTracker ? "Retrying..." : "Retry"}</button>
            <button class="retry-edit" aria-label="Retry with changes" aria-expanded={retryEditing} title="Retry with an instruction" onclick={() => { retryEditing = !retryEditing; composing = false; }} disabled={!frames.length || continuing || !!retryTracker || !!continuationSnapshot || (composing && composerBusy)}><span class="font-symbol" aria-hidden="true">edit</span></button>
            {#if historyCount > 1}<button class="retry-count" onclick={showRetryHistory} aria-label={`Retry history: ${historyCount} responses`} title="Choose an existing retry response" disabled={continuing || !!retryTracker || !!continuationSnapshot || (composing && composerBusy)}>{historyCount}</button>{/if}
          </div>
          <button onclick={continueReading} disabled={continuing || !!retryTracker || (composing && composerBusy)}>{continuing && !retryTracker ? "Continuing..." : "Continue"}</button>


          </div>
        </footer>
        <!-- The hover region also needs a keyboard entry point before its composer mounts. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <aside class="action-panel" aria-label="Story actions" aria-describedby="novel-actions-hint" tabindex="0"
          onmouseenter={() => { if (!continuing && !retryTracker) { composing = true; retryEditing = false; } }}
          onfocusin={() => { if (!continuing && !retryTracker) { composing = true; retryEditing = false; } }}>
          <div class="action-menu">
        {#if composing}
          <NovelComposer focusOnOpen={false} blocked={continuing || !!retryTracker} onbusychange={busy => composerBusy = busy} onclose={() => composing = false}
            onsubmitting={submitting} onsubmitted={submitted} onsubmitfailed={() => { continuationSnapshot = null; }} />
        {/if}
          </div>
          <small id="novel-actions-hint" class="hover-hint">Hover here for actions</small>
        </aside>
      </div>
    </div>
  {/if}
{/if}

<style>
  .novel { --scene-gap: 16px; --bottom-inset: max(30px, env(safe-area-inset-bottom, 0px)); position: fixed; inset: 0; z-index: 900; display: flex; flex-direction: column; padding: clamp(12px, 3vw, 32px) clamp(12px, 3vw, 32px) var(--bottom-inset); gap: var(--scene-gap); color: #eee8de; background: radial-gradient(ellipse at 50% 40%, #344347, #10171d 75%); font-family: 'IBM Plex Sans', sans-serif; }
  .portrait-filters { position: absolute; pointer-events: none; }
  .vn-card-error { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); z-index: 950; max-width: 90vw; padding: 10px 16px; border-radius: 8px; background: #422e16; color: #fff; }
  .stage-character { filter: brightness(1); transition: filter 180ms ease; }
  .stage-character.dimmed { filter: brightness(0.45); }
  @media (prefers-reduced-motion: reduce) { .stage-character { transition: none; } }
  .location-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(2.5px); transform: scale(1.012); z-index: -2; pointer-events: none; }
  .location-backdrop.no-blur { filter: none; transform: none; }
  .visual-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .visual-options button[aria-checked="true"] { border-color: #f8ae2c; }
  .instruction-options { margin-bottom: 16px; }
  .instruction-options button { width: 100%; }
  .instruction-options button[aria-checked="true"] { border-color: #f8ae2c; }
  .location-shade { position: absolute; inset: 0; background: linear-gradient(#10171d9c, #10171d30 45%, #10171dc9); z-index: -1; pointer-events: none; }
  .location-control { position: relative; }
  .location-panel { position: absolute; top: 100%; right: 0; z-index: 10; width: min(320px, calc(100vw - 24px)); padding: 12px; display: flex; flex-direction: column; gap: 4px; background: #202b34; border: 1px solid #64727c; border-radius: 8px; box-shadow: 0 8px 24px #0006; }
  .location-panel[hidden] { display: none; }
  .tools { margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }
  .location-control small { font-size: 11px; }
  header, .tools, footer { display: flex; align-items: center; gap: 12px; }
  header { position: relative; z-index: 3; justify-content: space-between; flex-wrap: wrap; }
  .title { min-width: 0; max-width: min(50vw, 600px); letter-spacing: .08em; font-size: 15px; color: #f8ae2c; }
  .scenario-name { display: block; text-transform: uppercase; }
  .scenario-name, .title small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title small { font-size: 12px; }
  small { display: block; color: #aeb9be; letter-spacing: .04em; margin-top: 4px; }
  button { border: 1px solid #64727c; border-radius: 8px; padding: 8px 14px; background: #202b34; color: #eee8de; cursor: pointer; font: inherit; }
  button:hover:enabled { background: #35434e; }
  button:focus-visible { outline: 2px solid #f8ae2c; outline-offset: 3px; }
  button:disabled { opacity: .4; cursor: default; }
  .accent { background: #f8ae2c; color: #191c22; border-color: #f8ae2c; }
  .accent:hover:enabled { background: #ffc761; }
  .stage { position: absolute; top: 90px; bottom: 0; left: 0; right: 0; margin-inline: auto; width: min(100%, 1440px); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(4px, 1vw, 16px); overflow: visible; pointer-events: none; }
  .stage-slot { position: relative; grid-row: 1; min-width: 0; min-height: 0; }
  /* Keep portrait ordering below the reading shade and controls. */
  .stage { z-index: 0; }
  .stage-slot { z-index: 0; }
  .stage-slot.speaking { z-index: 1; }
  .stage-character { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; }
  .portrait { position: absolute; left: 50%; transform: translateX(-50%); width: auto; max-width: min(100vw, 1440px); height: 100%; object-fit: contain; object-position: center top; filter: url("#novel-portrait-depth"); mask-image: linear-gradient(to bottom, #000 calc(100% - var(--reader-height) - 40px), transparent calc(100% - var(--reader-height) + 100px)); }
  .stage-slot[data-edge="left"] .portrait { left: 0; transform: none; object-position: left top; }
  .stage-slot[data-edge="right"] .portrait { left: auto; right: 0; transform: none; object-position: right top; }
  .placeholder { font: 100px Georgia, serif; color: #a3b6b8; opacity: .6; }
  .stage-caption { position: absolute; z-index: 3; bottom: calc(var(--reader-height) + var(--bottom-inset) + 8px); max-width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 16px; background: #10171dcc; border: 1px solid transparent; border-radius: 20px; }
  .reader-panels { position: relative; z-index: 2; margin-top: auto; display: grid; grid-template-columns: clamp(160px, 18vw, 220px) minmax(0, 1fr) min(320px, 30vw); gap: 16px; width: 100%; max-height: 55%; flex-shrink: 0; }
  .reading-shade { position: absolute; z-index: 1; bottom: 0; left: 0; width: 100%; height: calc(var(--reader-height) + var(--bottom-inset) + 80px); background: linear-gradient(to bottom, transparent, #080d12e8 90px, #080d12f5); pointer-events: none; }
  .voice-panel, .action-panel { display: flex; flex-direction: column; }
  .vn-settings-panel { position: absolute; top: calc(100% + 12px); right: 0; width: min(480px, calc(100vw - 40px)); max-height: calc(100dvh - 150px); overflow: auto; box-sizing: border-box; padding: 16px; border: 1px solid #65717b; border-radius: 12px; background: #141e27fa; box-shadow: 0 12px 32px #0008; }
  .settings-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .voice-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-width: 0; padding: 8px; margin: 0; border: 0; }
  .voice-option { display: flex; flex-direction: column; gap: 8px; min-width: 0; font-size: 13px; }
  .voice-preview { grid-column: 1 / -1; min-width: 0; }
  .voice-options:disabled { opacity: 0.4; }
  .hover-hint { flex-shrink: 0; text-align: center; font-size: 11px; line-height: 1.4; color: #b9c2c8; margin: 6px 0 0; }
  .voice-panel { position: absolute; bottom: 0; left: 0; z-index: 1; width: clamp(160px, 18vw, 220px); max-height: 60vh; overflow: auto; }
  .voice-panel .audio-menu { min-height: 0; overflow: auto; display: flex; align-items: stretch; flex-direction: column; padding: 14px; background: #141e27fa; border: 1px solid #65717b; border-radius: 12px; opacity: 0; pointer-events: none; transition: opacity 180ms ease; }
  .voice-panel:hover .audio-menu, .voice-panel:has(:focus-visible) .audio-menu { opacity: 1; pointer-events: auto; }
  @media (prefers-reduced-motion: reduce) { .voice-panel .audio-menu { transition: none; } }
  .action-panel { position: absolute; bottom: 0; right: 0; z-index: 1; min-width: 0; width: min(320px, 30vw); max-height: 40vh; overflow: auto; }
  .action-menu { flex: 0 1 auto; min-height: 0; overflow: auto; padding: 14px; background: #141e27f5; border: 1px solid #65717b; border-radius: 12px; opacity: 0; pointer-events: none; transition: opacity 180ms ease; }
  .action-panel:hover .action-menu, .action-panel:has(:focus-visible) .action-menu { opacity: 1; pointer-events: auto; }
  @media (prefers-reduced-motion: reduce) { .action-menu { transition: none; } }
  .dialogue { grid-column: 2; grid-row: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 16px; background: transparent; padding: clamp(14px, 3vw, 28px) clamp(14px, 3vw, 28px) 0; }
  .prose { overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 3em; font: clamp(18px, 2vw, 25px)/1.6 Georgia, serif; margin: 0; }
  .prose { flex: 1; }
  .dialogue { overflow: auto; }
  .action-error { color: #ffadb2; margin: 0; font-size: 13px; }
  .narration-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; color: #b9c2c8; }
  .queue-badge { padding: 3px 8px; border: 1px solid #59636b; border-radius: 999px; background: #20272c; color: #e2e8ec; font-variant-numeric: tabular-nums; }
  footer { grid-column: 2; grid-row: 2; padding-inline: clamp(14px, 3vw, 28px); flex-wrap: wrap; flex-shrink: 0; }
  .retry-control { display: inline-flex; flex-shrink: 0; }
  .retry-control button { border-radius: 0; }
  .retry-control button:first-child { border-radius: 8px 0 0 8px; }
  .retry-control button:last-child { border-radius: 0 8px 8px 0; }
  .retry-control button:only-child { border-radius: 8px; }
  .retry-control button + button { border-left: 0; }
  .retry-control .retry-count, .retry-control .retry-edit { min-width: 38px; padding-inline: 10px; font-variant-numeric: tabular-nums; }
  .retry-edit .font-symbol { display: block; margin: 0; color: inherit; }
  .retry-instructions { display: flex; flex-direction: column; gap: 8px; }
  .retry-instructions textarea { resize: vertical; min-height: 60px; max-height: 20vh; border: 1px solid #64727c; border-radius: 8px; padding: 10px; background: #0e171f; color: #eee8de; font: inherit; }
  .reading-controls, .generation-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .generation-controls { margin-left: auto; }
  .page-jump { position: relative; }
  .page-counter { color: #b9c2c8; font-size: 13px; white-space: nowrap; background: transparent; border-color: transparent; padding-inline: 4px; }
  .jump-panel { position: absolute; bottom: calc(100% + 12px); left: 0; z-index: 4; width: min(300px, calc(100vw - 64px)); padding: 14px; border: 1px solid #65717b; border-radius: 12px; background: #141e27fa; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 8px 24px #0008; }
  .jump-panel input { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid #64727c; border-radius: 8px; padding: 8px; background: #202b34; color: #eee8de; font: inherit; }
  .jump-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .resume { position: fixed; bottom: 16px; left: 16px; z-index: 900; border-color: #f8ae2c; }
  @media (max-width: 900px) {
    .portrait { left: -17.5%; transform: none; width: 135%; max-width: none; }
    .reader-panels { grid-template-columns: minmax(0, 1fr); max-height: 65%; }
    .dialogue, footer { grid-column: 1; }
    .voice-panel, .action-panel { bottom: calc(100% + 12px); width: calc(50% - 8px); max-height: 30vh; }
  }
  @media (max-width: 500px) { .novel { --scene-gap: 10px; } .tools { gap: 6px; } button { padding: 7px 10px; font-size: 13px; } .dialogue { gap: 10px; } .stage-caption { font-size: 13px; } }
</style>
