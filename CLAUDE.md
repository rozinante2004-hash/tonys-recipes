# Tony's Recipes Collection — working notes

Read this before changing anything. It records decisions that are easy to
accidentally undo, and conventions that keep the app deliverable.

## What this is

A single-file vanilla-JS PWA recipe manager, owned and used daily by Tony
(rozinante2004@gmail.com). Family members also have write access. The collection
is bilingual **English + Hebrew**, and bidi correctness is a recurring
requirement, not a nice-to-have.

- **`index.html` is the whole app** — inline `<style>`, inline JS, ~13 200 lines,
  no build step. CDN scripts in `<head>`: Firebase compat 10.12.0, GSI. **xlsx and
  mammoth load on demand** via `loadScriptOnce()` (5.11) — don't put them back in
  `<head>`; there is a test. qrcodejs and the Excel export were removed in v28.5.
- `cloudflare-worker.js` is pasted into the Cloudflare dashboard, **not** deployed
  from the repo. It proxies Anthropic, photo search, YouTube, Instagram and Bring!.
- `firestore.rules` is the canonical rules file; the app fetches it and substitutes
  `{{READ}}` / `{{WRITE}}` / `{{ADMIN}}`. Edit the structure there, not in `index.html`.
- `whatsapp/` holds exported chat `.txt`/`.zip` files. The app LISTS the folder over
  the GitHub contents API (5f.7), so `index.json` is optional — it only supplies group
  labels now. See `whatsapp/UPLOAD-FROM-IPHONE.md` for the Share-sheet Shortcut.
  **`whatsapp/upload-guide.html` is generated** from that markdown by
  `tools/build-upload-guide.js` (`npm i marked@14` first) — it inlines the seven
  `whatsapp/img/*.svg` mock-ups so the one file works offline and prints. Edit the
  markdown and re-run the builder; never hand-edit the HTML.
  **`whatsapp/Send-chat-to-Recipes.shortcut` is also generated**, by `tools/build-shortcut.py` —
  a plist of the 15-action Shortcut so it can be installed instead of built by hand. The GitHub
  token in it is the placeholder `PASTE-YOUR-GITHUB-TOKEN-HERE` and **must never be a real one**;
  the builder asserts no `github_pat_`/`ghp_` string reaches the file. It has not been verified on
  a real iPhone — Apple's shortcut format is undocumented — so the hand-built route stays in the
  guide as the known-good one.
  **None of the `whatsapp/` routes work on Tony's iPhone.** It is employer-managed
  and a configuration profile blocks `github.com` *and* `api.github.com` outright —
  Safari shows "Website Not Allowed". That is not ours to route around, and the
  Worker must not be turned into a GitHub proxy to evade it. Chats reach that phone
  through Firestore instead (5f.8, below).
- `sw.js`, `manifest.json` — PWA. GitHub Pages deploys `main` via `.github/workflows/deploy.yml`.
  Note that **Pages (`*.github.io`) is reachable from that phone even though `github.com` is not**,
  which is why the app itself and the chat files still load there — only the API is blocked.

## How to verify work — this is not optional

The app has a built-in Self Test suite (`SELF_TESTS` in `index.html`, surfaced at
⚙️ Settings → 🧪 Self Test). Drive it headlessly:

```bash
python3 -m http.server 8137 &        # some checks need http://, not file://
node tests/run-self-tests.js --port 8137
```

That runner is in the repo and is what CI runs (`.github/workflows/self-tests.yml`,
5.6). It exits non-zero on a failure **and** on a test that closes the suite or
strands a dialog.

**As of v29.9: 150 checks, 144 passing.** The 6 failures are `net_*` and
`stor_firebase` only — they need real network and a signed-in Firebase session,
and cannot pass in a sandbox. Any *other* failure is a real regression.

**Run the suite with `#selfTestOverlay` open**, not just by calling each `t.test()`.
Some tests interact with modals, and "topmost dialog" means something different
when the Self Test screen is itself open — `a11y_basics` used to close the suite
out from under itself and strand the converter on screen, and a runner that
didn't open the overlay could not see it.

Always also run a syntax check over the inline `<script>` blocks (`new Function(src)`),
because a single-file app fails silently and completely on a syntax error.

**Add a self test for every behavioural change.** Several real bugs in this app were
found only because a test was written first and disagreed with the code.

## Conventions

- **Versioning:** minor bumps (`v28.2` → `v28.3`) for ordinary work; majors reserved
  for genuinely big changes. Bump `version.json` **and** the four version strings in
  `index.html` together (line-1 comment, `APP_VERSION`, two badges in the markup).
- **Delivery: push straight to `main`.** Standing instruction from Tony, 1 Aug 2026 —
  he would rather not upload files by hand. Pushing deploys to Pages within minutes,
  so **tell him in advance when a change is risky** (anything touching cloud data or
  migrations) so he can take a backup first. Still `git fetch origin main` before
  starting. The old convention — hand-uploads through the web UI, branch
  `claude/tonys-recipes-app-nv31q1`, PR #1 — is retired; that PR was closed unmerged.
