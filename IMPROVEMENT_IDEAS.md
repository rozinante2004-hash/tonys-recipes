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
| 1.4 | **Duplicate recipe** | The fastest way to create a variant ("…but with chicken"). One menu item, ~10 lines. | 🟢 |
| 1.5 | **"Recently added" sort** | You have recent-*viewed*; recently-*added* is what you usually want after importing a batch. | 🟢 |
| 1.6 | **Confirm-before-losing-edits** | Closing the edit modal with unsaved changes silently discards them today. | 🟢 |
| 1.7 | **Show a photo count / "no photo" filter** | Makes "Auto-fetch missing photos" easier to target. | 🟢 |
| ~~1.8~~ | ✅ **DONE (v27.0)** — ~~Timers detected in steps~~ — turn "simmer for 20 minutes" into a tappable timer | Delightful, and genuinely useful. Regex + a small countdown UI. | 🟡 |

---

## 2. Fixing rough edges in what already exists

| # | Idea | Why | Effort |
|---|------|-----|--------|
| 2.1 | **Replace `confirm()`/`prompt()` with styled modals** | Native dialogs look out of place, can't be styled, and on iOS PWAs they're jarring. You already have a nice modal system. | 🟡 |
| 2.2 | **Make the edit form's ingredient table the single source of truth** | There's a table *and* a hidden textarea kept in sync; that dual path is fragile and was the source of past parsing quirks. | 🟡 |
| 2.3 | **Unify "clip" vs "video bookmark"** | Two overlapping flags (`isClip`, `isVideoBookmark`) mean the same thing to a user and have caused inconsistent badges. Collapse to one concept. | 🟢 |
| 2.4 | **Per-recipe delete** | Deleting currently requires entering Select mode; a delete option inside the recipe (now that Undo exists) is more discoverable. | 🟢 |
| 2.5 | **Better empty/error states for AI failures** | When the AI returns nothing useful, you get a generic message; offering "try free-hand paste" inline would recover the flow. | 🟢 |
| 2.6 | **Possibly retire the local Save Helper — UNVERIFIED** | ⚠️ *Corrected:* I originally implied this was solved. It is **not confirmed**. Hebrew names saving as "Download" is a real, known Chrome-on-Linux behaviour with the `<a download>` method the app falls back to. There are two candidate replacements: (a) the **File System Access API**, and (b) the **Worker's `download-store`**, which already serves `Content-Disposition: filename*=UTF-8''…` — **your Worker supports this today but the app never calls it**. Use `filename-test.html` to find out which actually work on your machine before changing anything. | 🟡 |
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

### 3.3 Smarter scaling 🟡
Scale by **target servings** ("make it for 6") rather than ×2/×3, and handle awkward units
(1 egg → "1½ eggs" is silly; round sensibly and warn). Also convert between weight and volume for
common ingredients using the AI.

### 3.4 Recipe versions / edit history 🟡
"I've tweaked this three times and the second version was best." Keep the last N revisions in the
recipe object; huge value for a *family* collection where several people edit.

### 3.5 Cooking notes & ratings per attempt 🟢
You already track `cookCount`; add a short note + 1–5 stars per cook ("too salty, halve the soy").
Very low effort, high long-term value.

### 3.6 Better sharing 🟡
A read-only public link for a single recipe (a static page rendered from the recipe JSON) so you
can send a recipe to a friend who doesn't use the app — much nicer than pasting text.

### 3.7 Voice control while cooking 🟡
"Next step", "repeat" via the Web Speech API. Genuinely useful with dirty hands; works well in
Chrome/Android, partial on iOS.

### 3.8 Nutrition upgrade 🟢
Nutrition is currently per-100g and AI-estimated. Add per-serving toggle and show a confidence
caveat — right now the number looks more authoritative than it is.

---

## 4. Usability & design

