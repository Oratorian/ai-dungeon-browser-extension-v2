// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/ui/components/response.svelte", () => ({ default: {} }));
import { DOM } from "@/rendering/dom";
import { ResponseType } from "@/shared/types";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

it("selects visible prose rather than a leading hidden replay label or icon", () => {
  const row = document.createElement("div");
  row.innerHTML = '<span hidden>Action You say, "Hello."</span><span aria-hidden="true">w_comment</span><span id="prose">You say, "Hello."</span>';
  expect(DOM.pickTextHost(row)?.id).toBe("prose");
});

it("recognizes the latest response from its new aria-labelledby replay label", () => {
  document.body.innerHTML = '<main><span id="replay" hidden data-gameplay-replay-label="true">Last action: Dawn arrives.</span><span id="transition-opacity" aria-labelledby="replay"><span>Dawn arrives.</span></span><span id="transition-opacity" aria-label="Last action: Older markup"><span>Older markup</span></span><span id="transition-opacity"><span>Normal story.</span></span></main>';
  const mount = vi.spyOn(DOM, "mountResponseOn").mockImplementation(() => {});
  DOM.prettifyButBetter(document.querySelector("main")!);
  expect(mount.mock.calls.map(([, type]) => type)).toEqual([ResponseType.LastAction, ResponseType.LastAction, ResponseType.Action]);
});
