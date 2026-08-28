# Tony's Recipes Collection — working notes

Read this before changing anything. It records decisions that are easy to
accidentally undo, and conventions that keep the app deliverable.

## What this is

A single-file vanilla-JS PWA recipe manager, owned and used daily by Tony
(rozinante2004@gmail.com). Family members also have write access. The collection
is bilingual **English + Hebrew**, and bidi correctness is a recurring
requirement, not a nice-to-have.

- **`index.html` is the whole app** — inline `<style>`, inline JS, ~22 400 lines,
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

**Two suites, and BOTH must run.** The self-test suite only ever loads
`index.html`; it cannot see the Worker at all. A CORS regression in the Worker
took every server-side feature down for three releases while the suite stayed
green (v34–v35). The Worker is a plain ES module with no Cloudflare imports, so
it can be imported and driven with ordinary `Request` objects:

```bash
node tests/worker-cors.mjs        # no network, no wrangler
```


The app has a built-in Self Test suite (`SELF_TESTS` in `index.html`, surfaced at
⚙️ Settings → 🧪 Self Test). Drive it headlessly:

```bash
python3 -m http.server 8137 &        # some checks need http://, not file://
node tests/run-self-tests.js --port 8137
```

That runner is in the repo and is what CI runs (`.github/workflows/self-tests.yml`,
5.6). It exits non-zero on a failure **and** on a test that closes the suite or
strands a dialog.

**As of v34.8: 194 checks, all passing, 6 skipped.** The skips are `net_*` and
`stor_firebase` — they need real network and a signed-in Firebase session and
cannot run in a sandbox. Any failure at all is a real regression. Note the runner
skips by **id prefix `net_`**, not by group: naming a test `net_…` silently
disables it, which happened in v34.5 and read as coverage until a mutation
survived.

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
| **`history` always travels; there is ONE cloud shape.** | 3 revisions take a recipe from 1.7 KB → 6.2 KB, which mattered only for the legacy single `shared/recipes` document (capacity ~610 → ~170). That document is deleted and `slimRecipeForCloud`'s `keepHistory` flag was removed in v32.2 — it takes **one** parameter now. Do not reintroduce a second shape or a flag that silently drops a field. |
| **Voice is disabled on iOS.** | iOS defines `webkitSpeechRecognition` but cannot honour `continuous`; an unguarded `onend → start()` froze the whole app. Restarts must stay deferred and capped. |
| **Ticks are session-only.** | Explicitly requested. In memory only, wiped when the recipe closes. Never persist them. |
| **Bring! status comes from the Worker.** | The token lives in KV and is shared; the per-device `bring_token_expiry` is a cache. It may say "unknown" but must **never** assert "expired". |
| **Metric leaves tsp/tbsp/cup alone.** | Only lb/oz/fl oz are converted. They are standard kitchen measures in metric kitchens too. |
| **Full photos stay base64, everywhere.** | Export, email and print consume data URLs; only thumbnails are Blobs. The Firebase Storage path (a `photoUrl` pointer instead of base64) was removed in **v34.4** — it needed a paid plan, was never switched on, and put branches into photo sync and backup. ONE shape now. A **backup must stay self-contained**: that is free while photos are base64, but if a remote shape is ever reintroduced, `backupSave` has to download and inline them again. |
| **A local photo fix must reach the CLOUD.** | The cloud wins on every load — `loadFromFirestore` replaces `recipes` with the cloud copies and the local-photo net only fires when the cloud gives nothing. A rescue that only fixes memory is undone by the next reload, which is why Tony's photos "came back wrong" twice. `runPhotoRescue` awaits `pushLocalPhotosToCloud`; `healCloudPhotos` repairs a cloud already gone wrong. |
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
  recipe has its own document, so the limit is per recipe rather than per collection.
  It is still reachable by one recipe: that is why `slimRecipeForCloud` blanks the photo
  and `syncCloudPhotos` writes photos to their own documents.
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
- **Firebase Storage needs a PAID (Blaze) plan and this project is on Spark, so
  it is OFF and photos stay base64 in Firestore.** All the Storage code is dormant
  and safe: `storageReady()` gates it, uploads fall back to base64, and both
  document shapes stay readable. Note the trap — `firebase.storage()` SUCCEEDS on
  a project without a bucket, because `storageBucket` is in the config, so
  readiness cannot be proven up front. `markStorageUnavailable()` latches on the
  first real upload failure; without it every photo save retried a doomed upload.
