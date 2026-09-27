// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { createLynxRenderer } from "@/rendering/lynxcat";
import { Storage } from "@/storage";

let renderer: ReturnType<typeof createLynxRenderer> | undefined;
afterEach(() => { renderer?.destroy(); document.body.innerHTML = ""; });
const options = { iconColor: "#ffaa00", highlightBold: true, iconSize: 32 };
function setup(withImage = true) {
  document.body.innerHTML = `<div aria-label="Story transcript"><article data-message-id="one"><div role="button" aria-label="Edit story output"><p class="story-turn-copy">He says, <span class="story-detail-mention" data-entity-id="native">${withImage ? '<button aria-label="Preview portrait"><img class="story-detail-portrait" src="https://example.com/native.png"></button>' : ''}Kael</span>.</p></div></article></div>`;
  const adventure = Storage.createAdventure("Render test");
  const card = Storage.createStoryCard(adventure.id, "Kael")!;
  card.aidId = "lynxcat:native";
  card.graphics = ["https://example.com/local.png"];
  renderer = createLynxRenderer();
  return card;
}
it("overrides portraits without replacing native text or edit controls, and restores on deselect", () => {
  const card = setup();
  const paragraph = document.querySelector("p")!;
  const text = paragraph.textContent;
  const control = document.querySelector("button")!;
  let clicks = 0; control.addEventListener("click", () => clicks++);
  renderer!.render([card], options);
  renderer!.render([card], options);
  expect(paragraph.textContent).toBe(text);
  expect(document.querySelector("button")).toBe(control);
  control.click(); expect(clicks).toBe(1);
  expect(paragraph.querySelectorAll("img")).toHaveLength(1);
  expect(paragraph.querySelector("img")!.src).toBe(card.graphics[0]);
  renderer!.render([], options);
  expect(paragraph.querySelector("img")!.src).toBe("https://example.com/native.png");
  expect(paragraph.querySelector("span")!.getAttribute("style")).toBeNull();
});
it("adds a local icon once and removes it when no picture remains", () => {
  const card = setup(false);
  renderer!.render([card], options); renderer!.render([card], options);
  expect(document.querySelectorAll("p img")).toHaveLength(1);
  card.graphics = [];
  renderer!.render([card], options);
  expect(document.querySelectorAll("p img")).toHaveLength(0);
  expect(document.querySelector("p")!.textContent).toBe("He says, Kael.");
});
it("handles replaced messages and text edits without duplicating or reverting story content", () => {
  const card = setup(); renderer!.render([card], options);
  const message = document.querySelector("article")!;
  message.replaceWith(message.cloneNode(true));
  const span = document.querySelector("p span")!;
  span.lastChild!.textContent = "Kael replies";
  renderer!.render([card], options);
  expect(document.querySelector("p")!.textContent).toBe("He says, Kael replies.");
  expect(document.querySelectorAll("p img")).toHaveLength(1);
});
it("pins a hovered portrait through Focus without activating native story editing", () => {
  const card = setup(); renderer!.destroy();
  let focused = "";
  renderer = createLynxRenderer(document, id => focused = id);
  renderer.render([card], { ...options, highlightFocus: true });
  document.querySelector('.story-detail-mention')!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  const focus = [...document.querySelectorAll('button')].find(b => b.textContent === "Focus")!;
  expect(focus.style.display).toBe("block"); focus.click();
  expect(focused).toBe(card.id);
  renderer.render([card], { ...options, highlightFocus: false });
  document.querySelector('.story-detail-mention')!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(focus.style.display).toBe("none");
});
