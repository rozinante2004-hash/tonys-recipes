# Tony's Recipes — Improvement Ideas

A running backlog of suggestions, ordered so the highest value-for-effort items come first
within each section. Items marked ✅ have since been built; the rest is a menu to pick from.

**Effort key:** 🟢 small (under an hour) · 🟡 medium (a session) · 🔴 large (multi-session)

---

## 1. Quick wins — high value, low effort

| # | Idea | Why it matters | Effort |
|---|------|----------------|--------|
| ~~1.1~~ | ✅ **DONE (v27.0)** — ~~Cook Mode~~ — a full-screen, large-type step-by-step view with the screen kept awake and big "next/previous" targets | You already request a wake lock, but the normal view is small-text and scroll-heavy. This is the single biggest *actual cooking* improvement: readable at arm's length with messy hands. | 🟡 |
| ~~1.2~~ | ✅ **DONE (v27.0)** — ~~Tap a step to cross it off~~ | Trivial to add, hugely useful mid-cook — you never lose your place. Persist per session only. | 🟢 |
| ~~1.3~~ | ✅ **DONE (v27.0, inside Cook Mode)** — ~~Ingredient checkboxes~~ | Same idea for shopping/prep; pairs naturally with the Bring! feature. | 🟢 |
| ~~1.4~~ | ✅ **DONE (v27.2)** — ~~Duplicate recipe~~ | The fastest way to create a variant ("…but with chicken"). One menu item, ~10 lines. | 🟢 |
| ~~1.5~~ | ✅ **DONE (v27.2)** — ~~"Recently added" sort~~ | You have recent-*viewed*; recently-*added* is what you usually want after importing a batch. | 🟢 |
| ~~1.6~~ | ✅ **DONE (v27.2)** — ~~Confirm-before-losing-edits~~ | Closing the edit modal with unsaved changes silently discards them today. | 🟢 |
| ~~1.7~~ | ✅ **DONE (v27.2)** — ~~photo count / "no photo" filter~~ | Makes "Auto-fetch missing photos" easier to target. | 🟢 |
| ~~1.8~~ | ✅ **DONE (v27.0)** — ~~Timers detected in steps~~ — turn "simmer for 20 minutes" into a tappable timer | Delightful, and genuinely useful. Regex + a small countdown UI. | 🟡 |

---

## 2. Fixing rough edges in what already exists

| # | Idea | Why | Effort |
|---|------|-----|--------|
| ~~2.1~~ | ✅ **DONE (v27.7)** — ~~Styled confirm/prompt~~ | `askConfirm()`/`askPrompt()` return promises and replace every native dialog. Destructive actions get a red button and say what they'll do rather than a neutral "OK". The one remaining `confirm()` is the last-ditch fallback if the unsaved-changes modal itself is missing — deliberate, so edits can never become unclosable. | 🟡 |
| ~~2.2~~ | ✅ **DONE (v27.6)** — ~~Ingredient table is the truth~~ | The hidden textarea is gone. `readIngsTable()` reads the rows directly, so the flatten-to-"amount — name"/reparse round trip — which mangled any name containing a dash, e.g. "self-raising flour" — no longer exists. | 🟡 |
| ~~2.3~~ | ✅ **DONE (v27.6)** — ~~Unify clip vs video bookmark~~ | `isClip` is the only flag. `normalizeRecipe` folds legacy `isVideoBookmark` in and deletes it, so old data keeps working while nothing new reads two names for one idea. | 🟢 |
| ~~2.4~~ | ✅ **DONE (v27.2)** — ~~Per-recipe delete~~ | Deleting currently requires entering Select mode; a delete option inside the recipe (now that Undo exists) is more discoverable. | 🟢 |
| ~~2.5~~ | ✅ **DONE (v27.4)** — ~~Better AI empty/error states~~ | `aiFailPane()`/`aiEmptyPane()` name the cause in plain language, link to billing or keys where that's the problem, offer a retry where retrying can help, and always leave a free-hand-paste escape. A failed file import now carries whatever text it *did* extract into the free-hand box. | 🟢 |
| 2.6 | **Save Helper — ON HOLD, one test still outstanding** | Measured on Ubuntu/Chrome 137: **1. `<a download>` → "download" ❌**, **2. File System Access API → "download" ❌** (so my original suggestion was simply wrong), **3. Worker UTF-8 download → still not run** (the test page used to consume the single-use link; fixed, needs a re-run), **4. Python helper → ✅ correct Hebrew filename**. The helper stays until test 3 is re-run. | 🟡 |
| ~~2.7~~ | ⚠️ **PART DONE (v27.7)** | Dead rules: removing Cook Mode took 3.8 KB of CSS with it, and a strict scan now finds **zero** unreferenced classes, so there is nothing left to drop. The *reorganisation* half is deliberately not done: shuffling 200 KB of stylesheet in a single-file app is a large diff with no behavioural gain and real regression risk. Worth doing as part of 5.1 (splitting the file), not before. | 🟡 |

