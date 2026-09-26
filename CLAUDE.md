# Tony's Recipes Collection — working notes

Read this before changing anything. It records decisions that are easy to
accidentally undo, and conventions that keep the app deliverable.

## Index (v36.66)

The file is long on purpose — each entry under *Traps* is a mistake that was
made once. Entries are bullets, roughly newest first, so **search for the bold title**
below (Ctrl+F) rather than scrolling. Sections: *What this is* · *How to verify
work* · *Conventions* · *Decisions that must not be silently reverted* ·
*Traps this codebase has already sprung* · *Outstanding*.

- **Standing rules (read first):** "Nothing secret may live in `index.html`" ·
  "The Family Access list is not the permission" · the employer-managed iPhone
  (in *What this is*: never proxy GitHub through the Worker) · "NEVER send a
  custom request header to the Worker" · "The Worker is not free to call".
- **Configuration:** "AUDIT BLOCK 1" (owner-only tools, `isAppOwner`) ·
  `#appConfig` in index.html (v36.66, below) — every deployment identifier.
- **Security & CSP:** "AUDIT BLOCK 1" · "This CSP has now caused four separate
  outages" · "The CSP must stay in step with the CONNECT hosts too" · "…with the
  script hosts" · "Firebase Auth needs its own authDomain in the CSP" ·
  "`rHtml` output is rendered in an iframe on this origin" · "Escape before
  highlighting/interpolating, never after" · "A relay never sees a URL without
  the user's consent".
- **Cloud sync (Firestore):** "The 5.4 concurrency base must be PERSISTED" ·
  "The change stamp must describe the recipe you KEEP" · "An open edit form is a
  snapshot" · "A cloud document that will not parse must still yield a base" ·
  "`id` is a PER-DEVICE counter" · "Firestore documents have a 1 MiB limit" ·
  "A KEY BECOMES A FIRESTORE FIELD NAME" · *Outstanding* → 5.4.
- **Backups & restore:** "A backup folder is a HANDLE, not a path" · "Restore
  has two modes" · "Restore is the most destructive action in the app" · "The
  bulk, structural operations have Undo now" · "AUDIT BLOCK 3" (the family
  backup record, `shared/backups`).
- **Storage on the device:** "AUDIT BLOCK 3" (one language per device, the AI
  cache in IndexedDB, bins, "Device storage used") · "`localStorage` is
  per-device".
- **Testing & CI:** "A SELF TEST NEVER TOUCHES A REAL RECIPE OR THE REAL CLOUD" ·
  "A TEST MUST LEAVE THE SYNC STATE AS IT FOUND IT" · "AUDIT BLOCK 5"
  (`_selfTestPark`, `--lang he`) · "THE SUITE RUNS AGAIN AS TONY'S PHONE IS SET
  UP" · "…AND AS HIS PC IS" · "A TEST THAT CANNOT FAIL IS NOT A TEST" · "Mutate
  on purpose to FIND gaps" · "A top-level `let`/`const` is NOT a window
  property" · "The self-test suite is a SEPARATE FILE" · "The self-test suite
  runs in ENGLISH" · "A test that passes in CI and fails on Tony's devices is
  usually the test".
- **Interface translation (i18n):** "The interface can be translated; the
  RECIPES never are" · "Getting ALL of it translated is a separate problem" ·
  "HARVEST BEFORE YOU CATALOGUE" · "A NUMBER IS NEVER PART OF A KEY" · "THE
  REPLY IS KEYED BY POSITION" · "A TRANSLATION THAT MOVES THE LINKS FROZE THE
  APP" · the orphan entries ("AN ORPHAN IS …") · "AUDIT BLOCK 4" (cards
  translated at build time, three lanes) · "TONY'S LANGUAGE REQUESTS"
  (`i18n_index`, badge, Update all).
- **Right-to-left & accessibility:** "RTL is layout as well as text" ·
  "`direction: auto` is not valid CSS" · "A Hebrew recipe's LABELS read right
  too" · "AUDIT BLOCK 2" (bidi isolates) · "AUDIT BLOCK 6" (cards, dialogs,
  axe) · "A focus ring needs `:focus:not(:focus-visible)`" · "Making something
  focusable is half a keyboard path".
- **Theme & contrast:** "A TINTED SURFACE AND ITS TEXT ARE A PAIR" ·
  "`--warm-brown` is both a surface and heading text".
- **The Worker (Cloudflare):** "CORS is applied CENTRALLY" · "The Worker meters
  the bill" · "A photo's bytes go through the Worker, and ONLY the Worker" ·
  "The Worker's live version is on screen" · "AUDIT BLOCK 5" (AI cost).
- **Photos:** "`_ph` / `_po` are the ONLY record that a photo exists somewhere
  else" · "\"Missing\" is not `!r.photo`" · "One failing photo source must not
  end the search" · "Openverse is Creative Commons".
- **WhatsApp & Bring!:** "`whatsapp/` is scanned by the app" · "A chat listed
  twice is fed to the AI twice" · "The Bring! bookmarklet runs on
  web.getbring.com" · *Outstanding* → classifier long tail.
- **Collections:** "Collections: several recipes in one record" · "A part is a
  recipe, and keeps what a recipe keeps" · "Gathering recipes into a
  collection".
- **Releasing:** "Bumping the version is a targeted edit" · "The version badge
  must show what is RUNNING" · "\"Update Now\" must clear the caches".

## What this is

A single-file vanilla-JS PWA recipe manager, owned and used daily by Tony
(rozinante2004@gmail.com). Family members also have write access. The collection
is bilingual **English + Hebrew**, and bidi correctness is a recurring
requirement, not a nice-to-have.

- **`index.html` is the whole app** — inline `<style>`, inline JS, ~24 750 lines,
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

**As of v36.9: 227 checks, all passing, 6 skipped.** The skips are `net_*` and
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
- **Never poll for a background command you started.** The harness already notifies you
  when it exits; a watcher loop on top of that is redundant, and on 18 Sep 2026 five of
  them wedged and left Tony waiting ~70 minutes for work that had already finished. The
  mutation runs take 5–15 minutes — start one, say so with a rough duration, and do
  something else or wait for the notification.
  - If a wait loop is genuinely unavoidable, **never `pgrep -f "name"`**: `-f` matches
    full command lines including the watcher's own, so it finds itself and loops
    forever. Use `pgrep -f "[n]ame"` or match on a PID.
  - The GitHub API needs the **full 40-char SHA**; a short one silently matches nothing
    and polls for ever.
  - **Never tell Tony "waiting on X" without checking that X is running** (`ps`). The
    same rule the app is held to — don't assert what you haven't verified — applies to
    what you say about your own work. A stalled watcher looks exactly like progress.

## Decisions that must not be silently reverted

| Decision | Why |
|---|---|
| **No Cook Mode.** Removed in v27.7. | Tony wants the whole recipe visible at once. Do not reintroduce a step-at-a-time view. |
| **`history` always travels; there is ONE cloud shape.** | 3 revisions take a recipe from 1.7 KB → 6.2 KB, which mattered only for the legacy single `shared/recipes` document (capacity ~610 → ~170). That document is deleted and `slimRecipeForCloud`'s `keepHistory` flag was removed in v32.2 — it takes **one** parameter now. Do not reintroduce a second shape or a flag that silently drops a field. |
| **Voice is disabled on iOS.** | iOS defines `webkitSpeechRecognition` but cannot honour `continuous`; an unguarded `onend → start()` froze the whole app. Restarts must stay deferred and capped. |
| **Ticks are session-only.** | Explicitly requested. In memory only, wiped when the recipe closes. Never persist them. |
| **Bring! status comes from the Worker.** | The token lives in KV and is shared; the per-device `bring_token_expiry` is a cache. It may say "unknown" but must **never** assert "expired". |
| **Metric leaves tsp/tbsp/cup alone.** | Only lb/oz/fl oz are converted. They are standard kitchen measures in metric kitchens too. |
| **A self test's recipes never reach the cloud.** | Fixtures belong in the live `recipes` array — a test against a private copy proves the copy works. But `isTestFixture`/`cloudBound` filter them at the one place recipes leave the device (recipe docs, `syncCloudPhotos`, `writeCloudMeta`, `queueCloudDelete`). A suite that runs for 90 seconds on a signed-in device WILL overlap a sync, and in v36.1 it did: a 1.1 MB "ThumbTest" photo reached Firestore and was refused. Never rely on a test's cleanup winning that race. `TEST_ID_MIN = 700000`. |
| **A collection's recipes live in `parts`, and ONLY there.** | A collection's own `ingredients`/`steps` stay EMPTY; everything that wants the whole list calls `allIngredients()`/`allSteps()`. Copying the parts up into the flat fields would spare ~20 read-only consumers a one-line change and create two copies that drift, with no way to say which is right. `isCollection(r)` is derived from `parts.length`, never stored — a stored flag is what let `isVideoBookmark` and `isClip` disagree for three releases. Each part carries its own `uid` **from import**, so promoting the same part on two devices yields one recipe, not two. |
| **Full photos stay base64, everywhere.** | Export, email and print consume data URLs; only thumbnails are Blobs. The Firebase Storage path (a `photoUrl` pointer instead of base64) was removed in **v34.4** — it needed a paid plan, was never switched on, and put branches into photo sync and backup. ONE shape now. A **backup must stay self-contained**: that is free while photos are base64, but if a remote shape is ever reintroduced, `backupSave` has to download and inline them again. |
| **A local photo fix must reach the CLOUD.** | The cloud wins on every load — `loadFromFirestore` replaces `recipes` with the cloud copies and the local-photo net only fires when the cloud gives nothing. A rescue that only fixes memory is undone by the next reload, which is why Tony's photos "came back wrong" twice. `runPhotoRescue` awaits `pushLocalPhotosToCloud`; `healCloudPhotos` repairs a cloud already gone wrong. |
| **Sharing produces a file, not a public link.** | Publishing family recipes to a public endpoint is Tony's decision to make, not a share button's. |
| **Declined:** 3.8 nutrition per-serving; 4.4 filter counts; 4.8 header touch targets. | Asked for and declined. Don't re-propose without reason. **5.6 (CI) was accepted in Aug 2026**; 3.1 (meal planner) is not declined but low priority — Tony cooks once a week. |

## Traps this codebase has already sprung

- **TWO COPIES: LIVE AND TEST (v36.72, WP-A step 3).**
  - **`tools/build.js <live|test>` → `dist/`.** `index.html` stays the file
    that is edited. The LIVE build is the source byte for byte (its settings
    ARE `#appConfig`; checked every build). Any other build rewrites the
    `window.APP_CONFIG = Object.freeze(…)` block from `tools/environments.json`
    (deep merge, re-serialised, read back and compared) and REFUSES if any live
    Firebase identifier survives anywhere in the page. It also renames the
    installable app (`manifest` override) and writes `build-info.json`.
    `dist/` is gitignored. Copies the site minus tooling/tests/docs, plus the
    one file the in-app Self Test loads from tests/ (`tests/sw-probe.js`).
  - **The test copy:** Cloudflare Pages project `tonys-recipes-test`
    (https://tonys-recipes-test.pages.dev), build command
    `node tools/build.js test`, output `dist`, production branch `main`,
    `NODE_VERSION=20`. Firebase project `tonys-recipes-test` (Spark,
    Firestore in me-west1). The Worker allows it via its `ALLOWED_ORIGINS`
    variable (dashboard). **Bring! is OFF there** — it shares the live Worker,
    so it would write to the family's real shopping list.
  - **`APP_CONFIG.environment`**: anything but 'live' shows an orange
    "TEST COPY" strip and "[TEST]" in the title, from the first paint.
  - **Paths are relative now** so one set of files serves both a
    `/tonys-recipes/` site and a root one: `manifest.json` (`./`, `icons/…`),
    the manifest/icon links, `register('sw.js')`, and **sw.js v5** takes its
    folder from its registration (`SW_BASE` for the probe) and handles only
    its own origin + folder — it used to match ANY url containing
    "/tonys-recipes/". Verified by installing the real worker both ways: the
    live-style install caches the same five paths as before.
  - `_selfTestPark` switches every feature ON for a run (tests exercise the
    code against stand-ins), so the suite passes on a copy with Bring! off.
  - 🚀 Deployments has a "🧪 Test copy" group (`APP_CONFIG.testCopy`,
    `liveSiteUrl` — "🌐 Live App" no longer means "this copy").
  - CI builds both, checks live == source, and runs the whole suite on the
    built test copy.
  - The live deploy (GitHub Pages, repo root) is UNCHANGED for now.

- **END-TO-END SYNC ON THE FIREBASE EMULATOR (v36.71, WP-A step 2).**
  `tests/e2e-sync.mjs` runs the REAL app, signed in, as several devices
  (separate browser profiles) through the Firestore + Auth emulators, against
  the published rules filled with an owner, a writer and a reader. How:
  - the app uses the emulator only when served from 127.0.0.1/localhost AND
    `window.__FIREBASE_EMULATOR__` is set before load AND the project is
    `demo-…` (`initFirebase`); the live site can never be pointed at one;
  - the test serves the repo itself (a tiny node server) and adds the two
    emulator addresses to ITS copy's CSP — a page rewritten by Playwright's
    route() counts as public, and Chrome's Private Network Access then blocks
    127.0.0.1 ("Permission was denied … address space");
  - the Firebase SDK is served from npm `firebase@<the version the page asks
    for>` in place of gstatic (the run refuses a mismatch);
  - sign-in is a fake Google credential (`GoogleAuthProvider.credential(
    JSON.stringify({sub,email,email_verified}))`), which only the emulator accepts;
  - cloud truth is read over the emulator's REST API with `Bearer owner`;
    `@firebase/rules-unit-testing`'s `ctx.firestore()` may be called ONCE per
    `withSecurityRulesDisabled` (a second call throws "already been started");
  - the cloud is seeded with `meta` and one recipe: an EMPTY cloud is the
    first-run path, where no load counts as a sync;
  - another device's change arrives as the "🔄 New changes available" banner;
    the test taps it, as a person would.
  Scenarios: add/rename travels, both directions, a clashing save refused with
  nothing overwritten or lost, writer delete refused and explained, owner
  delete travels, reader cannot write, offline edit goes up on reconnect.
  **It found two real bugs on its first run:**
  - **A change from another device inside 5 s of your own save was dropped**
    (no banner): the listener skipped anything while `_justSaved`. It now
    skips only its OWN writes, by the exact `meta.updatedAt` stamp
    (`noteOwnMetaStamp` in `writeCloudMeta`, recorded BEFORE the write).
  - **An offline edit never went up on reconnect** — nothing listened for
    `online`. Now it triggers the ordinary save (conflict check included).

- **FEATURE SWITCHES (v36.70, go-public WP-A.3).** `APP_CONFIG.features`
  (`whatsapp`, `bring`, `gmail` — all ON for this household) and
  `featureOn(name)` (unknown names are OFF; `_featureOverride` is the test
  hook, since the config is frozen). **Mark every entry point
  `data-feature="x"`** — one CSS rule (`html[data-feature-off-x]`, set by
  `applyFeatureFlags()`) hides it, including buttons drawn later; and **guard
  its entry function** with `if (!featureOn('x')) return featureOffNotice('x')`
  (background work: `return null`, silently). `feat_switches_off_means_off`
  scans the SOURCE for any onclick reaching a feature's functions without the
  mark — it found five on its first run — then switches each off and checks:
  hidden, refuses, no network request, no dialog, not in "What leaves this
  device", and back on again. With Gmail off the e-mail dialog offers
  "✉️ Open in my mail app" (mailto, plain text). The privacy list now also
  says synced WhatsApp chats go to Firebase — it never had.

- **A MENU THAT FITS ON THE SCREEN SHOWS ALL OF IT (v36.69).** v36.67 capped a
  menu that did not fit below its button to the room below and made it scroll
  — and on Tony's iPhone AND his laptop (a browser viewport of ~650–700 px),
  "💳 Payments" and "🚀 Deployments" vanished under "Logging & debugging":
  nothing tells you a menu scrolls. `dropPlacement`: below if it fits, above if
  it fits, else — if it fits on the screen at all — moved up until all of it
  shows (over the header); only a menu taller than the whole screen scrolls,
  with a fade at its foot (`.drop-scrolls`). Tony's published rules (v36.59
  template, his four members) were verified in the emulator, 29 checks.

- **A "LAST BACKUP" NOBODY TOOK, AND A HALF-PASTED WORKER (v36.68).**
  - Tony's iPhone said "last backup: 0 days ago, on this device" with no backup
    for weeks: a stamp left by a pre-v36.61 Self Test run (the folder test ran
    the real backupSave). It silences the reminder for 30 days.
    **`backupForgetUnvouched()`** runs before every reminder and in the Backups
    panel: since v36.61 a real backup always writes the family record in the
    same moment (never older than the stamp), and a folder backup its own
    "auto" stamp; a device stamp neither vouches for came from older code and
    is dropped. Wrong in the safe direction only. `ownBackupAt()` counts the
    folder backup's "auto" stamp too, so the PC is not falsely nagged. The
    report gives the exact time of the last backup.
  - **Worker labels:** line 1 said v40, `WORKER_VERSION` v41 (Tony spotted
    it). The newest changelog entry, the heading and `WORKER_VERSION` must
    agree, and the LAST line is `// ── END OF WORKER vNN ──` — worker-cors
    checks all four. His first paste stopped at 9,159 of 52,896 characters
    ("Unexpected end of input at 150:73"); the marker makes a short paste
    visible, and 🚀 Deployments → **📋 Copy Worker code** fetches the file from
    the site, refuses it without the marker, and copies all of it (Safari:
    ClipboardItem with a promise, so the write stays inside the tap).
  - The contrast scan's static check now reads the STYLESHEET (:hover
    included), allowing for `:root[data-theme="dark"] X` overrides. It found
    the Deployments links' hover (#FFF0E8 behind themed terracotta, 2.3:1 in
    dark mode), which the live scan only saw when the pointer happened to
    rest there.

