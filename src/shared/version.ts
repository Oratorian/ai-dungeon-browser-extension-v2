import { writable } from "svelte/store";

// Shows the installed version and, if the GitHub repo has a newer release, flags that an update is
// available. api.github.com is CORS-enabled, so the content script can query it directly.

const REPO = "Oratorian/ai-dungeon-browser-extension-v2";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export type VersionInfo = {
  /** the installed version, from the manifest. */
  current: string;
  /** the latest release tag on GitHub (no leading "v"), or null if not checked/reachable. */
  latest: string | null;
  /** true when `latest` is strictly newer than `current`. */
  updateAvailable: boolean;
};

const currentVersion = browser.runtime.getManifest().version;

export const versionInfo = writable<VersionInfo>({ current: currentVersion, latest: null, updateAvailable: false });

/** Numeric dotted-version compare; true when `a` is strictly newer than `b` (e.g. 1.3.2 > 1.3.1). */
function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

let checked = false;

/**
 * Checks GitHub's latest release once per session and updates the store. Fails silently when
 * offline, rate-limited, or blocked, in which case no update badge is shown.
 */
export async function checkForUpdate(): Promise<void> {
  if (checked) return;
  checked = true;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { tag_name?: unknown };
    const latest = typeof data.tag_name === "string" ? data.tag_name.replace(/^v/i, "").trim() : "";
    if (latest) {
      versionInfo.set({ current: currentVersion, latest, updateAvailable: isNewer(latest, currentVersion) });
    }
  } catch {
    // offline / rate-limited / blocked: leave the store untouched so no badge appears.
  }
}