---

## 3. New functionality worth considering

### 3.1 Meal planner + auto shopping list 🔴
Assign recipes to days on a weekly calendar, then push **the whole week's** ingredients to Bring!
in one go, with quantities merged (2 recipes × 1 onion = "2 onions"). This is the natural next
step for an app that already has recipes + Bring! integration, and it's the feature most likely
to change how you cook week-to-week.

### 3.2 Pantry / "what can I make?" 🟡 — ✅ **DONE (v27.9)**
⚙️ Settings → 🥫 My Pantry holds your staples; More → 🥫 What can I make? ranks every recipe by how
few things you'd need to buy and names the missing ones. Matching is loose in both directions, so
"olive oil" covers "good olive oil" and Hebrew prefixes still match. No AI call needed.

### 3.3 Smarter scaling 🟡 — ✅ **DONE (v27.4)**
A "Make it for [N] servings" stepper sits **alongside** the ×1–×6 buttons, not in place of them,
and only appears when the recipe's servings field actually holds a number. Amounts now round to
values a cook can measure (nearest 5 above 100, whole above 20, half above 2, quarter above 0.5),
and countable things that land on a fraction — "2.5 eggs" — are flagged rather than presented as
a measurement. Scaling also stopped rewriting spacing: "200g" scales to "300g", not "300 g".
*Not done:* AI weight↔volume conversion for individual ingredients.

### 3.4 Recipe versions / edit history 🟡 — ✅ **DONE (v27.9)**
Every edit pushes the previous state onto `r.history`, capped at 3, shown in the recipe with a
Restore button. Restoring snapshots the current state first, so it is never a one-way door.
**History now syncs (v28.0), in the per-recipe document only.** It was originally excluded because
three revisions take a recipe from 1.7 KB to 6.2 KB, which cut the single shared document's
capacity from ~610 recipes to ~170. Per-document that ceiling is gone, so 5.4 let history travel
as promised. The legacy `shared/recipes` copy stays history-free — for a device on v27.9 the
ceiling is still real.

### 3.5 Cooking notes & ratings per attempt 🟢 — ✅ **DONE (v27.4)**
"🍳 Cooked!" now offers an optional 1–5 star rating and a note; *Just log it — no note* keeps the
old one-tap behaviour. Entries live in `r.cookLog` and show in the recipe as an average plus a
collapsible log. Unrated cooks don't drag the average down, and deleting a note doesn't rewrite
how many times you've cooked it.

### 3.6 Better sharing 🟡 — ✅ **DONE (v27.9), as a file rather than a link**
Share → 🌐 Save as a web page produces a self-contained HTML file: photo embedded, no scripts, no
external requests, bidi-safe, ~2 KB plus the photo. Send it by email or WhatsApp and it opens in
any browser, on any device, forever.
*Why a file and not a public URL:* a hosted link needs a server to serve it, and publishing family
recipes to a public endpoint is a bigger decision than a share button should make on your behalf.
Say the word if you'd rather have hosted links — the Worker could do it.

### 3.7 Voice control while cooking 🟡 — ✅ **DONE (v27.7)**
"Next", "back", "repeat", "clear", "ingredients", "steps" — in English and Hebrew — move the line
marker without touching the phone. Deliberately narrow: voice can only move your place and read
the current line back. It cannot edit, delete or save anything, and there is a test asserting the
command handler can't even reach those functions, so a misheard word can never cost you a recipe.
The button only appears where the Web Speech API actually works (Chrome yes, Firefox no, iOS Safari
unreliable).

