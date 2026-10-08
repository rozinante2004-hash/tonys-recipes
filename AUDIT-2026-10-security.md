# My Kitchen Notes — security audit

**Date:** 8 Oct 2026 · **Version audited:** v37.94 (app), Worker v65 · **Fixed in:** v37.95 + Worker v66
**Follows:** AUDIT-2026-09.md (S1–S6)

**Scope:** the Worker (every action), firestore.rules, the app's HTML building (what other people
write: households, link requests, conversations, shared and imported recipes, feedback notes,
error messages), links, cross-window messages, the service worker, the browser extension, the
GitHub workflows, and secrets in the repository.

**Obfuscation:** not worth doing. The repository is public, so hiding the deployed code changes
nothing. Protection has to come from what the Worker and the database rules allow.

**Severity:** 🔴 act soon · 🟠 worth doing · 🟡 minor

---

## Found and fixed

| # | | What | Who could do it | Fix |
|---|---|---|---|---|
| 1 | 🔴 | **AI without a sign-in.** The family copy let anyone use the AI by sending the family's address as their Origin header (anyone can) with the public app key. They could pick any model and any answer length. The only limit was the Worker's daily and monthly ceilings. | Anyone on the internet | Worker v66: every copy needs a verified sign-in and membership of the household named. Only Sonnet and Haiku models, at most 32,000 tokens per answer. App: `aiPrepare()` before every AI call. |
| 2 | 🔴 | **Code from other households ran in your app.** Values were placed inside `onclick="…('…')"` handlers with escaping the browser undoes before running the handler. Household IDs, feedback-note IDs (in the owner's window, with the owner's rights), WhatsApp chat IDs and recipe-part IDs all reached handlers this way. Anyone signed in can create a household with any ID and send a link request. | Any signed-in person, in any copy | `jsA()` for every value placed in a handler. Recipe IDs (placed with no quotes) are forced to numbers on load. Household and note IDs must be letters and digits (rules). |
| 3 | 🟠 | **Imported recipe text in the import preview.** The parsed recipe was placed in a handler with only its quotes escaped. A literal `&quot;` in an imported page's text would end the string. | A web page you import | Fully escaped. |
| 4 | 🟠 | **Error messages built as HTML.** `showServiceError` turned links into HTML without escaping the rest. An address someone sent could carry markup. | Anyone who sends you a link | Text is escaped; links must be http(s). |
| 5 | 🟠 | **A page title broke out of an attribute** (the "save as video bookmark" name and address). | A web page you import | Escaped for attributes. |
| 6 | 🟠 | **Direct send to Bring!** used the family's Bring! token for anyone with the public app key: read the list names, add items. The set-token secret was in the public repository (`bring-relay.html`). | Anyone on the internet | Retired (Tony's decision). The Worker answers 410, the page is deleted, and the app switch is off. |
| 7 | 🟡 | **Free storage under `users/…`.** Any signed-in account could store anything there, on the project's bill. | Any signed-in person | Only `prefs/legal`, `prefs/offers` and `prefs/ui` may be written, and only small ones. |
| 8 | 🟡 | **SVG through photo-fetch.** SVG is an image type that can carry a script. | — | Refused. |
| 9 | 🟡 | **Recipe colour placed in a style attribute** (`url(…)` could load a tracking image). | Another household, a backup | Must be a plain colour. |

## Checked and sound

- **Owner-only actions** (management, notes inbox, caps, translations) need a *verified* e-mail
  address, in both the Worker and the rules.
- **Database rules:**
  - Households see only their own data; linked households only read.
  - Nobody can raise their own role.
  - Invitations are viewer-only.
  - Link requests carry the real household name.
  - Conversations are 500 characters at most and can't be edited.
- **The notes inbox** (Worker): needs a sign-in, limits sizes, and accepts only real images.
- **Frame guard** (clickjacking): in place since v36.59.
- **CSP:** no longer allows connections to any https address (September's S2 is done).
- **Secrets:** none in the repository; the Firebase web key is meant to be public.
- **Workflows:** minimal permissions, and pull requests get no secrets. The languages job publishes
  only what admins wrote.
- **Browser extension:** minimal permissions (the tab you're on, when you click); hands text to the
  app, and nothing is saved until you press "Add".
- **Messages from other windows:** checked against the sender's origin.

## Still open

- 🟠 **The family app is open to anyone.** Any Google account can sign in at the family app's
  address and start a household there. The family copy is never capped, so a stranger gets AI up
  to the Worker's ceilings (300 calls/day, 3,000/month) and free database storage. This is
  Tony's decision; see the options in the conversation.
- 🟡 **Third-party relays** (allorigins, corsproxy.io, codetabs) are still the fallback when the
  Worker can't fetch a page. They see the address and could alter the page. Impact is limited:
  everything is escaped, and nothing is saved without "Add". (September's S3.)
- 🟡 **Photo search, page fetching and video reading** need only the public app key. They're
  bounded by per-address rate limits and daily ceilings (videos: 60/day). A stranger could use up
  a day's video allowance.
- 🟡 **Firebase web key restriction** (September's S1): check it's limited to the three sites'
  addresses in the Google Cloud console.
- 🟡 **The direct-send-to-Bring! code** is still in index.html behind the switch. It could be
  removed.

## For Tony to do

1. Release v37.95 first, then paste **Worker v66** into Cloudflare. The new app already sends what
   the new Worker asks for.
2. In the Worker's settings, delete `BRING_TOKEN`, `BRING_API_KEY`, `BRING_LIST_UUID`,
   `BRING_USER_UUID` and `BRING_SETTOKEN_SECRET`, and the `accessToken` key in BRING_KV.
3. Publish the new database rules in the family, test and beta projects (Family Access → Show
   rules).
