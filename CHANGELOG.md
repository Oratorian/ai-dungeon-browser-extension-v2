# Changelog

Written to be readable in both places it gets used: GitHub attaches the section for the tag it is
building as the release body, and the same text can be pasted straight into Discord. That means no
tables and no HTML, since Discord renders neither.

Each version is a `## v<version>` heading. The release workflow matches on that exact form, so keep
it, and keep the newest version at the top.

## v3.0.0

### Story text fixes

- Opening **Actions** no longer replays the current narration when AI Dungeon remounts unchanged
  story text. **Read line** still explicitly replays its cached audio.
- VN resumes after Send even when AI Dungeon removes older loaded passages or reformats them.
  Story-card @mentions also work in the VN action box, using the same card types and keyboard
  controls as the native textbox.
- Sending Do, Say, or Story in Visual Novel Mode preserves the reading position until new text
  arrives. Player action rows are included in reading and narration, including standalone styled
  text, labelled rows without animation wrappers, and text split across inline elements.
- Visual Novel Mode keeps quoted speech and its attribution together, including questions and
  exclamations. Narration follows sentence boundaries without cutting long sentences at a word limit.
- Character highlighting now matches visible text nodes instead of serialized HTML. Characters
  named Aria, Span, or Mark cannot split accessibility attributes or formatting tags into the story.
  Inline formatting and escaped text remain intact.

### 🎭 Visual Novel Mode

Read your adventure as a visual novel with character portraits and a dialogue panel. Enable it
under **Settings > Extension > Visual Novel Mode**, or toggle it directly from the floating
button's quick actions. The quick-action icon highlights while the mode is enabled.

- The floating **Visual Novel Mode** action opens a panel, like Sets and Stamp. Hover to open
  or click to pin it, then enable/exit the reader or **Initialize TTS** without opening Settings.

- Optional **Browser narration** runs Supertonic locally with **M5** or **F5** and **5-10 steps**.
  **Enable TTS** shows Off, On with models needed, or On and fully available. **Initialize TTS**
  downloads and loads both voices through the background helper. Cached models load automatically
  when enabled again. Narration uses one CPU thread; story text stays in the browser.
- **That's how it sounds like** generates a short narration preview using your selected voice,
  steps, and pitch. Pitch ranges from **-3 to +3 semitones**, with **0** as the original voice,
  and preserves the reading speed. Preview controls let you replay or stop the sample.
- Narration prepares the current line and **1-20 upcoming lines**, with three ahead by default.
  The TTS settings use a two-column grid with voice, steps, pitch, queue size, and a full-width preview.
  **X/Y upcoming lines ready**
  shows how many available upcoming lines have cached audio. Navigation stops the previous line; **Read line** retries or replays it,
  and **Mute** silences playback while upcoming lines continue preparing.
- **Continue** keeps your current position until the first new line arrives instead of rewinding
  the old response. Narrated passages use short sentence chunks, preparing complete sentences
  while later text streams. Text waits for its audio, with **Read now** available to skip buffering.

- **Back**, **Next**, and keyboard navigation move through narration and dialogue. **Latest
  passage** jumps to the newest loaded passage.
- Each paragraph sets the cast using names and triggers from your selected extension character
  cards. Up to four portraits appear, two on each side, with stable positions and short fades.
- Characters remain through the paragraph's narration and quotes. A single named character can
  carry into one following paragraph that continues with third-person pronouns, within the same
  response. Otherwise, the next paragraph updates the cast. Reduced-motion preferences disable fades.
- **Assign character** lets you choose a card for a paragraph with an unnamed NPC or unclear
  pronouns. The choice stays local to that loaded paragraph and resets when its text changes or
  the reader is reset. You can clear it, edit the chosen card's artwork, or create a character
  card in your selected set without adding global pronoun triggers.
- **Actions** includes AI Dungeon's native **Do**, **Say**, **Story**, and **Guide** modes.
  Your draft is shared with the game; Enter adds a line and **Send** submits the action.
- **Actions** sits beside **Continue** in the bottom controls. The action box opens only
  when clicked, and stays closed when reaching the end of a passage.