- **`img-src` governs RENDERING; fetching an image's bytes is `connect-src`.**
  Photo search results displayed fine while "Use this Photo" failed silently,
  because applying a photo downloads it with `fetch()` from whatever host the
  source returned. Openverse federates Flickr, Wikimedia and museums, so those
  hosts cannot be enumerated — `connect-src` carries a bare `https:` on purpose.
  Revisit only by proxying image downloads through the Worker (which would also
  fix hosts that send no CORS headers), never by removing it.
- **This CSP has now caused four separate outages** (CORS proxies, the Firebase
  auth domain, photo downloads, and nearly the Worker itself). Every one came from
  pinning a directive against a mental model instead of against what the code
  actually fetches. Before touching it, grep for `fetch(`, `<script src`,
  `loadScriptOnce`, and every SDK's runtime hosts.
- **CORS is applied CENTRALLY, in the `fetch` wrapper (v36).** Handlers must not
  each remember to set it. v34 changed `jsonResp`'s default from `'*'` to
  `'null'` and updated only 8 of 51 call sites; the other 43 returned
  `Allow-Origin: null`, the browser rejected them, and the app reported "could not
  be reached from this device" for every feature. A rule 51 call sites must
  remember is a rule that will be broken.
- **NEVER send a custom request header to the Worker.** `Content-Type:
  application/json` already forces a CORS preflight, and the Worker's OPTIONS
  reply lists exactly which headers are allowed. Adding `X-App-Key` in v31.1 meant
  every call was blocked by the browser until the matching Worker was deployed —
  photo search, AI import, URL fetch, translate and nutrition were ALL dead for
  two releases, reporting only "could not be reached from this device". The key
  travels in the request BODY (`workerBody()`), which needs no preflight change,
  so app and Worker can be deployed in either order. This is a deployment-ordering
  hazard, not a style preference.
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
- **A source grep cannot see that a guard was disabled.** `if (false && await
  askConfirm(...))` leaves the name in the source and a grep passes while the
  confirmation never blocks. Stub the dependency and assert the OUTCOME — that
  declining writes nothing. Fifth grep-shaped false pass in this project.
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
- **`\b` is ASCII-only, and this app is half Hebrew — sprung TWICE.** Once in the
  in-text recipe scorer (every Hebrew unit and verb scored zero), then again in the
  photo-name cleaner, in code written *after* the first was documented here. Any
  regex meant to match Hebrew must spell its boundaries out —
  `(^|[^\w\u0590-\u05FF])` in front, `(?![\w\u0590-\u05FF])` behind — and must be
  exercised with a Hebrew fixture. An English-only test of a bilingual matcher
  proves nothing at all.
- **`''.indexOf('')` is `0`, so a `charset.indexOf(lastChar) > -1` trim loop never
  ends on an empty string.** `waTrimUrlPunctuation` used `for (;;)` and asked "is the
  last character punctuation?" — on `''` the answer is yes, forever. It ran over every
  recipe's `source`, and a hand-typed recipe has none, so v32.7's harvest panel froze
  the tab solid for anyone with such a recipe: no error, no console output, just Chrome
  offering to kill the page. Use `while (s)`, and test the inputs that trim away to
  nothing (`''`, `undefined`, `'...'`), not only the happy path.
- **A hanging test is not a failing test, and the difference matters when hunting.**
  That freeze made the runner produce *no output at all* rather than a red line, and it
  killed the mutation harness mid-run, leaving the mutation applied on disk. When a
  suite goes silent: work out whether the page is blocked (an in-page `setTimeout` that
  never fires proves it) or has crashed (Playwright reports the target closed), then
  bisect by running the suspect function's statements one at a time. Restore mutations
  in a `finally`, and treat a timeout as CAUGHT rather than as a broken run.
  Corollary: **a test whose subject is an await that might never return must race a
  sentinel**, never `await` it bare. The first `sync_watchdog` did, so removing the
  watchdog hung the runner and it printed no summary at all — indistinguishable from a
  broken harness. `Promise.race([subject, timer])` turns the same defect into a red line.
- **"Missing" is not `!r.photo`. Photos live in IndexedDB, and `r.photo` is EMPTY
  IN MEMORY until `hydratePhotosFromIDB` finishes** — the normal state for a second
  or two after every load, and permanently for any recipe hydration cannot reach.
  "Auto-fetch missing photos" tested `!r.photo`, so it treated un-hydrated recipes
  as missing and OVERWROTE real photos (v33.4, destructive, reported by Tony). Any
  code deciding a recipe lacks a photo must await hydration and then check all
  three of `r.photo`, `r._ph`/`r._po`, and the IDB row — and if the store cannot be
  read, do nothing rather than guess. More generally: **before a bulk operation
  overwrites anything, prove the thing is absent; do not infer it from an empty
  field that is empty for ordinary reasons.**