- **FIVE ISSUES FROM TONY'S IPHONE (v36.67)** — all "gone after a restart":
  - **Cards kept the old language after a switch.** v36.62 put the card redraw
    in `i18nInstall`, but the 🌐 menu, the switch to English and the startup
    restore set `_i18nDict` themselves. **`i18nActivate(lang, dict, changed)` is
    now the ONLY place the dictionary changes** (the finish, update-all and
    editor paths too); `i18n_cards_follow_the_real_switch` goes through
    `i18nSetLanguage` and checks no other assignment exists. Test the path the
    USER takes, not a helper that happens to do the right thing.
  - **⚙️ opened above the icon, off the screen.** "Doesn't fit below → put it
    above" never asked whether it fit above. `dropPlacement()` (pure, tested):
    below if it fits, above if it fits, else the roomier side capped and
    scrollable (`.drop-menu` is `overflow-y:auto`); visualViewport height.
  - **a11y_basics failed on the phone: "43 icon-only buttons".** Since v36.65
    a recipe's name is a button, and "icon-only" was `/[A-Za-z0-9]/` — every
    Hebrew name counted. The app's own labeller knew Latin + Hebrew only, so a
    Russian/Arabic/Chinese name would have been announced "Button". **`hasWords()`
    = `\p{L}\p{N}`, any script.** CI never saw it: no Hebrew recipes there.
  - **"Unsaved changes" sat over the Self Test for a minute.** A test closed a
    deliberately dirty edit form with `closeM`, which asks instead of closing;
    a later test happened to close it. Both runners now check EVERY test for a
    dialog it left open (in-app: closed at once and the test fails) — which
    found four more.
  - **"Cloud sync failed: db.runTransaction is not a function."** `saveData()`
    arms a 1.5 s timer; when it came due while a test had swapped `_fbDb` for a
    small fake, the app's real save ran against the test's fake.
    **`timedCloudSave()` holds a due save while `_selfTestRunning`**;
    `_selfTestUnpark` re-arms it. Nothing the app does on its own should run
    in the middle of a test.
  - Also: errors raised during a run are marked `duringTest`, kept out of the
    persistent log and listed apart in the report (they are mostly staged);
    toasts a test raised are taken down at the end of a run (one offered
    "↩ Undo" on test data); Sync Health says "not checked" rather than "could
    not be read" when the photo comparison was never asked.

- **WP-A, THE NON-ARCHITECTURAL PART (v36.66).**
  - **`#appConfig`** — a `<script>` right after the frame guard — holds
    `window.APP_CONFIG` (frozen): the Firebase settings (ONE copy; the offline
    re-initialisation had its own, missing two of six fields), Worker URL and
    app key, Worker name, Cloudflare account, owner e-mail, GitHub repo, site
    origin and path. `WORKER_ENDPOINT`, `APP_OWNER_EMAIL` etc. are read from it.
    Links and labels that name the deployment use `data-cfg-href` /
    `data-cfg-text` templates (`{projectId}`, `{siteUrl}`…) filled by
    `applyAppConfig()`. `cfg_identifiers_in_one_place` fails on any identifier
    typed outside the block. **The CSP `<meta>` is the one exception** — no
    script can reach it; the CSP tests compare it against `APP_CONFIG.workerUrl`
    so a change to one without the other fails. A build step (WP-A.1) fills it.
  - **Dead code, found by coverage, not by reading:** the whole suite plus the
    harvest under V8 function coverage; 246 functions never ran; of those, the
    ones referenced nowhere (code, markup, other pages, tests) were removed —
    `applyTranslation`, `importViaFilePicker`, `showGmailPasteHint`, `setCat`,
    `resizePhotoToDataUrl`, `doEmail`, `parseWordText`, `closeAllDrops`,
    `loadFirebaseDynamically` (190 lines; sign-in reloads the page instead, so
    the startup message saying it "will load it dynamically" was also wrong).
    Kept on purpose, console helpers: `clearAiCache`, `forgetPhotoProbes`,
    `getCloudReads`. Never-ran is not dead: most of the 246 run only signed in,
    online, or on an error.
  - This index.

- **AUDIT BLOCK 6 (v36.65).** Accessibility:
  - **A recipe card is not a button.** The recipe's NAME is (`button.card-open`,
    no `dir` of its own — `dir="auto"` on its container skips descendants that
    have one, and a Hebrew name lost its alignment that way). The ♥ and the
    select tick (`button.select-check`, `aria-pressed`) are siblings, never
    nested. The card keeps its onclick, so a click anywhere still opens it; the
    focus ring is drawn round the card via `:has(.card-open:focus-visible)`.
    `cardKey` is gone — a button answers Enter/Space itself.
  - **Every dialog is handled in one place.** A MutationObserver: any element
    whose id ends in Overlay/Modal that gains `open` (or is appended to <body>
    shown) gets `role="dialog" aria-modal="true"`, `aria-labelledby` its title
    (`dialogTitleEl`: heading, `[class*=title]`, or the first serif line), focus
    moved in unless it already is, and its opener remembered PER DIALOG
    (`_dialogReturn[id]`). Losing `open` / being removed returns focus there,
    or into the dialog underneath. The old single `_focusReturn` stack, pushed
    only by the recipe view but popped by every close, is gone.
    `trapFocus`/`releaseFocus(id)` remain as thin callers.
  - `a11y_every_dialog` opens ALL dialogs; `tests/axe-scan.js` (CI) runs axe
    over the page, the recipe view and every dialog — serious/critical fails.
    v36.64 had 5× nested-interactive and an unlabelled textarea; now none.
  - Not automatable, still owed: a real VoiceOver pass on the iPhone.

- **TONY'S LANGUAGE REQUESTS (v36.64).**
  - **`shared/i18n_index`** — `{langs: {code: {at, count}}, probed}` — which
    languages exist in the cloud. Written (merge) by `i18nIndexNote` after every
    successful `i18nWriteCloud`; admin-only in the rules (matches `i18n_*`).
    `i18nIndexFetch()` reads it once a session (when the 🌐 menu opens) and
    folds it into `tonys_i18n_known`; an admin's first read with no `probed`
    checks each I18N_LANGS document once and records what exists.
    `i18nSupportedLangs()` = cached ∪ known. The menu groups "✓ Ready" above
    "Not translated yet".
  - **The 🌐 carries the language code** (`#langBadge`, `i18nRenderBadge`),
    called wherever `_i18nLang` changes — add it to any new switch path.
  - **🔄 Update all supported languages** (`i18nUpdateAll`, admins only): one
    harvest, then per language `i18nGapList(dict, missing, catalogue)` — only
    the DELTA — one confirmation listing each language, then every language in
    parallel with ONE lane each (`i18nTranslateAll(..., lanes)`), so calls in
    flight stay at I18N_LANES. Each is merged into a copy and saved alone.
    Caches are pruned back to the one language in use afterwards.
  - `_fakeFirestore().set(v, {merge:true})` deep-merges like Firestore.
  - The free-hand import test uses a fixture id and a Russian name
    ("Бабушкин шницель"), at Tony's request; it took a real id from `nextId`.

- **AUDIT BLOCK 5 (v36.63).** Test hygiene and cost visibility:
  - **`_selfTestPark()` / `_selfTestUnpark(p)`** hold everything the suite puts
    aside: English interface, metric units, sync state, backup record, this
    month's AI spend, and cloud writes (the guard). runSelfTests AND the CI
    runner use them — the runner used to park nothing. Add a new "device
    record" there, not in one caller.
  - `run-self-tests.js --lang he` starts the app in a stand-in translated
    interface (every answer "ע<n>", no English) via the device cache and a
    reload; CI runs it. Without the parking 7 tests fail there. The runner
    also fails a run that leaves the interface in another language.
  - **AI this month** in Sync Health: `aiSpendNote(model, usage)` adds each
    answer's `usage` at `AI_PRICES` (USD/MTok, from the pricing page, checked
    2026-09-24: Sonnet 5 $2/$10, Haiku 4.5 $1/$5, cache ×1.25 / ×0.1) per UTC
    month in `tonys_ai_spend`. A model with no price is counted, never
    guessed. Counted before the truncation check — a cut-off answer is billed.
    Beside it, the Worker's family-wide monthly call count.
  - `i18nBudgetNote(batches)`: the translate/finish dialogs warn when today's
    Worker allowance (AI_DAILY_MAX) will not cover the run. The ceiling itself
    is unchanged — it is a guard rail on the bill.
  - index.html size budget raised to 1,400 KB on purpose (real growth).

- **AUDIT BLOCK 4 (v36.62).** Speed:
  - **Recipe cards are translated as they are BUILT.** `renderGrid` passes its
    labels (meal type, difficulty, "srv" / "🍽 {1} srv", the heart's name,
    "Cooked {1} times", the 🏷️ match line) through `i18nPhrase` (`T`) and marks
    each card `data-no-i18n`, so the observer skips it whole. `i18nInstall`
    redraws the grid when the dictionary changes. **Anything new on a card must
    go through `T()`** — `i18n_cards_translated_when_built` renders every card
    variant with a Latin-free dictionary and fails on any English left.
    Measured at 300 cards: translated grid 32 ms → 14 ms (English 12 ms).
  - `i18nUnits` no longer walks into a `data-no-i18n` subtree at all
    (`i18nNoWordsHere`, TreeWalker FILTER_REJECT) — same result, since nothing
    in one was ever a unit.
  - The page walk no longer sees card labels, so `i18nCardLabels()` (every
    category/difficulty the recipes use) and I18N_EXTRA keep them in the
    catalogue. Dropping one would report its paid-for translation as an orphan
    — checked by diffing the full catalogue before and after (nothing lost).
  - **A new language runs `I18N_LANES` (3) batches at once** from one shared
    queue. Stop still stops between batches. `tonys_i18n_ms_per_batch` stays
    the time ONE batch takes; the estimate is `ceil(batches / lanes)` rounds.
    Three ~11 s lanes are ~16 calls/min against the Worker's 40.

- **AUDIT BLOCK 3 (v36.61).** Storage and backups:
  - **localStorage is ~5.24M characters per ORIGIN** (measured, Chromium; about
    half on Safari), shared with every project on rozinante2004-hash.github.io.
    The AI cache now lives in IndexedDB (`tonys_kv` / `kv`, via `kvGet/kvPut`),
    read through an in-memory copy — `aiCacheRead()` stays synchronous;
    `aiCacheInit()` migrates the old localStorage copy once. Tests park it with
    `_aiCacheParkForTest/_aiCacheRestoreForTest`, never by touching the key.
  - **One interface language per device.** `i18nPruneCaches(keep)` drops every
    other cached dictionary (English always stays) and records it in
    `tonys_i18n_known`, so the menu still says "ready" and a failed fetch of a
    known language says "could not be downloaded" — never offers a paid run.
  - Translation bins: newest `I18N_BIN_MAX` (1000) entries, cleared
    `I18N_BIN_DAYS` (90) after the last removal.
  - Sync Health shows "Device storage used" (`deviceStorageReport()`), by
    category; the report carries the same line.
  - **The family's newest backup (`shared/backups`)**: `{at, device, auto}`,
    nothing else. Every device that takes a backup records it
    (`familyBackupNote`, after the write, never before); every device's reminder
    follows `newestBackupAt()` = newer of its own and the family's. Forward-only
    and never in the future. The phone's Backups panel says automatic backups
    happen on the computer. Readers are refused by the rules and keep a local
    record only.
  - **A test must not claim a backup was taken.** `_backupRecordForTest()` /
    `_backupRecordRestoreForTest()` park `BACKUP_RECORD_KEYS`; runSelfTests parks
    them around the run and the CI runner fails any test that changes them —
    which found that the backup-folder test had been stamping "last backup" on
    the real device since v36.20.