### 3.9 WhatsApp group knowledge 🟡 — ✅ **DONE (v27.3)**
Ask questions of your food-related WhatsApp groups. WhatsApp has **no API** for reading group
content, and libraries that drive WhatsApp Web breach its Terms of Service and get numbers
banned — so this works off WhatsApp's own *Export chat → Without media* `.txt` files.

- **⚙️ Settings → 💬 WhatsApp Groups** configures two kinds of source: a **shared folder** of
  `.txt` files served over HTTPS (the repo's `whatsapp/` folder plus an `index.json`), which
  every device including the iPhone can read; and **device-local import**, kept in IndexedDB
  and never uploaded.
- **More → 💬 Ask my WhatsApp groups** scores every message against the question, pulls each
  hit's surrounding conversation (the replies rarely repeat the question's words), and asks the
  AI to collate *all* the answers: one recommended answer first, other viable options listed
  with who suggested them and their trade-offs, and disagreements called out rather than
  silently resolved. The source messages are shown behind a disclosure.
- **Zipped exports are read directly (v27.5):** WhatsApp hands you a `.zip` containing
  `_chat.txt`; the app sniffs the header and unzips it with `DecompressionStream`, so no manual
  unpacking, and the file extension is irrelevant. Group joins/leaves are filtered out.
- **What cannot be automated:** the export itself. No platform offers a scheduled or
  programmatic export. The *upload* afterwards can be — on iPhone, a Shortcut that takes the
  file from the Share sheet and PUTs it to the repo via the GitHub API makes it a two-tap job.

### 3.8 Nutrition upgrade 🟢 — ❌ **Declined (Jul 2026)**
Tony is happy with per-100g figures; no per-serving toggle or confidence caveat wanted.

---

## 4. Usability & design

| # | Idea | Why |
|---|------|-----|
| ~~4.1~~ | ✅ **DONE (v27.1)** — ~~Card titles hard-coded `text-align:right`~~ | Also found `direction: auto` (not valid CSS) and `direction: rtl` forced on list names. Now `dir="auto"` + `unicode-bidi:plaintext` + `text-align:start` everywhere, including email and print. |
| ~~4.2~~ | ✅ **DONE (v27.3)** — ~~Show *why* a card matched~~ | Cards now carry a "🧂 …" / "📋 …" line with the matched run in `<mark>`, escaped before highlighting. |
| ~~4.3~~ | ✅ **DONE (v27.3)** — ~~Sticky ingredient panel~~ | At ≥1000px the recipe view widens to 900px and splits into a sticky ingredients column beside the method. |
| ~~4.11~~ | ✅ **DONE (v28.3)** — ~~phone grid card is too busy~~ | Prep time and servings cost a whole line on a card barely wider than a thumb, and both are one tap away inside the recipe. The phone grid now shows photo, category badge, name, difficulty pill and the heart — nothing else. **List view keeps them at every width**, since that is the view you switch to when those numbers are what you are scanning for. |
| 4.4 | **Filter chips should show counts** | "Dinner (12)" tells you where your collection actually is. |
| ~~4.5~~ | ✅ **DONE (v27.2)** — ~~whole "Add photo" hero clickable~~ | The small 📷 button is easy to miss on a phone. |
| ~~4.6~~ | ✅ **DONE (v27.3)** — ~~Dark mode~~ | ⚙️ Settings → Theme cycles Light / Dark / Auto (Auto follows the OS live). Needed a new `--heading` variable: `--warm-brown` was doing duty as both a surface and heading text, which have to move in opposite directions. |
| ~~4.7~~ | ✅ **DONE (v27.3)** — ~~Sync feedback~~ | An empty grid gets skeletons during a cloud sync; a populated grid gets a quiet ☁ pulse on the section label, because replacing visible recipes with grey boxes is a downgrade. |
| 4.8 | **Larger touch targets in the header** | Several header buttons are ~28 px; the accessibility guideline is 44 px, and they're the most-tapped controls. |
| ~~4.9~~ | ✅ **DONE (v27.2)** — ~~empty state for "no photos yet"~~ | Prompt to auto-fetch, rather than a wall of emoji tiles. |
| ~~4.10~~ | ✅ **DONE (v27.3)** — ~~Consistent iconography~~ | The two hand-rolled inline-SVG clip badges are now one `.clip-badge` 🎬 component, matching the emoji language used everywhere else. |

---

## 5. Technical health

