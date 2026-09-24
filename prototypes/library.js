/*
 * Visual Novel dialogue instructions for AI Dungeon.
 * Paste this entire file into the shared Library script and enable scripts.
 * No changes to Input, Context, or Output are needed with the default modifiers.
 * When combining scripts, place this after any code that replaces state.memory.
 * Scripts that later replace frontMemory can overwrite these instructions.
 *
 * Active by default. To disable, set state.vnDialogueEnabled = false before
 * this code; set it to true to enable again. The browser extension's VN window
 * does not control this script. Existing story cards are never modified.
 * These are AI instructions, not an output formatter or a guarantee of compliance.
 */
(function () {
  var enabled = state.vnDialogueEnabled !== false;
  var start = "[DE-VN-DIALOGUE-INSTRUCTIONS]";
  var end = "[/DE-VN-DIALOGUE-INSTRUCTIONS]";
  var instructions = `IMPORTANT:
- This is a Visual Novel, narration and dialog must be in a structured order
- Names beside their spoken words:
<name>: "<spoken words>"
- Use this exact format for EVERY spoken utterance, including whispers, murmurs, muttering, yelling, shouting, screaming, hushing, and any other way of speaking. Never replace the name label with a speech verb or put delivery directions inside the label.
- Describe tone, volume, and delivery in separate narration on a new line. For example:
Sage: "Stay quiet."
Sage whispers a warning.
- Narration after in a new line
- Never use he or she for <name>
narration must include <name> where appropriate instead of he or she.`;

  if (!state.memory) state.memory = {};
  var memory = typeof state.memory.frontMemory === "string"
    ? state.memory.frontMemory : "";

  // Library runs before each hook. Replace our own block instead of appending
  // another copy every turn. Preserve other scripts' text and whitespace.
  var separator = "\n\n";
  var position = memory.indexOf(start);
  while (position !== -1) {
    var finish = memory.indexOf(end, position + start.length);
    if (finish === -1) break;
    var from = position;
    if (memory.slice(Math.max(0, from - separator.length), from) === separator) {
      from -= separator.length;
    }
    memory = memory.slice(0, from) + memory.slice(finish + end.length);
    position = memory.indexOf(start);
  }

  // frontMemory is supplied to the AI after the recent story/player input.
  // Do not edit text here: Library also runs before Input and Output hooks.
  state.memory.frontMemory = enabled
    ? memory + (memory ? separator : "") + start + "\n" + instructions + "\n" + end
    : memory;
})();
