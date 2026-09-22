<script lang="ts">
  /* Storage */
  import { settings } from "@/storage";

  /* Other */
  import { extensionState } from "@/shared/state.svelte";
  import { Tab } from "@/shared/types";
  import { fade, scale } from "svelte/transition";
  import { FLOATING_BUTTON_ICON, floatingButtonSize, ringLayout } from "@/shared/floating_button";
  import SetSwitcher from "./set_switcher.svelte";
  import StampBinding from "./stamp_binding.svelte";

  // A draggable quick-access puck that opens the editor. It replaces the button we used to clone
  // into AI Dungeon's Do/Say/Story/Guide/See action bar: other extensions inject there too, so we
  // stopped fighting them for that row. This one lives in our own shadow root, so nothing of AID's
  // can restyle or re-render it away, and the user can park it wherever it isn't in the way.
  //
  // Hovering it (or tabbing onto it) brings up a ring of quick actions around it. Two of them open a
  // second level in place: Sets switches, creates or imports a card set, Stamp binds the set to the
  // story being played. Both are things people do every time they start or duplicate an adventure,
  // and the editor was a detour for them. Sync and Settings open editor tabs; Visual Novel Mode
  // toggles the scene reader directly. A plain click
  // on the puck still opens the editor where it was last left.
  //
  // The second level opens on hover, like the ring, and a click pins it so it survives the pointer
  // wandering off; a click outside or Escape unpins. The ring buttons sit wherever they fit around
  // the puck (see ringLayout), so a puck parked in a corner shows a quarter ring instead of hiding
  // half its actions off screen.

  const MARGIN = 16; // px of clearance kept from every viewport edge
  const DRAG_THRESHOLD = 4; // px of travel before a press counts as a drag instead of a click
  const CLOSE_GRACE = 250; // ms the ring survives the pointer crossing a gap between its parts

  type ActionId = "sets" | "stamp" | "sync" | "novel" | "settings";
  type QuickAction = { id: ActionId; icon: string; label: string; panel: boolean };

  // Clockwise order around the ring, always this sequence however much of the ring fits.
  const actions: QuickAction[] = [
    { id: "sets", icon: "swap_horiz", label: "Sets", panel: true },
    { id: "stamp", icon: "approval", label: "Stamp", panel: true },
    { id: "sync", icon: "sync", label: "AID Sync", panel: false },
    { id: "novel", icon: "theater_comedy", label: "Visual Novel Mode", panel: false },
    { id: "settings", icon: "settings", label: "Settings", panel: false },
  ];

  // Tracked so the puck re-clamps itself into view when the window is resized.
  let vw = $state(window.innerWidth);
  let vh = $state(window.innerHeight);

  // Drawn size, set by the slider in Settings; the browser scales the icon to it.
  const SIZE = $derived(floatingButtonSize($settings.floatingButtonSize));
  // The extension's own icon as the face of the puck; the folder is listed under
  // web_accessible_resources so the page may load it.
  const iconUrl = browser.runtime.getURL(FLOATING_BUTTON_ICON);
  // Ring buttons scale with the puck, within reason: a 24px puck still needs a tappable button and
  // a 128px puck does not need buttons the size of a fist.
  const ringSize = $derived(Math.min(56, Math.max(30, Math.round(SIZE * 0.8))));
  const ringGap = $derived(Math.max(6, Math.round(ringSize / 5)));
  // The radius the ring wants; ringLayout may push it out when the puck is hemmed in.
  const baseRadius = $derived(SIZE / 2 + ringGap + ringSize / 2);

  // Live position while a drag is in flight; null means "wherever the settings say".
  let drag = $state<{ x: number; y: number } | null>(null);

  let press: { pointerX: number; pointerY: number; originX: number; originY: number } | null = null;
  // Set when a press turned into a drag, so the click that follows it doesn't also open the editor.
  let suppressClick = false;

  // Pointer over any part of the group, and keyboard focus inside it. Either shows the ring.
  let hovered = $state(false);
  let focused = $state(false);
  // Which second level is showing, and whether a click pinned it.
  let panel = $state<ActionId | null>(null);
  let pinned = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  let group: HTMLElement | undefined = $state();

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

  // The ring stays shut while dragging: it would only get in the way of the drop.
  const ringOpen = $derived($settings.floatingButtonQuickActions && (hovered || focused || pinned) && !drag);

  const layout = $derived(
    ringLayout({
      cx: pos.x + SIZE / 2,
      cy: pos.y + SIZE / 2,
      radius: baseRadius,
      buttonSize: ringSize,
      gap: ringGap,
      vw,
      vh,
      margin: MARGIN,
      count: actions.length,
    })
  );
  const placed = $derived(layout.slots.map((slot, i) => ({ action: actions[i]!, slot })));
  // How far the whole ring reaches from the puck's centre; the panel sits just outside it.
  const reach = $derived(layout.radius + ringSize / 2);

  // The panel opens toward the middle of the screen, so it never runs off the edge the puck is
  // parked against: to the left of the ring when the puck is on the right half, and growing upward
  // from the puck's bottom edge when it is on the lower half.
  const panelLeft = $derived(pos.x + SIZE / 2 > vw / 2);
  const panelUp = $derived(pos.y + SIZE / 2 > vh / 2);
  const panelOffset = $derived(Math.round(SIZE / 2 + reach + 8));

  const panelAction = $derived(panel ? actions.find((a) => a.id === panel) : undefined);

  // The puck unmounts when the editor opens, and a pointerleave never fires for an element that is
  // gone, so the hover state has to be reset by hand or the ring is open again when the editor
  // closes, with the pointer nowhere near it.
  $effect(() => {
    if (extensionState.isEditorOpen) closeAll();
  });

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function closeAll() {
    cancelClose();
    hovered = false;
    focused = false;
    panel = null;
    pinned = false;
  }

  function onGroupEnter() {
    cancelClose();
    hovered = true;
  }

  // The ring, its buttons and the panel are separate boxes with page showing between them, so the
  // pointer leaves the group on every hop. A short grace keeps the ring up across the hop and lets
  // a real departure close it.
  function onGroupLeave() {
    cancelClose();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      hovered = false;
      if (!pinned) panel = null;
    }, CLOSE_GRACE);
  }

  function onActionEnter(action: QuickAction) {
    if (pinned) return; // a pinned panel stays until it is clicked away
    panel = action.panel ? action.id : null;
  }

  function onActionClick(action: QuickAction) {
    if (action.id === "novel") {
      $settings.visualNovelMode = !$settings.visualNovelMode;
      closeAll();
      return;
    }
    if (!action.panel) {
      openAt(action.id === "sync" ? Tab.Import : Tab.Settings);
      return;
    }
    if (panel === action.id && pinned) {
      pinned = false;
      panel = null;
      return;
    }
    panel = action.id;
    pinned = true;
  }

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
    // Focus moving between the puck, a ring button and the panel stays "inside"; only leaving the
    // group closes.
    const next = e.relatedTarget as Node | null;
    if (!next || !(e.currentTarget as HTMLElement).contains(next)) focused = false;
  }

  // A click anywhere else, or Escape, unpins and closes. Listened for in the capture phase on the
  // window so it works whatever AI Dungeon's page does with the event afterwards.
  function onWindowPointerDown(e: PointerEvent) {
    if (!pinned && !panel) return;
    if (group && e.composedPath().includes(group)) return;
    closeAll();
  }

  function onWindowKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && (pinned || panel)) closeAll();
  }
