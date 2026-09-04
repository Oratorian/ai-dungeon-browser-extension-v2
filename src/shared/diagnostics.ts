import { get } from "svelte/store";
import { Config } from "@/shared/config";
import { DOM } from "@/rendering/dom";
import { Storage, settings } from "@/storage";
import { playedShortId } from "@/aid/adventure";

// Builds the report behind Settings > Support > Diagnostics.
//
// Why this exists: when someone reports "portraits don't show up" there is no way to tell from the
// outside whether AI Dungeon changed its DOM (which breaks for everyone), or whether that one user
// has text animation on / no linked card set / an icon size of 0 (which breaks only for them). Those
// need opposite answers, so the report captures both the live DOM probes and the user's own state,
// then draws the conclusion itself in the Findings block.
//
// PRIVACY: this is meant to be pasted into a public support thread, so it reports COUNTS AND SHAPES,
// never content. No card names, no trigger words, no story text, no image URLs (hosts only), no API
// keys, and the adventure id is truncated. Keep it that way when adding checks.

type Level = "error" | "warn" | "ok";

type Finding = { level: Level; text: string };

const LINE = 58; // report width, chosen to survive Discord's mobile code-block wrapping

/** "Firefox 143 (Windows)", preferring the brand over the Chrome token every Chromium UA carries. */
function browserLabel(): string {
  const ua = navigator.userAgent;
  const brands: [RegExp, string][] = [
    [/Edg\/(\d+)/, "Edge"],
    [/OPR\/(\d+)/, "Opera"],
    [/Firefox\/(\d+)/, "Firefox"],
    [/Chrome\/(\d+)/, "Chrome"],
  ];

  let name = "Unknown";
  let version = "?";
  for (const [pattern, label] of brands) {
    const match = ua.match(pattern);
    if (match) {
      name = label;
      version = match[1];
      break;
    }
  }

  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Linux/.test(ua)
          ? "Linux"
          : "?";

  return name + " " + version + " (" + os + ")";
}

/** Distinct hosts an image list is served from. Hosts, not URLs, so a dead or blocked CDN shows up. */
function hostsOf(urls: string[]): string[] {
  const hosts = new Set<string>();
  for (const url of urls) {
    try {
      hosts.add(new URL(url).host);
    } catch {
      hosts.add(url.startsWith("data:") ? "(inline data)" : "(unparseable)");
    }
  }
  return Array.from(hosts);
}

/**
 * How a response container is laid out, so a structural change on AI Dungeon's side is visible in a
 * paste. "text in #0" is the shape the renderer expects; a higher index means AID has buried the
 * prose behind spacers and we are running on pickTextHost's fallback path.
 */
function describeShape(container: HTMLElement): string {
  const host = DOM.pickTextHost(container);
  const tag = container.tagName.toLowerCase();
  const count = container.childElementCount;
  if (!host) return tag + ", " + count + " children, NO TEXT HOST";
  const index = Array.from(container.children).indexOf(host);
  return tag + ", " + count + " children, text in #" + index;
}

function row(label: string, value: string): string {
  return label.padEnd(19) + value;
}

/** Wraps a finding to the report width, indenting continuation lines under the marker. */
function wrap(marker: string, text: string): string {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > LINE - 2) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);

  return lines.map((l, i) => (i === 0 ? marker + " " + l : "  " + l)).join("\n");
}

