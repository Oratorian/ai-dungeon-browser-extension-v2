# Changelog

Written to be readable in both places it gets used: GitHub attaches the section for the tag it is
building as the release body, and the same text can be pasted straight into Discord. That means no
tables and no HTML, since Discord renders neither.

Each version is a `## v<version>` heading. The release workflow matches on that exact form, so keep
it, and keep the newest version at the top.

## v2.1.0

### 🔓 No more permission prompt for image generation

2.0.0 made everyone approve access to **openrouter.ai** and **civitai.com**, most for a feature they
would never turn on. Those permissions turned out to be unnecessary: the calls are made from the page
and allowed by the services' own rules, and they worked without them all along. They are gone.
Removing a permission never prompts, so this update installs silently.

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

**Alt+Shift+D** opens the editor. Rebindable in your browser's extension shortcut settings.

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
