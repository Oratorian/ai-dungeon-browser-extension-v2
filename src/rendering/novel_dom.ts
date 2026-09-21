// Keep the original source node, not the extension's highlighted copy or tooltip text.
const originals = new WeakMap<HTMLElement, HTMLElement>();
export function rememberNovelSource(container: HTMLElement, source: HTMLElement) {
  originals.set(container, source);
}

export function storyText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (["SCRIPT", "STYLE", "BUTTON"].includes(node.tagName)) return "";
  if (node.tagName === "BR") return "\n";
  const text = [...node.childNodes].map(storyText).join("");
  return ["P", "DIV", "LI"].includes(node.tagName) ? text + "\n" : text;
}

export function readNovelPassages(output: HTMLElement) {
  return [...output.querySelectorAll<HTMLElement>("#transition-opacity")].map(element => {
    const source = originals.get(element) ?? [...element.children]
      .filter((child): child is HTMLElement => child instanceof HTMLElement && !/^w_[\w-]+$/.test(child.textContent?.trim() ?? ""))
      .sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0];
    return { element, text: source ? storyText(source).trim() : "" };
  }).filter(p => p.text);
}