- **A latent bug can be armed by an unrelated fix.** That filter was wrong for
  many releases and harmless, because the photo search always returned nothing.
  Making the search work (v33.2) turned it destructive. When fixing "X never
  works", ask what happens downstream once it does.
- **When a fix is about the OUTSIDE WORLD, every path to that world needs it.** The photo
  libraries are English-only. v33.2 taught the bulk auto-fetch to translate; the manual
  "Add photo" search went on sending the raw Hebrew name for five more releases, because the
  fix was filed mentally as "the auto-fetch bug" rather than "the sources do not read
  Hebrew". After fixing a constraint imposed by something external — an API's language, a
  rate limit, a size cap — grep for every other caller that reaches the same place.
- **An equivalent mutant is a real result, not a survivor to chase.** Removing the Hebrew
  guard in `photoQueryForSearch` changed nothing, because `photoSearchTerms` holds the same
  guard one layer down — proven by mutating THAT one and watching `photo_hebrew_terms` catch
  it. Before writing a test to kill a survivor, check whether the behaviour is still enforced
  elsewhere; if it is, the mutant is equivalent and the honest move is to say so.
- **Two counters for the same thing must use the same predicate, or the panel and the
  UI call each other liars.** Sync Health counted `!!r.photo`; the "No photo" chip and
  the auto-fetch count `!r.photo && !r.isClip`, because a clip is a video card with no
  photograph by design. Tony read "30 of 44" beside "No photo (9)" and asked which was
  wrong — while those very numbers were being used to diagnose a photo incident. A
  diagnostic that overstates loss during an investigation into loss is worse than no
  diagnostic. When a number appears in two places, derive both from one predicate, or
  print both and say what separates them.
- **Sweep every source-text assertion with `if (false && …)`.** Break the behaviour, leave
  the searched string in place, and see whether anything fails. Of nineteen such assertions
  in this suite, **thirteen were false-greens** — including the guard against the photo
  overwrite that destroyed a real collection, the email iframe's `sandbox`, the import
  duplicate check, the offline merge on load, and the confirm before deleting a cloud chat
  for every device. This trap was already written up here with five past instances while
  thirteen live ones sat in the suite: **documenting a trap does not remove it.** Where a
  source check is genuinely irreducible (dormant code that cannot run in the test
  environment, like the Firebase Storage path), say so in a comment beside it.
- **A top-level `let`/`const` is NOT a window property.** `window.heroPhotoTargetId = 9301`
  creates a shadow while the real binding stays `null`, so the function under test sees
  nothing and the test fails for a reason that has nothing to do with the code. Assign the
  bare identifier. Related: stubbing `closeM` to a no-op leaves a modal open and breaks a
  later test — let it close, or clean up in the `finally`.
- **A fixture must make the property under test the ONLY thing that can produce the
  answer — including in the numbers you pick.** The swipe test dragged 10px sideways
  and 120px down to prove a vertical drag does not toggle a favourite. It passed with
  the vertical guard deleted, because 10px is under the 55px `SWIPE_MIN` and the
  *threshold* was refusing the toggle. Exceed every other guard so only the one under
  test is left standing (140px across, 300px down).
- **A positive assertion needs isolating just as much as a negative one.** Checking that the
  chat-coverage block rendered by looking for the group name passed with the block deleted —
  the quoted messages carry that name too. Assert on something only the code under test can
  produce (here, "Searched N chats").
- **Apply a lesson to EVERY instance of the shape, not just the code you were touching.**
  In one session I wrote the rule "a 'we could not read it' result must be distinguishable
  from 'there is nothing there'" after fixing `readCloudPhotoDocs` — and left the identical
  fault in `idbGetAll`, which resolved `[]` on a failed read and so made
  `recipesWithNoPhoto`'s "refusing to guess" branch dead code. It fed the most destructive
  operation in the app, and Tony's photos were overwritten a second time a week later. When
  you learn a rule, grep for every other place it applies **that day**.
- **A safety net that can only fire on a condition nothing produces is not a safety net.**
  That branch was tested — with a stubbed *rejection*, which the real function never
  returned. When you test an error path, check that the real code can actually reach it.
