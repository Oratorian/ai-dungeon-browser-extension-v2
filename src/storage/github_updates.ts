import type { Adventure } from "@/shared/types";

/** Content revisions accept integers or dotted numeric versions, compared numerically. */
export function contentVersion(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d+(?:\.\d+)*$/.test(text) ? text : null;
}

export function newerVersion(remote: string, local: string): boolean {
  if (!contentVersion(remote) || !contentVersion(local)) return false;
  const a = remote.split(".").map(BigInt), b = local.split(".").map(BigInt);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0n) !== (b[i] ?? 0n)) return (a[i] ?? 0n) > (b[i] ?? 0n);
  }
  return false;
}

export function normalizeGitHubSource(value: unknown): Adventure["githubSource"] {
  if (!value || typeof value !== "object") return undefined;
  const s = value as Record<string, unknown>;
  const version = contentVersion(s.version);
  if (typeof s.repo !== "string" || typeof s.path !== "string" || typeof s.release !== "boolean" || !version) return undefined;
  return { repo: s.repo, path: s.path, release: s.release, version };
}

export function applyGitHubUpdate(local: Adventure, incoming: Adventure, source: NonNullable<Adventure["githubSource"]>, mode: "merge" | "overwrite"): Adventure {
  return {
    ...local,
    contentVersion: source.version,
    githubSource: source,
    // Stable upstream card IDs let merge preserve local edits and add only new cards.
    storyCards: mode === "merge" ? { ...incoming.storyCards, ...local.storyCards } : incoming.storyCards,
  };
}
