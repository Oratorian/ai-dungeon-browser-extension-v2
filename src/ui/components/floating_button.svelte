<script lang="ts">
  /* Storage */
  import { settings } from "@/storage";

  /* Other */
  import { extensionState } from "@/shared/state.svelte";
  import { Tab } from "@/shared/types";
  import { fade, fly } from "svelte/transition";
  import { floatingButtonIconFile, floatingButtonSize } from "@/shared/floating_button";

  // A draggable quick-access puck that opens the editor. It replaces the button we used to clone
  // into AI Dungeon's Do/Say/Story/Guide/See action bar: other extensions inject there too, so we
  // stopped fighting them for that row. This one lives in our own shadow root, so nothing of AID's
  // can restyle or re-render it away, and the user can park it wherever it isn't in the way.
  //
  // Hovering it (or tabbing onto it) slides out one shortcut per editor tab, so the things people
  // reach for most, the card set, the AI Dungeon import and the settings, are one click away
  // instead of a click and a tab switch. A plain click on the puck still opens the editor where it
  // was last left.

  const MARGIN = 16; // px of clearance kept from every viewport edge
  const DRAG_THRESHOLD = 4; // px of travel before a press counts as a drag instead of a click

  type QuickAction = { icon: string; label: string; tab: Tab };

  // Same icons as the editor's tab strip, so the shortcut and the tab it opens look alike.
  const actions: QuickAction[] = [
    { icon: "style", label: "Story Cards", tab: Tab.Adventure },
    { icon: "sync", label: "AID Sync", tab: Tab.Import },
    { icon: "settings", label: "Settings", tab: Tab.Settings },
  ];

  // Tracked so the puck re-clamps itself into view when the window is resized.
  let vw = $state(window.innerWidth);
  let vh = $state(window.innerHeight);
  let dpr = $state(window.devicePixelRatio || 1);

  // Drawn size, chosen in Settings from the icon sizes the manifest ships.
  const SIZE = $derived(floatingButtonSize($settings.floatingButtonSize));
  // The extension's own icon as the face of the puck, at a file size that covers the screen's
  // physical pixels; the folder is listed under web_accessible_resources so the page may load it.
  const iconUrl = $derived(browser.runtime.getURL(floatingButtonIconFile(SIZE, dpr)));
  // Shortcuts scale with the puck, within reason: a 16px puck still needs a tappable shortcut and a
  // 128px puck does not need shortcuts the size of a fist.
  const fanSize = $derived(Math.min(56, Math.max(28, Math.round(SIZE * 0.8))));
  const fanGap = $derived(Math.max(6, Math.round(fanSize / 6)));

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

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} onresize={() => (dpr = window.devicePixelRatio || 1)} />

<!-- Hidden while the editor is open: it would only sit dimmed under the modal's backdrop. -->
{#if $settings.floatingButton && !extensionState.isEditorOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    transition:fade={{ duration: 150 }}
    onpointerenter={() => (hovered = true)}
    onpointerleave={() => (hovered = false)}
    onfocusin={() => (focused = true)}
    onfocusout={onFocusOut}
    style="left: {pos.x}px; top: {pos.y}px; width: {SIZE}px; height: {SIZE}px;"
    class="fixed z-999"
  >
    {#if fanOpen}
      <!-- The padding on the fan's inner edge keeps the pointer inside this group while it crosses
           the gap from the puck to the first shortcut, so the fan does not shut on the way over. -->
      <div
        transition:fly={{ duration: 150, x: fanLeft ? 12 : -12 }}
        style="gap: {fanGap}px; padding-inline: {fanGap + 2}px;"
        class="absolute top-1/2 -translate-y-1/2 flex items-center {fanLeft ? 'right-full flex-row-reverse' : 'left-full'}"
      >
        {#each actions as action (action.tab)}
          <button
            onclick={() => openAt(action.tab)}
            aria-label="Open {action.label}"
            title={action.label}
            style="width: {fanSize}px; height: {fanSize}px; font-size: {Math.round(fanSize * 0.55)}px;"
            class="flex items-center justify-center rounded-full select-none
                   bg-theme-neutral-200/95 ring-1 ring-pretty-theme/40 shadow-md backdrop-blur-sm
                   text-theme-neutral-800 hover:text-pretty-theme hover:ring-pretty-theme transition-colors"
          >
            <span class="font-symbol pointer-events-none" style="font-size: inherit;">{action.icon}</span>
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
      style="cursor: {drag ? 'grabbing' : 'grab'}; border-radius: {Math.max(4, Math.round(SIZE / 4))}px;"
      class="relative block size-full overflow-hidden touch-none select-none shadow-lg
             {fanOpen ? 'opacity-100' : 'opacity-80'} hover:opacity-100 transition-opacity"
    >
      <img src={iconUrl} alt="" draggable="false" class="block size-full pointer-events-none" />
    </button>
  </div>
{/if}