- **A message that says where to find something is a claim, and it can be wrong.**
  Three messages told Tony "⚙️ → Send my photos to the cloud" while the item sat in
  the ··· More menu. He looked in Settings, as instructed, and it was not there. This
  is the same class as a status line asserting something unverified, and it is fully
  checkable: `ui_menu_directions_true` parses every "⚙️ → X" the code prints and
  requires a matching item in the Settings menu.
- **Fixing the copy the user can see is not fixing the data.** Photos kept "coming back
  wrong" days after Tony had restored them, because the cloud wins on every load and the
  rescue's cloud write was debounced, fire-and-forget, and reported as success before it
  had happened. Ask *which* copy is authoritative on the next read, and make the fix reach
  THAT one — then report what actually landed, not what was attempted.
- **Two failures of the same operation mean the guard is the wrong tool. Make it
  reversible.** After the auto-fetch destroyed photos twice, the fix was not a third guard:
  it was a snapshot, an independent second opinion that aborts the whole run, and a
  one-press undo. A guard has to be right every time; an undo only has to exist.
- **Mutate on purpose to FIND gaps, not only to validate a new test.** Eight mutations
  aimed at the data-safety paths found five holes the 186-test suite could not see —
  including `repairMissingPhotos`, the only route back for a device whose photo flags
  were already lost, which had no test at all. Pick the code where a defect is silent,
  destructive or irreversible, break it, and watch. A large suite is not evidence that
  the important functions are covered.
- **When two templates render the same thing, a test that exercises one covers half.**
  The grid and list cards are independent template literals and only one runs per
  render; `viewMode` defaults to `'list'`, so mutations to the *grid* card survived a
  test that rendered and asserted without setting the mode. Loop over both modes.
  The same applies anywhere a second rendering path exists — print, export, share.
- **Check whether a restriction was ever real before defending it.** Clips were
  excluded from the photo plumbing in four places on the premise that a video card
  should not carry a photograph. Both card templates had *always* rendered `r.photo`
  for clips; the premise was never implemented, only assumed. Before explaining why a
  restriction exists, grep for the code that would enforce it — it may not be there.
- **A computed-but-unprinted figure fixes nothing.** The mutation that deleted the
  `L.push` for the honest count survived the first round: the data was right and the
  user still read the misleading line. Assert the rendered output, not only the
  function's return value — `syncHealthText()` exists for exactly this.
- **Read the interface; do not assume it.** Three defects in one session came from
  guessing a shape instead of looking: `\b` as a Hebrew boundary, `/item/` as a
  shop-only path (it is where Walla files recipes), and `author`/`sourceUrl` as the
  Worker's photo-credit fields (they are `credit`/`creditUrl`, and the correct code
  was already in the file twelve thousand lines away). Each check took under a
  minute. Before writing a second consumer of any shape, grep for the first one.
- **Test the ROUTE, not the helper.** Three separate times in one session a
  mutation survived because the test called a helper directly (`waRenumber()`,
  `waMarkImported()`) instead of going through the thing that calls it (switching
  tab, finishing a queued import). Deleting the call site then broke nothing. If a
  helper has one job and several callers, at least one test must reach it the way
  the user does — otherwise every call site is free to quietly stop calling it.
- **A negative test proves nothing unless the property under test is the only
  reason the result is negative.** A "this is noise" fixture that ALSO matches a
  domain rule cannot tell you whether the message-text rule works; a Hebrew
  scoring fixture with no verbs is zero whether or not the unit regex fires. When
  a mutation survives, first ask what else in the fixture was already forcing the
  expected answer.
- **A mutation harness must verify a GREEN BASELINE before it mutates, and treat
  a missing summary line as an error.** A batch of ten reported clean when the
  static server had died: every run failed to load the page, printed nothing, and
  the harness read "no failures" as "no failures". Same shape as the CI that sat
  red for 19 releases — a check that reports success when it did not actually run.
- **A mutation that breaks the BUILD is not a caught mutation.** Renaming a
  function whose name is exported on the next line throws at load, fails a dozen
  unrelated tests, and tells you nothing about whether the behaviour is covered.
  Gut the body instead (`if (true) return;`) and keep the signature.
- **Do not edit a file while a mutation script is cycling it.** The harness rewrites
  the original after each run, so an edit made in between is silently reverted. Wait
  for it to finish; if an edit vanished, that is why.
