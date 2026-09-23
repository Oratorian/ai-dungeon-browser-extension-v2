/** Adapt the native composer rather than duplicating AI Dungeon's action API. */
export const ACTION_MODES = ["Do", "Say", "Story", "Guide"] as const;
export type ActionMode = typeof ACTION_MODES[number];

const input = () => document.querySelector<HTMLTextAreaElement>("#game-text-input");
const modeButton = () => document.querySelector<HTMLElement>('[aria-label="Change input mode"]');
const submitButton = () => document.querySelector<HTMLElement>('[aria-label="Submit action"]');
// Continue/Retry may close the native composer. Restore its draft when the user next opens it, rather
// than reopening controls that AI Dungeon removes while generating the continuation.
const deferredDrafts = new Map<string, string>();
const disabled = (element: HTMLElement | null) => !element || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
const commandButton = (command: "continue" | "retry") => [...document.querySelectorAll<HTMLElement>(`[aria-label="Command: ${command}"]`)]
  .find(button => !button.closest('[aria-hidden="true"]') && !disabled(button)) ?? null;

/** Continue uses the native command, never an empty draft submission. */
export async function continueStory(signal: AbortSignal) {
  return runStoryCommand("continue", signal);
}

/** Retry replaces the latest response through AI Dungeon's own command. */
export async function retryStory(signal: AbortSignal) {
  return runStoryCommand("retry", signal);
}

const historyButton = () => [...document.querySelectorAll<HTMLElement>('[aria-label="Retry history"]')]
  .find(button => !button.closest('[aria-hidden="true"]') && !disabled(button)) ?? null;

export function retryHistoryCount(): number {
  return Number(historyButton()?.textContent?.trim()) || 0;
}

export function closeRetryHistory() {
  const button = historyButton();
  if (button?.getAttribute("aria-expanded") === "true") button.click();
}

/** Let the native picker own previewing and selecting existing alternatives. */
export async function browseRetryHistory(signal: AbortSignal) {
  signal.throwIfAborted();
  const route = location.pathname;
  if (!historyButton()) {
    const close = document.querySelector<HTMLElement>('[aria-label="Close text input"]');
    const draft = input()?.value;
    if (close && draft) deferredDrafts.set(route, draft);
    close?.click();
  }
  const button = await until(historyButton, signal, "Retry history is not available for this response.");
  signal.throwIfAborted();
  if (location.pathname !== route) throw new Error("The adventure changed. Retry history was cancelled.");
  if (button.getAttribute("aria-expanded") !== "true") button.click();
  await until(() => historyButton()?.getAttribute("aria-expanded") === "true", signal, "Retry history did not open.");
  while (historyButton()?.getAttribute("aria-expanded") === "true") {
    signal.throwIfAborted();
    if (location.pathname !== route) throw new Error("The adventure changed. Retry history was cancelled.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function runStoryCommand(command: "continue" | "retry", signal: AbortSignal) {
  signal.throwIfAborted();
  const route = location.pathname;
  const draft = input()?.value ?? "";
  const close = document.querySelector<HTMLElement>('[aria-label="Close text input"]');
  const restore = !commandButton(command) && !!close;
  if (restore && draft) deferredDrafts.set(route, draft);
  try {
    if (restore) close!.click();
    const label = command === "retry" ? "Retry" : "Continue";
    const button = await until(() => commandButton(command), signal, `${label} is not available yet. Wait for AI Dungeon to finish generating, then try again.`);
    signal.throwIfAborted();
    if (location.pathname !== route) throw new Error(`The adventure changed. ${label} was cancelled.`);
    if (disabled(button)) throw new Error(`AI Dungeon is not ready to ${command} yet.`);
    button.click();
  } catch (error) {
    if (restore && !signal.aborted && location.pathname === route) {
      // Recovery must never replace the original failure with a textbox timeout.
      try { await openActionInput(signal); } catch { /* The draft remains available for the next open. */ }
    }
    throw error;
  }
}

export function readActionInput() {
  const field = input();
  const labels = [...(modeButton()?.querySelectorAll("span") ?? [])].map(span => span.textContent?.trim().toLowerCase());
  const mode = ACTION_MODES.find(mode => labels.includes(mode.toLowerCase())) ?? null;
  const available = !!field && !!mode && !field.closest('[aria-hidden="true"], .gameplay-action-input-dock[data-visible="false"]');
  return { available, value: deferredDrafts.get(location.pathname) ?? field?.value ?? "", placeholder: field?.placeholder ?? "Write your action...", mode,
    canSubmit: !!field && !field.disabled && !field.readOnly && !disabled(submitButton()) };
}

async function until<T>(read: () => T | null | false, signal: AbortSignal, message = "AI Dungeon's action controls are unavailable. Use Return to game to check them."): Promise<T> {
  const deadline = Date.now() + 1800;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const value = read();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(message);
}

export async function openActionInput(signal: AbortSignal) {
  signal.throwIfAborted();
  const attempted = new WeakSet<HTMLElement>();
  return until(() => {
    const state = readActionInput();
    if (state.available) {
      const draft = deferredDrafts.get(location.pathname);
      if (draft !== undefined) {
        const field = input()!;
        if (field.disabled || field.readOnly) return null;
        writeActionDraft(draft);
      }
      return readActionInput();
    }
    const open = [...document.querySelectorAll<HTMLElement>('[aria-label="Command: take a turn"]')]
      .find(button => !button.closest('[aria-hidden="true"]') && !disabled(button));
    if (open && !attempted.has(open)) { attempted.add(open); open.click(); }
    return null;
  }, signal);
}

export async function setActionMode(mode: ActionMode, signal: AbortSignal) {
  await openActionInput(signal);
  if (readActionInput().mode === mode) return;
  signal.throwIfAborted();
  const selector = `[aria-label="Set to '${mode}' mode"]`;
  if (!document.querySelector(selector)) modeButton()?.click();
  try {
    const option = await until(() => document.querySelector<HTMLElement>(selector), signal);
    if (disabled(option)) throw new Error(`${mode} is unavailable in AI Dungeon for this adventure.`);
    signal.throwIfAborted();
    option.click();
    await until(() => readActionInput().mode === mode, signal);
  } finally {
    document.querySelector<HTMLElement>(`[aria-label="Close 'Input Mode' menu"]`)?.click();
  }
}

export function writeActionDraft(value: string) {
  const field = input();
  if (!field || field.disabled || field.readOnly) throw new Error("AI Dungeon's input is not ready. Your draft is kept here.");
  deferredDrafts.delete(location.pathname);
  if (field.value === value) return;
  // Use the native setter to notify React's controlled field, just like the @ autocomplete.
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
  field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText" }));
}

/** Only called by the scene's explicit Send button; mode selection and typing never submit. */
export async function submitAction(value: string, mode: ActionMode, signal: AbortSignal) {
  if (!value.trim()) throw new Error("Write an action first.");
  const route = location.pathname;
  await setActionMode(mode, signal);
  if (location.pathname !== route) throw new Error("The adventure changed. Your action was not submitted.");
  writeActionDraft(value);
  await until(() => readActionInput().canSubmit, signal);
  signal.throwIfAborted();
  const state = readActionInput();
  if (location.pathname !== route || state.value !== value || state.mode !== mode) throw new Error("The input changed. Check your action before sending again.");
  const button = submitButton();
  if (disabled(button)) throw new Error("AI Dungeon is not ready to receive an action yet.");
  button!.click();
}
