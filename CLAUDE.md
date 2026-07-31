# Tony's Recipes Collection — working notes

Read this before changing anything. It records decisions that are easy to
accidentally undo, and conventions that keep the app deliverable.

## What this is

A single-file vanilla-JS PWA recipe manager, owned and used daily by Tony
(rozinante2004@gmail.com). Family members also have write access. The collection
is bilingual **English + Hebrew**, and bidi correctness is a recurring
requirement, not a nice-to-have.

- **`index.html` is the whole app** — inline `<style>`, inline JS, ~12 000 lines,
  no build step. CDN scripts: xlsx, mammoth, qrcodejs, Firebase compat 10.12.0, GSI.
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

**As of v27.9: 115 checks, 109 passing.** The 6 failures are `net_*` and
`stor_firebase` only — they need real network and a signed-in Firebase session,
and cannot pass in a sandbox. Any *other* failure is a real regression.

Always also run a syntax check over the inline `<script>` blocks (`new Function(src)`),
because a single-file app fails silently and completely on a syntax error.

**Add a self test for every behavioural change.** Several real bugs in this app were
found only because a test was written first and disagreed with the code.

## Conventions

- **Versioning:** minor bumps (`v27.8` → `v27.9`) for ordinary work; majors reserved
  for genuinely big changes. Bump `version.json` **and** the four `v27.x` strings in
  `index.html` together.
- **Delivery:** Tony uploads files to `main` **by hand** through the GitHub web UI. Two known
  side-effects: browsers append ` (N)` to repeat downloads and **strip hyphens** from some
  filenames, so `main` accumulates `NAME (3).md` duplicates and de-hyphenated names. Check the
  real filenames on `main` before referencing one.
  Always `git fetch origin main` and merge before starting — the branch and `main`
  diverge routinely. Send changed files as attachments as well as pushing.
- Branch: `claude/tonys-recipes-app-nv31q1` (PR #1).
- Keep `RECONSTRUCTION_PROMPT.md` and `IMPROVEMENT_IDEAS.md` current in the same commit.
- Tony values **honest error messages** highly. Never let the UI assert something the
  code hasn't verified (see the Bring! note below). A dead end with no way forward is
  treated as a bug.

## Decisions that must not be silently reverted

| Decision | Why |
|---|---|
| **No Cook Mode.** Removed in v27.7. | Tony wants the whole recipe visible at once. Do not reintroduce a step-at-a-time view. |
| **`history` is not synced to Firestore.** | Measured: 3 revisions take a recipe from 1.7 KB → 6.2 KB, cutting the shared document's capacity from ~610 recipes to ~170. Re-enable only once 5.4 gives each recipe its own document. |
| **Voice is disabled on iOS.** | iOS defines `webkitSpeechRecognition` but cannot honour `continuous`; an unguarded `onend → start()` froze the whole app. Restarts must stay deferred and capped. |
| **Ticks are session-only.** | Explicitly requested. In memory only, wiped when the recipe closes. Never persist them. |
| **Bring! status comes from the Worker.** | The token lives in KV and is shared; the per-device `bring_token_expiry` is a cache. It may say "unknown" but must **never** assert "expired". |
| **Metric leaves tsp/tbsp/cup alone.** | Only lb/oz/fl oz are converted. They are standard kitchen measures in metric kitchens too. |
| **Full photos stay base64.** | Export, backup, cloud sync, email and print all consume data URLs. Only thumbnails are Blobs. |
| **Sharing produces a file, not a public link.** | Publishing family recipes to a public endpoint is Tony's decision to make, not a share button's. |
| **Declined:** 3.8 nutrition per-serving; 3.1 meal planner; 4.4 filter counts; 4.8 header touch targets; 5.6 CI tests. | Asked for and declined. Don't re-propose without reason. |

## Traps this codebase has already sprung

- **`--warm-brown` is both a surface and heading text.** Headings use `--heading`.
  Flipping the wrong one breaks dark mode in a way that only shows in one theme.
- **`direction: auto` is not valid CSS.** Use `dir="auto"` + `unicode-bidi: plaintext`
  + `text-align: start`. This applies to email, print and shared pages too.
- **Escape before highlighting/interpolating, never after.** `hlMatch`, `aiFailPane`
  and `buildRecipePage` all have tests pinning this.
- **Firestore documents have a 1 MiB limit** (`FIRESTORE_DOC_LIMIT`). The *whole
  collection's* text shares one document today. Anything added per recipe multiplies.
- **Dropdown menus:** `closeDrop` must disarm the outside-click listener, or the next
  click on the trigger reopens and instantly recloses the menu.
- **Test isolation:** close modals in `finally`, not in `try`. A failed assertion that
  leaves a dialog open makes an unrelated test fail later.
- **`localStorage` is per-device.** Anything stored there (pantry, line marker, chat
  index, AI cache, theme) does not travel between Tony's phone and PC. Say so in the UI
  rather than letting it look broken.

## Outstanding

- **5.4 — per-recipe Firestore documents.** The last backlog item and the riskiest.
  Full brief in **`PLAN-5.4-per-recipe-docs.md`** (on `main` it may have landed as
  `PLAN5.4perrecipedocs.md` — browsers strip hyphens from downloads; glob for `PLAN*5*4*.md`
  rather than assuming either spelling). Tony has confirmed he is not the only editor, so
  today's blind whole-document `.set()` can silently lose someone's edit.
- **2.6 — the local Save Helper stays** until the Worker UTF-8 download test
  (`filename-test.html`, test 3) is re-run on Ubuntu/Chrome.
- The Bring! token in git history should still be rotated.
