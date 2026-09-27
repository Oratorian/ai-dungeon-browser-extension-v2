import { isLynxCat } from "./site";
export const storyOutputSelector = () => isLynxCat() ? '[aria-label="Story transcript"]' : '#gameplay-output';
export const storyOutput = () => document.querySelector<HTMLElement>(storyOutputSelector());
export const continueSelector = () => isLynxCat() ? '[aria-label="Continue story"]' : '[aria-label="Command: continue"]';
