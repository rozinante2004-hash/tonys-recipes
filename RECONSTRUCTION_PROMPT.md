# Tony's Recipes Collection — Full Reconstruction Prompt

> **Purpose of this file.** This is a Claude‑Code‑optimized specification for rebuilding
> *Tony's Recipes Collection* from scratch if the source is ever lost. Paste the whole file
> into a fresh Claude Code session and instruct: *"Build this application exactly as
> specified."* It is written to be self‑contained: every file, data shape, external service,
> secret placeholder, and UX behaviour is described so the app can be recreated to parity.
>
> **Golden rule for the rebuild:** the app is a **single, self‑contained `index.html`** (~13,100
> lines) plus a handful of supporting files. No build step, no framework, no bundler, no npm.
> Plain ES5‑flavoured vanilla JavaScript (mostly `var`/`function`, some template literals and
> `async/await`), inline `<style>`, and CDN `<script>` tags. Keep it that way.

---

## 1. What the app is

A **personal/family recipe manager** delivered as an installable **PWA**, hosted free on
**GitHub Pages**, with **Firebase** cloud sync, and a **Cloudflare Worker** that proxies all
third‑party APIs so no secret ever ships in the client. It is bilingual‑aware (English +
Hebrew/RTL, with some Russian filenames) and heavily AI‑assisted via Claude.

**Live URL:** `https://rozinante2004-hash.github.io/tonys-recipes/`
**Repo:** `https://github.com/rozinante2004-hash/tonys-recipes` (public)
**Worker:** `https://lively-bread-273a.rozinante2004.workers.dev`
**Owner/brand:** "Tony Schvekher", email `rozinante2004@gmail.com`.
**Current version:** `v31.0` (see `version.json`, the HTML comment on line 1, `APP_VERSION`, and
the two version badges in the markup — four version strings in `index.html` in all, bumped together).

Design language: warm, editorial. Serif display font **Playfair Display** for titles, sans
**DM Sans** for body. Cream/brown/terracotta/gold palette. Rounded cards, soft shadows,
slide‑up modal animation.

---

## 2. File inventory (recreate all of these)

| File | Purpose |
|---|---|
| `index.html` | The entire app — HTML + CSS + JS in one file. ~16,500 lines. |
| `manifest.json` | PWA manifest. `start_url`/`scope` = `/tonys-recipes/`. Includes a `share_target`. |
| `sw.js` | Service worker. Stale‑while‑revalidate for the document (5.12), cache‑first for assets. |
| `version.json` | `{"version": "v31.0"}` — polled to detect new deployments. Must never be cached. |
| `cloudflare-worker.js` | The API proxy (deployed to Cloudflare, not served to browsers). |
| `bring-relay.html` | Helper page for refreshing the Bring! token. Opens `web.getbring.com` in a **tab** (a popup has no bookmarks bar) and shows the bookmarklet plus a copyable console one-liner. |
| `firestore.rules` | **Canonical** Firestore security rules (5.5). The app fetches this and substitutes `{{READ}}`/`{{WRITE}}`/`{{ADMIN}}` from the member list; edit the structure here, not in `index.html`. Published by hand in the Firebase console. |
| `whatsapp/` | Shared folder of exported WhatsApp chat `.txt`/`.zip` files. The app **lists the folder** over the GitHub contents API (5f.7), so `index.json` is optional and only supplies group labels. `UPLOAD-FROM-IPHONE.md` documents the Share-sheet Shortcut, `upload.html` is the no-Shortcut alternative, `upload-guide.html` is the offline/printable guide (generated — see `tools/`). Everything here needs GitHub to be reachable; where it is not, chats travel through Firestore instead (5f.8). |
| `local-save-helper.py` | Optional localhost (port 27182) helper to save exports with Hebrew/Russian filenames on Linux. |
| `filename-test.html` | Standalone bench for the four non‑ASCII‑filename download routes (2.6). Not part of the app; not linked from it. |
| `setup-save-helper.sh` | One‑shot installer/autostart for the Python helper. |
| `logo.svg` | Brand mark (brown disc, gold ring, fork + terracotta/gold flame). |
| `icons/icon-192.png`, `icons/icon-512.png` | PWA icons. `icon-512.png` also duplicated at repo root. |
| `.github/workflows/deploy.yml` | GitHub Actions → GitHub Pages deploy on push to `main`. |
| `.github/workflows/self-tests.yml` | Runs the Self Test suite headlessly on every push (5.6). Skips `net_*`/`stor_firebase`, and also fails the build on a test that closes the suite or strands a dialog. |
| `tests/run-self-tests.js` | The headless driver for `SELF_TESTS`. Opens `#selfTestOverlay` first — see the note in its header for why that is not optional. |
| `tools/build-upload-guide.js` | Renders `whatsapp/UPLOAD-FROM-IPHONE.md` into `whatsapp/upload-guide.html`, inlining the mock-up SVGs so the one file works offline and prints. Needs `npm i marked@14`. **Never hand-edit the generated HTML.** |
| `tools/build-guide-mockups.py` | Draws `whatsapp/img/*.svg` — diagrams of each Shortcuts action, so the guide can be compared against at a glance. |
| `tools/build-shortcut.py` | Emits `whatsapp/Send-chat-to-Recipes.shortcut` (an Apple plist) so the 33-step Shortcut can be installed instead of built. The token in it is the placeholder `PASTE-YOUR-GITHUB-TOKEN-HERE`; the builder asserts no real token string reaches the file. Untested on a real device — Apple's format is undocumented. |

### 2.1 `.github/workflows/deploy.yml`
Standard GitHub Pages deploy: triggers on push to `main` and `workflow_dispatch`;
permissions `contents: read`, `pages: write`, `id-token: write`; concurrency group `pages`;
uses `actions/checkout@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`
(path `.`), `actions/deploy-pages@v4`.

### 2.2 `manifest.json`
```json
{
  "_version": "v2.0",
  "name": "Tony's Recipes Collection",
  "short_name": "Tony's Recipes",
  "start_url": "/tonys-recipes/",
  "scope": "/tonys-recipes/",
  "display": "standalone",
  "theme_color": "#5C3D2E",
  "background_color": "#FAF7F2",
  "icons": [
    {"src": "/tonys-recipes/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/tonys-recipes/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ],
  "share_target": {
    "action": "/tonys-recipes/",
    "method": "GET",
    "params": {"title": "title", "text": "text", "url": "url"},
    "enctype": "application/x-www-form-urlencoded"
  }
}
```
The `share_target` lets Android/iOS "Share to app" send a URL/text; the app reads
`?url=&text=&title=` on load and opens the URL‑import modal (`handleShareTarget()`).

### 2.3 `sw.js` (service worker, "v4", `CACHE_NAME = 'tonys-recipes-v7'`)
- On `install`: `skipWaiting()` + pre‑cache core files
  (`/tonys-recipes/`, `index.html`, `manifest.json`, both icons).
- On `activate`: `clients.claim()` + delete any cache whose name ≠ `CACHE_NAME`.
- On `fetch`: ignore requests whose URL doesn't include `/tonys-recipes/`.
  `version.json` → always `fetch` with `cache: 'no-store'`. The document (HTML) →
  **stale‑while‑revalidate** (5.12): serve the cached copy immediately, refresh the cache in
  the background. Safe only because the in‑app version banner tells the user when a newer
  version has landed. Other assets → **cache‑first**, then network.
- Listens for `postMessage({type:'SKIP_WAITING'})` and calls `skipWaiting()`.

---

## 3. External services & secrets (all proxied through the Worker)

| Service | Role | Where the secret lives |
|---|---|---|
| **Anthropic Claude API** | All AI (import/extract, translate, suggest, explore, nutrition, help, diet auto‑tag) | Worker secret `ANTHROPIC_API_KEY` |
| **Firebase** (Auth + Firestore) | Google sign‑in + shared cloud recipe doc | Public web config (safe to ship) |
| **Cloudflare Worker** | Single POST endpoint proxying everything | The Worker itself |
| **Openverse** | Food photo search — **first source, and needs NO key**, so it cannot be knocked out when the shared key hits its rate limit. Federates Flickr, Wikimedia, NASA and museum collections. | none |
| **Pixabay / Pexels / Unsplash** | Food photo search / auto‑fetch (app cycles sources via "See more") | Worker secrets `PIXABAY_API_KEY`, `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY` (any subset; unset sources are skipped) |
| **YouTube Data API** | Fetch video description for recipe extraction | Worker secret `YOUTUBE_API_KEY` |
| **Bring!** | Push ingredients to a shopping list | Worker KV `BRING_KV` (key `accessToken`), else env `BRING_TOKEN`; plus env `BRING_API_KEY`, `BRING_LIST_UUID`, `BRING_USER_UUID` — **no Bring! values in source** |
| **GitHub Pages** | Hosting | n/a |

> **SECURITY — never put secrets in this file.** Worker v30 removed the previously hard-coded
> Bring! bearer token, `X-BRING-API-KEY` and UUIDs; they now come from Worker env/KV only, so
> `cloudflare-worker.js` is safe to commit. The old token is still in git history — it always will
> be — but it **was rotated on 1 Aug 2026**, so the leaked value is dead. The Firebase web config
> below is *designed* to be public and is fine to ship.

