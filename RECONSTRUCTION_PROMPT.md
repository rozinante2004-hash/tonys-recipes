# Tony's Recipes Collection — Full Reconstruction Prompt

> **Purpose of this file.** This is a Claude‑Code‑optimized specification for rebuilding
> *Tony's Recipes Collection* from scratch if the source is ever lost. Paste the whole file
> into a fresh Claude Code session and instruct: *"Build this application exactly as
> specified."* It is written to be self‑contained: every file, data shape, external service,
> secret placeholder, and UX behaviour is described so the app can be recreated to parity.
>
> **Golden rule for the rebuild:** the app is a **single, self‑contained `index.html`** (~8,300
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
**Current version:** `v23.0` (see `version.json`, the HTML comment on line 1, and `APP_VERSION`).

Design language: warm, editorial. Serif display font **Playfair Display** for titles, sans
**DM Sans** for body. Cream/brown/terracotta/gold palette. Rounded cards, soft shadows,
slide‑up modal animation.

---

## 2. File inventory (recreate all of these)

| File | Purpose |
|---|---|
| `index.html` | The entire app — HTML + CSS + JS in one file. ~8,300 lines. |
| `manifest.json` | PWA manifest. `start_url`/`scope` = `/tonys-recipes/`. Includes a `share_target`. |
| `sw.js` | Service worker. Network‑first for the document, cache‑first for assets. |
| `version.json` | `{"version": "v23.0"}` — polled to detect new deployments. Must never be cached. |
| `cloudflare-worker.js` | The API proxy (deployed to Cloudflare, not served to browsers). |
| `bring-relay.html` | Helper popup page that captures a Bring! token and posts it to the Worker. |
| `local-save-helper.py` | Optional localhost (port 27182) helper to save exports with Hebrew/Russian filenames on Linux. |
| `setup-save-helper.sh` | One‑shot installer/autostart for the Python helper. |
| `logo.svg` | Brand mark (brown disc, gold ring, fork + terracotta/gold flame). |
| `icons/icon-192.png`, `icons/icon-512.png` | PWA icons. `icon-512.png` also duplicated at repo root. |
| `.github/workflows/deploy.yml` | GitHub Actions → GitHub Pages deploy on push to `main`. |

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

### 2.3 `sw.js` (service worker, "v3", `CACHE_NAME = 'tonys-recipes-v6'`)
- On `install`: `skipWaiting()` + pre‑cache core files
  (`/tonys-recipes/`, `index.html`, `manifest.json`, both icons).
- On `activate`: `clients.claim()` + delete any cache whose name ≠ `CACHE_NAME`.
- On `fetch`: ignore requests whose URL doesn't include `/tonys-recipes/`.
  `version.json` → always `fetch` with `cache: 'no-store'`. The document (HTML) →
  **network‑first**, update cache on success, fall back to cache offline. Other assets →
  **cache‑first**, then network.
- Listens for `postMessage({type:'SKIP_WAITING'})` and calls `skipWaiting()`.

---

## 3. External services & secrets (all proxied through the Worker)

| Service | Role | Where the secret lives |
|---|---|---|
| **Anthropic Claude API** | All AI (import/extract, translate, suggest, explore, nutrition, help, diet auto‑tag) | Worker secret `ANTHROPIC_API_KEY` |
| **Firebase** (Auth + Firestore) | Google sign‑in + shared cloud recipe doc | Public web config (safe to ship) |
| **Cloudflare Worker** | Single POST endpoint proxying everything | The Worker itself |
| **Pixabay** | Food photo search / auto‑fetch | Worker secret `PIXABAY_API_KEY` |
| **YouTube Data API** | Fetch video description for recipe extraction | Worker secret `YOUTUBE_API_KEY` |
| **Bring!** | Push ingredients to a shopping list | Token in Worker KV `BRING_KV` (key `accessToken`) or fallback constant |
| **GitHub Pages** | Hosting | n/a |

> **SECURITY — do NOT re-commit live secrets.** The historical `cloudflare-worker.js` in this
> repo hardcodes a **real Bring! bearer token and `X-BRING-API-KEY`** (plus UUIDs) in plaintext.
> When reconstructing, replace these with placeholders and load them from Worker env/KV. Treat
> any real token found in git history as **compromised — rotate it**. The Firebase web config
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

A single ES‑module Worker (`export default { async fetch(request, env) }`). Handles CORS
(allow `*`, methods `POST, OPTIONS`), rejects non‑POST with 405, parses a JSON body, and
dispatches on `body.action`. If **no** `action` is present, the body is forwarded verbatim to
the **Anthropic Messages API** (this is the AI path).

**Constants / env used:**
- Bring: `BRING_LIST_UUID`, `BRING_USER_UUID`, `BRING_API_V2 = 'https://api.getbring.com/rest/v2'`,
  `BRING_HEADERS` (`X-BRING-CLIENT: WebApp`, `X-BRING-CLIENT-SOURCE: webApp`,
  `X-BRING-COUNTRY: IL`, `X-BRING-API-KEY: <secret>`, `Origin`/`Referer: web.getbring.com`).
- `getToken(env)` reads `env.BRING_KV.get('accessToken')`, else a fallback constant.
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
4. **`bring-settoken`** `{token, secret}` — require `secret === 'tonys-recipes-2024'`, validate
   the JWT has 3 segments, store in `BRING_KV` under `accessToken`.
5. **`photo-search`** `{query}` — Pixabay `?image_type=photo&per_page=9&safesearch=true&order=popular`;
   return `{images:[{url,thumb,credit,creditUrl}], total}`.
6. **(default, no action)** — forward the whole body to
   `https://api.anthropic.com/v1/messages` with headers `x-api-key: env.ANTHROPIC_API_KEY`,
   `anthropic-version: 2023-06-01`; return the JSON response with `Access-Control-Allow-Origin: *`.
7. **`instagram-fetch`** `{shortcode}` — (referenced by the app & self‑tests; Instagram oEmbed now
   needs auth so it typically 404s. Implement to return `{text}` when available, 404 when not, and
   never 500.)

**Client‑side AI contract:** `aiCall(prompt, maxTokens=2000, tools=null)` POSTs
`{model:'claude-sonnet-4-5-20250929', max_tokens, messages:[{role:'user', content:prompt}], tools?}`
to the Worker, retries up to 4× with exponential backoff on `429/529`, maps `402/billing_error`
→ friendly "credits exhausted" error, `403/permission_error` → "API key invalid", and returns
the concatenated `content[].text`. (Some self‑tests reference model id `claude-sonnet-4-6`; the
production `aiCall` uses `claude-sonnet-4-5-20250929`. Keep the Worker model‑agnostic — it
forwards whatever the client sends.)

---

## 5. Data model

**localStorage keys:**
- `tonys_recipes_v1` → JSON array of recipe objects (`STORAGE_KEY`) — **photo‑free** when
  IndexedDB is available (see local photo storage below); each recipe carries `_ph`/`_po` flags
  marking that a photo/originalPhoto lives in IndexedDB
- `tonys_nextId_v1` → the next integer id (`NEXTID_KEY`)
- `recent_views` → array of recently viewed recipe ids (max 8, most‑recent first)
- `scale_<id>` → remembered serving multiplier per recipe
- `tonys_view_mode` → `'grid'` | `'list'` — remembered grid/list toggle (phones default to `grid`)
- `tonys_mobile_cols` → `1`–`5`, recipe cubes per row on phone‑width screens (Settings → Grid Layout; default `3`, drives the `--mobile-cols` CSS variable)
- `tonys_offline_queue` → `'1'` when there are unsynced offline edits
- `tonys_access_members` → family access list (also mirrored to Firestore `shared/access`)
- `bring_token_expiry` → unix seconds when the Bring token expires
- `pwa_install_dismissed`, `pwa_install_dismissed_ios` → PWA banner dismissal
- `tonys_gmail_client_id` → user‑supplied Google OAuth client id for Gmail send

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
  isClip: Boolean,            // "clip"/bookmark (no full recipe)
  isVideoBookmark: Boolean,   // saved video link with no extracted recipe
  updatedAt: Number           // ms timestamp — used for offline-merge conflict resolution
}
```

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

**`migrateRecipes(list)`** — defensively backfills missing fields (`diets=[]`, `cookCount=0`,
`notes=''`, `source=''`, `nutrition=null`, `originalPhoto=''`, `updatedAt=0`; if
`isVideoBookmark && !isClip` set `isClip=true`). Run on every load/restore/remote‑update.

**Firestore layout:** doc `shared/recipes` = `{ recipes: <JSON string>, nextId, updatedAt }` —
but the JSON is **photo‑free** (see below). The whole family reads/writes this one shared list.
Doc `shared/access` = `{ members, updatedAt }`. Legacy `users/{uid}/…` rules kept for safety.

**Cloud photo storage (critical — Firestore's 1 MiB/doc limit):** photos are base64 and must
NOT live inline in the `shared/recipes` doc or it overflows 1 MiB after a dozen or so photos and
every write fails. Instead, `saveToFirestore` writes a **slim** recipes doc via
`stripPhotosForCloud` (each recipe's `photo` blanked, an `hp:1` flag set when a photo exists, and
`originalPhoto` omitted entirely), then `syncCloudPhotos` writes each recipe's display photo to
its **own** doc `shared/photo_<id>` = `{ photo:<base64>, updatedAt }` (only when changed; deletes
docs for removed/deleted photos). These per‑photo docs sit in the `shared` collection so the
existing `match /shared/{document=**}` rule already permits them — no rules change needed.
`loadFromFirestore`/`applyRemoteUpdate` re‑attach photos via `attachCloudPhotos` (fetch
`shared/photo_<id>` for `hp` recipes; legacy inline photos are kept and migrated on next save).
Photos remain inline in memory + localStorage, so rendering/backup/export are unchanged.
**`originalPhoto` (the full‑res scan backup, potentially many MB) is never synced — local‑only**;
it is captured before a cloud load and re‑attached afterward so a load doesn't drop it.
Save errors are classified honestly (`handleFirestoreSaveError`/`isSizeError`): size vs.
`permission-denied` vs. quota vs. genuine `unavailable`/offline — only real network errors get the
auto‑retry; oversized photos are named and skipped while the rest sync.

**Local photo storage (IndexedDB — same reasoning as the cloud, for `localStorage`'s ~5 MB cap):**
`localStorage` stores strings as UTF‑16, so inline base64 photos overflow it fast and saves then
fail silently. Photos are therefore kept in **IndexedDB** (`db tonys_recipes_db`, store `photos`,
keyed by recipe id, `{ id, photo, originalPhoto }`), while `localStorage` holds only photo‑free
recipe text (`saveLocal` → `stripPhotosLocal`, setting `_ph`/`_po` flags). `savePhotosToIDB`
writes only changed photos and prunes deleted ones; `loadLocal` renders text immediately and
`hydratePhotosFromIDB` re‑attaches photos asynchronously, then re‑renders. Photos stay inline in
the in‑memory `recipes` array (so rendering/backup/export are unchanged). Legacy inline‑in‑
`localStorage` photos are detected on load and migrated to IndexedDB on the next save. If
IndexedDB is unavailable (e.g. private mode) it falls back to the old inline‑in‑`localStorage`
behaviour. The `_ph`/`_po` flags also guard the cloud path so a not‑yet‑hydrated recipe never
wipes its cloud photo.

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
  genuine remote change shows a "refresh" banner (`window._pendingRemoteData`, auto‑hide 30s).
  `applyRemoteUpdate()` applies it. On `permission-denied` it unsubscribes.
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
prep/servings, difficulty pill, favourite heart, a 🔥 badge when `cookCount ≥ 3`, and a video
badge for bookmarks. On phone‑width screens the grid uses a configurable column count
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

- **Excel** (SheetJS `xlsx` 0.18.5 CDN): `exportAllExcel`/`expOneExcel`/`sheetRows`/
  `styleExcelSheet`/`downloadExcelWb`. Import `.xlsx` via `importFromFile`.
- **Word** (`.docx`): **built by hand** as an OOXML zip — `makeDocxBlob` + a tiny `buildZip`
  (store‑only, CRC32) — no library for export. Import `.docx` via **mammoth** 1.6.0 CDN
  (`parseWordText`).
- **PDF/HTML/TXT** import supported by `importFromFile` (accept
  `.xlsx,.xls,.docx,.doc,.pdf,.html,.htm,.txt`), plus a **drag‑and‑drop** zone (`handleFileDrop`)
  and the native **File System Access API** picker (`importViaFilePicker`) as an option.
- **Backup**: `backupSave` writes a single JSON `{version, exportedAt, nextId, recipes, photos,
  settings}` where inline data‑URL photos are **de‑duplicated** into a `photos` map and replaced
  by `__photo__N` refs. `backupRestore`/`backupRestoreFile` reverse it and re‑hydrate. Backup
  buttons are desktop‑only.
- **Local Save Helper**: on desktop, exports can POST base64 to `http://127.0.0.1:27182` so files
  land in `~/Documents/Projects/Recipes App/Backups` with correct Hebrew/Russian names
  (`downloadBlob` tries the helper first, falls back to a normal browser download + a rename hint
  for non‑ASCII names). `checkHelperStatus` flips the ⚙️ indicator dot green when reachable.
  The helper enforces `Access-Control-Allow-Origin: https://rozinante2004-hash.github.io`.

