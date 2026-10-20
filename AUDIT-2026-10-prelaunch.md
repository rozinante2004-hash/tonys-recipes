# Pre-launch audit — My Kitchen Notes (20 Oct 2026)

Asked by Tony on 20 Oct: *"run a full audit on the app, the workers and everything related, for UI/UX, budget,
functionality, usability, and everything else you consider worth looking into, and prepare a plan for fixing and
improvements … start implementing immediately everything you can, which does not require inputs from me. Items that
require my input should be kept for the last stages."*

## How it was checked

- **Measured, not estimated**: Cloudflare's own analytics, hour by hour (`tools/cf-usage.js`); Firestore reads per app
  open on the emulator with the real rules (`$S/e2e/reads.mjs` — every document a read returns, with its caller).
- **A new tester's first half hour**, phone (375–390 px) and desktop, on the emulator: sign-in, terms, founding a
  kitchen, the welcomes, importing from a website, the examples, a recipe, adding by hand, every menu, help, search,
  feedback — screenshotted and looked at one by one; Hebrew and dark mode on a small phone.
- **The suites**: 393 self-tests × 3 copies + Hebrew/dark, phone chrome, double-click, close-in-view, axe, contrast,
  the Worker's 400+ checks.

## Fixed (released, or on the way: v38.60–v38.62)

