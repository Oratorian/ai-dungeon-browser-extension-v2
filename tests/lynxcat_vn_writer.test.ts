// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { writeLynxVnStyle, LynxStyleBusy } from "@/services/lynxcat_vn_writer";
import { VN_STYLE_START } from "@/services/lynxcat_vn_style";

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });
function fixture() {
  let saved = "My own style";
  vi.stubGlobal("location", { pathname: "/plays/play-test" });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ staticContext: [{ type: "style", content: saved }] }) })));
  document.body.innerHTML = '<button>AI Writing Style</button>';
  document.querySelector('button')!.onclick = () => {
    const dialog = document.createElement('section');
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'element-modal-title');
    dialog.innerHTML = '<h2 id="element-modal-title">AI Writing Style</h2><textarea aria-label="Text"></textarea><button>Cancel</button><button>Save</button>';
    dialog.querySelector('textarea')!.value = saved;
    const [cancel, save] = dialog.querySelectorAll('button');
    cancel!.onclick = () => dialog.remove();
    save!.onclick = () => { saved = dialog.querySelector('textarea')!.value; dialog.remove(); };
    document.body.append(dialog);
  };
  return () => saved;
}
it("saves through the native editor, verifies it, and removes instructions on exit", async () => {
  const saved = fixture();
  await writeLynxVnStyle('play-test', true);
  expect(saved()).toContain(VN_STYLE_START);
  await writeLynxVnStyle('play-test', false);
  expect(saved()).toBe('My own style');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("waits for an existing player editor rather than overwriting its draft", async () => {
  const saved = fixture();
  document.body.insertAdjacentHTML('beforeend', '<section role="dialog" aria-modal="true"><textarea>My unsaved changes</textarea></section>');
  await expect(writeLynxVnStyle('play-test', true)).rejects.toBeInstanceOf(LynxStyleBusy);
  expect(saved()).toBe('My own style');
  expect(document.querySelector('textarea')!.value).toBe('My unsaved changes');
});
it("does not save to another story after navigation", async () => {
  const saved = fixture();
  vi.stubGlobal('location', { pathname: '/plays/play-other' });
  await expect(writeLynxVnStyle('play-test', true)).rejects.toThrow('story changed');
  expect(saved()).toBe('My own style');
});
