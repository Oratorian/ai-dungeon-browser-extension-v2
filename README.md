![Extension Icon](public/icon/128.png)

# Dungeon Extension v2

> **⚠️ Development Notice**: This extension is currently in active development. Features, functionality, and documentation are subject to change. Nothing is fixed in stone yet, and breaking changes may occur between updates.

## How to install?

### Chrome

1. Download the latest release from the [Releases](https://github.com/clauds-clauds/ai-dungeon-browser-extension-v2/releases) page.
2. Open your browser's extensions page (e.g., `chrome://extensions/` for Chrome).
3. Enable "Developer mode" (usually found in the top right corner).
4. Click on "Load unpacked" and select the downloaded extension folder.
5. The extension should now be installed and visible in your browser's toolbar.

### Firefox

1. Download the latest release from the [Releases](https://github.com/clauds-clauds/ai-dungeon-browser-extension-v2/releases) page.
2. Open your browser's add-ons page (e.g., `about:addons` for Firefox).
3. Click on the gear icon and select "Install Add-on From File..."
4. Choose the downloaded extension file (unpacked).
5. The extension should now be installed and visible in your browser's toolbar.

## Features

### Story Cards

- Create and manage custom story cards for characters, locations, items, factions, events, and races
- Organize cards by adventure with support for multiple adventures
- Add custom icons and graphics to your story cards
- Set custom colors for text highlighting (global or per-card)
- Configure trigger words to automatically detect and highlight story elements

### Visual Enhancements

- Inline icons displayed directly in story text when triggers are detected
- Hover tooltips showing full-size graphics
- Focus mode to pin graphics and view larger images
- Support for multiple icons and graphics per card with cycling capability
- Customizable icon size, roundness, border thickness, and colors

### Audio Integration

- Audio library for managing sound effects
- Attach multiple audio clips to story cards
- Automatic playback when cards are focused
- Audio controls with play/pause, skip, and volume adjustment
- Support for multiple audio tracks per card

### Markdown Support

- Format text with **bold** (`**` or `__`)
- Format text with _italic_ (`*` or `_`)
- Format text with <u>underline</u> (`~`)
- Format text with ~~strikethrough~~ (`~~`)

### Settings & Customization

- Adjustable tooltip delays and dimensions
- Icon appearance customization (size, roundness, thickness, color)
- Volume controls for audio playback
- Per-adventure configuration support

## Technology Stack

- **Framework**: [WXT](https://wxt.dev/) + [Svelte 5](https://svelte.dev/)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com/)
- **UI Components**: [bits-ui](https://www.bits-ui.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Create distributable zip
npm run zip
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Note**: This extension is designed specifically for use with [AI Dungeon](https://play.aidungeon.com/).
