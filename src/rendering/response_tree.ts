import type { StoryCard, TextChunk } from "@/shared/types";
import { parseResponse } from "./parser";
import { sanitizeResponseFragment } from "./sanitize";

export type ResponseNode =
  | { type: "element"; tag: string; children: ResponseNode[] }
  | { type: "chunk"; chunk: TextChunk; index: number };

/** Parse visible text only. Attribute names/values, tag names and entity syntax
 * must never become card matches or markdown, even for cards called Aria or Span. */
export function parseResponseHtml(html: string, cards: Map<string, StoryCard>): ResponseNode[] {
  const fragment = sanitizeResponseFragment(html);
  let index = 0;
  function visit(parent: Node): ResponseNode[] {
    return [...parent.childNodes].flatMap((node): ResponseNode[] => {
      if (node.nodeType === Node.TEXT_NODE) {
        return parseResponse(node.textContent ?? "", cards).map(chunk => ({ type: "chunk", chunk, index: index++ }));
      }
      if (node instanceof HTMLElement) {
        return [{ type: "element", tag: node.localName, children: visit(node) }];
      }
      return [];
    });
  }
  return visit(fragment);
}
