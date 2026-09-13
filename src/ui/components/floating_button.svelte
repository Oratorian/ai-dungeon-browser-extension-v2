<script lang="ts">
  /* Storage */
  import { settings } from "@/storage";

  /* Other */
  import { extensionState } from "@/shared/state.svelte";
  import { Tab } from "@/shared/types";
  import { fade, fly } from "svelte/transition";

  // A draggable quick-access puck that opens the editor. It replaces the button we used to clone
  // into AI Dungeon's Do/Say/Story/Guide/See action bar: other extensions inject there too, so we
  // stopped fighting them for that row. This one lives in our own shadow root, so nothing of AID's
  // can restyle or re-render it away, and the user can park it wherever it isn't in the way.
  //
  // Hovering it (or tabbing onto it) slides out one shortcut per editor tab, so the things people
  // reach for most, the card set, the AI Dungeon import and the settings, are one click away
  // instead of a click and a tab switch. A plain click on the puck still opens the editor where it
  // was last left.

  const SIZE = 44; // px, must match the size-11 class below (used for edge clamping)
  const MARGIN = 16; // px of clearance kept from every viewport edge
  const DRAG_THRESHOLD = 4; // px of travel before a press counts as a drag instead of a click

  type QuickAction = { icon: string; label: string; tab: Tab };

  // Same icons as the editor's tab strip, so the shortcut and the tab it opens look alike.
  const actions: QuickAction[] = [
    { icon: "swords", label: "Story Cards", tab: Tab.Adventure },
    { icon: "download", label: "AID Sync", tab: Tab.Import },
    { icon: "discover_tune", label: "Settings", tab: Tab.Settings },
  ];

  // Tracked so the puck re-clamps itself into view when the window is resized.
  let vw = $state(window.innerWidth);
  let vh = $state(window.innerHeight);

  // Live position while a drag is in flight; null means "wherever the settings say".
  let drag = $state<{ x: number; y: number } | null>(null);

  let press: { pointerX: number; pointerY: number; originX: number; originY: number } | null = null;
  // Set when a press turned into a drag, so the click that follows it doesn't also open the editor.
  let suppressClick = false;

  // Pointer over the puck or its shortcuts, and keyboard focus inside them. Either shows the fan.
  let hovered = $state(false);
  let focused = $state(false);

  const bounds = $derived({
    maxX: Math.max(MARGIN, vw - SIZE - MARGIN),
    maxY: Math.max(MARGIN, vh - SIZE - MARGIN),
  });

  const clamp = (v: number, max: number) => Math.min(Math.max(v, MARGIN), max);

  const pos = $derived.by(() => {
    if (drag) return drag;
    const { floatingButtonX: x, floatingButtonY: y } = $settings;
    // Never placed: park it bottom-right, clear of AID's story column and its input bar.
    if (x < 0 || y < 0) return { x: bounds.maxX, y: bounds.maxY };
    return { x: clamp(x, bounds.maxX), y: clamp(y, bounds.maxY) };
  });

  // The fan stays shut while dragging: the shortcuts would only get in the way of the drop.
  const fanOpen = $derived($settings.floatingButtonQuickActions && (hovered || focused) && !drag);
  // Slide out toward the side with more room, so a puck parked on the right edge fans left.
  const fanLeft = $derived(pos.x + SIZE / 2 > vw / 2);

  // The puck unmounts when the editor opens, and a pointerleave never fires for an element that is
  // gone, so the hover state has to be reset by hand or the fan is open again when the editor
  // closes, with the pointer nowhere near it.
  $effect(() => {
    if (extensionState.isEditorOpen) {
      hovered = false;
      focused = false;
    }
  });

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return; // primary button only, so right-click still opens the context menu
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    press = { pointerX: e.clientX, pointerY: e.clientY, originX: pos.x, originY: pos.y };
    // Reset here rather than only in the click handler: a drag doesn't always produce a click, and
    // a stale flag would swallow the next genuine one.
    suppressClick = false;
  }

  function onPointerMove(e: PointerEvent) {
    if (!press) return;
    const dx = e.clientX - press.pointerX;
    const dy = e.clientY - press.pointerY;
    // Ignore the jitter of an ordinary click so it still opens the editor.
    if (!drag && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag = { x: clamp(press.originX + dx, bounds.maxX), y: clamp(press.originY + dy, bounds.maxY) };
  }

  function onPointerUp(e: PointerEvent) {
    if (!press) return;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);

    if (drag) {
      // One store write for both coordinates, so this persists in a single storage round trip.
      const { x, y } = drag;
      settings.update((s) => ({ ...s, floatingButtonX: Math.round(x), floatingButtonY: Math.round(y) }));
      suppressClick = true;
    }
    press = null;
    drag = null;
  }

  // Opening lives on click, not pointerup, so keyboard activation (Enter/Space on the focused
  // button) works too; a drag suppresses the click it generates.
  function onClick() {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    extensionState.isEditorOpen = true;
  }

  function openAt(tab: Tab) {
    extensionState.editorTab = tab;
    extensionState.isEditorOpen = true;
  }

  function onFocusOut(e: FocusEvent) {
    // Focus moving between the puck and a shortcut stays "inside"; only leaving the group closes.
    const next = e.relatedTarget as Node | null;
    if (!next || !(e.currentTarget as HTMLElement).contains(next)) focused = false;
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<!-- Hidden while the editor is open: it would only sit dimmed under the modal's backdrop. -->
{#if $settings.floatingButton && !extensionState.isEditorOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    transition:fade={{ duration: 150 }}
    onpointerenter={() => (hovered = true)}
    onpointerleave={() => (hovered = false)}
    onfocusin={() => (focused = true)}
    onfocusout={onFocusOut}
    style="left: {pos.x}px; top: {pos.y}px;"
    class="fixed z-999 size-11"
  >
    {#if fanOpen}
      <!-- The padding on the fan's inner edge keeps the pointer inside this group while it crosses
           the gap from the puck to the first shortcut, so the fan does not shut on the way over. -->
      <div
        transition:fly={{ duration: 150, x: fanLeft ? 12 : -12 }}
        class="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 {fanLeft
          ? 'right-full pr-2 flex-row-reverse'
          : 'left-full pl-2'}"
      >
        {#each actions as action (action.tab)}
          <button
            onclick={() => openAt(action.tab)}
            aria-label="Open {action.label}"
            title={action.label}
            class="flex items-center justify-center size-9 rounded-full select-none
                   bg-theme-neutral-200/95 ring-1 ring-pretty-theme/40 shadow-md backdrop-blur-sm
                   text-theme-neutral-800 hover:text-pretty-theme hover:ring-pretty-theme transition-colors"
          >
            <span class="font-symbol text-lg pointer-events-none">{action.icon}</span>
          </button>
        {/each}
      </div>
    {/if}

    <button
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onclick={onClick}
      aria-label="Open the Dungeon Extension editor (drag to move)"
      title="Dungeon Extension , click to open, drag to move"
      style="cursor: {drag ? 'grabbing' : 'grab'};"
      class="relative flex items-center justify-center size-11 rounded-full touch-none select-none
             bg-theme-neutral-200/90 ring-1 ring-pretty-theme/50 shadow-lg backdrop-blur-sm
             {fanOpen ? 'opacity-100' : 'opacity-70'} hover:opacity-100 transition-opacity"
    >
      <span class="font-symbol text-2xl text-pretty-theme pointer-events-none">handyman</span>
    </button>
  </div>
{/if}