export function collectDiagnostics(): string {
  const out: string[] = [];
  const findings: Finding[] = [];

  const manifest = browser.runtime.getManifest();
  const cfg = get(settings);

  /* ------------------------------------------------------------------ DOM */
  const output = document.querySelector<HTMLElement>(Config.SELECTOR_OUTPUT);
  const containers = output ? Array.from(output.querySelectorAll<HTMLElement>(Config.SELECTOR_RESPONSE)) : [];
  const rendered = containers.filter((c) => c.hasAttribute(Config.ATTRIBUTE_ALTERED)).length;
  const lastAction = document.querySelector(Config.SELECTOR_LAST_ACTION);
  const exitButton = document.querySelector(Config.SELECTOR_EXIT_BUTTON);
  const shadowHost = document.querySelector(Config.ID_EDITOR_ANCHOR);
  const menuButton = document.getElementById(Config.ID_EDITOR_BUTTON);
  // AID's per-word fade animation. The renderer refuses to mount over it (the animation rewrites the
  // nodes underneath us), so while it is on the newest response keeps its plain text and never gets
  // icons, highlights, or the portrait pin.
  const wordFade = output?.querySelector(".word-fade") ?? null;

  /* -------------------------------------------------------------- Content */
  const shortId = playedShortId();
  const adventure = Storage.getSelectedAdventure();
  const cards = adventure ? Object.values(adventure.storyCards) : [];
  const withIcons = cards.filter((c) => c.icons.length > 0).length;
  const withPortraits = cards.filter((c) => c.graphics.length > 0).length;
  const portraitHosts = hostsOf(cards.flatMap((c) => c.graphics));
  const triggers = get(Storage.cardMap).size;
  const linked = Boolean(adventure && shortId && adventure.aidShortId === shortId);

  /* --------------------------------------------------------------- Report */
  out.push("DExtV2R " + manifest.version + " diagnostics (MV" + manifest.manifest_version + ")");
  out.push(browserLabel());
  out.push(new Date().toISOString());
  out.push(location.host + (shortId ? ", adventure " + shortId.slice(0, 4) + "..." : ", not in an adventure"));

  out.push("", "[DOM]");
  out.push(row("gameplay output", output ? "found" : "MISSING"));
  out.push(row("response nodes", containers.length + " (rendered " + rendered + ")"));
  out.push(row("last action node", lastAction ? "found" : "MISSING"));
  out.push(row("exit game button", exitButton ? "found" : "MISSING"));
  out.push(row("extension UI", shadowHost ? "mounted" : "MISSING"));
  out.push(row("menu entry", menuButton ? "injected" : "absent"));
  out.push(row("floating button", cfg.floatingButton ? "on" : "off"));
  out.push(row("text animation", wordFade ? "DETECTED" : "off"));
  out.push(row("skipped (animated)", String(DOM.skippedAnimated)));
  out.push(row("live components", String(DOM.mountedCount)));
  if (containers.length > 0) out.push(row("newest shape", describeShape(containers[containers.length - 1])));

  out.push("", "[Content]");
  out.push(row("linked card set", adventure ? (linked ? "yes" : "selected, NOT linked") : "none selected"));
  out.push(row("story cards", cards.length + " (icons " + withIcons + ", portraits " + withPortraits + ")"));
  out.push(row("trigger map", String(triggers)));
  if (portraitHosts.length > 0) out.push(row("portrait hosts", portraitHosts.join(", ")));

  out.push("", "[Settings]");
  out.push(row("icon", cfg.iconSize + "px, border " + cfg.iconThickness + "px"));
  out.push(row("tooltip", cfg.tooltipWidth + "x" + cfg.tooltipHeight + ", delay " + cfg.tooltipDelay + "ms"));
  out.push(row("focus / markdown", (cfg.highlightFocus ? "on" : "off") + " / " + (cfg.highlightMarkdown ? "on" : "off")));

  /* ------------------------------------------------------------- Findings */
  // Ordered so the first line a helper reads is the most likely cause.
  if (!shortId) {
    findings.push({
      level: "warn",
      text: "Not on an adventure page, so most checks above are blank. Open an adventure and run this again.",
    });
  }

  if (shortId && !output) {
    findings.push({
      level: "error",
      text: "AI Dungeon's gameplay output was not found. Either the page had not finished loading, or AI Dungeon changed its page structure and the extension needs an update.",
    });
  }

  if (output && containers.length === 0) {
    findings.push({
      level: "error",
      text: "No response nodes were found inside the gameplay output. This is the selector that breaks when AI Dungeon restructures its DOM, so the extension likely needs an update.",
    });
  }

  if (containers.length > 0 && rendered === 0) {
    findings.push({
      level: "error",
      text: "Found " + containers.length + " responses but rendered none of them. Nothing is highlighted, so no icons or portraits can appear.",
    });
  }

  if (wordFade || DOM.skippedAnimated > 0) {
    findings.push({
      level: "warn",
      text: "Text animation is on, so the newest response is skipped and shows no icons, highlights, or portrait pin. Turn it off in AI Dungeon under Gameplay > Appearance > Accessibility > Text Animation.",
    });
  }

  if (shortId && !adventure) {
    findings.push({
      level: "error",
      text: "No card set is linked to this adventure, so there is nothing to highlight. Open the Adventure tab and use Stamp to link one.",
    });
  } else if (adventure && shortId && !linked) {
    findings.push({
      level: "warn",
      text: "A card set is selected but it is not linked to this adventure, so it will be swapped out as you navigate. Use Stamp on the Adventure tab to bind it.",
    });
  }

  if (adventure && cards.length === 0) {
    findings.push({ level: "warn", text: "The linked card set has no story cards yet." });
  }

  if (cards.length > 0 && triggers === 0) {
    findings.push({
      level: "warn",
      text: "The cards have no trigger words, so nothing in the story can match them. Add triggers on each card.",
    });
  }

  if (cards.length > 0 && withPortraits === 0) {
    findings.push({
      level: "warn",
      text: "No card has a portrait image, so nothing can show on hover regardless of everything else.",
    });
  }

  if (cfg.iconSize === 0 && withIcons > 0) {
    findings.push({
      level: "warn",
      text: "Icon size is 0, which makes every inline icon invisible. Raise it under Settings > Icons > Size.",
    });
  }

  if ((cfg.tooltipWidth === 0 || cfg.tooltipHeight === 0) && withPortraits > 0) {
    findings.push({
      level: "warn",
      text: "Tooltip max width or height is 0, which collapses the hover portrait to nothing. Raise it under Settings > Tooltip.",
    });
  }

  if (!cfg.highlightFocus && withPortraits > 0) {
    findings.push({
      level: "ok",
      text: "Focus is off, so the pin button on a portrait is hidden. Hover portraits still work; enable Focus to pin one to the story.",
    });
  }

  if (findings.length === 0) {
    findings.push({ level: "ok", text: "No problems detected. Highlighting is rendering as expected." });
  }

  out.push("", "[Findings]");
  for (const finding of findings) {
    out.push(wrap(finding.level === "error" ? "X" : finding.level === "warn" ? "!" : "-", finding.text));
  }

  return out.join("\n");
}

/**
 * Copies text to the clipboard, falling back to a hidden textarea when the async API is unavailable
 * (some content-script contexts reject it even on a user gesture). Returns whether either path
 * worked, so the UI can offer manual selection instead of silently claiming success.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    // Off-screen rather than display:none, which would make it unselectable and break the copy.
    area.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0;";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