| # | Idea | Why | Effort |
|---|------|-----|--------|
| 5.1 | **Split `index.html` into modules** | It's ~9 200 lines in one file. Even splitting CSS and JS into separate files (still no build step, just `<link>`/`<script src>`) would make everything easier and let the browser cache them separately. | 🟡 |
| ~~5.2~~ | ✅ **PARTLY DONE (v27.6)** — ~~Blobs in IndexedDB~~ | **Thumbnails** are stored as real Blobs and go straight to an object URL, with no base64 anywhere in the path. **Full photos are still base64** in memory and in IDB, on purpose: export, backup, cloud sync, email and print all consume data URLs, so converting them is a much wider change than the storage line implies. Worth revisiting only if full-photo memory becomes a real problem. | 🟡 |
| ~~5.3~~ | ✅ **DONE (v27.6)** — ~~Thumbnails~~ | A 320 px JPEG per recipe, generated once and cached in IndexedDB. Measured on a photo-like 1600×1200 image: **252 KB → 10.8 KB (23×)**, and a 12-tile grid re-render went from **288 ms to 1 ms**. Falls back to the full photo until the thumbnail exists, so a failure is never a blank tile. | 🟡 |
| ~~5.4~~ | ⚠️ **STEPS 1–2 OF 3 DONE (v28.0, v28.1)** — ~~one document per recipe~~ | `shared/recipe_<id>` per recipe plus `shared/meta` (`nextId`, `ids`, `schema: 2`). A save now writes **only what changed**, and a write whose base is older than the cloud copy is **refused with an honest message** rather than silently overwriting someone — that lost-edit case was the whole point. Migration runs on first load, is idempotent and safe to interrupt (`schema` is stamped last). v28.0 dual-wrote the old `shared/recipes` document; **v28.1 stopped writing it**, which removes the last blind whole-collection overwrite. It is still read once per load so a device left on v27.9 cannot lose edits, and is deleted by hand later. **The two-browser checks in PLAN §7 have not been run** — they need two real signed-in sessions. | 🔴 |
| ~~5.5~~ | ✅ **DONE (v27.6)** — ~~Firestore rules in the repo~~ | `firestore.rules` is now the source of truth; the app fetches it and substitutes `{{READ}}`/`{{WRITE}}`/`{{ADMIN}}` from the member list. The built-in copy is a labelled fallback for offline use, not a silent second version. Publishing is still a deliberate manual paste. | 🟢 |
| ~~5.6~~ | ✅ **DONE (v28.8)** — ~~automated tests in CI~~ | The Self Test suite is excellent but must be run by hand. Reason for revisiting: the suite is now 128 checks, and in Aug 2026 it caught a bug *Tony had to report himself* because the headless runner did not reproduce in-app conditions (`a11y_basics` closed the suite out from under itself). Now runs on every push. `tests/run-self-tests.js` is in the repo, skips the 6 network/Firebase checks explicitly rather than tolerating them, and **also fails the build on a test that closes the suite or strands a dialog** — that class of breakage makes later tests run blind while still reporting green, which is exactly how the bug got out. Verified both ways: a broken assertion and a suite-closing test each exit 1. The workflow also checks `version.json` agrees with all four version strings in `index.html`, since a mismatch ships an update nobody is told about. | 🟡 |
| ~~5.7~~ | ✅ **DONE (v27.4)** — ~~Cache AI calls~~ | Keyed on model + token budget + exact prompt, 7-day TTL, capped at 40 entries, evicted oldest-first. Tool-using calls and failures are deliberately never cached, and a quota error drops the cache rather than the recipes. | 🟢 |
| ~~5.8~~ | ✅ **DONE (v27.6)** — ~~Retire the `_ph`/`hp` dual flags~~ | `_ph` is the single name for "the photo lives elsewhere", local and cloud alike. Reads still accept the legacy `hp` so documents written by older versions keep working; writes only ever emit `_ph`. | 🟢 |
| ~~5.9~~ | ✅ **DONE (v28.4)** — ~~cache cloud reads by `updatedAt`~~ | 5.4 traded writes for reads and the trade is currently uncapped: a cold load costs `1 + N recipes + M photos`, and the foreground-refresh listener re-runs the whole fan-out every time the app is focused (throttled 20 s). At 200 recipes with 150 photos that is ~350 reads per refresh against a 50 000/day free tier — ~140 focus events and you are rate-limited. Before 5.4 it was 2 reads. A refresh that finds `meta.updatedAt` unmoved now costs **2 reads instead of ~350** — one for `meta`, one for the legacy document (which a v27.9 device could still have written, and which drops away when that document is finally deleted). The stamp persists, so cold starts benefit too. `canSkipCloudFanout` refuses on any doubt: offline edits queued, nothing held locally, cloud listing more recipes than we hold, or no full read ever done on this device. | 🟡 |
| 5.10 | **Photos to Firebase Storage instead of base64 in Firestore** — ⏸ **DEFERRED, judged risky (Aug 2026)** | Base64 inflates every photo ~33 %, and Firestore bills document reads where Storage would give a CDN and byte-range fetches. Deferred deliberately: export, backup, cloud sync, email and print **all** consume data URLs (a decision recorded in CLAUDE.md), so this is not a storage swap — it is a change to every path that consumes a photo, plus new Storage rules and a migration of live data. Worth doing only when storage cost or photo latency actually hurts. | 🔴 |
| ~~5.11~~ | ✅ **DONE (v28.5)** — ~~lazy-load the heavy libraries~~ | `xlsx`, `mammoth` and `qrcodejs` are blocking `<script>` tags in `<head>`, so every visit pays for them even though most sessions never import a spreadsheet or a Word file. Verified: a cold load now requests **none** of them. `loadScriptOnce()` fetches xlsx/mammoth on first use and rejects honestly if the CDN is unreachable, so the import says so instead of throwing from inside a library that was never there. **Excel export and the QR share code were removed outright** as little-used; Excel *import* stays, lazily. | 🟢 |
| ~~5.12~~ | ✅ **DONE (v28.5)** — ~~faster repeat loads~~ | The service worker is network-first for the document, so every cold load re-downloads ~209 KB gzipped even when nothing changed. The app already polls `version.json` and shows an update banner, which makes a cache-first-then-revalidate document strategy safe: instant paint, update in the background, banner when a new version really lands. (Serving a pre-compressed file is *not* the answer — GitHub Pages already compresses; the real win beyond this is 5.1, splitting the file so CSS/JS cache separately across releases.) | 🟡 |

