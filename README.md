<div align="center">

<img src="public/icon/128.png" alt="Icon"/>
<h1>Dungeon Extension v2 Resurrected</h1>

</div>

A browser extension that enhances your AI Dungeon experience with story cards, visual overlays, audio effects, and text formatting.

> **Resurrected fork.** Originally created by [clauds-clauds](https://github.com/clauds-clauds/ai-dungeon-browser-extension-v2) (MIT). This fork revives the project and keeps it working against AI Dungeon's ongoing site changes, maintained by [Oratorian](https://github.com/Oratorian).

## Installation

### Chrome

1. Download the latest release from the [Releases](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/releases) page.
2. Extract the downloaded zip file.
3. Open `chrome://extensions/` in Chrome.
4. Enable "Developer mode" in the top right corner.
5. Click "Load unpacked" and select the extracted folder.

### Firefox

1. Download the latest release from the [Releases](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/releases) page.
2. Open `about:addons` in Firefox.
3. Click the gear icon and select "Install Add-on From File..."
4. Select the manifest of the downloaded folder.

## Features

### Adventures & Story Cards

- **Adventure Management**: Create, rename, delete, import, and export adventures
- **Story Card Types**: Characters, locations, items, factions, events, and races
- **Trigger Words**: Define words or phrases that automatically highlight matching text in the story
- **Import/Export**: Share adventures between devices or with other users via JSON files

### Visual Enhancements

- **Inline Icons**: Small images displayed next to triggered text in the story
- **Tooltips**: Hover over highlighted text to see larger graphics
- **Focus Mode**: Pin a card's graphic to the screen for extended viewing
- **Multiple Media**: Add up to 6 icons and 4 graphics per card with cycling support
- **Customization Options**:
  - Icon size, roundness, and border thickness
  - Global or per-card custom colors
  - Tooltip dimensions and hide delay
  - Focus container height

### Audio Integration

- **Audio Library**: Upload and manage sound effect files
- **Card Audio**: Attach up to 4 audio clips per story card
- **Playback Controls**: Play/pause, skip tracks, and adjust volume
- **Auto-play**: Audio automatically plays when a card enters focus mode

### Text Formatting

When enabled, the extension parses and renders markdown-style formatting in story text:

| Format        | Syntax                   | Example           |
| ------------- | ------------------------ | ----------------- |
| Bold          | `**text**` or `__text__` | **bold text**     |
| Italic        | `*text*` or `_text_`     | _italic text_     |
| Underline     | `~text~`                 | <u>underlined</u> |
| Strikethrough | `~~text~~`               | ~~strikethrough~~ |

### Settings

- **Icons**: Size, roundness, border thickness
- **Text**: Bold highlighting toggle, markdown formatting toggle, default color
- **Tooltips**: Hide delay, max width, max height
- **Focus**: Enable/disable focus mode, max height
- **Audio**: Global volume control, audio library management

## Usage

1. Open any adventure in AI Dungeon.
2. Enter the in-game menu by clicking on the flamey thing in the top left corner.
3. Click the **Editor** button (wrench icon).
4. Create a new adventure or select an existing one.
5. Add story cards with names, trigger words, icons, graphics, and audio.
6. Play your adventure - triggered words will automatically highlight with your configured visuals and sounds.

## Technology Stack

- **Framework**: [WXT](https://wxt.dev/) + [Svelte 5](https://svelte.dev/)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com/)
- **UI Components**: [bits-ui](https://www.bits-ui.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)

## Development

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Create distributable zip files
npm run zip
```

### Project Structure

```
src/
├── components/     # Reusable Svelte components
├── entrypoints/    # Extension entry points (content script)
├── routes/         # Main UI routes (editor, settings)
└── utils/          # Storage, parsing, DOM manipulation, events
```

## Releasing

### GitHub release zips

Pushing a version tag builds the Chrome and Firefox debug-installable zips and
attaches them to a GitHub Release (see [.github/workflows/release.yml](.github/workflows/release.yml)).
The tag version must match the `version` in `wxt.config.ts`:

```bash
git tag v1.0.9
git push origin v1.0.9
```

### Publishing to Firefox Add-ons (AMO)

Listed submissions require listing metadata that `web-ext sign` reads from a
JSON file (the manifest `license` field alone is not enough). [amo-metadata.json](amo-metadata.json)
holds the license (SPDX slug), category, and summary. Provide your AMO API
credentials via env vars (never commit them) and run:

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

## License

MIT License - see [LICENSE](LICENSE) file for details.

Original work © 2026 Claudia. Resurrected fork © 2026 Oratorian.

---

<div align="center">

**Made with 💙 for the AI Dungeon community**

[Report Bug](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/issues) · [Request Feature](https://github.com/Oratorian/ai-dungeon-browser-extension-v2/issues)

</div>
