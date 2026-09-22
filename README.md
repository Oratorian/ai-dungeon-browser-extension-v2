<div align="center">

<img src="public/icon/128.png" alt="Icon"/>
<h1>Dungeon Extension v2 Resurrected</h1>

[![Release](https://img.shields.io/github/v/release/Oratorian/ai-dungeon-browser-extension-v2?style=flat-square&label=release&color=f8ae2c)](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/releases/latest)
[![Firefox Add-on](https://img.shields.io/amo/v/dungeonextensionv2resurrect?style=flat-square&logo=firefoxbrowser&logoColor=white&label=firefox)](https://addons.mozilla.org/firefox/addon/dungeonextensionv2resurrect/)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/keegfhpckdjecndjlgmjnjlfhlnepiga?style=flat-square&logo=googlechrome&logoColor=white&label=chrome)](https://chromewebstore.google.com/detail/dungeon-extension-v2-resu/keegfhpckdjecndjlgmjnjlfhlnepiga)
[![License](https://img.shields.io/github/license/Oratorian/ai-dungeon-browser-extension-v2?style=flat-square&color=blue)](LICENSE)

[![Release build](https://img.shields.io/github/actions/workflow/status/Oratorian/ai-dungeon-browser-extension-v2/release.yml?style=flat-square&label=release%20build)](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/actions/workflows/release.yml)
[![Firefox publish](https://img.shields.io/github/actions/workflow/status/Oratorian/ai-dungeon-browser-extension-v2/publish-firefox.yml?style=flat-square&label=firefox%20publish)](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/actions/workflows/publish-firefox.yml)
[![Chrome publish](https://img.shields.io/github/actions/workflow/status/Oratorian/ai-dungeon-browser-extension-v2/publish-chrome.yml?style=flat-square&label=chrome%20publish)](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/actions/workflows/publish-chrome.yml)

[![Firefox users](https://img.shields.io/amo/users/dungeonextensionv2resurrect?style=flat-square&logo=firefoxbrowser&logoColor=white&label=firefox%20users)](https://addons.mozilla.org/firefox/addon/dungeonextensionv2resurrect/)
[![Chrome users](https://img.shields.io/chrome-web-store/users/keegfhpckdjecndjlgmjnjlfhlnepiga?style=flat-square&logo=googlechrome&logoColor=white&label=chrome%20users)](https://chromewebstore.google.com/detail/dungeon-extension-v2-resu/keegfhpckdjecndjlgmjnjlfhlnepiga)

[![WXT](https://img.shields.io/badge/WXT-0.21-67D74E?style=flat-square)](https://wxt.dev)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

A browser extension that enhances your AI Dungeon experience with story cards, visual overlays, audio effects, and text formatting.

> **Resurrected fork.** Originally created by [clauds-clauds](https://github.com/clauds-clauds/ai-dungeon-browser-extension-v2) (MIT). This fork revives the project and keeps it working against AI Dungeon's ongoing site changes, maintained by [Oratorian](https://github.com/Oratorian).

## Installation

### From a store

The easiest option, and it keeps itself updated.

- **Firefox:** [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/dungeonextensionv2resurrect/)
- **Chrome, Edge, Brave, Opera and other Chromium browsers:** [Chrome Web Store](https://chromewebstore.google.com/detail/dungeon-extension-v2-resu/keegfhpckdjecndjlgmjnjlfhlnepiga)

### From a GitHub release

Each [release](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/releases) carries unpacked
zips for both browsers, and a signed `.xpi` once that version has been published to AMO.

**Firefox**, using the signed `.xpi`:

1. Download `DExtV2-Resurrect-firefox-<version>.xpi`.
2. Open `about:addons`.
3. Click the gear icon, choose "Install Add-on From File...", and select the `.xpi`.

**Chrome**, loading it unpacked:

1. Download and extract `DExtV2-Resurrect-chrome-<version>.zip`.
2. Open `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the extracted folder.

### Chrome, from the store's signed package

If you would rather install the published build without going through the store listing, you can grab
the signed `.crx` directly. Because it is signed by Google it carries the proof Chrome requires, so it
installs by drag and drop, which a self-packed `.crx` cannot do.

1. Enable "Developer mode" on `chrome://extensions/`.
2. Download the package:

   ```
   https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx3&prodversion=120&x=id%3Dkeegfhpckdjecndjlgmjnjlfhlnepiga%26uc
   ```

3. Drag the downloaded `.crx` onto the `chrome://extensions/` page and confirm.

This always serves whatever version is currently published, which can lag behind the latest GitHub
release while a store review is pending.

## Usage

1. Open any adventure in AI Dungeon.
2. Open the editor, either way works:
   - click the floating **DExtV2R** button sitting on top of the game, which you can drag anywhere;
     hovering it brings up a ring of quick actions: **Sets** (switch, create or import a card set),
     **Stamp** (bind the set to the story you are playing), **AID Sync** and **Settings**, or
   - press **Ctrl+Shift+L** (rebindable in your browser's extension shortcut settings).
3. Bring your cards in: the **Import** tab pulls the story cards straight out of the adventure you have
   open. Or pick an adventure on the **Adventure** tab and add cards by hand.
4. Give each card trigger words, and whatever icons, graphics and audio you want.
5. Play. Triggered words highlight themselves with your visuals and sounds as they appear in the story.

If something looks wrong, **Settings → Support → Diagnostics** will usually tell you what, in one click.

Type **@** in AI Dungeon's action textbox to search the current adventure's story-card names.
Click a suggestion, or choose with the arrow keys and press **Enter** or **Tab**. The full name
replaces the `@...` text without submitting your action; **Escape** dismisses the suggestions.
Names come from the story cards detected through AI Dungeon's API, so no extension import is
required. Under **Settings → Extension → Story Card Autocomplete**, enable or disable suggestions
and choose any combination of **Character, Class, Race, Location, Faction, and Custom** cards.
All types are included by default; Custom also covers user-defined card types.

Enable **Settings > Extension > Visual Novel Mode** to read loaded story passages in a scene
with character portraits and a dialogue box. **Back** and **Next** move through narration and speech;
**Latest passage** jumps to the beginning of the newest loaded passage. **Write action** opens a
composer inside the scene with **Do**, **Say**, **Story**, and **Guide**. These use AI Dungeon's
native mode and submit controls. Your draft is shared with the game's textbox; Enter adds a new
line, and only **Send** submits. **Read story** closes the composer. **Return to game** exposes
AI Dungeon's normal controls, and **Resume visual novel** reopens the scene.
The floating button's **Visual Novel Mode** quick action toggles the same setting directly and
is highlighted while enabled.
**Continue** asks AI Dungeon to continue the story through its native command and keeps your draft
in memory until you next open **Write action**, without reopening the textbox during generation.
Reaching the final loaded paragraph automatically opens **Write action** alongside
the story text. Closing it keeps it closed for that paragraph, including when navigating back.
Submitting closes the composer and pauses automatic reopening until you navigate the story again,
so incoming action and generation updates do not interrupt reading with another composer.

Each paragraph defines a scene with up to four characters, two on each side, matched through
names and story card triggers anywhere in that paragraph. Narration and quoted dialogue still
advance as individual reader lines, but share the same cast, including names after a quote.
At the next paragraph, characters no longer mentioned fade out and new ones fade in. Recurring
characters keep their positions. A paragraph beginning with a third-person pronoun, including
after an opening quote, can retain the previous paragraph's single explicitly mentioned character.
This bridges only one paragraph within the same response. Otherwise, paragraphs with no matching
names or triggers clear the stage;
if more than four match, the first four appear. Back and Next restore each paragraph's scene.
Reduced-motion preferences disable fades. There is no speaker detection or Narrator label.

This is a local reader with no additional AI requests. It reads passages currently loaded by
AI Dungeon, rather than downloading the adventure's entire history.

## Features

### Adventures & Story Cards

- **Import from AI Dungeon**: The **Import** tab reads the story cards of the adventure you are playing
  and brings them over, filtered by type, so you do not rebuild anything by hand
- **Auto-load**: Each imported set is linked to its AI Dungeon adventure and to the scenario it was
  started from, so it loads itself when you play that adventure and every one you start or duplicate
  from the same scenario. Older hand-built sets can be linked retroactively with **Stamp Scenario**
  (or **This adventure only** for a set that belongs to one adventure)
- **Organised by type**: Cards are grouped into collapsible sections, with a search across names and
  trigger words, and per-type filters with counts
- **Story Card Types**: Characters, locations, items, factions, events, and races
- **Trigger Words**: Words or phrases that automatically highlight matching text in the story
- **Import/Export**: Share adventures between devices or with other people as JSON files
- **Import from GitHub**: Add public repos under Settings, then browse and import shared
  adventure/scenario `.json` files straight from the import dialog. Opening the editor or Adventure Picker checks GitHub-imported sets for updates
  (at most once every five minutes). Use **Check for updates now** in the picker to bypass that
  cooldown. An **Update available** badge appears beside newer versions.
  Select the marked set to choose **Merge** (add new cards, keep local cards and edits),
  **Overwrite** (replace all cards), or **Later**. Set names and adventure/scenario bindings stay.
  Imports made before source tracking was added need to be imported from GitHub again to enable
  checks; ordinary file imports are not tracked.

Authors: increase the JSON file's top-level `version` for each content release, for example `1`,
`2`, or `"1.2.0"`, and keep existing card IDs stable. Updates compare numeric version components;
changing file contents without increasing the version does not show a badge. Keep `version` near
the start of the file, before `adventure`, so checks can read only the header. GitHub imports
preserve the version when exported again. Merge keeps the complete local copy of an existing card;
it does not apply upstream edits to that card. Use Overwrite when you want the full upstream set.

### Visual Enhancements

- **Inline Icons**: Small images displayed next to triggered text in the story
- **Tooltips**: Hover over highlighted text to see larger graphics
- **Focus Mode**: Pin a card's graphic to the screen for extended viewing
- **Multiple Media**: Up to 6 icons and 4 graphics per card, with cycling support
- **Trinetra image hosting**: Browse your own uploaded images with an API key and insert them as links,
  which keeps exports small
- **Generate images from a prompt**: With your own OpenRouter or Civitai key, generate a card's icon or
  portrait and either upload it to Trinetra or keep it in the card, compressed
- **Customization Options**:
  - Icon size, roundness, and border thickness
  - Global or per-card custom colors
  - Tooltip dimensions and hide delay
  - Focus container height

### Audio Integration

- **Audio Library**: Upload and manage sound effect files, or paste a Pixabay link
- **Card Audio**: Attach up to 4 audio clips per story card
- **Playback Controls**: Play/pause, skip tracks, and adjust volume
- **Auto-play**: Audio starts when a card enters focus mode
- **Loop Crossfade**: Overlaps each loop so ambient tracks do not audibly cut off at the seam

### Text Formatting

When enabled, the extension parses and renders markdown-style formatting in story text:

| Format        | Syntax                   | Example           |
| ------------- | ------------------------ | ----------------- |
| Bold          | `**text**` or `__text__` | **bold text**     |
| Italic        | `*text*` or `_text_`     | _italic text_     |
| Underline     | `~text~`                 | <u>underlined</u> |
| Strikethrough | `~~text~~`               | ~~strikethrough~~ |

### Settings

- **Interface**: Show or hide the floating editor button, its hover shortcuts, its size, a shortcut to
  toggle it mid-story (Ctrl+Shift+F by default), and reset its position
- **Icons**: Size, roundness, border thickness
- **Text**: Bold highlighting toggle, markdown formatting toggle, default color
- **Tooltips**: Hide delay, max width, max height
- **Focus**: Enable/disable focus mode, max height
- **Audio**: Global volume, loop crossfade, audio library management
- **Scenarios**: Manage public GitHub repos to import shared adventures from
- **Support**: Diagnostics, a one-click report of what is and is not working

## Technology Stack

- **Framework**: [WXT](https://wxt.dev/) + [Svelte 5](https://svelte.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com/)
- **UI Components**: [bits-ui](https://www.bits-ui.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)

Firefox builds target MV2 and Chrome builds target MV3, from the same source.

## Development

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev          # Chrome
npm run dev:firefox  # Firefox

# Build for production
npm run build          # Chrome (MV3) -> .output/chrome-mv3
npm run build:firefox  # Firefox (MV2) -> .output/firefox-mv2

# Type-check
npm run check

# Create distributable zip files
npm run zip
npm run zip:firefox
```

> `wxt build` defaults to Chrome. If you are testing in Firefox, use `build:firefox`, or you will keep
> loading a build that never receives your changes.

### Project Structure

```
src/
├── aid/            # AI Dungeon integration: page-tap bridge, played-adventure tracking, protocol
├── audio/          # Playback manager and focus-mode audio state
├── entrypoints/    # Content scripts, background worker, page-world interceptor
├── media/          # Remote media: Trinetra, Pixabay, GitHub, background fetch
├── rendering/      # DOM injection and mounting, story text parsing
├── shared/         # Config, state, versioning, diagnostics, error capture
├── storage/        # Persistence, adventure and story-card operations
└── ui/
    ├── components/ # Reusable Svelte components
    └── routes/     # The editor and its tabs
```

## Releasing

### GitHub release zips

Pushing a version tag builds the Chrome and Firefox zips and attaches them to a GitHub Release
(see [.github/workflows/release.yml](.github/workflows/release.yml)). The tag must match the `version`
in [package.json](package.json), which is where WXT reads it from; `wxt.config.ts` deliberately does
not carry a version of its own, so `npm version <x>` bumps the manifest in one step.

Write that version's section in [CHANGELOG.md](CHANGELOG.md) before tagging: the workflow uses it as
the release body, and falls back to generated notes if the section is missing.

```bash
npm version 1.4.1 --no-git-tag-version   # updates package.json + lockfile
# commit, then:
git tag v1.4.1
git push --follow-tags
```

### Publishing to Firefox Add-ons (AMO)

Run the **Publish to Firefox (AMO)** workflow by hand from the Actions tab. It needs
`WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` as repository secrets, and it submits the listing metadata
in [amo-metadata.json](amo-metadata.json), which holds the license, category, summary, and this
version's release notes per locale.

Keep those release notes current before publishing. Firefox only fills its "Release Notes" tab when it
applies an update, so notes added after approval can miss everyone who already updated.

To do it locally instead:

```bash
npm run build:firefox
web-ext sign \
  --source-dir=.output/firefox-mv2 \
  --channel=listed \
  --amo-metadata=amo-metadata.json \
  --api-key="$WEB_EXT_API_KEY" \
  --api-secret="$WEB_EXT_API_SECRET"
```

Use `--channel=unlisted` for a self-hosted signed `.xpi` instead of a public listing.

### Publishing to the Chrome Web Store

Pushing a version tag also runs **Publish to Chrome Web Store**
(see [.github/workflows/publish-chrome.yml](.github/workflows/publish-chrome.yml)), which needs
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_KEY`, `GOOGLE_REFRESH_TOKEN` and `GOOGLE_EXT_ID` as repository
secrets. It can also be run by hand to upload a draft without submitting it.

## Privacy

The extension stores all of your data (adventures, story cards, settings, uploaded images) locally in
your browser via `chrome.storage.local`. Nothing is sent anywhere by default.

The only external hosts the extension can reach are declared as named host permissions, and none is
contacted unless you use its optional feature:

- **Trinetra images** (`trinetra.mahesvara.cloud`): images added by URL/ID or through **Browse
  Trinetra** are stored as **links**, which keeps your exports small. The image is requested from
  Trinetra when a card renders, and afterwards comes from your browser's ordinary HTTP cache. Images
  you upload from your own device are stored inline instead (base64, inside the adventure) and are
  never fetched from anywhere. If you use Browse Trinetra, your API key is stored locally (in
  `chrome.storage.local`, unencrypted like all extension data) so you do not have to re-enter it;
  remove it any time with **Sign out**.
- **Image generation** (`openrouter.ai`, `civitai.com`): only if you add your own API key for whichever
  provider you pick. Your prompt and the chosen model are sent to that provider, generations are
  billed to your own account (dollars on OpenRouter, Buzz on Civitai), and the key is stored locally
  (in `chrome.storage.local`, unencrypted like all extension data). A generated image is either
  uploaded to Trinetra or compressed into the card, whichever you pick. Only the provider you have
  configured is ever contacted.
- **Pixabay audio** (`pixabay.com`, `cdn.pixabay.com`): a pasted Pixabay sound-effect page URL is
  fetched once to read its public audio link, and the royalty-free audio is streamed from Pixabay's CDN
  when the clip plays.
- **GitHub scenario import** (`api.github.com`, `raw.githubusercontent.com`): for each public repo you
  add under **Settings → Scenarios**, the extension lists its `.json` files and downloads only the ones
  you choose to import. No credentials are sent and only public repos are supported.
- **Update check** (`api.github.com`): the editor checks this repository's latest release once per
  session so it can tell you when a newer version exists.

The extension reads AI Dungeon's own network traffic in the page to detect your story cards for the
Import tab. It only ever reads, never modifies, and it takes nothing but each card's id, type, name and
trigger words. It does not read or store your account credentials or authentication tokens.

**Diagnostics** (Settings → Support) builds its report on demand and copies it to your clipboard,
nothing is transmitted. The report carries counts and yes/no checks only: never card names, trigger
words, story text, image links, or API keys, so it is safe to paste into a public support thread.

No analytics, tracking, or telemetry are included.

## License

MIT License - see [LICENSE](LICENSE) file for details.

Original work © 2026 Claudia. Resurrected fork © 2026 Oratorian.

---

<div align="center">

**Made with 💙 for the AI Dungeon community**

[Report Bug](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/issues) · [Request Feature](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/issues)

</div>