---

## 5b. Aesthetics

| # | Idea | Why | Effort |
|---|------|-----|--------|
| ~~5b.1~~ | ✅ **DONE (v28.6)** — ~~Hebrew typography~~ | Playfair Display and DM Sans have **no Hebrew glyphs**, so every Hebrew title renders in whatever generic serif the OS picks while the English title beside it is Playfair — the grid reads as two different apps. For a collection that is bilingual first, this is the most visible polish item in the app. Google Fonts serves Hebrew-capable pairs: **Frank Ruhl Libre** as the Playfair counterpart, **Heebo** or **Assistant** for DM Sans. **Frank Ruhl Libre** now backs Playfair and **Heebo** backs DM Sans, in all 165 font stacks, so print, email and shared pages get it too. CSS resolves font-family per *glyph*, so a mixed English/Hebrew string renders each script in its own face. | 🟢 |
| ~~5b.2~~ | ✅ **DONE (v28.6)** — ~~card footers do not align across a row~~ | When one title wraps to two lines its difficulty pill and heart sit lower than its neighbours'. The card is a column flex with a growing body, so footers pin to the bottom. Measured across a row: 522/522/522 px. | 🟢 |
| ~~5b.4~~ | ✅ **DONE (v29.1)** — ~~Hebrew recipes mirror the two-column layout~~ | At ≥1000px the recipe splits into ingredients + method. A Hebrew recipe reads right-to-left, so the ingredients belong on the **right**; `recipeIsRTL()` judges from the recipe body (an English title on a Hebrew recipe is common) and stamps `dir="rtl"` on the grid container. Verified by measurement: ingredients at x=748, method at x=212. | 🟢 |
| ~~5b.3~~ | ❌ **WITHDRAWN — the claim was wrong** | I suggested list thumbnails were not square-cropped. They are: `.recipe-list-thumb` is a fixed 52×52 box and its `img` is `object-fit: cover`, which is exactly the same framing the grid tiles get. Nothing to fix. Left here rather than deleted so the same non-problem isn't 'found' again. | — |

---

## 5c. UI / UX

