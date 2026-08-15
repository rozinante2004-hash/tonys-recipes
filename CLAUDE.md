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

**As of v31.7: 171 checks, 165 passing.** The 6 failures are `net_*` and
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
| **Full photos stay base64 LOCALLY.** | Export, email and print consume data URLs; only thumbnails are Blobs. Since v31.1 the CLOUD copy may be a Firebase Storage URL (`photo_<id>.photoUrl`) instead of base64 — but a **backup must stay self-contained**, so `backupSave` fetches remote photos back and inlines them. Both document shapes must be readable forever. |
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
- **The Worker is not free to call.** It forwards to Anthropic on Tony's key and
  its URL ships in a public file. v34 requires an allowed Origin **and** an
  `X-App-Key`, and rate-limits per IP in KV. The key ships in `index.html`, so it
  is not a secret — it stops drive-by abuse; the **rate limit** is what bounds the
  damage. Every call must go through `workerHeaders()`; a call site that inlines
  the URL sends no key and gets a 403. `bring-settoken` is exempt from origin and
  key checks because it runs from a bookmarklet on web.getbring.com — its own
  secret authenticates it, and that secret now has **no default** (the old
  fallback was committed in a public repo).
- **`id` is a PER-DEVICE counter, so two offline devices allocate the same one.**
  The merge matched on `id` alone and treated a collision as two versions of one
  recipe: newer won, the other was destroyed, and the photo — its own document
  keyed by id — stayed behind and attached to the survivor. Tony lost a recipe and
  got his photo on his son's. `uid` (assigned at CREATION, `newUid()`) is the real
  identity; `mergeRecipeLists` keeps both sides and renumbers the local one.
  **EVERY recipe has a uid (v31.7), including old ones** — one identity rule, not
  two. The backfill is safe only because it is DETERMINISTIC: `legacy-<id>`, which
  every device computes identically with no coordination and no network. A random
  per-device backfill is the trap — the same old recipe would get a different uid
  on each device and every legacy recipe would duplicate on the next merge. A new
  recipe's random uid can never equal `legacy-<n>`, so a fresh recipe landing on
  an old number is still caught. `normalizeRecipe` must not mint a uid for a
  fragment with no id (it is called on `{ingredients, steps}` shapes too).
- **Firebase Auth needs its own authDomain in the CSP.** The compat SDK creates a
  hidden iframe on `<project>.firebaseapp.com` and talks to it; omitting the host
  from `frame-src`/`connect-src` stalls sign-in with no visible error, so the app
  never runs any of the paths that reveal the Sign in control.
- **`#signInHeaderBtn` is `display:none` in the markup** and is only revealed by
  `useOfflineMode()`, `signOut()` or an auth callback. If auth never resolves,
  none of them run and the header shows the words "Sign in to sync across
  devices" with nothing to press — the app instructing something it gives no
  means of doing. `ensureSignInReachable()` is the safety net, deliberately
  independent of WHY auth failed.
- **The CSP must stay in step with the CONNECT hosts too.** v31.1 pinned
  `connect-src` without the three CORS proxies that URL import falls back to, so
  our own policy killed the fallback — and the failure message blamed the recipe
  site, sending Tony to debug something that was working. A test now extracts the
  proxy hosts from `runUrlImport` itself and fails if any is missing from the CSP,
  so adding a fourth proxy cannot repeat it.
- **The CSP must stay in step with the script hosts.** `script-src` lists the CDN
  hosts `loadScriptOnce()` uses; adding a lazily loaded library without adding its
  host makes it fail silently. `frame-src` needs `'self'` for the email preview's
  `srcdoc` iframe. `'unsafe-inline'` cannot be removed without a build step.
- **`rHtml` output is rendered in an iframe on this origin.** The audit found
  `r.name` going unescaped into `alt="..."`, plus `photo`, `bg`, `emoji`, diet
  tags, `source` (into an `href`) and the meta row. A recipe is NOT trusted
  input — it arrives from AI imports, restored backups and other family members.
  Use `escH`/`escA`, and `safeUrl()` for anything that lands in href/src:
  escaping cannot stop `javascript:`, because there the scheme is the payload.
  The preview iframe carries `sandbox=""` as defence in depth — never add
  `allow-scripts` or `allow-same-origin` to it.
- **Restore is the most destructive action in the app** — it replaces the whole
  collection AND pushes that to every other device. It must confirm BEFORE
  touching anything, and a cloud failure afterwards is its own outcome, not a
  failed restore. Reading `backup.exportedAt` unguarded used to throw after the
  data was already replaced, then report "Restore failed" for a restore that had
  succeeded destructively.
- **The Family Access list is not the permission.** The rules embed addresses
  literally and are published BY HAND, so adding or removing a member changes
  nothing until Tony republishes. Never word those toasts as though a grant or a
  revocation has happened — the removal direction especially, since it reads as
  access revoked when it is not.