---

## 11. Bring! shopping‑list integration

- **Send** (`openBringModal`→`bringConfirmSend`→`sendItemsToBring`): pick ingredients as
  checkboxes, POST `bring-add` to the Worker. On success, deep‑link `bring://` then fall back to
  `web.getbring.com`.
- **Token lifecycle**: Bring tokens expire ~weekly. `bring_token_expiry` drives a status pill
  (`renderBringTokenStatus`) — connected / expires soon / expired. Refresh flows:
  - **Auto relay** (`openBringAutoRefresh` → `bring-relay.html` popup) tries to read the token
    from `web.getbring.com` localStorage (usually blocked cross‑origin → shows a manual method).
  - **Bookmarklet** (`showBringBookmarklet`): a `javascript:` snippet the user runs on
    `web.getbring.com` that POSTs `bring-settoken` (shared secret `tonys-recipes-2024`).
  - **Expired modal** (`showBringTokenExpired`/`openBringForTokenRefresh`) polls `bring-lists`
    until the token works again, then retries the queued items.

---

## 12. Sharing, email, misc utilities

- **Share app** (`openShareAppModal`): QR code (qrcodejs 1.0.0 CDN) + WhatsApp/copy link.
- **Share recipe** (`toggleShare`/`rText`): native share, WhatsApp (`doWhatsApp`), email
  (`doEmail`/`showEmailModal`), copy (`doCopy`).