- **AUDIT BLOCK 2 (v36.60).** Everyday UX:
  - **An English label beside a Hebrew value needs its own bidi isolate.** In a
    Hebrew recipe "⏱ 2 hours" rendered "hours 2" and "Source:" became
    ":Source". Meta chips are `<bdi>` (direction from their own first strong
    letter) and recipe VALUES carry `dir="auto"`. Chrome LABELS use `<bdi>`,
    never `dir="auto"` — `i18nSkip` treats `dir="auto"` as recipe content and
    would stop translating the label.
  - **`servingsIsYield()`**: a servings value with a word that is not a way of
    saying "people" ("1.5 ליטר", "1 loaf") is a yield — shown as "Yield:", no
    people stepper, ×N only. `parseServings` took the first number and offered
    "Make it for 2 servings" for 1.5 litres of hummus.
  - Every `<select>` has an accessible name (axe *critical*); the family-role
    select's aria-label embeds an e-mail, so it is `data-i18n-skip-attrs` — or
    it becomes a new translation key per member.
  - The family member list is escaped — the only unescaped data the audit found.
  - 📏 Units in ⚙️ Settings; converter units show their names ("fl oz — fluid
    ounces"), translated, with the symbol kept as the option's value.

- **AUDIT BLOCK 1 (v36.59 / Worker v41).** Security, all measured or tested:
  - **Worker `download-store` is gone** — it stored any data under any filename
    and served it from the Worker's address; nothing had called it since v35.0,
    and with the app key public it was an open file host. `worker-cors.mjs`
    proves v40 stored `invoice.exe` and v41 does not.
  - **No Gmail scope at sign-in.** Nothing used that token; `getGmailToken()`
    asks for its own when Send Email is pressed.
  - **Frame guard** (`#frameGuard`, first script): a meta-tag CSP cannot carry
    `frame-ancestors` and GitHub Pages cannot send the header.
  - **Payments and Deployments are owner-only** (`isAppOwner()`,
    `[data-owner-only]`, re-applied whenever ⚙️ opens).
  - **Rules: `access` and `i18n_*` are admin-only.** `match /shared/{docId}`
    (single segment — `shared` has no subcollections) with the exception
    inside the one rule, because rules are OR'd and a narrower match cannot
    take a permission back. **Tested against the real emulator in CI**
    (`tests/firestore-rules.test.mjs`); the live rules fail exactly the three
    new checks. The app's fallback rules copy still had the `allow write` that
    grants deletion — fixed.
  - **Firebase API key restriction: verified** from here — a request with a
    foreign Referer gets 403 "Requests from referer … are blocked".
  - **SRI deferred** — this environment cannot reach gstatic.com to hash the
    scripts, and a hash from any other copy that differs by a byte blocks
    sign-in entirely. Bundling Firebase (WP-A) removes the need.

- **A SELF TEST NEVER TOUCHES A REAL RECIPE OR THE REAL CLOUD (v36.57).**
  `crud_fav` and `feat_cook` used `recipes[0]` — on Tony's machine the
  chestnut collection — and "reverted" by stamping it modified now (feat_cook
  also left `lastCooked` at the time of the run). The next save wrote it to the
  family cloud on EVERY run: the `[test] Wrote "ערמונים…"` line in every log.
  v36.55's restore of the sync bookkeeping then put back the pre-run version
  record, so the following save was refused as edited elsewhere — a dialog on
  top of the Self Test. Three layers now:
  - `runSelfTests()` swaps `_fbDb` for `_selfTestNoCloudWrites(realDb)` for the
    length of the run: reads pass through, every write (set/update/delete, in
    transactions and batches too) is held back **silently** — a refusal raises
    exactly the dialog that started this — and counted in the log. Tests that
    need a cloud already bring `_fakeFirestore()`.
  - The CI runner fails any test that leaves a non-fixture recipe different.
    **`recipes` is a top-level `let`, which is NOT on `window`** — the first
    version read `window.recipes`, compared nothing with nothing, and passed the
    guilty tests. Found by running them.
  - Tests use their own recipe with an id ≥ `TEST_ID_MIN`. Never `recipes[0]`
    for anything that writes.
  - `normalizeRecipe` drops `lastCooked` from a recipe with no count and no log
    — the only case where a test's stamp is provably not a real cook.

- **A TEST MUST LEAVE THE SYNC STATE AS IT FOUND IT (v36.55).** Tony's Sync
  Health, copied a minute after a Self Test run, said "damaged cloud documents:
  1 (ids 2)" and "57 documents in the cloud" for 55 recipes. All three were test
  fixtures: `_cloudSnapshotForTest()` did not include `_cloudUnreadable`, kept
  the maps BY REFERENCE (so a test that mutated one in place was "restored" to
  the object it had just changed), and `parseCloudRecipeDocs()` calls
  `saveCloudBase()`, which wrote a fixture's version map over the real one in
  localStorage. Eleven tests leaked something. Reproduced exactly on v36.54
  (+2 cloud ids, damaged id 2), identical before/after on v36.55.
  - The snapshot is complete and by COPY, including every `tonys_cloud_*` key.
  - `runSelfTests()` snapshots and restores the whole sync state around a run,
    so Tony's session can never be where a missed leak is found.
  - The CI runner fingerprints the sync state before and after EVERY test and
    fails the one that changed it. Tests that go through the real sync path are
    declared in one list at the end of `self-tests.js` and wrapped there; a new
    one fails the build until it is added **on purpose**.

- **A TINTED SURFACE AND ITS TEXT ARE A PAIR (v36.54).** Tony's recipe Notes
  were `background:#FFF8E8` under `color:var(--ink)` — near-white on cream in
  dark mode, 1.1:1 — and the contrast scan reported zero findings in both
  themes. Every tinted surface is a token pair now: `--note-*`, `--bad-*`,
  `--warn-*`, `--ok-*`, `--info-text`, each flipping with the theme. **Never
  write a literal pastel under themed text, or a literal dark colour on a
  themed surface.** A literal *pair* (the print page) is fine.
  - **Why the scan missed it: it measured what rendered, and nothing did.** Its
    fixture recipe had no notes; its panels were opened by class without their
    render functions running; its only recipe words were the harvest's `·`,
    which the text filter skips. It now uses `i18nHarvestRecipe()` with real
    words in both scripts, a collection, a seeded log, every `I18N_HARVEST`
    render, the error dialog with actions and the converter with a category.
  - **Plus two static checks** for what no fixture reaches, both build
    failures: an undefined CSS variable (`var(--card)` never existed, so four
    surfaces had no background and their `--warm-brown` text was 1.08:1), and a
    light literal surface with themed text in one inline style.
  - **`--warm-brown` is a SURFACE in dark mode** (`#2A211A`). As text it only
    works on a light surface (the white round close buttons). Text on a card is
    `--heading`.
  - **`--terracotta` is LIFTED in dark mode for use as text.** Behind white text
    use `--terracotta-fill`.
  - **`#8A8279` is the old muted grey (3.78:1).** `--muted` replaced it but
    thirteen literal copies survived; all gone.
- **…AND AS HIS PC IS (v36.58).** The fifth device-state branch: the log nudge
  is ON on his PC and his log held an error, so the nudge fired at startup and
  `log_nudge_is_quiet_and_per_device` then read `already-shown-this-session`.
  The test sets the session flag and any on-screen nudge aside and restores
  them; CI has a second `--prefs` step with his PC's state.
- **THE SUITE RUNS AGAIN AS TONY'S PHONE IS SET UP (v36.54).** Four times a test
  failed on his device and passed in CI because something he had chosen was
  never true there — signed in, a recipe with history, a fully illustrated
  library, and then Imperial units (remembered per device since v36.51, which
  made `feat_scale_servings` read "3.5 oz"). `run-self-tests.js --prefs '{…}'`
  seeds localStorage before the first load, and CI runs the suite a second time
  with his settings. `runSelfTests()` parks the unit preference as it parks
  the language. **Any new per-device preference goes into that CI step.**

- **A TRANSLATION THAT MOVES THE LINKS FROZE THE APP (v36.52).** Tony generated
  Japanese and his laptop stopped responding to anything — through a reboot,
  and in a fresh Firefox profile too, while English and Hebrew were fine and the
  phone (still in Hebrew) was untouched. Two bugs, and it took both:
  - **The flip.** Inline children (links, bold words) were matched to `{1}`,
    `{2}` by their position **on screen**. Japanese is subject-object-verb, so
    "Press {1} and then {2}" comes back as "{2}の前に{1}を押す" — and after
    that, the screen order is the translation's order. The next pass read it
    as English order and swapped them back; the pass after swapped them again.
    `i18nKidOrder()` records the English order in a WeakMap at the only moment
    the screen can be trusted about it — when the app has just written English
    — and uses the record for as long as the same children are there.
    `i18nRevertAll()` uses it too, or going back to English after Japanese
    puts each link's words on the other link.
  - **The explosion.** One rewrite is three or four mutation records, and the
    observer queued the element once **per record**. Harmless while apply
    settles first time; exponential the moment it does not — four, sixteen,
    sixty-four. The queue is de-duplicated per frame now. Measured: with the
    flip left in and only the de-dup, the app stays responsive; with neither,
    frozen inside 1.5 s.
  - **Why the reboot did not help:** the language is remembered per device, so
    the app came back up in Japanese — with the observer started **before** the
    dictionary arrived, so every rewrite was seen. A *switch* applies first and
    starts the observer after, which is why the first reproduction attempt
    looked fine. Always test the restart path, not just the switch.
  - **The breaker.** `i18nRewriteRunaway()`: any one element rewritten more than
    `I18N_RUNAWAY` (20) times in a second is left alone for the session and the
    key and value go to the log. A dictionary is data from a model; the next
    language will have a shape nobody thought of, and one bad entry must cost
    one label, never the app.
  - **Recovery when the UI is frozen:** in the browser console,
    `localStorage.setItem('tonys_ui_lang','en'); location.reload()`.
  - **Headless Chromium throttles requestAnimationFrame to ~2 fps**, which hid
    this loop in the first three reproductions. Launch with
    `--disable-renderer-backgrounding --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows` and `bringToFront()` for anything
    that depends on frame rate.
- **THE UNIT CONVERTER ONLY EVER HANDLED THE AMOUNTS A TEST TYPES (v36.51).**
  Tony reported Imperial/metric as broken and was right. `cvtIng` was
  `^([\d.]+)\s*<unit>$` against five exact spellings, so `"200 g"` converted and
  **"200 גרם" did not** — nor `"1/2 kg"`, `"200-300 g"`, `"½ lb"` or
  `"2 pounds"`. His recipes are written in Hebrew. Nothing regressed; it had
  never worked on the library it was written for, which from where he is
  sitting is the same thing. The matcher now works by unit NAME in both
  languages with the spellings people use, `cvtNum()` parses decimals,
  `1/2`, `1 1/2`, `½` and `1½`, and a range converts **both ends or neither**.
  - `cvtNum()` returns **null, never NaN** — null is a decision to leave the
    amount alone; NaN is a bug that reaches a recipe.
  - A permissive matcher must be able to say no. `"1 large egg"` ends in `g`,
    and reading it as grams would rewrite the recipe. When the number in front
    does not parse the loop **continues to the next unit** rather than
    returning, because `"1 kg"` ends in `g` as surely as `"200 g"` does.
  - **The choice has to stick.** `viewUnit` reset to metric on every `openView`
    while the scale was remembered per recipe, so pressing Imperial and opening
    the next recipe looked exactly like the button doing nothing. Scaling is a
    property of the occasion (per recipe); units are a property of the person
    (per device, `VIEW_UNIT_KEY`).
- **A NUMBER IN A DIALOG THE NEXT SCREEN CONTRADICTS (v36.51).** The translate
  confirmation said "about half a minute" because somebody typed that. Tony
  agreed to half a minute and the progress panel — which measures the real
  thing — told him eight. The panel was right. Both dialogs now estimate from
  `i18nBatchCatalogue()`, the **same** batching the run uses, times a per-batch
  figure learned from the last runs (`i18nMsPerBatch`, clamped to 1.5–60s so one
  batch on a dropping connection cannot claim an hour).

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
- **A relay never sees a URL without the user's consent (v36.18).** Those three
  proxies are not ours: they see every address imported through them and they
  choose what text comes back. v36.17 made the HTML they return inert, but a bad
  relay can still feed doctored TEXT to the AI and produce a recipe that is
  quietly wrong — a judgement only the person importing can make. `proxyConsent()`
  asks before the first relay fetch, and remembers the answer **only** when the
  "Never show this message again" box is ticked (`tonys_proxy_consent`, per
  device, also settable from ⚙️ Settings → Logging & debugging). A decline is a
  one-off no and is never stored. The preview then says which relay supplied the
  text. These helpers live at script top level, next to `importFailureCausedByUs`
  — **not inside `runUrlImport`**: declared in there they are function-scoped, and
  `renderLoggingPanel()` (a different script block) cannot see them. That is
  exactly how the first cut of v36.18 broke.
- **The Worker meters the bill, and one KV write is not free (v39, audit C5/S4).**
  Cloudflare's free tier allows **1,000 KV writes a day**; reads are 100,000, so
  writing is the constraint. v38 wrote once per allowed request, so a single
  "auto-fetch missing photos" across 300 recipes was 300 writes in a burst — and
  past the allowance the `put` threw, an empty `catch` swallowed it, and **the
  limiter silently stopped limiting for the rest of the day**. The guard rail
  failed exactly when it was being leaned on. Now: the cheap, high-volume paths
  are sampled (count 1 request in 5, credit 5), the Anthropic path is still
  counted exactly because it is rare and is the only one that spends money, and
  a failed write trips an isolate-scoped breaker that pauses AI until a write
  succeeds again. There are also **daily and monthly ceilings** on the Anthropic
  path across all callers (`AI_DAILY_MAX` / `AI_MONTHLY_MAX`, defaults 300 and
  3000) — a per-minute limit alone allows ~57,000 calls a day on Tony's credits
  if the app key ever leaks. `aiSpend` is deliberately narrower than `costly`:
  `instagram-fetch` is slow and rate-limited but spends no Anthropic credits, so
  it must never eat the AI ceiling. A ceiling refusal says **whose** ceiling it
  is — "RATE_LIMIT" with no owner sends the reader to Anthropic's status page to
  debug a limit set in this file — and the client does not retry it, because
  four rounds of backoff cannot change the answer.
- **A backup folder is a HANDLE, not a path (v36.20, audit F2).** Tony asked for
  a backup location he could set. A web page cannot be handed `/home/…` — no API
  takes a filesystem path, and one that did would be a hole rather than a
  feature. What it can have is `showDirectoryPicker()`: the person chooses a
  folder once, the `FileSystemDirectoryHandle` lives in IndexedDB (store
  `handles`, db **v3** — a handle is structured-cloneable, so localStorage would
  turn it into `"[object Object]"`), and the app writes dated snapshots into it.
  Three things that are easy to get wrong:
  - **Permission lapses independently of the handle.** The browser keeps the
    handle but may drop write permission, and `requestPermission()` needs a user
    gesture. So `backupDirPermission(handle, interactive)` has two modes, and the
    automatic path passes `false` — it must never ask from a page load. The test
    asserts `requestPermission` was *not called*, not merely that nothing was
    written: a version that asks and is refused would pass the weaker check.
  - **Pruning deletes files in someone's own folder.** It matches only the exact
    name shape the app writes (`tonys-recipes-backup-YYYY-MM-DD.json`), keeps the
    newest `BACKUP_KEEP`, and is tested against a folder holding a tax return.
  - **Falling back must be audible.** If the folder write fails, `backupSave`
    downloads instead and says so — a file appearing somewhere the person was not
    expecting, silently, is the failure this item exists to remove. Browsers
    without the API (Firefox, everything on iOS) simply always download.
  The nudge now escalates: toast at 30 days, a toast that stays at 60, a dialog
  at 90 — and the dialog asks at most once a day, because a dialog on every
  reload trains the reader to dismiss it without looking.
- **Restore has two modes, and the safe one is the default (v36.21, audit F3).**
  Restore used to be all or nothing: it replaced the whole collection here and
  on every other device. That is the right tool for "this device is wrong" and
  the wrong one for "a recipe went missing" — which is the case that actually
  happened, and why recovering the clip meant reading the JSON by hand. "Add
  what is missing" never overwrites, never deletes and never touches a recipe
  already here; it only adds back what is gone, and it counts them first.
  - **The choice is offered AFTER the file is read**, because "N missing" is the
    number that decides it. The button that opens the picker no longer promises
    what will happen.
  - **A recipe now inside a collection is still here.** `currentRecipeKeys`
    walks `recipeParts` too — without that, a backup from before a merge adds
    every part back as a loose duplicate, which is the mess the merge was
    tidying up.
  - **Matching is by id OR normalised name**, and this is exactly why the mode
    only ever ADDS. A false match that skipped a recipe leaves one you can add
    by hand; a false match that overwrote one is data gone. `mergeKeyName` uses
    `\p{L}\p{N}` so Hebrew names match — half the collection is Hebrew.
  - **Added recipes get FRESH ids.** The ids in a backup were allocated against
    a different collection; reusing one silently attaches the restored recipe to
    whatever now holds that number, including its cloud photo document.
  - `askConfirm` grew `altLabel`/`altDanger` for the third answer (resolves
    `'alt'`). Only a caller that passes `altLabel` sees it, so nothing else moved.
- **The bulk, structural operations have Undo now (v36.22, audit F4).** Deleting
  has had it since 1.4. Splitting a collection, merging into one, and "update
  the existing one" on an import did not — and `splitCollection` said so out
  loud: *"This cannot be undone from here."* Each rearranges a lot of the list
  at once, and the only route back was a backup file.
  - **The snapshot is the ARRAY, not the recipes.** `recipes.slice()` keeps the
    same objects and restores membership and order for the cost of one list of
    references. A deep copy would duplicate every inlined photo — tens of MB.
  - **`inPlace` is the exception that makes it correct.** A record edited where
    it stands (a collection gaining parts; a recipe overwritten by an import)
    is the same object the list snapshot points at, so it is deep-copied
    separately. Restoring puts the keys back **on the original object** —
    `recipes`, `viewId` and the cloud all refer to it by identity, and swapping
    in a new object would strand the old one. Keys the operation *added* are
    deleted, or half the overwrite survives the undo.
  - **The cloud has to be told both ways.** What the operation created must be
    queued for deletion, or the next load brings it back beside the recipes it
    was made from; what it removed must be *un*queued.
  - **`nextId` is never wound back** (`Math.max`). An id handed out during the
    operation may already own a photo document in the cloud, and reusing it
    hands that document to a different recipe.
  - Undo is one-shot — a second press must say "Nothing to undo", not rewind
    something unrelated — and `clearBulkUndo()` is called on every path that
    decides not to change anything after all.
- **The header FOLLOWS YOUR THUMB, and all of it goes (v36.23 → v36.30, audit U1).**
  34% of a 390×844 phone was fixed chrome before a single recipe. As of v36.30
  the **whole** brown header travels — search and + Add Recipe with it — leaving
  the filter bar alone: measured **291 → 85px, 34.5% → 10.1%**.
  Four versions, and the differences are the story:
  - **v36.23** hid the brand row at a scroll *threshold*. The page jumped.
  - **v36.27** gave `.header` a negative sticky `top` so it slid at the pace of
    the scroll — but **position**-based: from deep in a list it only came back
    near the top.
  - **v36.28** made it **direction**-based. `_hdrHidden` moves by the scroll
    *delta*, clamped to `[0, slide]`, written to the sticky `top`; the browser
    renders at `max(naturalTop, -_hdrHidden)`. Costs one rAF-throttled listener.
  - **v36.30** extended the travel from the brand row to the whole header.
  - **The status-bar inset is deliberately left behind.** The page is
    `viewport-fit=cover`, so sliding the header *entirely* off a notched iPhone
    puts the filter bar's chips under the clock. `headerSlidePx()` is
    `header.offsetHeight - safeAreaTopPx()`, and `safeAreaTopPx()` measures
    `env(safe-area-inset-top)` through a hidden probe element — env() cannot be
    read from JS any other way. On a device with no inset it is 0 and the header
    goes completely.
  - **`y = window.scrollY || documentElement.scrollTop` is a bug**, and it was in
    here. `scrollY` is a number in every browser this runs in, and a legitimate
    **0** — the top of the page, exactly when the header must be whole — is
    falsy, so the chain fell through to a different element's scroll position.
  - **The `y <= 0` reset is not redundant.** A rubber-band or a resize can land
    on y=0 with no movement to report. Its test sets `_hdrLastY = 0` too —
    otherwise the delta alone does the work and the guard could be deleted
    unnoticed.
  - **`tests/phone-chrome.js` is why any of this is checked**, and it holds a
    *budget*, not a description. Note the trap it caught: the first cut of the
    self-test wrapped everything in `if (phone)` and **asserted nothing** at
    desktop width — four mutations sailed through. The suite now stubs
    `headerSlidePx()` so the delta arithmetic runs at any width; phone-chrome.js
    measures the pacing in both directions at a real 390×844, scrolling
    *monotonically* (reaching a sample point by scrolling up now moves the
    header, which would read as a jump).
- **A Hebrew recipe's LABELS read right too (v36.30).** `recipeIsRTL(r)` had been
  deciding the two-column order since v36.0; v36.30 puts the same answer on
  `.modal-content` as `.rtl-recipe`, so SOUP, NOTES, Method, Ingredients and the
  meta row stop sitting on the opposite margin from the recipe.
  - `.recipe-columns[dir="rtl"] > * { direction: ltr }` exists so the column
    *order* can flip without dragging each column's internals along — right for
    an English recipe containing a Hebrew line, wrong for a recipe that **is**
    Hebrew. `.rtl-recipe` overrides it.
  - **The control strips stay LTR on purpose**: ×0.5 ×1 ×2 and Metric/Imperial
    are a numeric strip learned by position, not a line of reading.
  - An English label inside an RTL line needs **`unicode-bidi: isolate`**, or
    "Source:" renders as ":Source".
- **The Edit modal can use the window (v36.30).** 600px is the right cap for a
  dialog you read and the wrong one for a form you work in — at 1280px an
  ingredient name had ~340px of field. ⤢ in the corner toggles
  `max-width: calc(100vw - 24px)`, remembered per device, desktop only. The
  fields stretch because they were already `width:100%` or grid `1fr`; what held
  them was the modal. The ingredient grid gives the extra room to the **name**
  column — an amount is "500 ml" at any width.
- **The "one item away" count is memoised, and a stale one is a chip that lies
  (v36.23, audit P2).** `missingFromPantry` walks every ingredient of every
  recipe against the whole pantry, on every filter toggle; measured at 1,000
  recipes it was 9.1ms and `renderFilters` 8.1ms, now 0.01ms and 0.9ms. Two
  independent guards, neither trusted alone: a fingerprint (`filterCountKey` —
  recipe count, sum of ingredient counts, sum of `updatedAt`, plus the pantry)
  that is one property read per recipe against a computation that is O(ingredients
  × pantry) per recipe; and an explicit `invalidateFilterCounts()` from
  `saveLocal` and `setPantry` for the paths that mutate and re-render *before*
  saving (`collectSelectedInto` does exactly that). The escape hatch has its own
  test — an ingredient **renamed in place** is the one mutation the fingerprint
  cannot see, and an untested escape hatch is one that has quietly stopped
  working. The no-photo count beside it is deliberately **not** cached: `!r.photo`
  is one read per recipe, so a cache would cost more than it saves and add a
  second thing that can go stale.
- **A photo's bytes go through the Worker, and ONLY the Worker (v36.24/v36.30,
  audit S2 — closed).** `connect-src` carried a bare `https:` that allowed every
  origin and made the allowlist after it decorative. The reason was real:
  applying a photo downloads its bytes with `fetch()`, and Openverse federates
  Flickr, Wikimedia, NASA and museums, so the host set cannot be listed.
  `fetchPhotoBlob()` asks the Worker's `photo-fetch`, which turns "anywhere"
  into one named host — and also fixes image hosts that send no CORS headers.
  - **v36.24 shipped with a direct fallback and kept `https:`; v36.30 removed
    both, once Worker v40 was confirmed live.** They had to move together: a
    direct retry with `https:` gone is a blocked request, not a rescue.
    `sec_photo_bytes_via_worker` asserts **both directions** against each other,
    so neither half can drift alone.
  - **A refusal now fails loudly, in the Worker's own words.** "Could not
    download" would send the reader to the photo site to debug our rate limit.
    Where the Worker gave no reason, the message points at ⚙️ → 📡 Sync Health.
  - **A 200 that is not `image/*` is not the photo.** The Worker answers with
    JSON when it refuses; compressing an error document into a recipe photo is
    what that check exists for. Server side, non-image types are 415'd.
  - `photo-fetch` is a fetch-anything primitive: http(s) only, capped at 12 MB
    (checked against the body, not the claimed `content-length`), behind the
    origin check, the app key and its own 600/min ceiling.
  - **Fixed on the way past: `corsFor()` declared `Content-Type:
    application/json`,** and the wrapper stamps that on *every* response — so the
    KV file download was served as JSON from v36 on.
