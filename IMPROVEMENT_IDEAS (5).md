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
| 2.1 | **Replace `confirm()`/`prompt()` with styled modals** | Native dialogs look out of place, can't be styled, and on iOS PWAs they're jarring. You already have a nice modal system. | 🟡 |
| ~~2.2~~ | ✅ **DONE (v27.6)** — ~~Ingredient table is the truth~~ | The hidden textarea is gone. `readIngsTable()` reads the rows directly, so the flatten-to-"amount — name"/reparse round trip — which mangled any name containing a dash, e.g. "self-raising flour" — no longer exists. | 🟡 |
| ~~2.3~~ | ✅ **DONE (v27.6)** — ~~Unify clip vs video bookmark~~ | `isClip` is the only flag. `normalizeRecipe` folds legacy `isVideoBookmark` in and deletes it, so old data keeps working while nothing new reads two names for one idea. | 🟢 |
| ~~2.4~~ | ✅ **DONE (v27.2)** — ~~Per-recipe delete~~ | Deleting currently requires entering Select mode; a delete option inside the recipe (now that Undo exists) is more discoverable. | 🟢 |
| ~~2.5~~ | ✅ **DONE (v27.4)** — ~~Better AI empty/error states~~ | `aiFailPane()`/`aiEmptyPane()` name the cause in plain language, link to billing or keys where that's the problem, offer a retry where retrying can help, and always leave a free-hand-paste escape. A failed file import now carries whatever text it *did* extract into the free-hand box. | 🟢 |
| 2.6 | **Save Helper — ON HOLD, one test still outstanding** | Measured on Ubuntu/Chrome 137: **1. `<a download>` → "download" ❌**, **2. File System Access API → "download" ❌** (so my original suggestion was simply wrong), **3. Worker UTF-8 download → still not run** (the test page used to consume the single-use link; fixed, needs a re-run), **4. Python helper → ✅ correct Hebrew filename**. The helper stays until test 3 is re-run. | 🟡 |
| 2.7 | **Consolidate the 2 500-line `<style>` block** | Group by component and drop dead rules (several classes have no matching markup). Pure maintainability. | 🟡 |

---

## 3. New functionality worth considering

### 3.1 Meal planner + auto shopping list 🔴
Assign recipes to days on a weekly calendar, then push **the whole week's** ingredients to Bring!
in one go, with quantities merged (2 recipes × 1 onion = "2 onions"). This is the natural next
step for an app that already has recipes + Bring! integration, and it's the feature most likely
to change how you cook week-to-week.

### 3.2 Pantry / "what can I make?" 🟡
Keep a rough list of staples you always have, then flag recipes you can make with only 1–2 items
missing. Pairs with the AI you already pay for.

### 3.3 Smarter scaling 🟡 — ✅ **DONE (v27.4)**
A "Make it for [N] servings" stepper sits **alongside** the ×1–×6 buttons, not in place of them,
and only appears when the recipe's servings field actually holds a number. Amounts now round to
values a cook can measure (nearest 5 above 100, whole above 20, half above 2, quarter above 0.5),
and countable things that land on a fraction — "2.5 eggs" — are flagged rather than presented as
a measurement. Scaling also stopped rewriting spacing: "200g" scales to "300g", not "300 g".
*Not done:* AI weight↔volume conversion for individual ingredients.

### 3.4 Recipe versions / edit history 🟡
"I've tweaked this three times and the second version was best." Keep the last N revisions in the
recipe object; huge value for a *family* collection where several people edit.

### 3.5 Cooking notes & ratings per attempt 🟢 — ✅ **DONE (v27.4)**
"🍳 Cooked!" now offers an optional 1–5 star rating and a note; *Just log it — no note* keeps the
old one-tap behaviour. Entries live in `r.cookLog` and show in the recipe as an average plus a
collapsible log. Unrated cooks don't drag the average down, and deleting a note doesn't rewrite
how many times you've cooked it.

### 3.6 Better sharing 🟡
A read-only public link for a single recipe (a static page rendered from the recipe JSON) so you
can send a recipe to a friend who doesn't use the app — much nicer than pasting text.

### 3.7 Voice control while cooking 🟡
"Next step", "repeat" via the Web Speech API. Genuinely useful with dirty hands; works well in
Chrome/Android, partial on iOS.

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
| 5.4 | **Firestore: one document per recipe** | The whole collection is a single document, so any edit rewrites everything and two people editing at once can clobber each other. Per-recipe docs fix both. | 🔴 |
| ~~5.5~~ | ✅ **DONE (v27.6)** — ~~Firestore rules in the repo~~ | `firestore.rules` is now the source of truth; the app fetches it and substitutes `{{READ}}`/`{{WRITE}}`/`{{ADMIN}}` from the member list. The built-in copy is a labelled fallback for offline use, not a silent second version. Publishing is still a deliberate manual paste. | 🟢 |
| 5.6 | **Automated tests in CI** | The Self Test suite is excellent but must be run by hand. The same checks could run headlessly on every push via GitHub Actions. | 🟡 |
| ~~5.7~~ | ✅ **DONE (v27.4)** — ~~Cache AI calls~~ | Keyed on model + token budget + exact prompt, 7-day TTL, capped at 40 entries, evicted oldest-first. Tool-using calls and failures are deliberately never cached, and a quota error drops the cache rather than the recipes. | 🟢 |
| ~~5.8~~ | ✅ **DONE (v27.6)** — ~~Retire the `_ph`/`hp` dual flags~~ | `_ph` is the single name for "the photo lives elsewhere", local and cloud alike. Reads still accept the legacy `hp` so documents written by older versions keep working; writes only ever emit `_ph`. | 🟢 |

---

## 6. My top 5 if you only do a few

1. ~~**Cook Mode**~~ ✅ **shipped in v27.0** (with step timers and ingredient check-off).
2. **Meal planner + merged shopping list** (3.1) — the standout new capability.
3. ~~**Dark mode** (4.6)~~ ✅ **shipped in v27.3**.
4. **Per-recipe Firestore documents** (5.4) — removes the last structural sync risk. *(Batch E)*
5. ~~**Smarter units**~~ ✅ **shipped in v27.1** (metric leaves tsp/tbsp/cup alone) **and v27.4** (sensible rounding).

> **Noticed while building Cook Mode:** the Metric/Imperial toggle converts *every*
> imperial-ish unit, so `2 tsp` renders as `9.9ml` and `1 cup` as `240ml`. Teaspoons,
> tablespoons and cups are standard kitchen measures in metric kitchens too — converting
> them makes recipes harder to follow, not easier. Suggested fix: in Metric mode convert
> only genuinely imperial units (lb, oz, fl oz) and leave tsp/tbsp/cup alone, plus round
> to sensible cooking values. Small change, noticeable improvement — say the word.
