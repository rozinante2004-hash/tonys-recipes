# Tony's Recipes Collection

A personal/family recipe manager: an installable PWA with Google sign-in, shared cloud sync,
AI-assisted import, and a shopping-list integration. Bilingual English + Hebrew throughout.

**Live:** <https://rozinante2004-hash.github.io/tonys-recipes/> · **Test copy:** <https://tonys-recipes-test.pages.dev/> · **Version:** v36.83

It is one self-contained `index.html` — inline CSS and JS, dependencies from a CDN.
No framework, no bundler. Open the file in a browser and it runs. A small build
(`tools/build.js`, plain Node) makes the **test copy** from the same file; the
family's copy *is* the file.

**How it is deployed and how the pieces connect — hosting, Firebase projects,
the Worker, the sign-in pages, CI and the test copy — is in
[`ARCHITECTURE.md`](ARCHITECTURE.md).**

## What's here

| File | |
|---|---|
| `index.html` | The entire app — HTML, CSS and JS in one file (~25,000 lines). |
| `self-tests.js` | The Self Test suite, loaded only when a test run starts (so everyday visits do not download it). |
| `cloudflare-worker.js` | API proxy for Claude, photo search, YouTube, Instagram and Bring!, so no key ever ships to the browser. **Deployed by pasting into the Cloudflare dashboard, not from this repo** — the copy here can lag production. |
| `firestore.rules` | Canonical Firestore security rules. The app fetches this file and fills in the member list; published to Firebase by hand. |
| `manifest.json`, `sw.js`, `icons/`, `logo.svg` | PWA plumbing. `icons/test/` are the test copy's teal icons. |
| `version.json` | Polled by the running app to notice a new deployment. |
| `whatsapp/` | Where the app looks for WhatsApp chats to answer cooking questions from, and the guides for sending one from an iPhone. **It must never hold a chat export** — they are other people's messages; `.gitignore` blocks them and chats travel through Firestore instead. See [`whatsapp/README.md`](whatsapp/README.md). |
| `tools/` | `build.js` + `environments.json` (build the test copy), `make-test-icons.mjs`, and the WhatsApp-guide generators. |
| `tests/` | The headless runners CI uses — Self Test driver, Firestore rules, end-to-end sync, Worker, contrast, phone layout, accessibility. |
| `filename-test.html` | A standalone bench for the three browser download routes (kept as a regression check; see CLAUDE.md on the locale that once broke all three). |

## Deploying

New work goes to the **`test`** branch first — Cloudflare Pages rebuilds the test copy — and
reaches **`main`** (the family's copy, via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
to GitHub Pages) only after Tony has tried it. Bump `version.json` and the four version strings
in `index.html` together, and every open copy of the app offers itself an update. See
[`ARCHITECTURE.md`](ARCHITECTURE.md) §6.

The Worker and the Firestore rules are **not** deployed by that workflow. Both are applied by
hand, on purpose — a bad rules push locks every device out of the data at once.

## Verifying a change

The app tests itself: **⚙️ Settings → 🧪 Self Test** runs about 290 checks and explains its
failures. The `net_*` checks and `stor_firebase` need real network and a signed-in session; CI
skips them. CI also runs the suite in four device profiles and on the built test copy, the
Firestore rules and a multi-device sync test on the Firebase emulator, the Worker's own tests,
contrast, phone-layout and accessibility scans — see [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.
Add a check for every behavioural change.

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — what runs where, who deploys it, what depends on what.
- [`CLAUDE.md`](CLAUDE.md) — working notes. Conventions, decisions that must not be silently
  reverted, and traps this codebase has already sprung. **Read it before changing anything.**
- [`IMPROVEMENT_IDEAS.md`](IMPROVEMENT_IDEAS.md) — the backlog, with what shipped in which version.
- [`PLAN-5.4-per-recipe-docs.md`](PLAN-5.4-per-recipe-docs.md) — the brief for the one large item
  still outstanding: giving each recipe its own Firestore document.
- [`RECONSTRUCTION_PROMPT.md`](RECONSTRUCTION_PROMPT.md) — a full specification, detailed enough to
  rebuild the app from scratch if the source is ever lost.
