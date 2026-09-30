# Chrome Web Store — “My Kitchen Notes — Save recipes from Facebook”

Everything the Web Store asks for when the extension is published (at go-public,
Tony's decision). Build the package with `node tools/build-extension.mjs live`
→ `dist-extension/my-kitchen-notes-extension.zip`.

## Listing
- **Name:** My Kitchen Notes — Save recipes from Facebook
- **Category:** Productivity (or Lifestyle → Food & drink)
- **Short description (≤132):** Adds a “Save recipe” button under Facebook posts: one click sends the post’s recipe to My Kitchen Notes.
- **Description:**
  Found a recipe in a Facebook post or reel? Click “📘 Save recipe to My Kitchen Notes” under it.
  The extension opens the post’s “See more”, takes the post’s own text — never the comments — and opens
  My Kitchen Notes with it, where it becomes a recipe: ingredients, steps, and the post as its source.
  The toolbar button does the same on any page: select the recipe’s text, or let it take the page’s main text.
  Nothing is read until you click. Nothing is sent to us or to anyone else — the text goes straight to your
  own collection in your browser.
- **Screenshots (1280×800):** a Facebook post with the button under it; the app's import preview.
- **Icon:** `icons/128.png`.

## Single purpose
Send the text of a recipe the user is looking at (a Facebook post, or a selection on any page) to the user’s
My Kitchen Notes recipe collection, at the user’s click.

## Permissions — why each is needed
- **Content script on facebook.com:** to show the “Save recipe” button under posts and, when clicked, read
  that post’s text. Runs only on Facebook.
- **activeTab + scripting:** the toolbar button reads the selected text on the page the user is on, only when
  the user clicks it.
- No host permissions beyond Facebook; no remote code; no analytics.

## Data use (the Web Store’s form)
- Collects: **website content** (the text of the post the user chooses), **only on the user’s click**, used only
  to hand it to the user’s own recipe collection. Not sold, not transferred to third parties, not used for
  anything else. The extension makes no network requests of its own.
- Privacy policy URL: host `extension/PRIVACY.md` as a page on the app’s site (e.g. `…/privacy-extension.html`)
  when publishing.

## Before publishing
- A Chrome Web Store developer account (one-time US$5), in the name that will own the public app.
- Point `live` at the public app's address (tools/environments.json / index.html siteOrigin + sitePath).
- The app must understand `#share-text=` (v37.17 and later) — i.e. the family/public app must be on a version
  that has it.
- Facebook changes its page often. The button finds posts by `role="article"` and Facebook's own
  `data-ad-preview="message"` / `data-ad-comet-preview="message"` marks, with a fallback to the post's longest
  text; `tests/extension.mjs` covers these against an imitation page. Check it on the real Facebook before
  each release.
