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

## Fixed (released, or on the way: v38.60–v38.63)

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
| 21 | Budget | **No early warning for Firestore** — the allowance 20 testers come nearest to (50,000 reads a day): Firebase's own count needs a role, and GitHub runs the watch a few times a day | v38.63 + Worker v83: every app counts its reads the way Firebase bills them; the server adds them up and warns you at 70%; on 🩺 Server allowances |

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
| A | Any change in a household made each other device's next open read every recipe and photo again (97 reads for one edit). | **Done** — v38.65 (Tony: not after the launch): only what changed — 97 → 24; a tester linked to a 60-recipe kitchen reopens with 23 reads, not 81 |
| B | Stray requests per page load: the browser's look-ahead read text inside the app's code as image addresses. **Not harmless after all**: the site answers an unknown address with the whole app, ~500 KB each, ~2.5 MB of a first visit. | **Done** — v38.61 |
| C | Playwright 1.56 → a version with Ubuntu 26.04 browsers (1.64.1 is out, 20 Oct), then unpin. Not the week of the launch. | Before GitHub retires 24.04 |
| D | Worker CPU: p99.9 16.5 ms against the free 10 ms (no errors in two days). Add the Worker's error rate to the hourly watch. | **Done** — v38.60 + Worker v82: warned at ≥25 errors and ≥2% of requests; a line on 🩺 Server allowances |
| E | The page is 2,112 KB of its 2,200 KB budget (20 Oct, v38.63): the next large feature should load rarely used panels on demand. | Before the next big feature |
| F | The header says "☁️ Shared · <name>" for a kitchen of one. | Stays (Tony, 20 Oct) |
| G | **First visit on a phone** (measured with compression, as the site serves it): sign-in screen after 0.55 s on a fast desktop, 2.6–2.9 s on a mid phone on 4G, 5.7 s on a slow phone on 3G; 811 KB. Later opens come from the device. The community app showed **"Tony's Recipes"** for the first 1.5–3 s, and a link preview of the invitation said "Tony's Recipes Collection". | **Done** — v38.61: its own name from the first frame and in link previews; the sign-in buttons no longer jump. The load itself: fine for a beta; a lighter first screen is a bigger job for later |

## Needs Tony — updated 20 Oct, after his answers

Decided by Tony (20 Oct) and done in v38.64/v38.65: "Sign in"; one "Trouble signing in?" link; "in all its copies" in
the terms and the privacy statement; a new recipe starts at Dinner; the kitchen's name (never his) in exports and
shares; the "Welcome to the kitchen!" toast and the header's "☁️ Shared · name" stay; the old family database cleared
after the check (138 documents); each device reads only what changed (A above). Agreed, his part below.

1. **WhatsApp alerts** (the server side is ready, v38.64 + Worker v84). 20 Oct 18:0x: CallMeBot answered "The bot is
   currently full. Please check back in a few days" — try again from step 1 in a few days (WhatsApp keeps blocking
   its numbers as spam, by its users' reports); e-mail alerts are not affected. Tony: "OK, we'll wait for CallMeBot"
   (no Telegram for now) — reminded Fri 23 Oct 09:00 Israel time.
   1. Open https://www.callmebot.com/blog/free-api-whatsapp-messages/ — it shows CallMeBot's current WhatsApp number.
      Add that number to the phone's contacts.
   2. Send it, on WhatsApp, exactly: `I allow callmebot to send me messages` — it answers with an API key.
   3. At https://github.com/rozinante2004-hash/tonys-recipes/settings/secrets/actions/new add two secrets:
      `WHATSAPP_PHONE` = the number with the country code (+972…), and `WHATSAPP_KEY` = the key.
   4. Say so; the server is redeployed with them; then ⚙️ → 👑 App owner → 📲 WhatsApp alerts → "📲 Send me a test
      alert". The same window turns each kind of alert on WhatsApp on or off (all on to begin with; e-mail unaffected).
2. **Firebase's public-facing name** (the e-mails to testers say it): open
   https://console.firebase.google.com/project/my-kitchen-notes-beta/settings/general and set **Public-facing name**
   to **My Kitchen Notes** if it says "project-557995593102".
3. **The hourly check on Cloudflare's clock** (agreed): open https://dash.cloudflare.com/profile/api-tokens → Create
   Token → Create Custom Token → Permissions: **Account · Account Analytics · Read** → Account Resources: Include · the
   account → Continue to summary → Create Token → copy it; then at
   https://github.com/rozinante2004-hash/tonys-recipes/settings/secrets/actions/new add it as `CF_ANALYTICS_TOKEN`.
4. **Firebase's own counts** (agreed): open
   https://console.cloud.google.com/iam-admin/iam?project=my-kitchen-notes-beta → Grant access → New principals:
   `rules-publisher@recipes-f379d.iam.gserviceaccount.com` → Role: **Monitoring Viewer** → Save.
5. **Done 20 Oct 18:05 (Tony: "OK to delete the 4 + 135 old family documents"):** 139 deleted; a check after it
   found no recipes, photos or shared/ left — only the household's own document, cut to its moved mark.
6. **AI models** (agreed): a look after the launch.
