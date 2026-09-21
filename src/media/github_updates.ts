import { get, writable } from "svelte/store";
import { Storage } from "@/storage";
import type { Adventure } from "@/shared/types";
import { newerVersion, contentVersion } from "@/storage/github_updates";
import { listJsonFiles, listReleaseJsonAssets, fetchContentVersion, fetchFileText, parseRepo, type GitHubFile } from "./github";

export type GitHubUpdate = { file: GitHubFile; version: string; installed: string; source: string };
export const githubUpdates = writable<Record<string, GitHubUpdate>>({});
export const githubUpdateErrors = writable<Record<string, string>>({});
export const checkingGitHubUpdates = writable(false);
const checked = new Map<string, number>();
let pending: Promise<void> | undefined;
const COOLDOWN = 5 * 60_000;
const fingerprint = (source: Adventure["githubSource"]) =>
  source ? JSON.stringify([source.repo, source.path, source.release, source.version]) : "";
const reads = new Map<string, number>();

// Importer updates and picker updates both change the installed version. Clear stale badges
// immediately regardless of which UI performed the install, or whether the set was deleted.
Storage.adventures.subscribe(all => {
  githubUpdates.update(items => Object.fromEntries(Object.entries(items).filter(([id, update]) => fingerprint(all[id]?.githubSource) === update.source)));
  githubUpdateErrors.update(items => Object.fromEntries(Object.entries(items).filter(([id]) => all[id]?.githubSource)));
});

/** Shared file check: every importer/picker result feeds the same badge state. */
export async function checkGitHubFile(repo: string, file: GitHubFile): Promise<string> {
  const targets = Object.values(get(Storage.adventures))
    .filter(a => a.githubSource?.repo === repo && a.githubSource.path === file.path && a.githubSource.release === file.release)
    .map(a => {
      const sequence = (reads.get(a.id) ?? 0) + 1;
      reads.set(a.id, sequence);
      return { id: a.id, source: a.githubSource!, key: fingerprint(a.githubSource), sequence };
    });
  const current = (target: typeof targets[number]) =>
    reads.get(target.id) === target.sequence && fingerprint(Storage.getAdventureById(target.id)?.githubSource) === target.key;
  try {
    const version = await fetchContentVersion(file);
    if (!version) throw new Error("The source file has no supported version in its header.");
    for (const target of targets.filter(current)) {
      checked.set(target.id + target.key, Date.now());
      githubUpdates.update(items => {
        const next = { ...items };
        delete next[target.id];
        if (newerVersion(version, target.source.version)) next[target.id] = { file, version, installed: target.source.version, source: target.key };
        return next;
      });
      githubUpdateErrors.update(items => { const next = { ...items }; delete next[target.id]; return next; });
    }
    return version;
  } catch (error) {
    for (const target of targets.filter(current)) {
      githubUpdateErrors.update(items => ({ ...items, [target.id]: error instanceof Error ? error.message : "Update check failed." }));
    }
    throw error;
  }
}

/** Menu-triggered, shared across picker instances, with one listing per repository. */
export function checkGitHubUpdates(force = false): Promise<void> {
  if (pending) return pending;
  pending = check(force).finally(() => { pending = undefined; checkingGitHubUpdates.set(false); });
  return pending;
}

async function check(force: boolean) {
  const all = get(Storage.adventures);
  githubUpdates.update(items => Object.fromEntries(Object.entries(items).filter(([id, update]) => fingerprint(all[id]?.githubSource) === update.source)));
  const due = Object.values(all).filter(a => a.githubSource && (force || !checked.has(a.id + fingerprint(a.githubSource)) || Date.now() - checked.get(a.id + fingerprint(a.githubSource))! >= COOLDOWN));
  if (!due.length) return;
  checkingGitHubUpdates.set(true);
  const listings = new Map<string, Promise<GitHubFile[]>>();
  for (const adventure of due) {
    const source = adventure.githubSource!;
    const key = fingerprint(source);
    try {
      const listingKey = `${source.repo}:${source.release}`;
      if (!listings.has(listingKey)) {
        const at = source.repo.indexOf("@");
        const parsed = parseRepo(source.repo.slice(0, at));
        if (at < 0 || !parsed) throw new Error("Invalid saved GitHub source.");
        const branch = source.repo.slice(at + 1);
        parsed.branch = branch === "HEAD" ? null : branch;
        listings.set(listingKey, source.release ? listReleaseJsonAssets(parsed) : listJsonFiles(parsed).then(result => result.files));
      }
      const listing = await listings.get(listingKey)!;
      const file = listing.find(f => f.path === source.path && f.release === source.release);
      if (!file) throw new Error("The source file was not found on GitHub.");
      if (fingerprint(Storage.getAdventureById(adventure.id)?.githubSource) !== key) continue;
      // File errors are published by the shared reader with its stale-request guard.
      await checkGitHubFile(source.repo, file).catch(() => {});
    } catch (error) {
      if (fingerprint(Storage.getAdventureById(adventure.id)?.githubSource) !== key) continue;
      githubUpdateErrors.update(items => ({ ...items, [adventure.id]: error instanceof Error ? error.message : "Update check failed." }));
    }
  }
}

export async function installGitHubUpdate(id: string, update: GitHubUpdate, mode: "merge" | "overwrite") {
  const text = await fetchFileText(update.file);
  const source = Storage.getAdventureById(id)?.githubSource;
  if (!source || fingerprint(source) !== update.source) throw new Error("This set changed. Close this dialog and reopen the picker to check again.");
  if (contentVersion(JSON.parse(text).version) !== update.version) {
    checked.delete(id + update.source);
    throw new Error("The remote version changed. Close this dialog and reopen the picker to check again.");
  }
  const result = Storage.importGitHubAdventure(text, source, id, mode);
  githubUpdates.update(items => { const next = { ...items }; delete next[id]; return next; });
  return result;
}
