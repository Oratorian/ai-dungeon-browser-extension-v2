/** Adapt the native composer rather than duplicating AI Dungeon's action API. */
export const ACTION_MODES = ["Do", "Say", "Story", "Guide"] as const;
export type ActionMode = typeof ACTION_MODES[number];

const input = () => document.querySelector<HTMLTextAreaElement>("#game-text-input");
const modeButton = () => document.querySelector<HTMLElement>('[aria-label="Change input mode"]');
const submitButton = () => document.querySelector<HTMLElement>('[aria-label="Submit action"]');
const disabled = (element: HTMLElement | null) => !element || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
const continueButton = () => [...document.querySelectorAll<HTMLElement>('[aria-label="Command: continue"]')]
  .find(button => !button.closest('[aria-hidden="true"]') && !disabled(button)) ?? null;

/** Continue uses the native command, never an empty draft submission. */
export async function continueStory(signal: AbortSignal) {
  signal.throwIfAborted();
  const route = location.pathname;
  const draft = input()?.value ?? "";
  const close = document.querySelector<HTMLElement>('[aria-label="Close text input"]');
  const restore = !continueButton() && !!close;
  try {
    if (restore) close!.click();
    const button = await until(continueButton, signal);
    signal.throwIfAborted();
    if (location.pathname !== route) throw new Error("The adventure changed. Continue was cancelled.");
    if (disabled(button)) throw new Error("AI Dungeon is not ready to continue yet.");
    button.click();
  } finally {
    if (restore && !signal.aborted && location.pathname === route) {
      await openActionInput(signal);
      if (input()?.value !== draft) writeActionDraft(draft);
    }
  }
}

export function readActionInput() {
  const field = input();
  const labels = [...(modeButton()?.querySelectorAll("span") ?? [])].map(span => span.textContent?.trim().toLowerCase());
  const mode = ACTION_MODES.find(mode => labels.includes(mode.toLowerCase())) ?? null;
  return { available: !!field, value: field?.value ?? "", placeholder: field?.placeholder ?? "Write your action...", mode,
    canSubmit: !!field && !field.disabled && !field.readOnly && !disabled(submitButton()) };
}

async function until<T>(read: () => T | null | false, signal: AbortSignal): Promise<T> {
  const deadline = Date.now() + 1800;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const value = read();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error("AI Dungeon's action controls are unavailable. Use Return to game to check them.");
}

export async function openActionInput(signal: AbortSignal) {
  signal.throwIfAborted();
  const field = input();
  if (!field || field.closest('[aria-hidden="true"]')) {
    const open = [...document.querySelectorAll<HTMLElement>('[aria-label="Command: take a turn"]')]
      .find(button => !button.closest('[aria-hidden="true"]') && !disabled(button));
    open?.click();
  }
  return until(() => input() && modeButton() ? readActionInput() : null, signal);
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
