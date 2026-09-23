<script lang="ts">
  import { onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { settings } from "@/storage";
  import { aidDetected } from "@/aid/bridge";
  import type { AidCard } from "@/aid/protocol";
  import { playedAdventureId, playedShortId } from "@/aid/adventure";
  import { extensionState } from "@/shared/state.svelte";
  import { indexMentionNames, matchMentionNames, mentionAtCaret, insertMention, type MentionName } from "@/aid/mentions";

  let choices = $state<MentionName[]>([]);
  let active = $state(0);
  let left = $state(0), top = $state(0), width = $state(0), maxHeight = $state(280);
  let aboveInput = $state(true);
  let popup: HTMLDivElement | undefined = $state();
  let input: HTMLTextAreaElement | null = null;
  let names: MentionName[] = [];
  let cards: AidCard[] = [];
  let sourceId: string | null = null;
  let composing = false;
  let dismissed = "", lastQuery = "";

  const signature = (field: HTMLTextAreaElement) => JSON.stringify([playedShortId(), field.value, field.selectionStart, field.selectionEnd]);
  const gameInput = () => {
    let field = document.activeElement;
    while (field?.shadowRoot?.activeElement) field = field.shadowRoot.activeElement;
    return field instanceof HTMLTextAreaElement && (field.id === "game-text-input" || field.hasAttribute("data-novel-action")) && !field.disabled && !field.readOnly ? field : null;
  };

  function close(dismiss = false) {
    if (dismiss && input) dismissed = signature(input);
    choices = [];
  }

  function position() {
    if (!input?.isConnected || !choices.length) return close();
    const rect = input.getBoundingClientRect();
    const viewport = window.visualViewport;
    const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    const vw = viewport?.width ?? window.innerWidth, vh = viewport?.height ?? window.innerHeight;
    if (!rect.width || !rect.height || rect.bottom < y || rect.top > y + vh) return close();
    width = Math.min(420, rect.width, vw - 16);
    left = Math.max(x + 8, Math.min(rect.left, x + vw - width - 8));
    const above = rect.top - y - 16, below = y + vh - rect.bottom - 16;
    aboveInput = above >= Math.min(280, choices.length * 48 + 52) || above >= below;
    maxHeight = Math.max(0, Math.min(280, aboveInput ? above : below));
    if (maxHeight < 70) return close();
    top = aboveInput ? rect.top - 8 : rect.bottom + 8;
  }

  function refresh() {
    const field = gameInput();
    if (!field || composing || extensionState.isEditorOpen || !get(settings).storyCardAutocomplete || !sourceId || playedShortId() !== sourceId) return close();
    input = field;
    const key = signature(field);
    if (key === dismissed) return close();
    const query = mentionAtCaret(field.value, field.selectionStart, field.selectionEnd);
    if (!query) return close();
    const previous = choices[active]?.name;
    choices = matchMentionNames(names, query.query);
    active = key === lastQuery ? Math.max(0, choices.findIndex(c => c.name === previous)) : 0;
    lastQuery = key;
    position();
  }

  function choose(index: number) {
    const choice = choices[index];
    const field = input;
    // Recheck the live text, card list and adventure before modifying the user's draft.
    if (!choice || !field?.isConnected || field.disabled || field.readOnly || !get(settings).storyCardAutocomplete || playedShortId() !== sourceId || signature(field) !== lastQuery) return close();
    const query = mentionAtCaret(field.value, field.selectionStart, field.selectionEnd);
    if (!query || !names.some(n => n.name === choice.name)) return close();
    close();
    insertMention(field, query, choice.name);
    close(true);
  }

  function onKey(event: KeyboardEvent) {
    if (event.isComposing || composing || event.keyCode === 229 || event.ctrlKey || event.altKey || event.metaKey || !gameInput()) return;
    refresh();
    if (!choices.length) return;
    if (event.shiftKey && (event.key === "Enter" || event.key === "Tab")) return close(true);
    if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
    // Capture before AI Dungeon handles Enter, so choosing a name never sends an action.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Escape") return close(true);
    if (event.key === "Enter" || event.key === "Tab") return choose(active);
    active = (active + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
    void tick().then(() => popup?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }));
  }

  onMount(() => {
    const cardsSubscription = aidDetected.subscribe(detected => {
      sourceId = detected.shortId;
      cards = detected.cards;
      names = indexMentionNames(cards, get(settings).storyCardAutocompleteTypes);
      refresh();
    });
    let typesKey = "";
    const settingsSubscription = settings.subscribe(value => {
      const key = JSON.stringify(value.storyCardAutocompleteTypes);
      if (key !== typesKey) {
        typesKey = key;
        names = indexMentionNames(cards, value.storyCardAutocompleteTypes);
      }
      refresh();
    });
    const routeSubscription = playedAdventureId.subscribe(() => refresh());
    const onPointer = (event: PointerEvent) => {
      if (popup && event.composedPath().includes(popup)) return;
      if (!input || !event.composedPath().includes(input)) close(true);
    };
    let disposed = false;
    // Chromium dispatches focusout synchronously when Svelte removes a focused scene control.
    // Defer closing so this listener cannot mutate state during another component's render.
    const onBlur = () => queueMicrotask(() => { if (!disposed && !gameInput()) close(true); });
    const onInput = () => { if (gameInput()) dismissed = ""; refresh(); };
    const onCompositionStart = () => { composing = true; close(); };
    const onCompositionEnd = () => { composing = false; refresh(); };
    const reposition = () => { if (choices.length) position(); };
    const events: [EventTarget, string, EventListener][] = [
      [window, "keydown", onKey as EventListener],
      [document, "input", onInput], [document, "click", refresh],
      [document, "focusin", refresh], [document, "focusout", onBlur],
      [document, "selectionchange", refresh], [window, "pointerdown", onPointer as EventListener],
      [document, "compositionstart", onCompositionStart], [document, "compositionend", onCompositionEnd],
      [window, "resize", reposition], [document, "scroll", reposition],
    ];
    if (window.visualViewport) events.push([window.visualViewport, "resize", reposition], [window.visualViewport, "scroll", reposition]);
    for (const [target, name, listener] of events) target.addEventListener(name, listener, true);
    return () => {
      disposed = true;
      cardsSubscription(); settingsSubscription(); routeSubscription();
      for (const [target, name, listener] of events) target.removeEventListener(name, listener, true);
    };
  });
