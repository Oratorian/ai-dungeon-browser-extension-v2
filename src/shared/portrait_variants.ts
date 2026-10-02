import type { StoryCard } from "./types";

const identities = new WeakMap<string[], { images: string[]; ids: string[] }>();
export function graphicIds(images: string[]): string[] {
  const saved = identities.get(images);
  if (saved && saved.images.length === images.length && saved.images.every((image, index) => image === images[index])) return saved.ids;
  const ids = images.map(portraitId);
  identities.set(images, { images: [...images], ids });
  return ids;
}

export function readIconGraphics(value: unknown, count: number, graphics: string[]): (string | null)[] {
  const items = Array.isArray(value) ? value : [];
  const ids = new Set(graphicIds(graphics));
  return Array.from({ length: count }, (_, index) => typeof items[index] === "string" && ids.has(items[index]) ? items[index] : null);
}

export function remapIconGraphics(before: string[], after: string[], links: StoryCard["iconGraphics"]): (string | null)[] {
  const used = new Set<number>();
  return after.map(image => {
    const index = before.findIndex((item, i) => item === image && !used.has(i));
    if (index >= 0) used.add(index);
    return links?.[index] ?? null;
  });
}

export function readGraphicVariants(value: unknown, count: number): NonNullable<StoryCard["graphicVariants"]> {
  const items = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => {
    const item = items[index];
    return { name: typeof item?.name === "string" ? item.name : "",
      triggers: typeof item?.triggers === "string" ? item.triggers : "" };
  });
}

/** Keep a picture's rules attached when the image library removes or reorders pictures. */
export function remapGraphicVariants(before: string[], after: string[], variants: StoryCard["graphicVariants"]) {
  const used = new Set<number>();
  return after.map(image => {
    const index = before.findIndex((item, i) => item === image && !used.has(i));
    if (index >= 0) used.add(index);
    return { name: variants?.[index]?.name ?? "", triggers: variants?.[index]?.triggers ?? "" };
  });
}

/** Compact, stable identity avoids storing another copy of an embedded picture in VN choices. */
export function portraitId(image: string): string {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < image.length; i++) {
    a = Math.imul(a ^ image.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ image.charCodeAt(i);
  }
  return `${image.length.toString(36)}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}
