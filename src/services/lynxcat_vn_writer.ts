import { planLynxVnStyle } from "./lynxcat_vn_style";
import { lynxRunId } from "./site";

export class LynxStyleBusy extends Error {}
const modal = () => document.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="element-modal-title"]');
const button = (root: ParentNode, text: string) => [...root.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === text);
const pause = () => new Promise(resolve => setTimeout(resolve, 80));

/** Save through the native editor so Lynx's in-memory generation context updates too. */
export async function writeLynxVnStyle(runId: string, enabled: boolean) {
  const guard = () => { if (lynxRunId(location.pathname) !== runId) throw new Error("The story changed before VN instructions could be saved."); };
  const read = async () => {
    const response = await fetch(`https://lynxcatai.com/api/runs/${encodeURIComponent(runId)}/elements`, { credentials: "include" });
    if (!response.ok) throw new Error(`Could not read AI Writing Style (${response.status}). Refresh the story and retry.`);
    const data = await response.json();
    const styles = data.staticContext?.filter((s: { type?: string }) => s.type === "style");
    if (styles?.length !== 1 || typeof styles[0].content !== "string") throw new Error("Open AI Writing Style in LynxCatAI and save it once, then retry.");
    return styles[0].content as string;
  };
  guard();
  const before = await read();
  guard();
  const planned = planLynxVnStyle(before, enabled);
  if (planned === before) return;
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) throw new LynxStyleBusy("Close the open LynxCatAI dialog to finish updating VN instructions.");
  const opener = button(document, "AI Writing Style");
  if (!opener || opener.disabled) throw new LynxStyleBusy("Open Story Elements to let VN update AI Writing Style.");
  opener.click();
  let owned: HTMLElement | null = null;
  let field: HTMLTextAreaElement | null = null;
  let original = "";
  let submitted = false;
  try {
    for (let i = 0; i < 50 && !owned; i++) { guard(); owned = modal(); if (!owned) await pause(); }
    if (!owned || owned.querySelector('#element-modal-title')?.textContent?.trim() !== "AI Writing Style") throw new Error("AI Writing Style did not open. Please retry.");
    field = owned.querySelector('textarea[aria-label="Text"]');
    if (!field || field.disabled || field.readOnly) throw new Error("AI Writing Style is not editable.");
    original = field.value;
    // Never replace stale native state or an unsaved player edit with API data.
    if (original !== before) throw new Error("AI Writing Style changed. Save your edits and retry.");
    guard();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, planned);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await pause();
    guard();
    if (!field.isConnected || field.value !== planned) throw new Error("AI Writing Style changed before saving. Please retry.");
    const save = button(owned, "Save");
    if (!save || save.disabled) throw new Error("LynxCatAI is not ready to save AI Writing Style.");
    save.click(); submitted = true;
    for (let i = 0; i < 100 && owned.isConnected; i++) { guard(); await pause(); }
    guard();
    if (owned.isConnected) throw new Error("AI Writing Style did not finish saving. Check the native editor and retry.");
    if (await read() !== planned) throw new Error("AI Writing Style was not saved as expected. Please retry.");
  } finally {
    // Leave failed submissions visible; close only our untouched, unsaved editor.
    if (!submitted && owned?.isConnected && field && (field.value === planned || field.value === original)) button(owned, "Cancel")?.click();
  }
}