</script>

{#if choices.length && !extensionState.isEditorOpen}
  <div bind:this={popup} class="fixed z-10000 flex flex-col rounded-xl border border-theme-neutral-400 bg-theme-neutral-200 shadow-2xl overflow-hidden"
    style:left="{left}px" style:top="{top}px" style:width="{width}px" style:max-height="{maxHeight}px" style:transform={aboveInput ? "translateY(-100%)" : undefined}>
    <div class="shrink-0 px-3 py-2 text-xs text-theme-neutral-800">Story cards · ↑↓ choose · Enter / Tab insert · Esc close</div>
    <div role="listbox" aria-label="Story card names" class="min-h-0 overflow-y-auto">
      {#each choices as choice, index (choice.name)}
        <button type="button" role="option" aria-selected={index === active} tabindex="-1"
          onpointerdown={(event) => event.preventDefault()} onclick={() => choose(index)}
          class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-theme-neutral-400 {index === active ? 'bg-theme-neutral-400' : ''}">
          <span class="flex-1 min-w-0 truncate text-sm" title={choice.name}>{choice.name}</span>
          <span class="shrink-0 text-xs text-theme-neutral-800">{choice.type}</span>
        </button>
      {/each}
    </div>
    <span class="sr-only" aria-live="polite">{choices[active]?.name}, {choices[active]?.type}</span>
  </div>
{/if}