| # | Idea | Why | Effort |
|---|------|-----|--------|
| ~~5c.1~~ | ✅ **DONE (v28.7)** — ~~keyboard access — there is none~~ | Zero `tabindex` in the file; recipe cards are `<div onclick>`. The grid cannot be reached or opened from the keyboard at all. Cards and list rows are now `tabindex=0 role=button` with an accessible name, Enter/Space open them, and `:focus-visible` shows a terracotta ring for keyboard users without outlining every tapped card. Driven in a real browser: tab to a card, press Enter, recipe opens. | 🟢 |
| ~~5c.2~~ | ✅ **DONE (v28.7)** — ~~swipe on phone → favourite only~~ | Swipe a card to toggle the heart. **Never swipe-to-delete** — explicitly rejected: destructive actions should not be one careless thumb away, undo or no undo. There is a test asserting the swipe handler cannot even reach `deleteRecipe`, `deleteSelected`, `queueCloudDelete` or `recipes.splice`. The gesture is abandoned as soon as vertical movement dominates, so scrolling the grid never flips a heart — all three cases verified with synthetic touches. | 🟡 |
| ~~5c.3~~ | ✅ **DONE (v28.7)** — ~~pull-to-refresh~~ | The app already re-syncs when it returns to the foreground; making that a deliberate gesture turns invisible magic into something you can ask for and watch happen. Reports honestly afterwards — "Updated from the cloud" or "Already up to date" — rather than always claiming a refresh. | 🟢 |
| ~~5c.4~~ | ✅ **DONE (v28.7), in select mode** | "🍳 Cooked!" needed the recipe open. It is now a **select-mode bulk action** rather than a button on the card: the phone card was just stripped back to photo/category/difficulty/heart and putting a button back on it would undo that. Select several, tap 🍳 Cooked — which is exactly the shape of cooking a few things in one session. | 🟢 |

---

## 5d. Backend & safety

| # | Idea | Why | Effort |
|---|------|-----|--------|
| ~~5d.1~~ | ✅ **DONE (v28.8), as a reminder rather than a silent download** | Backup is manual *and* desktop-only, which means the safety net is missing exactly when it matters — after a schema change, or on the phone. The app now records when a backup was actually taken and nudges — with a button — once it is over 30 days old or has never happened. Deliberately *not* an automatic file download: writing files nobody asked for is intrusive, and a backup that silently lands in Downloads is not one you can rely on. Seed-only collections are not nagged. | 🟡 |
| ~~5d.2~~ | ✅ **DONE (v28.8)** — ~~sweep orphaned `photo_<id>` documents~~ | Now that deletion is admin-only, a write-role member removing a photo silently fails to delete its cloud document (`syncCloudPhotos` swallows the error). Nothing ever cleans those up. ⚙️ Settings → 🧹 Clean up orphaned photos finds photo documents whose recipe is gone and removes them, only ever touching ids absent from the live collection, and reporting an admin-only refusal honestly instead of silently doing nothing. | 🟢 |
| 5d.3 | **Finish 5.4** | Delete the legacy `shared/recipes` document by hand once no device can be on v27.9, removing `reconcileLegacyStragglers` and the `recipes` listener with it. And run the two-browser concurrency checks in PLAN §7, which still have not been done. | 🟢 |

---

## 5e. Visibility

| # | Idea | Why | Effort |
|---|------|-----|--------|
| ~~5e.1~~ | ✅ **DONE (v28.9)** — ~~sync health panel~~ | The sync pill is the only window into the cloud. Show last successful sync, pending offline queue, refused-conflict count, `recipe_*` documents vs local recipes, and reads used today against the free tier. The 5.4 migration ran on live data with no way to watch it — ⚙️ Settings → 📡 Sync Health. Every figure is read from live state, and anything not actually observed says **unknown** rather than guessing — signed out, the cloud rows say so instead of showing a number. Reads are tallied per calendar day against the 50 000 free tier, so 5.9's saving is visible rather than claimed. | 🟡 |

---

## 5f. Functionality

