// Keep the original source node, not the extension's highlighted copy or tooltip text.
const originals = new WeakMap<HTMLElement, HTMLElement>();
export function rememberNovelSource(container: HTMLElement, source: HTMLElement) {
  originals.set(container, source);
}

export function storyText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (["SCRIPT", "STYLE", "BUTTON"].includes(node.tagName)) return "";
  if (node.getAttribute("aria-hidden") === "true" || /^w_[\w-]+$/.test(node.textContent?.trim() ?? "")) return "";
  if (node.tagName === "BR") return "\n";
  const original = originals.get(node);
  if (original && node.contains(original) && original.textContent?.trim()) return storyText(original);
  const text = [...node.childNodes].map(storyText).join("");
  return ["P", "DIV", "LI"].includes(node.tagName) ? text + "\n" : text;
}

export function readNovelPassages(output: HTMLElement) {
  // Player actions may use a labelled row or a standalone typography block
  // instead of the animation container.
  // Read visible text, never the aria-label (which repeats it). Keep DOM order
  // and read nested animation containers only once through their enclosing row.
  const selector = '#transition-opacity, [aria-label^="Action:"], [aria-label^="Action "], [aria-label^="Last action:"]';
  const typography = 'div[style*="font-size"][style*="font-family"][style*="line-height"]';
  const candidates = [...output.querySelectorAll<HTMLElement>(`${selector}, ${typography}`)]
    // A broad styled layout wrapper must not collapse several known passages.
    .filter(element => element.matches(selector) || !element.querySelector(selector));
  const roots = new Set(candidates);
  return candidates
    .filter(element => {
      for (let parent = element.parentElement; parent && parent !== output; parent = parent.parentElement) {
        if (roots.has(parent)) return false;
      }
      return true;
    })
    .map(element => ({ element, text: storyText(element).trim() }))
    .filter(p => p.text);
}