- **Gmail API send** (`getGmailToken`/`sendViaGmailApi`): uses the Gmail send scope and a
  user‑provided OAuth client id (`openGmailSetup`, stored in `tonys_gmail_client_id`) to send
  formatted recipe emails; falls back to a copy‑paste hint.
- **Measurement converter** (`openCalcModal`/`convertUnits`): Weight/Volume/Temp/Length with a
  live two‑way calculator.
- **Print** (`printRecipe`): print‑friendly recipe window.
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
- **Toasts** (`toast`), **HTML‑escape** (`escH`), **dropdown/modal helpers** (`toggleDrop`,
  `closeDrop`, `closeM`, `bgClose`).

---

## 13. Built‑in Self‑Test suite (`⚙️ → 🧪 Self Test`)

A first‑class feature — recreate it. `SELF_TESTS` is an array of ~50 checks grouped as **UI,
Core, CRUD, Modals, Network, Storage, Backup, CSS, Features, Import/Export**. The modal
(`openSelfTest`/`runSelfTests`) lets the user pick tests by group, runs them sequentially with
live ✅/❌ status, and for failures shows a **detail card** with error, impact, a suggested fix
(`SELF_TEST_FIXES`), and — where available — an **"Apply Runtime Fix"** button that patches the
running session (e.g. re‑inject `:root` CSS vars, define a missing `sortMode`, call
`renderGrid()`). Network tests ping the Worker health, AI round‑trip, `fetch-url`,
`photo-search`, and `instagram-fetch` (treat IG 404 as pass, only 500 as fail).

