# Tony's Recipes Collection — working notes

Read this before changing anything. It records the rules, the decisions that are easy to accidentally undo, the
conventions that keep the app deliverable, and where things stand now. **The history lives in `docs/history/`**
(split out on 11 Nov 2026, audit item H6: this file was 742 KB and was read into every session before any work):
`docs/history/traps.md` — every trap this codebase has sprung (v36–v38.27, newest first); `docs/history/2026-10.md`
— the move, the alpha, the pre-launch audit, the testers' first week; `docs/history/2026-11.md` — the beta, newest
first, **where new entries go**. Search those files for a bold title (the *Index* below lists them by topic).

## START HERE — where things stand (11 Nov 2026, 11:00 Israel time)

Read this section first in a new session — a new session remembers nothing but these files. Then read the rest of
this file as needed, and `docs/history/` for the long story of anything. `RECONSTRUCTION_PROMPT.md` has the app as a
specification; `AUDIT-2026-11-10.md` has the latest audit, its plan and Tony's answers; `ARCHITECTURE.md` what runs
where.

**Live now**
- The family's copy (`main`, https://rozinante2004-hash.github.io/tonys-recipes/ — it forwards to the community app)
  and the community app (`beta`, https://mykitchennotes.community, Firebase project my-kitchen-notes-beta) run
  **v40.16 + Worker v109** (released 26 Nov 2026, 08:14 Israel time, on 451e434 — v40.14: ⏱ a step's time read in
  Hebrew, in words and in all the app's languages, so every recipe has its timers; v40.15: ⏳ the hourglass timer (three
  wheels, up to 31 days; flip, lay down) and 🧮 the calculator under 🧰 Tools, timers that ring on a locked phone (Web
  Push from the Worker at that second, three rings; ⏰ in ♿ Accessibility; Privacy Statement 1.20); v40.16: the
  calculator as a page from a squared notebook, keys drawn by hand, figures in the same pen). Before it: **v40.13 + Worker v108** (released 22 Nov 2026, 14:04 Israel time, on 5768217 — v40.12: 📋 Run sheet: a dish's name
  opens its recipe on top of the sheet (closing returns to it; the tick box still marks the step done); v40.13: a new
  recipe never takes another device's number (the cloud's next free number taken at once; a clash at save moves it to a
  free number, "“…” was given a new number"; the full read keeps unsent new recipes), a shared link waits 20 s for the
  sign-in and asks again once — from the beta's sync log of 22 Nov). Before it: **v40.11** (released 21 Nov 2026, 20:59 Israel time, on 392b6e4 — v40.09: 🗓️ a multi-day recipe planned
  only up to its first step that waits for another day (🌙, "Then, on another day: … — not planned here."); v40.10: the
  Hebrew of the app speaking of itself in the masculine singular (⏳ קורא את המתכון…; rule 7a; the 13 lines written to
  the shared Hebrew at 19:32); v40.11: the waiting folded (≥ 20 min when nobody has work → a striped band "≈ 1:55"),
  👩‍🍳 You (all the work, one thing at a time), the dishes one after another before 🔀 Propose order, 📋 Run sheet, long
  waits read whole and written in days, storage time left out. Before it: **v40.08** (released 21 Nov 2026, 13:07 Israel time, on 36ddd78 — v40.05: 🗓️ Work Planner (··· More
  → 🧰 Tools, and 🗓️ in the select bar: AI work/quiet blocks and equipment per recipe — what a recipe needs and the
  kitchen has not listed is added —, the kitchen's equipment asked once, Propose order, 1/2 cooks, linked kitchens'
  recipes, ⠿ drag, 📌 pin, ✓ done, a tap shows a step, shared with the household; Privacy Statement 1.19;
  firestore.rules gain `planner/{doc}`); v40.06: full screen with a top bar (↩︎ Undo, ✕), 🍳 Your kitchen as a button,
  each name on its own line, Hebrew "יחידת עבודה"; v40.07: a collection's recipes chosen one by one; v40.08: a dish's
  name opens its recipe on top of the planner, Escape closes the window on top. Before it: **v40.04** (released 20 Nov 2026, 03:12 Israel time, on 49dee4b — v40.01: 📍 Take me there in Help
  answers and their Details; v40.02 + Worker v108: 🔔 chat notifications when the app is closed (Web Push; family and
  linked-kitchen chats; Privacy Statement 1.18); v40.03: 📍 in the first answer too (found by the menu item's name), its
  label in the person's language (a phrase the shared dictionary lacks is taken from the shipped file; Hebrew "📍 קח אותי
  לשם", Tony's wording), the Help and the reconstruction prompt brought up to date; v40.04: 📊 Households' copy fallback
  selects the on-screen text after a redraw. v40.00 at 01:06 on 01370e6 — 52 button labels in rarely-opened
  windows translated by hand; v39.99 at 00:11 on 3eea878: an open window holds the page behind it still; v39.98: 📊 Households' ▾ folds a household, addresses and identifiers copy on a tap; v39.97 on 19 Nov at
  00:48 on 2414b8f: the pantry's example in the reader's language, a text box's own labels translated, six hints the
  harvest never saw; v39.96 on 18 Nov at 02:41 on 8e4ac76:
  the farm sayings recorded again in
  Tony's wording, `sounds/farm-2/`, and his Hebrew ones in the 8 Hebrew voices, `sounds/farm-he-1/`; v39.95 on 17 Nov
  at 23:50 on da3f6d9: the farm sayings in other languages, a Language selector in the farm window, each language its
  own `i18n/_farm_<lang>`; v39.94 at 21:40 on db945ab: the
  network Self Tests send the sign-in; v39.93 at 19:55 on 4b688fc: each farm animal in its own recorded voice,
  `docs/farm-voices.md`; Worker v108 since 20 Nov 01:59 (from Test); the jobs are listed near the top of `docs/history/2026-11.md`).
  **On Test, not released:** nothing beyond v40.16. The test copy
  (https://tonys-recipes-test.pages.dev, its own database and rules) follows `test`.
- **The beta has had testers since Sunday 25 Oct 2026** and is **by invitation only**: the owner invites with
  ⚙️ → 👑 → ✉️ Invite testers (the congratulatory wording of v39.60); a tester's share button asks the owner for an
  invitation for someone else (v39.61: 📊 Households → ✉️ Beta invitation requests, with a red dot while one waits,
  v39.62). The menu says "Share this app with family" until the official launch (`shareAppLabels()`; Tony: "We will
  change it back once we launch officially").
- **Every release needs Tony's typed yes for that build**, with CI green on that commit. Then push the SHA to `main`
  AND `beta` (release-on-green.sh below), check every job (jobs-on.sh), record the release at the top of
  `docs/history/2026-11.md`, and update "Live now" here.
- The rules were last published on 21 Nov 2026 with the v40.08 release (deploy-rules on 36ddd78; the planner's). A push to `test` that changes
  them publishes to the test project only; a release publishes to the family's and the beta's.
- The Self Tests: **490 pass, 0 fail, 7 skipped** (the network ones) on v39.95, locally (English and Hebrew).

**The audit of 10 Nov 2026 (`AUDIT-2026-11-10.md`) — Tony's answers of 11 Nov, and where each item is.** In the
order of work; update this list as items land. Each change: Self Tests + knock-outs, the local checks, Help and
`RECONSTRUCTION_PROMPT.md`, every new phrase in all 11 languages (gaps 0), a note in `docs/history/2026-11.md`, push
to `test`; releases only on his yes.
1. **H6 — split CLAUDE.md: done** (this file; `docs/history/`).
2. **U1(a) — the nutrition box folded on phones: done, v39.64 on Test** (one line, "Nutrition per 100g · 245 kcal ▸",
   a tap opens the four values; a computer always shows them; screenshots sent to Tony).
3. **S1 — a verified sign-in for the page, video and photo fetches: v39.65 + Worker v105, released in v39.72 —
   STEP 2 DONE: Worker v107 (15 Nov 2026, Tony: "please go ahead") requires it; the way back is the Worker variable
   `SIGNED_FETCH = accept`. The history below is how it was staged.** The app
   sends the sign-in (`workerBodySigned`; a video file a ticket, `videoFileTicket`); the Worker checks any token sent
   (`signedCaller`, the address confirmed) but still serves a call with none (`SIGNED_FETCH_DEFAULT = 'accept'`),
   because the apps released before v39.65 send none. **Step 2 — the release is out (14 Nov, 00:39):**
   Worker v107 with `SIGNED_FETCH_DEFAULT = 'require'` (its tests already cover the 'require' mode) — it deploys
   from `test` at once. Held until about Sunday 15 Nov evening (Israel time) so devices still on v39.63 take the
   update first — Tony was told on 14 Nov and can say "now" or "hold"; then push it and tell him.
4. **C2 — a page's own recipe data, without the AI: v39.68 + Worker v106 on Test** (Tony: "Yes. YouTube" — YouTube
   goes through the Data API, title + description → AI; page data does not apply there). **The page's own photo is
   never taken** (Tony, 11 Nov: copyright — see Decisions); the Worker's `image` field is not used.
5. **H1 — the page size budget: done, v39.64** (2,000 → 2,300 KB; the built page is 1,997 KB).
6. **U6 — Hebrew in the plural: APPROVED by Tony (11 Nov, after his review; 577 phrases; 163 set by hand, his
   wording included: "מנהל/ת משק הבית" for a household's owner, "מנהל האפליקציה" for the app's, v39.70).** On
   **LIVE since 14 Nov 2026**: he-plural.yml ran on `main` right after the v39.72 release (609 central phrases
   changed; the publish after it put exactly the approved file on `main` and `test`). The prompt (rule 7a) keeps new
   phrases plural, and the app's owner "מנהל האפליקציה".
7. **C3 — Explore and Suggest on `AI_MODEL_SMALL`: done, v39.64** — Tony tries them on the test copy. ("What can I
   make" uses no AI: it matches the pantry on the device.)
8. **C4 — diet tagging in batches of 20: done, v39.64** (`DIET_TAG_BATCH`, `dietTagPrompt`).
9. **C9 — no second Self Test run: done, v39.64** (the `already-green` job; `paths-ignore: ["i18n/**"]`, so a push
   that changes ONLY translation files runs no Self Tests — check a hand translation locally with gaps.js).
10. **S3 — relays only for a site that refused the server: done, v39.67** (`RELAY_WHEN_REFUSED` = 401, 403, 429,
    451, 503 in the Worker's "Page returned …"; anything else never goes to a relay).
11. **S5 + H5 — Dependabot for the workflows, actions pinned to commit SHAs; SheetJS 0.20** (Tony, after the
    explanation: "11. Yes"). **S5 done, v39.64:** every `uses:` is a full commit with its version as a comment;
    `.github/dependabot.yml` opens one grouped pull request a month against `test`. **H5 done, v39.69 on Test:**
    SheetJS 0.20.3 from cdn.sheetjs.com (the newest; npm and GitHub stop at 0.18.5, CVE-2023-30533) in
    `vendor/libs/xlsx-0.20.3.full.min.js` + its LICENSE; `CDN_XLSX` points at it; the 0.18.5 files are gone.
12. **H3 — the empty-catch review: done, v39.68.** `tools/empty-catches.mjs` (622 dropped errors; 28 around a write,
    three of them real lost writes, now logged); CI fails when more than 25 sit around a write.
13. **H4 — keep the screen walk: done** (Tony: "Sure. Let's do that."): `tests/screen-walk.js`, in the repo since
    v39.63, passes or fails since v39.70 (*How to verify*).
- **The instructional clip "How to add a recipe" (16–17 Nov 2026): `docs/instructional-clip.md`** — Tony's witch idea;
  English (Bella) and Hebrew (Danit) made and approved; in the app since **v39.91–v39.92 (live, 17 Nov)** (+ Add Recipe
  ▾'s last item, the "Add your first recipe" screen, and under Help answers about adding a recipe). "החליפי": A, stressed on "לי" (Tony: "Definitely A").
- **The promotional clip (12–13 Nov 2026): `docs/promo-clip.md`** — both clips are made and approved (English: Jon;
  Hebrew: Nimrod), with how they are made and Tony's decisions. **The in-app player (v39.72, live)** plays them
  from 🎬 Watch the one-minute clip in 💬 Ask About the App (Hebrew for a Hebrew interface, English otherwise; the
  files are in `media/`). **v39.73 on Test:** `clip.html`, a public page that plays the clip without the app, linked
  from the testers' invitations in the invitation's language; both files now open on the logo (a chat shows the
  first frame). **v39.74 (live):** a recipe's video source plays in the player by default (YouTube, Vimeo,
  Instagram, Facebook, TikTok, video files — `playerSource`); ⚙️ → 🎨 How it looks → 🎬 Use external players only
  turns it off; a recipe's web page still opens in the browser. Tony tried it on Test ("It seems to be working well") — the
  sites' own players cannot be reached from this environment. **v39.75 on Test:** the same in a linked kitchen's
  collection (each recipe's own source). **v39.77 on Test:** the player opens through a camera lens in one
  second — Tony's pick of three shown on a page (origami, camera lens, clapperboard:
  https://claude.ai/artifact/1pm3g2x3d15wX2pTBBW9VY): "The Lens looks best. Let's use it".
- **Not doing** (Tony: no): U7 collapsing the help suggestions; F3 dropping `.doc`; the page's own photo for an
  import (copyright — *Decisions*).
- **Still open from earlier audits, Tony's side:** restrict the community app's browser key in two stages (APIs
  first, then websites; 🔑 Check the app's key after each); the Pushover licence (bought in the app's 30-day trial,
  ~26 Nov; else https://pushover.net/licensing); Gmail "Send mail as" contact@; the Chrome Web Store listing's
  homepage. **Ours, later:** Playwright 1.56 pinned with `ubuntu-24.04` in the workflows — unpin before GitHub
  retires 24.04; a lighter first screen; the AI models after the launch.

**Lessons that keep applying**
- A refusal is not an answer — a source that says "too many, wait N s" read as "no pictures" made every run look as
  if it had worked once. When the sandbox cannot reach a server, replay the exact run from GitHub's servers (a one-off
  workflow on `test`, removed after).
- A Self Test that drives a whole feature also writes the person's own state (the auto-fetch's undo): set it aside
  and put it back exactly. A Self Test that arms a deferred timer (a toast 10 s later, v39.62) clears it in `finally`,
  or it fires into the next test; keep one timer handle and clear it before re-arming.
- A notice can be read the opposite way — Tony read "…appear here once that address is confirmed" as "confirmed": say
  what IS, plainly. Before blaming data, check what the app on the person's screen believes (a screenshot settled it).
- Firestore raises local writes to listeners before the write's promise resolves — never also push the written
  document into the same list. A rule function erroring on a missing field on the right of `||` refused (in the
  emulator) what the left allowed — guard with `'x' in request.resource.data`.
- Web Audio: a DynamicsCompressor's defaults squash and add make-up gain — set it as a peak limiter; let the
  AudioContext rest.
- An inline style beats a stylesheet rule: a phone-only change to an inline grid needs `!important` (the Translate
  window, v39.63). A translation script must write the repo's JSON shape (indent 1, sorted keys, final newline) or
  the diff is the whole file.

**Setting up a new session** — start it in the **"My Kitchen Notes"** environment (personal; the three repositories;
today's network plus cdn.sheetjs.com). The "Default" one works too, without that host.
1. A cloud session opens in `rozinante2004-hash.github.io` (the site-root repository — nothing to do there). Attach
   `rozinante2004-hash/tonys-recipes` with push access (`add_repo`, access "push"), clone it to
   `/home/user/tonys-recipes`, then `git checkout test`. All work happens on `test`.
2. Recreate `/root/.claude/settings.json`: bypassPermissions plus the allow-list (see *Decisions*:
   "Never ask Tony for permission").
3. Tests, locally (last result, v39.63: **463 pass, 0 fail, 7 skipped** on the source in English, Hebrew and with
   preferences, AND on the built test copy):
   - Builds: `node tools/build.js live && cmp dist/index.html index.html`, then
     `SKIP_AUTH_HELPERS=1 node tools/build.js test` (writes dist/; the test and community copies are built WITHOUT
     comments — tools/strip-comments.js, proved by `ACORN_PATH=/opt/node22/lib/node_modules/eslint/node_modules/acorn
     node tools/check-strip.js index.html dist/index.html`).
   - Self tests: serve with `python3 -m http.server 8137 --bind 127.0.0.1` (the source) and, from dist/, 8139 (the
     build); then `node tests/run-self-tests.js --port <port>`. Playwright is found at
     /opt/node22/lib/node_modules/playwright; Chromium is preinstalled — never run `playwright install`.
   - `node tests/worker-cors.mjs` needs no network.
   - Rules suites on the emulator (Java is installed): in a scratch folder `npm i firebase-tools@13
     @firebase/rules-unit-testing@5 firebase@12.19.0`, copy firestore.rules and tests/firestore-households-rules.test.mjs
     there (tests/ subfolder), then `npx firebase emulators:exec --only firestore --project demo-households "node
     tests/firestore-households-rules.test.mjs"` (329 checks) — and tests/firestore-rules.test.mjs (35). Household
     identifiers in a test must avoid I, L, O, U (`MKN-[A-HJKMNP-Z2-9]{4}-…`).
   - **Never `pkill -f` a pattern that appears in your own command line** — it kills your shell (exit 144).
4. What this environment can reach:
   - `gh api` works for this repository: workflows, runs, jobs, check-runs, annotations.
   - Job LOGS cannot be read (GitHub's log redirect is blocked). The tools post their summaries as
     `::notice::` annotations; read those instead:
     `gh api repos/rozinante2004-hash/tonys-recipes/check-runs/<job id>/annotations`.
   - Listing secrets is blocked. The databases' key (FIREBASE_RULES_KEY) is only in GitHub: on 21 Oct a new read-only
     job over the community copy's link requests and accounts was **refused by the session's safety check** — do not
     try to get round it; ask Tony for a screenshot or a 🪵 log report instead (that is what found the cause).
   - workers.dev, github.io and mykitchennotes.community are NOT reachable from here, so trust the
     jobs' own live checks. googleapis.com is reachable.
5. Releasing (scripts — recreate them in the scratchpad; `gh api` must work):
   ```bash
   # release-on-green.sh <full sha>: waits for every check on the commit; all green → pushes it to main AND beta
   SHA=$1; R=repos/rozinante2004-hash/tonys-recipes; cd /home/user/tonys-recipes || exit 3; stable=0
   for i in $(seq 1 160); do
     out=$(gh api $R/commits/$SHA/check-runs --jq '.check_runs[] | [.name, .status, (.conclusion // "")] | @tsv' 2>/dev/null)
     n=$(printf '%s\n' "$out" | grep -c .); pending=$(printf '%s\n' "$out" | awk -F'\t' 'NF && $2!="completed"' | wc -l)
     if [ "$n" -gt 0 ] && [ "$pending" -eq 0 ]; then stable=$((stable+1)); [ $stable -ge 3 ] && break; else stable=0; fi
     sleep 30
   done
   echo "$out"; bad=$(printf '%s\n' "$out" | awk -F'\t' 'NF && $3!="success" && $3!="skipped" && $3!="neutral"' | wc -l)
   [ "$pending" -ne 0 ] || [ "$n" -eq 0 ] && { echo "TIMEOUT"; exit 2; }; [ "$bad" -ne 0 ] && { echo "NOT GREEN"; exit 1; }
   git fetch -q origin main beta; git merge-base --is-ancestor origin/main $SHA && git merge-base --is-ancestor origin/beta $SHA || exit 5
   git push origin $SHA:refs/heads/main $SHA:refs/heads/beta; echo "RELEASED $SHA at $(TZ=Asia/Jerusalem date '+%d %b %H:%M')"
   # jobs-on.sh <sha>: after a release, lists every workflow run on it (Pages, Worker, rules, languages, Self Tests)
   gh api "repos/rozinante2004-hash/tonys-recipes/actions/runs?head_sha=$SHA&per_page=50" \
     --jq '.workflow_runs[] | [.name, .head_branch, .status, (.conclusion // "")] | @tsv'
   ```
   Use the FULL sha (a typo in a short one waits 80 minutes for nothing). `origin/test` moves under you (the
   languages job commits translations to it): `git fetch origin test && git rebase origin/test` before pushing.


**Tony's standing rules**
- Permissions: "Please stop asking for permissions. This is slowing the work significantly. The only
  permission you need from me is to move the build to the family and Beta app. For anything else,
  assume permission is granted."
  - A release means pushing one commit to BOTH `main` and `beta`:
    `git push origin <sha>:refs/heads/main <sha>:refs/heads/beta`.
  - It needs his yes for THAT release, and CI must be green on that commit.
    **Changed 16 Oct 2026 (until the beta testers go live):** Tony: "Please feel free to move all the new versions
    to the family/beta version when they are ready until we indeed go live with the beta testers. For now, it is
    still development, as I have only now started my own Alpha testing." So: release each version once the local
    suites and CI are green, without asking; tell him after. Ask again once the testers are in.
  - Before pushing, check `git merge-base --is-ancestor origin/main <sha>`, and the same for
    `origin/beta`.
  - `origin/test` can move under you (the languages job merges into it), so
    `git pull --no-rebase origin test` before pushing.
- Secrets:
  - They live only in GitHub. Never print one, and never ask him to paste one into the chat.
  - His second address exists only in the secret `ALERT_EMAIL`, never in the repository.
  - `OWNER_SECONDARY_EMAIL` (v38.29) is the spare owner key: a second Google account with the
    owner's powers, a way back in if the first is lost. Its fingerprint is the second entry of
    `APP_CONFIG.ownerKeys`; the Self Tests job checks the two match.
- "I do not like my name appearing much": app texts name nobody.
  Tony, 20 Oct 2026 (replacing his 13 Oct exception): "Use each kitchen's name. Do not use my name unless something
  is indeed coming from me." The WhatsApp share, the printed list's title and the Word export (title and file name)
  say the kitchen's name (`kitchenTitle()`, `kitchenFileStem()`); sharing the app says the app's name.
- **Full, current URLs, always** (Tony, 20 Oct 2026: "as always (and make it a rule), provide full and updated URLs
  when asking me to connect to various sites. This applies also to the list of decisions I need to make."). Every
  step that sends him to a site gives the exact page address (https://…, with the project in it where there is one),
  in chat AND in documents (the audit's "Needs Tony" list) — never "Firebase → Settings" alone.
- **Times in Tony's local time** (13 Oct 2026: "Could you please use local time instead"): Israel — UTC+3 in
  summer time (until the last Sunday of October), UTC+2 in winter. Never quote UTC to him.
- After each release:
  - Check every job that ran: Deploy to GitHub Pages, Deploy the Worker, Publish the database rules,
    Translate new phrases, Publish languages, Self Tests on main.
  - A failed Pages deploy is fixed by dispatching a fresh run, not by re-running it.
  - Record the release here.
- No model names in commits.


## Index (v36.82)

The traps live in `docs/history/traps.md` — each entry a mistake that was made once, bullets
newest first. **Search that file for the bold title named below** (Ctrl+F) rather than
scrolling. The versions' notes and release records are in `docs/history/2026-10.md` and
`docs/history/2026-11.md`. Sections of this file: *What this is* · *How to verify work* ·
*Conventions* · *Decisions that must not be silently reverted* · *Traps — the standing
rules, distilled* · *Outstanding*.

- **Where everything runs:** [`ARCHITECTURE.md`](ARCHITECTURE.md) — hosting, both
  Firebase projects, the Worker, the site-root sign-in pages, CI and the test
  copy, and what breaks when each is down. **Keep it current** when a
  deployment, a dashboard setting or a test job changes.
- **Standing rules (read first):** "Nothing secret may live in `index.html`" ·
  "The Family Access list is not the permission" · the employer-managed iPhone
  (in *What this is*: never proxy GitHub through the Worker) · "NEVER send a
  custom request header to the Worker" · "The Worker is not free to call".
- **Configuration:** "AUDIT BLOCK 1" (owner-only tools, `isAppOwner`) ·
  `#appConfig` in index.html (v36.66, in the traps file) — every deployment identifier ·
  "FEATURE SWITCHES" (v36.70) · "EVERY REPORT SAYS WHICH COPY WROTE IT".
- **Two copies, branches & delivery:** "TWO COPIES: LIVE AND TEST" (the
  build, `tools/environments.json`, the orange marking, its own icons) ·
  "NEW WORK GOES THROUGH THE `test` BRANCH FIRST" · "FIREBASE SDK 12.19.0,
  STILL THE COMPAT BUILD" (and the open modular-vs-compat question).
- **Sign-in:** "ON AN iPHONE, SIGN-IN ON `<project>.firebaseapp.com` FAILS"
  (self-hosted `/__/auth/`; the family's copy depends on the
  `rozinante2004-hash.github.io` repository) · "Firebase Auth needs its own
  authDomain in the CSP" · "The app can say why sign-in failed".
- **Security & CSP:** "AUDIT BLOCK 1" · "This CSP has now caused four separate
  outages" · "The CSP must stay in step with the CONNECT hosts too" · "…with the
  script hosts" · "Firebase Auth needs its own authDomain in the CSP" ·
  "`rHtml` output is rendered in an iframe on this origin" · the build fills
  the CSP's Worker host per copy (v36.82, under "TWO COPIES") · "Escape before
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
  usually the test" · "END-TO-END SYNC ON THE FIREBASE EMULATOR" (v36.71) ·
  "\"COVERS\" MEANS ON TOP, NOT MERELY OVERLAPPING" · "A MENU WHOSE BUTTON
  HAS SCROLLED AWAY".
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
(his Google account — the address is the GitHub secret OWNER_EMAIL, never written in the repository). Family members also have write access. The collection
is bilingual **English + Hebrew**, and bidi correctness is a recurring
requirement, not a nice-to-have.

- **`index.html` is the whole app** — inline `<style>`, inline JS, ~24 750 lines,
  no build step. Scripts in `<head>`: Firebase compat 12.19.0 (v36.74; was 10.12.0) — since v38.29 the
  app's own copy in `vendor/firebase-12.19.0/` (from the npm package), not gstatic. **xlsx, mammoth, jszip
  (`vendor/libs/`) and Google's GSI (Gmail sending) load on demand** via `loadScriptOnce()` (5.11) — don't
  put them back in `<head>`; there is a test. The fonts are `fonts/` (`fonts.css`, `legal-fonts.css`, the
  woff2 files, OFL in `fonts/LICENSE.txt`), not Google Fonts; the CSP allows only `'self'` for fonts and
  styles. A library upgrade = a new versioned folder/file name (the service worker keeps them cache-first)
  plus the e2e test's `wantSdk`. qrcodejs and the Excel export were removed in v28.5.
- `cloudflare-worker.js` — the Worker (Anthropic, photo search, YouTube,
  Instagram, Bring!'s import, metering). **Since 8 Oct 2026 it publishes itself**:
  `.github/workflows/deploy-worker.yml` runs when a push to `main` changes it (or
  `worker/wrangler.jsonc`) — i.e. only on Tony's yes — runs `tests/worker-cors.mjs`,
  `wrangler deploy --config worker/wrangler.jsonc`, then checks the live `health`
  reports the file's WORKER_VERSION. Secret `CLOUDFLARE_API_TOKEN` (Tony's "Edit
  Cloudflare Workers" token) in GitHub; the API keys stay in Cloudflare. The config
  is in `worker/` so Cloudflare Pages never takes it for the site's. A binding or
  plain variable added in the dashboard must be added to `worker/wrangler.jsonc`
  too, or the next deploy drops the binding (plain vars are kept: `keep_vars`).
  After a release that changes the Worker, check the "Deploy the Worker" run.
- `firestore.rules` is the canonical rules file; the app fetches it and substitutes
  `{{READ}}` / `{{WRITE}}` / `{{ADMIN}}`. Edit the structure there, not in `index.html`.
  **It publishes itself** (8 Oct 2026): `.github/workflows/deploy-rules.yml` runs
  when a push to `main` changes it — only on Tony's yes — runs both rules suites
  on the emulator, then `tools/publish-rules.mjs` (Firebase Rules REST API:
  new ruleset, release `cloud.firestore`, read back) to all three projects, the
  placeholders filled as the app does in the household layout (the owner
  alone). Secret `FIREBASE_RULES_KEY`: the JSON key of `rules-publisher@recipes-
  f379d.iam.gserviceaccount.com`, "Firebase Rules Admin" in each project.
  `--dry-run` fills and checks without publishing. Family Access → Show rules
  still works by hand.
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
  through Firestore instead (5f.8, `docs/history/traps.md`).
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

**The clip's public page has its own check** (v39.73): `node tests/clip-page.js --port 8137` (it needs `axe-core`
where `tests/axe-scan.js` finds it) opens `clip.html` as someone without the app would — English and `?lang=he`,
phone and computer, light and dark — and is a CI step. Run it after touching `clip.html` or the files in `media/`.

**After a change to what is on the screen, walk the screens** (audit H4; Tony, 11 Nov 2026: "Sure. Let's do that."):
`node tests/screen-walk.js [out-dir] --port 8137` opens 30 screens (the menus, a recipe, a collection, the editor,
Help, Family Access, the sign-in…) with a made-up kitchen of ten recipes, on a phone in English, Hebrew and dark and
on a computer, and saves a screenshot of each. It FAILS (exit 1) when a screen did not open, the page threw, or the
page scrolls sideways; small text, small tap targets and things past the edge are listed as "look:" for a person.
Look at the screenshots — that is what it is for. Not in CI (about 10 minutes).

## Conventions

- **Versioning:** minor bumps (`v28.2` → `v28.3`) for ordinary work; majors reserved
  for genuinely big changes. Bump `version.json` **and** the four version strings in
  `index.html` together (line-1 comment, `APP_VERSION`, two badges in the markup).
- **Delivery: push to `test`; ASK TONY before anything reaches `main`.** (27 Sep
  2026 — supersedes "push straight to `main`" of 1 Aug 2026.) Work goes to the
  `test` branch (the test copy, CI); only after **CI is green AND Tony has said
  yes for that specific release** is `main` fast-forwarded to `test`. His "assume
  agreement / stop asking" refers to tool permission pop-ups, NOT to releasing
  to the family app. A scheduled check may REPORT CI, never move `main` by
  itself. **Tell him in advance when a change is risky** (cloud data,
  migrations) so he can take a backup first. `git fetch origin main` before
  starting. The old convention — hand-uploads through the web UI, branch
  `claude/tonys-recipes-app-nv31q1`, PR #1 — is retired; that PR was closed unmerged.
- Keep `RECONSTRUCTION_PROMPT.md` and `IMPROVEMENT_IDEAS.md` current in the same commit.
- **Translations by hand (v39.65):** put them in `i18n/<lang>.json` with the code that shows the phrase (the
  repo's layout: indent 1, strings in JS order, `count`); the release's `translate-new.mjs` copies them into the
  central translations instead of asking the AI. The CENTRAL document per language is the source: a change to a
  phrase that is already there (not a new one) must be written there, or the next publish undoes it.
- **Where notes go (11 Nov 2026, audit H6):** this file holds the rules and the current state only, and is read into
  every session — keep it under ~700 lines. A version's note and a release record go at the TOP of
  `docs/history/<yyyy-mm>.md` (newest first, in full, as before); a new trap at the top of `docs/history/traps.md`;
  then update "Live now" in START HERE. Never paste history back into this file.
- Tony values **honest error messages** highly. Never let the UI assert something the
  code hasn't verified (see the Bring! note in `docs/history/traps.md`). A dead end with no way forward is
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
| **Never ask Tony for permission — EXCEPT moving `test` to `main` (Tony, 1 Oct 2026, said twice).** | "Stop asking me for permissions for anything but moving the test to the live app. Assume permission is granted in advance." Tool pop-ups included: a container reset wipes `/root/.claude/settings.json`, so the FIRST thing a session does is recreate it with `"defaultMode": "bypassPermissions"` and an allow-list of every tool (Bash, Read, Edit, Write, Glob, Grep, WebFetch, WebSearch, SendUserFile, Artifact*, `mcp__Claude_Code_Remote`, `mcp__Claude_Docs`, `mcp__github`). Releasing to the family app still needs his explicit yes for that release (and green CI). |
| **THE CASCADE: try everything yourself; ask the person LAST (Tony, 1 Oct 2026).** | "The less options the user gets, the higher the chances they will use the application." Every flow is a fallback cascade that runs WITHOUT the person: if the recipe is easily retrievable, take it; if not, do the next thing that might work (another route, the embed, the video itself) — automatically, without a choice or a confirmation in between. Only when every route has failed is the person asked, and then with ONE clear thing to do (the other options tucked away). This is the guideline for ALL user interactions, not only imports: a new feature that offers a menu of options where the app could have tried them in order is wrong. |
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
| **Never take a web page's own photo (Tony, 11 Nov 2026).** | "If I save the page's photo, without giving credit to the owner of the photo (I probably won't know it) wouldn't it constitute as theft? I could be sued for it." A recipe's photo comes from the person (their own picture or a link they choose) or from the photo search (Pixabay, Pexels, Unsplash, Wikimedia Commons), which keeps the photographer's credit and licence (`photoCredit`). An import — a page's data (`image` from the Worker's `recipes`, v106), Open Graph, the AI's answer — never sets `r.photo`. |
| **The app's owner is "מנהל האפליקציה" in Hebrew (Tony, 11 Nov 2026).** | "All should be referred to as "מנהל האפליקציה". Although I am indeed the App's owner, in this capacity I should be referred to as the App's manager." Never בעל/ת האפליקציה, הבעלים של האפליקציה, לבעלי האפליקציה, כלי הבעלים. A household's owner stays הבעלים (or "מנהל/ת משק הבית", his wording in three phrases — "The manager is indeed the admin in this case"). The translation prompt's rule 7a says so (v39.70); `tools/he-plural-overrides.json` carries every hand-set phrase into the central write. |
| **The player opens through a camera lens, one second (Tony, 14 Nov 2026).** | Asked for "a marketing eye-catcher": "start as something a lot smaller and open up to it's fullest in 1 second, in an elaborate way". Of three shown he chose: "The Lens looks best. Let's use it". The window is whole underneath and only cut to the lens's circle, so the clip starts at once; `playerAnimStop()` must always run (end, close, the safety timer) — a window left cut is unusable. Never when the device asks for reduced motion. |
| **Each newcomer sees only what is relevant to them (Tony, 15 Nov 2026).** | "I think users should see only what is relevant for them." A tester the owner invited is offered only "🏠 Start my own recipe collection" (and "Not now"), with his words: "You were invited to the closed Beta app — welcome! Your details are already in the system, so all that is left is to start your own recipe collection." A kitchen joiner's link joins them before any welcome. |
| **"Recent:" — the recipes opened last fill the top row of the list (Tony, 15 Nov 2026).** | "In the list of recipes, I would like to see in the top row the recent recipes accessed. The rest should be sorted normally. Give it a small "Recent:" title too, to make it clear and a square around the recipes in that row." As many as one row holds (three in the List view), in a box with the title; the rest in the order chosen **without** them (nothing twice — "the rest"). Not while searching or filtering, nor in the 🕐 Recently viewed order. |
| **Scaling: ×0.5–×4 and "Dynamic" (Tony, 14 Nov 2026).** | "Please reduce the scaling ingredients options from 0.5 -6 to 0.5-4 and add, at the end of the line a new button called 'Dynamic'… Changing each of the values should automatically change all other values to fit it… reflected in the Methods as well." Dynamic is not a second scaling: it sets the same `viewMult` from whichever box was typed in, so everything that follows a scale follows it. The box typed in shows what was typed (`viewDynAnchor`); the rest keep the cook's rounding (`fmtAmt`). It never writes to the recipe. **The values move as you type** (Tony, on v39.76: "The values in Dynamic should be updated as I type.") — in place (`dynLive` → `dynRefresh`), never by redrawing the view: a redraw replaces the box in hand and closes a phone's keyboard. |
| **A recipe's video source plays inside the app by default; "Use external players only" turns it off (Tony, 14 Nov 2026).** | "Please allow all sources in recipes to be played in the in-app player by default. However, let it be overwritten, if desired, by a checkbox in settings, called 'use external players only'." Played: what `playerSource` knows (a video site's own embedded player in a sandboxed frame, or a video file). **Not played: a recipe's web page** — sites refuse framing and the app cannot tell beforehand, so a page stays a link; nor short links that hide their target. Never add a host to `frame-src` without adding it to `playerSource`, the privacy panel and the Privacy Statement's row (1.16). The player always offers ↗ Open outside the app: the app cannot see whether a framed video played. |
| **Every sketch or clip page sent to Tony has player controls (Tony, 16 Nov 2026).** | "When providing me with a sketch or a clip to watch, please add controls, so I could pause or stop it, and to drag the timeline back and forth." ▶ Play / ❚❚ Pause / ▶ Resume, ■ Stop, and a timeline to drag (while playing or paused) with the time shown — as in the witch clip's template (`wtemplate.html`: `startAt`, `pause`, `stop`, `place(T)` puts a scene's pictures where they are at T). A video file sent as a file plays in the viewer's own player. |
| **Every clip ends on the same end screen, in the same words (Tony, 16 Nov 2026).** | "Keep the wording of the end screen as in the previous clip. It should be kept for all future clips as well, unless I say otherwise." English: "My Kitchen Notes" / "All your recipes. One place. For good." / mykitchennotes.community / "By invitation only. For now". Hebrew: "My Kitchen Notes" / "כל המתכונים שלכם. במקום אחד. לתמיד." / mykitchennotes.community / "בהזמנה בלבד. בינתיים" — even when the clip's narration speaks to one person (the witch clip's Hebrew says "שלך" in the closing line; the end screen keeps "שלכם"). Change it only when Tony says so. |
| **Every clip opens on the logo — the frame a chat shows before it plays (Tony, 16 Nov 2026).** | "Please make a note to have all future clips to also open on the logo (the frame WhatsApp shows before playing)." WhatsApp (and most chats) show a video's first frame until it is played; a clip that fades in from nothing shows a blank square. Any new or remade clip, in any language, starts on the app's logo, large and sharp (`icons/icon-512.png`), from its very first frame — how it is done for the two clips of 14 Nov: `docs/promo-clip.md`, *The first frame is the logo*. Check the first frame (`ffmpeg -i <file> -frames:v 1 first.png`) before sending a clip. **The first frame is the logo alone — no caption** (Tony, 16 Nov 2026, the witch clip: "It should appear only once Danit starts talking. The 1st frame is reserved for the logo only, so it could be displayed before the clip starts."): the caption stays empty until the first words are said; the caption's band stays (Tony, 17 Nov: "No need to hide the band"). |
| **📊 Households: one line per household; the sort kept on the device; a phone shows Household, Owner and the sort's two columns (Tony, 16 Nov 2026).** | His five points (`docs/history/2026-11.md`, v39.88). A tap opens one line (every value); a tap on it opens the details; ⊞ Expand all. The pairs beyond his two examples are `PHONE_COLS` in manage.js. The Recipes number is the top bar badge's (`recipeHonourCount`, collections' recipes each counted), never the entries. |
| **"Recent:" is the person's own, the same on all their devices, as many as the row holds (Tony, 16 Nov 2026).** | "display the same recipes on mobile and PC"; "the number of recipes shown is not a set count, but rather the number of recipes which can be displayed in a single row" (three on his phone, seven on his wide screen). Kept in `users/<uid>/prefs/recent` (theirs alone — never another household member's view), merged by time, listened to live. |
| **The farm animals: each its own recorded voice, chosen by Tony (17 Nov 2026).** | He chose a cast over one voice, turned down my auditions ("Most of them have no character and are rather lame. I will pick the voices myself"), picked fourteen voices in ElevenLabs' Voice Library and asked for the V4 model. The ten sayings are recorded once per animal (`sounds/farm-2/` since v39.96; Hebrew `sounds/farm-he-1/`; `docs/farm-voices.md`); the farm window's voice choice is gone ("Follow my cast choice"); a sentence not recorded uses the device's voice of the animal's kind. A new saying is recorded for every animal into a new `sounds/farm-<n>/` folder. |
| **The app speaks of itself in the masculine singular (21 Nov 2026).** | Tony: "In the Hebrew translation, when the app is referring to itself, like when it reads a recipe, it should use the single male form: קורא את המתכון and not the plural one." A status line saying what the APP is doing: ⏳ קורא את המתכון…, פותח, מביא, מתכונן, מתחבר, מפעיל, בודק — never קוראים / פותחים. The plural stays for the READER (לחצו, שלכם). Rule 7a of the translation prompt says so (v40.10); the eleven lines that were plural are in `tools/he-plural-overrides.json`, so `he-plural.yml` ("make it plural") writes them to the central Hebrew — a change made only in `i18n/he.json` is undone by the next publish. |
| **"📍 קח אותי לשם" — singular (20 Nov 2026).** | Tony: "In Hebrew, קח אותי לשם sounds better than קחו אותי לשם. Please change it". An exception to the app's plural Hebrew: the button's label (and the ✨ What can this app do line that names it) stays singular. `tools/he-address-form.mjs` does not list קח, so the plural job leaves it. |
| **The App Store: on hold (18 Nov 2026).** | Tony: "Let's hold off on the App Store for now, until we get more feedback from the Beta testers." What I found (Apple's pages, 18 Nov): Apple Developer Program $99 a year (waivers only for non-profits, schools, government); an individual's legal name is shown as the seller, an organisation needs a D-U-N-S number, its own website and an e-mail on its domain. Review rule 4.2 turns down "a repackaged website", so it would need a shell around the app plus iPhone-only parts (Share-menu extension, notifications, a widget); also Sign in with Apple beside Google (4.8), native Google sign-in, in-app account deletion (5.1.1, the app has it), report / block / contact for shared content (1.2), and every update through Apple's review (2.5.2). Building needs Apple's tools on a Mac (Xcode Cloud with the membership, or GitHub's Mac machines). Until he asks again: the home-screen web app (Safari → Share → Add to Home Screen). |
| **A how-to clip goes where the task is — not beside the one-minute clip (Tony, 17 Nov 2026).** | "I'm fine with the bottom of the '+ Add Recipe ▾' menu. It makes sense. However, stacking the in the same place as the other clip, under About, will make it crowded. I think it would be better to link it under any Help answer related to adding recipes. Once we accumulate enough such manual clips, we would create a videos library with a TOC for all the clips." 🎬 How to add a recipe is the last item of + Add Recipe ▾, a button on the "Add your first recipe" screen (asked, Tony: "Yes please"), and a button under a Help answer about adding a recipe (the assistant's `[CLIP:ADD-RECIPE]` mark, or the answer naming the menu). Every clip is in `APP_CLIPS`, Hebrew for Hebrew and English otherwise — the library's contents when it comes. |
| **The one-minute clip: Hebrew for a Hebrew interface, English for every other language (Tony, 13 Nov 2026).** | "The Hebrew clip should be linked if the interface language is Hebrew. For all other languages link the English version. No point in linking both for everyone. Link it in the '💬 Ask About the App' modal." `tourClip()`. The clips play from the app's own site (`media/`), inside the app's player — no video site; "if installing the app is mandatory for the clip to be viewable, then it cannot be used as a marketing tool", so a link for people without the app must play in a plain browser. The service worker must keep leaving `media/` alone (a cached video cannot be seeked on an iPhone). |
| **Sharing produces a file, not a public link.** | Publishing family recipes to a public endpoint is Tony's decision to make, not a share button's. |
| **Declined:** 3.8 nutrition per-serving; 4.4 filter counts; 4.8 header touch targets. | Asked for and declined. Don't re-propose without reason. **5.6 (CI) was accepted in Aug 2026**; 3.1 (meal planner) is not declined but low priority — Tony cooks once a week. |


## Traps — the standing rules, distilled

One line each; the full story of every one is in `docs/history/traps.md` under the same bold title (and the notes of
v38.30 on in `docs/history/2026-10.md` and `2026-11.md`). A new trap gets its full entry there and, if it is a rule
every session needs, a line here.

- **A LIBRARY VOICE THAT SPEAKS THROUGH THE ELEVENLABS API IS ADDED TO TONY'S MY VOICES** (17 Nov 2026: 42 farm
  auditions landed there; Tony had them removed). Audition only voices he has added himself, or tell him before, and
  remove what you added once he has chosen (the key needs Voices: Write for that).
- **NO E-MAIL ADDRESS IS WRITTEN IN THE REPOSITORY** — it is public and so are its Actions logs; the owner is
  `APP_CONFIG.ownerKeys` (fingerprints) and GitHub secrets; tests use `stAsOwner()` / `ST_OWNER`.
  **AN E-MAIL ADDRESS IS NEVER A PHRASE** — the languages are public files and the harvest collects every visible text.
- **Nothing secret may live in `index.html`.** The Worker app key is the deliberate exception: it ships, is not a
  secret, and only stops drive-by abuse — **the Worker is not free to call**: allowed Origin + app key + per-IP
  rate limits in KV; the AI actions also need a verified sign-in (`idToken` + `hid`), and since Worker v105 the page,
  video and photo fetches take one too (`workerBodySigned`).
- **The Worker is ONE server for all three copies, and a push to `test` that changes it deploys it at once.** A change
  that would refuse what the released apps send must be staged: accept first, release the app, then refuse.
- **NEVER send a custom request header to the Worker** — the OPTIONS reply lists the allowed headers, so a new
  header blocks every call until the matching Worker is live; the app key travels in the body (`appKey`), and in
  `X-App-Key` only for the one video upload whose body is not JSON (its sign-in rides as a `?ticket=`, Worker v105).
  **CORS is applied CENTRALLY** in the Worker's
  `fetch` wrapper; handlers never set it.
- **A photo's bytes go through the Worker, and ONLY the Worker** — `connect-src` is an allowlist with no bare
  `https:`; the CSP has caused four outages: it must stay in step with the connect hosts, the script hosts and the
  Firebase authDomain, and the build fills the Worker host per copy.
- **A relay never sees a URL without the user's consent**, and relayed HTML is parsed with `DOMParser`, never
  `innerHTML` (a detached div still fires `onerror`). **Escape before highlighting/interpolating, never after.**
- **NEW WORK GOES THROUGH THE `test` BRANCH FIRST** — **TWO COPIES: LIVE AND TEST** (`tools/build.js`,
  `tools/environments.json`; the built copies have the comments stripped); `main` and `beta` move only on Tony's yes.
- **THE LANGUAGES ARE FILES IN THE REPO, PUBLISHED BY A BOT** (every 10 minutes, and on demand) —
  `origin/test` moves under you; pull before pushing. **The interface can be translated; the RECIPES never are** —
  the dictionary is keyed on the English text itself, so editing an English string orphans its translations.
- **A KEY BECOMES A FIRESTORE FIELD NAME**, capped at 1,500 bytes; **Firestore documents have a 1 MiB limit**
  (`FIRESTORE_DOC_LIMIT`; photos live in their own documents).
- **A SELF TEST NEVER TOUCHES A REAL RECIPE OR THE REAL CLOUD** (fixtures only) and **A TEST MUST LEAVE THE SYNC
  STATE AS IT FOUND IT**. **The self-test suite runs in ENGLISH**, is **a SEPARATE FILE fetched on demand**
  (`self-tests.js`; the page size budget is for what a device downloads), and **a top-level `let`/`const` is NOT
  a window property** (assign the bare identifier). **A test that cannot fail is not a test** — knock the code out
  and watch it fail (`one58.js` with `KO`).
- **ON AN iPHONE, SIGN-IN ON `<project>.firebaseapp.com` FAILS** — the auth handler is self-hosted (`/__/auth/`);
  the family's copy depends on the `rozinante2004-hash.github.io` repository for it.
- **"SCRIPT ERROR." MEANS A CROSS-ORIGIN SCRIPT**, not a bug in the line it names.
- **Bumping the version is a targeted edit, not a find-and-replace** (five places + `version.json`); **the version
  badge must show what is RUNNING**; **"Update Now" must clear the caches** before reloading.
- **The Family Access list is not the permission** — the rules and the membership documents are; never word a toast
  as though a grant or a revocation has happened before the cloud confirmed it.
- **Never `pkill -f` a pattern that appears in your own command line**; never `pgrep -f "name"` without the
  `[n]ame` trick; the GitHub API needs the full 40-character SHA.

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