- **Continue** uses AI Dungeon's native command. An unfinished draft is kept in memory and restored
  when you next open Actions, without reopening the textbox during generation.
- **Retry** regenerates AI Dungeon's latest response. It stops narration, clears the upcoming
  audio queue, waits for replacement text, and starts reading at the replacement's first line.
  Your unfinished action draft is preserved.
- **Return to game** reveals the normal interface; **Resume visual novel** reopens the reader.
  **Exit mode** switches it off.

This mode reads the story already loaded in the browser, without additional AI requests. It does
not infer speakers or generate portraits for unknown NPCs. Native action controls recover when
AI Dungeon temporarily collapses or replaces them, and draft text is preserved during recovery.

### ✨ Story Card names at your fingertips

Type `@` in the action textbox to search the current adventure's Story Card names. Click a
suggestion, or use the arrow keys and Enter or Tab, to insert the full name without sending your
action. The suggestions use Story Cards detected directly from AI Dungeon, so no import is needed.

The new **Story Card Autocomplete** dropdown under **Settings > Extension** lets you turn the
feature on or off and choose which types appear: Character, Class, Race, Location, Faction and
Custom. All types are enabled by default, and user-defined types are included under Custom.

### 🔄 Updates for GitHub card sets

Sets imported from GitHub now remember their source and installed version. Opening the editor
or a set picker checks for updates, with a short cooldown between automatic checks. You can also
use **Check for updates now** in the editor's adventure picker.

An **Update available** badge appears beside the set in both the editor picker and the floating
**Sets** menu. Review the update and choose how to install it:

- **Merge** adds new cards and keeps your existing cards and local edits.
- **Overwrite** replaces the entire card collection, including local additions and edits.

Both options preserve the set's name and adventure/scenario bindings. Updates are only installed
when you choose to apply them. Tracking is available for GitHub imports with a saved source;
local file imports are not checked.

Version checks support both whole numbers and dotted versions such as `9.2.1`. Successive updates
are detected reliably, and the version reviewed and the file downloaded stay consistent.

### 📦 Choose a version when exporting

Exporting a card set now offers a version dialog. Keep the current version, accept the suggested
bump, or enter a higher version yourself. The suggestion increments the last component, such as
`1` to `2` or `9.2.1` to `9.2.2`.

The chosen version is written to the top-level `version` field at the beginning of the exported
JSON and remembered for your next export.

### 🩹 Re-add deleted Trinetra images

Deleting an image makes it selectable again in the Trinetra picker immediately, even while the
picker stays open. Images still in your library remain disabled to prevent duplicates.

🔓 No new permissions.

## v2.3.2

### 🩹 Player actions keep their text size

Fixed player actions appearing much smaller than the surrounding story when AI Dungeon applies
text styling inside nested elements. The extension now preserves the original font size, font
family, line spacing and letter spacing when rendering these actions.

🔓 No new permissions.

## v2.3.0

### 🧭 The floating button grows a ring

Hover the floating button and four quick actions appear around it. Two of them work right there,
without opening the editor:

- **Sets**: switch the active card set, start a new one, restore one from a file, or jump to the
  AI Dungeon import.
- **Stamp**: bind the set to the story you are playing, by scenario or by adventure, or unbind it.

**AID Sync** and **Settings** open the editor on that tab, and the button itself opens the editor
where you last left it, so nothing on the ring repeats what the button does. Hovering a ring button
opens its second level; clicking pins it open until you click elsewhere or press Escape.

The ring uses whatever room the button has: the full cross in the open, a half ring against an
edge, a quarter in a corner. The order of the actions never changes, only how much of the circle
they use. This came from feedback in the AI Dungeon Discord, sketch included. Thank you.

### 🗑️ The Editor entry in AI Dungeon's menu is gone

It was cloned into AI Dungeon's own menu (the flame, top left), which meant it broke whenever that
menu changed. The floating button, its ring and the keyboard shortcut cover everything it did. The
Diagnostics report no longer mentions it and instead shows the button, ring and toggle shortcut
state.

