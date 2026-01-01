import { TextChunk } from "./types";

export function parseResponse(text: string, cardMap: Map<string, StoryCard>): TextChunk[] {
  if (!text) return [];

  const chunks: TextChunk[] = [];

  const cardKeys = Array.from(cardMap.keys());
  const escapedKeys = cardKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const patterns: string[] = [
    `(\\*\\*[^*]+\\*\\*)`, // **bold**
    `(__[^_]+__)`, // __bold__
    `(\\*[^*]+\\*)`, // *italic*
    `(_[^_]+_)`, // _italic_
    `(~~[^~]+~~)`, // ~~strikethrough~~
    `(~[^~]+~)`, // ~underline~
  ];

  if (escapedKeys.length > 0) {
    patterns.push(`\\b(${escapedKeys.join("|")})\\b`);
  }

  const combinedPattern = new RegExp(patterns.join("|"), "gi");

  let lastIndex = 0;

  for (const match of text.matchAll(combinedPattern)) {
    const matchIndex = match.index!;
    const fullMatch = match[0];

    if (matchIndex > lastIndex) {
      chunks.push({ type: "text", content: text.substring(lastIndex, matchIndex) });
    }

    const chunk = categorizeMatch(fullMatch, cardMap);
    chunks.push(chunk);

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    chunks.push({ type: "text", content: text.substring(lastIndex) });
  }

  return chunks;
}

function categorizeMatch(match: string, cardMap: Map<string, StoryCard>): TextChunk {
  if ((match.startsWith("**") && match.endsWith("**")) || (match.startsWith("__") && match.endsWith("__"))) {
    return { type: "bold", content: match.slice(2, -2) };
  }

  if (match.startsWith("~~") && match.endsWith("~~")) {
    return { type: "strikethrough", content: match.slice(2, -2) };
  }

  if ((match.startsWith("*") && match.endsWith("*")) || (match.startsWith("_") && match.endsWith("_"))) {
    return { type: "italic", content: match.slice(1, -1) };
  }

  if (match.startsWith("~") && match.endsWith("~")) {
    return { type: "underline", content: match.slice(1, -1) };
  }

  const card = cardMap.get(match.toLowerCase());
  if (card) {
    return { type: "card", card, content: match };
  }

  return { type: "text", content: match };
}

export function buildCardMap(cards: Record<string, StoryCard>): Map<string, StoryCard> {
  const map = new Map<string, StoryCard>();

  for (const card of Object.values(cards)) {
    map.set(card.name.toLowerCase(), card);

    if (card.triggers) {
      const triggers = card.triggers.split(",").map((t) => t.trim().toLowerCase());
      for (const trigger of triggers) {
        if (trigger) {
          map.set(trigger, card);
        }
      }
    }
  }

  return map;
}