</script>

<svelte:window
  bind:innerWidth={vw}
  bind:innerHeight={vh}
  onpointerdowncapture={onWindowPointerDown}
  onkeydowncapture={onWindowKeyDown}
/>

<!-- Hidden while the editor is open: it would only sit dimmed under the modal's backdrop. -->
{#if $settings.floatingButton && !extensionState.isEditorOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={group}
    transition:fade={{ duration: 150 }}
    onpointerenter={onGroupEnter}
    onpointerleave={onGroupLeave}
    onfocusin={() => (focused = true)}
    onfocusout={onFocusOut}
    style="left: {pos.x}px; top: {pos.y}px; width: {SIZE}px; height: {SIZE}px;"
    class="fixed z-999"
  >
    {#if ringOpen}
      <!-- Invisible disc under the ring, so the pointer crossing from the puck to a button never
           leaves the group. Only exists while the ring is up. -->
      <div
        style="width: {reach * 2}px; height: {reach * 2}px; left: {SIZE / 2 - reach}px; top: {SIZE / 2 - reach}px;"
        class="absolute rounded-full"
      ></div>

      {#each placed as { action, slot } (action.id)}
        <button
          transition:scale={{ duration: 120, start: 0.6 }}
          onpointerenter={() => onActionEnter(action)}
          onclick={() => onActionClick(action)}
          aria-label={action.label}
          aria-pressed={action.id === "novel" ? $settings.visualNovelMode : undefined}
          aria-expanded={action.panel ? panel === action.id : undefined}
          title={action.id === "novel" ? `Visual Novel Mode: ${$settings.visualNovelMode ? "On" : "Off"}` : action.label}
          style="width: {ringSize}px; height: {ringSize}px; font-size: {Math.round(ringSize * 0.55)}px;
                 left: {SIZE / 2 + slot.dx - ringSize / 2}px; top: {SIZE / 2 + slot.dy - ringSize / 2}px;"
          class="absolute flex items-center justify-center rounded-full select-none shadow-md backdrop-blur-sm
                 bg-theme-neutral-200/95 ring-1 transition-colors
                 {panel === action.id || (action.id === "novel" && $settings.visualNovelMode)
            ? 'text-pretty-theme ring-pretty-theme'
            : 'text-theme-neutral-800 ring-pretty-theme/40 hover:text-pretty-theme hover:ring-pretty-theme'}"
        >
          <span class="font-symbol pointer-events-none" style="font-size: inherit;">{action.icon}</span>
        </button>
      {/each}

      {#if panel && panelAction}
        <div
          transition:fade={{ duration: 120 }}
          style="{panelLeft ? 'right' : 'left'}: {panelOffset}px; {panelUp ? 'bottom' : 'top'}: 0;"
          class="absolute w-72 max-w-[calc(100vw-2rem)] p-2 rounded-xl bg-theme-neutral-200 ring-1 ring-theme-neutral-400 shadow-2xl text-theme-neutral-900"
        >
          <div class="flex items-center justify-between px-2 pb-1.5">
            <span class="text-xs font-bold uppercase tracking-wide text-theme-neutral-700">{panelAction.label}</span>
            {#if pinned}
              <span class="font-symbol text-sm text-theme-neutral-600" title="Pinned; click outside or press Escape to close"
                >keep</span
              >
            {/if}
          </div>
          {#if panel === "sets"}
            <SetSwitcher onsync={() => openAt(Tab.Import)} />
          {:else if panel === "stamp"}
            <StampBinding standalone />
          {/if}
        </div>
      {/if}
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
             {ringOpen ? 'opacity-100' : 'opacity-80'} hover:opacity-100 transition-opacity"
    >
      <img src={iconUrl} alt="" draggable="false" class="block size-full pointer-events-none" />
    </button>
  </div>
{/if}
