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
- `whatsapp/` holds exported chat `.txt`/`.zip` files plus `index.json` listing them.
- `sw.js`, `manifest.json` — PWA. GitHub Pages deploys `main` via `.github/workflows/deploy.yml`.

## How to verify work — this is not optional

The app has a built-in Self Test suite (`SELF_TESTS` in `index.html`, surfaced at
⚙️ Settings → 🧪 Self Test). Drive it headlessly:

```bash
python3 -m http.server 8137          # some checks need http://, not file://
# then Playwright (global install at /opt/node22/lib/node_modules/playwright)
# → page.evaluate over SELF_TESTS, calling each t.test()
```

**As of v28.4: 129 checks, 123 passing.** The 6 failures are `net_*` and
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