**Firebase web config (public, safe to embed):**
```js
{
  apiKey:            "AIzaSyCZ6nFqUgUYP48fx7ngFbgym95Gy5bsfd4",
  authDomain:        "recipes-f379d.firebaseapp.com",
  projectId:         "recipes-f379d",
  storageBucket:     "recipes-f379d.firebasestorage.app",
  messagingSenderId: "313792199018",
  appId:             "1:313792199018:web:9e5fe1df28b94bb031cd13"
}
```

---

## 4. `cloudflare-worker.js` — the API proxy

> ⚠️ **The repo copy of this file can lag the LIVE deployment.** The Worker is edited/deployed
> directly in the Cloudflare dashboard, so the version in git may be behind what's actually
> running (e.g. the repo held v22 while production was v29). Before changing the Worker, always
> start from the **currently‑deployed** code (export/paste it), apply the change onto that, and
> bump the `// … Worker vNN` header — never assume the repo copy is current. Live‑only additions
> to watch for: the **GET file‑download handler** + **`download-store`** action (KV one‑time
> download links), and the **`instagram-fetch`** action.
>
> **Current repo version: v33.** v32 rebuilt `instagram-fetch` on Meta's tokenless oEmbed; v33
> added the keyless **Openverse** photo source and made `photo-search` report a 429 as a rate
> limit instead of "invalid JSON". A provider that rate-limits answers with a plain-text notice,
> so `JSON.parse` throws and the naive catch blames JSON parsing — hiding the only fact that
> matters, which is that waiting fixes it. `photoFail(source, name, resp, raw)` handles that
> centrally and passes `retryAfter` back.
>
> **`photo-search` returns per-image `license` and `sourceLabel`.** Openverse serves Creative
> Commons work where CC-BY makes attribution a licence *condition*, so the app stores
> `r.photoCredit` and renders it — a picker that shows credit and then discards it on apply
> puts every recipe using one in breach.

A single ES‑module Worker (`export default { async fetch(request, env) }`). Handles CORS
(allow `*`, methods `POST, OPTIONS`), rejects non‑POST with 405, parses a JSON body, and
dispatches on `body.action`. If **no** `action` is present, the body is forwarded verbatim to
the **Anthropic Messages API** (this is the AI path).

**Constants / env used:**
- Bring: `BRING_LIST_UUID`, `BRING_USER_UUID`, `BRING_API_V2 = 'https://api.getbring.com/rest/v2'`,
  `BRING_HEADERS` (`X-BRING-CLIENT: WebApp`, `X-BRING-CLIENT-SOURCE: webApp`,
  `X-BRING-COUNTRY: IL`, `X-BRING-API-KEY: <secret>`, `Origin`/`Referer: web.getbring.com`).
- `getToken(env)` reads `env.BRING_KV.get('accessToken')`, else `env.BRING_TOKEN` (no hard-coded fallback). `bringHeaders(env)` builds the Bring! headers from env; missing config returns a clear `BRING_CONFIG` 503 rather than a confusing 401.
- Env secrets: `ANTHROPIC_API_KEY`, `PIXABAY_API_KEY`, `YOUTUBE_API_KEY`, KV binding `BRING_KV`.

**Actions:**
1. **`fetch-url`** `{url}` — if URL is YouTube (`extractYouTubeId` matches `watch?v=`,
   `youtu.be/`, `shorts/`), call YouTube Data API v3 (`videos?part=snippet`) and return
   `{text: "Title:… Channel:… Description:…", isYouTube, title, videoId}` — with rich error
   objects for `quotaExceeded`/`keyInvalid`. Otherwise fetch the page with a browser‑ish
   User‑Agent, strip `<script|style|nav|header|footer|aside>` and all tags, decode a few
   entities, collapse whitespace, `slice(0,10000)`, return `{text}`.
2. **`bring-add`** `{items:[{name,spec}], listUuid?}` — PUT each item to
   `/bringlists/{uuid}` as form‑encoded `purchase`/`specification`. On any `401` return
   `{success:false, tokenExpired:true}` (status 401). Else `{success, results, listUuid}`.
3. **`bring-lists`** — GET `/bringlists/{BRING_USER_UUID}`; return `{status, ok, lists:[{name,uuid}]}`.
4. **`bring-settoken`** `{token, secret}` — require `secret === env.BRING_SETTOKEN_SECRET` with
   **NO fallback default** (the old hard-coded one was committed in a public repo, so it was no
   secret at all; unset must mean the endpoint is CLOSED). Validate
   the JWT has 3 segments, store in `BRING_KV` under `accessToken`.
5. **`photo-search`** `{query, source?, page?}` — multi‑source (`source` = `pixabay` |
   `pexels` | `unsplash`, default `pixabay`; 9 per page). Pixabay
   `?image_type=photo&per_page=9&safesearch=true&order=popular`; Pexels `/v1/search`
   (Authorization: key); Unsplash `/search/photos` (Authorization: `Client-ID key`,
   `content_filter=high`). A source with no key returns `{notConfigured:true}`; per‑source
   failures return HTTP 200 with an `{error}` field so one bad source never breaks the others.
   The app cycles sources via a **"See more"** button (`PHOTO_SOURCES`/`photoSearchMore`).
   Each source returns `{source, page, images:[{url,thumb,credit,creditUrl}], total}`.
6. **(default, no action)** — forward the whole body to
   `https://api.anthropic.com/v1/messages` with headers `x-api-key: env.ANTHROPIC_API_KEY`,
   `anthropic-version: 2023-06-01`; return the JSON response with `Access-Control-Allow-Origin: *`.
7. **`instagram-fetch`** `{shortcode}` — Meta made oEmbed **tokenless again on 15 Jun 2026**, so
   this calls `graph.facebook.com/v23.0/instagram_oembed` with no token. oEmbed returns the embed
   HTML, author and thumbnail — **not reliably the caption**, which is where the recipe is; a
   caption fragment is mined out of the `<blockquote>` when present. Returns
   `{title, author, text, thumbnail, partial}` where `partial: true` means what came back is too
   short to be a recipe, so the app must not feed it to Claude. 404 when nothing usable, never 500.

**Client‑side AI contract:** `aiCall(prompt, maxTokens=2000, tools=null)` POSTs
`{model:'claude-sonnet-4-5-20250929', max_tokens, messages:[{role:'user', content:prompt}], tools?}`
to the Worker, retries up to 4× with exponential backoff on `429/529`, maps `402/billing_error`
→ friendly "credits exhausted" error, `403/permission_error` → "API key invalid", and returns
the concatenated `content[].text`. (Some self‑tests reference model id `claude-sonnet-4-6`; the
production `aiCall` uses `claude-sonnet-4-5-20250929`. Keep the Worker model‑agnostic — it
forwards whatever the client sends.)

---

## 4a. Security invariants (a rebuild WILL reintroduce these unless told)

Every one of these was a real defect found in the v31.0 audit, in shipped code that looked fine.

**A recipe is untrusted input.** It arrives from AI extraction, a restored backup file, a shared
URL, or another family member with write access. Treat every field as hostile in every renderer.

1. **Escape before interpolating, never after.** `escH()` for text (null-safe, `\n` → `<br>`),
   `escA()` for attribute values (also escapes both quote characters, never emits `<br>`).
   `hlMatch`, `aiFailPane`, `buildRecipePage`, `rHtml` and `buildPrintHtml` all have tests
   pinning this. The audit found `rHtml` putting `r.name` straight into `alt="…"`, plus `photo`,
   `bg`, `emoji`, diet tags and the meta row — a recipe named `" onerror="…` was script execution.
2. **`safeUrl()` for anything reaching `href` or `src`.** Escaping does not stop `javascript:` —
   the quotes are never broken, the scheme *is* the payload. Allow only `http:`, `https:`,
   `mailto:` and `data:image/`; return `''` for any other scheme so the link is inert. Strip
   control characters first, because `java\tscript:` is a real bypass.
3. **The email preview iframe carries `sandbox=""`.** It is a static preview and needs no
   scripts, forms or navigation. The empty sandbox also denies it this origin, so a future
   escaping slip cannot reach localStorage or the Firebase session. **Never** add `allow-scripts`
   or `allow-same-origin`.
4. **Untrusted HTML *files* are parsed with `DOMParser`** (inert), never assigned to `innerHTML`.
5. **No secrets in the client.** Every third-party key lives in Worker env/KV. The Firebase web
   config is public by design and is the only credential that ships.

---

## 4b. Honesty invariants (the app's defining quality)

Tony judges this app on whether it tells the truth. Each of these was a real bug where the UI
asserted something that had not happened.

- **Never claim an action succeeded without verifying it.** A clipboard write can be refused; a
  `document.execCommand('copy')` returns a boolean; a share can be cancelled. Handle the rejection
  and show the text to copy by hand rather than announcing success.
- **The Family Access list is not the permission.** The rules embed member addresses literally and
  are published **by hand** in the Firebase console, so adding or removing a member changes
  nothing until they are republished. Word those messages as "on the list — not granted yet" and,
  for removal, "they KEEP their access until you publish the rules". The removal direction is the
  dangerous one: it reads as a revocation that has not occurred.
