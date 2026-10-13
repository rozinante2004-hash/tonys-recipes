# Privacy audit — October 2026

Done on 13 October 2026 at the owner's request, after e-mail addresses were found in the published
translations. Released as v38.26 – v38.28 (Worker v74); the owner's decisions on the open points as v38.29
(Worker v75). The repository is public, so this report names
kinds of data, never the data itself.

The audit covered:
- both public repositories (`tonys-recipes`, `rozinante2004-hash.github.io`): every file, the images,
  the test data and the working notes;
- what the app sends and to whom (its Content-Security-Policy hosts against the code);
- the Worker: what it stores (D1), keeps (KV), logs, and sends on;
- the database rules: who can read whose details;
- account and household deletion: what is left afterwards;
- the GitHub Actions logs (public for a public repository);
- the privacy statement (11 languages) and the in-app "What leaves this device" panel, against all of
  the above.

## Found and fixed

| # | Finding | Fix |
|---|---|---|
| 1 | Family members' e-mail addresses in the **published translations** (`i18n/*.json` and the kept versions, every language). They came from the ✉️ Notify button's tooltip, which named the person, and from the sync chip. | The app never collects text holding an address (`i18nTranslatable`). The tooltip names nobody. The translate job takes such entries out of the central store at the next run, and the publish job keeps them out of the files and out of the kept versions. (v38.26) |
| 2 | The **owner's Gmail address** was written in the app's settings, the Worker's code, the rules publisher (which also printed it in its public job log) and the move job. The **contact address** was written in 11 privacy pages, the extension's privacy page and the app. | The owner is a salted fingerprint in the app. The address is the GitHub secret `OWNER_EMAIL`, passed to the Worker as a secret and to the jobs, and never printed. The contact address is stored as two halves and joined only on screen; the legal pages show "contact [at] …" until their script makes it a link. (v38.27, Worker v74) |
| 3 | **Test data** taken from real chats and accounts: the owner's address (5 tests), an address at his employer's domain, a real-looking phone number, a WhatsApp group invitation that would let anyone join, location pins, a gift-voucher link, a shared ChatGPT conversation, and share links carrying the sharer's tracking id. | Replaced with made-up values of the same shape (fiction-range phone number, example domains, dummy codes). (v38.27 – v38.28) |
| 4 | The WhatsApp link classifier listed **one person's own card company, insurers, clinics, parking, appointment site and employer's service desk**, taken from his chats. Together that is a personal (and partly health-related) profile. | Replaced by generic entries (government, post, any company's service desk). Such links are now hidden only when the words around them say sale or sign-up. (v38.28) |
| 5 | The working notes held the owner's second address and a stranger's address (an uninvited sign-up, most likely a store reviewer). | Taken out of the current text. (v38.27) |
| 6 | The **device log**, which is sent along with notes and reports, recorded **other people's addresses**: the address a link request went to, and the household's new owner. | Every address in the log is shortened to its first letter and domain, both when written and in the report (so older entries are covered too). Self-test `log_masks_addresses`. (v38.28) |
| 7 | **Account deletion** left the account's own small records behind: its pointer to the household it last opened, and its settings (terms agreed, offers shown, display choices). | Deleted with the account; checked end to end on the emulator. (v38.28) |
| 8 | Job logs: the Firefox store job printed the support address. | It prints that it was set, not the address. (v38.28) |
| 9 | The **privacy statement** said "Backups you save are files on your own device; we have no copy". Since 10 Oct the community copy's database is backed up daily (encrypted, 30 days, on GitHub). | Statement 1.3 (all 11 languages) says so, under GitHub (now "Pages and Actions") and under retention. |
| 10 | The statement did not mention several things: Gmail (sending a recipe from your own account), the end-of-beta question's answers, that the app's fonts and code load from Google and Cloudflare, the two-minute IP rate limit, Cloudflare's short request log, and WhatsApp excerpts going to the AI when you ask about your chats. | All added in statement 1.3, and to the in-app panel. |
| 11 | The statement and the panel said the photo libraries never learn "who you are". The browser loads their thumbnails directly, so they see the IP address. The panel also said the AI never gets photos, but 📷 Scan a Recipe sends one. | Corrected in both. |
| 12 | The statement was silent on two points: a household's messages stay in its conversations after it is deleted, and deleting an account does not delete notes sent to the Team. | Both stated (§4, §6). |
| 13 | The owner's full name was placeholder text in the Family Access markup. | Replaced by "—" (filled in from the household at run time). |

## Checked and in order

- **Database rules.** A household's members, their addresses, kept places, requests and history are readable only by its members (and the owner's management tools). Linked households read recipes and photos only. Invitations and kept-place notices cannot be listed. Conversations carry household names, not people's.
- **Worker.**
  - It writes no log lines of its own.
  - Rate limiting keeps an IP address for about two minutes.
  - D1 holds what the statement lists: allowances and spend per household, household summaries, notes and replies, error reports (deleted 120 days after the error last happened), feature counts, survey answers, and the owner's own devices.
  - Videos sent to Gemini are deleted after reading.
- **Error reports** (testers' copies) already removed addresses and cut web addresses to the site.
- **The extension** makes no network requests and keeps nothing.
- **No analytics or advertising code anywhere.**
- **Store screenshots and the architecture diagram** use made-up data.
- **The site-root repository** holds no personal data.

## Left for the owner to decide — decided on 13 October 2026

1. **The git history.** Earlier versions of files in both repositories still contain what was removed above.
   Only rewriting the public history removes it, and copies may already exist elsewhere.
   **Decision: left as it is** (a rewrite would not reach the copies already made, and affects every clone).
2. **Self-hosting the fonts and code libraries.** **Done in v38.29.** The fonts (`fonts/`, SIL Open Font
   License), Firebase's compat SDK (`vendor/firebase-12.19.0/`) and the import libraries (`vendor/libs/`) are
   served by the app itself; Google's sign-in script for Gmail loads only when a recipe is sent by Gmail. Opening
   the app contacts Google only for sign-in and the database. Statement 1.4 and the in-app panel say so.
3. **Retention of notes, error reports and household summaries.** **Done in Worker v75: six months.** A daily
   job deletes notes and their replies, survey answers, the owner's device records, monthly allowance and usage
   rows, and household summaries (not refreshed, or deleted, six months ago); error reports go 120 days after
   they last happened. Statement 1.4 says so.
4. **After the family's move:** the old copies of the family's data in the family project (the old first-layout
   `shared/` collection and the moved households) **will be deleted one week after the move**, once nothing is
   found missing (CLAUDE.md, MOVE DAY CHECKLIST step 9). Open until then.
5. **`OWNER_SECONDARY_EMAIL`** — **a spare owner key (v38.29, Worker v75)**: a second Google account with the
   owner's powers, so that losing the first account does not lock the owner out. The app knows it by its
   fingerprint, the Worker and the rules by the secret; it also receives the alerts. It has the same
   protections as the first (Google sign-in only, the authenticator once required, a recent sign-in for
   destructive actions), and must set up its own authenticator before that is required.

Not legal advice. The earlier recommendation stands: have an Israeli lawyer review the statement and the terms before the app opens to the public.
