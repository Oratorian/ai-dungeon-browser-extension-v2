// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { continueStory, retryStory, readActionInput, submitAction } from "@/aid/action_input";
import { playedShortId } from "@/aid/adventure";
import { readNovelPassages } from "@/rendering/novel_dom";
import { isSupportedStoryUrl } from "@/services/site";

beforeEach(() => {
  vi.stubGlobal("location", { hostname: "lynxcatai.com", pathname: "/plays/play-test" });
  document.body.innerHTML = '<textarea aria-label="Player turn">draft</textarea><button aria-label="Send turn"></button><button aria-label="Continue story"></button><button class="play-composer-action is-retry"></button>';
});
afterEach(() => vi.unstubAllGlobals());
it("admits Lynx TTS clients without opening the relay to unrelated origins", () => {
  expect(isSupportedStoryUrl("https://lynxcatai.com/plays/play-test")).toBe(true);
  expect(isSupportedStoryUrl("https://play.aidungeon.com/adventure/test")).toBe(true);
  for (const url of ["https://lynxcatai.com.evil.test/", "http://lynxcatai.com/", "https://evil.test/", "null"]) expect(isSupportedStoryUrl(url)).toBe(false);
});
it("uses the Lynx story identity and native free-text composer", async () => {
  expect(playedShortId()).toBe("play-test");
  expect(readActionInput()).toMatchObject({ available: true, mode: "Story", value: "draft" });
  const send = vi.fn(); document.querySelector('[aria-label="Send turn"]')!.addEventListener("click", send);
  await submitAction('I ask, "Who is Kael?"', "Story", new AbortController().signal);
  expect(send).toHaveBeenCalledOnce();
  expect(document.querySelector("textarea")!.value).toBe('I ask, "Who is Kael?"');
});
it("continues and retries through native buttons without touching the draft", async () => {
  const next = vi.fn(), retry = vi.fn();
  document.querySelector('[aria-label="Continue story"]')!.addEventListener("click", next);
  document.querySelector('.is-retry')!.addEventListener("click", retry);
  await continueStory(new AbortController().signal); await retryStory(new AbortController().signal);
  expect(next).toHaveBeenCalledOnce(); expect(retry).toHaveBeenCalledOnce();
  expect(document.querySelector("textarea")!.value).toBe("draft");
  document.querySelector<HTMLButtonElement>('.is-retry')!.disabled = true;
  await expect(retryStory(new AbortController().signal)).rejects.toThrow("not ready");
});
it("reads player and assistant turns once, omitting native portrait and edit controls", () => {
  const output = document.createElement("div"); output.setAttribute("aria-label", "Story transcript");
  output.innerHTML = '<article data-message-id="1" data-message-role="user"><div role="button"><p class="story-turn-copy">You ask <span><button>Preview portrait</button>Kael</span>.</p></div><button>Edit</button></article><article data-message-id="2" data-message-role="assistant"><p class="story-turn-copy">Kael: "Hello."</p><button>Report</button></article>';
  expect(readNovelPassages(output).map(p => p.text)).toEqual(['You ask Kael.', 'Kael: "Hello."']);
  expect(readNovelPassages(output).filter(p => p.element.dataset.messageRole !== "user").map(p => p.text)).toEqual(['Kael: "Hello."']);
});
