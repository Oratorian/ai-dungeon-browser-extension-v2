const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Rolling suffix also recognizes the code after an extra leading arrow press. */
export function createKonamiCode() {
  let keys: string[] = [];
  return (key: string, reset = false): boolean => {
    if (reset) { keys = []; return false; }
    keys = [...keys, key.length === 1 ? key.toLowerCase() : key].slice(-code.length);
    if (!code.every((value, index) => keys[index] === value)) return false;
    keys = [];
    return true;
  };
}

/** Capture before gameplay/VN handlers stop propagation; never consume the user's keys. */
export function installKonamiCode(target: Window, unlock: () => void) {
  const code = createKonamiCode();
  const keydown = (event: KeyboardEvent) => {
    const editing = event.composedPath().some(node => node instanceof HTMLElement &&
      (node.isContentEditable || node.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')));
    if (editing || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
      code("", true); return;
    }
    if (!event.repeat && code(event.key)) unlock();
  };
  target.addEventListener("keydown", keydown, { capture: true });
  return () => target.removeEventListener("keydown", keydown, { capture: true });
}
