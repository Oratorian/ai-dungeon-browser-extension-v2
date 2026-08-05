// Client for browsing shared adventure/scenario exports hosted in public GitHub repos, used by the
// import dialog. We only read: list the .json files in a repo's git tree, peek each file's head to
// show its friendly adventure name, and download a file's full contents on demand. No auth: this
// targets public repos and uses the anonymous GitHub REST API (60 req/hr per IP) for listing plus
// raw.githubusercontent.com (a CDN, not rate-limited) for file bytes.

import { bgFetch } from "./bg_fetch";

const API_BASE = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";

// How much of a file we pull to find its adventure name. The exporter writes version, exportedAt,
// adventure.id and adventure.name before the huge base64 storyCards, so the name sits in the head.
const NAME_HEAD_BYTES = 16384;

export type ParsedRepo = {
  owner: string;
  repo: string;
  /** null => resolve the repo's default branch lazily. */
  branch: string | null;
  /** optional folder filter (no leading/trailing slash), "" = whole repo. */
  subpath: string;
  /** human label for the settings list, e.g. "owner/repo" or "owner/repo @ branch /sub". */
  label: string;
};

export type GitHubFile = {
  /** path within the repo, e.g. "packs/thing.json". */
  path: string;
  /** basename, e.g. "thing.json". */
  filename: string;
  size: number;
  /** URL to fetch the bytes: a raw.githubusercontent URL for tree files, a release download URL otherwise. */
  rawUrl: string;
  /** true for a GitHub release asset, fetched via the background proxy (its CDN has no CORS). */
  release: boolean;
};

export type GitHubListing = {
  files: GitHubFile[];
  /** GitHub truncates very large trees; some files may be missing when true. */
  truncated: boolean;
};

export class GitHubError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/**
 * Parses a repo entry into its parts. Accepts:
 *  - "owner/repo"
 *  - "https://github.com/owner/repo"
 *  - "https://github.com/owner/repo/tree/<branch>/<subpath...>"
 * Returns null if it can't find an owner/repo pair.
 */
export function parseRepo(input: string): ParsedRepo | null {
  const trimmed = input.trim().replace(/\.git$/i, "");
  if (!trimmed) return null;

  let owner = "";
  let repo = "";
  let branch: string | null = null;
  let subpath = "";

  if (/github\.com/i.test(trimmed)) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    [owner, repo] = parts;
    // .../tree/<branch>/<subpath...>
    if (parts[2] === "tree" && parts[3]) {
      branch = decodeURIComponent(parts[3]);
      subpath = parts.slice(4).map(decodeURIComponent).join("/");
    }
  } else {
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    [owner, repo] = parts;
    if (parts.length > 2) subpath = parts.slice(2).join("/");
  }

  owner = owner.trim();
  repo = repo.trim();
  if (!owner || !repo) return null;
  subpath = subpath.replace(/^\/+|\/+$/g, "");

  let label = `${owner}/${repo}`;
  if (branch) label += ` @ ${branch}`;
  if (subpath) label += ` /${subpath}`;

  return { owner, repo, branch, subpath, label };
}

