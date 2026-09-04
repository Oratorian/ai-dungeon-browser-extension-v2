# Changelog

Written to be readable in both places it gets used: GitHub attaches the section for the tag it is
building as the release body, and the same text can be pasted straight into Discord. That means no
tables and no HTML, since Discord renders neither.

Each version is a `## v<version>` heading. The release workflow matches on that exact form, so keep
it, and keep the newest version at the top.

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
