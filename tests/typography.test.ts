// @vitest-environment jsdom
import { expect, it } from "vitest";
import { preserveTypography } from "@/rendering/typography";

it("preserves nested player prose typography without copying its markup or formatting", () => {
  const original = document.createElement("span");
  original.innerHTML = '<span aria-hidden="true">w_chat</span><span hidden data-gameplay-replay-label="true">Action You say, "Corruption?"</span><span style="font-size: 32px; font-family: Georgia; line-height: 48px; letter-spacing: 1px; font-weight: bold">You say, "Corruption?"</span>';
  document.body.append(original);
  const host = original.cloneNode(false) as HTMLElement;
  preserveTypography(original, host);
  expect(host.style.fontSize).toBe("32px");
  expect(host.style.fontFamily).toBe("Georgia");
  expect(host.style.lineHeight).toBe("48px");
  expect(host.style.letterSpacing).toBe("1px");
  expect(host.style.fontWeight).toBe("");
  expect(host.textContent).toBe("");
  original.remove();
});

it("preserves typography when the outer host contains plain text", () => {
  const original = document.createElement("span");
  original.style.fontSize = "24px";
  original.textContent = "You look around.";
  document.body.append(original);
  const host = document.createElement("span");
  preserveTypography(original, host);
  expect(host.style.fontSize).toBe("24px");
  original.remove();
});