- Keep `RECONSTRUCTION_PROMPT.md` and `IMPROVEMENT_IDEAS.md` current in the same commit.
- Tony values **honest error messages** highly. Never let the UI assert something the
  code hasn't verified (see the Bring! note below). A dead end with no way forward is
  treated as a bug.

## Decisions that must not be silently reverted

| Decision | Why |
|---|---|
| **No Cook Mode.** Removed in v27.7. | Tony wants the whole recipe visible at once. Do not reintroduce a step-at-a-time view. |
| **`history` syncs per-recipe but never in the legacy doc.** | 3 revisions take a recipe from 1.7 KB → 6.2 KB. Per-document that is irrelevant; in the single shared document it cut capacity from ~610 recipes to ~170. `slimRecipeForCloud(r, keepHistory)` is the one switch — `true` for `recipe_<id>`, `false` for `recipes`. |
| **Voice is disabled on iOS.** | iOS defines `webkitSpeechRecognition` but cannot honour `continuous`; an unguarded `onend → start()` froze the whole app. Restarts must stay deferred and capped. |
| **Ticks are session-only.** | Explicitly requested. In memory only, wiped when the recipe closes. Never persist them. |
| **Bring! status comes from the Worker.** | The token lives in KV and is shared; the per-device `bring_token_expiry` is a cache. It may say "unknown" but must **never** assert "expired". |
| **Metric leaves tsp/tbsp/cup alone.** | Only lb/oz/fl oz are converted. They are standard kitchen measures in metric kitchens too. |
| **Full photos stay base64.** | Export, backup, cloud sync, email and print all consume data URLs. Only thumbnails are Blobs. |
| **Sharing produces a file, not a public link.** | Publishing family recipes to a public endpoint is Tony's decision to make, not a share button's. |
| **Declined:** 3.8 nutrition per-serving; 4.4 filter counts; 4.8 header touch targets. | Asked for and declined. Don't re-propose without reason. **5.6 (CI) was accepted in Aug 2026**; 3.1 (meal planner) is not declined but low priority — Tony cooks once a week. |

## Traps this codebase has already sprung

- **`--warm-brown` is both a surface and heading text.** Headings use `--heading`.
  Flipping the wrong one breaks dark mode in a way that only shows in one theme.
- **A focus ring needs `:focus:not(:focus-visible)` for the reset, and the ring
  rule last.** Written the other way round — a `:focus { outline: none }` after
  the `:focus-visible` rule at equal specificity — the reset wins and nothing
  ever paints. Asserting the rule exists does not catch it; check the cascade.
- **Making something focusable is half a keyboard path.** A dialog must also take
  focus, trap Tab while open, and hand focus back on close, or Tab walks the page
  behind it. `trapFocus`/`releaseFocus` do this; `closeM` calls the release.
- **The 5.4 concurrency base must be PERSISTED.** `_cloudRecipeBase` /
  `_cloudRecipeStamp` are what the stale-write check compares against. They were
  in-memory only, and 5.9 skips re-reading an unchanged cloud — so on a fresh load
  nothing populated them, every recipe looked like a conflict, and v29.1 refused
  an entire collection on every load, self-sustaining. Also: **"no base" is not
  "conflict"** — if the cloud copy carries the same `updatedAt` as ours, we hold
  that version and writing is safe. And the fast path must refuse to skip unless
  it actually holds a base for every local recipe — otherwise it skips the only
  read that fills the map, so the map never fills. That was a genuine stuck loop.
- **The change stamp must describe the recipe you KEEP, not the one you had.**
  `saveRecipeDoc` serialises with the new `updatedAt` already applied. Serialising
  first and stamping after means the stored hash describes the old version, the
  next dirty check disagrees, and every recipe is rewritten on every save.
- **An open edit form is a snapshot, and the 5.4 guard does not protect it.**
  The guard compares the recipes ARRAY against the cloud; a background refresh
  replaces the underlying recipe while a form is open, so the form then
  overwrites another device's work *with permission*. `_editBaseAt` records the
  version the form opened from and `saveRecipe` asks before replacing. Found by
  Tony with two browsers — no unit test would have found it.
- **A cloud document that will not parse must still yield a base.** Skipping it
  outright left no base, so every later save refused that recipe forever and a
  corrupt payload never repairs itself. `updatedAt` is a separate field: record
  it, and the next save replaces the damaged document.
- **RTL is layout as well as text.** `dir="auto"` per element handles alignment,
  but which SIDE a column sits on needs `dir="rtl"` on the grid container —
  `recipeIsRTL(r)` decides from the recipe body, not just its title.