---

## 14. Visual design system (CSS)

CSS variables on `:root`:
```css
--cream:#FAF7F2; --warm-brown:#5C3D2E; --terracotta:#C1440E; --gold:#D4A843;
--ink:#1C1A18; --muted:#8A8279; --border:#E8E0D5; --card-bg:#FFFFFF; --bg:#FAF7F2; --green:#2E7D32;
```
- Fonts: `Playfair Display` (titles, italic accents in gold) + `DM Sans` (everything else), from
  Google Fonts.
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
SVG favicon (the fork/flame mark); Google Fonts; and CDN scripts for **xlsx, mammoth, qrcodejs,
Google GSI, Firebase compat (app/auth/firestore)**.

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
- [ ] Excel + hand‑rolled Word export/import, JSON backup/restore (with de‑duped photos), and the
      localhost save helper all work; non‑ASCII filenames handled.
- [ ] Bring! send + all three token‑refresh paths function; expiry pill accurate.
- [ ] Scale/units/nutrition/cook‑count/favourites/recent/sort/search/select‑mode/print/share all
      behave as described.
- [ ] Self‑Test modal runs, reports pass/fail, and runtime fixes apply.
- [ ] **No real secret is committed**; Worker holds `ANTHROPIC_API_KEY`, `PIXABAY_API_KEY`,
      `YOUTUBE_API_KEY`, and the Bring token/KV; Firebase web config may be embedded.
- [ ] GitHub Actions deploys to Pages on push to `main`; `version.json` bump triggers the
      in‑app update banner.

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
9. Sharing/email/Gmail/QR/converter/print/access‑control/payments/deployments.
10. PWA (`manifest.json`, `sw.js`, icons, install banners, version check) + Self‑Test suite.
11. `.github/workflows/deploy.yml`; deploy; smoke‑test with the Self‑Test modal.

> Keep everything in one `index.html` with inline CSS/JS and CDN dependencies. Prefer clarity and
> parity with this spec over modernization. When in doubt, match the observable behaviour above.