- **An assertion that greps the page source can match ITSELF.** The tests live in the
  same inline script as the code, so `document.documentElement.innerHTML.indexOf(
  "withSyncWatchdog(loadFromFirestore(")` was satisfied by the test's own text. It
  passed with the wiring deleted; only mutation testing showed it. Wiring is
  behaviour — check it by *calling* the thing (extract a named function if the code
  is buried in an event handler) and observing what it does. Reserve source greps for
  properties with no observable behaviour at all, and then pick a needle that cannot
  appear in the test.
- **One `await` per item inside a loop is an N-round-trip operation, and N grows with
  the user's collection.** `attachCloudPhotos` fetched `shared/photo_<id>` one document
  at a time; at 44 recipes of ~60 KB each that stopped finishing, so Tony's sign-in
  timed out and only 9 of his 44 photos ever arrived (v33.6). Firestore can answer the
  whole set in one `documentId()` range query — `'_'` (0x5F) sorts before backtick
  (0x60), which is what makes `photo_` … `` photo` `` exact. Before writing `await`
  inside a `for` over user data, ask what it costs at 500 items; if there is a bulk
  form, use it, and keep the per-item path only as a fallback.
- **A "we could not read it" result must be distinguishable from "there is nothing
  there".** The bulk photo read returns `{byId, complete}` for exactly this reason: on
  a failed query `complete` is false, so nothing clears `_ph` — the only record that a
  photo exists elsewhere. A read helper that answers a failure with an empty collection
  hands its caller a confident, wrong "empty", and every destructive branch downstream
  believes it.
- **A watchdog turns "slow" into "failed", and that is a real trade.** `withSyncWatchdog`
  stops the status pill claiming "Syncing…" for ever, but a genuinely slow read that
  would have finished at 100s now reports SYNC_TIMEOUT. That was the right call only
  because the slowness had a fixable cause. Adding a timeout is not a substitute for
  finding out why something is slow — say so out loud when shipping one.

## Outstanding

- **5.4 — per-recipe Firestore documents. Complete as of v32.2.** All four steps are
  done: v28.0 dual-wrote both layouts, v28.1 stopped writing the legacy
  `shared/recipes` document but kept reading it each load, the document was deleted by
  hand in the Firestore console on 15 Aug 2026, and v32.2 removed the reading code —
  `reconcileLegacyStragglers`, `migrateToPerRecipeDocs`, `stripPhotosForCloud`,
  `slimRecipeForCloud`'s `keepHistory` flag, `meta.legacyAt`, the `recipes` listener and
  the unconditional-read branch. **Do not reintroduce a second cloud shape.** The two-
  browser concurrency checks in `PLAN-5.4-per-recipe-docs.md` §7 have **not** been run;
  they need two real signed-in sessions.
- **Deletion is genuinely admin-only, published 1 Aug 2026.** v28.1 split `write` into
  `create, update` — `write` in Firestore means create + update + delete and allow rules
  are OR'd, so the `allow delete` line below it had been restricting nothing. Consequences
  now live: a write-role member deleting a recipe removes it locally but not from the
  cloud, so it returns on their next sync (`flushCloudDeletes` reports this honestly);
  and `syncCloudPhotos` silently fails to remove their orphaned `photo_<id>` documents.
  The role labels in Family Access — "Read + Write" vs "Full (incl. delete)" — describe
  what actually happens now, which they did not before.
- **2.6 — DIAGNOSED, 28 Aug 2026. Tony's Chrome runs with no locale at all, and that
  is the entire cause.** `/proc/<chrome pid>/environ` matched none of
  `LANG|LC_|LANGUAGE|GDM_LANG` — empty. Chrome is `/opt/google/chrome/chrome`, a plain
  deb, so snap/flatpak confinement is *not* the mechanism; the graphical session simply
  never exported a locale. His terminal has one (`LANG=en_IL.UTF-8`) but also reports
  `locale: Cannot set LC_ALL to default locale: No such file or directory`, so at least
  one of the locales it names is **not generated** — check `locale -a` before setting
  anything system-wide, or the broken value propagates to the session.

  His four results, all on build `2026-08-28c`:
  - test 1 (`<a download>`) — mangled;
  - test 2 (`showSaveFilePicker`) — saved as `download`, and this one is *self-verifying*,
    so it is the browser's own report rather than an eyeball reading;
  - test 3 (RFC 5987 `Content-Disposition`) — mangled. **This is the one that closes it**:
    a standards-compliant filename arriving in an HTTP header, nowhere near a DOM
    attribute, destroyed just the same. Three independent paths into Chrome's downloader,
    three identical failures;
  - test 4 (helper, which never touches Chrome's downloader) — name intact.

  Reproduced exactly in the container: `env -u LANG -u LANGUAGE -u LC_ALL` → `download`,
  the literal string Tony sees; add `LC_ALL=C.UTF-8` and every name survives, through the
  app's own `downloadBlob` with the helper off. **Nothing in the app is broken and nothing
  in JavaScript can fix it.**

  The helper therefore stays until Tony repairs the session locale — it is the only route
  that works on his machine today. Retirement checklist once test 1 passes: delete
  `local-save-helper.py`, `SAVE_HELPER_KEY`, `localSaveUrl`, `saveHelperEnabled`,
  `setSaveHelperEnabled`, `checkHelperStatus`, `showRenameHint`, the Save Helper settings
  panel and the `http://127.0.0.1:27182` / `http://localhost:27182` `connect-src` entries.

  Since v34.5 the helper is **opt-in and off by default**, and
  `connect-src` finally permits it — it had been unreachable behind the app's own CSP
  since v31.1, so any earlier judgement about whether it was worth keeping was made
  about a feature that could not run.
  - **The determinant is the process locale, not the browser and not the download
    method.** Chromium sanitises download filenames against the character encoding of
    the *process* locale. Under `LANG=`/`C`/`POSIX` it strips every non-ASCII character
    and falls back to `Download` — for `<a download>`, for `data:` URLs, **and** for a
    standards-compliant `Content-Disposition: filename*=UTF-8''…`, so no download route
    escapes it. Under `LANG=C.utf8` the same Chromium 141 build preserves
    `עוגת שוקולד של סבתא.docx` and `Бабушкин шоколадный торт.docx` byte for byte,
    verified through the app's own `downloadBlob` with the helper switched off. Nothing
    in JavaScript can fix or detect the broken case.
  - **A filename result obtained in this container is worthless unless the locale is
    set.** The container defaults to `POSIX`, so earlier runs of `fname*.js` "proved"
    that Chromium mangles even `café.docx` — which is not real Chrome behaviour, and the
    conclusion drawn from it was wrong. Prefix filename experiments with
    `LANG=C.utf8 LC_ALL=C.utf8` or they will lie to you. Headed-vs-headless is not the
    variable here; both agreed, in both directions.
  - `navigator.language` reads `en-US@posix` under **both** locales, so the page cannot
    self-diagnose; test 1 needs a human to look in the Downloads folder. That is why it
    ends in two verdict buttons rather than an automatic check.
  - **The service worker was pinning `filename-test.html`, so two fixes never
    reached Tony at all.** He ran the test twice and sent back byte-identical results
    (bar the helper's de-dup counter ticking `(2)`→`(3)`, which is what gave it away).
    `sw.js`'s fetch handler claimed every request in scope, and
    `event.request.destination === 'document'` matches **every** html page, not just
    the app — so the test page got stale-while-revalidate and the first copy a browser
    ever fetched was served for ever after. `index.html` survives that because it polls
    `version.json` and raises the update banner; a standalone page has no such tell.
    The cache-first branch below it was the same trap for any other file fetched once
    under that path. Fixed in v34.9: `isAppDocument()` and `isPrecachedAsset()` gate
    the two branches and everything else returns without `respondWith`, i.e. straight
    to the network. `CACHE_NAME` bumped to `v8` to evict what is already pinned.
    `filename-test.html` now carries a `PAGE_BUILD` stamp, shown in the header and in
    the results box, so a stale copy announces itself.
  - **`filename-test.html` test 3 must send `appKey` in the body**, like every other
    Worker call — it did not, so Tony's run returned `FORBIDDEN: missing or wrong app
    key` and never tested anything. Fixed 28 Aug 2026. The key travels in the body, not
    a header, because a custom header forces a CORS preflight the Worker will not answer.
  - Route 3 (Worker) is a fallback of last resort even if it works: it would push every
    backup, photos included, through Cloudflare to fix a filename. Route 2
    (`showSaveFilePicker`) is the sane replacement if test 1 fails, but it pops a Save
    dialog on every export and does not exist on iOS Safari, so the plain
    `<a download>` path has to stay for the phone regardless.
- **Classifier long tail (5f.11).** ~900 bare `youtu.be` / `x.com` links in Tony's
  harvest carry no signal in the URL and little in the message. Waiting on more
  dismissal data from him rather than guessing a rule.
- **First-run config screen** — deferred by Tony pending a decision about whether the
  app is ever released publicly.
- The Bring! token that leaked into git history **was rotated on 1 Aug 2026**. The old value is
  still in the history and always will be; it is simply dead now. Nothing further to do.
