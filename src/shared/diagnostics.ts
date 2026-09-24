import { get } from "svelte/store";
import { extensionState } from "@/shared/state.svelte";
import { Config } from "@/shared/config";
import { DOM } from "@/rendering/dom";
import { Storage, settings } from "@/storage";
import { playedShortId } from "@/aid/adventure";
import { aidDetected } from "@/aid/bridge";
import { capturedErrors } from "@/shared/errors";
import { versionInfo } from "@/shared/version";
import { parseResponse } from "@/rendering/parser";
import { adventureKey, LEGACY_ADVENTURES_KEY } from "@/storage/persist";
import { ttsDiagnostics } from "@/tts/service";
import { narrationDiagnostics } from "@/tts/diagnostics";
import { narrationQueueSize } from "@/tts/queue";

// Builds the report behind Settings > Support > Diagnostics.
//
// Why this exists: when someone reports "portraits don't show up" there is no way to tell from the
// outside whether AI Dungeon changed its DOM (which breaks the extension for everyone) or whether
// that one user has text animation on / no linked card set / an icon size of 0 (which breaks it only
// for them). Those need opposite answers, so the report captures the live DOM, the user's own state
// and a real image fetch, then draws the conclusion itself in the Findings block.
//
// Two rules to keep when adding checks:
//
//  1. PRIVACY. This is written to be pasted in public, so it reports COUNTS AND SHAPES, never
//     content: no card names, trigger words, story text, image URLs (hosts only) or API keys, and
//     the adventure id is truncated.
//
//  2. DON'T CRY WOLF. Several things AI Dungeon renders only exist while one of its menus is open,
//     so a live query missing them means nothing on its own. Anything in that class must be reported
//     as inconclusive, not as a failure, or the report trains people to ignore it.

type Level = "error" | "warn" | "ok";

type Finding = { level: Level; text: string };

const LINE = 58; // report width, chosen to survive Discord's mobile code-block wrapping
const MAX_ISSUES = 6; // unrendered nodes listed individually before collapsing to a count
const PROBE_TIMEOUT = 6000; // ms to wait for the portrait test fetch

/** "Firefox 155 (Windows)", preferring the brand over the Chrome token every Chromium UA carries. */
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
      version = match[1] ?? "?";
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
 * Actually fetches one portrait, because every other check can pass while the images themselves are
 * unreachable (dead host, revoked host permission, blocked by a content blocker), which looks
 * exactly like "portraits don't show up". Resolves to a human-readable outcome, never rejects.
 */
function probeImage(url: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    const started = performance.now();
    let settled = false;

    const finish = (result: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      image.src = ""; // abort the in-flight request
      finish("TIMED OUT after " + PROBE_TIMEOUT / 1000 + "s");
    }, PROBE_TIMEOUT);

    image.onload = () => {
      const elapsed = Math.round(performance.now() - started);
      const size = image.naturalWidth + "x" + image.naturalHeight;
      // An instant load came from cache and proves nothing about the host being reachable, so say so
      // rather than reporting a flattering "0ms".
      finish("ok, " + size + (elapsed < 10 ? " (cached)" : " in " + elapsed + "ms"));
    };
    image.onerror = () => finish("FAILED to load");
    image.src = url;
  });
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";
}

type Usage = {
  total: number;
  parts: string[];
  /** How adventures are laid out on disk, and whether the old single blob is still around. */
  layout: string;
  legacyBytes: number;
};

/**
 * Extension storage in use, broken down by what matters. Adventures are one key each (see
 * storage/persist.ts), so their share is summed over those keys using the ids the store already
 * holds, which avoids re-reading every adventure just to measure it. The old single "adventures"
 * blob is measured too: it should be gone after the first load on 2.1, and if it is not, the
 * migration did not finish. Null where the browser does not expose the API.
 */