| # | Area | Finding | Fix |
|---|------|---------|-----|
| 1 | Budget | Cloudflare's 1,000 KV writes a day used up by idle windows (≈270 requests an hour all night; 1 in 5 wrote a counter) | v38.54 + Worker v78: ordinary requests write nothing; idle apps ask every 30 min |
| 2 | Budget | Nobody was told when an allowance ran out | v38.55 + Worker v79/v80: every allowance → bar in the app + e-mail to the owner; hourly watch warns at 70% |
| 3 | Budget | A linked kitchen read twice on every open; a photo read per recipe on a new device | v38.56: tester reopen 117 → 18 reads; new device 227 → 168 |
| 4 | Budget | Cloudflare Pages: 918 builds in October (free: 500), 553 of them previews nobody opens | Previews off on both projects (Tony's yes) |
| 5 | Sign-in | Firebase's free plan sends 5 sign-in-link e-mails a day | v38.58: password first, the link a small fallback; owner alerted if they run out |
| 6 | Budget | The server's AI ceiling (300 calls a day) too low for 20 testers | Worker v81: 1,000 a day / 10,000 a month (Tony's choice); per-household allowances still cap the bill |
| 7 | Process | CI broke overnight: GitHub's runners moved to Ubuntu 26.04, where Playwright 1.56 has no browser | Self-tests and translations pinned to Ubuntu 24.04 |
| 8 | Process | GitHub ran one of five hourly usage checks overnight | The watch runs twice an hour |
| 9 | UI (phone) | **Sign-in screen cut off at the top on small phones** — the logo and the app's name 71–94 px above the screen, unreachable | v38.59: scrolls, starts in view; a phone-chrome check at 667 px |
| 10 | i18n | **The e-mail sign-in form was English in every language** — the phrase harvest runs in the family copy, which has Google only | v38.59: the harvest draws the sign-in choices with every way on; translated at the next release |
| 11 | UI (phone) | The 💬 button covered the last thing on the page ("✏️ Type it in", the last card) | v38.59: room below it |
| 12 | UI (phone) | "Sign out" broke over two lines in the header | v38.59: one line |
| 13 | UI | "❤ Favourites" chip bigger than its neighbours and growing on hover (it shared the card heart's class) | v38.59 |
| 14 | UI | Import preview "Dinner · · · 2" — empty fields left their dots | v38.59: only what is there, 🍽 for servings |
| 15 | UI (phone) | "📷 Click to upload a photo" on a phone | v38.59: "📷 Add a photo" |
| 16 | First impression | The community app said "Tony's Recipes" for 1.5–3 s of a phone's first visit; a WhatsApp preview of the invitation link said "Tony's Recipes Collection" | v38.61: the name is in the page itself, with link-preview tags |
| 17 | Budget (data) | ~2.5 MB of wasted download on a first visit (stray requests answered with the whole app) | v38.61, and a self-test so new code cannot bring it back |
| 18 | UI (phone) | The sign-in screen jumped when the e-mail button appeared, 1–3 s in | v38.61: its room is kept |
| 19 | Monitoring | The server's own errors were not watched | v38.60 + Worker v82: in the hourly watch, warned at ≥25 errors and ≥2% |
| 20 | UI (phone) | On a slow phone the app's header ("Offline mode") showed for half a second before the sign-in screen | v38.62: the sign-in screen comes first in the page |

## Measured capacity — 20 testers (estimates from the measurements)

| Free allowance | Before the fixes | 20 testers after |
|---|---|---|
| Cloudflare Worker requests (100,000/day) | ~6,500 from idle windows | ~3,000 (3%) |
| Cloudflare KV writes (1,000/day) | 1,113 — blocked | under 20 |
| Cloudflare D1 rows written (100,000/day) | ~3,000 | ~2,000 (2%) |
| Firestore reads (50,000/day) | — | ~15,000–20,000 (30–40%) on a busy day |
| Firestore writes (20,000/day) | — | ~1,000 (5%) |
| Pages builds (500/month) | 918 | ~350 with previews off |
| AI (per household: $4 the first month, then $2) | — | ≈250 website imports a month at Sonnet 5 prices |

## Planned — no input needed

| # | Item | When |
|---|------|------|
| A | Any change in a household makes each other device's next open read every recipe and photo again (151 reads in the test). Read only what changed (`updatedAt` > last read). The sync core — careful work and its own tests. | After the launch |
| B | Stray requests per page load: the browser's look-ahead read text inside the app's code as image addresses. **Not harmless after all**: the site answers an unknown address with the whole app, ~500 KB each, ~2.5 MB of a first visit. | **Done** — v38.61 |
| C | Playwright 1.56 → a version with Ubuntu 26.04 browsers, then unpin. | Before GitHub retires 24.04 |
| D | Worker CPU: p99.9 16.5 ms against the free 10 ms (no errors in two days). Add the Worker's error rate to the hourly watch. | **Done** — v38.60 + Worker v82: warned at ≥25 errors and ≥2% of requests; a line on 🩺 Server allowances |
| E | The page is 2,184 KB of its 2,200 KB budget: the next large feature should load rarely used panels on demand. | Before the next big feature |
| F | The header says "☁️ Shared · <name>" for a kitchen of one, and the same again in the status line. | With Tony's wording (below) |
| G | **First visit on a phone** (measured with compression, as the site serves it): sign-in screen after 0.55 s on a fast desktop, 2.6–2.9 s on a mid phone on 4G, 5.7 s on a slow phone on 3G; 811 KB. Later opens come from the device. The community app showed **"Tony's Recipes"** for the first 1.5–3 s, and a link preview of the invitation said "Tony's Recipes Collection". | **Done** — v38.61: its own name from the first frame and in link previews; the sign-in buttons no longer jump. The load itself: fine for a beta; a lighter first screen is a bigger job for later |

## Needs Tony (kept for last)

1. **Monitoring Viewer** role for the backup's service account in my-kitchen-notes-beta — then Firestore's own counts
   join the hourly watch (warned at 70% like the rest).
2. **Wording on the first screen**: "Connect your storage" (a tester signs in; nothing is connected) — suggest "Sign
   in"; "Why can't I sign in?" and "🪵 Copy the log" are support tools on the very first screen — suggest one small
   "Trouble signing in?" link.
3. **The terms' first line** names "its family, test and beta copies" — meaningful to us, not to a tester.
4. **Welcomes**: a new tester gets "Welcome to My Kitchen Notes" (needed — the choice), then the beta welcome, then a
   "Welcome to the kitchen!" toast. Suggest dropping the toast.
5. **New recipe's category** starts at Breakfast (the first in the list) — Dinner is likelier.
6. **AI models**: Sonnet 5 and Haiku 4.5 today; newer ones exist. Not urgent; worth a look after the launch.
7. The header label (F above).
8. **Move step 9 — clearing the family app's old database** (checked 20 Oct, 12:06, read-only): 143 documents; 129 the
   same in the community app, 10 changed there since (your edits), 4 not there — two recipes and their photos deleted in
   the community app after the move; plus 135 in the first layout's shared/. Clearing needs your OK; the 4 and the 135
   only if you want them gone too.
9. **Your name in what testers send out.** On 13 Oct you said to leave "Tony's Recipes" in the WhatsApp share, the
   shared list's title and the Word export. In the community app these are the testers' too: a tester's Word export is
   titled "Tony's Recipes Collection" (file Tonys_Recipes_….docx), sharing the app on WhatsApp says "Tony's Recipes
   Collection" above a "My Kitchen Notes" link preview, and a printed list is "Tony's Recipes (3)". Suggest: the
   kitchen's own name (yours keeps yours), or "My Kitchen Notes" when sharing the app. (Done already, as they were not
   among your three: "Shared from …" under an e-mailed or shared recipe now names the kitchen.)
10. **The hourly usage watch runs a few times a day, not hourly** — GitHub drops most scheduled runs on this
    repository (the watch ran twice in 11 hours; the nightly backup starts ~5 hours late). Real refusals are still told
    at once (the Worker and the app see them); the watch is the early warning at 70%. To make it hourly for sure: in
    Cloudflare → My Profile → API Tokens, create a token with only **Account → Account Analytics → Read**, and add it
    to GitHub as the secret `CF_ANALYTICS_TOKEN`; then the Worker's own clock (reliable) runs the Cloudflare part every
    hour. Optional.
11. **The name in Firebase's e-mails to testers** (address confirmation, password reset): their sender and subject
    say the project's *public-facing name* — "Reset your password for %APP_NAME%". Checked 20 Oct (read only,
    "Sign-in e-mails" job): all four templates are Google's defaults; the name itself could not be read from here.
    Please look at Firebase (my-kitchen-notes-beta) → ⚙️ Project settings → General → **Public-facing name**: it should
    say **My Kitchen Notes**, not "project-557995593102". The links in the mails work (checked: the key allows the page
    they open).
