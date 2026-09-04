import { get } from "svelte/store";
import { Storage, settings } from "@/storage";
import type { Adventure, StoryCard } from "@/shared/types";

// Shrinks images that are stored inline in a card.
//
// Images added from Trinetra are kept as URLs and cost almost nothing, but an image uploaded from
// your own device is stored as a base64 data URI inside the adventure, in chrome.storage.local. A
// handful of full-resolution photos will run an adventure into tens or hundreds of megabytes, and
// that whole blob is parsed on every AI Dungeon tab and rewritten on every card edit. Re-encoding
// them at a sane size is the difference between a snappy editor and a sluggish one.

export type CompressStats = {
  /** Images actually replaced with a smaller version. */
  compressed: number;
  /** Left alone: remote URLs, or already smaller than anything we would produce. */
  skipped: number;
  /** Could not be decoded or re-encoded; left untouched. */
  failed: number;
  /** Stored characters before and after, which is what storage actually costs. */
  before: number;
  after: number;
};

/** Inline base64 images are the only ones worth touching; a URL costs nothing to store. */
export function isInlineImage(source: string): boolean {
  return typeof source === "string" && source.startsWith("data:");
}

export function formatBytes(count: number): string {
  if (count < 1024) return count + " B";
  if (count < 1024 * 1024) return Math.round(count / 1024) + " KB";
  return (count / 1024 / 1024).toFixed(1) + " MB";
}

/**
 * Best available encoder. WebP keeps transparency *and* honours a quality setting, which JPEG cannot
 * do: re-encoding an icon with an alpha channel as JPEG fills the transparent parts with black. Both
 * Firefox and Chrome encode WebP, but the check is cheap and the fallback matters if that ever
 * changes, since silently flattening everyone's icons would be hard to notice and impossible to undo.
 */
let encoder: string | null = null;

function pickEncoder(): string {
  if (encoder) return encoder;
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    encoder = probe.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/png";
  } catch {
    encoder = "image/png";
  }
  return encoder;
}

/**
 * Re-encodes one inline image at or below `maxResolution`.
 *
 * `square` crops to a centred square for icons, which are rendered in a square box anyway. It aligns
 * to the TOP rather than the middle, because these are mostly character portraits and a centre crop
 * takes the head off.
 *
 * Resolves to the original string whenever the result would not be an improvement, so calling this
 * on an already-small image is harmless.
 */
export function compressInlineImage(
  source: string,
  maxResolution: number,
  quality: number,
  square: boolean
): Promise<string> {
  return new Promise((resolve) => {
    if (!isInlineImage(source) || maxResolution <= 0) {
      resolve(source);
      return;
    }

    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(source);
          return;
        }

        if (square) {
          const side = Math.min(maxResolution, Math.max(image.width, image.height));
          canvas.width = side;
          canvas.height = side;
          const scale = Math.max(side / image.width, side / image.height);
          context.drawImage(image, (side - image.width * scale) / 2, 0, image.width * scale, image.height * scale);
        } else {
          // Only ever shrink. Scaling a small image up would cost storage and add nothing.
          const scale = Math.min(1, maxResolution / Math.max(image.width, image.height));
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
        }

        const result = canvas.toDataURL(pickEncoder(), Math.min(100, Math.max(1, quality)) / 100);
        // An already-optimised image can re-encode larger. Keep whichever is smaller so running this
        // twice can never inflate a card.
        resolve(result.length < source.length ? result : source);
      } catch {
        resolve(source); // tainted canvas, out of memory, unsupported encoder
      }
    };

    image.onerror = () => resolve(source);
    image.src = source;
  });
}

/** Every inline image on a card, compressed with the size limit appropriate to its slot. */
async function compressCard(card: StoryCard, stats: CompressStats): Promise<StoryCard | null> {
  const config = get(settings);
  let changed = false;

  const run = async (list: string[], maxResolution: number, square: boolean) => {
    const out: string[] = [];
    for (const source of list) {
      if (!isInlineImage(source)) {
        stats.skipped++;
        out.push(source);
        continue;
      }

      stats.before += source.length;
      const result = await compressInlineImage(source, maxResolution, config.compressionQuality, square);
      stats.after += result.length;

      if (result === source) stats.skipped++;
      else {
        stats.compressed++;
        changed = true;
      }
      out.push(result);
    }
    return out;
  };

  const icons = await run(card.icons, config.compressionResolutionIcon, true);
  const graphics = await run(card.graphics, config.compressionResolutionGraphic, false);

  return changed ? { ...card, icons, graphics } : null;
}

/**
 * Compresses every inline image across all adventures, or just one when `adventureId` is given.
 * Writes each adventure back only if something in it actually changed, so an adventure whose images
 * are all remote is not rewritten for nothing.
 */
export async function compressStoredImages(adventureId?: string): Promise<CompressStats> {
  const stats: CompressStats = { compressed: 0, skipped: 0, failed: 0, before: 0, after: 0 };
  const adventures = get(Storage.adventures);

  const targets = adventureId ? [adventures[adventureId]].filter(Boolean) : Object.values(adventures);

  for (const adventure of targets as Adventure[]) {
    const updates: Record<string, StoryCard> = {};

    for (const card of Object.values(adventure.storyCards)) {
      try {
        const compressed = await compressCard(card, stats);
        if (compressed) updates[card.id] = compressed;
      } catch {
        stats.failed++;
      }
    }

    if (Object.keys(updates).length > 0) {
      Storage.updateAdventure(adventure.id, {
        storyCards: { ...adventure.storyCards, ...updates },
      });
    }
  }

  return stats;
}