- **The version badge must state what is RUNNING**, never what the server has. Showing
  `serverVersion` made a device on an old build look current and turned three separate stale-cache
  incidents into hunts for bugs that did not exist. Record `tonys_last_version` only once
  `APP_VERSION === serverVersion`, or the update banner shows once and then goes quiet forever.
- **"Update Now" must clear the caches before reloading**, guarded on `navigator.onLine`. With no
  *waiting* service worker — the usual case, since `sw.js` rarely changes — a plain reload is
  answered from the stale-while-revalidate cache and the button does nothing visible.
- **A failure that is refused must be reported, not swallowed.** Deletion is admin-only, so a
  write-role member's recipe and photo deletions fail; `flushCloudDeletes` and `syncCloudPhotos`
  must keep the record and surface it in Sync Health rather than forgetting a document they failed
  to remove.
- **Distinguish "nothing there" from "the read failed."** Treating a failed cloud read as absence
  is what made a transient network blip permanently lose a photo (§5a).
- **A dead end with no way forward is a bug.** Every AI failure pane offers paste / open / bookmark.

---

## 4c. Destructive actions must confirm first

- **Restore replaces the entire collection AND pushes it to every other device.** It must parse
  and validate the file, *then* ask — stating the counts, that it is not a merge, that there is no
  undo, and whether other devices are affected — and only then apply. It shipped for months with
  no confirmation at all.
- A cloud failure *after* a successful local restore is its own outcome, not a failed restore.
- Never read a backup field unguarded during the apply. `backup.exportedAt.slice(0,10)` threw
  after the collection had already been replaced and synced, then reported "Restore failed" for a
  restore that had in fact succeeded destructively.
- `Math.max.apply(null, ids)` returns `-Infinity` for an empty list and can overflow the argument
  limit on a large one. Use `reduce`.
- Deleting a synced WhatsApp chat removes it for everybody, so it asks; deleting recipes offers
  undo.

---

## 5. Data model

**localStorage keys:**
- `tonys_recipes_v1` → JSON array of recipe objects (`STORAGE_KEY`) — **photo‑free** when
  IndexedDB is available (see local photo storage below); each recipe carries `_ph`/`_po` flags
  marking that a photo/originalPhoto lives elsewhere. **`_ph` is the single name for this, local
  and cloud alike** (5.8) — the cloud used to spell it `hp`, which made every photo bug read
  twice as hard. Reads still accept `hp` for documents written by older versions; writes never
  emit it
- `tonys_nextId_v1` → the next integer id (`NEXTID_KEY`)
- `recent_views` → array of recently viewed recipe ids (max 8, most‑recent first)
- `scale_<id>` → remembered serving multiplier per recipe
- `tonys_view_mode` → `'grid'` | `'list'` — remembered grid/list toggle (phones default to `grid`)
- `tonys_mobile_cols` → `1`–`5`, recipe cubes per row on phone‑width screens (Settings → Grid Layout; default `3`, drives the `--mobile-cols` CSS variable)
- `tonys_offline_queue` → `'1'` when there are unsynced offline edits
- `tonys_access_members` → family access list (also mirrored to Firestore `shared/access`)
- `bring_token_expiry` → unix seconds when the Bring token expires. **A cache, never the
  authority** — see §11; the token lives in the Worker's KV and is shared by all devices, so this
  per-device copy goes stale the moment the token is refreshed anywhere else
- `pwa_install_dismissed`, `pwa_install_dismissed_ios` → PWA banner dismissal
- `tonys_gmail_client_id` → user‑supplied Google OAuth client id for Gmail send
- `tonys_debug_mode` → `'1'`/`'0'` — Debug mode (⚙️ Settings → Debug mode, off by default); all debug tracing goes through `dlog()`, silent unless enabled
- `tonys_ai_cache` → AI response cache (5.7): `{ <key>: {v, at} }`, keyed on a digest of
  model + max_tokens + prompt. 7-day TTL, 40 entries, oldest evicted first. Tool-using calls and
  failed calls are never cached. On a quota error the **cache** is dropped, never the recipes
- `tonys_theme` → `'light'` | `'dark'` | `'auto'` — ⚙️ Settings → Theme. `applyTheme()` stamps
  `data-theme` on `<html>`; `auto` follows `prefers-color-scheme` and re-applies live on change
- `tonys_wa_base` → base URL of the shared WhatsApp export folder (default the repo's
  `whatsapp/`); `tonys_wa_index` → small JSON index of loaded chats (`{id, group, source, file,
  slug, parts, size, count, first, last, updatedAt}`) — the chat **text** never goes in
  localStorage; since 5f.8 it MAY go to Firestore, in its own documents (§11c)
- `tonys_wa_cloud_sync` → `'1'`/`'0'` — whether an imported chat is also synced to the cloud
- `tonys_photo_probed` → recipe ids already checked for a cloud photo and found genuinely
  photoless, so `repairMissingPhotos` costs reads once per recipe rather than on every load
- `tonys_last_version` → the version this device is actually RUNNING. Written only once
  `APP_VERSION === serverVersion`; writing the server's value on sight made the update banner
  appear exactly once and then go quiet forever on a stale device

> **One flag per idea.** `isClip` is the only clip/video marker (2.3); `normalizeRecipe` folds a
> legacy `isVideoBookmark` into it and deletes the old field. The edit form's ingredient table is
> the ingredient data (2.2) — `readIngsTable()` reads the rows; there is no hidden textarea
> mirroring it, and no "amount — name" flatten/reparse step to mangle names containing dashes.

> **Dialogs.** `askConfirm()` / `askPrompt()` (promise-based, styled) replace `confirm()`/`prompt()`
> everywhere. The single remaining native `confirm()` is the fallback inside `showUnsavedChanges()`
> for when the modal element is missing — without it a dirty edit form could not be closed at all.

**Recipe object shape:**
```js
{
  id: Number,                 // unique, from nextId++
  name: String,               // may be Hebrew (RTL auto-detected)
  emoji: String,              // fallback tile glyph when no photo
  photo: String,              // '' or a data: URL (compressed) 
  originalPhoto: String,      // '' or a data: URL — full-res backup of a scanned photo
  source: String,             // URL, "AI generated", or ''
  category: String,           // one of CATS
  difficulty: 'Easy'|'Medium'|'Hard',
  prep: String,               // e.g. '25 min' or '—'
  servings: String,           // e.g. '4' or '—'
  bg: String,                 // pastel hex from BGS, used behind emoji tiles
  fav: Boolean,
  ingredients: [{ a: String, n: String }],  // a=amount, n=name
  steps: [String],
  diets: [String],            // subset of DIETS
  notes: String,
  nutrition: null | { calories, protein, carbs, fat },  // per 100g
  cookCount: Number,          // times "Cooked!" tapped
  lastCooked: Number,         // ms timestamp
  cookLog: [{ id, at, rating, note }],  // 3.5 — one entry per cook, capped at 50
  history: [{...}],           // 3.4 — last 3 revisions. Travels in recipe_<id> (5.4), never in the legacy doc
  isClip: Boolean,            // "clip"/bookmark (no full recipe). The ONLY clip flag (2.3)
  photoCredit: null | { name, url, license, source },  // v30.3 — REQUIRED for Openverse
                              // photos: CC-BY makes attribution a licence condition, not a
                              // courtesy. Rendered under the hero by photoCreditHtml().
  updatedAt: Number           // ms timestamp — used for offline-merge conflict resolution
}
```

**`normalizeRecipe(r)` (required — not optional hardening):** render code reads
`r.difficulty.toLowerCase()`, `r.ingredients.some(...)`, `r.steps.map(...)` etc. **without guards**,
so a single malformed recipe throws and blanks the ENTIRE grid. `normalizeRecipe` coerces one
recipe into the assumed shape — backfilling name/emoji/category/difficulty/prep/servings/bg/fav,
forcing `ingredients` to `[{a:String,n:String}]` (AI imports sometimes return plain strings like
`"200g flour"`, which it splits into `{a,n}`), forcing `steps` to non‑empty strings, and setting
`updatedAt` (a fresh import without it would lose every cloud‑merge tie‑break). Apply it in
`migrateRecipes` (every load/restore/remote‑update) **and** on every import path
(`confirmImportParsed`, `addSuggestion`, import previews). `renderGrid`'s search/sort are ALSO
written defensively, so bad data degrades instead of crashing.

**Constants (in the DATA section):**
```js
const EMOJIS = ['🍝','🍕','🥗','🍛','🥘','🍲','🥩','🍗','🐟','🥚','🍜','🫕','🥞','🍰','🎂','🫙','🥦','🥑','🫔','🌮','🍣','🍤','🥨','🧆','🫛'];
const CATS   = ['Breakfast','Lunch','Dinner','Snack','Dessert','Soup'];
const DIETS  = ['Keto','Carnivore','Vegetarian','Vegan','Omnivore'];
const BGS    = ['#FFF0E8','#EAF5E9','#E8F0FF','#FFF8E8','#F5E8FF','#E8FFF5','#FFE8F0','#F0F8FF'];
```
Ship with **5 seed recipes** (Spaghetti Carbonara, Greek Salad, Chicken Tikka Masala, Avocado
Toast, Chocolate Lava Cake) so a fresh install isn't empty; `nextId` starts at `10`. Auto‑login
logic only pushes local recipes to the cloud if the user has **more than 5** (i.e. beyond seeds).

