# Tony's Recipes Collection

A personal/family recipe manager: an installable PWA with Google sign-in, shared cloud sync,
AI-assisted import, and a shopping-list integration. Bilingual English + Hebrew throughout.

**Live:** <https://rozinante2004-hash.github.io/tonys-recipes/> · **Version:** v27.9

It is one self-contained `index.html` — inline CSS and JS, dependencies from a CDN.
**No build step, no framework, no bundler, no npm.** Open the file in a browser and it runs.

## What's here

| File | |
|---|---|
| `index.html` | The entire app — HTML, CSS and JS in one file (~13,100 lines). |
| `cloudflare-worker.js` | API proxy for Claude, photo search, YouTube, Instagram and Bring!, so no key ever ships to the browser. **Deployed by pasting into the Cloudflare dashboard, not from this repo** — the copy here can lag production. |
| `firestore.rules` | Canonical Firestore security rules. The app fetches this file and fills in the member list; published to Firebase by hand. |
| `manifest.json`, `sw.js`, `icons/`, `logo.svg` | PWA plumbing. |
| `version.json` | Polled by the running app to notice a new deployment. |
| `whatsapp/` | Exported WhatsApp chats the app can answer cooking questions from. See [`whatsapp/README.md`](whatsapp/README.md) — **these are other people's messages, and they are as public as this repository is.** |
| `local-save-helper.py`, `setup-save-helper.sh` | Optional localhost helper so exports keep their Hebrew/Russian filenames on Linux. |
| `bring-relay.html`, `filename-test.html` | Standalone helper pages — a Bring! token refresh relay and a filename-download bench. |

## Deploying

Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes the
repository root to GitHub Pages. Bump `version.json` and the four `v27.x` strings in `index.html`
together, and every open copy of the app offers itself an update.

The Worker and the Firestore rules are **not** deployed by that workflow. Both are applied by
hand, on purpose — a bad rules push locks every device out of the data at once.

## Verifying a change

The app tests itself: **⚙️ Settings → 🧪 Self Test** runs 115 checks and explains its failures.
Six of them (`net_*`, `stor_firebase`) need real network and a signed-in session and cannot pass
offline; anything else failing is a regression. Add a check for every behavioural change.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — working notes. Conventions, decisions that must not be silently
  reverted, and traps this codebase has already sprung. **Read it before changing anything.**
- [`IMPROVEMENT_IDEAS.md`](IMPROVEMENT_IDEAS.md) — the backlog, with what shipped in which version.
- [`PLAN-5.4-per-recipe-docs.md`](PLAN-5.4-per-recipe-docs.md) — the brief for the one large item
  still outstanding: giving each recipe its own Firestore document.
- [`RECONSTRUCTION_PROMPT.md`](RECONSTRUCTION_PROMPT.md) — a full specification, detailed enough to
  rebuild the app from scratch if the source is ever lost.
