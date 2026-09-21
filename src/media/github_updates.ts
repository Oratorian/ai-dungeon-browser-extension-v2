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
      const version = await fetchContentVersion(file);
      if (!version) throw new Error("The source file has no supported version in its header.");
      if (fingerprint(Storage.getAdventureById(adventure.id)?.githubSource) !== key) continue;
      checked.set(adventure.id + key, Date.now());
      githubUpdates.update(items => {
        const next = { ...items };
        delete next[adventure.id];
        if (newerVersion(version, source.version)) next[adventure.id] = { file, version, installed: source.version, source: key };
        return next;
      });
      githubUpdateErrors.update(items => { const next = { ...items }; delete next[adventure.id]; return next; });
    } catch (error) {
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