## v2.2.0

### 🎯 Stamp once per scenario, not once per adventure

A card set can now follow the **scenario** an adventure was started from. Stamp it once and it
loads for every adventure you start or duplicate from that scenario, so restarting a story no longer
means picking the set and stamping it again. Sets you import from AI Dungeon get this link
automatically. The old per-adventure stamp is still there as **This adventure only**, and it wins
over the scenario link, so one adventure of a scenario can carry its own set. Importing into a
duplicate of an adventure you already imported now recognises it and merges instead of creating a
second set.

The scenario link only works when AI Dungeon's own adventure data names its scenario. If it does
not, the Stamp Scenario button explains that, and the per-adventure stamp still works.

### 🧭 Shortcuts on the floating button

Hover the floating button and three shortcuts slide out: **Story Cards**, **AID Sync** and
**Settings**. Each opens the editor straight on that tab, so bringing cards in from AI Dungeon is one
click. The shortcuts open toward whichever side has room, stay hidden while you drag the button, and
can be turned off under **Settings → Floating Button → Quick Actions**.

The button itself now wears the extension's icon, and its size is a slider (24 to 128 px) in the
same settings section. A **Toggle Shortcut** there, Ctrl+Shift+F by default, shows or hides the
button mid-story. It is recorded inside the extension, not in the browser's shortcut settings, so
click the field and press whatever combination you like.

### 🙏 Credit

The editor footer now names Claudia, whose Dungeon Extension v2 this project continues, and links
her repository. The source always did; the installed copy should too.

Both ideas came from feedback in the AI Dungeon Discord. Thank you.

### 🩺 Diagnostics

The report now says whether a set is linked by adventure or by scenario, and whether AI Dungeon's
response carried a scenario id at all.

### 🩹 Fix: player actions with markdown no longer come out garbled

AI Dungeon started labelling each player action for screen readers with a copy of the action's
text. The extension let that label through and its markdown pass ran over it, so an action like
`*I step back* ...` showed up twice with a stray `aria-level="3">` in the middle. Accessibility
attributes are now stripped before any formatting happens.

## v2.1.0

### 🔓 No new permissions

This update asks for nothing 2.0.0 did not already have, so it installs without a prompt. The
openrouter.ai and civitai.com permissions stay: Firefox needs them for image generation to reach
those services at all, even though Chrome does not.

### 🔁 Importing again keeps your cards current

Import used to skip any card it had already brought over, so once imported, a set never followed AI
Dungeon again. Cards you already have are now **updated in place**, matched by AI Dungeon's own id or
by name, and only the parts AI Dungeon owns are touched: name, type and triggers. Your icons,
portraits, audio and colours stay exactly as you set them. The Import tab reports what was new and
what was updated.

### ⚡ Faster editing with big card sets

Every edit used to rewrite every adventure you have. Each adventure is now stored on its own, so a
change costs one adventure, not all of them. Existing data moves over automatically the first time
this version loads; there is nothing to do.

### 🗜️ Images are compressed as you add them

New uploads are shrunk on the way in, at the icon or portrait size for the slot you add them to, so a
full-resolution photo never lands in storage. On by default, with a switch under **Image
Compression** for anyone who wants originals kept. The cleanup pass is still there for images added
before this.

### 💾 Back up everything in one file

A **Back up first** button next to Compress downloads every adventure as one file, and Import on the
Adventure tab restores it, keeping ids so links survive.

### ⌨️ Keyboard shortcut

**Ctrl+Shift+L** opens the editor. Rebindable in your browser's extension shortcut settings.

### 🖼️ Trinetra: key in Settings, picker remembers your folder

The API key now lives under **Settings › Extension › Trinetra**, entered once, with a Check key
button that confirms the account. The image picker no longer asks for it. And the picker reopens in
whichever folder you were last in, with a clickable path back to the root, so editing several cards
from the same folder no longer means clicking down the same path each time.

### 🔧 Under the hood

- Two of the four "unsafe innerHTML" warnings AMO showed are gone; the remaining two are library
  internals that cannot go.