- **The Worker's live version is on screen (v36.29).** It deploys by hand,
  separately, and three releases running needed a paste only Tony could do with
  no way for the app to confirm it landed. ⚙️ → 📡 Sync Health reports the
  version, the day's AI-call count, and the two failures that otherwise look
  like nothing: "could not be reached" and "refusing this app's key". Asked once
  per session. **The copyable dump must carry it too** — v36.29 added the row to
  the panel only, Tony copied the dump to answer "which Worker is live?", and
  the one line that answered it was missing (fixed v36.30). Two renderings of
  the same panel that disagree is a bug in the reporting tool, which is worse
  than a bug in a feature.
- **The interface can be translated; the RECIPES never are (v36.31).** The app
  has no message keys — 20,000 lines of English written inline — so retrofitting
  them would be a rewrite. The dictionary is keyed on **the English text
  itself**. Consequences to know before touching it: editing an English string
  in the markup orphans its translations (the editor shows orphans rather than
  hiding them); the same word in two places gets one translation; and nothing
  needs registering, so a new button is translatable the moment it renders.
  - **`dir="auto"` is the boundary.** It was already the project's marker for
    "content, not chrome" (v36.25), and it is reused verbatim: the walk stops at
    any ancestor carrying it, which is every element holding recipe text.
  - **An ATTRIBUTE can hold recipe data where `dir="auto"` cannot reach** — the
    recipe card's `aria-label` is the recipe's name. `data-i18n-skip-attrs`
    exists for exactly that. Marking the whole card with `data-no-i18n` was the
    first attempt and it was too blunt: it also froze the category and
    difficulty badges, which are chrome.
  - **A sentence split by `<strong>` or `<a>` is ONE unit**, with the inline
    children replaced by `{1}` `{2}` placeholders and put back wherever the
    translation says they belong — frequently not where they started, in Hebrew.
    7% of the catalogue is such fragments; translating them separately produces
    word salad.
  - **The English original is parked on the node** (`data-i18n-src`) the first
    time it is touched. Without it, switching language twice applies the second
    to the first one's output. Its test asserts the parking **exists** before
    relying on it — the first version used `querySelector`, which is null when
    the parking is gone, so the mutation made the check skip itself.
  - **A MutationObserver re-applies to what changed**, scoped to added nodes.
    Hooking all thirty-odd render functions would rot on the thirty-first;
    a full-page pass on every render walks thousands of nodes at 300 recipes.
  - Storage is one Firestore doc per language in `shared/i18n_<lang>`, which the
    published rules already cover for reading. **A read-only member cannot
    write there**, so a translation they generate works for them and is not
    shared — and the app says so rather than implying it published.
- **Getting ALL of it translated is a separate problem from translating (v36.32).**
  Tony's first Hebrew run left the Clips button and every row of the Meal and
  Diet panels in English. Four distinct causes, all now closed — and the shape
  of the bug matters more than the four fixes, because the next one will look
  like this too:
  - **An icon beside the words made the whole control untranslatable.**
    `<button><svg/>Clips</button>` and `<label><input type=checkbox>🌅 Breakfast</label>`
    both hold their text next to a child that is not in the inline list, and the
    rule "a non-inline child means this is not one sentence" threw the element
    away entirely. The test is whether the child holds WORDS
    (`i18nPlaceholderChild`), not what it is called. An empty child is a
    placeholder; a child with its own text is still a wall.
  - **The dictionary key is the sentence WITHOUT its bookends.** `i18nEdges()`
    strips a leading or trailing `{n}` so the icon-prefixed Clips button and the
    plain one share one key — otherwise the same word gets two translations. The
    node keeps the whole string, because that is what says where the icon goes
    back, and an icon does not reorder in Hebrew.
  - **`i18nUnits(scope)` includes the scope itself.** The observer hands it the
    node that was just added; before v36.32 that one element was the one thing
    skipped.
  - **Text rewritten IN PLACE is not an added node.**
    `mobileMealBtn.textContent = '🍽 Meal ▾'` in `updateFilterChips()` reverted
    the label to English on every filter change, and no `childList` record about
    added nodes ever mentioned it. The observer now watches `characterData` and
    re-applies to any target carrying `data-i18n-src`. **That makes `i18nApply`
    idempotence load-bearing** — an unconditional rebuild is now a mutation that
    wakes the observer that performs the rebuild, forever. Hence `i18nPlan` /
    `i18nMatchesPlan`.
  - **A batch can answer with fewer strings than it was asked for** and nothing
    in the response says so. `i18nTranslateAll` diffs what came back against
    what went out, retries only the shortfall, and returns `missing`.
  - **What cannot be catalogued in advance is recorded at the moment it is
    asked.** A dialog's wording lives inside the function that asks it, so it is
    not in the DOM when a language is generated and never could be. `i18nApply`
    notes every key the dictionary could not answer; the 🌐 menu shows the count
    and offers "Finish translating", which translates only the gap. The app
    converges on complete by being used.
- **HARVEST BEFORE YOU CATALOGUE (v36.35).** `i18nCatalogue()` is honestly named:
  it is every string the interface can show **right now**, and for most of this
  app that is a fraction of what it has. Logging & debugging, Sync Health,
  Backups, What leaves this device, the WhatsApp sources, the access list and
  the entire open-recipe screen are built by a render function the first time
  they are opened, so on a fresh page they are empty `<div>`s. Tony found eight
  such panels still in English and could not fix one of them from the editor,
  because none of their words had ever been in the file. `i18nHarvest()` draws
  them all first — 582 keys becomes 719.
  - **Every entry is a RENDER, never an action**, `toast` is muted for the
    duration, and the whole thing must leave the screen exactly as it found it.
    The test asserts the library size, `viewId` and the set of open overlays are
    all unchanged.
  - **Collect after each screen, not once at the end.** Panels sharing a host
    overwrite each other, and the recipe screen puts back whatever was being
    read when it is done — so a single read of the DOM afterwards sees only the
    last one standing. The recipe screen contributed *nothing* the first time
    this was written, for exactly that reason. Hence `i18nCollect()` and
    `i18nFullCatalogue()`.
  - **`drawView()` takes no argument** — it looks the recipe up by `viewId`, and
    it OPENS the overlay at the end. The stand-in recipe is pushed into
    `recipes` for the length of one render and spliced out in a `finally`.
  - It is drawn from `i18nHarvestRecipe()`, built to light up **every branch**:
    a real recipe would only show the parts that apply to it, and Version
    history, the cooking log and the nutrition panel would stay invisible and
    untranslated for ever.
