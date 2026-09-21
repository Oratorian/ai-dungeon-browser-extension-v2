/** Capture typography before sanitizing nested text markup. Never copy HTML attributes. */
export function preserveTypography(original: HTMLElement, host: HTMLElement): void {
  const walker = original.ownerDocument.createTreeWalker(original, NodeFilter.SHOW_TEXT);
  let source = original;
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim();
    if (!text || /^w_[\w-]+$/.test(text)) continue;
    const parent = walker.currentNode.parentElement;
    if (!parent || parent.closest('[aria-hidden="true"]')) continue;
    source = parent;
    break;
  }
  const style = getComputedStyle(source);
  for (const property of ["font-size", "font-family", "line-height", "letter-spacing"]) {
    host.style.setProperty(property, style.getPropertyValue(property));
  }
}