| # | Idea | Why | Effort |
|---|------|-----|--------|
| ~~5f.1~~ | ⚠️ **PART DONE (v29.0)** — ~~Instagram import~~ | The current `instagram-fetch` path is effectively dead — oEmbed has needed auth, so it 404s, and the self-test treats 404 as a pass. Meta made oEmbed **tokenless again on 15 June 2026** for public posts, so this is worth rebuilding rather than retiring. Note the caption is what carries the recipe, and oEmbed returns a title/caption rather than the full post body, **What shipped:** sharing a post from Instagram now uses the caption it carries rather than following the link (the link is the weaker half — Instagram will not give the caption back over the API); the Worker calls the tokenless endpoint and mines the embed blockquote for a caption fragment, flagging `partial` when it is too short to be a recipe; and the failure pane offers paste / open / bookmark instead of dead-ending. **The Worker change is NOT deployed** — it is pasted into the Cloudflare dashboard by hand, and the repo copy can lag production, so apply it onto the currently-deployed version. | 🟡 |
| 5f.2 | **Duplicate detection on import** | Importing the same URL twice silently creates two recipes. Match on source URL and near-identical names, then offer merge or keep-both. | 🟢 |
| 5f.3 | **Ingredient-level search** | "must contain *all* of: chicken, lemon". Search is currently OR-ish across fields. | 🟡 |
| 5f.4 | **Bulk re-categorise / bulk diet-tag** | Select mode exists and AI diet tagging exists; they do not meet. | 🟢 |
| 5f.5 | **"One item away" filter** | The pantry and the missing-ingredient ranking are already built (3.2); surfacing "you are one shop item from cooking this" as a filter chip is a small addition to shipped machinery. | 🟢 |
| 5f.6 | **Meal planner (3.1)** — ⏸ **low priority, by Tony's own account** | The market treats weekly meal planning as table stakes and pantry + Bring! were the hard half, so it is now a smaller job than when it was declined. But Tony cooks once a week, at the weekend, so a weekly planner solves a problem he does not have. Recorded, not queued. | 🔴 |

---

## 5a. Keeping your place (v27.7–v27.8)

**Tick-off boxes (v27.8).** Every ingredient and step has a checkbox; ticking strikes the line
through so you can see what's in the bowl and what's done. Session-only by design — held in
memory, never written to storage, wiped when the recipe closes, so the next cook starts clean.

> **iPhone voice freeze (fixed in v27.8).** `onend` restarted recognition synchronously with no
> guard. iOS defines `webkitSpeechRecognition` but cannot honour `continuous`, so it ended
> instantly, restarted instantly, and the resulting tight loop pegged the main thread — the app
> froze showing "Listening…" with no way out. Three fixes: iOS is excluded from `voiceSupported()`
> so the button never appears there; restarts are deferred and capped, so a failing engine switches
> itself off instead of spinning; and a watchdog plus Escape always stop listening.


Cook Mode is gone. In its place, tapping any ingredient or step marks where you are and a single
highlight **slides** to it; tapping the same line twice, or double-tapping the recipe, clears it.
The position is stored per recipe, so scaling, switching units, closing the recipe or reopening it
never loses your place. Quick taps down a list move the marker rather than being read as a double
tap — keying the gesture to the line, not just the clock, is what makes that work.

## 6. My top 5 if you only do a few

1. ~~**Cook Mode**~~ — shipped in v27.0, **removed in v27.7** at Tony's request: he wants the whole
   recipe visible at once, not one step at a time. Replaced by the line marker (below). The step
   timers survived the removal and now sit on the steps themselves.
2. **Meal planner + merged shopping list** (3.1) — the standout new capability.
3. ~~**Dark mode** (4.6)~~ ✅ **shipped in v27.3**.
4. ~~**Per-recipe Firestore documents** (5.4)~~ ⚠️ **steps 1–2 shipped (v28.0, v28.1)** — the
   structural sync risk is gone; all that remains is deleting the legacy document by hand.
5. ~~**Smarter units**~~ ✅ **shipped in v27.1** (metric leaves tsp/tbsp/cup alone) **and v27.4** (sensible rounding).

> **Noticed while building Cook Mode:** the Metric/Imperial toggle converts *every*
> imperial-ish unit, so `2 tsp` renders as `9.9ml` and `1 cup` as `240ml`. Teaspoons,
> tablespoons and cups are standard kitchen measures in metric kitchens too — converting
> them makes recipes harder to follow, not easier. Suggested fix: in Metric mode convert
> only genuinely imperial units (lb, oz, fl oz) and leave tsp/tbsp/cup alone, plus round
> to sensible cooking values. Small change, noticeable improvement — say the word.
