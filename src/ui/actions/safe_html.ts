import DOMPurify from "dompurify";

// Renders sanitised HTML into an element without ever assigning innerHTML.
//
// Svelte's {@html} compiles to an innerHTML assignment, which AMO's linter flags as unsafe on every
// build regardless of what was sanitised beforehand, and every `{@html}` in the codebase was already
// fed through DOMPurify first. Asking DOMPurify for a DocumentFragment instead of a string and
// appending that skips the innerHTML step altogether: the sanitiser's own parsed nodes go into the
// DOM, with no serialise-then-reparse in between for anything to slip through.
//
// Use as `<span use:safeHtml={{ html, config }}></span>`. The element's existing children are
// replaced, and cleared again when the element is destroyed.

type SanitizeConfig = Parameters<typeof DOMPurify.sanitize>[1];

export type SafeHtmlParams = {
  html: string;
  /** DOMPurify options, e.g. an ALLOWED_TAGS allowlist. Sanitising is never skipped. */
  config?: SanitizeConfig;
};

export function safeHtml(node: HTMLElement, params: SafeHtmlParams) {
  const render = ({ html, config }: SafeHtmlParams) => {
    const fragment = DOMPurify.sanitize(html ?? "", { ...(config ?? {}), RETURN_DOM_FRAGMENT: true });
    node.replaceChildren(fragment);
  };

  render(params);

  return {
    update: render,
    destroy() {
      node.replaceChildren();
    },
  };
}
