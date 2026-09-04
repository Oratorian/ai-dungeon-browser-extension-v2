// Client for the Trinetra image host API (https://trinetra.mahesvara.cloud/openapi.json).
// Used by the image picker so users can browse and insert their own uploaded images by API key
// instead of pasting individual IDs/URLs. We only read (folders + images); nothing is mutated.
//
// All requests go through the background proxy: Trinetra sends no CORS headers and the API needs an
// X-API-Key header (which triggers a preflight), so a Chrome MV3 content-script fetch is blocked.

import { bgFetch, BgFetchError } from "@/media/bg_fetch";

const API_BASE = "https://trinetra.mahesvara.cloud/api";

export type TrinetraFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  image_count: number;
};

export type TrinetraImage = {
  id: string;
  url: string;
  thumb_url: string;
  folder_id: number | null;
  mime: string;
  original_name: string;
  width: number | null;
  height: number | null;
};

export type TrinetraImageList = {
  total: number;
  limit: number;
  offset: number;
  items: TrinetraImage[];
};

export class TrinetraError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "TrinetraError";
  }
}

async function request<T>(apiKey: string, path: string): Promise<T> {
  let text: string;
  try {
    text = await bgFetch(`${API_BASE}${path}`, { headers: { "X-API-Key": apiKey } });
  } catch (e) {
    const status = e instanceof BgFetchError ? e.status : undefined;
    if (status === 401 || status === 403) throw new TrinetraError("Invalid or unauthorized API key.", status);
    if (status === 429) throw new TrinetraError("Too many requests, slow down a moment.", 429);
    if (status) throw new TrinetraError(`Trinetra request failed (${status}).`, status);
    throw new TrinetraError("Couldn't reach Trinetra. Check your connection.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TrinetraError("Unexpected response from Trinetra.");
  }
}

/** Validates the key and returns the account (used to confirm a key works). */
export async function getMe(apiKey: string): Promise<{ id: string; username: string }> {
  return request(apiKey, "/me");
}

/** Lists all of the user's folders (flat; the tree is derived from parent_id). */
export async function listFolders(apiKey: string): Promise<TrinetraFolder[]> {
  const data = await request<{ items: TrinetraFolder[] }>(apiKey, "/folders");
  return data.items ?? [];
}

/**
 * Lists images in a folder. Pass folderId = null for the root/uncategorized images,
 * or a numeric id for a specific folder.
 */
export async function listImages(
  apiKey: string,
  folderId: number | null,
  opts: { limit?: number; offset?: number } = {}
): Promise<TrinetraImageList> {
  const params = new URLSearchParams();
  params.set("folder", folderId === null ? "none" : String(folderId));
  params.set("limit", String(opts.limit ?? 100));
  params.set("offset", String(opts.offset ?? 0));
  return request(apiKey, `/images?${params.toString()}`);
}


/**
 * Uploads an image and returns its stored record, most usefully `url`, which is what a card holds.
 *
 * Goes through the background like every other Trinetra call: the API answers a preflight with 401
 * and sends no Access-Control-Allow-Headers, so a POST carrying X-API-Key from the page is refused
 * before it is ever sent. The background has host permission and is not subject to that.
 *
 * `folderId` files the upload into one of the user's folders; omitted, it lands uncategorised.
 */
export async function uploadImage(
  apiKey: string,
  dataUri: string,
  filename: string,
  folderId?: number | null
): Promise<TrinetraImage> {
  const fields: Record<string, string> = {};
  if (typeof folderId === "number") fields.folder = String(folderId);

  let text: string;
  try {
    text = await bgFetch(`${API_BASE}/images`, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      upload: { dataUri, filename, field: "file", fields },
    });
  } catch (e) {
    const status = e instanceof BgFetchError ? e.status : undefined;
    if (status === 401 || status === 403) throw new TrinetraError("Invalid or unauthorized API key.", status);
    if (status === 413) throw new TrinetraError("That image is larger than Trinetra accepts.", 413);
    if (status === 429) throw new TrinetraError("Too many uploads, slow down a moment.", 429);
    if (status) throw new TrinetraError(`Upload failed (${status}).`, status);
    throw new TrinetraError("Couldn't reach Trinetra. Check your connection.");
  }

  try {
    return JSON.parse(text) as TrinetraImage;
  } catch {
    throw new TrinetraError("Trinetra accepted the upload but returned something unreadable.");
  }
}