async function storageUsage(): Promise<Usage | null> {
  try {
    const area = chrome.storage.local as unknown as { getBytesInUse?: (keys: string[] | null) => Promise<number> };
    if (typeof area.getBytesInUse !== "function") return null;

    const total = await area.getBytesInUse(null);
    const ids = Object.keys(get(Storage.adventures));
    const adventureBytes = ids.length > 0 ? await area.getBytesInUse(ids.map(adventureKey)) : 0;
    const audioBytes = await area.getBytesInUse(["audioLibrary"]);
    const legacyBytes = await area.getBytesInUse([LEGACY_ADVENTURES_KEY]);

    const parts: string[] = [];
    // Only worth a line once it is a real share of the total; otherwise it is noise.
    if (adventureBytes > 1024 * 1024) parts.push("adventures " + formatBytes(adventureBytes));
    if (audioBytes > 1024 * 1024) parts.push("audio " + formatBytes(audioBytes));

    const layout =
      ids.length + " adventure" + (ids.length === 1 ? "" : "s") + ", one key each" +
      (legacyBytes > 0 ? ", OLD BLOB STILL PRESENT (" + formatBytes(legacyBytes) + ")" : "");

    return { total, parts, layout, legacyBytes };
  } catch {
    return null;
  }
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

/**
 * Why each response container did not render, checked live rather than from counters, so the report
 * can name the specific node instead of only a total. Mirrors the guards in prettifyButBetter and
 * mountResponseOn; keep the two in step.
 */
function nodeIssues(containers: HTMLElement[]): string[] {
  const issues: string[] = [];

  containers.forEach((container, index) => {
    if (!container.firstElementChild) {
      issues.push("#" + index + " no element child");
      return;
    }
    if (container.querySelector(".word-fade")) {
      issues.push("#" + index + " animating");
      return;
    }
    if (!DOM.pickTextHost(container)) {
      issues.push("#" + index + " no text host");
      return;
    }
    if (!container.hasAttribute(Config.ATTRIBUTE_ALTERED)) {
      issues.push("#" + index + " not processed");
    }
  });

  return issues;
}

export async function collectDiagnostics(): Promise<string> {
  const header: string[] = [];
  const detail: string[] = [];
  const findings: Finding[] = [];

  const manifest = browser.runtime.getManifest();
  const cfg = get(settings);
  const version = get(versionInfo);

  /* ------------------------------------------------------------------ DOM */
  const output = document.querySelector<HTMLElement>(Config.SELECTOR_OUTPUT);
  const containers = output ? Array.from(output.querySelectorAll<HTMLElement>(Config.SELECTOR_RESPONSE)) : [];
  const rendered = containers.filter((c) => c.hasAttribute(Config.ATTRIBUTE_ALTERED)).length;
  const issues = nodeIssues(containers);
  const lastActionNodes = containers.filter((c) => (c.getAttribute("aria-label") ?? "").startsWith("Last action:")).length;

  const lastAction = document.querySelector(Config.SELECTOR_LAST_ACTION);
  const shadowHost = document.querySelector(Config.ID_EDITOR_ANCHOR);
  const wordFade = output?.querySelector(".word-fade") ?? null;

  /* -------------------------------------------------------------- Content */
  const shortId = playedShortId();
  const adventure = Storage.getSelectedAdventure();
  const cards = adventure ? Object.values(adventure.storyCards) : [];
  const withIcons = cards.filter((c) => c.icons.length > 0).length;
  const withPortraits = cards.filter((c) => c.graphics.length > 0).length;
  const portraits = cards.flatMap((c) => c.graphics);
  const portraitHosts = hostsOf(portraits);
  const cardMap = get(Storage.cardMap);
  const detected = get(aidDetected);
  const scenarioId = shortId && detected.shortId === shortId ? detected.scenarioId : null;
  const linkedByAdventure = Boolean(adventure && shortId && adventure.aidShortId === shortId);
  const linkedByScenario = Boolean(adventure && scenarioId && adventure.aidScenarioId === scenarioId);
  const linked = linkedByAdventure || linkedByScenario;

  // Do the card triggers actually match anything on screen? This separates "highlighting is broken"
  // from "nothing on this page happens to mention a card".
  let matches = 0;
  if (cardMap.size > 0) {
    for (const container of containers) {
      const text = container.textContent ?? "";
      if (text) matches += parseResponse(text, cardMap).filter((c) => c.type === "card").length;
    }
  }

  const firstPortrait = portraits[0];
  const probe = firstPortrait ? await probeImage(firstPortrait) : null;
  const usage = await storageUsage();
  const errors = capturedErrors();

  /* --------------------------------------------------------------- Header */
  header.push("DExtV2R " + manifest.version + " diagnostics (MV" + manifest.manifest_version + ")");
  header.push(browserLabel());
  header.push(new Date().toISOString());
  header.push(location.host + (shortId ? ", adventure " + shortId.slice(0, 4) + "..." : ", not in an adventure"));

  /* --------------------------------------------------------------- Detail */
  detail.push("", "[DOM]");
  detail.push(row("gameplay output", output ? "found" : "MISSING"));
  if (!output) detail.push(row("  selector", Config.SELECTOR_OUTPUT));
  detail.push(row("response nodes", containers.length + " (rendered " + rendered + ", last-action " + lastActionNodes + ")"));
  if (!output || containers.length === 0) detail.push(row("  selector", Config.SELECTOR_RESPONSE));
  if (issues.length > 0) {
    const shown = issues.slice(0, MAX_ISSUES).join(", ");
    detail.push(row("  unrendered", shown + (issues.length > MAX_ISSUES ? ", +" + (issues.length - MAX_ISSUES) + " more" : "")));
  }
  const newest = containers.at(-1);
  if (newest) {
    const host = DOM.pickTextHost(newest);
    const index = host ? Array.from(newest.children).indexOf(host) : -1;
    detail.push(
      row(
        "newest shape",
        newest.tagName.toLowerCase() + ", " + newest.childElementCount + " children, " + (host ? "text in #" + index : "NO TEXT HOST")
      )
    );
  }
  detail.push(row("last action node", lastAction ? "found" : "MISSING"));
  detail.push(row("extension UI", shadowHost ? "mounted" : "MISSING"));
  detail.push(
    row(
      "floating button",
      (extensionState.floatingButtonHidden ? "hidden for this session" : "on") +
        (cfg.floatingButtonQuickActions ? ", ring on" : ", ring off") +
        (cfg.floatingButtonHotkey ? ", toggle " + cfg.floatingButtonHotkey : ", no toggle shortcut")
    )
  );
  detail.push(row("text animation", wordFade ? "DETECTED" : "off"));
  if (DOM.skippedAnimated > 0) detail.push(row("  skipped so far", String(DOM.skippedAnimated)));
  detail.push(row("live components", String(DOM.mountedCount)));

  detail.push("", "[Content]");
  detail.push(
    row(
      "linked card set",
      adventure
        ? linkedByAdventure
          ? "yes, by adventure"
          : linkedByScenario
            ? "yes, by scenario"
            : "selected, NOT linked"
        : "none selected"
    )
  );
  detail.push(row("scenario id", shortId ? (scenarioId ? "seen" : "not seen in AID's response") : "n/a"));
  detail.push(row("story cards", cards.length + " (icons " + withIcons + ", portraits " + withPortraits + ")"));
  detail.push(row("trigger map", String(cardMap.size)));
  detail.push(row("trigger matches", matches + " in " + containers.length + " visible"));
  if (portraitHosts.length > 0) detail.push(row("portrait hosts", portraitHosts.join(", ")));
  if (probe) detail.push(row("portrait fetch", probe));
  detail.push(row("page tap", detected.cards.length > 0 ? detected.cards.length + " cards seen" : "nothing captured"));
  // Always shown, because the counts are what separate the three ways the tap can come up empty.
  detail.push(
    row(
      "  graphql seen",
      detected.stats.responses + " responses, " + detected.stats.withStoryCards + " with cards, " + detected.stats.holders + " read"
    )
  );

  detail.push("", "[Settings]");
  detail.push(row("icon", cfg.iconSize + "px, border " + cfg.iconThickness + "px"));
  detail.push(row("tooltip", cfg.tooltipWidth + "x" + cfg.tooltipHeight + ", delay " + cfg.tooltipDelay + "ms"));
  detail.push(row("focus / markdown", (cfg.highlightFocus ? "on" : "off") + " / " + (cfg.highlightMarkdown ? "on" : "off")));
  if (usage) {
    detail.push(row("storage in use", formatBytes(usage.total) + (usage.parts.length > 0 ? " (" + usage.parts.join(", ") + ")" : "")));
    detail.push(row("storage layout", usage.layout));
  }
  if (version.latest) detail.push(row("latest release", version.latest + (version.updateAvailable ? " (UPDATE AVAILABLE)" : "")));

  const tts = ttsDiagnostics();
  const narration = narrationDiagnostics();
  detail.push("", "[TTS]");
  detail.push(row("VN / TTS enabled", (cfg.visualNovelMode ? "on" : "off") + " / " + (cfg.novelTtsEnabled ? "on" : "off")));
  detail.push(row("engine", "Supertonic, WASM CPU, 1 thread"));
  detail.push(row("readiness", tts.phase + (tts.initializing ? " (initializing)" : "")));
  detail.push(row("engine present", tts.enginePresent ? "yes" : "no"));
  detail.push(row("last cache check", tts.cacheComplete === null ? "not checked this session" : tts.cacheComplete ? "complete" : "incomplete (may since have downloaded)"));
  detail.push(row("voice / steps", `${cfg.novelTtsVoice === "F5" ? "Female (F5)" : "Male (M5)"} / ${cfg.novelTtsSteps}`));
  detail.push(row("pitch / volume", `${cfg.novelTtsPitch} semitones / ${cfg.volume}%`));
  detail.push(row("queue lookahead", narrationQueueSize(cfg.novelTtsQueue) + " lines"));
  detail.push(row("reader queue", narration ? `${narration.ready}/${narration.total} ready, ${narration.failed} failed (unique texts)` : "inactive"));
  if (narration) {
    detail.push(row("upcoming lines", `${narration.upcomingReady}/${narration.upcomingTotal} ready`));
    detail.push(row("queue generating", narration.generating ? "yes" : "no"));
    detail.push(row("playback", narration.muted ? "muted" : narration.playing ? "playing" : narration.buffering ? "waiting for audio" : "idle"));
  }
  detail.push(row("speech requests", `${tts.pending} pending, ${tts.completed} completed, ${tts.failed} failed (session)`));
  if (tts.pending) detail.push(row("oldest request", tts.pendingMs + "ms (includes engine wait)"));
  detail.push(row("last synthesis", tts.lastGenerationMs === null ? "none completed" : tts.lastGenerationMs + "ms (includes engine wait)"));
  detail.push(row("last TTS failure", tts.lastFailure));
  if (cfg.novelTtsEnabled && tts.phase === "missing") findings.push({ level: "warn", text: "TTS models are missing. Open VN Settings and select Initialize TTS." });
  if (cfg.novelTtsEnabled && tts.phase === "error") findings.push({ level: "error", text: "TTS initialization failed. See the TTS failure category and retry Initialize TTS in VN Settings." });
  if (cfg.novelTtsEnabled && cfg.volume === 0) findings.push({ level: "warn", text: "TTS volume is 0, so narration is inaudible." });
  if (narration?.muted) findings.push({ level: "ok", text: "VN narration is muted. Use Unmute in the audio panel to hear it." });
  if (narration?.failed) findings.push({ level: "warn", text: "Some queued narration failed. See the TTS failure category; Read line retries the current line." });

  if (errors.length > 0) {
    detail.push("", "[Errors]");
    for (const error of errors) detail.push(error);
  }

  /* ------------------------------------------------------------- Findings */
  // Ordered so the first line a helper reads is the most likely cause.
  if (errors.length > 0) {
    findings.push({
      level: "error",
      text: "The extension threw " + errors.length + " error(s), listed above. That usually means AI Dungeon changed something the renderer depends on, and it needs a fix.",
    });
  }

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
      text: "Found " + containers.length + " responses but rendered none. Nothing is highlighted, so no icons or portraits can appear.",
    });
  } else if (issues.length > 0) {
    findings.push({
      level: "warn",
      text: issues.length + " of " + containers.length + " responses did not render, listed above. Ones marked 'no text host' mean AI Dungeon moved the story text somewhere the renderer does not expect.",
    });
  }

  if (wordFade || DOM.skippedAnimated > 0) {
    findings.push({
      level: "warn",
      text: "Text animation is on, so the newest response is skipped and shows no icons, highlights, or portrait pin. Turn it off in AI Dungeon under Gameplay > Appearance > Accessibility > Text Animation.",
    });
  }

  if (!shadowHost) {
    findings.push({
      level: "error",
      text: "The extension's own UI is not mounted on the page, so nothing it draws can appear. Reload the tab; if that does not help, reinstall.",
    });
  }

  if (extensionState.floatingButtonHidden) {
    findings.push({
      level: "warn",
      text:
        "The floating button is hidden for this session. Refresh the page to restore it" +
        (cfg.floatingButtonHotkey ? ", or press " + cfg.floatingButtonHotkey + "." : "."),
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

  if (cards.length > 0 && cardMap.size === 0) {
    findings.push({
      level: "warn",
      text: "The cards have no trigger words, so nothing in the story can match them. Add triggers on each card.",
    });
  } else if (cardMap.size > 0 && containers.length > 0 && matches === 0) {
    findings.push({
      level: "warn",
      text: "No trigger matched any of the text currently on screen. Either these responses genuinely mention no cards, or the triggers do not match how the names are written in the story.",
    });
  }

  if (probe && !probe.startsWith("ok")) {
    findings.push({
      level: "error",
      text: "A portrait image could not be loaded (" + probe + "). The images themselves are unreachable, so portraits cannot show no matter what else is correct. Check whether the host is up, or whether a content blocker is blocking it.",
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

  // The page tap only feeds the Import tab; highlighting runs entirely off the local card set. So an
  // empty tap is only worth flagging to someone who has no cards yet, for whom importing is the way
  // in. Anyone who built their set by hand (or imported it earlier) has a working setup and must not
  // be told something is broken. It can also be empty simply because the adventure has no story
  // cards, or because AID fetched them before the extension started, hence the reload advice.
  if (shortId && detected.cards.length === 0) {
    const tap = detected.stats;
    // Someone who built their card set by hand, or imported it in an earlier session, has a working
    // setup; an empty tap costs them nothing, so say so rather than raising an alarm.
    const harmless = cards.length > 0 ? " The cards you already have are unaffected, this only matters for importing." : "";
    const level: Level = cards.length > 0 ? "ok" : "warn";

    if (tap.responses === 0) {
      findings.push({
        level,
        text: "No AI Dungeon data traffic was seen at all, so the Import tab is empty. Reload the page: the extension can only read that traffic when it starts before the page does." + harmless,
      });
    } else if (tap.withStoryCards === 0) {
      findings.push({
        level,
        text: "Read " + tap.responses + " responses from AI Dungeon and none carried story cards, so the Import tab is empty. Open your story cards in AI Dungeon once, or reload the adventure, then check again: cards are only visible here when AI Dungeon itself loads them." + harmless,
      });
    } else {
      findings.push({
        level: "error",
        text: "AI Dungeon sent story cards (" + tap.withStoryCards + " responses) but the extension could not read them. That is a bug in the extension, please report this line.",
      });
    }
  }

  // Both layouts present means the one-time migration wrote the new keys but did not get to remove
  // the blob. Harmless (the per-adventure copy wins on load) but it doubles the space, and the
  // next load retries it, so a reload is the fix.
  if (usage && usage.legacyBytes > 0) {
    findings.push({
      level: "warn",
      text: "The old single-blob adventure store is still on disk next to the new per-adventure keys, so the storage migration did not finish. Reload the page once; if this line stays, report it.",
    });
  }

  if (usage && usage.total > 50 * 1024 * 1024) {
    findings.push({
      level: "warn",
      text: "The extension is storing " + formatBytes(usage.total) + ", which is a lot and can slow loading. That usually means images or audio were pasted in directly rather than linked by URL.",
    });
  }

  if (location.host !== "play.aidungeon.com") {
    findings.push({
      level: "ok",
      text: "This is " + location.host + ", not the live site. Its page structure can differ from play.aidungeon.com, so breakage here does not necessarily affect everyone.",
    });
  }

  if (version.updateAvailable) {
    findings.push({
      level: "ok",
      text: "A newer version (" + version.latest + ") is available; the problem may already be fixed in it.",
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

  const findingLines = findings.map((f) => wrap(f.level === "error" ? "X" : f.level === "warn" ? "!" : "-", f.text));

  // Findings first: a long report can be truncated in chat, and the conclusion is what matters.
  return [...header, "", "[Findings]", ...findingLines, ...detail].join("\n");
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
