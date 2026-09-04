// Shared vocabulary for image generation, so neither provider owns something both of them use.
//
// Everything under src/media is auto-imported globally (see wxt.config.ts), which means two modules
// exporting the same name silently shadow one another. Anything common therefore lives here, and
// provider-specific exports are named after their provider.

/** Which service generates an image. Stored in settings. */
export type ImageGenProvider = "openrouter" | "civitai";

/**
 * Offered aspect ratios. OpenRouter takes the ratio string as-is; Civitai needs pixel dimensions and
 * maps each one to the nearest resolution its models are trained on (see civitai.ts).
 */
export const ASPECT_RATIOS = ["1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4"] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];