/** Encodes a repo-relative path for use in a raw.githubusercontent URL (keeps the slashes). */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function api<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/vnd.github+json" } });
  } catch {
    throw new GitHubError("Couldn't reach GitHub. Check your connection.");
  }

  if (res.status === 404) {
    throw new GitHubError("Repo or branch not found (is it public?).", 404);
  }
  if (res.status === 403 && res.headers.get("X-RateLimit-Remaining") === "0") {
    const reset = Number(res.headers.get("X-RateLimit-Reset"));
    const mins = Number.isFinite(reset) ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null;
    throw new GitHubError(`GitHub rate limit reached (60/hr). Try again${mins ? ` in ~${mins} min` : " later"}.`, 403);
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub request failed (${res.status}).`, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new GitHubError("Unexpected response from GitHub.");
  }
}

async function resolveBranch(parsed: ParsedRepo): Promise<string> {
  if (parsed.branch) return parsed.branch;
  const info = await api<{ default_branch?: string }>(`/repos/${parsed.owner}/${parsed.repo}`);
  return info.default_branch || "main";
}

/**
 * Lists every .json file in the repo tree, plus the .json files attached to the repo's latest
 * release (direct downloads, up to 2 GB, no Git LFS), so a large release-hosted adventure isn't
 * hidden just because the tree also has some .json. Release assets are skipped when a subpath is
 * set, since their names are flat and can't honor a folder filter.
 */
export async function listJsonFiles(parsed: ParsedRepo): Promise<GitHubListing> {
  const branch = await resolveBranch(parsed);
  const tree = await api<{
    tree: { path: string; type: string; size?: number }[];
    truncated?: boolean;
  }>(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);

  const prefix = parsed.subpath ? `${parsed.subpath}/` : "";
  const files: GitHubFile[] = (tree.tree ?? [])
    .filter(
      (e) =>
        e.type === "blob" &&
        e.path.toLowerCase().endsWith(".json") &&
        (prefix ? e.path.startsWith(prefix) : true)
    )
    .map((e) => ({
      path: e.path,
      filename: e.path.split("/").pop() || e.path,
      size: e.size ?? 0,
      rawUrl: `${RAW_BASE}/${parsed.owner}/${parsed.repo}/${encodeURIComponent(branch)}/${encodePath(e.path)}`,
      release: false,
    }));

  // Merge in the latest release's .json assets (deduped by filename, tree wins), so a large
  // release-hosted adventure shows up even when the tree also has some .json (e.g. a package.json).
  // Skipped when a subpath is set: release-asset names are flat and can't honor a folder filter.
  if (!parsed.subpath) {
    const treeNames = new Set(files.map((f) => f.filename.toLowerCase()));
    for (const asset of await listReleaseJsonAssets(parsed)) {
      if (!treeNames.has(asset.filename.toLowerCase())) files.push(asset);
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, truncated: Boolean(tree.truncated) };
}

/** The latest release's .json assets as direct-download files. Empty when there is no release. */
async function listReleaseJsonAssets(parsed: ParsedRepo): Promise<GitHubFile[]> {
  let release: { assets?: { name: string; size?: number; browser_download_url: string }[] };
  try {
    release = await api(`/repos/${parsed.owner}/${parsed.repo}/releases/latest`);
  } catch {
    return []; // no release (404) or unreachable; the tree listing stands on its own
  }
  return (release.assets ?? [])
    .filter((a) => a.name.toLowerCase().endsWith(".json"))
    .map((a) => ({
      path: a.name,
      filename: a.name,
      size: a.size ?? 0,
      rawUrl: a.browser_download_url,
      release: true,
    }));
}

/** Reads at most `maxBytes` from the start of a raw URL, even if the CDN ignores the Range header. */
async function readHead(rawUrl: string, maxBytes = NAME_HEAD_BYTES): Promise<string> {
  const res = await fetch(rawUrl, { headers: { Range: `bytes=0-${maxBytes - 1}` } });
  if (!res.ok && res.status !== 206) throw new GitHubError(`Couldn't read the file (${res.status}).`, res.status);

  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, maxBytes);

  const decoder = new TextDecoder();
  let out = "";
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return out;
}

/**
 * Peeks a file's head and returns its adventure name (the first "name" after "adventure"), or null
 * if it doesn't look like an adventure export. Cheap enough to run per-file for a whole listing.
 */
export async function fetchAdventureName(file: GitHubFile): Promise<string | null> {
  let head: string;
  try {
    head = file.release ? await bgFetch(file.rawUrl, { head: true }) : await readHead(file.rawUrl);
  } catch {
    return null;
  }
  const start = head.indexOf('"adventure"');
  const region = start >= 0 ? head.slice(start) : head;
  const m = region.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try {
    const name = JSON.parse(`"${m[1]}"`) as string;
    return name.trim() || null;
  } catch {
    return null;
  }
}

/** Git LFS serves a small text pointer from raw instead of the file; detect it to warn the user. */
function isLfsPointer(text: string): boolean {
  return text.startsWith("version https://git-lfs.github.com/spec/v1");
}

/** Downloads a file's full contents as text (used at import time). */
export async function fetchFileText(file: GitHubFile): Promise<string> {
  // Release assets are proxied through the background (their CDN has no CORS); tree files come
  // straight from raw.githubusercontent.com, which is CORS-enabled.
  if (file.release) {
    try {
      return await bgFetch(file.rawUrl);
    } catch (e) {
      throw new GitHubError(e instanceof Error && e.message ? e.message : "Couldn't download the file.");
    }
  }

  let res: Response;
  try {
    res = await fetch(file.rawUrl);
  } catch {
    throw new GitHubError("Couldn't download the file.");
  }
  if (!res.ok) throw new GitHubError(`Couldn't download the file (${res.status}).`, res.status);

  const text = await res.text();
  // A Git LFS file comes back as a pointer, not the file. We deliberately don't resolve it: fetching
  // from GitHub's LFS media host bills the repo owner's LFS bandwidth. Steer them to release assets.
  if (isLfsPointer(text)) {
    throw new GitHubError("This file is stored with Git LFS. Attach it to a GitHub release instead.");
  }
  return text;
}
