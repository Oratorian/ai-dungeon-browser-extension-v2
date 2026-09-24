// Public support reports must never contain narration text or raw engine errors.
export function ttsErrorCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out|timeout/i.test(message)) return "timeout";
  if (/memory|allocation|out of bounds/i.test(message)) return "memory or runtime allocation";
  if (/fetch|network|download|HTTP/i.test(message)) return "network or model download";
  if (/stopped|abort|cancel/i.test(message)) return "stopped or cancelled";
  return "engine error (details omitted for privacy)";
}

type NarrationSnapshot = {
  ready: number; total: number; failed: number; generating: boolean;
  upcomingReady: number; upcomingTotal: number;
  muted: boolean; buffering: boolean; playing: boolean;
};
let source: (() => NarrationSnapshot) | undefined;
export function registerNarrationDiagnostics(read: () => NarrationSnapshot) {
  source = read;
  return () => { if (source === read) source = undefined; };
}
export function narrationDiagnostics() { return source?.() ?? null; }
