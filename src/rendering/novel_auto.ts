/** A short settling pause plus reading time at 220 words per minute. */
export function novelAutoDelay(text: string): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(2000, 800 + words * 60000 / 220);
}