- **The version badge must show what is RUNNING, not what the server has.**
  `checkAppVersion` used to overwrite the badge with `serverVersion`, so a device
  on v30.1 displayed "v30.4" and looked current while missing everything between.
  Tony reported his version from that badge three times and it was wrong each
  time, which turned "the feature is missing" into a hunt for a bug that was not
  there. Same block: compare the banner against `APP_VERSION`, and only write
  `VERSION_KEY` once the device is actually on that version — storing the
  server's version when the banner appeared made it show once and never again.
- **"Update Now" must clear the caches before reloading.** With no WAITING
  service worker — the usual case, since `sw.js` rarely changes and `index.html`
  always does — it fell through to a plain reload, which the stale-while-revalidate
  handler answers from cache. The button did nothing visible and a second reload
  was needed. Guard the cache purge on `navigator.onLine`, or an offline tap
  empties the only copy there is.
- **One failing photo source must not end the search.** A 429 from Pixabay used
  to dead-end photo search while Pexels and Unsplash sat there working — an error
  is now handled exactly like an unconfigured source: move on, collect the reason,
  report only if all four fail. **Openverse is first because it needs no API key**,
  so it cannot be knocked out by the shared key's rate limit.
- **Openverse is Creative Commons, so credit is a licence CONDITION, not a
  courtesy.** Pixabay/Pexels/Unsplash do not require attribution, so the picker
  showed credit and `useSelectedSearchPhoto` discarded it. Adding a CC source
  without `r.photoCredit` would have put every recipe using one in breach.
- **`_ph` / `_po` are the ONLY record that a photo exists somewhere else.**
  localStorage holds photo-free recipes; the photo is in IndexedDB, and the flag
  is what says so. `hydratePhotosFromIDB` used to clear the flag even when the
  IndexedDB row was missing ("hydrated (or unavailable) — the flag has done its
  job"), so when Chrome evicted IndexedDB on a low-storage Android phone, every
  photo vanished on that device **permanently**: `attachCloudPhotos` then skipped
  the recipe, and no reload, restart or re-sync could recover it. Clear the flag
  only when the photo actually arrived, or when the cloud says there is genuinely
  no photo document. A FAILED read is neither — treat it as "ask again", never as
  absence, because absence also arms the delete branch in `syncCloudPhotos`
  against every other device's copy. Reported by Tony from one phone out of three.
- **`waLoadAllMessages` returns EVERY chat concatenated, so index arithmetic
  crosses chat boundaries.** `waBuildContext` expands each hit to `i-2 … i+5`,
  which ran off the end of one chat into the opening messages of the next and
  handed them to the AI as the replies to that hit. Every message now carries
  `.chat` and the window clamps to it. Anything else that walks neighbours in
  that array needs the same guard.
- **A chat listed twice is fed to the AI twice, and the answer looks fine.**
  `waLoadAllMessages` reads every index row, so a chat present as both `local` and
  `cloud` puts all its messages into the context twice. Nothing errors and no count
  looks wrong on screen — it just skews the answer. `waMergeCloudIntoIndex` keeps
  one row per file with the cloud copy winning. Tony spotted this in a screenshot;
  no error message would ever have surfaced it.
- **A source-grep assertion can match its own comment.** `String(fn).indexOf('x')`
  sees comments too, so a test explaining "must not call x()" fails on itself —
  this has now happened three times (`Math.max.apply`, the old Bring! secret, and
  `workerHeaders` in the bookmarklet). Prefer testing a function's OUTPUT; where a
  grep is genuinely the only option, assemble the needle at runtime
  (`['a','b'].join('-')`) so it cannot appear literally in the file.
- **Nothing secret may live in `index.html`.** It is a public repo. The Bring!
  set-token secret was a hard-coded constant there, which made the Worker's check
  decorative; it now lives per-device in `tonys_bring_settoken_secret`. The Worker
  app key is the deliberate exception — it ships, and the code says outright that
  it is a speed bump rather than a secret.
- **The Bring! bookmarklet runs on web.getbring.com**, so it must inline literal
  headers. A v31.1 refactor rewrote every `{'Content-Type':'application/json'}`
  to `workerHeaders()` including the one inside that generated string, which is
  undefined there. `buildBringBookmarklet()` exists so this is testable by output.
- **`window.foo = null` DESTROYS a hoisted `function foo(){}`.** At top level the
  identifier and the window property are the same binding, so a
  "assigned below" placeholder nulls the real function, and the later
  `window.foo = foo` then assigns null to null. Shipped in v31.1 and broke every
  URL import. **Source-inspection tests cannot see this** — `String(fn)` still
  reads perfectly while the binding is null. Any test for a new entry point must
  CALL it, not just grep it.
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
