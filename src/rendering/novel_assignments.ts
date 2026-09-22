import type { NovelFrame } from "./novel";

export type ParagraphFrame = NovelFrame & { source: object; offset: number };
export type NovelAssignment = { source: object; offset: number; paragraph: string; characterId: string };

/** Scope choices to a specific loaded paragraph, not its text elsewhere or a global trigger. */
export function resolveNovelAssignments(frames: ParagraphFrame[], assignments: NovelAssignment[]): Record<number, string> {
  const result: Record<number, string> = {};
  frames.forEach((frame, index) => {
    if (!frame.startsParagraph) return;
    const match = assignments.find(a => a.source === frame.source && a.offset === frame.offset && a.paragraph === frame.paragraph);
    if (match) result[index] = match.characterId;
  });
  return result;
}