| # | Idea | Why |
|---|------|-----|
| 4.1 | **Card titles are hard-coded `text-align:right`** | This suits Hebrew but looks wrong for English titles. Use `dir="auto"` and let alignment follow the text, as the view modal already does. |
| 4.2 | **Show *why* a card matched a search** | When searching by ingredient, highlight the matching ingredient on the card — otherwise results look arbitrary. |
| 4.3 | **Sticky ingredient panel while scrolling steps** | On desktop, a two-column recipe view (ingredients left, method right) removes constant scrolling. |
| 4.4 | **Filter chips should show counts** | "Dinner (12)" tells you where your collection actually is. |
| 4.5 | **Make the whole "Add photo" hero clickable** | The small 📷 button is easy to miss on a phone. |
| 4.6 | **Dark mode** | An evening kitchen is dim; the app is bright cream. The CSS variables make this genuinely cheap. |
| 4.7 | **Skeleton → real content transition** | Skeletons only show on first-ever load; showing them during cloud sync would make the app feel more responsive. |
| 4.8 | **Larger touch targets in the header** | Several header buttons are ~28 px; the accessibility guideline is 44 px, and they're the most-tapped controls. |
| 4.9 | **A real empty state for "no photos yet"** | Prompt to auto-fetch, rather than a wall of emoji tiles. |
| 4.10 | **Consistent iconography** | The app mixes emoji and inline SVG for similar concepts (e.g. the clip badge). Picking one raises the visual polish a lot. |

---

## 5. Technical health

| # | Idea | Why | Effort |
|---|------|-----|--------|
| 5.1 | **Split `index.html` into modules** | It's ~9 200 lines in one file. Even splitting CSS and JS into separate files (still no build step, just `<link>`/`<script src>`) would make everything easier and let the browser cache them separately. | 🟡 |
| 5.2 | **Store photos as Blobs in IndexedDB, not base64** | Base64 is ~33 % larger than binary and must be decoded on every use. Now that display already goes through blob URLs, storing real Blobs is a natural follow-up. | 🟡 |
| 5.3 | **Thumbnails** | Generate a ~200 px thumbnail per recipe for the grid and only load the full photo in the recipe view. Would make a 500-recipe collection feel instant. | 🟡 |
| 5.4 | **Firestore: one document per recipe** | The whole collection is a single document, so any edit rewrites everything and two people editing at once can clobber each other. Per-recipe docs fix both. | 🔴 |
| 5.5 | **Move Firestore rules into the repo** | They're generated in-app and pasted manually — easy to drift. | 🟢 |
| 5.6 | **Automated tests in CI** | The Self Test suite is excellent but must be run by hand. The same checks could run headlessly on every push via GitHub Actions. | 🟡 |
| 5.7 | **Rate-limit / cache AI calls** | Identical imports re-hit the API. A small cache would cut cost and latency. | 🟢 |
| 5.8 | **Retire the `_ph`/`hp` dual flags** | Local and cloud use different names for "has a photo elsewhere"; one name would be less confusing. | 🟢 |

---

## 6. My top 5 if you only do a few

1. ~~**Cook Mode**~~ ✅ **shipped in v27.0** (with step timers and ingredient check-off).
2. **Meal planner + merged shopping list** (3.1) — the standout new capability.
3. **Dark mode** (4.6) — cheap given the CSS variables, and noticeable every evening.
4. **Per-recipe Firestore documents** (5.4) — removes the last structural sync risk.
5. **Smarter units** (see 3.3 + the note below) — "2 tsp" currently displays as "9.9ml".

> **Noticed while building Cook Mode:** the Metric/Imperial toggle converts *every*
> imperial-ish unit, so `2 tsp` renders as `9.9ml` and `1 cup` as `240ml`. Teaspoons,
> tablespoons and cups are standard kitchen measures in metric kitchens too — converting
> them makes recipes harder to follow, not easier. Suggested fix: in Metric mode convert
> only genuinely imperial units (lb, oz, fl oz) and leave tsp/tbsp/cup alone, plus round
> to sensible cooking values. Small change, noticeable improvement — say the word.