**`migrateRecipes(list)`** — drops non‑objects and maps `normalizeRecipe` over the rest, which is
what backfills the missing fields (`diets=[]`, `cookCount=0`, `notes=''`, `source=''`,
`nutrition=null`, `originalPhoto=''`, `updatedAt=0`, `history`/`cookLog` sanitised and capped) and
folds a legacy `isVideoBookmark` into `isClip` before deleting it. Run on every
load/restore/remote‑update.

**Firestore layout (5.4, v28.0):** one document per recipe.

| Document | Contents |
|---|---|
| `shared/recipe_<id>` | `{ r: <JSON of one photo‑free recipe>, updatedAt, id }`. Carries `history`. |
| `shared/meta` | `{ nextId, ids: [...], schema: 2, updatedAt }` |
| `shared/photo_<id>` | `{ photo: <base64>, updatedAt }` — unchanged, photos were already split |
| `shared/access` | `{ members, updatedAt }` |

Legacy `users/{uid}/…` rules kept for safety.

**Why per‑recipe:** the single document was overwritten whole by every save, so two people
editing inside the same window meant the second save replaced the first person's work
silently. It also capped the collection at ~610 recipes and re‑uploaded everything to record
one favourite.

**Reading:** `shared/meta` first, then the per‑recipe documents — **unconditionally**. Build
this the simple way: there is one layout and `schema` is a label on it, not a branch. (A
migration from a pre‑v28 single document existed through v32.1 and made the read conditional
on `meta.schema >= 2`; that document has since been deleted and the branch with it. Reading
unconditionally is also the safer failure mode — a `meta` with a missing or stale `schema`
loads the collection instead of reporting an empty cloud.)

The documents are fetched with a `documentId()` range query over `['recipe_', 'recipe` ')` —
the upper bound is `'_' + 1`, which excludes every other document sharing the collection
(`meta`, `access`, `photo_*`, `chat*`) — falling back to fetching `meta.ids` one at a time if
the range query is unavailable.

**Writing:** only recipes whose serialised form changed (`cloudDirtyIds`). Each write is a
transaction that compares the cloud document's `updatedAt` against the base we last read
(`cloudWriteAllowed`) and **refuses** if another device wrote in between, telling the user
plainly. Deliberately not a field‑by‑field merge: a wrong silent merge is worse than an
honest refusal. `nextId` is merged upward, never lowered, or two devices mint the same id.

**Deleting:** propagated **explicitly** (`queueCloudDelete`, persisted in
`tonys_cloud_deletes`, flushed by `flushCloudDeletes`), never inferred by diffing the cloud
against memory — a partial read would otherwise look exactly like a mass deletion. Undo takes
the id back off the queue. Deleting removes `recipe_<id>` *and* `photo_<id>`.

**Change notification:** one `onSnapshot` listener, on `shared/meta`, which every save
touches. The snapshot does **not** carry the recipes — with per‑recipe documents the only
honest way to apply an update is to re‑read, so `applyRemoteUpdate()` calls
`loadFromFirestore()`. Keep the subscribe/unsubscribe list shape even with a single listener:
it is what guarantees nothing is left dangling across a re‑sign‑in.

**A note on retiring a storage layout**, because this app got it right and it is worth
copying. Moving off the old single document took **four** releases, never fewer: v28.0 wrote
both layouts; v28.1 stopped writing the old one but still *read* it each load, so a device on
the previous version could not lose edits; the document was then deleted by hand in the
console once every device had moved; and only *then* did v32.2 delete the reading code. Do
not collapse those steps. The cost of the slow version is one wasted read per load; the cost
of the fast version is somebody's recipes.

**Photo display (`photoSrc`)**: stored photos are base64 data URLs (needed for backup/export/
sync), but rendering them inline makes every grid render build multi‑MB markup. `photoSrc(r)`
converts each photo to a **cached `blob:` URL** for display only (revoked when the photo changes;
`prunePhotoUrlCache()` releases URLs for deleted recipes). Exports/backup/sync must keep using the
original data URL — a `blob:` URL is dead outside the page.