- Build tooling updated (WXT 0.21), with the stricter type checks it brings applied throughout.
- The core logic (trigger matching, compression decisions, model resolution, storage) now has
  automated tests.

## v2.0.0

### ⚠️ This update asks for new permissions

Your browser will ask you to approve access to **openrouter.ai** and **civitai.com** before the update
finishes, and Chrome will pause the extension until you do. That is expected.

Those two are image generation services, and the extension only ever contacts the one you pick, only
after you paste in your own API key. If you never turn image generation on, nothing is ever sent to
either of them. Everything the extension already did is unchanged and still works offline.

### 🎨 New: generate card images from a prompt

Add your own **OpenRouter** or **Civitai** key and a **Generate** option appears wherever you add an
icon or a portrait. Describe what you want, and the finished image goes straight onto the card.

- Generations are billed to **your own account**, in dollars on OpenRouter or Buzz on Civitai. Cost is
  shown after each one.
- Choose where the result is kept: uploaded to **Trinetra** so the card stores only a link, or
  compressed and stored in the card itself.
- OpenRouter offers every image model it currently has, cheapest first. Civitai takes a model link and
  looks the rest up for you, including the sampler, steps and CFG the model's own samples were made
  with.
- Models that cannot generate through Civitai's API, Anima checkpoints among them, are refused up
  front rather than charged for and then failed.

### 🗜️ New: shrink images you have already added

**Settings → Extension → Image Compression** finds every image stored inside a card, tells you what
they cost, and re-encodes them. Images added as links are untouched, and anything already small enough
is left alone, so running it twice does nothing the second time.

Worth checking if the editor feels slow: an adventure with a few full-resolution photos pasted in can
reach hundreds of megabytes, and all of it is loaded on every AI Dungeon tab.

### 🗂️ Reorganised

- **Settings** is now two tabs: **Extension** for the extension's own behaviour, **Story Cards** for
  everything that changes what you see while playing.
- The **Adventure** tab groups cards by type into collapsible sections, with a search across names and
  trigger words and filters per type. Groups start closed, so a large set opens as a short overview.

### 🔧 Fixes

- Tooltips no longer open on top of the setting they describe, which had made some fields impossible
  to use.
- Card tilt and shine are now adjustable, and can be turned off.

## v1.4.0

### 🔧 Fixed: story cards were no longer being detected

AI Dungeon changed how it loads story cards, and the extension was still looking in the old place. It
quietly found nothing, which is why some people saw **"No story cards detected"** while others were
completely fine: it depended on whether you had imported your cards before the change. With no cards
imported there is nothing to highlight, so those setups also had no icons and no portraits at all.

It now finds story cards wherever AI Dungeon puts them, rather than at one fixed location, so the
next time something moves this should keep working.

- If you were stuck on "No story cards detected", open your story cards in AI Dungeon once, or reload
  the adventure, and they will appear ready to import.
- Imported adventures are named after your story again, instead of all being called **Imported
  Adventure**.

### 🗂️ New: the Adventure tab is grouped, searchable and filterable

A large card set used to be one long scrolling grid. It is now grouped by card type, the same way AI
Dungeon groups its own story cards.

- **Collapsible groups** per type, showing its icon and how many cards it holds. They start closed, so
  a big set opens as a short overview instead of a wall of cards.
- **Search** across both card names and trigger words, since the trigger is often what you remember
  when the name escapes you. Searching opens every group so nothing hides inside a closed one.
- **Type filters** with counts. Select none and everything shows.
- **Expand all / Collapse all** next to the card count.

### 🩺 New: Diagnostics, for when something looks broken

**Settings > Support > Diagnostics** checks everything the extension depends on and copies a short
report you can paste into a support thread:

- whether AI Dungeon's page still looks the way the extension expects, and which part changed if not,
- whether your card images can actually be loaded,
- whether any of your own settings are quietly hiding icons or portraits,
- and a plain-language conclusion, so you do not have to interpret the numbers.

It reports counts only. No card names, no story text, no image links, no keys, so it is safe to paste
in public.
