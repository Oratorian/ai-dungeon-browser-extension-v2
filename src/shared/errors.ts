// A small ring buffer of exceptions thrown by the extension's own code, for the diagnostics report.
//
// The renderer runs entirely inside a MutationObserver callback. If that callback throws (the usual
// shape of an AI Dungeon DOM change: some node we assumed exists no longer does), the observer
// swallows it, keeps firing, and the extension silently renders nothing at all. Nobody reports "an
// exception in the console" because nobody has the console open, so we keep the last few here and
// print them in the report instead.

const MAX = 5;

const captured: { at: string; text: string }[] = [];

/** Extension-owned code, so page errors from AI Dungeon itself don't pollute the report. */
function isOurs(source: string | undefined): boolean {
  if (!source) return false;
  try {
    return source.startsWith(browser.runtime.getURL(""));
  } catch {
    return false;
  }
}

/** Trims a message and its first stack frame down to something that fits a chat paste. */
function summarize(error: unknown): string {
  if (error instanceof Error) {
    const frame = (error.stack ?? "").split("\n")[1]?.trim() ?? "";
    // Keep only the file:line tail of the frame; the full extension URL is noise in a paste.
    const at = frame.match(/([^/\\]+\.js:\d+:\d+)/)?.[1] ?? "";
    return `${error.name}: ${error.message}${at ? ` (${at})` : ""}`;
  }
  return String(error);
}

export function recordError(error: unknown, context?: string): void {
  const text = (context ? `${context}: ` : "") + summarize(error);
  // Collapse repeats: a throwing observer fires on every mutation and would otherwise flood the
  // buffer with one identical line.
  if (captured.some((e) => e.text === text)) return;

  captured.push({ at: new Date().toISOString().slice(11, 19), text });
  if (captured.length > MAX) captured.shift();
}

/** Last captured errors, oldest first, as "HH:MM:SS  message". */
export function capturedErrors(): string[] {
  return captured.map((e) => `${e.at}  ${e.text}`);
}

let installed = false;

/**
 * Starts capturing uncaught errors and rejections that originate in extension code. Call once at
 * content-script startup. This is a safety net; the paths we know matter (the observer callback)
 * record explicitly via recordError, because a content script does not reliably see its own
 * exceptions through the page's window handlers.
 */
export function installErrorCapture(): void {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    if (isOurs(event.filename)) recordError(event.error ?? event.message, "uncaught");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const stack = reason instanceof Error ? (reason.stack ?? "") : "";
    if (isOurs(stack.split("\n")[1]?.trim().match(/(\w+-extension:\/\/\S+)/)?.[1])) {
      recordError(reason, "unhandled rejection");
    }
  });
}
