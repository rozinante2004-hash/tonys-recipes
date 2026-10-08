# Chrome Web Store — “My Kitchen Notes — Save recipes from any site”

Everything the Web Store asks for when the extension is published (at go-public,
Tony's decision). Build the package with `node tools/build-extension.mjs live`
→ `dist-extension/my-kitchen-notes-extension.zip`.

## Listing
- **Name:** My Kitchen Notes — Save recipes from any site
- **Category:** Productivity (or Lifestyle → Food & drink)
- **Short description (≤132):** Save recipes from any website, and from Facebook, Instagram and TikTok posts, into My Kitchen Notes in one click.
- **Description:**
  Found a recipe in a Facebook, Instagram or TikTok post or reel? Click “📘 Save recipe to My Kitchen Notes” under it.
  The extension opens the post’s “See more”, takes the post’s own text — never the comments — and opens
  My Kitchen Notes with it, where it becomes a recipe: ingredients, steps, and the post as its source.
  On any other website, the toolbar button (Alt+Shift+S) or the right-click menu sends the recipe: the one the page
  publishes for search engines, or the text you selected. Right-click a link to import that page instead.
  Nothing is read until you click. Nothing is sent to us or to anyone else — the text goes straight to your
  own collection in your browser.
- **Screenshots (1280×800):** a Facebook post with the button under it; the app's import preview.
- **Icon:** `icons/128.png`.

## Single purpose
Send the text of a recipe the user is looking at (a Facebook post, or a selection on any page) to the user’s
My Kitchen Notes recipe collection, at the user’s click.

## Permissions — why each is needed
- **Content script on facebook.com, instagram.com and tiktok.com:** to show the “Save recipe” button under
  posts and, when clicked, read that post’s text. Runs only on those three sites.
- **activeTab + scripting:** the toolbar button, its shortcut and the right-click menu read the recipe on the page
  the user is on, only when the user asks.
- **contextMenus:** the “Save recipe” / “Import this link” entries in the right-click menu.
- **storage (1.7):** one setting, kept in the browser: whether recipes go to My Kitchen Notes or to the family's
  copy of the app (chosen by opening the family's copy, or on the options page). Nothing else is stored.

### 1.7 upload (8 Oct 2026)
The store copy now leads to My Kitchen Notes (the beta); it sends to the family's app only for whoever has opened
that app in the same browser (and for everyone who had 1.6 or earlier — they got it from the family app). Upload
`dist-extension/my-kitchen-notes-extension.zip` (or `downloads/my-kitchen-notes-extension.zip`) as a new version
of the existing item; in **Privacy practices → Permission justification** add the `storage` line above.
- No host permissions beyond those three sites; no remote code; no analytics.

## Data use (the Web Store’s form)
- Collects: **website content** (the text of the post the user chooses), **only on the user’s click**, used only
  to hand it to the user’s own recipe collection. Not sold, not transferred to third parties, not used for
  anything else. The extension makes no network requests of its own.
- Privacy policy URL: https://rozinante2004-hash.github.io/tonys-recipes/privacy-extension.html (generated from
  `extension/PRIVACY.md`, v37.46).

## Before publishing
- A Chrome Web Store developer account (one-time US$5), in the name that will own the public app.
- Point `live` at the public app's address (tools/environments.json / index.html siteOrigin + sitePath).
- The app must understand `#share-text=` (v37.17 and later) — i.e. the family/public app must be on a version
  that has it.
- Facebook changes its page often. The button finds posts by `role="article"` and Facebook's own
  `data-ad-preview="message"` / `data-ad-comet-preview="message"` marks, with a fallback to the post's longest
  text; `tests/extension.mjs` covers these against an imitation page. Check it on the real Facebook before
  each release.

## Other browsers (1.4, app v37.46)
`node tools/build-extension.mjs live` builds both packages:
- **Chrome, Brave, Opera, Vivaldi:** `dist-extension/my-kitchen-notes-extension.zip` → the Chrome Web Store
  (one-time US$5 developer account). Brave and Vivaldi install from the Chrome Web Store as they are.
- **Edge:** the SAME zip → Microsoft Edge Add-ons, through Partner Center (free developer account). The listing
  text, screenshots, privacy URL and permission reasons above all carry over.
- **Firefox:** `dist-extension/my-kitchen-notes-extension-firefox.zip` → addons.mozilla.org (free account). Its
  manifest lists the background scripts (Firefox has no extension service worker) and names the add-on
  (`my-kitchen-notes@rozinante2004-hash.github.io`). Mozilla signs it; an unsigned Firefox extension cannot
  stay installed, so there is no download route for Firefox — only the store.
- **Safari:** needs converting with Xcode on a Mac (`xcrun safari-web-extension-converter`) and the Apple
  Developer Program (US$99/year); it ships as a Mac app. Not built yet.
- **When a store lists it:** put its page address in `APP_CONFIG.extensionStores` (index.html; the test copy's in
  tools/environments.json). The app's 🧩 dialog then shows one “Add to …” button in that browser instead of the
  download and three steps.