**Cloud photo storage (critical — Firestore's 1 MiB/doc limit):** photos are base64 and must
NOT live inline in a recipe's document, or a single photo blows the 1 MiB limit and that recipe
can never be saved again. Instead `saveToFirestore` writes each recipe through
`slimRecipeForCloud` — the **one and only** cloud shape: `photo` blanked, `_ph:1` set when a
photo exists elsewhere, `originalPhoto` omitted entirely, `history` kept. Give this function a
single parameter. It briefly had a `keepHistory` flag so the old single document could get a
history‑free copy, and a second shape that silently drops a field is exactly the kind of thing
that is called by accident. Then `syncCloudPhotos` writes each recipe's display photo to
its **own** doc `shared/photo_<id>` = `{ photo:<base64>, updatedAt }` (only when changed; deletes
docs for removed/deleted photos). These per‑photo docs sit in the `shared` collection so the
existing `match /shared/{document=**}` rule already permits them — no rules change needed.
`loadFromFirestore`/`applyRemoteUpdate` re‑attach photos via `attachCloudPhotos` (fetch
`shared/photo_<id>` for `_ph` recipes — reads also accept the pre‑5.8 spelling `hp`, writes never
emit it; legacy inline photos are kept and migrated on next save).
Photos remain inline in memory + localStorage, so rendering/backup/export are unchanged.
**`originalPhoto` (the full‑res scan backup, potentially many MB) is never synced — local‑only**;
it is captured before a cloud load and re‑attached afterward so a load doesn't drop it.
Save errors are classified honestly (`handleFirestoreSaveError`/`isSizeError`): size vs.
`permission-denied` vs. quota vs. genuine `unavailable`/offline — only real network errors get the
auto‑retry; oversized photos are named and skipped while the rest sync.

**Photo‑loss safety net (`loadFromFirestore`/`applyRemoteUpdate`):** a normal cloud load fully
replaces the in‑memory `recipes` array, so if a photo never made it to the cloud (e.g. an old save
failed before this fix existed, or another device hasn't synced yet), a plain load would silently
erase it locally too. Both functions snapshot local photos (`id → {photo, updatedAt}`) *before*
overwriting `recipes`; afterward, any incoming recipe with no photo whose local `updatedAt` is
**not older** than the incoming one gets its local photo restored (and the recovery is pushed back
to Firestore so other devices pick it up). Only a cloud copy that is **strictly newer** and
genuinely has no photo is treated as an intentional deletion and left alone. A toast reports how
many photos were recovered.

**Local photo storage (IndexedDB — same reasoning as the cloud, for `localStorage`'s ~5 MB cap):**
`localStorage` stores strings as UTF‑16, so inline base64 photos overflow it fast and saves then
fail silently. Photos are therefore kept in **IndexedDB** (`db tonys_recipes_db`, store `photos`,
keyed by recipe id, `{ id, photo, originalPhoto }`), while `localStorage` holds only photo‑free
recipe text (`saveLocal` → `stripPhotosLocal`, setting `_ph`/`_po` flags). `savePhotosToIDB`
writes only changed photos and prunes deleted ones; `loadLocal` renders text immediately and
`hydratePhotosFromIDB` re‑attaches photos asynchronously, then re‑renders. Photos stay inline in
the in‑memory `recipes` array (so rendering/backup/export are unchanged). Legacy inline‑in‑
**Thumbnails (5.3):** each recipe also gets a ~320 px JPEG thumbnail, generated once by
`makeThumbBlob()` and stored in the same IDB row as a real **Blob** (5.2) — no base64 in that
path at all. The grid renders `thumbSrc(r)`, which returns the thumbnail's object URL, falls back
to the full photo until one exists, and re-renders once (debounced) when a batch lands. Changing
a photo drops the old thumbnail; deleting a recipe revokes its object URL. Measured on a
photo-like 1600×1200 image: 252 KB → 10.8 KB, and a 12-tile re-render 288 ms → 1 ms.
**Full photos deliberately remain base64** in memory and in IDB, because export, backup, cloud
sync, email and print all consume data URLs.

`localStorage` photos are detected on load and migrated to IndexedDB on the next save. If
IndexedDB is unavailable (e.g. private mode) it falls back to the old inline‑in‑`localStorage`
behaviour. The `_ph`/`_po` flags also guard the cloud path so a not‑yet‑hydrated recipe never
wipes its cloud photo.

---

## 5a. Photo storage, and the flag that makes it recoverable

Photos are the app's largest data and its most fragile path. Three stores are involved:

| Where | What | Why |
|---|---|---|
| `localStorage` | recipes **without** photos, each carrying `_ph` / `_po` | photo-free text is tiny and never hits quota |
| IndexedDB (`tonys_recipes_db`, store `photos`) | `{id, photo, originalPhoto, thumb}` | the device's copy; `thumb` is a Blob, the rest data URLs |
| Firestore `shared/photo_<id>` | `{photo, updatedAt}` | the copy every device can reach |

**`_ph` / `_po` are the ONLY record that a photo exists somewhere else.** Clear one when the photo
did not actually arrive and that photo is lost on that device *permanently* — `attachCloudPhotos`
will skip the recipe forever, and no reload, restart or re-sync recovers it. This is not
hypothetical: Chrome evicts IndexedDB under storage pressure (localStorage, being tiny, survives),
and every photo vanished on one Android phone while two other devices were fine.

Rules that follow from that:

- Clear the flag **only** when the photo actually arrived, or when the cloud states there is
  genuinely no photo document. A **failed read is neither** — keep the flag and try again.
- Clearing on a failed read also arms the delete branch in `syncCloudPhotos`, which would remove
  the photo for *every* device.
- `repairMissingPhotos()` rescues a device whose flags were already cleared by an older build —
  the only route back for one that has gone wrong. Bound it (60 reads per run) and remember which
  recipes are genuinely photoless in `tonys_photo_probed`, because photoless recipes are normal
  (there is a "No photo" filter for them) and re-probing every load would cost reads forever.
- Blob URL hygiene: `photoSrc` keys its cache on a content signature and revokes the previous URL
  when a photo changes; `prunePhotoUrlCache` releases URLs for deleted recipes;
  `savePhotosToIDB` calls `releaseThumb` when a photo changes so the grid cannot show a stale
  thumbnail.
- **Full photos stay base64.** Export, backup, cloud sync, email and print all consume data URLs.
  Only thumbnails are Blobs.

---

## 6. Firebase auth & sync behaviour (subtle — match carefully)

- Firebase **compat** SDK v10.12.0 loaded from `gstatic.com` (app + auth + firestore), plus
  Google Identity Services (`accounts.google.com/gsi/client`). Init on `DOMContentLoaded` with a
  retry loop (up to 30×500ms) in case the SDK is slow/offline; a `loadFirebaseDynamically()`
  path re‑loads it on demand at sign‑in.
- Auth persistence = `LOCAL`; Firestore `enablePersistence({synchronizeTabs:true})`.
- Provider = Google, **with Gmail send scope** (`https://www.googleapis.com/auth/gmail.send`) so
  the app can send recipe emails via the Gmail API.
- `onAuthStateChanged`: on auto‑login (not a fresh click) show an "auto‑login" notice and wait
  ~3s before syncing (gives the user a chance to cancel); on explicit sign‑in, sync immediately.
  Then `loadFromFirestore()`, render, and set drive status to `☁️ Shared · <name/email>`.
- **`loadFromFirestore()`**: one‑time `get()`, then an `onSnapshot` listener that **skips the
  first (echo) snapshot**, ignores `hasPendingWrites`/`fromCache`/own‑write‑settling, and for a
  genuine remote change shows a "refresh" banner (`#refreshBanner`, `window._pendingRemoteData`,
  auto‑hide 30s). `applyRemoteUpdate()` applies it. On `permission-denied` it unsubscribes.
  Because that banner is transient and easy to miss (phone locked/backgrounded when the change
  lands), a **`visibilitychange` listener re‑runs `loadFromFirestore()` whenever the app returns
  to the foreground** while signed in (throttled to once per 20s via `_lastVisibleRefresh`) — this
  reuses the same merge + photo‑recovery logic as a normal load, so returning to the app always
  catches up with the cloud even if the banner was never seen or tapped.
- **Offline‑merge:** if `tonys_offline_queue==='1'`, merge local into remote by keeping the
  higher `updatedAt` per id and unshifting local‑only recipes, then push merged back.
- **`saveData()`** = `saveLocal()` + debounced (1.5s) `saveToFirestore()` when signed in &
  online; when offline it sets the offline queue and retries every 30s. Quota errors surface a
  detailed `showServiceError(...)` modal.

---

## 7. UI structure (top to bottom)

**Header** (`.header`, sticky, brown): SVG logo + "Tony's *Recipes* Collection" + version
badge; right side: sync‑status pill with Sign in/out, a `?` help button, and a ⚙️ **Settings**
dropdown (Family Access, Gmail Setup, Save Helper, Self Test, Payments, Deployments — the last
two with a little green "helper running" indicator dot). Second header row: **search input**
(filters live via `renderGrid()`), plus three dropdown button‑groups:
- **··· More** → Explore meal ideas, Suggest recipes, Convert measurements, Share this app,
  Auto‑tag diet types, Auto‑fetch missing photos.
- **⇅ Imp/Exp** → Import (From URL, Free‑hand text, Scan camera, From File `.docx/.xlsx/.pdf/.html`,
  Drop File) and Export (All to Excel, All to Word, Backup Save, Backup Restore).
- **+ Add Recipe** → Fill in manually, Paste free‑hand text, Import from URL, Scan (camera).

A thin save‑status bar with a **Reset** (clear all data) link sits under the header.

**Filters** (`#filterBar`, sticky under header) — desktop shows **three "frames"**:
1. All · ❤ Favourites · 🕐 Recent (only if there is view history) · Clips
2. Meal categories with icons (Breakfast🌅 Lunch☀️ Dinner🌙 Snack🍿 Dessert🍰 Soup🍜)
3. Diets (Keto⚡ Carnivore🥩 Vegetarian🥦 Vegan🌱 Omnivore🍽️). Selecting Omnivore clears the
   others; selecting any specific diet clears Omnivore.

A separate **mobile filter bar** (`#mobileFilterBar`) collapses categories/diets into ▾ dropdown
panels (`toggleMobilePanel`, `mobileCatChange`, etc.) shown only on narrow screens.

**Grid** (`#recipeGrid`): a `list` or `grid` view (`setView`). The choice is remembered in
`tonys_view_mode`; desktop defaults to `list`, **phones default to `grid`** so the layout
resembles the desktop cube grid. Cards show photo or emoji tile, a category **pill badge**
(`.card-category-badge`, bottom‑left over the image), title (right‑aligned for Hebrew),
prep/servings (**desktop only** — hidden in the phone grid, where the card is barely wider than a thumb and both are one tap away inside the recipe; list view keeps them at every width), difficulty pill, favourite heart, a 🔥 badge when `cookCount ≥ 3`, and a
`.clip-badge` 🎬 circle for `r.isClip` (4.10 — one shared component, not the two hand‑rolled
inline SVGs it replaced; `.clip-badge-sm` in list view). `isClip` is the only flag read here:
`isVideoBookmark` was folded into it in 2.3. On phone‑width screens the grid uses a configurable column count
(`--mobile-cols`, 1–5, default 3) with square (`aspect-ratio:1/1`) cubes — see **Settings → Grid
Layout** (`openGridSettings`, stored in `tonys_mobile_cols`). Desktop grid uses
`repeat(auto-fill, minmax(220px, 1fr))`. There is a **sort** control (`setSort`): default /
recent / alpha (A–Z) / prep time / difficulty / popular (by cookCount). Search matches name,
category, ingredient names, and step text. Empty states are context‑aware (no favourites / no
search results / no recipes yet + Add button).

**Select mode** (`toggleSelectMode`): checkboxes on cards + a bottom action bar to bulk delete,
export (Excel/Word), share, or print selected recipes.

---

## 8. View / Add‑Edit modals

**View modal (`openView`/`drawView`)**: hero (photo or emoji on `bg`), category, RTL‑aware title,
meta (prep/servings/difficulty), an editable **Source** row (inline edit/save), a **Nutrition
per 100g** panel (shows values or a "✨ Calculate" button → `calcNutrition` via AI), **Scale**
buttons ×1–×6 (persisted per recipe in `scale_<id>`), **Metric/Imperial** unit toggle
(`cvtIng`/`M2I`/`I2M` conversion + `scaleAmt`/`parseFraction`), diet tags, cook‑count line, a
NOTES callout, **Ingredients** list, **Method** (per‑step RTL detection for Hebrew), and an
action bar: ✏️ Edit · 🍳 Cooked! · 🌐 Translate · 📊 Excel · 📄 Word · 🖨️ Print · 📤 Share ·
🛒 Send to Bring! · (📸 Show/🗑️ Remove Original when an `originalPhoto` exists). Opening a recipe
records it in `recent_views` and requests a **screen wake lock** (re‑acquired on visibility).

**Add/Edit modal (`openAddModal`/`saveRecipe`)**: name, emoji picker (first 14 of `EMOJIS`),
photo upload (compressed via `uploadPhotoToStorage`), category, difficulty, prep, servings, an
**ingredient table** (`addIngRow`/`syncIngsTextarea`/`loadIngsTable` — amount + name rows kept in
sync with a hidden textarea), a steps textarea (one step per line), diet tag buttons
(`renderDietButtons`/`getSelectedDiets`), source, notes, and an "is clip" checkbox. Ingredient
lines accept `amount — name` / `amount - name` separators. Editing preserves `fav`, `bg`,
`originalPhoto`, and clears stale `nutrition` when ingredients/steps change.

---

## 9. AI features (all via `aiCall` → Worker → Claude)

- **Import from URL** (`runUrlImport`): YouTube → Worker YouTube API; Instagram → Worker
  `instagram-fetch`; else Worker `fetch-url`, then **fallback CORS proxies**
  (`allorigins.win`, `corsproxy.io`, `codetabs.com`) if the Worker returns too little. Then ask
  Claude to return strict recipe JSON *in the original language* (`{name,category,difficulty,
  prep,servings,ingredients:[{a,n}],steps:[]}` or `{error:"no recipe found"}`). No recipe →
  offer **Save as video/link bookmark** (`showSaveAsVideoBookmark`).
- **Free‑hand text import** (`runFreehandImport`): same JSON extraction from pasted text.
- **Camera/photo scan** (`openCameraImport`/`processCameraImage`): downscale image
  (`resizeImageForVision`) and send to Claude vision to extract the recipe; keeps the original
  photo as `originalPhoto`.
- **Translate** (`openTranslate`/`runTranslate`/`applyTranslation`): translate name/ingredients/
  steps/notes to a chosen language and optionally apply back to the recipe.
- **Explore** (`runExplore`) and **Suggest** (`runSuggest`): brainstorm meal ideas / generate new
  recipes from chosen diet/meal/cuisine chips and counts, with one‑tap add.
- **Nutrition** (`calcNutrition`): estimate per‑serving macros, store as `nutrition`.
- **Diet auto‑tag** (`aiTagAllDiets`): batch‑tag untagged recipes with diet labels.
- **Auto‑fetch photos** (`autoFetchMissingPhotos`): for photoless recipes, translate Hebrew names
  to English if needed, Pixabay‑search, download + compress the top hit into `photo`.
- **Help assistant** (`openHelp`/`askHelp`): in‑app Q&A bot with a big `HELP_SYSTEM_PROMPT`
  describing every feature; quick‑question chips; can surface detail cards.
- **`extractJSON(raw)`**: robustly pulls JSON out of a possibly chatty AI reply (strips code
  fences, finds the first balanced `[...]`/`{...}`).

---

## 10. Import / Export / Backup

- **Excel EXPORT was removed in v28.5** along with the QR code — both were unused and cost a
  CDN library each. Do **not** rebuild them. Excel *import* remains (`.xlsx` via SheetJS).
- **`xlsx` and `mammoth` load ON DEMAND** via `loadScriptOnce()` (5.11), never from `<head>` —
  there is a test pinning this. Only Firebase compat 10.12.0 and GSI are in `<head>`.
- **Word** (`.docx`): **built by hand** as an OOXML zip — `makeDocxBlob` + a tiny `buildZip`
  (store‑only, CRC32) — no library for export. Import `.docx` via **mammoth** 1.6.0 CDN
  (`parseWordText`).
- **PDF/HTML/TXT** import supported by `importFromFile` (accept
  `.xlsx,.xls,.docx,.doc,.pdf,.html,.htm,.txt`), plus a **drag‑and‑drop** zone (`handleFileDrop`)
  and the native **File System Access API** picker (`importViaFilePicker`) as an option.
- **Backup**: `backupSave` writes a single JSON `{version, exportedAt, nextId, recipes, photos,
  settings}` where inline data‑URL photos are **de‑duplicated** into a `photos` map and replaced
  by `__photo__N` refs. `backupRestore`/`backupRestoreFile` reverse it and re‑hydrate. Backup
  buttons are desktop‑only. **Restore is the app's most destructive action — see §4c** for the
  confirmation and validation it must carry. `backupIsOverdue()`/`checkBackupOverdue()` nudge
  after 30 days (5d.1); the nudge never claims a backup happened.
- **Local Save Helper**: on desktop, exports can POST base64 to `http://127.0.0.1:27182` so files
  land in `~/Documents/Projects/Recipes App/Backups` with correct Hebrew/Russian names
  (`downloadBlob` tries the helper first, falls back to a normal browser download + a rename hint
  for non‑ASCII names). `checkHelperStatus` flips the ⚙️ indicator dot green when reachable.
  The helper enforces `Access-Control-Allow-Origin: https://rozinante2004-hash.github.io`.

---

## 11. Bring! shopping‑list integration

- **Send** (`openBringModal`→`bringConfirmSend`→`sendItemsToBring`): pick ingredients as
  checkboxes, POST `bring-add` to the Worker. On success, deep‑link `bring://` then fall back to
  `web.getbring.com`. **Amounts sent match the recipe view's current scale/unit** — `openBringModal`
  runs each ingredient through `cvtIng()`/`scaleAmt()` using `viewMult`/`viewUnit` (only when
  `recipeId === viewId`, since Send‑to‑Bring is reached from the view screen) and both the
  displayed checkbox labels and the amounts actually sent (`_bringScaledAmounts`) use that scaled
  value — never the raw unscaled `ingredient.a`.
- **Token lifecycle**: Bring tokens expire ~weekly. **The Worker is the only authority on
  whether a token is still good.** `checkBringTokenStatus(probe)` POSTs `bring-token-status`;
  the Worker decodes the KV/env token's JWT `exp` (and, with `probe`, makes a live call) and
  returns `{configured, exp, daysLeft, expired, valid}`. `renderBringTokenStatus()` renders only
  that answer. A stale `bring_token_expiry` may produce "last known …" or "status unknown", and
  **must never assert "expired"** — the token is shared via KV, so any device that didn't itself
  perform the refresh holds an out-of-date copy, which is precisely what used to produce false
  "Bring! token expired" messages. Refresh flows:
  - **Relay** (`openBringAutoRefresh` → `bring-relay.html`) opens in a **normal tab, never a
    sized popup**: a popup window has no bookmarks bar, so the 🛒 bookmarklet is unclickable
    there. The relay cannot read Bring!'s localStorage (different origin), so it presents the
    bookmarklet and a copyable one-line console snippet instead of polling pointlessly.
  - **Bookmarklet** (`showBringBookmarklet`): a `javascript:` snippet the user runs on
    `web.getbring.com` that POSTs `bring-settoken`. The shared secret is stored per-device in
    `tonys_bring_settoken_secret` and entered by hand — **never shipped in `index.html`**, which is
    public. The bookmarklet runs off-origin, so it must inline literal headers rather than calling
    any app helper. The same
    modal offers a **paste-the-token** field (`submitManualBringToken`) for when no bookmarks bar
    is available at all.
  - **Expired modal** (`showBringTokenExpired`/`openBringForTokenRefresh`) polls `bring-lists`
    until the token works again, then re-checks the real expiry and retries the queued items.

---

## 11a. Keeping your place, and step timers

**There is no Cook Mode.** It existed until v27.6 and was removed on request: the whole recipe
should be visible at once. Do not reintroduce a step-at-a-time view.

**Line marker.** Every ingredient and step carries `data-line="ing-N"` / `data-line="step-N"` and
an `onclick="markLine(...)"`. A single absolutely-positioned `#lineMarker` inside `#lineMarkHost`
is moved by setting `top/left/width/height`, all transitioned — that is what makes it *slide*;
toggling a class per `<li>` would cross-fade in two places instead. Only one line is ever marked.
Tapping the **same** line twice within 320 ms clears it, as does double-tapping the recipe body:
keying the gesture to the line rather than to the clock alone matters, because running a finger
down a list taps several lines quickly and that must move the marker, not wipe it. The position
is stored per recipe under `tonys_linemark` and re-applied after every re-render (`drawView`
re-measures via `positionLineMarker(false)`), so scaling, unit switches and reopening the recipe
never lose it.

**Step timers.** Durations found by `findStepTimers()` render as `.cook-timer-btn` countdowns
inside the step. These lived in Cook Mode but were never part of it; they survived its removal.
`clearCookTimers()` runs on every re-render and when the recipe closes.

**Voice (3.7)** is scoped to the marker: `handleVoiceCommand()` understands next / back / repeat /
clear / ingredients / steps in English and Hebrew, clamps at the first and last line, and is
deliberately incapable of reaching any function that writes data.

---

## 11b. Scaling, and the cooking log

**Scaling (3.3)** offers two routes to the same multiplier, both kept on purpose:
- the `×1`–`×6` buttons (`setMult`), and
- a **"Make it for [N] servings"** stepper (`setServings`/`nudgeServings`), rendered only when
  `parseServings(r.servings)` finds a number — a recipe whose servings field reads "—" gets no
  control rather than a broken one. `viewMult` becomes fractional (6 from a base of 4 → ×1.5),
  which the persisted `scale_<id>` key and the Bring! integration both already handle.

`fmtAmt` rounds to what a cook can measure: nearest 5 above 100, whole above 20, half above 2,
quarter above 0.5. `scaleAmt` **preserves the author's spacing** — "200g" → "300g", never
"300 g"; the old code inserted a space into every scaled amount, including those sent to Bring!.
`awkwardCount()` flags a bare fractional count of a countable thing ("2.5 eggs") and the view
shows a note, because that is a rounding decision for the cook, not a measurement.

**Cooking log (3.5):** `markCooked` opens `#cookLogOverlay` for an optional 1–5 star rating and a
note; *Just log it — no note* preserves the original one-tap behaviour, and a missing modal falls
straight through to `commitCooked`. Entries append to `r.cookLog` (`{id, at, rating, note}`, capped at
50, sanitised in `normalizeRecipe`). Entries carry a unique `id`: `at` is a display timestamp and
repeats, so keying deletion on it removed every entry written in the same millisecond. `avgRating` averages only the *rated* cooks. Deleting a log
entry must **not** change `cookCount` — the count is how many times it was cooked, not how many
notes survive. `duplicateRecipe` clears the log along with the count.

---

## 11c. WhatsApp group knowledge

WhatsApp exposes **no API** for reading group content, and libraries that automate WhatsApp Web
breach its Terms of Service and get numbers banned. The feature therefore reads WhatsApp's own
*Export chat → Without media* `.txt` files, and nothing else.

- **Sources** (⚙️ Settings → 💬 WhatsApp Groups, `openWaSetup`):
  - **remote** — a folder of `.txt` files served over HTTPS plus an `index.json`
    (`["a.txt"]` or `[{"file":"a.txt","group":"Family Food"}]`). `waRefreshFolder()` replaces all
    remote entries, because re-exporting yields the whole history again. Reachable from the phone
    only while the phone can reach GitHub — see **cloud** below.
  - **local** — files imported into the browser (`waImportFiles`), stored in IndexedDB
    (`tonys_recipes_db` v2, store `wachats`, `{id, group, text, addedAt}`).
  - **cloud** — Firestore, added in **5f.8 (v29.6)** for devices that cannot reach GitHub at all
    (Tony's employer-managed iPhone blocks `github.com` and `api.github.com` outright, which kills
    the folder *and* every upload route to it). `chat_<slug>` holds metadata only; the text lives
    in `chatpart_<slug>_<n>` documents chunked to `WA_CLOUD_CHUNK` (700 000) **bytes**. The head
    range query (`chat_` … `` chat` ``) cannot see the parts, so listing chats never drags the
    text down with it; `loadCloudChatText` fetches on demand and caches in IndexedDB under
    `cloud:<file>`, keyed by the head's `updatedAt`. `waRefreshCloud` merges these into the index,
    and a cloud copy supersedes the folder copy of the same file. Covered by the existing
    `match /shared/{document=**}` rules — no rules change was needed.
  Chat text stays out of **localStorage** and out of the legacy single recipe document — a year of
  group chat is megabytes. Per-document storage (5.4) is what made the cloud source viable at all:
  the 1 MiB ceiling is now per chat part rather than per collection.
- **Reading** (`waTextFromBuffer`): "Export chat" produces a **ZIP containing `_chat.txt`**, on
  both iOS and Android — renaming it `.txt` does not make it text. Both sources read bytes and
  sniff the `PK` header, unzipping via `DecompressionStream('deflate-raw')` (no library). Central
  directory is parsed for the entry offsets; `_chat.txt` is preferred, any `.txt` accepted.
- **Parsing** (`waParse`): handles the iOS `[dd/mm/yyyy, hh:mm:ss] Name: text` and Android
  `dd/mm/yyyy, hh:mm - Name: text` shapes, strips bidi control characters, joins continuation
  lines onto the previous message, drops `<Media omitted>`-style system lines, and drops short
  group-housekeeping notices via `WA_SYSTEM_RE` (joined / left / created / changed subject, plus
  Hebrew equivalents). The length guard matters: a long message that merely contains "left"
  ("I left the brisket in overnight") must survive. A real 11,000-line export reduced to ~5,800
  actual messages this way.
- **Retrieval** (`waSearch` → `waBuildContext`): term scoring by **substring** match, which is
  what makes Hebrew prefixes (ה/ו/ב/ל) work without a stemmer. Each hit drags messages `i-2 … i+5`
  into the context, because the *answers* almost never repeat the question's words
  ("230C on a preheated tray" shares nothing with "what temperature for focaccia").
- **Asking** (More → 💬 Ask my WhatsApp groups, `openWaAsk`/`waAsk`): the prompt requires the AI
  to collate *every* relevant answer, lead with a single `**Best answer:**`, list other viable
  options with who suggested them and their trade-offs, name disagreements explicitly, attribute
  claims, and use only the excerpts. Sources shown behind a `<details>`.
- **Automation limits, stated honestly:** the export step cannot be automated on any platform.
  The upload afterwards can — on iPhone, a Shortcut accepting a file from the Share sheet and
  PUTting it to `/repos/<owner>/<repo>/contents/whatsapp/<file>`. **That whole route dies on a
  device where GitHub is blocked** — a managed phone — which is what the `cloud` source above is
  for: import the export on the phone and it syncs through Firestore instead.

---

## 12. Sharing, email, misc utilities

- **Share app** (`openShareAppModal`): WhatsApp / copy link. **The QR code was removed in v28.5**
  (with the qrcodejs CDN dependency) — do not rebuild it.
- **Share recipe** (`toggleShare`/`rText`): native share, WhatsApp (`doWhatsApp`), email
  (`doEmail`/`showEmailModal`), copy (`doCopy`).
- **Gmail API send** (`getGmailToken`/`sendViaGmailApi`): uses the Gmail send scope and a
  user‑provided OAuth client id (`openGmailSetup`, stored in `tonys_gmail_client_id`) to send
  formatted recipe emails; falls back to a copy‑paste hint.
- **Measurement converter** (`openCalcModal`/`convertUnits`): Weight/Volume/Temp/Length with a
  live two‑way calculator.
- **Print** (`printRecipe`): print‑friendly recipe window (`buildPrintHtml`, escaped).
- **Email preview** (`showEmailModal` → `rHtml`): the preview iframe is **sandboxed** and every
  recipe field is escaped — see §4a. This is where the audit found the app's one real XSS.
- **Family Access Control** (`openAccessControl`): manage member emails + roles
  (read/write/admin), stored locally and in Firestore, and **generate copy‑pasteable Firestore
  security rules** (`updateAccessRules`) that gate `shared/**` by `request.auth.token.email`.
- **Payments** and **Deployments** modals: static reference cards linking to every console
  (Anthropic billing/keys, Cloudflare Worker edit/settings, Firebase, GitHub, Google Cloud/
  YouTube quota) and the two helper downloads. Rebuild these as informational panels.
- **PWA install** prompts: Android `beforeinstallprompt` banner + iOS "Add to Home Screen" hint,
  each dismissible and remembered.
- **Version check** (`checkAppVersion`): poll `version.json` (no‑store); when it differs from
  `APP_VERSION` show an update banner (`swUpdateNow` posts `SKIP_WAITING` to the SW and reloads).
- **Toasts** (`toast`), **dropdown/modal helpers** (`toggleDrop`, `closeDrop`, `closeM`, `bgClose`).
- **Print** (`buildPrintHtml`/`printRecipes`/`printRecipe`): builds one **valid** document for one
  or many recipes (page‑break between them) and opens it to `window.print()`. The `<style>` MUST be
  closed — an unclosed one makes the parser swallow the whole body as CSS and print a blank page.
  A blocked pop‑up must be detected (`window.open` → null) and reported, not thrown.
- **Bulk actions** on the `#selectBar`: `exportRecipesToExcel`/`exportRecipesToWord` take a list and
  back both "export all" and "export selected"; `uniqueSheetName` de‑duplicates Excel sheet names
  (XLSX throws on duplicates). `printSelected` prints all selections as ONE document.

**Escaping (security‑critical):** recipes are AI‑parsed from arbitrary web pages *and* shared
between family members through Firestore, so recipe text is untrusted. Every field interpolated
into `innerHTML` must go through **`escH()`** (text; null‑safe, newlines → `<br>`) or **`escA()`**
(attribute values; also escapes quotes). This covers name/category/prep/servings/difficulty/emoji/
ingredients/steps/diets/source/photo in `renderGrid`, `drawView`, `rHtml` and `buildPrintHtml`.
Unescaped, a recipe named `<img src=x onerror=…>` executes JavaScript in every family member's app.
Untrusted HTML *files* are parsed with **`DOMParser`** (inert), never `innerHTML`.

---

## 13. Built‑in Self‑Test suite (`⚙️ → 🧪 Self Test`)

A first‑class feature — recreate it. `SELF_TESTS` is an array of **161 checks** in 13 groups —
**Features (42), UI (26), Cloud Sync (23), WhatsApp (12), Import/Export (11), CRUD (10),
Storage (10), CSS (6), Core, Modals and Network (5 each), Backup and Performance (3 each)** —
covering (among others) IndexedDB photo round‑trip and photo‑free localStorage, the Firestore
photo‑split (`slimRecipeForCloud`/`byteLen`/`isSizeError`), phone grid columns, view‑mode
persistence, shared‑URL prefill, unit conversion, and HTML escaping. The modal
(`openSelfTest`/`runSelfTests`) lets the user pick tests by group, runs them sequentially with
live ✅/❌ status, and for failures shows a **detail card** with error, impact, a suggested fix
(`SELF_TEST_FIXES`), and — where available — an **"Apply Runtime Fix"** button that patches the
running session (e.g. re‑inject `:root` CSS vars, define a missing `sortMode`, call
`renderGrid()`). Network tests ping the Worker health, AI round‑trip, `fetch-url`,
`photo-search`, and `instagram-fetch` (treat IG 404 as pass, only 500 as fail).

**Write a test for every behavioural change, then MUTATE THE CODE TO PROVE THE TEST FAILS.**
This is the single most valuable practice in the project's history and it is not optional.
Several tests here were written, passed, and were later shown to assert nothing:

- `chunks.join('') === original` "proved" chunking preserved emoji — but JS strings are UTF-16,
  so concatenation silently reunites a split surrogate pair. It passed with the guard removed.
  The honest assertion is a UTF-8 round trip per chunk, which is what Firestore actually stores.
- A folder-listing filter was tested through its predicate alone; reverting the *caller* to the
  old behaviour left every test green.
- A "all chats are searched" test built the message array by hand, so a loader crippled to stop
  after the first chat still passed. It has to drive `waLoadAllMessages` itself.
- An assertion that grepped for `Math.max.apply` matched the *comment* explaining its removal.

When a mutation unexpectedly survives, check the mutation actually applied before concluding the
test is weak — `perl` without `/g` hits the first match in the file, which twice was a different
call site entirely.

---

## 14. Visual design system (CSS)

CSS variables on `:root`:
```css
--cream:#FAF7F2; --warm-brown:#5C3D2E; --terracotta:#C1440E; --gold:#D4A843;
--ink:#1C1A18; --muted:#8A8279; --border:#E8E0D5; --card-bg:#FFFFFF; --bg:#FAF7F2; --green:#2E7D32;
```
- Fonts: `Playfair Display` (titles, italic accents in gold) + `DM Sans` (everything else),
  each backed by a Hebrew face — **Frank Ruhl Libre** and **Heebo** respectively (5b.1). Neither
  Latin face has Hebrew glyphs, and CSS resolves font-family per *glyph*, so the Hebrew face must
  come after the Latin one in every stack. Without it Hebrew titles fall back to an OS serif.
- Buttons: `.btn-primary` terracotta, `.btn-secondary` translucent‑white on brown,
  `.btn-gold` gold.
- Cards: 12px radius, 1px `--border`, hover lift + soft brown shadow; difficulty pills
  `.easy/.medium/.hard` in green/amber/red.
- Filter chips: pill‑shaped, brown‑fill when active; favourites chip terracotta; diet/clip chips
  green.
- Modals: fixed overlay `rgba(28,26,24,0.6)`, cream sheet, 16px radius, `slideUp` cubic‑bezier
  entrance, always‑visible white circular close button with an enlarged tap target; 200px hero.
- Meta note: many title/card blocks are `text-align:right` and use `dir="auto"` because content
  is frequently Hebrew — **RTL support is a first‑class requirement**, not an afterthought.
- Skeleton loaders on first paint when there are no local recipes yet.
- Respect safe‑area insets (`env(safe-area-inset-*)`) for iOS standalone.

`<head>` essentials: viewport with `viewport-fit=cover`; `mobile-web-app-capable` +
`apple-mobile-web-app-*` metas; `theme-color #5C3D2E`; manifest link; apple‑touch‑icon; an inline
SVG favicon (the fork/flame mark); Google Fonts; and CDN scripts for **Google GSI and Firebase
compat (app/auth/firestore)**. **xlsx and mammoth are NOT in `<head>`** — they load on first
use via `loadScriptOnce()` (5.11). qrcodejs and the Excel export were removed in v28.5.

---

## 15. Boot sequence (`initApp` IIFE at the end of the main script)

1. `loadLocal()` → if local recipes exist, hide the login screen and render immediately.
2. Read the offline‑queue flag.
3. `renderFilters()` + `renderGrid()`.
4. `handleShareTarget()` (process any `?url/text/title`).
5. `checkAppVersion()`.
6. After ~2s, `checkHelperStatus()` (local save helper probe).
7. If no recipes, paint 4 skeleton cards.
Firebase auth state then updates everything asynchronously. Register `sw.js` for PWA/offline.

---

## 16. Acceptance checklist (definition of done)

- [ ] App loads offline from cache; installs as a PWA on Android and iOS.
- [ ] 5 seed recipes appear on a fresh install; adding/editing/deleting persists to
      `localStorage` and (when signed in) syncs to Firestore, including multi‑device merge.
- [ ] Google sign‑in works; sync‑status pill reflects state; sign‑out clears the listener.
- [ ] All AI actions round‑trip through the Worker and degrade gracefully on billing/key/quota
      errors with the friendly modal.
- [ ] URL/Instagram/YouTube/free‑hand/camera/file imports all produce correct recipe JSON or a
      video bookmark; RTL Hebrew renders correctly throughout.
- [ ] Hand‑rolled Word export/import, JSON backup/restore (with de‑duped photos), and the
      localhost save helper all work; non‑ASCII filenames handled. **There is no Excel export** —
      it and the QR code were removed in v28.5 as unused; do not rebuild them.
- [ ] Bring! send + all three token‑refresh paths function; expiry pill accurate.
- [ ] Scale/units/nutrition/cook‑count/favourites/recent/sort/search/select‑mode/print/share all
      behave as described.
- [ ] Self‑Test modal runs, reports pass/fail, and runtime fixes apply.
- [ ] **No real secret is committed**; Worker holds `ANTHROPIC_API_KEY`, `PIXABAY_API_KEY`,
      `YOUTUBE_API_KEY`, and the Bring token/KV; Firebase web config may be embedded.
- [ ] GitHub Actions deploys to Pages on push to `main`; `version.json` bump triggers the
      in‑app update banner, the badge shows the **running** version, and one tap of Update Now
      actually lands the new build (it must clear the caches — see §4b).
- [ ] **Security (§4a):** a recipe named `" onerror="alert(1)` renders inertly in the email
      preview, the print view, the shared page and the grid; `safeUrl('javascript:alert(1)')`
      is `''`; the preview iframe is sandboxed.
- [ ] **Honesty (§4b):** no message claims a copy, a grant, a revocation or an update that has
      not been verified; refused cloud deletions appear in Sync Health.
- [ ] **Destructive actions (§4c):** restore confirms before replacing anything and survives a
      backup with no `exportedAt`.
- [ ] **Photos (§5a):** clearing IndexedDB with the app signed in loses no photo — they come back
      from the cloud on the next load.
- [ ] **Accessibility:** every ✕ has an accessible name; dialogs trap Tab and return focus;
      the recipe card focus ring paints (`:focus:not(:focus-visible)` for the reset, ring rule
      last); Hebrew recipes put ingredients on the right via `dir="rtl"` on the grid container.
- [ ] **No listener or blob-URL leaks:** opening and closing the mobile filter panel repeatedly
      leaves at most one document click listener bound.

---

## 17. Rebuild order (suggested)

1. Scaffold `index.html` skeleton: `<head>` (metas, fonts, CDN scripts, CSS variables + full
   stylesheet), header, filter bars, grid, and empty modal shells.
2. DATA section (constants, seed recipes, state vars) + `localStorage` load/save/migrate.
3. `renderFilters` + `renderGrid` + search/sort/filter/select‑mode.
4. View modal + Add/Edit modal + ingredient table + scaling/units/nutrition/cook‑count.
5. `cloudflare-worker.js` + `aiCall` + `extractJSON`, then every AI feature.
6. Import/Export/Backup + local save helper (`local-save-helper.py`, `setup-save-helper.sh`).
7. Firebase auth + Firestore sync + offline merge + remote‑change banner.
8. Bring! integration + `bring-relay.html`.
9. Sharing/email/Gmail/converter/print/access‑control/deployments (no QR — removed v28.5).
10. WhatsApp group knowledge (§11c), including the Firestore chat source.
11. PWA (`manifest.json`, `sw.js`, icons, install banners, version check) + Self‑Test suite.
12. `.github/workflows/deploy.yml` and `self-tests.yml`; deploy; smoke‑test with the Self‑Test
    modal, then walk the acceptance checklist in §16 — including the security, honesty, photo
    and accessibility rows, which are the ones a rebuild is most likely to miss.

> Keep everything in one `index.html` with inline CSS/JS and CDN dependencies. Prefer clarity and
> parity with this spec over modernization. When in doubt, match the observable behaviour above.

---

## 18. How this app is judged

Two qualities matter more than features, and both were learned the hard way:

**It must tell the truth.** Every message the UI shows is a claim, and a claim the code has not
verified is a bug — not a cosmetic one. The version badge that displayed the server's version
instead of the running one turned three separate stale-cache incidents into hunts for bugs that
did not exist. "Removed member" that had removed nothing read as a revoked permission. §4b is not
style guidance; it is the specification.

**A failure must leave a way forward.** A dead end is treated as a bug here. An AI failure offers
paste / open / bookmark; an unreadable cloud document repairs itself on the next save; a photo
missing from IndexedDB comes back from the cloud; a rate-limited photo source hands off to the
next instead of stopping. Where the app genuinely cannot proceed — a device whose administrator
blocks GitHub — it says so plainly and points at the route that does work, rather than pretending
or quietly doing nothing.

The corollary for whoever rebuilds this: when a test passes, mutate the code and check it fails.
Roughly a third of the real defects in this project's history were found that way, and several
were hiding behind tests that had been green for months.
