import type { StoryCard } from "@/shared/types";
import { cardImage } from "@/shared/card_images";

const transcript = '[aria-label="Story transcript"]';
const mentionSelector = `${transcript} .story-turn-copy .story-detail-mention[data-entity-id]`;
type Options = { iconColor: string; highlightBold: boolean; iconSize: number; highlightFocus?: boolean };

/** Decorate native mentions without replacing React-owned text or controls. */
export function createLynxRenderer(doc: Document = document, onFocus: (id: string) => void = () => {}) {
  const originals = new Map<HTMLElement, { style: string | null; src?: string | null; override?: string }>();
  const added = new Set<HTMLElement>();
  const highlighted: string[] = [];
  const style = doc.createElement("style");
  doc.head.append(style);
  const preview = doc.createElement("img");
  preview.alt = "Character portrait";
  preview.referrerPolicy = "no-referrer";
  preview.style.cssText = "position:fixed;z-index:2147483647;max-width:280px;max-height:45vh;object-fit:contain;pointer-events:none;border-radius:10px;box-shadow:0 8px 30px #0009;display:none";
  doc.body.append(preview);
  const focus = doc.createElement("button");
  focus.textContent = "Focus";
  focus.style.cssText = "position:fixed;z-index:2147483647;display:none;background:#202b34;color:white;border:1px solid #82909a;border-radius:8px;padding:8px 12px;cursor:pointer";
  doc.body.append(focus);
  let hoveredCard: StoryCard | undefined;
  let allowFocus = false;
  focus.addEventListener("click", event => { event.stopPropagation(); if (hoveredCard) onFocus(hoveredCard.id); focus.style.display = "none"; preview.style.display = "none"; });
  let cardsByMention = new Map<Element, StoryCard>();
  function remember(element: HTMLElement) {
    if (!originals.has(element)) originals.set(element, { style: element.getAttribute("style"), ...(element.tagName === "IMG" ? { src: element.getAttribute("src") } : {}) });
  }
  function restore(element: HTMLElement) {
    const saved = originals.get(element);
    if (!saved) return;
    if (saved.style === null) element.removeAttribute("style"); else element.setAttribute("style", saved.style);
    if (saved.src !== undefined && element.getAttribute("src") === saved.override) {
      if (saved.src === null) element.removeAttribute("src"); else element.setAttribute("src", saved.src);
    }
    originals.delete(element);
  }
  const registry = () => (doc.defaultView as any)?.CSS?.highlights;
  function clearHighlights() { for (const name of highlighted) registry()?.delete(name); highlighted.length = 0; style.textContent = ""; }
  function render(cards: StoryCard[], options: Options) {
    allowFocus = options.highlightFocus !== false;
    focus.style.display = "none";
    preview.style.display = "none";
    clearHighlights();
    const byId = new Map(cards.filter(c => c.aidId?.startsWith("lynxcat:")).map(c => [c.aidId!.slice(8), c]));
    const used = new Set<HTMLElement>();
    cardsByMention = new Map();
    for (const mention of doc.querySelectorAll<HTMLElement>(mentionSelector)) {
      const card = byId.get(mention.dataset.entityId!);
      if (!card) continue;
      cardsByMention.set(mention, card);
      remember(mention); used.add(mention);
      mention.style.color = card.useCustomColor ? card.color : options.iconColor;
      mention.style.fontWeight = options.highlightBold ? "700" : "inherit";
      const image = cardImage(card, "icon");
      let img = mention.querySelector<HTMLImageElement>("img.story-detail-portrait");
      if (image && !img) {
        img = doc.createElement("img"); img.className = "story-detail-portrait"; img.alt = "";
        img.setAttribute("aria-hidden", "true"); img.referrerPolicy = "no-referrer";
        mention.prepend(img); added.add(img);
      }
      if (img && image) {
        remember(img); used.add(img);
        const saved = originals.get(img)!;
        if (saved.override && img.getAttribute("src") !== saved.override) saved.src = img.getAttribute("src");
        if (img.getAttribute("src") !== image) img.setAttribute("src", image);
        saved.override = image;
        img.style.width = `${options.iconSize}px`; img.style.height = `${options.iconSize}px`;
        img.style.objectFit = "cover";
      }
    }
    for (const element of originals.keys()) if (!used.has(element)) restore(element);
    for (const element of added) if (!used.has(element)) { element.remove(); added.delete(element); }

    // Ranges colour extension-only triggers without splitting native text nodes or duplicating text.
    const HighlightCtor = (doc.defaultView as any)?.Highlight;
    if (!registry() || !HighlightCtor) return;
    const keys = new Map<string, StoryCard>();
    for (const card of cards) for (const key of [card.name, ...card.triggers.split(",")]) if (key.trim()) keys.set(key.trim().toLowerCase(), card);
    if (!keys.size) return;
    const escaped = [...keys.keys()].sort((a,b) => b.length-a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "giu");
    const ranges = new Map<StoryCard, Range[]>();
    for (const paragraph of doc.querySelectorAll(`${transcript} .story-turn-copy`)) {
      const walker = doc.createTreeWalker(paragraph, 4);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('.story-detail-mention,button,textarea,input,[contenteditable="true"]')) continue;
        for (const match of (node.textContent ?? "").matchAll(pattern)) {
          const card = keys.get(match[0].toLowerCase())!;
          const range = doc.createRange(); range.setStart(node, match.index!); range.setEnd(node, match.index! + match[0].length);
          const list = ranges.get(card) ?? []; list.push(range); ranges.set(card, list);
        }
      }
    }
    for (const [card, list] of ranges) {
      const name = `de-lynx-${highlighted.length}`; highlighted.push(name);
      registry().set(name, new HighlightCtor(...list));
      const color = card.useCustomColor ? card.color : options.iconColor;
      if (doc.defaultView?.CSS.supports("color", color)) style.sheet?.insertRule(`${transcript} .story-turn-copy::highlight(${name}) { color: ${color}; }`);
    }
  }
  function hover(event: MouseEvent) {
    if (event.target === focus) return;
    const mention = (event.target as Element)?.closest?.(mentionSelector);
    const card = mention ? cardsByMention.get(mention) : undefined;
    const picture = cardImage(card);
    if (!picture || !mention) { preview.style.display = "none"; focus.style.display = "none"; return; }
    hoveredCard = card;
    const rect = mention.getBoundingClientRect();
    preview.src = picture;
    preview.style.left = `${Math.max(8, Math.min(rect.left, doc.documentElement.clientWidth - 288))}px`;
    preview.style.bottom = `${Math.max(8, doc.documentElement.clientHeight - rect.top + 8)}px`;
    preview.style.display = "block";
    focus.style.left = preview.style.left;
    focus.style.top = `${rect.top}px`;
    focus.style.display = allowFocus ? "block" : "none";
  }
  doc.addEventListener("mouseover", hover);
  return { render, destroy() {
    doc.removeEventListener("mouseover", hover);
    for (const element of originals.keys()) restore(element);
    for (const element of added) element.remove();
    clearHighlights(); style.remove(); preview.remove(); focus.remove();
  } };
}