- **`direction: auto` is not valid CSS.** Use `dir="auto"` + `unicode-bidi: plaintext`
  + `text-align: start`. This applies to email, print and shared pages too.
- **Escape before highlighting/interpolating, never after.** `hlMatch`, `aiFailPane`
  and `buildRecipePage` all have tests pinning this.
- **Firestore documents have a 1 MiB limit** (`FIRESTORE_DOC_LIMIT`). Since 5.4 each
  recipe has its own document, so the limit is per recipe rather than per collection —
  but the legacy `shared/recipes` document is still *read*, and it is still capped.
- **Dropdown menus:** `closeDrop` must disarm the outside-click listener, or the next
  click on the trigger reopens and instantly recloses the menu.
- **Test isolation:** close modals in `finally`, not in `try`. A failed assertion that
  leaves a dialog open makes an unrelated test fail later.
- **`localStorage` is per-device.** Anything stored there (pantry, line marker, chat
  index, AI cache, theme) does not travel between Tony's phone and PC. Say so in the UI
  rather than letting it look broken.
- **`whatsapp/` is scanned by the app, so anything put there must not look like a
  chat.** The guides, their SVGs and the generated Shortcut went in beside the
  exports and the folder listing dutifully offered all of them as chats, failing
  four times over. `WA_NOT_A_CHAT` is a DENYLIST on purpose — WhatsApp's download
  can arrive with no extension, and README promises that works, so an allowlist of
  `.txt`/`.zip` would reject real exports to exclude a README.
- **A chat listed twice is fed to the AI twice, and the answer looks fine.**
  `waLoadAllMessages` reads every index row, so a chat present as both `local` and
  `cloud` puts all its messages into the context twice. Nothing errors and no count
  looks wrong on screen — it just skews the answer. `waMergeCloudIntoIndex` keeps
  one row per file with the cloud copy winning. Tony spotted this in a screenshot;
  no error message would ever have surfaced it.
- **Testing a predicate is not testing the caller.** The first fix for the above
  tested `waLooksLikeChatFile` directly; reverting `waListFolder` to the old filter
  left every test green. The listing filter is now `waFilterListing`, driven with a
  real GitHub-API-shaped array, plus an assertion that the caller uses it.
- **Chunk by BYTES, never by characters.** Hebrew is two bytes per character in UTF-8
  and emoji are four, so a chunk budgeted in characters is double or quadruple what
  you asked for — and this collection is mostly Hebrew, so the 1 MiB document limit
  is hit on the very first real export. `waChunkText` binary-searches on `byteLen`.
- **A split surrogate pair survives an in-memory `join` and dies in the round trip.**
  JS strings are UTF-16 code units, so concatenating chunks reunites a pair that was
  split; the corruption only appears once each chunk has been through UTF-8, which is
  what Firestore does. A `chunks.join('') === original` assertion therefore passes with
  the surrogate guard deliberately removed — it was written that way here and mutation
  testing caught it. Assert on `TextDecoder(TextEncoder(chunk))` per chunk instead.
- **Keep list-time reads away from bulk text.** `chat_<slug>` holds metadata and
  `chatpart_<slug>_<n>` holds the text, specifically so the head range query
  (`chat_` … `` chat` ``) cannot see the parts. Name a part `chat_<slug>_p1` and every
  chat is read in full just to draw a list of group names. `'_'` (0x5F) sorting before
  `` '`' `` (0x60) is what makes that boundary work; there is a test.

## Outstanding

- **5.4 — per-recipe Firestore documents. Steps 1 and 2 of 3 shipped (v28.0, v28.1).**
  The legacy `shared/recipes` document is no longer written, only read once per load by
  `reconcileLegacyStragglers` to catch a device still on v27.9. Remaining: delete that
  document by hand once no device can be on v27.9, and remove the reconciliation pass
  and the `recipes` listener with it. The two-browser concurrency checks in
  `PLAN-5.4-per-recipe-docs.md` §7 have **not** been run; they need two real signed-in
  sessions.
- **Deletion is genuinely admin-only, published 1 Aug 2026.** v28.1 split `write` into
  `create, update` — `write` in Firestore means create + update + delete and allow rules
  are OR'd, so the `allow delete` line below it had been restricting nothing. Consequences
  now live: a write-role member deleting a recipe removes it locally but not from the
  cloud, so it returns on their next sync (`flushCloudDeletes` reports this honestly);
  and `syncCloudPhotos` silently fails to remove their orphaned `photo_<id>` documents.
  The role labels in Family Access — "Read + Write" vs "Full (incl. delete)" — describe
  what actually happens now, which they did not before.
- **2.6 — the local Save Helper stays** until the Worker UTF-8 download test
  (`filename-test.html`, test 3) is re-run on Ubuntu/Chrome.
- The Bring! token that leaked into git history **was rotated on 1 Aug 2026**. The old value is
  still in the history and always will be; it is simply dead now. Nothing further to do.
