// Client for the Trinetra image host API (https://trinetra.mahesvara.cloud/openapi.json).
// Used by the image picker so users can browse and insert their own uploaded images by API key
// instead of pasting individual IDs/URLs. We only read (folders + images); nothing is mutated.
//
// Requests go direct from the page, because Trinetra now answers the preflight for X-API-Key and
// sends its CORS headers on real responses too. That keeps the MV3 service worker out of the path,
// which matters: a stale worker used to make this return broken data for no visible reason.
//
// The background proxy is kept as a fallback for the case where the direct call cannot even be made
// (an older deployment without those headers, or a network-level block). It costs one failed request
// to discover that, and only on the first call, since the outcome is remembered per session.

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

/** Turns a status code into something worth showing a user. */
function describe(status: number | undefined): TrinetraError {
  if (status === 401 || status === 403) return new TrinetraError("Invalid or unauthorized API key.", status);
  if (status === 413) return new TrinetraError("That image is larger than Trinetra accepts.", 413);
  if (status === 429) return new TrinetraError("Too many requests, slow down a moment.", 429);
  if (status) return new TrinetraError(`Trinetra request failed (${status}).`, status);
  return new TrinetraError("Couldn't reach Trinetra. Check your connection.");
}

// Whether a direct call has been shown to work. Remembered so a deployment without CORS costs one
// failed request per session rather than one per call, and so the common case pays nothing.
let directWorks: boolean | null = null;

async function request<T>(apiKey: string, path: string): Promise<T> {
  let text: string;

  if (directWorks !== false) {
    try {
      const response = await fetch(`${API_BASE}${path}`, { headers: { "X-API-Key": apiKey } });
      directWorks = true;
      // A real HTTP error is the server's answer, not a transport failure, so report it rather than
      // retrying through the background, which would only get the same status more slowly.
      if (!response.ok) throw describe(response.status);
      text = await response.text();
    } catch (e) {
      if (e instanceof TrinetraError) throw e;
      // Only a thrown fetch (CORS refusal, DNS, offline) lands here. Fall back once and remember.
      directWorks = false;
      text = await viaBackground(apiKey, path);
    }
  } else {
    text = await viaBackground(apiKey, path);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TrinetraError("Unexpected response from Trinetra.");
  }
}

async function viaBackground(apiKey: string, path: string): Promise<string> {
  try {
    return await bgFetch(`${API_BASE}${path}`, { headers: { "X-API-Key": apiKey } });
  } catch (e) {
    throw describe(e instanceof BgFetchError ? e.status : undefined);
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
 * Sent direct as real multipart/form-data now that Trinetra answers the preflight. That is a genuine
 * improvement over the background path, which cannot carry a File across a Port and so had to ship
 * the image as base64 and rebuild the body on the other side, inflating it by a third on the way.
 * The background remains the fallback for a deployment without those CORS headers.
 *
 * `folderId` files the upload into one of the user's folders; omitted, it lands uncategorised.
 */
export async function uploadImage(
  apiKey: string,
  dataUri: string,
  filename: string,
  folderId?: number | null
): Promise<TrinetraImage> {
  let text: string;

  if (directWorks !== false) {
    try {
      const body = new FormData();
      if (typeof folderId === "number") body.append("folder", String(folderId));
      body.append("file", dataUriToBlob(dataUri), filename);

      // Content-Type is deliberately unset: fetch supplies it with the multipart boundary.
      const response = await fetch(`${API_BASE}/images`, {
        method: "POST",
        headers: { "X-API-Key": apiKey },
        body,
      });
      directWorks = true;
      if (!response.ok) throw describe(response.status);
      text = await response.text();
    } catch (e) {
      if (e instanceof TrinetraError) throw e;
      directWorks = false;
      text = await uploadViaBackground(apiKey, dataUri, filename, folderId);
    }
  } else {
    text = await uploadViaBackground(apiKey, dataUri, filename, folderId);
  }

  try {
    return JSON.parse(text) as TrinetraImage;
  } catch {
    throw new TrinetraError("Trinetra accepted the upload but returned something unreadable.");
  }
}

/** Decodes a data: URI into a Blob, so the upload goes out as bytes rather than base64 text. */
function dataUriToBlob(dataUri: string): Blob {
  const [meta, base64] = dataUri.split(",", 2);
  const mime = meta?.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadViaBackground(
  apiKey: string,
  dataUri: string,
  filename: string,
  folderId?: number | null
): Promise<string> {
  const fields: Record<string, string> = {};
  if (typeof folderId === "number") fields.folder = String(folderId);
  try {
    return await bgFetch(`${API_BASE}/images`, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      upload: { dataUri, filename, field: "file", fields },
    });
  } catch (e) {
    throw describe(e instanceof BgFetchError ? e.status : undefined);
  }
}