- **The app READS ITS OWN SOURCE for the messages that have no screen (v36.36).**
  Drawing every panel still misses the largest category of all: a toast, a
  confirmation or an error lives inside the function that raises it and is in
  the DOM for four seconds, possibly years after a language was generated.
  There are 250 `toast()` sites alone. `i18nScrapeSource()` fetches
  `location.href` (this file, already in the service worker's cache) and takes
  only strings that are the **whole** argument — `toast('AI cache cleared')`
  yes, `toast('Saved ' + n + ' recipes')` no, because what reaches the screen is
  the composed string and translating half of it changes nothing while still
  costing money. 152 of 250 toasts qualify; the other 81 are an honest gap.
  - Read at run time rather than pasted in as a generated list: a pasted list is
    right on the day it is written and quietly wrong after the next edit.
  - A single token carrying `.`, `/` or `@` is an example value, not a sentence.
    `123456789-abc.apps.googleusercontent.com` is the Gmail Client ID
    placeholder and has to stay exactly that.
- **THE EDITOR IS LTR, whatever the interface is doing (v36.49).** Its left
  column is English, its rows read English-then-translation, and its summary is
  a sentence of Latin words and numbers. Under `dir="rtl"` the bidi algorithm
  tore Tony's count off its own noun and parked it at the end: *"remove 720
  orphans · of 2060 shown · 1970 translated, 90 not … 2060"*. The translation
  column keeps the language's direction — that is the one part that needs it.
- **SPLITTING A BLOCK ORPHANS ITS TRANSLATION.** v36.41 cut the WhatsApp export
  manual into four `<div>`s to get under the 1,500-byte field-name limit, and
  that orphaned the Hebrew for the whole block — sixteen placeholders' worth.
  It cannot be re-matched: the old value is one passage and the new keys are
  four, and there is no mechanical way to know where the Hebrew divides. **A
  markup change that alters unit boundaries costs the translation of everything
  inside it**, in every language. Worth knowing before splitting a block that is
  already translated.
- **RE-KEYING DOES NOT NEED A LIVE TARGET (v36.48).** Most stale keys only
  render in a state the app is not in — an error it has not had, a sync that has
  not timed out — which is precisely why they went stale. Requiring the target
  to be on screen left 720 of Tony's orphans unrecoverable for no reason. An
  orphan is re-keyed to **what the current rules would make of it**, whether or
  not that key is currently showing.
- **AN ORPHAN IS NOT NECESSARILY DEAD.** "{1} min ago" is a perfectly good key
  that simply is not on screen. The removal dialog says so, because deleting one
  of those means paying to translate it again later.
- **THE SELF TEST STAYS ENGLISH (v36.53) — Tony's decision.** It is his own
  diagnostic screen and he reads it in English; translating its ~280 test names
  and headings made every new language a fifth bigger (1,533 → 1,250 keys, ~10
  → ~8 minutes). `#selfTestOverlay` and the detail popup are `data-no-i18n`,
  the harvest no longer draws the list, and entries already in a dictionary are
  classed **unusable** by `i18nSelfTestWords()` so "remove N unusable" clears
  them. `i18nForgetSelfTestWords()` loads the suite first (the names cannot be
  recognised without it) and drops them from the missing list, so the
  gap-filler never pays for them. **Do not re-add the self-test list to
  `I18N_HARVEST`.** The v36.51 note below is kept for how the orphans arose.
- **THE HARVEST HAS TO DOWNLOAD THE SUITE BEFORE IT CAN DRAW IT (v36.51).**
  `SELF_TESTS` is empty until `loadSelfTests()` runs, so the `I18N_HARVEST`
  entry for the self-test list rendered an empty `<div>` and **none of the 265
  test names or their group headings was ever catalogued**. They are translated
  on screen — the observer looks each one up as it renders — so nothing looked
  wrong; only the editor knew, and it called all ~270 of them orphans. That was
  most of the 310 Tony was staring at. Note the cost: the catalogue went
  1,254 → 1,533, about 22%, and a new language now takes ~10 minutes rather
  than ~8. It is not *new* cost — the missing-list mechanism would have
  collected them the first time the screen was opened — only visible cost.
  - **This one cannot be tested from inside the suite.** By the time the suite
    runs, the suite has obviously been downloaded, so the harvest finds the list
    populated either way. The assertion checks that the entry *asks*, and says
    in its message why that is the strongest thing available.
- **A KEYCAP IS AN EMOJI, NOT A NUMBER (v36.51).** `1️⃣` is the ASCII digit 1
  wearing `U+FE0F U+20E3`, so v36.47's rule read it as a count and turned the
  Bring! refresh steps into `"{1}️⃣ Click {2} below"` — nonsense as a key, and
  it orphaned three lines that were already translated. A digit followed by a
  keycap is skipped; the bare digits beside it are still placeholders.
- **ALREADY PORTED IS NOT UNPORTABLE (v36.51).** `"4 min ago"` holding
  `"לפני {1} דקות"` is the result of a re-use that happened once already: the
  key kept its 4, the value grew its `{1}`. `i18nEdPortValue()` then looked for
  the 4 inside the Hebrew, found nothing, and refused — so it could never be
  re-used, and its target had no translation so it was never dead weight
  either. It just sat there. **This is why Tony had no re-use button at all.**
  If the value already carries exactly the placeholders the key needs, it needs
  nothing doing to it.
- **A JOINED LINE IS AN UNBOUNDED KEY (v36.51).** The log nudge lists finding
  titles separated by `" · "`. As one string, every combination of findings is a
  new dictionary entry. The line is `data-no-i18n` and each title is looked up
  on its own through `i18nPhrase()` — keys the app already has. Use
  `i18nPhrase()` anywhere code must **join** translated text rather than hold it.
- **THE SCRAPE READS THE SCRIPTS, NOT THE FILE (v36.50).** `i18nScrapeSource()`
  fetches `location.href`, which is an **HTML document**, and handed it whole
  the JavaScript lexer opened a "string" on the quotation mark in
  `<html lang="en">` — character 10 — and spent the rest of the file half a step
  out of phase. It still returned 276 messages, which is why this survived three
  releases of being looked straight at: *a lexer that is wrong half the time
  looks like a lexer that works.* `i18nScriptsOnly()` blanks everything outside
  an inline `<script>` to spaces, newlines kept, so every offset still points
  where it did. Nothing is lost by it: no inline handler in this file contains a
  translatable literal, and the markup is catalogued from the DOM anyway.
- **A TEMPLATE LITERAL IS NOT A STRING WITH BACKTICKS FOR QUOTES (v36.50).**
  `${…}` is code, and the code inside it usually holds another template —
  `` `<div>${cond ? `<span>…</span>` : ''}</div>` `` is the house style here.
  Read as one flat string it closed on the **nested** backtick and desynchronised
  the next two thousand characters. `i18nLexSource()` now walks a template as its
  own thing: its text is string, its holes are handed back to the code lexer, and
  the two nest. Both PWA install toasts sat in Tony's dictionary as orphans
  because of this, and they were among the ones he said "look legit" — they were.
- **AN ORPHAN ALREADY TRANSLATED UNDER ANOTHER KEY IS DEAD WEIGHT (v36.50).**
  v36.48 caught this via `i18nEdSelfKey()`, which returns any key holding `{n}`
  **unchanged** — so `"⚙️ Worker settings & secrets {1}"` slipped past it, even
  though the app now catalogues that link as `"⚙️ Worker settings & secrets"` (a
  trailing element stopped being part of the sentence in v36.39). It could never
  be re-used — the target already has a translation — and never removed, so it
  sat in the list looking like work. The test is made on `i18nEdNorm()` now, i.e.
  on the **words**, not on the exact key.
- **TYPOGRAPHY IS NOT A RENAME (v36.50).** `i18nEdNorm()` folds `…`/`...`, curly
  quotes and the dash family **for comparison only**. The day someone tidies
  `...` into `…` in the markup, the old entry becomes an orphan holding a
  perfectly good translation, and nothing else would ever match it back.
- **EVIDENCE IS NOT INTERFACE TEXT (v36.50).** Three of the sync-log findings
  build their `detail` out of the log — recipe names, whatever was logged, and a
  `(×3)` on the end. Every distinct combination is a new key, so they are marked
  `raw` and rendered `data-no-i18n`; the title and the "Try:" line beside them
  stay translatable. Same unbounded class as the log rows (v36.44) and the counts
  (v36.47). **A person's name is data too** — the owner row and every member row
  in 👥 Family Access carry `data-no-i18n`, because nothing translates a name and
  a model asked to try will transliterate it.
- **A TEST THAT CANNOT FAIL IS NOT A TEST.** The first version of the check
  above rendered the findings panel after writing events with `syncLog()` — which
  stamps everything a test causes with `t`, which the analyser drops. So the
  panel had no findings in it at all, the assertion found the words in the
  **event rows** (marked since v36.44), and passed whether the renderer had been
  fixed or not. It writes with `writeSyncLog()` now, and asserts both findings
  are on screen before asking anything about them. Every claim in this release
  was checked by breaking the fix and watching the suite go red.
- **A SCREEN STATE THE HARVEST CANNOT ENTER GOES IN `I18N_EXTRA` (v36.50).**
  `+ Add Recipe` only exists for somebody with no recipes and no search;
  `≈ rounded` and `reset to {1}` only exist once an amount has been scaled, and
  scaling one would be an **action** while every `I18N_HARVEST` entry is
  read-only by construction. All three are real words on a real screen that no
  amount of looking would ever find.
- **`i18nEdSelfKey()` leaves a current-form key alone.** The digits inside
  `{1}` are not a number: re-deriving `"{1} min ago"` produced `"{{1}} min ago"`
  and would have re-keyed a good entry to garbage. Mask or skip placeholders
  before scanning for digits — this is the second time that exact mistake has
  been made in two releases.
- **A leftover of a re-use that already happened is dead weight (v36.48).**
  `"4 min ago"` holding `"לפני {1} דקות"` is skipped for re-use (its target has
  a translation) and was never offered for removal either, so it sat there for
  ever. Those are classed as removable now, along with sync-log rows, which
  since v36.44 can never be keys again.
- **A NUMBER IS NEVER PART OF A KEY (v36.47).** Tony's 1,016 orphans were
  almost all numbers: "15 errors recorded", "17 errors recorded", "24 errors
  recorded"… "3 tests" through "61 tests", "1 min ago" through "44 min ago".
  Every distinct value made a NEW key, so the dictionary grew without limit and
  he paid to translate "61 tests" having already paid for "47 tests". v36.35
  parked the number outside the key at six specific sites; **that was treating
  instances of this.**
  - `i18nDeriveKey()` turns every run of digits into a placeholder in the same
    `{n}` series the inline children use, so a translation that moves them is
    honoured — which in Hebrew it must be. Attributes get the same treatment:
    `title="Average of 2 rated cook(s)"` was otherwise a separate entry for
    every recipe anybody had cooked twice.
  - **The key comes from the parked ENGLISH, never from what is on screen.**
    Deriving it from the DOM means that once an element is translated its key
    becomes the TRANSLATION — 1,366 elements deep, caught within a minute by
    the recipe-safety test's compounding check.
  - **Three forms, and they are not interchangeable.** RAW (`"15 errors
    recorded"`, children as `\u0001`) is what decides whether the app rewrote
    the text — compare on this, because the key deliberately cannot tell "1 min
    ago" from "2 min ago" and that is exactly the change to notice. KEY (`"{1}
    errors recorded"`) is what the dictionary is asked for. PLAN is the rendered
    sequence of text and nodes.
  - `i18nEdPortValue()` carries an old translation across: `"15 שגיאות נרשמו"`
    is only reusable as `"{1} שגיאות נרשמו"`. It **refuses** when the number
    appears twice or not at all — there is no way to know which placeholder it
    belongs to, and guessing puts a wrong number on screen for ever.
  - Mask `{\d+}` before scanning for digits. The `1` inside `{1}` is not a
    number, and reading it as one refuses whole entries for not finding a 1.
- **AN ORPHAN IS ONLY EXPLICABLE BY LOOKING AT IT (v36.46).** Twice now I have
  reasoned from a COUNT to a conclusion about what those entries are, and been
  wrong both times — first "they are junk" (they were not; the junk never became
  keys), then "they are old spellings" (the re-matcher found none). The editor
  has an **Only orphans** filter and a **Copy 40 orphans** button for exactly
  this: what an orphan is decides whether it should be re-matched, deleted or
  left, and that cannot be reasoned out from a number.
- **AN ORPHAN IS USUALLY PAID WORK, NOT RUBBISH (v36.45).** Tony's file held
  1,016 orphans and NONE was junk — the code fragments never became keys,
  because they were in the batches that failed and so were never translated at
  all. What was orphaned was real Hebrew under keys built by rules that have
  since changed (v36.32 stopped putting an icon's placeholder in the key, v36.35
  took varying counts out, v36.41 changed what reaches the catalogue).
  `i18nEdOrphanMatches()` re-matches them: **same text once leading and trailing
  placeholders and whitespace are gone**, which is exactly the set of changes
  those releases made, and leaves the value usable as it stands.
  - It must NOT re-match `"🕘 Version history (3)"` onto `"(…{1})"`. The Hebrew
    for that one has a literal 3 in it, and moving it across would put the wrong
    number on screen for ever. The test asserts the refusal.
  - **Re-use is offered BEFORE delete**, because deleting an orphan that would
    have matched throws away something already paid for and then pays for it
    again on the next gap-fill.
- **REMOVING IS UNDOABLE (v36.45).** Every entry was paid for; a thousand
  deleted on one click with "cannot be undone" as the only protection is not a
  safe thing to offer. Removals are stashed in `tonys_i18n_bin_<lang>` and the
  editor shows a way back while it is there.
- **The editor's key analysis is CACHED.** `i18nEdKeys()` walks the catalogue,
  which walks the whole DOM, and `i18nEdRender()` runs on every keystroke in the
  search box — a full page walk plus two thousand comparisons per character.
  `i18nEdInvalidate()` on anything that changes the draft.
- **THE LOG'S OWN EVENTS ARE NOT INTERFACE TEXT (v36.44).** They are
  diagnostics, they are what gets pasted to whoever is helping, and there is no
  end to them — every message ever logged would become a dictionary key. The
  event rows carry `data-no-i18n`; the panel's own buttons and headings stay
  translatable, and the test asserts both halves.
- **`i18nUnits` filters on `i18nKeepable`, not `i18nTranslatable` (v36.44).**
  Everything else already refused to RECORD or SEND a string that reads as
  source code; this was the one place still happily translating one if it
  happened to be on screen.
- **A BUTTON THE DATA HIDES (v36.44).** "📷 No photo (N)" is only drawn when
  some recipe has no photo, so on a fully illustrated library it never rendered
  and its words could never reach the dictionary. `i18nHarvestFilters()` pushes
  a stand-in with no photograph, the same trick the recipe screen uses. **A test
  that fails on Tony's machine and passes in CI is a branch, not a bug** — that
  is now three of them (`signedIn ?`, a recipe's history, a library with no
  gaps), and the next one will look the same.
- **`syncLog` RELABELS AN UNKNOWN KIND AS `error` (v36.43).** That is the right
  call for a logger — never lose the event — and a trap for whoever writes the
  call. There is no `'warn'` kind; three housekeeping messages of mine used it,
  so a tidy-up that had *worked* was counted as a fault and Tony's report opened
  with "[BAD] 60 errors recorded". Check `LOG_KINDS` before inventing a kind.
  `log_kinds_are_real` greps every `syncLog(` in the file and fails on any kind
  that does not exist — the kind of test that catches a whole class rather than
  the instance that prompted it.
  - Also: do not log a SUMMARY of failures at `error` when each failure is
    already logged. "9 string(s) came back untranslated" alongside 9 batch
    errors turns 9 faults into 18 in the analysis.
- **THE MISSING LIST IS AN INPUT, NOT A RECORD (v36.42).** `i18nGapList()`
  feeds on it, so a bug fixed on Monday goes on being paid for every week until
  someone clears what it wrote. Tony's device was carrying 400-odd keys like
  `"+ sharedTitle); if (sharedText) got.push("` from before the lexer landed,
  and the next gap-fill would have sent every one of them again.
  `i18nLoadMissing()` now prunes through the CURRENT rules and rewrites the
  stored list, `i18nNoteMissing()` refuses to record what it would not send,
  and `i18nGapList()` filters again on the way out.
- **`i18nLooksLikeCode()` errs towards KEEPING.** Two tiers: things no button
  ever says (`innerHTML`, `=>`, `<div>`, this project's `(5f.5)` audit tags),
  and hints that are damning only in pairs (a `);`, a hex colour, a `px`).
  Wrongly rejecting a string leaves a button English for ever with no way to
  notice; wrongly keeping one costs a fraction of a penny and shows up in the
  editor as an orphan. The first version rejected four real strings, two of
  them buttons — and `window\.` matched the English words *"inside the watchdog
  window. That is usually…"*, which is why it now needs a letter after the dot.
- **THE REPLY IS KEYED BY POSITION (v36.42).** Asking for `{english: hebrew}`
  meant every answer carried a verbatim copy of everything sent — a third of
  what kept hitting the token ceiling, paid for twice. Strings go out as a
  numbered list and come back as `{"0": …}`. A reply keyed by the English is
  still accepted, because the model sometimes does it anyway and discarding a
  whole batch to make a point would be absurd.
- **The token budget was wrong three times.** 1.4, then 3.0, and a 700-character
  batch still truncated at a 3,130-token ceiling. Hebrew runs one and a half to
  two and a half tokens per CHARACTER, a translation is usually longer than its
  English, and fixed JSON overhead dominates a small batch — hence 5.0 with a
  floor of 2,500 and a cap of 10,000, and batches sized so the formula never
  reaches that cap. **When the cap binds instead of the formula, the formula is
  decoration.** The test that matters is not the arithmetic but `runOrSplit()`:
  a truncated batch is halved and re-asked until it answers.
- **THE SCRAPE MUST LEX BEFORE IT MATCHES (v36.41).** Matching an opener and
  then walking forward pairing quotes is only safe if it STARTS at real code.
  An opener matched inside a comment or a regex literal leaves the walk half a
  quote out of step, and from then on it reads code as text and text as code.
  That is how `"+ sharedTitle); if (sharedText) got.push({1} + sharedText)"`
  reached Tony's paid Hebrew dictionary — 127 keys of it. `i18nLexSource()`
  blanks comments (offsets preserved, so every regex still works), steps over
  regex literals by the standard "a `/` where a value is expected" heuristic,
  and marks every position inside a string. An opener only counts at real code.
  - `i18nExcludedSpans()` additionally drops `SELF_TEST_FIXES`, which uses the
    same `fix:` property name as the sync-log findings and is the opposite kind
    of string — instructions for whoever is debugging the app.
- **A KEY BECOMES A FIRESTORE FIELD NAME, capped at 1,500 bytes (v36.41).** One
  string here — the WhatsApp export manual — came to 1,541, and it took the
  whole `i18n_en` document with it: every save of the master catalogue failed
  with *"Property strings contains an invalid nested entity"*, which names the
  document and not the field, so there was nothing to go on. Hebrew appeared to
  save only because the batch holding that string had truncated, so it never
  became a key there. Two defences: `I18N_MAX_BYTES` (1,400) in
  `i18nTranslatable`, and `i18nSanitiseDoc()` on every write, because a single
  bad key must never be able to stop a document saving again.
  - The manual itself is now four `<div>`s instead of one. Splitting it at the
    breaks it already had costs nothing on screen and gives the translator four
    passages instead of an essay.
- **A BATCH'S REPLY IS SEVERAL TIMES ITS INPUT (v36.41).** The answer echoes
  every English KEY as well as carrying the translation, and Hebrew costs two or
  three tokens per character where English costs a quarter of one. 18 of Tony's
  batches died on the ceiling — and a truncated reply loses the WHOLE batch, not
  its last entry. `I18N_BATCH_CHARS` is 1,800, chosen so the worst case
  (800 + 1800×3 + 60×14 = 7,040) still fits under the 8,000-token cap: bigger
  than that and the cap binds instead of the formula, which is precisely what
  went wrong. **And a ceiling is not a failure, it is a batch that was too big**
  — `runOrSplit()` halves it and asks again, up to three times.
- **BOTH SIDES OF A CONDITION (v36.40).** `when: signedIn ? 'always, while
  signed in' : 'not in use — you are signed out'` puts a panel's worth of text
  behind a ternary, and whichever branch is true when a language is generated is
  the only one that ever reaches the dictionary. Tony is signed in; the harvest
  was not; so half the privacy panel could not have been found however many
  times it was drawn. `i18nHarvest()` now runs **twice**, the second pass with
  `_fbUser` flipped — symmetric on purpose, because doing only one of the two
  just moves which half stays English. The stand-in user is only ever READ and
  is restored in a `finally`; the test asserts it does not survive.
- **THE LINE THE SCRAPE MUST NOT CROSS (v36.39).** Two kinds of English in this
  file are written in English *on purpose* and would be actively harmful
  translated: the **prompts sent to the model** (translating one changes what
  the model is asked) and the **copyable reports** — the sync log report and the
  self-test report — which are pasted to whoever is helping and must stay
  readable to them. The scrape is therefore driven by a list of openers that
  produce user-visible text (`toast(`, `showServiceError(`, `setDriveStatus(…,`,
  `.textContent =`, and the properties `title/message/step/okLabel/cancelLabel/
  detail/fix/note`) and NOT by "every string literal". A general `return`
  opener was considered and rejected: it would have pulled in every prompt in
  the file. The test asserts all four probes stay out.
- **A message with NO holes is still a message.** A long finding is split across
  source lines to keep them readable, not because anything in it varies —
  `i18nPartsToPattern` returns null for those, and for a while they were simply
  dropped. Every sync-log finding longer than one line is that shape, and they
  are the entire point of the Logging panel.
- **`\u2026` in the source is an ellipsis on the screen.** Left as six literal
  characters by the unescaper it is a key that can never match anything.
- **`workerErrorText()` is in `I18N_EXTRA`** — four `return`s inside a ternary,
  unreachable by any opener that does not also drag in the prompts.
- **WHICH English is this element's English? (v36.38)** The copy parked in
  `data-i18n-src` is right only while the element still says what it said when
  it was parked, *or* says the translation we put there. A third value means the
  APP rewrote it — a status line, a step, a countdown — and the parked value is
  stale. Using it anyway pins the element to whatever it happened to say the
  first time it was seen: the long-job panel's title stayed "Working…" for ever,
  however many times the job set its own. `data-i18n-at` records what we wrote;
  the same three-way comparison applies to attributes.
- **`el.textContent = '…'` adds a TEXT node, and a text node is not an element.**
  The observer walked past it, and since the element had never been touched
  there was no parked English to catch it either. The whole long-job panel was
  invisible to translation for that reason. An added non-empty text node now
  queues its parent.
- **`I18N_EXTRA` is the last resort, and stays short.** Everything else finds
  strings by *looking* — at the DOM, or at the source of a `toast()` call.
  `progEtaWords()` builds "about 30 seconds left" from a number and a branch and
  writes it straight in; nothing would ever have found it whole. Anything listed
  there must really be shown, or it is money spent translating a string nobody
  sees.
- **A shape's EDGE hole must swallow at least one character.** Otherwise
  `{1}Saved {2} recipes` matches everything `Saved {1} recipes` does, the two are
  indistinguishable, and which wins is an accident of sort order. Inside the
  sentence an empty hole is legitimate.
- **A long job shows a ring and a countdown (v36.38).** Generating a language is
  ten AI calls and most of a minute; a toast saying "40%" says the job is alive
  but not whether to put the phone down. `progressOpen/Step/Close`. The estimate
  is *measured* (elapsed per finished step, extrapolated) and smoothed, because
  a raw estimate after one slow call reads "4 minutes" and makes people give up
  on a forty-second job. Before the first step it spins rather than sitting at
  0% looking hung. Cancelling is a request checked *between* steps — an AI call
  already paid for is allowed to land and what it returned is kept.
- **The app can say why sign-in failed (v36.38).** "It keeps connecting in
  Offline mode" is the symptom of at least six causes and every one of them is
  invisible from inside the page. `diagnoseSignIn()` reports the origin, the
  network, whether the SDK loaded, whether auth was created, standalone vs tab,
  and the last auth error code — then probes `identitytoolkit.googleapis.com`
  with the app's own key, because **an HTTP-referrer block on that key is
  completely silent**: Firebase reports it as a generic network failure.
  `window._fbConfigApiKey` is set at parse time, NOT inside `initFirebase()` —
  when the scripts fail to load that function never runs, and that is precisely
  when the key needs testing.
  - The popup runs on `recipes-f379d.firebaseapp.com`, so the key's website
    restrictions need **both** that domain and the app's own. The second is the
    easy one to miss.
- **A message built out of pieces is translated as a SHAPE (v36.37).**
  `toast('Saved ' + n + ' recipes')` never exists as a string until it is shown,
  and it is a different string every time — 81 of the 250 toasts here are that
  shape, and none of them could ever match a key. So the call site is read by a
  small scanner (`i18nScanCall`) into "Saved {1} recipes", that is translated
  once, and at display time `i18nMatchPattern()` recognises a message that fits
  and puts the pieces back. The pieces are never translated: they are counts,
  names and file sizes.
  - **A scanner, not a regex.** The argument is a chain of literals and
    expressions, and expressions contain brackets, commas and strings of their
    own — only a literal at the TOP level of the chain is part of the message.
    `x ? 'yes' : 'no'` is a decision, not words.
  - **Do not trim the pieces.** A literal's trailing space is the space before
    the hole; trimming gives "Looking up{1}…", which matches nothing. The
    scrape trims at its own call site instead.
  - **A shape needs real words** (≥8 literal characters and a hole) or it
    swallows unrelated messages. Patterns are tried longest-literal first so the
    most specific wins, matching is anchored, and a miss returns null rather
    than a guess.
- **A PLACEHOLDER is chrome even inside `dir="auto"` (v36.36).** That marking is
  about the recipe text somebody types INTO the field; the grey hint behind it
  is "e.g. 20 min" and never was. Until v36.36 the whole ingredient and method
  editor kept its English hints, because every field carries `dir="auto"`. The
  exception is exactly that wide: `title` and `aria-label` inside a recipe are
  still the recipe's own words, and the test asserts it by planting a marker in
  both.
- **Never compare against text you have translated.** The measurement
  converter's `setCalcCat()` did `b.textContent === cat`, so its category
  buttons stopped highlighting the moment the interface spoke Hebrew. Read a
  `data-` attribute. There were only two such comparisons in the file — the
  other is inside `#i18nOverlay`, which is never translated.
- **A varying count must not be part of the key (v36.35).** "🕘 Version history
  (3)" is a different key from "(1)", so the dictionary is asked for a string it
  can never hold. Park the number in its own `<span data-no-i18n>` — SPAN is
  inline, so it becomes a `{1}` placeholder and the key is stable. Done for
  Version history, the cooking log, Cooked N times, No photo (N), One item away
  (N) and the servings pill. **Do not** normalise digits globally: half the
  numbers in this app are fixed documentation ("100 requests/minute free",
  "Demo tier 50 requests/hour (5,000/hour once approved)"), and a model that
  reorders two substituted numbers in one sentence makes it say something false.
- **The length cap ate whole help panels.** It was 400 characters. The WhatsApp
  export manual is one `<div>` of prose with thirty `<strong>`s in it, arriving
  as a single 1,400-character unit — dropped without a word, and unfixable from
  the editor because it was never in the file. `I18N_MAX_LEN` is 2,200, and
  batching is by **characters as well as count** (`I18N_BATCH_CHARS`): sixty
  strings used to mean sixty short buttons, and a batch of long passages asks
  for a reply longer than `max_tokens` allows, which loses the whole batch.
- **BUTTON and LABEL are placeholder-eligible children.** "Tap a box to tick a
  line off · … [Clear ticks] · [🎤 Voice]" is one line of help with two controls
  in it; treating the buttons as walls dropped the hint entirely. Safe because a
  unit must hold its own text to exist: a row of nothing but buttons has no text
  node and is never a unit, while each button is still visited and translated
  separately.
- **The globe menu cannot claim "fully translated"** — it only knows what has
  been *shown*. Eight panels were untranslated while the count sat at zero. The
  action is always offered and says what it does: *Check every screen for
  missing text*.
- **The translation can be corrected by hand (v36.33).** `#i18nOverlay`: English
  left, translation right, a search that matches **either** side, untranslated
  rows first, and a per-row 💡 that asks for three alternatives and changes
  nothing until one is clicked. Gated on `i18nCanEdit()` — Save rewrites a file
  every device reads.
  - **The editor is never translated.** `i18nSkip()` stops at `#i18nOverlay`. If
    it were translated the left-hand column would not be English, which is the
    one thing the whole table is matched against.
  - **Orphans are shown, not hidden.** A key the dictionary holds that no part of
    the app shows any more means the English was reworded. That old translation
    is usually most of the new one, so it is listed with an `orphan` badge rather
    than silently dropped.
  - Only `I18N_ED_PAGE` (120) rows are drawn at once. 600 live `<textarea>`s is a
    tax a phone pays on every keystroke.
- **The self-test suite runs in ENGLISH (v36.32).** Two hundred and fifty tests
  find a button by the words on it. Tony's first run with the interface in
  Hebrew reported eight failures, five of which were the suite reading its own
  feature's output — `a11y_basics` counted every Hebrew-labelled button as
  "icon-only" because its regex only knew `[A-Za-z0-9]`. `runSelfTests` puts the
  interface back to English for the duration and restores it in a `finally`.
  Translating the expectations instead would be a suite that tests the
  dictionary and goes stale the day a translation is edited.
- **A test that passes in CI and fails on Tony's devices is usually the test.**
  Three did, in v36.32, and none of them was the app:
  - `collect_never_loses_a_recipe` asserted `!recipes.some(isCollection)` over
    the WHOLE library. Tony owns collections. Assert what the action *added*.
  - `sub_editor_round_trip` drives a real mouse drag but never opened
    `#editOverlay`. In a closed modal every rect is 0×0, no drop target is ever
    found, and the row is appended to the end it was already at — which reads
    exactly like "drag is broken". It now opens the editor and checks the rows
    have height before blaming the drag.
  - `photo_one_shape_no_storage` stubs `URL.createObjectURL` to catch the
    backup file. Since v36.20 a chosen backup folder is written to directly and
    no blob is ever made, so on the PC — where Tony has a folder — it said "the
    backup produced no file" about a file on his disk. Stub `backupDirLoad`.
  - And one that was Safari, not the test's logic: `localStorage.setItem = fn`
    **does not shadow the method** there. The Storage object's setter stores a
    KEY named `setItem` holding the function's source, and the real method keeps
    working. Stub `Storage.prototype.setItem`.
- **A Hebrew note was left-aligned because of its own English caption.** The
  view modal's notes block was one `dir="auto"` div beginning with the word
  `NOTES`, so the first strong character the browser found was Latin and the
  whole block resolved left-to-right. A caption and the content it labels are
  two different languages: give each its own element (v36.32). The same bug was
  in `buildPrintHtml`, with `<strong>Notes:</strong>` inline.
- **Bumping the version is a targeted edit, not a find-and-replace.** A blanket
  `v36.20` → `v36.21` across `index.html` also rewrites every comment tag that
  records *when* something landed, so the file starts claiming that the proxy
  consent gate and the backup folder both shipped in the current release. Only
  four strings are the version: the HTML comment on line 1, `APP_VERSION`, and
  the two badges. Everything else matching `v36.x` is history — leave it.
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

- **The Save Helper was compensating for one wrong environment variable, and it is gone
  (v35.0).** For months the app POSTed exports to a local Python daemon on
  `127.0.0.1:27182` because Chrome saved Tony's Hebrew filenames as `Download`. The cause
  was never Chrome and never the app: **Chromium sanitises download filenames against the
  character encoding of its PROCESS locale**, and his `/etc/default/locale` read
  `LANG="en_IL"` — the non-UTF-8 twin of `en_IL.UTF-8`, both generated as separate
  locales. `sudo locale-gen he_IL.UTF-8 && sudo update-locale LANG=en_IL.UTF-8` plus a
  re-login fixed it, and the helper became dead weight. What this cost, and what to take
  from it:
  - **Three independent routes failed identically, and that was the diagnosis.**
    `<a download>`, `showSaveFilePicker` and a standards-compliant server-sent
    `Content-Disposition: filename*=UTF-8''…` all produced `download`. When every route
    into a subsystem fails the same way, the fault is under all of them, not in any one.
    A fourth route that bypassed Chrome entirely — the helper — kept the name.
  - **A lab result is worthless unless the environment is stated.** This container
    defaults to the `POSIX` locale, so early runs of `fname*.js` "proved" Chromium
    mangles even `café.docx`, which is not real Chrome behaviour, and a wrong conclusion
    was reported before the sweep caught it. Prefix filename experiments with
    `LANG=C.utf8 LC_ALL=C.utf8`. Headed-vs-headless was never the variable; both agreed,
    in both directions.
  - **`navigator.language` cannot see the process locale** — it read `en-US@posix` under
    both locales — so no page can self-diagnose this. It needs a human to look in the
    Downloads folder, which is why `filename-test.html` ends in verdict buttons.
  - **To reproduce a user's environment, strip yours**: `env -u LANG -u LANGUAGE -u LC_ALL`
    produced the literal string `download` that Tony was seeing. To test a fix on a live
    desktop without changing anything, run the browser with a separate profile:
    `LC_ALL=C.UTF-8 /opt/google/chrome/chrome --user-data-dir=/tmp/…`. Both parts matter —
    without the separate `--user-data-dir` Chrome hands the URL to the running process and
    the old environment comes with it. A fresh profile also asks to be made the default
    browser, which looks alarmingly like a second installation and is not.
  - **Removing it closed a real hole.** The daemon took its target directory from the
    request body, unrestricted, and `mkdir(parents=True)`'d it. CORS stops a cross-origin
    POST from being **read**, not from being **sent**, and a `fetch` with a string body
    defaults to `text/plain` — a simple request, no preflight. Loopback is a
    potentially-trustworthy origin, so `https` pages reach it without mixed-content
    blocking. Any site open in any browser could therefore write a file anywhere Tony
    could, `~/.config/autostart` included. It was running and autostarting on his machine
    when we found it. **Never add a local file-writing daemon whose only client is a
    public web page** — any token it checks has to ship in `index.html`, so the ceiling is
    drive-by protection, not security.
  - The code is not lost and does not need copying anywhere: `git log --oneline --diff-filter=D
    -- local-save-helper.py` finds the removal, and `git show <commit>^:local-save-helper.py`
    prints it. `setup-save-helper.sh` went with it. `sec_no_local_save_helper` fails if any
    of it returns, including the `connect-src` loopback exception.
- **Word treats Hebrew as a "complex script", and LibreOffice does not care (v35.1).**
  Tony reported the export dropping a letter and the apostrophe from
  `צ'ילי קון קרנה`. The document XML was provably intact — the apostrophe was
  right there — and the renderer used to check it showed the name correctly. The
  fault was that `makeDocxBlob` declared **no `w:rFonts` at all**. Word picks the
  font for Hebrew from the **`w:cs` (complex-script)** slot, not `w:ascii`/`w:hAnsi`,
  and with it empty it chooses per machine — so the same file renders with missing
  glyphs on one box and perfectly on another. `w:szCs` is the same story for size.
  Hebrew paragraphs also need `<w:bidi/>` and their runs `<w:rtl/>` or Word lays
  them out left-to-right.
  - **A LibreOffice render is not evidence that Word is happy.** It guesses fonts
    and direction far more forgivingly. `libreoffice --headless --convert-to pdf`
    plus `pdftoppm` is still the fastest way to see an export (both are installed
    now; Writer is a separate package from the `libreoffice` binary), but it will
    not reproduce a Word-only complex-script fault. Say which renderer a result
    came from.
  - **OOXML property order is a schema sequence, not a suggestion.** `w:pStyle`
    first in `w:pPr`; `w:bidi` after `w:pBdr` and before `w:spacing`/`w:jc`;
    `w:rtl` last in `w:rPr`. The Title style had `w:jc` before `w:pStyle` for
    several releases.
  - **A DOCX image needs four things or Word refuses the whole file**: the
    `word/media/*` part, a `<Default Extension=…>` in `[Content_Types].xml`, an
    image relationship, and an `r:embed` naming it. A missing Default is not a
    missing image — it is an unopenable document. Image relationship ids start at
    2000 to stay clear of the hyperlink ids, which start at 10.
  - **`<wp:inline>`, never `<wp:anchor>`.** Inline gives the picture its own line
    box so it cannot be drawn over the text; anchored floats it across whatever is
    underneath.
  - **JPEG stores height before width** in the SOF marker. `imagePixelSize` reads
    it from the bytes because `makeDocxBlob` is synchronous and `new Image()` is
    not available; getting the order wrong rotates every landscape photo silently.
- **The sync event log is opt-in, bounded twice, and local (v35.4).** Tony asked for
  activity logging after the two-device test; what got built is deliberately narrower
  than that. Rules it must keep, because each one is a way this could turn into a
  liability rather than a diagnostic:
  - **Off by default, and off means nothing is written** — not "written and hidden".
    `syncLog` returns `false` and never touches storage while disabled.
  - **Bounded by age AND by count.** Retention days alone lets a busy afternoon fill
    localStorage; the 500-entry ceiling alone lets one stale entry sit there for a year.
    The window is applied on every write as well as by `pruneSyncLog`, or the log only
    stays trimmed when someone happens to open the panel — a mutation removing the
    write-path filter survived the first test pass on exactly that gap.
  - **It shares localStorage with the recipes.** A logging failure must never break a
    save: every path is wrapped, and on a quota error the log halves itself and then
    deletes itself rather than letting the error reach the caller.
  - **Local only.** Never synced, and it stays out of backups because `backupSave`
    writes an explicit `settings:{viewMode}` rather than sweeping localStorage — that
    allowlist is load-bearing now.
  - **Cleanup is on open and on write, not on a timer.** A timer cannot run while the
    app is closed, so it would buy nothing an on-open prune does not.
  - It records **recipe ids and names, never recipe contents**, and the panel escapes
    every message — a name reaches the log and then the viewer, and names are user data.
  - `analyseSyncLog(list, now)` is a pure function so findings can be driven from a
    fixture. **Every finding carries a fix**: a conclusion with no next step is just a
    prettier error message, and this app treats a dead end as a bug.
  - Two real defects were found by these tests rather than by review: `parseInt(x)||default`
    turned a deliberate `0` retention into 7, and the analyser matched `/timeout/` while
    the watchdog logs `"timed out"` — so it stayed silent on the exact event it existed for.
  - **Log an outcome where the outcome happens.** v35.4 logged the successful write inside
    `saveRecipeDoc` but the refusal one level up, in `saveToFirestore`'s collection loop.
    Every self test passed; an **end-to-end run in a browser** caught it, because driving
    `saveRecipeDoc` directly recorded a success and stayed silent on a refusal. Both halves
    of that fact now live in `saveRecipeDoc`; the caller keeps only `markRecipeConflicted`,
    which is UI state and belongs there. The unit suite could not see this — a test that
    drives one function cannot notice that a *different* function is the one instrumented.
  - `'system'` is a kind of its own for the log's own lifecycle ("Logging enabled"). Filing
    that under `'load'` quietly polluted the load filter.
  - **The nudge (v35.6) is the answer to "should errors upload themselves somewhere?" —
    and the answer is no.** Nothing the app could upload can reach anyone who is not
    already looking: there is no service at the other end, the repo would need a GitHub
    token in a publicly-served `index.html`, and the Worker or Firestore would mean recipe
    names and family members' identities sitting somewhere indefinitely to make a
    diagnostic marginally more convenient. So the log stays put and the app says when it
    has grown something worth reporting. Guards: **off by default**, **per device** (it is
    a localStorage key, so the desk can have it while the phone does not — Tony asked for
    exactly that), at most **once per session**, and **never twice for the same problems**
    (`logNudgeSignature` over the `bad` findings; titles carry counts, so a fourth refusal
    is news and the same three are not). It fires ~4s after start, which is the quiet
    moment; a problem arising mid-session is mentioned next open, because every BAD finding
    already surfaces its own message at the time and a second one on top is noise.
  - `maybeNudgeAboutLog` returns a **named reason** for every path — `nudge-off`,
    `logging-off`, `nothing-wrong`, `already-shown-this-session`, `already-mentioned`,
    `shown` — so "correctly stayed quiet" can be told from "silently broken". A boolean
    would have hidden exactly the distinction this codebase keeps having to relearn.
- **Collections: several recipes in one record (v36.0).** A magazine round-up —
  "10 recipes with chestnuts" — used to import as one recipe (URL and free-text
  paths, which asked the AI for *the* recipe) or as N loose cards (file import,
  which asked for "all recipes"). What you got depended on which button you
  pressed. All four paths now share `multiRecipePrompt` + `buildImportFromParsed`,
  and two or more recipes become one collection.
  - **The real article is the specification.** `tests/fixtures/multi-recipe-article.json`
    holds a faithful sample of the ynet chestnut round-up, because none of its
    messiness is guessable: ingredients arrive as ONE RUN-ON BLOB, a recipe can
    have its own ingredient sub-headings ("לניוקי" / "לרוטב", carried as `g`),
    most recipes have a different cook's byline, and servings appear inline in
    three different formats. The fixture doubles as the AI's answer, so the whole
    pipeline is testable without the network.
  - **The Worker's text extraction was destroying the strongest signal there is.**
    `.replace(/<[^>]+>/g, ' ')` turned every tag into a SPACE, so a `<li>`
    ingredient list arrived as one run-on line and the page's own structure was
    gone before the AI saw it. Block tags now become `\n` and inline tags become
    nothing (so a bolded amount does not split its own ingredient). **This needs
    Tony to paste the updated `cloudflare-worker.js` into Cloudflare** — the repo
    copy is not deployed from here.
  - **The 10,000-character cap silently truncated long round-ups**, so an import
    returned 6 of 10 recipes and looked like it had worked. The cap is 60,000 now
    and the response carries `truncated`, which the import preview says out loud.
  - **`max_tokens: 2000` cannot hold ten recipes.** A truncated reply is invalid
    JSON, so the import failed with "could not parse" and nothing said why.
    `multiRecipeMaxTokens()` scales it with the input, capped at 16,000.
  - Ticks are namespaced per part (`ing-p0-3`), or ticking the soup's onion also
    ticks the risotto's. `markLine`/`toggleTick` already took arbitrary keys.
  - A collection has **no single prep time, serving count or difficulty**, and
    "nutrition per 100g" across ten unrelated dishes is not a number — both are
    hidden rather than shown empty or invented.
  - Promoting the last-but-one part collapses the collection back into an
    ordinary recipe. A container holding one thing is a container for nothing.
- **The import that never finished (v36.1).** v36.0 shipped the collection model
  and then hung on the very article it was built for. Four separate faults, each
  enough on its own to produce "stuck, possibly in a loop":
  - **The AI fetch carried no `AbortSignal` at all.** Nothing streams through the
    Worker — it does `await r.json()` on the whole answer — so a request asking
    for 16,000 tokens sits with no bytes on the wire for minutes, which is
    exactly what Anthropic's own guidance says not to do without streaming
    (networks drop idle connections and the caller waits for a response that is
    never coming). Every AI call now has a finite budget, `aiTimeoutMs()`,
    scaled to what it asked for and capped at 180s.
  - **The retry loop retried everything.** Only `BILLING:`, `API_KEY:` and rate
    limits were re-thrown, so a hard 400 was sent five times with 2/4/8/16s of
    backoff between them — half a minute of silence for an answer that could
    never change, and ten minutes when each attempt was a slow timeout. That is
    what looked like a loop. `aiRetryable()` now retries only 408/409/425/5xx and
    bare network failures. **Never retry a 4xx.**
  - **Nothing in the import path was logged.** Tony turned logging on during the
    hang and the panel showed one `load` line. The log's whole purpose is the
    moment something goes wrong, and it had no coverage of the one thing that
    had. `ai` and `import` are log kinds now, and every AI call records its size,
    its budget, how long it took and its `stop_reason`.
  - **Every failure ended at the same place: "save as a video bookmark?"** A
    timeout, a 400 and a genuinely recipe-less page are different answers. Only
    the last is a bookmark; the others now say what happened and offer Try again.
  - **The real fix is that a long article is no longer one question.** A cheap
    outline pass asks what recipes are in the text; `sliceByTitles` cuts the
    article at those headings (a title the AI paraphrased is *skipped*, not given
    a guessed position — its recipe stays inside its neighbour's slice, where it
    is still read); then each slice is extracted on its own, three at a time. No
    call asks for more than ~2,600 tokens where one used to ask for 16,000, the
    spinner counts real progress, and **a failed slice costs one recipe instead
    of the import** — `_partial` says how many are missing, because a list of 8
    that should have been 10 looks exactly like a list of 8. Total input is about
    the same as the single call it replaces. Below `MULTI_SPLIT_OVER` (7,000
    chars) it is still one call: splitting a single recipe would be three round
    trips where one did.
  - **A stop at the token ceiling is now named.** `stop_reason: 'max_tokens'`
    means half a JSON document; the import used to report "could not parse",
    which was true and useless.
  - **A stub that never settles does not test an AbortSignal, it ignores it.**
    The first `ai_hang_ends_by_itself` returned `new Promise(()=>{})` and hung
    the whole runner — a real fetch *rejects* when its signal aborts. The stub
    now honours the signal, and asserts that one was passed at all.
  - The 404 in the browser console (`/tonys-recipes/sw.js`) when serving the repo
    from a bare `http.server` root is the SW registration path, not a fault; it
    predates v36.1. A driver that needs the page to stay put should pass
    `serviceWorkers: 'block'`, since `controllerchange` reloads the page.
- **The duplicate check ate a collection whole (v36.2).** Tony imported the
  chestnut round-up, was offered "keep both / update the existing one" against a
  recipe he already had, chose update — and the existing recipe was NOT updated
  while all ten parsed recipes vanished. One cause, both halves:
  `confirmImportChecked` read `parsed.ingredients` and `parsed.steps`, which on a
  collection are **deliberately empty** because the content lives in `parts`. It
  found nothing, so its `n.length ? new : old` guards kept every old value, and
  then it closed the overlay anyway — discarding the parse. **A function that
  could not do what was asked must not return quietly.** `applyParsedOntoRecipe`
  now returns false in that case and every caller treats false as a refusal:
  the recipe is imported separately rather than dropped.
  - **A collection is duplicate-checked PART BY PART.** The article's own title
    is not what you already own — the recipes inside it are. `collectionDuplicates`
    pairs each part with what it matches, refuses to let two parts replace one
    recipe, and asks ONE question ("3 of these 10 you already have") rather than
    ten. Updating replaces those and imports the rest; the remaining parts still
    collapse to an ordinary recipe when only one is left.
  - **`historySnapshot` never captured `parts`.** So version history recorded an
    empty recipe for every collection from v36.0 on, and Restore would have
    written that emptiness over the real thing. Both directions are covered now,
    and `normalizeRecipe` is what re-establishes the invariant after a restore.
  - **A collapsing collection takes the remaining part's NAME.** It kept the
    article's, so a round-up promoted down to its last recipe was a card reading
    "Chestnuts: 10 recipes" containing one gnocchi recipe.
  - `removePartFromCollection` — Tony asked for it: dropping a recipe from a
    collection without first creating a card to delete. It snapshots the whole
    collection before removing, so ↩ Restore brings the removed recipe back.
  - **The test that missed it first.** `dup_collection_loses_nothing` originally
    called `confirmImportCollection` directly and passed against the broken
    build — the bug was in the ROUTING, in `confirmImportParsed`. It calls the
    real entry point now, which is why `confirmImportParsed` returns a promise.
    This is the third time in two releases that a tested function had an
    untested call site. **Drive the entry point the button calls.**
- **Link round-ups (v36.2).** Some pages contain no recipes at all — "10 soups
  in 15 minutes" is ten names, ten ratings, ten photo credits and ten links
  reading "to the recipe". Every heading is correctly refused for having no
  content, so the import came back empty and offered a video bookmark. When the
  ordinary extraction yields nothing AND the page had links, `extractRecipesFromLinks`
  asks the AI which links are individual recipes, then opens each one through the
  Worker's existing `fetch-url` and imports it as the ordinary single recipe it
  is, three at a time, behind counted progress.
  - **The Worker must return the links or none of this is possible** — the text
    pipeline turns every `<a>` into its label and throws the href away. `fetch-url`
    now also returns `links[]`, collected from the *stripped* html (raw html
    would return the whole site navigation). **This list is what the app then
    fetches**, so it is deliberately narrow: http(s) only, SAME HOST, no
    fragments, no duplicates, no self-link, capped at 80. It must never become a
    way to make the Worker fetch anywhere on anyone's behalf. **Needs Tony to
    paste `cloudflare-worker.js` into Cloudflare — v38.**
    (Superseded: the file in the repo is now **v39**, and that is the version
    Tony needs to paste. It carries v38's `links[]` plus the v39 spend guard
    rails. One paste covers both.)
  - Several links point at the same recipe (its rating, its prep time, its "to
    the recipe" button), so picks are de-duplicated by href before anything is
    opened; the real ynet page has twelve links for six recipes.
- **A self test must never write to the cloud (v36.2).** Tony ran the suite on
  his signed-in phone. All 219 passed — and it finished with a red
  `PHOTO_TOO_BIG` box naming **"ThumbTest"**, which is not one of his recipes but
  the 1.1 MB fixture `photo_thumbnails` injects into the live `recipes` array to
  exercise the real thumbnailing code. The test cleans up in its `finally`, but
  it `await`s four times first, and the suite runs for 91 seconds: **a sync
  fired inside that window** and Firestore refused the photo. Both things were
  true at once — every test passed, and the suite tried to write its own data
  into the family's collection.
  - **Fixtures belong in the live array.** A test against a private copy proves
    the copy works. So the guard is not "stop doing that", it is `isTestFixture`
    / `cloudBound` at the ONE place recipes leave the device — the recipe
    documents, `syncCloudPhotos` and `writeCloudMeta` — rather than trusting
    every test to finish cleaning up before the next sync fires.
  - `queueCloudDelete` ignores fixtures too. A fixture was never in the cloud, so
    asking to delete one can only produce a `DELETE_NOT_PERMITTED` box about a
    recipe nobody has — which is what a family member without the admin role
    would have seen.
  - **`TEST_ID_MIN = 700000`**, and the test scans `index.html` for every fixture
    id and fails if any is below it. A future test that picks a low id fails
    immediately instead of quietly syncing. Real ids come from `nextId`, which
    counts from 1.

- **Two things Tony's own log report caught (v36.3).**
  - **A truncated answer was retried five times.** v36.2 added the
    `stop_reason: 'max_tokens'` check and threw `TRUNCATED:` from inside the
    `try`, where `aiRetryable` fell through to "retryable". Same prompt, same
    `max_tokens` — it truncates again every time, so one truncated reply became
    **five paid calls over 30 seconds**, none of which could succeed. That is
    precisely the bug `aiRetryable` was written to prevent, reintroduced by its
    own new guard. Anything thrown from inside that `try` must be classified.
  - **The suite's staged failures were reported as real problems.** Half of what
    the self tests do is fail on purpose — "boom", "AI down", "network down",
    "Cloud read timed out after 0s", "Every slice failed — 2 of 2". Tony hard-
    refreshed and got a report announcing 3 timeouts and 15 errors, every one of
    them staged. A report that is confidently wrong is worse than none, and a
    nudge that cries wolf trains the reflex v35.6 exists to avoid. `syncLog`
    stamps `t:1` while `_selfTestRunning`, `analyseSyncLog` ignores those, and
    the report still LISTS them marked `[test]` — hiding them would make
    debugging the suite impossible.
  - **The headless runner was not reproducing the app's own conditions.** It
    calls each `t.test()` directly and never goes through `runSelfTests()`, so
    `_selfTestRunning` was never raised and the marking worked in Tony's browser
    but not in CI. The runner sets it now (note 3 in its header). **Anything the
    app does differently during a test run is invisible to that runner unless it
    is told to do the same.**
  - A test that needs a GENUINE problem in the log must write it unmarked —
    `log_nudge_is_quiet_and_per_device` builds its fixtures with `writeSyncLog`
    rather than `syncLog` for exactly that reason.

- **Sub-titles in both lists (v36.4).** A recipe can carry heading lines among its
  ingredients and its method — "Brine option #1" — with lines under them indented.
  A heading is **not** an ingredient and **not** a step: no amount, no tick box,
  no step number.
  - **The load-bearing decision is which accessor means what.** `allIngredients` /
    `allSteps` still mean *the things you can cook with*, unchanged, because
    twenty consumers call them — search, pantry, one-away, nutrition, **Bring!**,
    scaling, Word, print, share. `ingredientLines` / `stepLines` add the headings
    and are asked for **by name**, only by things that DRAW the recipe. Had the
    default included headings, Bring! would have put "Brine option #1" on the
    shopping list and every card would have over-counted its ingredients. When
    adding a line type, make the old name keep the old meaning.
  - **Indentation is a property of the LINE, not of the heading above it.** Tony
    was explicit: a few lines belong under a sub-title and then the list returns
    to the main flow ("0.5 Kg pork chops" after two brine options). "Everything
    until the next heading" would get that wrong, so it is a per-row toggle.
  - **The old `g` is gone, folded into this.** v36.0 carried the article's own
    sub-heading as a property on each ingredient and drew a heading when it
    changed. Two mechanisms for one visual thing would have drifted — the same
    trap the parts/flat rule exists to avoid — so `normalizeIngredientLines`
    converts a run sharing a `g` into a heading line plus indented items.
  - **Entry is by icon, not by marker.** Tony's point: if indentation has a
    button, a sub-title should too. Ingredients get a `▸ Sub-title` button and a
    per-row `⇥`/`⇤`. The method is still a textarea (fast to type, pasteable), so
    its structure lives in the text — `# ` starts a heading, leading spaces
    indent — and a toolbar above the box writes those for you. **The marker has
    to exist in a plain text field; having to type it does not.**
  - **What nearly shipped broken.** Four preview renderers (import, translate ×3)
    would have printed `[object Object]`, and translation would have flattened
    every heading into a numbered step — silent data loss on a feature you would
    only notice weeks later. `previewStepsHtml`/`previewIngsHtml` are one
    implementation now, and `reapplyLineStructure` puts the shape back by
    position, **dropping it entirely when the counts disagree** rather than
    stamping "this is a heading" onto the wrong line.
  - The recipe view and a collection's sections were two near-copies that had
    already drifted (only the collection drew headings). They are one pair of
    functions now: `ingredientLinesHtml` / `stepLinesHtml`.
- **The search box clears in one tap (v36.4).** `#searchClear` appears only when
  there is something to clear, re-renders the grid, and keeps focus so typing can
  continue. Escape does the same.

- **Two v36.5 fixes, both from Tony using it.**
  - **The fixture guard made ThumbTest and MarkTest UNDELETABLE.** v36.2's
    `queueCloudDelete` refused to queue a delete for a fixture id, on the premise
    that *"a fixture was never written to the cloud"*. False for exactly the two
    that already were, written on v36.1 before the write guard existed. So
    deleting them locally queued nothing, the cloud copies survived, and the next
    load brought them back. Tony deleted them twice. **Deleting a document that
    is not there is not an error in Firestore, so there was nothing to protect
    against in the first place** — and a guard whose premise is false about
    exactly the cases it fires on is worse than no guard. Now: the delete is
    queued, a fixture arriving FROM the cloud is dropped on read (and its cloud
    copy queued for removal, so it cleans itself up once), and only the
    *reporting* of a denied fixture delete stays suppressed, which is where the
    original noise concern actually belonged.
  - **A sub-title row had a drag handle and no listeners.** The drag wiring lived
    inline in `addIngRow`, so v36.4's new `addIngSubRow` got the handle — which
    looks draggable — and none of the behaviour. Tony hit it the first time he
    made one. `wireIngDrag` is shared by both now. **A handle that looks present
    and does nothing is the worst version of a missing feature.**
  - **A "wired" flag is not the behaviour.** The first version of that test
    checked `handle.__ingDragWired`, and a mutation that set the flag while
    wiring nothing passed happily. Both tests drive real mousedown/mousemove/
    mouseup and assert the row MOVED. Ordinary rows had been draggable for many
    releases with no test at all, which is how extracting the wiring could have
    broken the old feature while fixing the new one.

- **Three v36.4 follow-ups, all found by Tony using it (v36.6).**
  - **The ingredient indent rendered as ZERO.** `.ingredients-list li { padding:
    5px 0 }` is specificity (0,1,1); `.line-indent` was (0,1,0). The shorthand
    won **whatever the order**, so ingredients never indented. The steps list
    sets no padding, so the identical rule worked there — which is why a
    screenshot of one list looked right while the other was broken, and why the
    test passed: **it asserted the CLASS was present, not that the line had
    moved.** Assertions on rendering must read `getComputedStyle`. Selector is
    `.ingredients-list li.line-indent, .steps-list li.line-indent` now.
  - **The method toolbar acted on the wrong line.** `stepLineRange` fell back to
    the end of the text when no caret had been placed, so pressing ▸ Sub-title
    without first tapping a line turned the LAST line into a heading. Tony
    concluded the button did not work and typed `#` by hand for a whole recipe.
    Now the caret is remembered across focus loss (pressing a button IS a focus
    change, hence `onmousedown="event.preventDefault()"`), and with no line
    chosen the buttons **refuse and say so** rather than picking one.
  - **Shared text was never checked against what a person receives.** It is
    right — heading on its own line, blank line before, no bullet, two leading
    spaces on the lines under it — and now pinned by a test, because plain text
    has no styling and position is the only thing carrying the structure.
  - RTL verified by measurement, not by eye: `padding-inline-start` resolves to
    `padding-right: 22px` / `padding-left: 0` under `direction: rtl`.

- **Sub-sub-headers (v36.7).** A heading that is ITSELF indented is the second
  level: "Brine option #1" with "how to prepare it" nested under it. **No new
  line type and no new flag** — the one that already means "shifted right" does
  the job, so every consumer that already handles indentation handles this.
  - **It broke the heading-drop rule.** v36.4 dropped "two headings in a row" as
    noise, and a sub-sub-header is precisely a heading directly under another
    heading, so nesting anything deleted its parent. `dropEmptyHeadings` scans
    backwards and keeps a heading when any CONTENT follows it, which is what
    that rule always meant.
  - **I wrote the same specificity bug again** — `.line-sub-indent` at (0,1,0),
    losing to `.ingredients-list li` at (0,1,1). The measuring test caught it
    within a minute. That is the argument for measuring rendering rather than
    asserting a class is present.
  - **A guarded assertion proves nothing.** The first nested-heading check was
    wrapped in `if (nestedEl)`, so a mutation that stopped emitting the class
    made the check SKIP and pass. If the fixture guarantees a thing exists,
    assert that it exists.

- **Each recipe in a collection has its own actions (v36.8).** Tony's case:
  sending ONE recipe out of a collection instead of all ten. Every per-recipe
  action — Share, Word, Print, Translate, Bring!, Cooked — takes an id and looks
  it up in `recipes`, and a part is not in `recipes`.
  - **A part is addressed as the string `c<collectionId>:<partUid>`** and
    `findRecipeRef` resolves it into a recipe-shaped view of that part alone, so
    nine call sites changed by one line each instead of being rewritten. **That
    view is never inserted into `recipes`** — a temporary entry there is exactly
    how a test fixture reached Firestore in v36.1, and this one would sync a
    phantom recipe on every share.
  - **Parts carry `fav`, `cookCount`, `lastCooked`, `cookLog` — and no photo.**
    Tony's decision, over keeping a separate record of what a recipe used to be:
    a part is a recipe you cook, so it keeps what a recipe you cook keeps. The
    photo is left off on purpose; parts live inside the collection document and
    photos are the one field big enough to matter.
  - **`_editingPartRef` is what stops the edit form cloning a part** into a
    second standalone recipe — the mistake every collection feature so far has
    had to be stopped from making. `openAddModal` clears it, `editPart` sets it
    afterwards, and `saveRecipe` returns early once it has written back.
  - **Two bugs only a browser run found**, both invisible to assertions about
    the data: saving a part left the dirty-guard snapshot stale, so closing the
    form asked to discard changes that had just been saved; and loading a part
    read as unsaved changes immediately, because `openAddModal` snapshots an
    empty form and `editPart` fills it afterwards.
  - The collection-level buttons sit under **"📚 The whole collection — N
    recipes"**, because a Share meaning one recipe and a Share meaning ten look
    identical otherwise.

- **Gathering recipes into a collection (v36.9)** — the reverse of
  `splitCollection`, from Select mode: **📚 New collection** and **📚 Add to
  collection**.
  - **The recipe's `uid` travels into the part.** That is what makes "⤴ Make its
    own" later produce the SAME recipe rather than a duplicate — the same rule
    that makes promoting the same part on two devices safe.
  - **The originals are deleted from the cloud, not merely from the list.**
    Leaving the documents behind means the next load returns every one of them
    alongside the collection that now contains them.
  - Favourite and cooking history come along; **the photo does not, and the
    confirmation says how many will be lost before you commit** — it is the one
    thing that cannot be recovered from there.
  - A selected COLLECTION contributes its recipes rather than becoming a part of
    a part. Nesting would need a second level that ~20 consumers would have to
    learn. A collection cannot be added to itself, an empty selection cannot
    create an empty collection, a blank name is refused rather than replaced
    with something generic, and with no collections yet "Add to collection"
    says so instead of opening an empty chooser.
  - `askChoice` joins `askConfirm`/`askPrompt` as the one-of-many chooser.

- **A new collection is offered its recipes' photos (v36.10).**
  `chooseCollectionPhoto(coll, pool)` puts them up as cards, plus a **"Create
  new"** card that hands straight over to `showPhotoSourcePicker` — the same
  Upload / Take / Search sheet a recipe's own photo uses. One photo-picking
  flow, not two.
  - **The pool is copied out of `chosen` BEFORE the originals leave the list.**
    A part has no room for a photo and the standalone copies are queued for
    cloud deletion a few lines later, so by then there is nothing left to offer.
  - **The chooser runs last, after the collection exists and is saved.** That is
    what lets "Create new" reuse the recipe photo path unchanged:
    `heroPhotoChanged` and `useSelectedSearchPhoto` both resolve
    `heroPhotoTargetId` against `recipes`, so the target has to really be in it.
    Do not fake a placeholder recipe to pick a photo into — that is the
    ThumbTest mistake wearing a different hat.
  - Only a NEW collection is asked. An existing one already has a photo, or has
    deliberately not been given one.
  - Cards, not a list of names: the test asserts each card's `img` carries the
    actual photo and renders with real width, because a card showing only a name
    passes every count check and is useless for choosing a picture.

- **☑ Select lives in the filter bar, not the grid heading (v36.10).** In the
  heading it scrolled out of reach exactly when a long list made selecting worth
  doing. There are now **TWO Select buttons in the DOM at all times** —
  `#selectModeBtn` in `#filterBar` and `#selectModeBtnMobile` in
  `#mobileFilterBar` — and only one is ever displayed, so `syncSelectBtnState()`
  writes the pressed state to **both**, or the hidden copy comes back stale when
  the viewport crosses 700px.
  - `renderFilters()` rebuilds `#filterBar` wholesale, so the pressed state is
    baked into the frame-4 markup from `selectMode`. A class that
    `toggleSelectMode` put on the previous element does not survive that.
  - **A sticky element with no `top` is just a relative one.** Both bars were
    `position:sticky`, but `updateFilterBarTop` set `top` on the desktop one
    only — so the phone's bar never stuck. It now sets both, and runs on
    `resize` as well as on render, because the header's height changes when its
    buttons wrap.
  - `#filterBar` is `display:none` below 700px. Every frame in it was already
    hidden there, so it was an empty bordered strip; hiding it outright leaves
    ONE sticky bar under the header rather than two claiming the same offset.
    The phone bar's own Select frame is the exception, re-shown by
    `.filter-bar-mobile .filter-frame-select` — (0,2,0) beating (0,1,0), both
    `!important`.
  - On a phone the frame wraps to a second line of the filter bar and sits at
    its right end. That costs ~40px of permanently pinned height, which is the
    price of "always reachable"; the alternative — one row with the filter chips
    scrolling horizontally underneath it — would have hidden Meal and Diet
    behind a swipe, which is worse.

- **A part is a recipe, and keeps what a recipe keeps (v36.11).** `normalizePart`
  carries `source`, `isClip` and `diets` alongside the v36.8 fav/cook fields.
  **The bug that forced this lost a whole recipe, not a field.** Tony gathered a
  video clip into a collection and it vanished, because `normalizeRecipe`'s
  parts filter was `p.ingredients.length || p.steps.length` — and a clip has
  neither by definition; its entire content is the link. The part was binned,
  and three lines later the standalone original was deleted from the list and
  from the cloud. The filter is now
  `p.ingredients.length || p.steps.length || (p.isClip && p.source)`; an
  AI-invented heading is still refused, because `isClip` is only ever set from a
  real recipe.
  - **`collectSelectedInto` counts the parts that arrived** and, if even one did
    not, restores everything — no collection, no deleted originals, no queued
    cloud deletes — and says so. The originals are destroyed immediately after
    the parts are built, so anything dropped in between is gone for good. Never
    let that step be silent again.
  - **The round trip was lossy in the other direction too.** `recipeFromPart`
    rebuilt the promoted recipe from the COLLECTION and hardcoded `fav: false`,
    so the favourite, cook count, last-cooked date and cook log — all carried IN
    since v36.8 — were thrown away on the way OUT. Gathering and splitting are
    one feature; test them as a round trip, not as two functions.
  - Source resolution is `part.source || coll.source`: right for a book of
    recipes off one page, and right for a round-up whose entries each point
    somewhere different. **`extractRecipesFromLinks` had been setting a correct
    per-recipe source since v36.2 and `normalizePart` was discarding it** — the
    ynet-style imports lost every recipe's own page link and nobody noticed,
    because the collection's own source looked plausible in its place.
  - `collectionSectionsHtml` shows each part's source as a link with a 🎬 badge,
    and draws no Ingredients/Method columns for a contentless clip — two empty
    headings read as a broken recipe.
  - The part editor loads and saves Source, the clip box and diets, and refuses
    to save a part down to nothing rather than letting `normalizeRecipe` delete
    the thing being edited.
  - **`category` and `difficulty` became per-recipe too in v36.12.** On a part,
    **an empty value means "inherit the collection's"** — which is what every
    part did before the fields existed, so an existing book of ten desserts
    keeps reading as ten desserts with no migration, and only a recipe that
    actually has its own overrides. They are deliberately NOT defaulted to
    `Dinner`/`Medium` the way a flat recipe's are: a default here would invent
    a fact. `collectionSectionsHtml` shows them only when the part has its own.
  - **Per-recipe is meaningless unless the search and the filters can see it.**
    `recipeSearchText(r)` gathers name/category/difficulty for the recipe AND
    every part; `recipeCategories(r)` and `recipeDiets(r)` do the same for the
    two filter frames, so a collection surfaces when one recipe inside it
    matches. `matchReason` says WHICH recipe inside matched — a card titled
    "Weeknight" appearing for "onion soup" with no explanation reads as a
    broken search.
  - Two search bugs fell out of that. `recipeMatchesQuery` read `r.steps`
    directly, which is EMPTY for a collection, so no collected recipe's method
    was searchable; and `String()` on a `{t,ind}` step object is
    `"[object Object]"`, so indented steps never matched even on a flat recipe.
    Both now go through `allSteps(r)`. Difficulty was never searched at all.
  - **Sharing one recipe out of a collection was broken on four routes of five
    (found in v36.13, present since v36.8).** `toggleShare(ref)` resolves the
    recipe correctly, but wired its buttons to `doWhatsApp(ref)`,
    `doCopy(ref)`, `showEmailModal(ref)` and `shareAsPage(ref)` — every one of
    which did its OWN `recipes.find(x => x.id === id)`. A part reference is
    never in `recipes`. WhatsApp and Copy threw on `undefined`; Email and
    Save-as-page hit `if (!r) return` and did nothing at all. Only "Share via…"
    worked, because it reused the recipe `toggleShare` had already resolved —
    **which is exactly why it went unnoticed: the one route that worked is the
    one used on a phone.**
    - The lesson is the one this codebase keeps relearning: **an id that can be
      a part reference must be resolved with `findRecipeRef`, once, and the
      resolved recipe passed down.** Re-looking-up the id in a second function
      is how it breaks. When adding any new per-recipe action, grep for
      `recipes.find` on the path before assuming it works.
    - Resolving through `findRecipeRef` is also what settles an inherited meal
      type or difficulty, because `partAsRecipe` applies
      `part.category || coll.category` before any builder sees the recipe. All
      five output builders (`rText`, `rHtml`, `buildRecipePage`,
      `buildPrintHtml`, `makeDocxBlob`) print Category and Difficulty, so a
      shared recipe carries real values rather than blanks.
  - **Dark mode: run the scan at PHONE WIDTH (v36.14).** Tony's Meal menu was
    `#F2EDE6` text on a hard-coded `background: white` panel — **1.16:1**,
    effectively invisible. It is the nutrition-panel bug (v32.5) for the third
    time, and it survived every previous dark-mode pass for one reason: the
    mobile dropdown panels **do not exist above 700px**, so a desktop check
    never opens them. `tests/contrast-scan.js` opens every menu, panel and
    modal at 390px in both themes, composites the effective background up the
    ancestor chain and measures the real ratio; it runs in CI and the
    `ui_dark_contrast` self-test guards the same surfaces in the browser.
    - The scan found **58 unique low-contrast elements**, of which 33 were a
      light surface surviving into dark mode. Both themes are now clean.
    - **An inline style beats any class rule**, so four surfaces
      (`.tint-box`, `.inline-code`, `.access-badge-full`, `.action-btn-bring`)
      had to have their colours moved out of `style="…"` into classes before a
      theme could reach them at all.
    - **`--terracotta` is lifted in dark mode (#FF7A45) so it reads as TEXT,
      and that same lift drops WHITE text on a terracotta FILL to 2.6:1.** One
      variable cannot do both jobs: `--terracotta-fill` stays at #C1440E in
      both themes, where white is 5.3:1. Colouring the button text dark instead
      was tried first and was wrong — not every `.btn-submit` is
      terracotta-filled, and it turned two dark-backed buttons dark-on-dark.
    - `--muted` was `#8A8279`: **3.78:1 on white**, under AA, and it is the
      secondary text colour on nearly every surface. Now `#6F6A60`.
    - **A self-test must not measure whatever the previous 200 tests left in
      the DOM.** The first version of `ui_dark_contrast` read a stale
      `#viewModal` button and reported a failure that could not be reproduced
      anywhere in the real app or in the standalone scan. It builds its own
      throwaway fixtures now, so the result cannot depend on test order.
  - Still collection-level, deliberately: nothing. `source`, `isClip`, `diets`,
    `category`, `difficulty`, `fav` and the cook history are all per-recipe; the
    collection's values are the fallback. The one thing a part still cannot have
    is a **photo**, which is Tony's own call on storage.

- **The self-test suite is a SEPARATE FILE, fetched on demand (v36.15/36.16).**
  `self-tests.js` holds `window.SELF_TESTS`; `index.html` declares
  `var SELF_TESTS = []` and a `loadSelfTests()` that injects the script once.
  It was 590 KB — **36% of everything every device downloaded on every update**,
  for a developer tool only Tony runs. Cold transfer went 1,633 KB → 1,058 KB.
  - **`var`, not `const`.** Only a `var` global is the same binding as
    `window.SELF_TESTS`, so the external file's assignment reaches the app's
    references. The old code used `const` and exported it explicitly; that
    cannot work across two scripts.
  - **Nothing had to be exported for the split.** Both are classic scripts, so
    they share the global scope: `var`/function declarations are window
    properties, and top-level `let`/`const` (`CATS`, `recipes`, …) live in the
    shared global lexical environment and are reachable by name from the suite.
  - **Per-device setting, default OFF** (`tonys_selftests_enabled`), in
    ⚙️ → 🪵 Logging & debugging. It hides the ⚙️ → 🧪 Self Test entry; it does not
    forbid the feature — `openSelfTest()` offers the download to anyone who
    reaches it another way, so the setting is never a dead end.
  - **`tests/run-self-tests.js` must call `loadSelfTests()` first.** The app
    deliberately never loads the suite on its own, so a runner that just reads
    `window.SELF_TESTS` finds nothing.
  - **A test that reads the suite's own source must fetch `self-tests.js`, not
    `index.html`.** `test_fixtures_stay_local` scans for fixture ids and found
    zero after the move; it failed loudly only because of its `< 20` floor —
    which is the argument for putting a floor on every "I found N things" scan.
  - `selftests_are_a_separate_download` guards the whole arrangement: the suite
    is not inlined, `index.html` still references the file, the page stays under
    1,200 KB, the setting defaults to off, and the menu entry follows it.

- **The "white panel" over the ingredient editor is the GINGER browser
  extension, not this app.** It came back in v36.9 and `elementsFromPoint` named
  it outright: `GWSW#gws-…` over
  `DIV.ginger-module-highlighter.ginger-module-highlighter-ghost [absolute]`,
  sitting on top of an ordinary `INPUT` inside `#ingsRows`. Ginger overlays a
  "ghost" layer on text fields to draw its underlines, positions it from the
  field's VIEWPORT rectangle, and the field is inside a scrolling modal — so the
  offset is recomputed against the wrong coordinate space and accumulates. That
  is exactly what Tony described: moves with the scroll but at roughly three
  times the rate, never disappears, eventually slides off the bottom.
  - **It cannot be reproduced here** — headless Chromium runs no extensions. Two
    releases were spent theorising about compositing before one `click` handler
    printing `elementsFromPoint` answered it in a single line. **When something
    visual cannot be reproduced, ask what is under the cursor before guessing at
    causes.**
  - Do not "fix" it in the app without evidence that the fix works: the
    positioning belongs to the extension. `spellcheck="false"` on the ingredient
    fields is the only plausible lever and is NOT known to make Ginger skip
    them.

## Outstanding

- **5.4 — per-recipe Firestore documents. Complete as of v32.2.** All four steps are
  done: v28.0 dual-wrote both layouts, v28.1 stopped writing the legacy
  `shared/recipes` document but kept reading it each load, the document was deleted by
  hand in the Firestore console on 15 Aug 2026, and v32.2 removed the reading code —
  `reconcileLegacyStragglers`, `migrateToPerRecipeDocs`, `stripPhotosForCloud`,
  `slimRecipeForCloud`'s `keepHistory` flag, `meta.legacyAt`, the `recipes` listener and
  the unconditional-read branch. **Do not reintroduce a second cloud shape.** The two-
  browser concurrency checks in `PLAN-5.4-per-recipe-docs.md` §7 were **run by Tony on
  29 Aug 2026** and the guard behaved: PC edited, phone edited and saved, PC's save
  refused, nothing overwritten. What it also found is that **detecting a conflict is
  not the same as offering a way out of one.** Closing and reopening the recipe still
  showed the local version and saving failed again, because nothing re-read a single
  document between full loads — only restarting the whole app cleared it. Fixed in
  v35.3: `refreshRecipeFromCloud(id)` pulls one document down on its own, and
  `_conflictIds` (owned by `markRecipeConflicted`/`clearRecipeConflict`) makes the state
  visible in the recipe view instead of leaving it invisible until the next full load.
  **The local version is pushed onto `r.history` before being replaced**, so the
  existing 🕘 Version history → ↩ Restore is the way back; a refresh that silently
  discarded unsynced work would be the very bug the 5.4 guard exists to prevent.
  **Tony re-ran the two-device test on v35.3 and it behaves.**
- **Deletion is genuinely admin-only, published 1 Aug 2026.** v28.1 split `write` into
  `create, update` — `write` in Firestore means create + update + delete and allow rules
  are OR'd, so the `allow delete` line below it had been restricting nothing. Consequences
  now live: a write-role member deleting a recipe removes it locally but not from the
  cloud, so it returns on their next sync (`flushCloudDeletes` reports this honestly);
  and `syncCloudPhotos` silently fails to remove their orphaned `photo_<id>` documents.
  The role labels in Family Access — "Read + Write" vs "Full (incl. delete)" — describe
  what actually happens now, which they did not before.
- **Classifier long tail (5f.11).** ~900 bare `youtu.be` / `x.com` links in Tony's
  harvest carry no signal in the URL and little in the message. Waiting on more
  dismissal data from him rather than guessing a rule.
- **First-run config screen** — deferred by Tony pending a decision about whether the
  app is ever released publicly.
- The Bring! token that leaked into git history **was rotated on 1 Aug 2026**. The old value is
  still in the history and always will be; it is simply dead now. Nothing further to do.
