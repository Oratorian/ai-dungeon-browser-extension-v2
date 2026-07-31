# Privacy Policy

**Extension:** Dungeon Extension v2 Resurrected
**Last updated:** July 31, 2026

## Summary

This extension stores everything it uses (your adventures, story cards, settings, and the
images and audio you add) locally in your own browser. It does not collect, transmit, sell, or
share your personal data. There are no analytics, no tracking, and no telemetry, and nothing is
sent to the developer.

## What the extension stores (locally only)

All data is saved in your browser with `chrome.storage.local` and never leaves your device
except as described in "Third-party services" below. This includes:

- Your adventures and their story cards (names, trigger words, types, colors, and per-card options).
- The icons, portrait images, and audio clips you attach to story cards. Uploaded and imported
  images are stored inline in your browser.
- Extension settings (icon size, colors, tooltip and focus options, volume, loop crossfade, and
  similar display preferences).
- Your list of GitHub scenario repositories, if you add any.
- Your Trinetra API key, only if you choose to use the "Browse Trinetra" image feature, so you do
  not have to re-enter it.

You can remove all of this at any time by clearing the extension's data or uninstalling it.

## What the extension does NOT do

- It does not collect personal information, browsing history, or usage analytics.
- It contains no tracking, telemetry, advertising, or fingerprinting.
- It does not send your adventures, story cards, settings, or any other data to the developer or
  to any server the developer controls.
- It does not execute remote code. All of the extension's code ships inside the installed package.

## Where the extension runs

The extension's in-page features run only on AI Dungeon (`play.aidungeon.com`,
`beta.aidungeon.com`, `alpha.aidungeon.com`). On those pages it reads the visible story text in
your browser to highlight your trigger words and show your icons, tooltips, and audio. This
reading happens locally, on your device; the story text is not sent anywhere by the extension.

## Third-party services

The extension contacts an external server only when you use an optional feature that requires it,
and only to fetch the content you asked for. As with any web request, contacting these services
reveals your IP address and standard request information to them; their own privacy policies
govern that data.

- **Trinetra image host (`trinetra.mahesvara.cloud`):** contacted when you add a story-card image
  by URL or ID, or browse your Trinetra library. If you use "Browse Trinetra", your Trinetra API
  key is sent to Trinetra to authenticate those requests.
- **Pixabay (`pixabay.com`, `cdn.pixabay.com`):** contacted when you add ambient audio from a
  Pixabay page. The page is read once to find the direct audio link, and the royalty-free audio is
  streamed from Pixabay's CDN. Privacy policy: https://pixabay.com/service/privacy/
- **GitHub (`api.github.com`, `raw.githubusercontent.com`):** contacted when you add a public
  GitHub repository of shared adventures. The extension lists the repository's `.json` files and
  downloads only the ones you choose to import. Privacy statement:
  https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement

No account or login is required for the Pixabay or GitHub features. The Trinetra feature uses only
the API key you choose to provide.

## Data sharing and selling

The extension does not sell, rent, trade, or transfer your data to anyone. The only data leaving
your device is the specific request you initiate to the third-party services listed above.

## Data security and retention

Your data is stored locally by your browser using `chrome.storage.local`. Like all
browser-extension storage, it is not encrypted by the extension, so anyone with access to your
browser profile can read it. The data stays until you delete it or uninstall the extension. The
developer has no access to it and does not retain it.

## Permissions

- `storage` and `unlimitedStorage`: to save your adventures, cards, media, and settings locally
  (unlimited because image- and audio-rich adventures can exceed the default storage quota).
- Host access to the sites listed above: for the in-page features on AI Dungeon and for the
  optional Trinetra, Pixabay, and GitHub features. Each is requested as a specific named host, not
  broad access to all websites.

## Children's privacy

The extension does not collect any data from anyone, including children, and is not directed at
children under the age of digital consent in your jurisdiction.

## Changes to this policy

If this policy changes, the updated version will be published in this file in the extension's
repository with a new "Last updated" date.

## Contact

Questions or concerns? Open an issue at
https://github.com/Oratorian/ai-dungeon-browser-extension-v2/issues

This extension is open source (MIT), so you can review exactly what it does in the repository.
