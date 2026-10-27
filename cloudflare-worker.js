// Tony's Recipes — Cloudflare Worker v93
// v93: NTFY WITH ITS OWN ALLOWANCE (Tony, 27 Oct 2026: "ntfy answered 429 … daily message quota reached"). ntfy.sh counts
// an anonymous sender's messages by its address, and a Worker sends from Cloudflare's, shared with everyone else's — so
// the day's allowance was gone before ours was sent. With the secret NTFY_TOKEN (an access token of a free ntfy.sh
// account) the messages count against that account instead. ntfy's refusal is told in its own short words.
// v92: NTFY SAYS WHY (Tony, 27 Oct 2026: the test alert said "ntfy: not delivered" and nothing more). The topic is taken
// also when the secret holds the whole link (https://ntfy.sh/<topic>), and the test alert — on screen and in its e-mail —
// says why one did not go: a topic ntfy does not take, ntfy's own answer (its status and words), or no connection.
// The topic itself is never shown.
// v91: (1) THE REPORTS DO NOT STAY FOREVER (Tony, 25 Oct 2026): the daily sweep deletes a report 90 days after it was
// closed, 180 at most — screenshot, log and issue (or empties it, if the token may not delete) — and once a month the
// files branch is rewritten so deleted files leave its history. New screenshots and logs go to branch `files`.
// (2) ALERTS ON THE OWNER'S PHONE THROUGH NTFY (CallMeBot never answered): ownerNtfy posts the alert's title and first
// line, addresses masked, to his private topic NTFY_TOPIC on ntfy.sh; "Send me a test alert" says if it went.
// v90: REPORTS TO A PRIVATE REPOSITORY (Tony, 24 Oct 2026: "Please find a way in which reports, sent by the beta users,
// could be read by you, without me having to copy/paste them"): each new note and each new kind of error report
// becomes an issue in the private repository REPORTS_REPO (rozinante2004-hash/kitchen-reports), with its screenshot
// and log as files, written with REPORTS_GITHUB_TOKEN (a token for that repository only); a comment on the open "📥"
// pull request there wakes the Claude session that watches it. No address, name or account id goes. After each note
// or error report (waitUntil), and hourly. Without the token: nothing. A token GitHub refuses is said in 🩺.
// v89: SEVERAL MARKED SEEN OR DONE AT ONCE (Tony, 24 Oct 2026: "Add a "Seen" and "Done" for selected notes too"):
// meter-admin `notes-status` (new | seen | done) and `errors-status` (new | done) take `ids` — up to 99, with the
// status that makes 100 values, D1's most a query — in one statement. Not an owner action that cannot be undone, so no
// fresh sign-in and no alert.
// v88: SEVERAL NOTES OR ERROR REPORTS DELETED AT ONCE (Tony, 24 Oct 2026: "In the Feedback and Errors tabs, please allow
// to select multiple reports … there should appear a "Delete selected" button"): meter-admin `notes-delete` and
// `errors-delete` take `ids` (up to 100 — D1 binds at most 100 values a query) and delete them in one statement: one
// fresh-sign-in check and ONE owner-action alert for the lot (it says how many), not one e-mail per report.
// v87: SIGN-IN-LINK E-MAILS, COUNTED (Tony, 20 Oct 2026: "Stay on the free plan unless we realize, from the stats we
// are collecting, that 5 is insufficient. We are collecting stats about it, right?"): action `link-sent` (no sign-in —
// it comes before one; a ceiling of 50 a day instead) counts each link the apps ask Firebase for, per copy and
// Firebase's day, kept 40 days; a refusal (limit-report auth-email) counts too; at 4 of 5 the owner is warned;
// meter-admin `allowances` returns `links` (today, the most in a day, days all 5 went, days someone was refused).
// v86: A NOTICE SAYS WHAT IT IS (Tony, 20 Oct 2026: "Perhaps the wording should be more informative ... What is Paused?
// Where is this message coming from?"): Pages builds over 500 are a warning, not "paused" — Cloudflare kept building
// past 500 in October — unless the watch sees a build refused (`lastOk: false`); the notice names the service, the
// copies and their counts, when the count starts again (date and time, Israel time) and who counted. A running
// notice now takes the latest figures (it kept the first reading, "918 of 500", all day); only a worse kind e-mails.
// v85: EACH ALERT ON WHATSAPP, OR NOT (Tony, 20 Oct 2026): ALERT_KINDS (eight, all on by default); meter-admin
// `alert-prefs` / `alert-prefs-set`; `ownerAlert(…, { kind })` skips WhatsApp for a kind switched off (e-mail always).
// The new-device e-mail says Israel time, not UTC.
// v84: THE OWNER ON WHATSAPP, AND THE HOURLY CHECK ON CLOUDFLARE'S CLOCK (Tony, 20 Oct 2026): `ownerAlert` also sends a
// WhatsApp message through CallMeBot when WHATSAPP_PHONE and WHATSAPP_KEY are set; meter-admin `alert-test` sends a
// test both ways. A cron at :17 every hour (HOURLY_CRON) reads today's Cloudflare use with CF_ANALYTICS_TOKEN (analytics
// read only) and warns at 70% like the GitHub watch, which runs a few times a day; the snapshot merges both.
// v83: FIRESTORE READS, AS THE APPS COUNT THEM (the audit, 20 Oct 2026): app-signals takes `reads` (documents this app
// read since it last said, ≤ 20,000 a call) into D1 `counters` fsreads:<project>:<Firebase's day>; at 70% of the
// 50,000 free reads an owner warning. Firebase's own count needs the Monitoring role and GitHub's clock, which drops
// most scheduled runs. meter-admin `allowances` returns `appReads` for the owner's 🩺 page.
// v82: THE SERVER'S OWN ERRORS IN THE USAGE WATCH (the audit, 20 Oct 2026): usage-report's `workerErrors` {used, of};
// 2% of today's requests and at least 25 → an owner warning (often the free plan's 10 ms CPU limit, or a crash).
// v81: THE AI CEILINGS FOR 20 TESTERS (Tony, 20 Oct 2026: "1,000/day, 10,000/month"): AI_DAILY_DEFAULT 1000,
// AI_MONTHLY_DEFAULT 10000, and the same set as variables in worker/wrangler.jsonc so a value left in the dashboard
// cannot keep the old 300 / 3,000. Each household's own allowance still caps the bill.
// v80: THE USAGE WATCH COUNTS FIRESTORE TOO. usage-report takes firestoreReads/Writes/Deletes (period 'pacific-day':
// Firebase's day ends at midnight in California, so the warning lasts until then), measured by the hourly watch from
// Cloud Monitoring when the backup's service account may read it ("Monitoring Viewer").
// v79: EVERY ALLOWANCE, TOLD TO THE OWNER (Tony, 19 Oct 2026: "Please make sure the Admin gets a notification if any
// allowance is exceeded or blocked"). `raiseNotice` keeps a notice (D1 `allowance_notices`; KV `notice:d1` when D1
// is what ran out), shows it in the apps (health: everyone in that copy, scope 'all'; the owner's notes-new: all) and
// e-mails the owner the first time, then at most once a day for the same thing. Sources: KV/D1 writes refused; the
// AI day/month ceilings; Anthropic refusing for credit or key; Google's video allowance; a household's AI
// allowance (owner only); `limit-report` from the apps (Firestore's daily allowance — signed in, everyone in that
// copy; Firebase's 5 sign-in e-mails a day — owner only); `usage-report` from the hourly usage watch
// (.github/workflows/cf-usage.yml, key USAGE_KEY derived from the Cloudflare token by deploy-worker.yml) — warned at
// 70% of a free allowance. meter-admin `allowances`: the watch's last reading and the notices running.
// v78: AN IDLE APP NO LONGER USES UP THE FREE ALLOWANCE, AND A USED-UP ONE IS SAID (Tony, 19 Oct 2026:
// "[Alert] KV daily operation limit exceeded … I have barely touched the application … How can I expect
// 20 beta testers to run on the same application if only my own limited use triggers blocking?").
// Measured (tools/cf-usage.js): ~270 requests an hour around the clock from about four open windows, one
// in five writing a KV rate counter — 1,107 and 1,113 KV writes on 18 and 19 Oct against 1,000. The
// per-minute ceilings are now counted in memory (no storage at all); the AI day/month ceilings and the
// video day count are in D1 (`counters`) when it is bound; the owner's device record is written at most
// hourly. A write refused because a daily allowance is used up is remembered in the other store until
// 00:00 UTC and reported: health `notices` (keyed), the owner's notes-new `server`, and a refusal's
// `notice` {what, since, until, affects}. health: `limits`.
// v77: WIKIMEDIA COMMONS FOR PHOTOS (Tony, 16 Oct 2026: "Getting pics back from Openverse takes ages …
// Perhaps we do not want to use Openverse at all?"). Measured that day from GitHub's servers: Openverse's
// search took 12.6–27.8 s every time; Wikimedia Commons searched directly took 0.26–0.55 s, with every
// thumbnail in ~0.1 s, the same openly licensed works and no key. photo-search source `wikimedia`; the
// creator and licence come with each picture (CC BY / BY-SA require them). `openverse` stays for apps
// not yet updated. photo-fetch introduces itself with the app's address (Wikimedia's rule for callers).
// v76: TRENDS (Tony, 13 Oct 2026: "I'd like to understand trends and foresee needs before they arise").
// meter-admin `trends`: every copy's counts added up by month and name (and in how many households each
// was counted), for up to 24 months — the owner's 📈 Use tab draws its month-by-month tables from it.
// A household's summary may now say how many recipes it holds (`recipes`).
// v75: LOGS GO, CORRESPONDENCE AND STATISTICS STAY, AND A SPARE OWNER KEY (Tony, 13 Oct 2026: notes and
// replies "stay for ever … as opposed to logs and other maintenance info"; keep "statistics of user
// activities"; "I wanted to give us another way of getting in"). A daily sweep (`scheduled`, cron in
// worker/wrangler.jsonc; `retentionSweep`): after 183 days a note's attached device log is dropped (the
// note stays), the owner's device records go, and a deleted household's summary and the members who left
// a household lose their names and addresses (dates and counts stay). Error reports keep their 120 days.
// Notes, replies, survey answers, usage counts and spend are never deleted by it. health:
// `retention`. The owner's address list (secret OWNER_EMAIL) may now hold a second, spare owner account,
// and the alerts go to every address in ALERT_TO (comma-separated), so neither owner acts unseen.
// v74: NO E-MAIL ADDRESS IN THE CODE. The repository is public and its text is harvested
// for addresses, so the owner's address is no longer written here as a default: it comes
// from the secret OWNER_EMAIL (set by .github/workflows/deploy-worker.yml from the GitHub
// secret of the same name) or the variable OWNER_EMAILS. With neither, nobody is the
// owner — the owner's tools are refused, never opened to anyone. health says `owner`.
// v73: THE OWNER'S POWERS, PROTECTED. Tony: "the only thing that keeps me Admin is
//      my email address … I need to protect myself". `meter-admin` (every owner
//      tool) now needs (1) a sign-in WITH GOOGLE (claims.firebase.sign_in_provider)
//      — an e-mail link or a password, which mere access to his mailbox could give,
//      is refused; (2) once he has switched it on in his copy (Firestore
//      config/security.ownerTwoStep, read with his own token), the authenticator's
//      code in that sign-in (sign_in_second_factor 'totp'); (3) for what cannot be
//      undone (OWNER_DESTRUCTIVE) a sign-in within the last 15 minutes — else 401
//      `reauth`, and the app asks him to sign in again. And he HEARS about it: the
//      first use of the owner's tools from a device (the app sends a random id kept
//      on it; table owner_devices) and every destructive action are e-mailed to
//      ALERT_TO (a Cloudflare secret, from the GitHub secret ALERT_EMAIL) through
//      the send_email binding ALERTS, from alerts@ the app's domain. Health:
//      `alerts`.
// v72: THE FAMILY MOVES INTO THE COMMUNITY COPY (Tony, 11 Oct 2026, option B).
//      `meter-admin` `copy-from` {from}: the owner's page in the community copy
//      brings another copy's households' allowances, notes, spending, reports
//      and feature counts over to its own project — same household ids (the
//      move keeps them). A household with no allowance of its own gets the one
//      its old copy gave it (the family's $10), so nothing changes for it. Rows
//      already there are kept, so it can run twice. The old rows stay.
// v71: THE END-OF-BETA QUESTION. Tony: prepare it, "but naturally, do not send
//      it". The owner opens a survey for a copy (`meter-admin` `survey-open`,
//      table `surveys`); a signed-in tester's app asks `survey-status` (is one
//      open in my copy, and have I answered?) and sends `survey-answer` — one
//      answer per person per survey, a second replaces the first (table
//      `survey_answers`). `survey-list` gives the owner every survey and its
//      answers; `survey-close` stops asking. Health: `survey`.
// v70: THE BETA'S OWN ADDRESS. Tony bought mykitchennotes.community (10 Oct
//      2026): the beta lives at its root. Its pages are allowed here (and
//      capped: an AI call from them without a sign-in is refused, as from the
//      old pages.dev address, which stays allowed while browsers still have it
//      open — it forwards to the new one).
// v69: WHAT THE TESTERS' APPS REPORT. Tony, before the beta: "let the beta's
//      run for a while and then see what we can learn". The beta and the test
//      copy send, now and then, one `app-signals` call (proved as for AI):
//      `errors` — the app's own error messages, with the screen, version,
//      device and language; kept once per person, version and wording, with a
//      count (table `app_errors`, at most 200 new ones a person a day, gone
//      after 120 days) — and `usage` — for the person's household, how many
//      times each feature was used this month: names and numbers only (table
//      `usage_counts`; membership checked). The owner's `meter-admin`: `errors`,
//      `errors-new`, `error-status`, `error-delete`; `list` gives each
//      household's `usage` for the three months it shows. Health: `signals`.
// v68: AN ANSWER TO A NOTE, IN THE SENDER'S OWN APP. Tony: "Reply in App. This
//      will send a note directly to the sender's app and will be received
//      exactly as a join request, with the red dot and all." The owner's
//      `meter-admin` `note-reply` (id, text) keeps the answer in D1
//      (METER_DB, table `feedback_replies`) for the note's writer — their
//      copy and their account, with a few words of what they wrote, so it
//      still makes sense if the note is deleted. `notes` now lists the answers
//      too. `feedback-replies` (any signed-in person, proved as for AI) gives
//      a person their own answers, and with `read: [ids]` marks those read.
//      Health: `replies`.
// v67: THE FAMILY'S COPY HAS AN ALLOWANCE TOO — $10 a month per household
//      (Tony, after a stranger's household turned up there), changeable per
//      household and pausable from 📊 Households like the beta's. AI_CAP_BY_PROJECT
//      (JSON, default {"recipes-f379d":10}) gives a copy its own allowance, with
//      no first-month extra. Only the test copy and the beta are STRICT (refuse
//      when the counting itself fails); the family's carries on then, as before.
// v66: NO AI WITHOUT A SIGN-IN, ON ANY COPY. Tony asked whether the app needs
//      hardening. The app's code is public (its GitHub repository), so the app
//      key and the family's address prove nothing: anyone could send the
//      Worker an AI request with the family's Origin header and no sign-in, and
//      the family's copy let it through, uncounted — up to the daily/monthly
//      ceilings, on any model and any size the caller chose. Now, with METER_DB
//      set, every AI call needs a Firebase sign-in that checks out AND
//      membership of the household it names; the family's copy is still
//      counted and never capped, and if only the COUNTING fails there (Firestore
//      or D1 down) a proven member carries on, as before. And only the models
//      the app uses (Sonnet and Haiku; AI_MODELS to change) at no more than
//      AI_MAX_TOKENS (32000) — so a stolen sign-in buys little.
//      SENDING STRAIGHT TO A BRING! LIST IS RETIRED (Tony: "the official sending
//      to Bring works great"). bring-add / bring-lists / bring-token-status /
//      bring-settoken answered anyone with the public app key, with the family's
//      own Bring! token — and bring-settoken's old secret is in the public
//      repository. They now answer 410. Bring!'s official import
//      (bring-recipe-page and its GET page) stays. Remove BRING_TOKEN,
//      BRING_SETTOKEN_SECRET, BRING_LIST_UUID and BRING_USER_UUID from the
//      Worker's settings, and the `accessToken` key from BRING_KV.
//      photo-fetch no longer passes SVG (a picture that can carry a script).
// v65: a household's report keeps, for each member, that they agreed to the
//      terms (termsAt, termsVersion), for the owner's 📊 Households page.
// v64: NOTES LEFT BEHIND come to the one inbox. Tony found the beta's notes
//      in the beta's own database (an app that thought the inbox was missing
//      kept them there). `meter-admin` `notes-import` (owner only) moves such
//      a note in, keeping who wrote it, when, and its copy; sent twice, it is
//      kept once. Health: `notesImport`.
// v63: A DELETED HOUSEHOLD STAYS LISTED, marked. Tony: "I would like to know
//      who deleted their account as well … do not remove these entries".
//      `household-report` `gone` (its owner only: deleting the household, or
//      their account with it) and the owner's `mark-deleted` (was `forget`)
//      keep the row and note who, when and how; `left` notes a member who
//      deleted their account. Spending is never removed.
// v62: ONE HOUSEHOLDS PAGE FOR EVERY COPY. `household-report` (a member of a
//      household, proved as for AI) keeps a short summary of it — name,
//      identifier, members, links — in D1 (METER_DB, table `hh_reports`); the
//      app sends it at most once a day. `meter-admin` list with `all: true`
//      returns every copy's households (each row says its project), set-cap
//      and set-note take a `project`, and `forget` (the owner) or a report
//      with `gone: true` (its own owner, deleting it) drops a household. Other
//      copies' rows are listed from their reports.
// v61: NOTES FROM TESTERS, ONE INBOX. `feedback-send` (any signed-in person of
//      a copy this Worker serves, proved by the Firebase sign-in) keeps the
//      app's 💬 note in D1 (METER_DB, table `feedback`, with the copy it came
//      from); the owner reads, marks and removes them through `meter-admin`
//      (notes, notes-new, note-status, note-delete) from any copy.
// v60: AI PER HOUSEHOLD (design step 3). Each AI answer's cost is counted
//      against the household that asked — proved by the person's Firebase
//      sign-in (checked against Google's keys) and their membership (read from
//      Firestore with that same sign-in) — in a D1 database (METER_DB). On the
//      test copy and the beta a household past its monthly allowance ($2; $4
//      in its first month) is refused with a friendly word. `meter-me` (a
//      household's month so far) and `meter-admin` (the management app, owner
//      only). See AI PER HOUSEHOLD below. Without METER_DB nothing changes.
// v59: CLEAN-UP after v58 found the text in the page's own data. Gone: the
//      web search for the rest of a cut-off caption (v51–v56: Gemini and
//      Claude, never found it, cost a minute's wait), and the reading test's
//      phone endpoints (`fb-probe-html`, `fb-probe-last`, KV probe:last). The
//      test keeps its server routes (`fb-probe`). A preview-only caption now
//      comes back with `cut: true` instead of a search's reasons.
// v58: THE FIX the 🔬 test found — a reel's own page, fetched by this Worker,
//      holds its WHOLE caption in the page's data (2,067 chars for Tony's
//      cake reel, not 202) as a plain string, not under "message". facebook-
//      fetch now takes the longest data string carrying the preview's opening
//      words (`probeBestText`), so the web search is no longer reached.
// v57: THE FACEBOOK READING TEST — `fb-probe` tries every server route to a
//      post's text (its page, the mobile site, the watch page, both embed
//      pages, both official embeds, and — asked for — Google's and Claude's
//      web search) and grades each: whole text, preview only, nothing.
//      `fb-probe-html` grades a page fetched or read ON THE PHONE (posted by a
//      test shortcut) and keeps the last for a day; `fb-probe-last` returns it.
// v56: the whole search for a cut-off caption has 30 s in all (Google and
//      Claude alike); Claude uses the quick web search, twice at most.
// v55: Google and Claude look for a cut-off caption AT ONCE (v54: Google said
//      "not found", then Claude ran out its 90 s — two minutes in all); Claude
//      stops when Google's answer passes, and has 70 s and fewer searches.
// v54: the whole-caption search — Google "high demand" twice moves to Google's
//      next model (v53 gave up on that way of looking instead).
// v53: the rest of a cut-off Facebook caption — Tony's v52 run said only
//      "Google is busy", yet the same model read the video a minute later:
//      Google's web search was refused, and every refusal was called "busy".
//      Now each way of looking (open the post + search; search; open) is tried
//      on its own, Google's actual answer is kept, and when Google cannot,
//      Claude looks with its own web search. Same checks for both: starts with
//      the post's words, longer than the preview, a page named as the source.
// v52: a Facebook post's address is cut down to what names the post
//      (`fbCanonical`) before anything is fetched or Google is asked; and why
//      the whole caption was not found is said FIRST, where the log keeps it.
// v51: the WHOLE caption of a Facebook post, when Facebook gives only its
//      first ~200 characters (Tony's layered-cake reel: cut mid-sentence,
//      before the recipe; the page's data did not carry the rest). Gemini is
//      asked to find it — opening the post, or searching the web for its
//      opening words — and its answer is used only if it starts with those
//      words, is longer than the preview, and Google names where it read it.
// v50: the WHOLE caption from a Facebook post's own page — its data's
//      "message" text — not only the preview's og:description, which is cut
//      short ("…") before the recipe. Tony: "it did not get to the text first".
//      A caption too short to be a recipe is still returned (`caption`), so
//      the app can say what it found.
// v49: facebook-fetch also reads the post's OWN page (same honest User-Agent):
//      its preview tags — og:description is the caption a link preview shows —
//      and the video's address (og:video or the page's own video fields), before
//      the embed pages. Tony's first reel from the iPhone Share menu was not
//      readable through the embeds alone.
// v48: THE CASCADE (Tony: try everything yourself, ask the person last).
//      - instagram-fetch: when the official embed gives no caption, the
//        public captioned-embed page (/p/<code>/embed/captioned/) — and the
//        post's video address, when the page carries one.
//      - facebook-fetch: the public embed page's video address too.
//      - `video-from-url`: a reel's VIDEO read by Gemini when its words hold no
//        recipe — downloaded here ONLY from Facebook's and Instagram's own
//        video servers (fbcdn.net, cdninstagram.com), size-capped, uploaded to
//        Gemini, read with the fixed request, deleted.
// v47: `facebook-fetch` — a public Facebook post's text from its LINK, through
//      Facebook's own public routes, so a phone needs only "Copy link": (1) a
//      share link (/share/r/…, fb.watch) is followed to the post it points
//      at; (2) Facebook's official oEmbed (oembed_post / oembed_video) — the
//      embed code websites use, whose quote holds the post's text; with
//      FB_APP_TOKEN (app-id|client-token) when Meta asks for one; (3) the
//      public embed page (plugins/post.php, plugins/video.php) that a website
//      shows in its iframe. No login, no pretending to be anyone: the same
//      honest User-Agent as every fetch here. Public posts only. Facebook
//      addresses only — never a way to fetch anything else.
// v46: Google busy is not the end. Tony's next try: "This model is currently
//      experiencing high demand". On busy / overloaded / rate-limited, the
//      Worker waits a moment and asks again, then moves to the next model
//      this key may use (Google's free limits are per model) — at most four
//      asks in all. If every one is busy, it says so as "busy, try again in a
//      minute", not as a fault.
// v45: the Gemini model is found, not assumed. Tony's first try answered
//      "no model gemini-2.5-flash" — Google retires model names. When the
//      model asked for does not exist, the Worker asks Google which models
//      THIS key may use, picks the newest general "flash" one, remembers it
//      for a day (KV) and tries again. GEMINI_MODEL still wins when set and
//      real. Google's own words are passed on in every error.
// v44: `video-file` — a VIDEO the person gives the app (a screen recording of a
//      Facebook reel, a saved TikTok, a clip sent on WhatsApp): Facebook shows
//      reels only to people signed in, and Gemini takes only YouTube LINKS, so
//      the video itself is what can be read. POST ?action=video-file with the
//      video as the body (the app key in X-App-Key, as the body is not JSON).
//      Capped (VIDEO_MAX_MB, 50), uploaded to Gemini's Files API, read with the
//      same fixed request as v43, and DELETED from Google straight after. Same
//      daily ceiling as video-recipe.
// v43: `video-recipe` — the recipe SAID and SHOWN in a YouTube video, not only
//      what its description says (a Short rarely has the recipe written down).
//      Google's Gemini takes a public YouTube link directly and writes the
//      recipe out as text; the app then reads that text as it reads any page.
//      YouTube only: the action takes a video id and builds the link itself,
//      with a fixed request — it is never a general way to reach Gemini. Needs
//      GEMINI_API_KEY (see VIDEO RECIPES below); its own daily ceiling.
// v42: `bring-recipe-page` + GET /bring-recipe/<code> — Bring!'s OFFICIAL,
//      token-free recipe import. The app stores a recipe's name and ingredient
//      lines here for 15 minutes under a random 32-hex code, then opens Bring!'s
//      import link with this page's address; Bring!'s servers read the page
//      (schema.org Recipe, microdata + JSON-LD) and the Bring! app opens with
//      the ingredients ready. Works for ANY user and their own Bring! account —
//      no token, no bookmarklet, no list id. Needs BRING_KV (already bound).
//      The page is plain text in a template, every value escaped, noindex,
//      and it holds nothing but the lines the user chose to send.
// v41: `download-store` and the `?dl=` GET are gone. They stored ANY data under
//      ANY filename and served it back from this Worker's address — a free file
//      host for anyone holding the public app key (proved in tests: it stored
//      and served `invoice.exe`). GET is a liveness check and nothing else.
// v40: `photo-fetch` — download an image's BYTES through here instead of
//      straight from the browser. Applying a chosen photo fetches from whatever
//      host the photo source returned, and Openverse federates Flickr,
//      Wikimedia, NASA and museum collections, so that set is unbounded. It is
//      the sole reason the app's CSP carries a bare `https:` in connect-src,
//      which makes the careful allowlist after it decorative (audit S2). One
//      named host instead of "anywhere" is what lets that come out. It also
//      fixes image hosts that send no CORS headers of their own. It is a
//      fetch-anything primitive, so: origin + app key + rate limit as usual,
//      plus http(s) only, must actually be an image, and capped at 12 MB.
//      Its own 600/min ceiling, because one "auto-fetch missing photos" over
//      300 recipes is 300 of these in a burst.
// v39: spend guard rails. Two separate problems in one function.
//      (a) rateLimited() wrote to KV on EVERY allowed request, against a free
//      allowance of 1,000 writes/day. One "auto-fetch missing photos" over 300
//      recipes was 300 writes in a burst; past the allowance the put threw, the
//      empty catch swallowed it, and the limiter silently stopped limiting — the
//      guard rail failed exactly when it was being leaned on. The cheap,
//      high-volume paths are now sampled (count 1 in 5, credit 5); the AI path,
//      which is rare and is the only one that spends money, is still counted
//      exactly, because that is where a write is worth it.
//      (b) There was only a per-minute ceiling. 40/min sustained is ~57,000 AI
//      calls a day on someone else's credits. There are now daily and monthly
//      ceilings on the Anthropic path (AI_DAILY_MAX / AI_MONTHLY_MAX), and that
//      path fails CLOSED when KV is bound but not answering: spend that cannot
//      be metered is the thing a ceiling exists to stop. The cheap paths still
//      fail open, and an unbound KV still allows everything — that is a
//      deployment fact rather than an attack, and `health` reports it.
// v38: fetch-url also returns `links[]`. Some round-ups contain no recipes at
//      all — ten names, ten ratings and ten links reading "to the recipe" — and
//      the text extraction turns every <a> into its label and discards the href,
//      so the app could see ten recipe names and reach none of them. The list is
//      collected from the STRIPPED html (raw html returns the whole site nav)
//      and is deliberately narrow, because it is what the app then FETCHES:
//      http(s) only, same host, no fragments, no duplicates, no self-link, max 80.
//      It must never become a way to make this Worker fetch anywhere on
//      anybody's behalf.
// v37: two regressions from the hardening releases, both found by Tony, neither
//      caught by tests. (a) The Anthropic proxy forwarded the body verbatim
//      INCLUDING the `appKey` v35 put there, and Anthropic rejects unknown
//      top-level fields — every AI feature returned 400 "Extra inputs are not
//      permitted". (b) web.getbring.com was missing from the v34 origin
//      allowlist, so the Bring! bookmarklet got "Failed to fetch".
// v36: CORS applied centrally in the fetch wrapper. v34 left 43 of 51 jsonResp
//      calls returning Allow-Origin: null, which the browser rejects — every
//      feature reported "could not be reached from this device".
// v35: the app key is read from the request BODY (header still accepted). A
//      custom header forces a CORS preflight that only v34+ allows, so an app
//      sending it could not reach an older Worker at all — that took every
//      server feature down in v31.1 until this Worker was deployed.
// v34: access control — origin allowlist, X-App-Key, KV rate limiting, and the
//      hard-coded bring-settoken fallback secret removed. Adds an open `health`
//      action so the app can tell "down" from "refusing me".
// v33: photo-search reports a 429 as a rate limit instead of "invalid JSON".
// v32: instagram-fetch rebuilt on Meta's tokenless oEmbed (public again since
//      15 Jun 2026). Mines the embed blockquote for a caption fragment and
//      flags `partial` when what came back is too short to be a recipe.
// v31: bring-token-status — the app now asks the Worker for the token's real
//      expiry (and can probe the live API) instead of trusting a per-device
//      localStorage copy that goes stale after a refresh on another device
// v30: no secrets in source — Bring! token/API key/UUIDs now come from Worker
//      environment variables or KV (see BRING SETUP below)
// v29: multi-source photo search (Pixabay + Pexels + Unsplash)
// Prior: YouTube Data API, Instagram oEmbed, KV file-download store
//
// ── BRING! (v66) ─────────────────────────────────────────────────────────────
// Only Bring!'s official import is served (bring-recipe-page, and the GET page
// Bring!'s servers read; BRING_KV holds those pages for 15 minutes). Sending
// straight to a list is retired, so BRING_TOKEN, BRING_API_KEY, BRING_LIST_UUID,
// BRING_USER_UUID and BRING_SETTOKEN_SECRET are no longer read — remove them.
//
// ── VIDEO RECIPES (v43, optional) ────────────────────────────────────────────
//   GEMINI_API_KEY  – a key from https://aistudio.google.com/apikey . Leave the
//                     key's project WITHOUT billing: Google's free allowance
//                     then simply refuses once it is used up, so a leaked app
//                     key can never turn into a bill.
//   GEMINI_MODEL    – optional; the model that watches the video
//                     (default below). Change it if Google retires that one.
//   VIDEO_DAILY_MAX – optional; videos per UTC day, all callers (60).
//   VIDEO_MAX_MB    – optional; the largest video file accepted (50).
// Without the key, the app keeps its "paste the text / screenshots" answer.
//
// ── SPEND CEILINGS (v39, optional) ───────────────────────────────────────────
// Both have working defaults, so neither has to be set:
//   AI_DAILY_MAX    – Anthropic calls allowed per UTC day, all callers (300)
//   AI_MONTHLY_MAX  – …and per UTC calendar month (3000)
// They are the ceiling on the API bill if the app key ever leaks. Raise them if
// a real day's use gets close; `health` reports the current counts to a caller
// that presents the app key.
//
// ── WHAT AN AI CALL MAY ASK FOR (v66, optional) ──────────────────────────────
//   AI_MODELS       – model name beginnings allowed, comma-separated
//                     (default: claude-sonnet-,claude-haiku-). Add a family
//                     here if the app's AI_MODEL / AI_MODEL_SMALL ever moves to it.
//   AI_MAX_TOKENS   – the longest answer one call may ask for (32000; the
//                     app's largest, reading several recipes at once, asks 8000).

const WORKER_VERSION = 'v93';
const VIDEO_MAX_MB_DEFAULT = 50;
const GEMINI_API = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL_DEFAULT = 'gemini-2.5-flash';
const VIDEO_DAILY_DEFAULT = 60;
const VIDEO_RECIPE_PROMPT =
  'This is a cooking video. Write down its recipe from everything in it: what is said, '
  + 'the text shown on screen, the video\'s description, and what is done. Give the name '
  + 'of the dish, every ingredient with its amount, and the steps in order (and for a '
  + 'recipe in parts, each part with its own ingredients and steps). Keep the video\'s own '
  + 'language — do not translate. Where an amount is neither said nor shown, write the '
  + 'ingredient without one: never guess a quantity. Plain text only. If there is no '
  + 'recipe in the video, answer exactly: NO RECIPE';
// ─── Access control (v34) ───────────────────────────────────────────────────
// This Worker forwards to the Anthropic API on Tony's key, and its URL ships in
// index.html, which is a public repo. With `Access-Control-Allow-Origin: *`, no
// auth and no rate limit, anyone who found the URL could spend his credits.
//
// Three controls, because no single one is sufficient:
//   1. ORIGIN ALLOWLIST — stops any other website's JS from using it. Does not
//      stop curl, which simply omits Origin.
//   2. SHARED APP KEY — stops trivial scripted abuse. Honest limitation: the key
//      ships in the client, so anyone reading the page source can copy it. It
//      raises the bar; it is not a secret.
//   3. RATE LIMIT — the one that actually bounds the damage, and the only one
//      that works against someone who has read the source.
const DEFAULT_ORIGINS = [
  'https://rozinante2004-hash.github.io',
  // The Bring! bookmarklet runs ON web.getbring.com and POSTs `bring-settoken`
  // here from that page, so this origin is as load-bearing as the app's own.
  // v34 added the allowlist without it: the browser saw Allow-Origin: null and
  // the bookmarklet could only report "Failed to fetch", which reads like the
  // Worker is down rather than refusing the caller.
  'https://web.getbring.com',
  'http://localhost:8137',
  'http://127.0.0.1:8137',
  // v60 — the beta copy (design step 5); the test copy comes in ALLOWED_ORIGINS.
  'https://my-kitchen-notes-beta.pages.dev',
  // v70 — the beta's own address (its old one above forwards there).
  'https://mykitchennotes.community',
];
function allowedOrigins(env) {
  const extra = (env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  return DEFAULT_ORIGINS.concat(extra);
}
function originAllowed(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return null;                      // no Origin (curl, server-side) — see appKeyOk
  return allowedOrigins(env).includes(origin) ? origin : false;
}
function corsFor(request, env) {
  const o = originAllowed(request, env);
  // v40 — no Content-Type here. This object is stamped on EVERY response by the
  // fetch wrapper, so declaring JSON in it relabelled the binary paths as
  // application/json: the KV file download has been served that way since v36,
  // and photo-fetch would have handed the app an "image" the browser refuses to
  // decode. jsonResp sets its own Content-Type, so nothing loses one.
  return {
    // Never echo an origin we did not allow, and never fall back to '*'.
    'Access-Control-Allow-Origin': (typeof o === 'string' && o) ? o : 'null',
    'Vary': 'Origin',
  };
}
// The key arrives in the BODY, with the header still accepted for compatibility.
// A custom request header forces a CORS preflight, and v34's OPTIONS reply is the
// only one that allows X-App-Key — so an app sending the header could not talk to
// an older Worker AT ALL. That ordering dependency took the whole app down once
// (v31.1) and must not be able to again: a body field needs no preflight change,
// so old app + new Worker and new app + old Worker both work.
function appKeyOk(request, env, body) {
  const expected = env.APP_SHARED_KEY || '';
  if (!expected) return true;                    // not configured — fail open, reported by health
  const supplied = (body && body.appKey) || request.headers.get('X-App-Key') || '';
  return supplied === expected;
}

// ─── SPEND GUARD RAILS (v39) ─────────────────────────────────────────────────
// Cloudflare's free tier allows 1,000 KV WRITES a day (reads are 100,000, so
// reading is not the constraint — writing is). v38 wrote once per allowed
// request. The cheap paths are the high-volume ones, so those are the writes
// that ran the allowance down, and the failure was silent in the worst possible
// way: the put threw, an empty catch swallowed it, and the limiter kept saying
// "not limited" for the rest of the day.
//
// So: sample the cheap path, count the expensive one exactly. Photo browsing is
// counted 1 request in 5 and credited 5, which is accurate enough to bound a
// runaway and costs a fifth of the writes. The Anthropic path is rare — a few
// dozen calls on a busy day — and is the only one that spends real money, so it
// still gets an exact count. Worst case at the daily ceiling is ~700 writes,
// inside the allowance, and ordinary family use is a tenth of that.
//
// v78 — and the per-minute half of that went too far. 18–19 Oct 2026: four app
// windows left open on a desk asked this Worker ~270 times an hour, night and
// day (v38.49 had made an open app ask every two minutes); one request in five
// wrote a KV counter, and the account's 1,000 writes a day were gone by evening
// on both days — "[Alert] KV daily operation limit exceeded" while Tony had
// barely touched the app. So the PER-MINUTE ceilings are now counted in this
// isolate's memory, which costs nothing: a runaway is one caller hammering, and
// that lands on one isolate. The DAY and MONTH ceilings on the money path (and
// the video day count) go to D1 when it is bound — exact, one statement, and
// 100,000 writes a day on the free plan — and stay in KV otherwise (tests, a
// bare deployment). An ordinary request now writes nothing anywhere.
const KV_SAMPLE_MONTH = 10;   // KV only: the monthly total is a coarse guard rail (D1 counts it exactly)
// v81 — Tony (20 Oct 2026), for 20 testers: 1,000 a day and 10,000 a month (were 300 and 3,000). Each household's
// own monthly allowance (meterStart) still caps the bill; these only stop a runaway across everyone.
const AI_DAILY_DEFAULT = 1000;     // Anthropic calls per day, all callers
const AI_MONTHLY_DEFAULT = 10000;  // …and per calendar month

// Isolate-scoped circuit breaker. A Worker isolate is short-lived and there are
// many of them, so this is not a global truth — it does not need to be. Its job
// is that once writes start failing in THIS isolate, the money-spending path
// stops immediately instead of running unmetered until the isolate is recycled.
// v78 — it holds WHEN the last write failed, and lets one call try again after
// five minutes: nothing else writes a counter any more, so nothing else would
// ever find out that the store works again.
let _ceilingWritesFailing = 0;
const CEILING_RETRY_MS = 5 * 60e3;

function utcDayKey(now)   { return new Date(now).toISOString().slice(0, 10); }  // YYYY-MM-DD
function utcMonthKey(now) { return new Date(now).toISOString().slice(0, 7); }   // YYYY-MM
function nextUtcMidnight(now) { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); }

function ceilingResp(what, used, cap) {
  // Say whose ceiling this is. "Rate limited" with no owner sends the reader to
  // Anthropic's status page to debug a limit that was set in this file.
  return jsonResp({
    error: 'SPEND_CAP: this Worker\'s own ' + what + ' ceiling for AI calls has been reached ('
      + used + '/' + cap + '). Nothing is wrong with the app or with Anthropic — this is the '
      + 'guard rail on the API bill. Raise ' + (what === 'daily' ? 'AI_DAILY_MAX' : 'AI_MONTHLY_MAX')
      + ' in the Worker\'s variables, or wait for it to reset.',
    rateLimited: true, spendCap: what
  }, 429);
}

// v78 — per caller per minute, in memory. Old minutes are swept once the map grows.
const _minuteCounts = new Map();
function minuteCount(key, bucket) {
  let e = _minuteCounts.get(key);
  if (!e || e.bucket !== bucket) {
    if (_minuteCounts.size > 5000) for (const [k, v] of _minuteCounts) if (v.bucket !== bucket) _minuteCounts.delete(k);
    e = { bucket, n: 0 };
    _minuteCounts.set(key, e);
  }
  return ++e.n;
}

// Read a ceiling counter, decide, then credit it. Returns the value it read.
// D1 when bound (exact), else KV (sampled where `sample` > 1).
const _tablesMade = new WeakMap();   // database → names of the tables already made in this isolate
async function tableOnce(db, name, sql) {
  let made = _tablesMade.get(db);
  if (!made) { made = new Set(); _tablesMade.set(db, made); }
  if (made.has(name)) return;
  await db.prepare(sql).run();
  made.add(name);
}
async function ceilingCount(env, key, ttlSec, sample) {
  const db = env.METER_DB;
  if (db) {
    await tableOnce(db, 'counters', 'CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, until INTEGER)');
    const row = await db.prepare('SELECT n FROM counters WHERE k = ?1').bind(key).first();
    const used = (row && Number(row.n)) || 0;
    return { used, credit: async () => {
      try {
        await db.prepare('INSERT INTO counters (k, n, until) VALUES (?1, 1, ?2) ON CONFLICT (k) DO UPDATE SET n = n + 1')
          .bind(key, Date.now() + ttlSec * 1000).run();
        _ceilingWritesFailing = 0;
      } catch (e) { _ceilingWritesFailing = Date.now(); await noteServerLimit(env, 'd1', e); }
    } };
  }
  const kv = env.BRING_KV;
  const used = parseInt(await kv.get(key) || '0', 10) || 0;
  return { used, credit: async () => {
    if (sample > 1 && Math.random() >= 1 / sample) return;   // sampled out — no write
    try {
      await kv.put(key, String(used + sample), { expirationTtl: ttlSec });
      _ceilingWritesFailing = 0;   // writes work again — let the AI path back in
    } catch (e) { _ceilingWritesFailing = Date.now(); await noteServerLimit(env, 'kv', e); }
  } };
}

// KV and D1 are eventually consistent across isolates, so all of this is
// approximate — which is fine: the job is to bound a runaway, not to meter precisely.
async function rateLimited(request, env, action) {
  // The AI path (no action) is the expensive one; browsing photos is cheap.
  const costly = !action || action === 'ai' || action === 'instagram-fetch' || action === 'video-recipe' || action === 'video-from-url';
  // Narrower than `costly`: instagram-fetch is slow but it does not spend
  // Anthropic credits, so it must not eat into the AI ceilings.
  const aiSpend = !action || action === 'ai';

  const now = Date.now();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // photo-fetch (v40) gets its own, much higher ceiling. "Auto-fetch missing
  // photos" across 300 recipes is 300 of these in a burst, and 150/min would
  // refuse half of them — the request costs bandwidth and nothing else, so the
  // limit only needs to bound a runaway, not to ration ordinary use.
  const photoBytes = action === 'photo-fetch';
  const limit = parseInt(env.RATE_LIMIT || '', 10)
    || (photoBytes ? 600 : costly ? 40 : 150);
  const windowSec = 60;
  const bucket = Math.floor(now / 1000 / windowSec);
  const n = minuteCount(ip + (costly ? ':ai' : photoBytes ? ':ph' : ':x'), bucket);
  if (n > limit) {
    return jsonResp({ error: 'RATE_LIMIT: too many requests in the last minute (' + (n - 1) + '/' + limit
      + '). Wait a minute and try again.', rateLimited: true, retryAfter: windowSec }, 429);
  }
  if (!aiSpend) return null;

  // No store bound at all is a DEPLOYMENT fact, not an attack — there is
  // nothing to count in, and breaking the family's app to punish a hypothetical
  // abuser is the wrong trade. `health` reports rateLimiting:false so it is
  // visible rather than silent.
  if (!env.METER_DB && !env.BRING_KV) return null;

  // If writes are known to be failing in this isolate we cannot meter, and
  // unmeterable spend is the thing these ceilings exist to stop.
  if (_ceilingWritesFailing && now - _ceilingWritesFailing < CEILING_RETRY_MS) {
    const store = env.METER_DB ? 'd1' : 'kv';
    const notice = (await serverNotices(env)).filter(function (x) { return x.what === store; })[0] || null;
    return jsonResp({ error: 'RATE_LIMIT: AI features are paused: the server cannot record AI calls just now — '
      + 'usually because its free daily allowance for storage writes (' + (store === 'd1' ? 'D1 database' : 'KV')
      + ' write allowance) is used up. Everything that does not call the AI still works.', rateLimited: true, paused: true,
      notice }, 429);
  }

  // Daily and monthly ceilings, on the Anthropic path only and across ALL
  // callers — an IP is free to change, an API bill is not. A per-minute limit
  // alone allows ~57,000 calls a day on Tony's credits.
  const dayMax = parseInt(env.AI_DAILY_MAX || '', 10) || AI_DAILY_DEFAULT;
  const monMax = parseInt(env.AI_MONTHLY_MAX || '', 10) || AI_MONTHLY_DEFAULT;
  let day, mon;
  try {
    day = await ceilingCount(env, 'rl:day:' + utcDayKey(now), 60 * 60 * 48, 1);
    mon = await ceilingCount(env, 'rl:mon:' + utcMonthKey(now), 60 * 60 * 24 * 40, KV_SAMPLE_MONTH);
  } catch (e) {
    // The store is bound but not answering. Refuse the one path that spends money.
    return jsonResp({ error: 'RATE_LIMIT: the spend guard rail is not answering, so AI requests '
      + 'are paused rather than run unmetered. Everything that does not call the AI still works.',
      rateLimited: true, paused: true }, 429);
  }
  if (day.used >= dayMax || mon.used >= monMax) {
    const daily = day.used >= dayMax;
    await raiseNotice(env, { what: daily ? 'ai-day' : 'ai-month', kind: 'paused', scope: 'all', self: true,   // v79
      until: daily ? nextUtcMidnight(now) : nextUtcMonth(now),
      title: 'The server\'s ' + (daily ? 'daily' : 'monthly') + ' ceiling on AI calls (' + (daily ? dayMax : monMax) + ') was reached',
      affects: 'AI features (reading recipes, translating, suggestions)',
      detail: 'This is the guard rail on the Anthropic bill. Raise ' + (daily ? 'AI_DAILY_MAX' : 'AI_MONTHLY_MAX')
        + ' in the Worker\'s variables if the use is real, or wait for it to reset (' + (daily ? '00:00 UTC' : 'the 1st, UTC') + ').' });
    return daily ? ceilingResp('daily', day.used, dayMax) : ceilingResp('monthly', mon.used, monMax);
  }
  await day.credit();
  await mon.credit();
  return null;
}

// What the ceilings currently read. Only shown to a caller that presented the
// app key — `health` itself is open on purpose, and the counts are none of an
// anonymous caller's business.
async function spendStatus(env) {
  const out = {
    dailyMax:   parseInt(env.AI_DAILY_MAX || '', 10) || AI_DAILY_DEFAULT,
    monthlyMax: parseInt(env.AI_MONTHLY_MAX || '', 10) || AI_MONTHLY_DEFAULT,
    dailyUsed: null, monthlyUsed: null
  };
  if (!env.METER_DB && !env.BRING_KV) return out;
  const now = Date.now();
  try {
    out.dailyUsed   = (await ceilingCount(env, 'rl:day:' + utcDayKey(now), 0, 1)).used;
    out.monthlyUsed = (await ceilingCount(env, 'rl:mon:' + utcMonthKey(now), 0, 1)).used;
  } catch (e) {}
  return out;
}

// ─── ALLOWANCES: SAID IN THE APP, E-MAILED TO THE OWNER (v78, v79) ──────────
// Tony, 19 Oct 2026: "I did not receive any indication from the application that
// there is a problem or that any service is denied. I should get such
// notification from the app itself." And: "Please make sure the Admin gets a
// notification if any allowance is exceeded or blocked."
//
// A notice is { what, kind: 'paused'|'warning', scope: 'all'|'owner', project,
// since, until, title, affects, detail, self }. It is kept where it survives the
// thing that ran out — D1 `allowance_notices`, or KV `notice:d1` when D1 is what
// ran out — read before it is written, so many isolates do not each write it.
// Everyone in that copy hears a 'all' one (health), the owner hears all of them
// (notes-new, every few minutes while he is about), and the owner is e-mailed
// (ALERT_TO) the first time — then at most once a day for the same thing.
// Sources: KV and D1 writes refused (v78); the AI ceilings; Anthropic refusing
// (credit, key); Google's video allowance; a household's AI allowance; the apps'
// own reports of Firebase's daily limits (limit-report); the hourly usage watch
// (usage-report, .github/workflows/cf-usage.yml), which warns at 70%.
const NOTICE_MAIL_GAP_MS = 20 * 3600e3;
// what → notice + savedAt, in this isolate, per store (a test's databases do not share it)
const _noticeMem = new WeakMap(), NO_STORE = {};
function noticeMem(env) {
  const k = env.METER_DB || env.BRING_KV || NO_STORE;
  let m = _noticeMem.get(k);
  if (!m) { m = {}; _noticeMem.set(k, m); }
  return m;
}
function isLimitError(e) { return /limit|exceed|quota|too many|429/i.test(String((e && e.message) || e || '')); }
function nextUtcMonth(now) { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
// Firebase's daily limits end at midnight in California.
function nextPacificMidnight(now) {
  try {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(now))
      .forEach(function (x) { p[x.type] = x.value; });
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const offset = wall - Math.floor(now / 1000) * 1000;                     // the Pacific wall clock minus UTC
    return Date.UTC(+p.year, +p.month - 1, +p.day + 1) - offset;
  } catch (e) { return nextUtcMidnight(now) + 8 * 3600e3; }
}
// v83 — Firebase's day (it ends at midnight in California), as YYYY-MM-DD.
function pacificDayKey(now) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); }
  catch (e) { return new Date(now - 8 * 3600e3).toISOString().slice(0, 10); }
}
function ilTime(t) {
  try { return new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return new Date(t).toUTCString(); }
}
// What a used-up store stops, in words a person can act on. With D1 bound the AI
// counters are there, so a used-up KV allowance only touches Bring!.
function storeNotice(env, what, err) {
  const d1 = what === 'd1';
  return { what, kind: 'paused', scope: 'all', until: nextUtcMidnight(Date.now()), self: true,
    title: d1 ? 'Cloudflare\'s free daily allowance for the database (D1) is used up'
              : 'Cloudflare\'s free daily allowance of 1,000 storage (KV) writes is used up',
    affects: d1 ? 'AI features, notes to the app owner and their replies, and usage statistics'
         : env.METER_DB ? 'sending a shopping list to Bring!'
         : 'AI features (reading recipes, translating, suggestions) and sending to Bring!',
    detail: 'It comes back by itself at 00:00 UTC (03:00 Israel time in summer). ' + String((err && err.message) || err || '').slice(0, 160) };
}
async function noteServerLimit(env, what, err) {
  if (!isLimitError(err)) return;          // a passing fault is not "used up until midnight"
  await raiseNotice(env, storeNotice(env, what, err));
}
// v86 — what is worth an e-mail (and a WhatsApp): a new episode, one that now ends later, or one turning for the worse
// (now paused). New figures in a running one are only written, so the app shows them.
// A turn for the worse is mailed even within a day of the last mail (the 70% warning came first, the same day).
function newsToMail(have, n, now, mailedAt) {
  const running = have && Number(have.until) > now;
  if (running && n.kind === 'paused' && (have.kind || 'paused') !== 'paused') return true;
  return (!running || Number(have.until) !== n.until) && !(Number(mailedAt) > now - NOTICE_MAIL_GAP_MS);
}
async function raiseNotice(env, n) {
  const now = Date.now();
  n = Object.assign({ kind: 'paused', scope: 'all', project: '', since: now, title: '', affects: '', detail: '', self: true }, n);
  n.until = Number(n.until) || nextUtcMidnight(now);
  const _notices = noticeMem(env), cur = _notices[n.what];
  const sameWords = function (h) { return h && (h.kind || 'paused') === n.kind && (h.title || '') === n.title && (h.detail || '') === n.detail && (h.affects || '') === n.affects; };
  if (cur && cur.until === n.until && sameWords(cur) && now - cur.savedAt < 10 * 60e3) return false;
  if (cur && cur.until > now) n.since = cur.since;
  _notices[n.what] = Object.assign({}, n, { savedAt: now });
  let mail = false, kept = false;
  const db = n.what !== 'd1' ? env.METER_DB : null;
  if (db) {
    try {
      await tableOnce(db, 'allowance_notices', 'CREATE TABLE IF NOT EXISTS allowance_notices (what TEXT PRIMARY KEY, kind TEXT, scope TEXT, '
        + 'project TEXT, since INTEGER, until INTEGER, title TEXT, affects TEXT, detail TEXT, self INTEGER, mailed_at INTEGER)');
      const have = await db.prepare('SELECT since, until, mailed_at, kind, title, affects, detail FROM allowance_notices WHERE what = ?1').bind(n.what).first();
      if (have && Number(have.until) === n.until && sameWords(have)) { _notices[n.what].since = Number(have.since); return false; }
      if (have && Number(have.until) > now) n.since = Number(have.since);   // the same episode, now ending later or in other words
      _notices[n.what].since = n.since;
      // v86 — new figures in the same episode are written, not mailed; a turn for the worse (now paused) is mailed
      mail = newsToMail(have, n, now, have && have.mailed_at);
      await db.prepare('INSERT INTO allowance_notices (what, kind, scope, project, since, until, title, affects, detail, self, mailed_at) '
        + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT (what) DO UPDATE SET kind = excluded.kind, scope = excluded.scope, '
        + 'project = excluded.project, since = excluded.since, until = excluded.until, title = excluded.title, affects = excluded.affects, '
        + 'detail = excluded.detail, self = excluded.self, mailed_at = excluded.mailed_at')
        .bind(n.what, n.kind, n.scope, n.project, n.since, n.until, n.title, n.affects, n.detail, n.self ? 1 : 0,
              mail ? now : (have ? have.mailed_at : null)).run();
      kept = true;
    } catch (e) { mail = false; }
  }
  if (!kept && env.BRING_KV && (n.what === 'd1' || !db)) {
    try {
      const key = 'notice:' + n.what;
      const have = JSON.parse(await env.BRING_KV.get(key) || 'null');
      if (have && have.until === n.until && sameWords(have)) { _notices[n.what].since = have.since; return false; }
      if (have && have.until > now) n.since = have.since;
      _notices[n.what].since = n.since;
      mail = newsToMail(have, n, now, have && have.mailedAt);
      await env.BRING_KV.put(key, JSON.stringify(Object.assign({}, n, { mailedAt: mail ? now : (have && have.mailedAt) || 0 })),
        { expiration: Math.floor(Math.max(n.until, now + 120e3) / 1000) + 60 });
      kept = true;
    } catch (e) { mail = false; }
  }
  if (mail) {
    try {
      await ownerAlert(env, 'My Kitchen Notes: ' + (n.kind === 'paused' ? 'paused' : 'warning') + ' - ' + n.title,
        [n.title + '.', '',
         n.affects ? (n.kind === 'paused' ? 'What stops: ' : 'What it touches: ') + n.affects + '.' : '',
         n.detail, '',
         'Since: ' + ilTime(n.since) + ' (Israel time)',
         n.kind === 'warning' ? 'Resets: ' + ilTime(n.until)
           : n.self ? 'Comes back by itself: ' + ilTime(n.until) : 'Looked at again: ' + ilTime(n.until) + ' — it needs you to act (see above).',
         n.project ? 'Copy: ' + n.project : '', '',
         'The app shows this too (a bar at the top). You will not be e-mailed about this again for a day.'
        ].join('\n').replace(/\n{3,}/g, '\n\n'), { kind: alertKindOf(n) });   // v85
    } catch (e) {}
  }
  return true;
}
// The notices that are still running. `owner` sees every one; anyone else only
// those for everyone, in their own copy (or the server's own).
async function serverNotices(env, opts) {
  opts = opts || {};
  const now = Date.now(), out = {}, _notices = noticeMem(env);
  const take = function (n) {
    if (!n || !(Number(n.until) > now) || out[n.what]) return;
    if (!opts.owner && (n.scope !== 'all' || (n.project && opts.project && n.project !== opts.project))) return;
    out[n.what] = { what: n.what, kind: n.kind || 'paused', scope: n.scope || 'all', project: n.project || '', since: Number(n.since),
      until: Number(n.until), title: n.title || '', affects: n.affects || '', detail: opts.owner ? (n.detail || '') : '', self: !!(n.self === true || n.self === 1) };
  };
  Object.keys(_notices).forEach(function (w) { take(_notices[w]); });
  if (env.METER_DB) {
    try {
      const r = await env.METER_DB.prepare('SELECT what, kind, scope, project, since, until, title, affects, detail, self FROM allowance_notices WHERE until > ?1')
        .bind(now).all();
      ((r && r.results) || []).forEach(take);
    } catch (e) { /* no table yet: nothing has ever run out */ }
  }
  if (env.BRING_KV && !out.d1) {
    try { take(JSON.parse(await env.BRING_KV.get('notice:d1') || 'null')); } catch (e) {}
  }
  return Object.keys(out).map(function (w) { return out[w]; });
}

// The apps' own word on Firebase's daily limits (v79). A Firestore refusal comes
// from a signed-in person and is told to everyone in that copy; "no more sign-in
// e-mails today" comes before anyone is signed in, so it goes to the owner only.
const LIMIT_REPORTS = {
  firestore: { scope: 'all', needSignIn: true, title: 'Firebase\'s free daily allowance for the database (Firestore) is used up',
    affects: 'saving to and reading from the cloud (changes stay on each device and go up when it comes back)',
    detail: 'Firestore\'s free plan allows 50,000 reads, 20,000 writes and 20,000 deletes a day; it comes back at midnight California time. '
      + 'If it happens again, look at Firebase → Usage, or move the project to the Blaze plan.' },
  'auth-email': { scope: 'owner', needSignIn: false, kind: 'warning',
    title: 'Firebase sent its last sign-in e-mail for today',
    affects: 'signing in with an e-mailed link (Google and passwords still work)',
    detail: 'Firebase\'s free plan sends 5 sign-in-link e-mails a day for the whole project (Blaze: 25,000); it comes back at midnight California time.' }
};
async function limitReport(request, env, body) {
  const kind = LIMIT_REPORTS[String(body.what || '')];
  const project = String(body.project || '').slice(0, 64);
  if (!kind || !csvList(env.METER_PROJECTS, METER_PROJECTS_DEFAULT).includes(project)) return jsonResp({ error: 'LIMIT: what, and which copy?' }, 400);
  if (kind.needSignIn) {
    let claims = null;
    try { claims = await verifyIdToken(body.idToken, env); } catch (e) {}
    if (!claims || claims.aud !== project) return jsonResp({ error: 'LIMIT: sign in first.' }, 401);
  }
  if (body.what === 'auth-email') await linkCount(env, project, true);   // v87
  const n = { what: body.what + ':' + project, kind: kind.kind || 'paused', scope: kind.scope, project, until: nextPacificMidnight(Date.now()),
    title: kind.title + ' (' + project + ')', affects: kind.affects, detail: kind.detail, self: true };
  await raiseNotice(env, n);
  // Told back to the app only when it is everyone's to know; "sign-in e-mails" is the owner's.
  const told = kind.scope === 'all' ? (await serverNotices(env, { project })).filter(function (x) { return x.what === n.what; })[0] || null : null;
  return jsonResp({ ok: true, notice: told });
}

// v87 — the sign-in-link e-mails Firebase's free plan sends: 5 a day for the whole project, and it does not say how
// many it has sent. Each app says each link it asked for (before anyone is signed in, so no sign-in here: a ceiling
// instead — a forged count can only raise a warning); a refusal is counted from limit-report. Kept 40 days.
const LINK_FREE_A_DAY = 5, LINK_COUNT_CAP = 50, LINK_DAYS_KEPT = 40;
async function linkCount(env, project, refused) {
  if (!env.METER_DB) return null;
  try {
    const db = env.METER_DB, now = Date.now(), key = (refused ? 'linksno:' : 'links:') + project + ':' + pacificDayKey(now);
    await tableOnce(db, 'counters', 'CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, until INTEGER)');
    const row = await db.prepare('SELECT n FROM counters WHERE k = ?1').bind(key).first();
    const had = (row && Number(row.n)) || 0;
    if (had >= LINK_COUNT_CAP) return had;
    await db.prepare('INSERT INTO counters (k, n, until) VALUES (?1, 1, ?2) ON CONFLICT (k) DO UPDATE SET n = n + 1')
      .bind(key, now + LINK_DAYS_KEPT * 864e5).run();
    return had + 1;
  } catch (e) { return null; }
}
async function linkSent(request, env, body) {
  const project = String(body.project || '').slice(0, 64);
  if (!csvList(env.METER_PROJECTS, METER_PROJECTS_DEFAULT).includes(project)) return jsonResp({ error: 'LINK: which copy?' }, 400);
  const today = await linkCount(env, project, false);
  if (today === LINK_FREE_A_DAY - 1) {
    const now = Date.now();
    await raiseNotice(env, { what: 'usage:signinLinks:' + project, kind: 'warning', scope: 'owner', until: nextPacificMidnight(now), self: true,
      title: 'Firebase sign-in-link e-mails: ' + today + ' of the ' + LINK_FREE_A_DAY + ' it sends a day (' + project + ')',
      affects: 'signing in with an e-mailed link (passwords and Google still work)',
      detail: 'One more today, then Firebase sends no more links until ' + ilTime(nextPacificMidnight(now)) + ' (Israel time). '
        + 'If this keeps happening, the Blaze plan sends 25,000 a day. From the apps\u2019 own count of the links they asked for.' });
  }
  return jsonResp({ ok: true, today: today == null ? undefined : today });
}
async function linkStats(env) {
  if (!env.METER_DB) return null;
  try {
    const rows = (await env.METER_DB.prepare("SELECT k, n FROM counters WHERE k LIKE 'links:%' OR k LIKE 'linksno:%'").all()).results || [];
    const today = pacificDayKey(Date.now()), since = pacificDayKey(Date.now() - 30 * 864e5), by = {};
    rows.forEach((r) => {
      const [kind, project, day] = String(r.k).split(':'), n = Number(r.n) || 0;
      if (!project || !day || day < since) return;
      const p = by[project] || (by[project] = { today: 0, most: 0, full: 0, refused: 0, days: 0 });
      if (kind === 'linksno') { p.refused++; return; }
      if (day === today) p.today = n;
      p.most = Math.max(p.most, n); p.days++;
      if (n >= LINK_FREE_A_DAY) p.full++;
    });
    return { limit: LINK_FREE_A_DAY, byProject: by };
  } catch (e) { return null; }
}

// The hourly usage watch (v79). The workflow measures the account's day so far
// and says it here; at 70% of a free allowance the owner is warned. Its key is
// derived from the Cloudflare token both sides already hold (deploy-worker.yml
// sets USAGE_KEY), so nothing new has to be kept anywhere.
const USAGE_NAMES = {
  workerRequests: 'Worker requests', kvWrites: 'KV writes', kvReads: 'KV reads', kvDeletes: 'KV deletes', kvLists: 'KV lists',
  d1RowsWritten: 'D1 rows written', d1RowsRead: 'D1 rows read', pagesBuilds: 'Pages builds',
  firestoreReads: 'Firestore reads', firestoreWrites: 'Firestore writes', firestoreDeletes: 'Firestore deletes'
};
function sameText(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
async function usageReport(env, body) {
  if (!env.USAGE_KEY || !sameText(body.key, env.USAGE_KEY)) return jsonResp({ error: 'FORBIDDEN' }, 403);
  return jsonResp({ ok: true, warned: await usageEvaluate(env, body.metrics || {}) });
}
// v86 — whose allowance, in plain words, and what each Pages project is to Tony.
const USAGE_SERVICE = { firestoreReads: 'Firebase', firestoreWrites: 'Firebase', firestoreDeletes: 'Firebase' };
const PAGES_COPIES = { 'my-kitchen-notes-beta': 'the community app', 'tonys-recipes-test': 'the test copy' };
function usageWords(k, x, now) {
  const used = Math.max(0, Number(x.used) || 0), limit = Number(x.limit), pct = Math.round(100 * used / limit);
  const month = x.period === 'month', pacific = x.period === 'pacific-day';   // Firebase's day ends at midnight in California
  const until = month ? nextUtcMonth(now) : pacific ? nextPacificMidnight(now) : nextUtcMidnight(now);
  const n = (v) => Number(v).toLocaleString('en-US');
  const restarts = 'The count starts again on ' + ilTime(until) + ' (Israel time).';
  const who = 'From the usage watch, which reads ' + (k.indexOf('firestore') === 0 ? 'Firebase' : 'Cloudflare') + '\u2019s own figures several times a day.';
  if (k === 'pagesBuilds') {
    const per = Object.keys(x.per || {}).filter((p) => Number(x.per[p]) > 0).map((p) => (PAGES_COPIES[p] || p) + ' ' + n(x.per[p]));
    const refused = used >= limit && x.lastOk === false;
    return { until, kind: refused ? 'paused' : 'warning',
      title: 'Cloudflare Pages: ' + n(used) + ' builds this month' + (used >= limit ? ', over the ' + n(limit) + ' the free plan includes (' + pct + '%)'
        : ', ' + pct + '% of the ' + n(limit) + ' the free plan includes'),
      affects: 'publishing new versions of the community app and the test copy (the family app is published by GitHub, not affected)',
      detail: [per.length ? 'Builds: ' + per.join(', ') + '.' : '',
        refused ? 'Cloudflare refused the latest build: both copies keep running the version they have, and new versions wait until the count starts again.'
          : used >= limit ? (x.lastOk === true ? 'Nothing has stopped: Cloudflare has kept publishing every new version (the latest build went through).'
            : 'Cloudflare has not refused a build so far.') : '',
        'Each new version costs two builds (the test copy, then the community app).', restarts, who].filter(Boolean).join(' ') };
  }
  return { until, kind: used >= limit ? 'paused' : 'warning',
    title: (USAGE_SERVICE[k] || 'Cloudflare') + ' ' + USAGE_NAMES[k] + ': ' + n(used) + ' of ' + n(limit) + ' ' + (month ? 'this month' : 'today')
      + (used >= limit ? ' — the free allowance is used up' : ' (' + pct + '% of the free allowance)'),
    affects: k.indexOf('d1') === 0 ? 'the server\'s database' : k.indexOf('firestore') === 0 ? 'the recipes in the cloud (' + String(x.project || 'Firebase').slice(0, 40) + ')' : 'the server',
    detail: [restarts, who].join(' ') };
}
// The warnings at 70%, and the snapshot the owner's 🩺 page shows — merged, so the Worker's hourly Cloudflare count
// (v84) and the GitHub watch's Pages builds and Firestore keep each other's figures.
async function usageEvaluate(env, m) {
  const now = Date.now(), warned = [];
  for (const k of Object.keys(USAGE_NAMES)) {
    const x = m[k];
    if (!x || !(Number(x.limit) > 0)) continue;
    if (Math.round(100 * Math.max(0, Number(x.used) || 0) / Number(x.limit)) < 70) continue;
    const w = usageWords(k, x, now);
    await raiseNotice(env, { what: 'usage:' + k, kind: w.kind, scope: 'owner', until: w.until, self: true,
      title: w.title, affects: w.affects, detail: w.detail });
    warned.push(k);
  }
  // v82 — not an allowance but as worth hearing: the server answering with an error (a feature crashing, or the
  // free plan's 10 ms CPU limit) on 2% or more of today's requests, and at least 25 times.
  const er = m.workerErrors;
  if (er && Number(er.used) >= 25 && Number(er.used) / Math.max(1, Number(er.of) || 0) >= 0.02) {
    const pct = Math.round(1000 * er.used / Math.max(1, er.of)) / 10;
    await raiseNotice(env, { what: 'usage:workerErrors', kind: 'warning', scope: 'owner', until: nextUtcMidnight(now), self: true,
      title: 'The server answered with an error ' + Number(er.used).toLocaleString('en-US') + ' times today (' + pct + '% of requests)',
      affects: 'whichever feature is failing',
      detail: 'Often the free plan\'s 10 ms CPU limit, or one feature crashing. Cloudflare → Workers & Pages → lively-bread-273a → Logs shows which.' });
    warned.push('workerErrors');
  }
  if (env.METER_DB) {
    try {
      await tableOnce(env.METER_DB, 'usage_snapshot', 'CREATE TABLE IF NOT EXISTS usage_snapshot (id INTEGER PRIMARY KEY, at INTEGER, metrics TEXT)');
      const before = await usageSnapshot(env), merged = Object.assign({}, (before && before.metrics) || {}, m);
      await env.METER_DB.prepare('INSERT INTO usage_snapshot (id, at, metrics) VALUES (1, ?1, ?2) ON CONFLICT (id) DO UPDATE SET at = excluded.at, metrics = excluded.metrics')
        .bind(now, JSON.stringify(merged).slice(0, 20000)).run();
    } catch (e) {}
  }
  return warned;
}
// v84 — the hourly watch on Cloudflare's own clock (Tony, 20 Oct 2026, agreed): GitHub drops most scheduled runs on
// this repository (two of eleven one day), so at :17 every hour the Worker reads today's Cloudflare use itself, with a
// token that may only read analytics (CF_ANALYTICS_TOKEN, from the GitHub secret of that name). Pages builds and
// Firebase's own counts stay with the GitHub watch (other keys); the apps count their Firestore reads (v83).
const CF_ACCOUNT = '4dbc420100c13bf94fda83047ce0a7ac';   // public: worker/wrangler.jsonc
const HOURLY_CRON = '17 * * * *';                          // worker/wrangler.jsonc triggers
async function cloudflareToday(env) {
  const now = new Date(), since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const query = `query($acct: string!, $since: Time!, $until: Time!) {
    viewer { accounts(filter: { accountTag: $acct }) {
      kv: kvOperationsAdaptiveGroups(limit: 20, filter: { datetime_geq: $since, datetime_lt: $until }) { sum { requests } dimensions { actionType } }
      w: workersInvocationsAdaptive(limit: 20, filter: { datetime_geq: $since, datetime_lt: $until }) { sum { requests errors } }
      d1: d1AnalyticsAdaptiveGroups(limit: 20, filter: { datetimeHour_geq: $since, datetimeHour_lt: $until }) { sum { rowsRead rowsWritten } }
    } } }`;
  const r = await (env.__fetch || fetch)('https://api.cloudflare.com/client/v4/graphql', { method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.CF_ANALYTICS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { acct: CF_ACCOUNT, since: since.toISOString(), until: now.toISOString() } }), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.errors && j.errors.length) || !j.data) throw new Error('Cloudflare analytics answered ' + r.status + (j.errors && j.errors[0] ? ': ' + String(j.errors[0].message).slice(0, 160) : ''));
  const a = (j.data.viewer.accounts || [])[0] || {}, kv = {};
  (a.kv || []).forEach(g => { kv[g.dimensions.actionType] = (kv[g.dimensions.actionType] || 0) + g.sum.requests; });
  const sum = (list, f) => (list || []).reduce((t, g) => t + (g.sum[f] || 0), 0);
  return {
    workerRequests: { used: sum(a.w, 'requests'), limit: 100000 },
    kvWrites: { used: kv.write || 0, limit: 1000 }, kvReads: { used: kv.read || 0, limit: 100000 },
    kvDeletes: { used: kv.delete || 0, limit: 1000 }, kvLists: { used: kv.list || 0, limit: 1000 },
    d1RowsWritten: { used: sum(a.d1, 'rowsWritten'), limit: 100000 }, d1RowsRead: { used: sum(a.d1, 'rowsRead'), limit: 5000000 },
    workerErrors: { used: sum(a.w, 'errors'), of: sum(a.w, 'requests') }
  };
}
async function hourlyUsage(env) {
  if (!env.CF_ANALYTICS_TOKEN) return null;
  try { return await usageEvaluate(env, await cloudflareToday(env)); }
  catch (e) {
    // a token that stopped working is said once a day, not every hour
    await raiseNotice(env, { what: 'usage:watch', kind: 'warning', scope: 'owner', until: nextUtcMidnight(Date.now()), self: true,
      title: 'The hourly usage check cannot read Cloudflare\'s figures', affects: 'the early warnings at 70%',
      detail: String((e && e.message) || e).slice(0, 300) + ' — the token CF_ANALYTICS_TOKEN may have expired or lost its permission (Account Analytics: Read).' });
    return null;
  }
}
async function usageSnapshot(env) {
  if (!env.METER_DB) return null;
  try {
    const r = await env.METER_DB.prepare('SELECT at, metrics FROM usage_snapshot WHERE id = 1').first();
    return r ? { at: Number(r.at), metrics: JSON.parse(r.metrics || '{}') } : null;
  } catch (e) { return null; }
}


// ── Bring! recipe import (v42) ────────────────────────────────────────────────
const BRING_PAGE_TTL = 900;                   // seconds a page lives (KV expiry)
function htmlEsc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
async function bringRecipePage(env, code) {
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
                    'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
  if (!env.BRING_KV) return new Response('Not configured', { status: 503, headers });
  const raw = await env.BRING_KV.get('bringrecipe:' + code);
  if (!raw) return new Response('<!doctype html><meta charset="utf-8"><title>Expired</title><p>This shopping list has expired. Send it to Bring! again from the app.</p>',
                                { status: 404, headers });
  const r = JSON.parse(raw);
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Recipe', name: r.name,
    recipeIngredient: r.ingredients, recipeYield: r.servings ? String(r.servings) : undefined }).replace(/</g, '\\u003c');
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + htmlEsc(r.name) + '</title>'
    + '<script type="application/ld+json">' + ld + '</' + 'script></head><body>'
    + '<div itemscope itemtype="https://schema.org/Recipe"><h1 itemprop="name">' + htmlEsc(r.name) + '</h1>'
    + (r.servings ? '<meta itemprop="recipeYield" content="' + htmlEsc(r.servings) + '">' : '')
    + '<ul>' + r.ingredients.map(i => '<li itemprop="recipeIngredient">' + htmlEsc(i) + '</li>').join('') + '</ul></div>'
    + '</body></html>';
  return new Response(html, { status: 200, headers });
}

function jsonResp(data, status = 200, cors) {
  return new Response(JSON.stringify(data), {
    status,
    // CORS is set centrally by the fetch wrapper; anything passed here is only
    // an override and is normally omitted.
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors || {})
  });
}

function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// v36 — CORS is applied CENTRALLY, in one place, on the way out.
//
// v34 changed jsonResp's default from '*' to 'null' and threaded the real
// headers through only the handful of call sites it touched. The other 43
// returned `Access-Control-Allow-Origin: null`, so the browser rejected those
// responses and the app saw a thrown fetch — "could not be reached from this
// device" on every feature. A rule that 51 call sites have to remember is a rule
// that will be broken; the wrapper below makes forgetting impossible.
async function handleRequest(request, env, ctx) {
    const corsHeaders = corsFor(request, env);
    const origin = originAllowed(request, env);

    if (request.method === 'OPTIONS') {
      // A disallowed origin gets no CORS grant, so the browser refuses the real
      // request before it is ever sent.
      if (origin === false) return new Response(null, { status: 403 });
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': (typeof origin === 'string' && origin) ? origin : 'null',
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
        'Access-Control-Max-Age': '86400',
      }});
    }

    // v42 — the one GET that is not a liveness check: a Bring! import page,
    // fetched by Bring!'s servers (no Origin, no app key — the 32-hex code in
    // the address is what grants it, and it expires in 15 minutes).
    if (request.method === 'GET') {
      const m = /^\/bring-recipe\/([a-f0-9]{32})$/.exec(new URL(request.url).pathname);
      if (m) return bringRecipePage(env, m[1]);
    }
    // Otherwise GET is a liveness check and nothing else. (v41 — it used to serve
    // files stored by the `download-store` action; see the note where that was.)
    if (request.method === 'GET') {
      return new Response('OK', { status: 200, headers: {
        'Access-Control-Allow-Origin': (typeof origin === 'string' && origin) ? origin : 'null',
        'Vary': 'Origin',
      }});
    }

    if (request.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405, corsHeaders);

    // A browser request from somewhere that is not our app is refused outright.
    if (origin === false) {
      return jsonResp({ error: 'FORBIDDEN: this Worker only serves Tony\'s Recipes.' }, 403, corsHeaders);
    }

    // v44 — a video file: the body is the video, so the app key comes in the
    // X-App-Key header. Same origin check (above), key, and rate limit.
    if (new URL(request.url).searchParams.get('action') === 'video-file') {
      if (!appKeyOk(request, env, null)) return jsonResp({ error: 'FORBIDDEN: missing or wrong app key.' }, 403, corsHeaders);
      const limitedV = await rateLimited(request, env, 'video-recipe');
      if (limitedV) return limitedV;
      return await videoFileRecipe(request, env);
    }

    let body;
    try { body = JSON.parse(await request.text()); }
    catch(e) { return jsonResp({ error: 'Invalid JSON' }, 400, corsHeaders); }

    // v66 — sending straight to the family's Bring! list is retired (above).
    if (BRING_RETIRED.indexOf(body.action) !== -1) {
      return jsonResp({ error: 'BRING_RETIRED: sending straight to a Bring! list is no longer offered — use "Open in Bring!" (Bring!\'s own import).' }, 410, corsHeaders);
    }

    // health is deliberately open: the app pings it to tell "Worker down" apart
    // from "Worker refusing me", and it reveals nothing and costs nothing.
    if (body.action !== 'health') {
      if (!appKeyOk(request, env, body)) {
        return jsonResp({ error: 'FORBIDDEN: missing or wrong app key.' }, 403, corsHeaders);
      }
      const limited = await rateLimited(request, env, body.action);
      if (limited) return limited;
    }

    // ── health ───────────────────────────────────────────────────────────────
    // Open on purpose, and it returns no secrets — only whether each control is
    // switched on. Without it, "the Worker is down" and "the Worker is refusing
    // me" look identical from the app, which is the kind of dead end this
    // project treats as a bug.
    if (body.action === 'health') {
      // v39 — the ceilings are only reported to a caller that presented the app
      // key. health stays open so "down" and "refusing me" can be told apart;
      // what the bill is doing is not an anonymous caller's business.
      const keyed = appKeyOk(request, env, body);
      return jsonResp({
        ok: true,
        spend: keyed ? await spendStatus(env) : undefined,
        // v78 — a used-up daily allowance (KV writes, D1 rows), with when it comes back.
        notices: keyed ? await serverNotices(env, { project: String(body.project || '').slice(0, 64) }) : undefined,
        // Keep in step with the header at the top of this file. It said v34 on a
        // v36 Worker, which made `health` — the one endpoint whose entire job is
        // to report the truth about this Worker — quietly wrong about it.
        version: WORKER_VERSION,
        originAllowed: origin !== false,
        appKeyRequired: !!env.APP_SHARED_KEY,
        appKeyAccepted: keyed,
        rateLimiting: !!(env.BRING_KV || env.METER_DB),
        usageWatch: !!env.USAGE_KEY,  // v79 — the hourly usage watch can report here
        // v78 — where the counters live: per minute in memory; the AI day/month in D1 (else KV).
        limits: { minute: 'memory', ceilings: env.METER_DB ? 'd1' : env.BRING_KV ? 'kv' : 'off' },
        // v60 — the app sends its sign-in and household only to a Worker that
        // strips them before Anthropic (an older one would forward them, and
        // Anthropic refuses unknown fields — the v37 lesson).
        metering: { version: 1, db: !!env.METER_DB },
        feedback: !!env.METER_DB,     // v61 — notes from every copy, one inbox
        reports: !!(env.REPORTS_GITHUB_TOKEN && env.METER_DB),   // v90 — and on to the private reports repository
        alerts: !!(env.ALERTS && env.ALERT_TO),   // v73 — the owner hears about a new device and destructive actions
        owner: ownerEmails(env).length > 0,       // v74 — the owner's address is set (it is no longer in the code)
        retention: { days: KEEP_DAYS, db: !!env.METER_DB },   // v75 — the daily sweep (logs and names after six months)
        reports: !!env.METER_DB,      // v62 — households report themselves, one Households page
        notesImport: !!env.METER_DB,  // v64 — notes kept in a copy's own database move to the inbox
        replies: !!env.METER_DB,      // v68 — the owner answers a note in the sender's own app
        signals: !!env.METER_DB,      // v69 — the testers' apps report errors and feature counts
        survey: !!env.METER_DB,       // v71 — the end-of-beta question
        configured: {
          anthropic: !!env.ANTHROPIC_API_KEY,
          openverse: true,
          wikimedia: true,      // v77
          pixabay: !!env.PIXABAY_API_KEY,
          pexels: !!env.PEXELS_API_KEY,
          unsplash: !!env.UNSPLASH_ACCESS_KEY,
          youtube: !!env.YOUTUBE_API_KEY,
          videoAi: !!env.GEMINI_API_KEY,
          bring: !!env.BRING_KV          // v66 — Bring!'s own import only
        }
      }, 200, corsHeaders);
    }

    // ── bring-recipe-page (v42) ──────────────────────────────────────────────
    // The app's ingredient lines → a page Bring!'s servers can read, and the
    // official import link that points them at it. Behind the app key and the
    // rate limit like everything else; only text, capped, and it expires.
    if (body.action === 'bring-recipe-page') {
      if (!env.BRING_KV) return jsonResp({ error: 'BRING_KV is not configured on this Worker' }, 503, corsHeaders);
      const name = String(body.name || 'Recipe').trim().slice(0, 200) || 'Recipe';
      const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : [])
        .map(x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, 300)).filter(Boolean).slice(0, 200);
      if (!ingredients.length) return jsonResp({ error: 'No ingredients to send' }, 400, corsHeaders);
      const servings = body.servings ? String(body.servings).slice(0, 40) : null;
      const code = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      await env.BRING_KV.put('bringrecipe:' + code, JSON.stringify({ name, ingredients, servings }), { expirationTtl: BRING_PAGE_TTL });
      const url = new URL(request.url).origin + '/bring-recipe/' + code;
      return jsonResp({ url, expiresIn: BRING_PAGE_TTL,
        deeplink: 'https://api.getbring.com/rest/bringrecipes/deeplink?url=' + encodeURIComponent(url) + '&source=web' }, 200, corsHeaders);
    }

    // ── instagram-fetch ──────────────────────────────────────────────────────
    if (body.action === 'instagram-fetch') {
      const { shortcode } = body;
      if (!shortcode) return jsonResp({ error: 'No shortcode' }, 400);
      // v32 — Meta made the oEmbed endpoints TOKENLESS again on 15 June 2026 for
      // public posts, so this is worth attempting once more. Be clear about what
      // it can and cannot give you: oEmbed returns the embed HTML, the author and
      // a thumbnail. It does NOT reliably return the caption, and the caption is
      // where a recipe lives. Where a caption fragment does appear it is inside
      // the blockquote in `html`, so that gets mined too — but the honest answer
      // is often "we got the post, not the words", and the app is told so via
      // `partial` rather than being left to guess.
      const postUrl = `https://www.instagram.com/p/${shortcode}/`;
      let igPartial = null;
      const endpoints = [
        `https://graph.facebook.com/v23.0/instagram_oembed?omitscript=true&url=${encodeURIComponent(postUrl)}`,
        `https://graph.facebook.com/v20.0/instagram_oembed?omitscript=true&url=${encodeURIComponent(postUrl)}`,
        `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`,
      ];
      // Pull whatever human text the embed blockquote carries. Instagram's embed
      // markup puts the caption (when present) in <p> inside the blockquote.
      const captionFromHtml = (html) => {
        if (!html) return '';
        const block = (html.match(/<blockquote[\s\S]*?<\/blockquote>/i) || [''])[0] || html;
        return block
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
      };
      for (const endpoint of endpoints) {
        try {
          const r = await fetch(endpoint, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000),
          });
          if (!r.ok) continue;
          const data = await r.json();
          const title   = data.title || '';
          const author  = data.author_name || '';
          const embedTx = captionFromHtml(data.html);
          // Boilerplate the embed always carries, which is not a caption.
          const cleaned = embedTx
            .replace(/View this post on Instagram/gi, '')
            .replace(/A post shared by[\s\S]*$/i, '')
            .trim();
          const caption = title.length >= cleaned.length ? title : cleaned;
          const text = [caption, author ? 'By: ' + author : ''].filter(Boolean).join('\n\n');
          if (caption.trim().length < 40) { igPartial = { title, author, thumbnail: data.thumbnail_url || '' }; break; }   // v48 → the captioned embed
          return jsonResp({
            title, author, text,
            thumbnail: data.thumbnail_url || '',
            // < 40 chars is not a recipe. Say so rather than letting the app feed
            // "View this post on Instagram" to Claude and call the result a recipe.
            partial: caption.trim().length < 40,
          });
        } catch(e) { /* try the next endpoint */ }
      }
      // v48 — the public captioned-embed page (what a website's embed shows):
      // the caption, and the video's address for when the words hold no recipe.
      let igVideo = '';
      try {
        const r = await fetch(`https://www.instagram.com/p/${encodeURIComponent(shortcode)}/embed/captioned/`,
          { headers: Object.assign({ Accept: 'text/html' }, FB_UA), signal: AbortSignal.timeout(10000) });
        if (r.ok) {
          const html = await r.text();
          igVideo = videoUrlIn(html);
          const cap = (html.match(/<div[^>]+class="[^"]*\bCaption\b[^"]*"[^>]*>([\s\S]*?)<div[^>]+class="[^"]*\bCaptionComments\b/i)
                   || html.match(/<div[^>]+class="[^"]*\bCaption\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) || [])[1] || '';
          const text = htmlText(cap.replace(/<a[^>]+class="[^"]*\bCaptionUsername\b[^"]*"[^>]*>[\s\S]*?<\/a>/i, ''))
            .replace(/^(View all \d+ comments|View this post on Instagram)$/gim, '').trim();
          if (text.length >= 40) return jsonResp({ title: (igPartial && igPartial.title) || '', author: (igPartial && igPartial.author) || '',
            text, via: 'embed-captioned', videoUrl: igVideo, partial: false });
        }
      } catch (e) { /* nothing more to try here */ }
      // 404 rather than 500: this is "no caption available", not a broken Worker.
      return jsonResp({
        error: 'Instagram did not return a caption for this post.',
        unavailable: true, videoUrl: igVideo,
        title: (igPartial && igPartial.title) || '', author: (igPartial && igPartial.author) || '',
        partial: !!igPartial,
      }, 404);
    }

    // ── video-recipe (v43) ───────────────────────────────────────────────────
    if (body.action === 'video-recipe') {
      const ytId = extractYouTubeId(String(body.url || ''));
      if (!ytId) return jsonResp({ error: 'Only a YouTube video can be read this way.' }, 400);
      if (!env.GEMINI_API_KEY) {
        return jsonResp({ error: 'VIDEO_AI: reading recipes from videos is not set up on the server (GEMINI_API_KEY).',
          needsConfig: true }, 503);
      }
      // Its own daily ceiling, across all callers — Gemini's free allowance is
      // the real limit, this only keeps one busy day from using all of it.
      const capped = await videoDailyCap(env);
      if (capped) return capped;
      return await geminiRecipe(env, { file_uri: 'https://www.youtube.com/watch?v=' + ytId }, { isYouTube: true, videoId: ytId });
    }

    // ── video-from-url (v48) ─────────────────────────────────────────────────
    if (body.action === 'video-from-url') {
      return await videoFromUrl(env, String(body.url || ''));
    }

    // ── facebook-fetch (v47) ─────────────────────────────────────────────────
    // ── the Facebook reading test (v57) — diagnostic, the test copy's 🔬 ────────
    if (body.action === 'fb-probe') {
      const u = String(body.url || '');
      if (!isFacebookAddress(u)) return jsonResp({ error: 'Only a Facebook address can be tested.' }, 400);
      return jsonResp(await fbProbe(env, u));
    }
    if (body.action === 'facebook-fetch') {
      const u = String(body.url || '');
      if (!isFacebookAddress(u)) return jsonResp({ error: 'Only a Facebook address can be read this way.' }, 400);
      return jsonResp(await facebookFetch(env, u));
    }

    if (body.action === 'fetch-url') {
      const url = body.url;
      if (!url || !url.startsWith('http')) return jsonResp({ error: 'Invalid URL' }, 400);

      // Check if it's a YouTube URL — use Data API instead
      const ytId = extractYouTubeId(url);
      if (ytId) {
        const apiKey = env.YOUTUBE_API_KEY;
        if (!apiKey) {
          return jsonResp({ error: 'YouTube API key not configured', isYouTube: true }, 500);
        }
        try {
          const ytResp = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?id=${ytId}&part=snippet&key=${apiKey}`
          );
          const ytData = await ytResp.json();
          // Check for quota/API errors
          if (ytData.error) {
            const reason = ytData.error.errors && ytData.error.errors[0] && ytData.error.errors[0].reason;
            if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
              return jsonResp({
                error: 'YOUTUBE_QUOTA: YouTube API daily quota exceeded.\n\nQuota resets at midnight Pacific Time.\n\nCheck usage: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas\n\nFree quota: 10,000 units/day (each video lookup = 1 unit)',
                isYouTube: true
              }, 429);
            }
            if (reason === 'keyInvalid' || ytData.error.code === 400) {
              return jsonResp({
                error: 'YOUTUBE_KEY: YouTube API key is invalid.\n\nCheck your key at: https://console.cloud.google.com/apis/credentials\n\nUpdate it in Cloudflare Worker settings: https://dash.cloudflare.com/',
                isYouTube: true
              }, 403);
            }
            return jsonResp({ error: 'YouTube API error: ' + (ytData.error.message || ''), isYouTube: true }, 500);
          }
          if (!ytData.items || !ytData.items.length) {
            return jsonResp({ error: 'Video not found or private', isYouTube: true }, 404);
          }
          const snippet = ytData.items[0].snippet;
          const text = `Title: ${snippet.title}\n\nChannel: ${snippet.channelTitle}\n\nDescription:\n${snippet.description}`;
          return jsonResp({ text, isYouTube: true, title: snippet.title, videoId: ytId });
        } catch(err) {
          return jsonResp({ error: err.message, isYouTube: true }, 500);
        }
      }

      // Regular URL fetch
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'he,en;q=0.9',
          },
          redirect: 'follow',
        });
        if (!r.ok) return jsonResp({ error: 'Page returned ' + r.status, text: '' });
        const html = await r.text();
        // v36.0 — two changes, both for multi-recipe articles.
        //
        // 1. BLOCK TAGS BECOME NEWLINES, not spaces. Turning every tag into a
        //    space collapsed a <li> ingredient list into one run-on line:
        //    "1 kg potatoes, halved  coarse salt 500 g flour 1 egg". The page's
        //    own structure is the strongest signal for where one ingredient
        //    ends and the next begins, and it was being thrown away before the
        //    AI ever saw it. Inline tags (<b>, <a>, <span>) still become
        //    nothing, so a bolded amount does not split its own ingredient.
        // 2. The cap goes from 10,000 to 60,000 characters. A ten-recipe
        //    round-up is far longer than 10,000, so the last recipes were
        //    silently cut off — the import looked like it worked and simply
        //    returned fewer recipes than the page had. `truncated` is reported
        //    so the app can say so instead of guessing.
        const BLOCK = 'address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul';
        const LIMIT = 60000;
        // The chrome comes off ONCE, and both the text and the links are taken
        // from what is left. Collecting links from the raw html instead would
        // return the whole site navigation — on a news site that is a hundred
        // links before the article even starts.
        const stripped = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<header[\s\S]*?<\/header>/gi, ' ')
          .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
          .replace(/<aside[\s\S]*?<\/aside>/gi, ' ');

        // v38 — some round-ups are nothing but LINKS to the recipes: a title, a
        // rating, a photo credit and "to the recipe". Everything below turns an
        // <a> into its label and throws the href away, so the app could see ten
        // recipe names and had no way to reach a single one of them.
        //
        // This list is what the app may go on to fetch, so it is deliberately
        // narrow: http(s) only, SAME HOST as the page itself, de-duplicated, no
        // self-links, and capped. It must not become a way to make this Worker
        // fetch anywhere on anybody's behalf.
        const links = [];
        try {
          const base = new URL(url);
          const seen = new Set([base.href.replace(/#.*$/, '')]);
          const A_RE = /<a\b[^>]*?\bhref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>([\s\S]*?)<\/a>/gi;
          let m;
          while ((m = A_RE.exec(stripped)) !== null && links.length < 80) {
            const raw = m[1].replace(/^["']|["']$/g, '');
            let abs;
            try { abs = new URL(raw, base); } catch (e) { continue; }
            if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
            if (abs.hostname !== base.hostname) continue;
            abs.hash = '';
            if (seen.has(abs.href)) continue;
            seen.add(abs.href);
            const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            links.push({ href: abs.href, text: label.slice(0, 120) });
          }
        } catch (e) { /* a page with no usable links is not an error */ }

        let text = stripped
          .replace(new RegExp('</?(?:' + BLOCK + ')(?:\\s[^>]*)?>', 'gi'), '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
          .replace(/[ \t]{2,}/g,' ')
          .replace(/[ \t]*\n[ \t]*/g,'\n')
          .replace(/\n{3,}/g,'\n\n')
          .trim();
        const truncated = text.length > LIMIT;
        if (truncated) text = text.slice(0, LIMIT);
        return jsonResp({ text, links, truncated, fullLength: truncated ? undefined : text.length });
      } catch(err) {
        return jsonResp({ error: err.message, text: '' });
      }
    }

    // ── photo-search ──────────────────────────────────────────────────────────
    // Multi-source: Pixabay (PIXABAY_API_KEY), Pexels (PEXELS_API_KEY),
    // Unsplash (UNSPLASH_ACCESS_KEY). The app cycles sources via a "See more" button.
    // A source with no key set returns { notConfigured:true } so the app can skip it.
    // Per-source failures return HTTP 200 with an { error } field so one bad source
    // never breaks the others.
    // ── photo-fetch (v40) ────────────────────────────────────────────────────
    // Applying a chosen photo downloads its BYTES, and the host is whatever the
    // photo source returned — Openverse federates Flickr, Wikimedia, NASA and
    // museum collections, so the set is genuinely unbounded. That is the whole
    // reason the app's CSP carries a bare `https:` in connect-src, which makes
    // the careful allowlist after it decorative (audit S2). Routing the bytes
    // through here is what allows that to be removed: one named host instead of
    // "anywhere". It also fixes image hosts that send no CORS headers of their
    // own, which the browser refuses outright.
    //
    // This is a fetch-anything primitive and is treated as one. It is behind the
    // same origin check, app key and rate limit as everything else, and on top
    // of that: http(s) only, the answer must actually BE an image, and it is
    // capped — a Worker that will stream an arbitrary file of any size on
    // request is a bandwidth amplifier with someone else's name on it.
    if (body.action === 'photo-fetch') {
      const raw = String(body.url || '');
      let target;
      try { target = new URL(raw); } catch (e) { return jsonResp({ error: 'PHOTO_FETCH: not a URL' }, 400); }
      if (target.protocol !== 'https:' && target.protocol !== 'http:') {
        return jsonResp({ error: 'PHOTO_FETCH: only http(s) can be fetched' }, 400);
      }
      const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
      let r;
      try {
        r = await fetch(target.toString(), {
          headers: { 'Accept': 'image/*', 'User-Agent': 'MyKitchenNotes/1.0 (https://mykitchennotes.community)' },   // v77
          signal: AbortSignal.timeout(15000),
        });
      } catch (e) {
        return jsonResp({ error: 'PHOTO_FETCH: the image host could not be reached ('
          + (e && e.message ? e.message : 'network error') + ')' }, 502);
      }
      if (!r.ok) return jsonResp({ error: 'PHOTO_FETCH: the image host answered ' + r.status }, 502);
      const ct = (r.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
      if (ct.indexOf('image/') !== 0 || ct === 'image/svg+xml') {   // v66 — no SVG: a picture that can carry a script
        // Not an image. Saying so beats handing the app an HTML error page to
        // compress into a recipe photo.
        return jsonResp({ error: 'PHOTO_FETCH: that address returned "' + (ct || 'nothing') + '", not an image' }, 415);
      }
      const declared = parseInt(r.headers.get('content-length') || '0', 10);
      if (declared && declared > MAX_PHOTO_BYTES) {
        return jsonResp({ error: 'PHOTO_FETCH: that image is ' + Math.round(declared / 1048576) + ' MB, over the limit' }, 413);
      }
      const bytes = await r.arrayBuffer();
      // Checked again after the fact: content-length is a claim, not a promise.
      if (bytes.byteLength > MAX_PHOTO_BYTES) {
        return jsonResp({ error: 'PHOTO_FETCH: that image is over the size limit' }, 413);
      }
      // CORS is stamped centrally by the fetch wrapper.
      return new Response(bytes, { status: 200, headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' } });
    }

    if (body.action === 'photo-search') {
      const query = body.query;
      if (!query) return jsonResp({ error: 'No query' }, 400);
      const source  = (body.source || 'pixabay').toLowerCase();
      const page    = Math.max(1, parseInt(body.page, 10) || 1);
      const perPage = 9;
      // A provider that rate-limits answers with a plain-text notice, not JSON.
      // Reporting that as "invalid JSON" is true and useless — it hides the one
      // fact that matters, which is that waiting fixes it. v33.
      const photoFail = (source, name, resp, raw) => {
        if (resp.status === 429) {
          const retry = parseInt(resp.headers.get('X-RateLimit-Reset') || resp.headers.get('Retry-After') || '0', 10);
          return jsonResp({ source, rateLimited: true, retryAfter: retry || null,
            error: name + ' is rate-limited (429) — too many searches in the last minute'
                 + (retry ? '; try again in about ' + retry + 's' : '') });
        }
        return jsonResp({ source, error: name + ' error ' + resp.status + ': ' + String(raw || '').slice(0, 120) });
      };
      try {
        // ── Pixabay ──
        if (source === 'pixabay') {
          const key = env.PIXABAY_API_KEY;
          if (!key) return jsonResp({ source, images: [], notConfigured: true });
          const url = 'https://pixabay.com/api/?key=' + key + '&q=' + encodeURIComponent(query)
            + '&image_type=photo&per_page=' + perPage + '&page=' + page + '&safesearch=true&order=popular';
          const resp = await fetch(url);
          const raw = await resp.text();
          let data; try { data = JSON.parse(raw); } catch(e) { return photoFail(source, 'Pixabay', resp, raw); }
          if (!resp.ok || data.error) return photoFail(source, 'Pixabay', resp, data.error || raw);
          const images = (data.hits || []).map(h => ({
            url: h.largeImageURL || h.webformatURL,
            thumb: h.webformatURL || h.previewURL,
            credit: h.user,
            creditUrl: 'https://pixabay.com/users/' + h.user + '-' + h.user_id + '/',
            license: 'Pixabay licence', sourceLabel: 'Pixabay'
          }));
          return jsonResp({ source, page, images, total: data.totalHits });
        }
        // ── Pexels ──
        if (source === 'pexels') {
          const key = env.PEXELS_API_KEY;
          if (!key) return jsonResp({ source, images: [], notConfigured: true });
          const url = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query)
            + '&per_page=' + perPage + '&page=' + page;
          const resp = await fetch(url, { headers: { 'Authorization': key } });
          const raw = await resp.text();
          let data; try { data = JSON.parse(raw); } catch(e) { return photoFail(source, 'Pexels', resp, raw); }
          if (!resp.ok) return photoFail(source, 'Pexels', resp, data.error || raw);
          const images = (data.photos || []).map(p => ({
            url: (p.src && (p.src.large || p.src.original)) || (p.src && p.src.medium),
            thumb: (p.src && (p.src.medium || p.src.small)) || (p.src && p.src.tiny),
            credit: p.photographer,
            creditUrl: p.photographer_url,
            license: 'Pexels licence', sourceLabel: 'Pexels'
          }));
          return jsonResp({ source, page, images, total: data.total_results });
        }
        // ── Unsplash ──
        if (source === 'unsplash') {
          const key = env.UNSPLASH_ACCESS_KEY;
          if (!key) return jsonResp({ source, images: [], notConfigured: true });
          const url = 'https://api.unsplash.com/search/photos?query=' + encodeURIComponent(query)
            + '&per_page=' + perPage + '&page=' + page + '&content_filter=high';
          const resp = await fetch(url, { headers: { 'Authorization': 'Client-ID ' + key, 'Accept-Version': 'v1' } });
          const raw = await resp.text();
          let data; try { data = JSON.parse(raw); } catch(e) { return photoFail(source, 'Unsplash', resp, raw); }
          if (!resp.ok) return photoFail(source, 'Unsplash', resp, (data.errors && data.errors.join(', ')) || raw);
          const images = (data.results || []).map(p => ({
            url: (p.urls && (p.urls.regular || p.urls.full)) || (p.urls && p.urls.small),
            thumb: (p.urls && (p.urls.small || p.urls.thumb)) || (p.urls && p.urls.regular),
            credit: p.user && p.user.name,
            creditUrl: p.user && p.user.links && p.user.links.html,
            license: 'Unsplash licence', sourceLabel: 'Unsplash'
          }));
          return jsonResp({ source, page, images, total: data.total });
        }
        // ── Openverse — NO API KEY, so it cannot be knocked out by a shared
        // key's rate limit, which is what made Pixabay 429 on Tony. It federates
        // Flickr, Wikimedia, NASA and museum collections, all openly licensed.
        // Licence and creator are passed through because CC-BY REQUIRES credit;
        // the app stores them on the recipe.
        if (source === 'openverse') {
          const url = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(query)
            + '&page_size=' + perPage + '&page=' + page
            + '&license_type=all-cc&mature=false';
          const resp = await fetch(url, { headers: { 'User-Agent': 'TonysRecipes/1.0 (personal recipe app)' } });
          const raw = await resp.text();
          let data; try { data = JSON.parse(raw); } catch(e) { return photoFail(source, 'Openverse', resp, raw); }
          if (!resp.ok) return photoFail(source, 'Openverse', resp, data.detail || raw);
          const images = (data.results || []).map(i => ({
            url: i.url,
            thumb: i.thumbnail || i.url,
            credit: i.creator || i.source || 'Unknown',
            creditUrl: i.foreign_landing_url || i.url,
            license: (i.license ? String(i.license).toUpperCase() : '') + (i.license_version ? ' ' + i.license_version : ''),
            sourceLabel: 'Openverse'
          })).filter(i => i.url);
          return jsonResp({ source, page, images, total: data.result_count });
        }
        // ── Wikimedia Commons (v77) — no key; 0.3–0.6 s a search where Openverse took 12–28 s. The same
        // openly licensed works (Openverse gathers them from here, among others). The creator comes from
        // Commons as HTML and goes out as plain text; licence and file page go with it, for the credit.
        if (source === 'wikimedia') {
          const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6'
            + '&gsrlimit=' + perPage + '&gsroffset=' + ((page - 1) * perPage)
            + '&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + query)
            + '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=LicenseShortName|Artist&iiurlwidth=330';
          const resp = await fetch(url, { headers: { 'User-Agent': 'MyKitchenNotes/1.0 (https://mykitchennotes.community; recipe photo search)' },
            signal: AbortSignal.timeout(15000) });
          const raw = await resp.text();
          let data; try { data = JSON.parse(raw); } catch(e) { return photoFail(source, 'Wikimedia Commons', resp, raw); }
          if (!resp.ok || data.error) return photoFail(source, 'Wikimedia Commons', resp, (data.error && data.error.info) || raw);
          const plain = v => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
          const pages = Object.values((data.query && data.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
          const images = pages.map(pg => {
            const ii = (pg.imageinfo || [])[0] || {}, md = ii.extmetadata || {};
            if (!ii.url || !/^image\/(jpeg|png|webp)$/.test(ii.mime || '')) return null;
            // What is kept: a 960-pixel copy of a big original (a size Commons keeps ready), else the original.
            const keep = ii.thumburl && ii.width > 960 && /\/330px-/.test(ii.thumburl) ? ii.thumburl.replace('/330px-', '/960px-') : ii.url;
            return { url: keep, thumb: ii.thumburl || ii.url,
              credit: plain(md.Artist && md.Artist.value).slice(0, 120) || 'Wikimedia Commons',
              creditUrl: ii.descriptionurl || ii.url,
              license: plain(md.LicenseShortName && md.LicenseShortName.value).slice(0, 40),
              sourceLabel: 'Wikimedia Commons' };
          }).filter(Boolean);
          return jsonResp({ source, page, images });
        }
        return jsonResp({ source, error: 'Unknown photo source: ' + source, images: [] });
      } catch(err) {
        return jsonResp({ source, error: 'Photo search exception (' + source + '): ' + err.message });
      }
    }

    // v41 — `download-store` is gone. It stored ANY data under ANY filename and
    // file type and handed back a download link on this Worker's address. It was
    // part of the old Hebrew-filename workaround; nothing has called it since the
    // locale was fixed (v35.0), and with the app key in the public page it was an
    // open 60-second file host: a malicious download on a trustworthy-looking
    // address, paid for out of this account's KV write allowance. An unknown
    // action now falls through to the Anthropic proxy's own validation, which
    // refuses a body with no messages.

    // ── meter-me / meter-admin (v60) ─────────────────────────────────────────
    if (body.action === 'limit-report') return await limitReport(request, env, body);   // v79
    if (body.action === 'link-sent') return await linkSent(request, env, body);         // v87
    if (body.action === 'usage-report') return await usageReport(env, body);            // v79
    if (body.action === 'meter-me' || body.action === 'meter-admin') return await meterAction(request, env, body);
    if (body.action === 'feedback-send') {   // v61; v90 — and on to the reports repository
      const fr = await feedbackSend(request, env, body);
      if (fr.status === 200) reportsLater(env, ctx);
      return fr;
    }
    if (body.action === 'feedback-replies') return await feedbackReplies(request, env, body);   // v68
    if (body.action === 'household-report') return await householdReport(request, env, body);   // v62
    if (body.action === 'app-signals') {   // v69; v90 — a new error report on to the reports repository
      const sr = await appSignals(request, env, body);
      if (sr.status === 200 && Array.isArray(body.errors) && body.errors.length) reportsLater(env, ctx);
      return sr;
    }
    if (body.action === 'survey-status' || body.action === 'survey-answer') return await surveyAction(request, env, body);   // v71

    // ── Anthropic proxy ───────────────────────────────────────────────────────
    try {
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) return jsonResp({ error: 'No API key' }, 500);
      // v37 — the body is forwarded VERBATIM, so every field the app added for the
      // Worker's own benefit must come off first. Anthropic rejects unknown
      // top-level fields outright: v35 moved the app key into the body and this
      // path kept forwarding it, so the API answered
      //   400 invalid_request_error: appKey: Extra inputs are not permitted
      // and EVERY AI feature broke — ask-my-WhatsApp-groups, AI import, translate,
      // nutrition, suggest, explore, diet auto-tag. The CORS reasoning behind v35
      // was right; what went unchecked was what this path then did with the field.
      // Anything added to workerBody() in index.html must be added here too.
      const forwarded = {};
      Object.keys(body).forEach(function(k) {
        // Worker-only, never Anthropic's (v60: the sign-in and the household too)
        if (k === 'appKey' || k === 'action' || k === 'idToken' || k === 'hid') return;
        forwarded[k] = body[k];
      });
      const refused = aiRequestRefused(forwarded, env);           // v66
      if (refused) return refused;
      const metered = await meterStart(request, env, body);
      if (metered.resp) return metered.resp;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(forwarded),
      });
      const data = await r.json();
      // v79 — Anthropic refusing for want of credit, or the key: the owner hears of it.
      if (!r.ok) {
        const et = String((data && data.error && data.error.type) || ''), em = String((data && data.error && data.error.message) || '');
        if (r.status === 402 || et === 'billing_error' || /credit balance/i.test(em))
          await raiseNotice(env, { what: 'anthropic', kind: 'paused', scope: 'all', self: false, until: Date.now() + 3 * 3600e3,
            title: 'Anthropic refused the AI calls: the API credit balance is used up', affects: 'AI features (reading recipes, translating, suggestions)',
            detail: 'Top up at https://console.anthropic.com/settings/billing — the AI works again at once. (' + em.slice(0, 160) + ')' });
        else if (r.status === 401 || et === 'authentication_error')
          await raiseNotice(env, { what: 'anthropic-key', kind: 'paused', scope: 'all', self: false, until: Date.now() + 3 * 3600e3,
            title: 'Anthropic refused the Worker\'s API key', affects: 'AI features (reading recipes, translating, suggestions)',
            detail: 'Check ANTHROPIC_API_KEY in the Worker\'s settings (https://console.anthropic.com/settings/keys). (' + em.slice(0, 160) + ')' });
      }
      // v60 — what it cost, counted against the household; the app shows it.
      if (metered.ctx && data && data.usage) data._meter = await meterAdd(env, metered.ctx, forwarded.model, data.usage);
      // CORS is applied centrally by the fetch wrapper (v36); it overwrites
      // whatever is set here, so this carries only Content-Type.
      return new Response(JSON.stringify(data), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch(err) { return jsonResp({ error: err.message }, 500); }
}

// ─── AI PER HOUSEHOLD (v60, design step 3) ───────────────────────────────────
// Every AI answer is counted against the HOUSEHOLD that asked, in US dollars
// from the answer's own usage report, and on the copies that have a monthly
// allowance (the test copy, the beta) a household past its allowance is
// refused with a friendly word — everything that is not AI keeps working.
//
// Who is asking is PROVED, never taken from the app's say-so:
//   1. the app sends the person's Firebase sign-in token (`idToken`) and the
//      household (`hid`); the token is checked against Google's public keys
//      (RS256), its project (`aud`) against METER_PROJECTS, issuer, expiry;
//   2. membership is read from Firestore WITH THAT SAME TOKEN — the database
//      rules let a member read their own membership and nobody else's, so no
//      service account or secret is needed here at all.
// The counts live in a D1 database bound as METER_DB (Cloudflare → Storage &
// Databases → D1 → Create; Worker → Settings → Bindings → D1 → METER_DB). The
// tables are created on first use. Without it nothing is metered, the app
// works as before, and `health` says so.
//
//   METER_PROJECTS   Firebase projects whose sign-ins count (default: the
//                    family's and the test copy's; add the beta's)
//   CAPPED_PROJECTS  …of those, the STRICT ones: an allowance, and an AI call is
//                    refused when it cannot be counted (default: the test copy
//                    and the beta).
//   AI_CAP_BY_PROJECT a copy's own monthly allowance, JSON (default
//                    {"recipes-f379d":10} — the family's, v67): counted and
//                    capped, but it carries on when the counting fails.
//   CAPPED_ORIGINS   pages of capped copies: an AI call from one WITHOUT a
//                    sign-in is refused (default: the test copy's address)
//   AI_CAP_USD       the monthly allowance (2); AI_CAP_FIRST_USD the first
//                    month's, for a household's big first import (4)
//   OWNER_EMAILS     who may read every household's spending and set caps
//                    (`meter-admin`, the management app); else the secret
//                    OWNER_EMAIL (v74 — no default: none means no owner)
const METER_PROJECTS_DEFAULT = 'recipes-f379d,tonys-recipes-test,my-kitchen-notes-beta';
const CAPPED_PROJECTS_DEFAULT = 'tonys-recipes-test,my-kitchen-notes-beta';
const CAPPED_ORIGINS_DEFAULT = 'https://tonys-recipes-test.pages.dev,https://my-kitchen-notes-beta.pages.dev,https://mykitchennotes.community';   // v70
const AI_CAP_BY_PROJECT_DEFAULT = { 'recipes-f379d': 10 };      // v67 — the family's, per household per month
function projectCap(project, env) {
  let m = AI_CAP_BY_PROJECT_DEFAULT;
  if (env.AI_CAP_BY_PROJECT) { try { m = JSON.parse(env.AI_CAP_BY_PROJECT); } catch (e) {} }
  const v = m && typeof m[project] === 'number' ? m[project] : null;
  return v !== null && v >= 0 ? v : null;
}
function isStrict(project, env) { return csvList(env.CAPPED_PROJECTS, CAPPED_PROJECTS_DEFAULT).includes(project); }
function isCapped(project, env) { return isStrict(project, env) || projectCap(project, env) !== null; }
const AI_MODELS_DEFAULT = 'claude-sonnet-,claude-haiku-';      // v66
const BRING_RETIRED = ['bring-add', 'bring-lists', 'bring-token-status', 'bring-settoken'];   // v66
const AI_MAX_TOKENS_DEFAULT = 32000;                             // v66
// v66 — only what the app itself asks for: a model it uses, an answer no
// longer than its own longest. → a refusal Response, or null to go ahead.
function aiRequestRefused(forwarded, env) {
  const model = String(forwarded.model || '');
  const allowed = csvList(env.AI_MODELS, AI_MODELS_DEFAULT);
  if (!allowed.some(function(p){ return p && model.indexOf(p) === 0; }))
    return jsonResp({ error: 'AI_REQUEST: the model "' + model.slice(0, 60) + '" is not one this app uses (AI_MODELS on the Worker).' }, 400);
  const most = parseInt(env.AI_MAX_TOKENS || '', 10) || AI_MAX_TOKENS_DEFAULT;
  if (!(Number(forwarded.max_tokens) > 0 && Number(forwarded.max_tokens) <= most))
    return jsonResp({ error: 'AI_REQUEST: an answer of ' + forwarded.max_tokens + ' tokens is more than this app asks for (AI_MAX_TOKENS ' + most + ').' }, 400);
  return null;
}
const AI_CAP_USD_DEFAULT = 2, AI_CAP_FIRST_USD_DEFAULT = 4;
// USD per million tokens — the same table as the app's AI_PRICES (index.html).
// A model missing here is priced at the dearest rate, so a cap is never
// under-counted.
const AI_PRICES = {
  'claude-sonnet-5':  { input: 2, cacheWrite: 2.5,  cacheRead: 0.2, output: 10 },
  'claude-haiku-4-5': { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 }
};
const AI_PRICE_UNKNOWN = { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 };
const AI_WEB_SEARCH_USD = 0.01;
function csvList(v, dflt) { return String(v || dflt).split(',').map(s => s.trim()).filter(Boolean); }
// v74 — the owner's address(es), from the Worker's settings only (never written in this file).
function ownerEmails(env) { return csvList(env.OWNER_EMAILS || env.OWNER_EMAIL, '').map(s => s.toLowerCase()); }
function aiCostUsd(model, usage) {
  const p = AI_PRICES[model] || AI_PRICE_UNKNOWN, M = 1e6, u = usage || {};
  return (u.input_tokens || 0) * p.input / M + (u.cache_creation_input_tokens || 0) * p.cacheWrite / M
       + (u.cache_read_input_tokens || 0) * p.cacheRead / M + (u.output_tokens || 0) * p.output / M
       + ((u.server_tool_use || {}).web_search_requests || 0) * AI_WEB_SEARCH_USD;
}
function b64uBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function jwtPart(s) { return JSON.parse(new TextDecoder().decode(b64uBytes(s))); }
let _gKeys = null, _gKeysAt = 0;
async function googleSigningKeys(env, fresh) {
  if (env.__testKeys) return env.__testKeys;                 // tests sign their own tokens
  if (_gKeys && !fresh && Date.now() - _gKeysAt < 3600e3) return _gKeys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Google\'s keys could not be read (' + r.status + ')');
  const d = await r.json(), keys = {};
  (d.keys || []).forEach(k => { keys[k.kid] = k; });
  _gKeys = keys; _gKeysAt = Date.now();
  return keys;
}
async function verifyIdToken(token, env) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('not a sign-in token');
  let head, claims;
  try { head = jwtPart(parts[0]); claims = jwtPart(parts[1]); } catch (e) { throw new Error('not a sign-in token'); }
  if (head.alg !== 'RS256' || !head.kid) throw new Error('not a sign-in token');
  let keys = await googleSigningKeys(env), jwk = keys[head.kid];
  if (!jwk) { keys = await googleSigningKeys(env, true); jwk = keys[head.kid]; }   // Google rotates them
  if (!jwk) throw new Error('signed with an unknown key');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new Error('the signature does not match');
  const now = Math.floor(Date.now() / 1000);
  if (!csvList(env.METER_PROJECTS, METER_PROJECTS_DEFAULT).includes(claims.aud)) throw new Error('from an app this server does not serve');
  if (claims.iss !== 'https://securetoken.google.com/' + claims.aud) throw new Error('not issued by Firebase');
  if (!(claims.exp > now - 30)) throw new Error('expired');
  if (!(claims.iat < now + 300) || !claims.sub) throw new Error('not valid yet');
  return claims;
}
// Is this person in this household? Asked of Firestore with their own token;
// remembered for ten minutes in this Worker instance.
const _meterMembers = new Map();
function fsValue(f) {
  if (!f) return null;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return Number(f.doubleValue);
  if ('stringValue' in f) return f.stringValue;
  if ('booleanValue' in f) return f.booleanValue;
  return null;
}
// v73 — the owner's protections (see the top of the file).
const OWNER_DESTRUCTIVE = new Set(['forget', 'mark-deleted', 'set-cap', 'survey-open', 'survey-close', 'note-delete', 'error-delete', 'copy-from',
  'notes-delete', 'errors-delete']);   // v88 — several at once
// v88 — the ids of a batch: whole numbers above 0, each once, at most `max` (100: D1 binds at most 100 values a query;
// v89: 99 when a status goes with them)
function idBatch(v, max = 100) {
  const out = [];
  (Array.isArray(v) ? v : []).forEach(x => { const n = parseInt(x, 10); if (n > 0 && out.indexOf(n) === -1) out.push(n); });
  return out.length <= max ? out : null;
}
const _ownerSec = new Map();
async function ownerTwoStepOn(project, token, env) {
  const c = env.__firestoreBase ? null : _ownerSec.get(project);   // (the tests change it between calls)
  if (c && Date.now() - c.at < 60e3) return c.on;
  const url = (env.__firestoreBase || 'https://firestore.googleapis.com') + '/v1/projects/' + encodeURIComponent(project)
    + '/databases/(default)/documents/config/security';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000) });
  let on = false;
  if (r.ok) { try { on = fsValue((((await r.json()) || {}).fields || {}).ownerTwoStep) === true; } catch (e) { on = false; } }
  else if (r.status !== 404) throw new Error('the database answered ' + r.status);   // never "off" by mistake
  _ownerSec.set(project, { on, at: Date.now() });
  return on;
}
// v78 — the table is made once per isolate, and a known device's "last seen" is
// written at most hourly: the owner's open app asks every few minutes, and each
// of those was a D1 write (3,223 in two days, 18–19 Oct 2026).
async function ownerWatch(env, db, claims, body, request) {
  await tableOnce(db, 'owner_devices', 'CREATE TABLE IF NOT EXISTS owner_devices (email TEXT NOT NULL, device TEXT NOT NULL, first_at INTEGER, last_at INTEGER, '
    + 'ua TEXT, PRIMARY KEY (email, device))');
  const email = String(claims.email || '').toLowerCase(), now = Date.now(), op = String(body.op || 'list');
  const dev = /^[A-Za-z0-9-]{8,64}$/.test(String(body.device || '')) ? String(body.device) : 'unknown';
  const ua = String(request.headers.get('User-Agent') || '').slice(0, 200);
  const known = await db.prepare('SELECT last_at FROM owner_devices WHERE email = ?1 AND device = ?2').bind(email, dev).first();
  if (!known || !(Number(known.last_at) > now - 3600e3)) await db.prepare('INSERT INTO owner_devices (email, device, first_at, last_at, ua) VALUES (?1, ?2, ?3, ?3, ?4) '
    + 'ON CONFLICT (email, device) DO UPDATE SET last_at = excluded.last_at, ua = excluded.ua').bind(email, dev, now, ua).run();
  const cf = request.cf || {};
  const where = [cf.city, cf.country || request.headers.get('CF-IPCountry')].filter(Boolean).join(', ') || 'unknown place';
  const lines = ['Account: ' + email, 'Copy: ' + claims.aud, 'Device: ' + ua, 'From: ' + where, 'When: ' + ilTime(now) + ' (Israel time)'];   // v85 — his time, not UTC
  if (!known) await ownerAlert(env, 'My Kitchen Notes: the owner\'s tools were opened on a new device',
    ['Someone signed in as the app\'s owner opened the owner\'s tools on a device not seen before.'].concat(lines,
      ['', 'If this was you, there is nothing to do. If not: change your Google password, sign out of all devices at',
       'https://myaccount.google.com/device-activity and switch on the authenticator step in the app.']).join('\n'), { kind: 'new-device' });
  if (OWNER_DESTRUCTIVE.has(op)) await ownerAlert(env, 'My Kitchen Notes: owner action "' + op + '"',
    ['The app\'s owner did "' + op + '"' + (Array.isArray(body.ids) ? ' (' + body.ids.length + ' of them)' : '')   // v88 — a batch says how many
      + (body.hid ? ' on household ' + String(body.hid).slice(0, 64) : '') + (body.project ? ' in ' + String(body.project).slice(0, 40) : '') + '.']
      .concat(lines).join('\n'), { kind: 'owner-action' });
}
// v85 — which alerts also come on WhatsApp (Tony, 20 Oct 2026: "add to the Admin's Setting an option to separately
// enable/disable each of the alerts to be sent by Whatsapp. They should all be enabled by default"). Kept in D1
// `owner_prefs` ('whatsapp_off': the kinds switched off — so a kind added later starts on). E-mail is not affected; the
// owner's test alert ignores them. When D1 itself is what ran out, everything goes (unknown = on).
const ALERT_KINDS = [
  ['new-device', 'The owner\u2019s tools opened on a new device'],
  ['owner-action', 'An owner action that cannot be undone (a household deleted, an allowance changed…)'],
  ['near-limit', 'A free allowance near its limit (70%)'],
  ['limit-reached', 'A free allowance used up \u2014 something paused'],
  ['ai-service', 'The AI service refused (out of credit, its key, or Gemini\u2019s daily quota)'],
  ['household-ai', 'A household reached its AI allowance'],
  ['server-errors', 'The server answering with errors'],
  ['usage-check', 'The hourly usage check cannot read the figures']
];
function alertKindOf(n) {
  const w = String((n && n.what) || '');
  if (/^usage:workerErrors/.test(w)) return 'server-errors';
  if (/^usage:watch/.test(w)) return 'usage-check';
  if (/^(anthropic|gemini)/.test(w)) return 'ai-service';
  if (/^household-ai/.test(w)) return 'household-ai';
  return n && n.kind === 'paused' ? 'limit-reached' : 'near-limit';
}
async function whatsappOff(env) {
  if (!env.METER_DB) return {};
  try {
    await tableOnce(env.METER_DB, 'owner_prefs', 'CREATE TABLE IF NOT EXISTS owner_prefs (k TEXT PRIMARY KEY, v TEXT)');
    const row = await env.METER_DB.prepare("SELECT v FROM owner_prefs WHERE k = 'whatsapp_off'").first();
    const o = row ? JSON.parse(row.v || '{}') : {};
    return o && typeof o === 'object' ? o : {};
  } catch (e) { return {}; }
}
async function alertPrefsAnswer(env) {
  const off = await whatsappOff(env);
  return { ok: true, whatsappSet: !!(env.WHATSAPP_PHONE && env.WHATSAPP_KEY), ntfySet: !!env.NTFY_TOPIC, kinds: ALERT_KINDS.map(([key, label]) => ({ key, label, on: off[key] !== true })) };
}
async function ownerAlert(env, subject, text, opts) {
  const kindOff = opts && opts.kind ? (await whatsappOff(env))[opts.kind] === true : false;   // v85
  const quiet = (opts && opts.whatsapp === false) || kindOff;
  const wa = quiet ? false : await ownerWhatsApp(env, subject, text);   // v84
  const nt = quiet ? false : await ownerNtfy(env, subject, text);        // v91
  // v75 — every address in ALERT_TO (comma-separated): with a spare owner key, each owner hears what the
  // other did, so whoever controls one mailbox cannot hide the other account's actions.
  const tos = Array.from(new Set(String(env.ALERT_TO || '').split(',').map(x => x.trim()).filter(x => /^[^\s@<>]+@[^\s@<>]+$/.test(x))));
  if (!env.ALERTS || !tos.length) return wa || nt;
  const from = String(env.ALERT_FROM || ['alerts', 'mykitchennotes.community'].join('@'));   // v74 — not written out (harvested)
  const EmailMessage = env.__EmailMessage || (await import('cloudflare:email')).EmailMessage;
  let sent = 0;
  for (const to of tos) {
    const raw = ['From: My Kitchen Notes <' + from + '>', 'To: <' + to + '>', 'Subject: ' + subject.replace(/[^\x20-\x7E]/g, ''),
      'Date: ' + new Date().toUTCString(), 'Message-ID: <' + crypto.randomUUID() + '@' + from.split('@')[1] + '>',
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', text].join('\r\n');
    try { await env.ALERTS.send(new EmailMessage(from, to, raw)); sent++; } catch (e) {}   // one refused address must not stop the others
  }
  return sent > 0 || wa || nt;
}
// v91 — and to the owner's phone through ntfy (Tony, 25 Oct 2026: CallMeBot never answered; he chose ntfy). A POST to
// his private topic on ntfy.sh — the secret NTFY_TOPIC, set from the GitHub secret of that name; the topic name is the
// password, so it is never logged or shown. ntfy's server sees what is sent: the alert's title and its first line,
// every e-mail address masked; the rest stays in the e-mail. Without the secret: nothing.
const NTFY_URL = 'https://ntfy.sh/';
// v92 — the topic as ntfy wants it: a whole link (https://ntfy.sh/<topic>) is taken too. `_ntfyWhy` says why the last
// one did not go (the test alert shows it); never the topic itself.
let _ntfyWhy = '';
function ntfyTopic(env) {
  return String(env.NTFY_TOPIC || '').trim().replace(/^https?:\/\//i, '').replace(/^(www\.)?ntfy\.sh\//i, '').replace(/^\/+|\/+$/g, '').replace(/[?#].*$/, '');
}
async function ownerNtfy(env, subject, text) {
  _ntfyWhy = '';
  const topic = ntfyTopic(env);
  if (!topic) { _ntfyWhy = 'the GitHub secret NTFY_TOPIC is empty'; return false; }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(topic)) {
    _ntfyWhy = 'the topic in NTFY_TOPIC has a character ntfy does not take (only letters, digits, - and _, at most 64)'
      + (/\s/.test(topic) ? ' — it has a space' : /[^\x00-\x7f]/.test(topic) ? ' — it has a letter outside A–Z' : '');
    return false;
  }
  const mask = (v) => String(v || '').replace(/[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[A-Za-z]{2,}/g, '[e-mail]');
  const title = mask(String(subject || '').replace(/^My Kitchen Notes: /, '')).slice(0, 120) || 'My Kitchen Notes';
  const first = mask(String(text || '').split('\n').filter(Boolean)[0] || '').slice(0, 300);
  try {
    const headers = { 'Content-Type': 'application/json' };
    const tok = String(env.NTFY_TOKEN || '').trim();
    if (tok) headers.Authorization = 'Bearer ' + tok;   // v93 — the account's own allowance, not the shared address's
    const r = await (env.__fetch || fetch)(NTFY_URL, { method: 'POST', headers,
      body: JSON.stringify({ topic, title, message: (first ? first + '\n' : '') + '(the details are in your e-mail)', tags: ['bell'], priority: 4 }),
      signal: AbortSignal.timeout(10000) });
    if (r.ok) return true;
    let said = '', code = 0;
    try {
      const raw = await r.text();
      try { const j = JSON.parse(raw); said = String(j.error || ''); code = Number(j.code) || 0; } catch (e) { said = raw; }
      said = said.split(topic).join('[topic]').split(tok || '\u0000').join('[token]').replace(/\s+/g, ' ').slice(0, 160);
    } catch (e) {}
    _ntfyWhy = 'ntfy answered ' + r.status + (said ? ': ' + said : '')
      + (r.status === 429 && !tok ? ' — ntfy.sh counts messages by the sending address, which this server shares with many others; '
         + 'a free ntfy account\'s access token in the GitHub secret NTFY_TOKEN gives it an allowance of its own' : '')
      + (r.status === 401 || r.status === 403 ? ' — check the access token in the GitHub secret NTFY_TOKEN' : '');
    return false;
  } catch (e) { _ntfyWhy = 'ntfy could not be reached (' + String((e && e.message) || e).slice(0, 80) + ')'; return false; }
}
// v84 — and on WhatsApp (Tony, 20 Oct 2026: "Whatsapp is actually better for me"), through CallMeBot's free service:
// a message to the owner's own number, with the key CallMeBot gave him on it. The Worker's secrets WHATSAPP_PHONE and
// WHATSAPP_KEY (from the GitHub secrets of those names); without them, e-mail only. Never logged.
async function ownerWhatsApp(env, subject, text) {
  const phone = String(env.WHATSAPP_PHONE || '').replace(/[^\d+]/g, ''), key = String(env.WHATSAPP_KEY || '').trim();
  if (phone.replace(/\D/g, '').length < 8 || !key) return false;
  const msg = ('*' + String(subject || '').replace(/^My Kitchen Notes: /, '') + '*\n' + String(text || '')).slice(0, 1000);
  try {
    const r = await (env.__fetch || fetch)('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone)
      + '&text=' + encodeURIComponent(msg) + '&apikey=' + encodeURIComponent(key), { signal: AbortSignal.timeout(15000) });
    const body = await r.text().catch(() => '');
    return r.ok && !/APIKey is invalid|not (?:a )?valid|error/i.test(body.slice(0, 2000));
  } catch (e) { return false; }
}
let _alertTestAt = 0;
async function meterMembership(claims, hid, token, env) {
  const k = claims.aud + '/' + hid + '/' + claims.sub, c = _meterMembers.get(k);
  if (c && Date.now() - c.at < 600e3) return c;
  const base = (env.__firestoreBase || 'https://firestore.googleapis.com') + '/v1/projects/' + encodeURIComponent(claims.aud)
    + '/databases/(default)/documents/households/' + encodeURIComponent(hid);
  const h = { Authorization: 'Bearer ' + token };
  const [m, hh] = await Promise.all([
    fetch(base + '/members/' + encodeURIComponent(claims.sub), { headers: h, signal: AbortSignal.timeout(8000) }),
    fetch(base, { headers: h, signal: AbortSignal.timeout(8000) })]);
  if (m.status === 403 || m.status === 404) return { member: false };   // not remembered: they may join any minute
  if (!m.ok) throw new Error('the household could not be checked (' + m.status + ')');
  let role = '';
  try { role = String(fsValue((((await m.json()) || {}).fields || {}).role) || ''); } catch (e) {}   // v63
  let f = {};
  try { if (hh.ok) f = ((await hh.json()) || {}).fields || {}; } catch (e) {}
  const v = { member: true, role, name: String(fsValue(f.name) || '').slice(0, 80), code: String(fsValue(f.code) || ''),
              created: Number(fsValue(f.createdAt)) || null, at: Date.now() };
  _meterMembers.set(k, v);
  return v;
}
let _meterReady = false;
async function meterDb(env) {
  const db = env.METER_DB;
  if (!db) return null;
  if (!_meterReady) {
    await db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS ai_spend (project TEXT NOT NULL, hid TEXT NOT NULL, month TEXT NOT NULL, '
        + 'usd REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (project, hid, month))'),
      db.prepare('CREATE TABLE IF NOT EXISTS ai_households (project TEXT NOT NULL, hid TEXT NOT NULL, name TEXT, code TEXT, '
        + 'created_at INTEGER, first_seen INTEGER, last_seen INTEGER, cap REAL, note TEXT, PRIMARY KEY (project, hid))')
    ]);
    _meterReady = true;
  }
  return db;
}
function allowanceResp(msg, status) {
  return jsonResp({ error: 'AI_ALLOWANCE: ' + msg, rateLimited: true, allowance: true }, status || 429);
}
function capFor(row, month, env, project) {
  if (row && typeof row.cap === 'number') return row.cap;                    // set in the management app
  const own = projectCap(project, env);                                      // v67 — the copy's own (the family's)
  if (own !== null) return own;
  const started = row && (row.created_at || row.first_seen);
  const first = !started || utcMonthKey(started) === month;
  return first ? (parseFloat(env.AI_CAP_FIRST_USD) || AI_CAP_FIRST_USD_DEFAULT)
               : (parseFloat(env.AI_CAP_USD) || AI_CAP_USD_DEFAULT);
}
// Before an AI call: who, which household, and is there allowance left.
// → { resp } to refuse, { ctx } to count, {} to go ahead uncounted.
async function meterStart(request, env, body) {
  const token = body.idToken, hid = body.hid;
  const origin = request.headers.get('Origin') || '';
  const cappedOrigin = csvList(env.CAPPED_ORIGINS, CAPPED_ORIGINS_DEFAULT).includes(origin);
  if (!env.METER_DB) return {};
  // v66 — on EVERY copy: no sign-in, no AI (the family's address and the app
  // key are public, so they prove nothing).
  if (!token || !hid) return { resp: allowanceResp('sign in to use the AI — it is counted per household.', 401) };
  let aud = '';
  try { aud = jwtPart(String(token).split('.')[1]).aud || ''; } catch (e) {}
  // v67 — capped: has an allowance. strict: also refuses when it cannot count.
  const strict = isStrict(aud, env) || cappedOrigin;
  const capped = strict || projectCap(aud, env) !== null;
  // Who is asking must be proved before anything else — on every copy.
  let claims, hh;
  try {
    if (!/^[A-Za-z0-9]{1,64}$/.test(String(hid))) throw new Error('not a household');
    claims = await verifyIdToken(token, env);
  } catch (e) {
    return { resp: allowanceResp('the AI could not be checked against your household\'s allowance ('
      + (e && e.message) + '). Reload the app and try again.', 403) };
  }
  try {
    hh = await meterMembership(claims, hid, token, env);
  } catch (e) {
    // The household could not be READ (Firestore did not answer): a strict copy
    // refuses; the family's carries on for a proven sign-in, as before.
    if (strict) return { resp: allowanceResp('the AI could not be checked against your household\'s allowance ('
      + (e && e.message) + '). Reload the app and try again.', 403) };
    return {};
  }
  if (!hh.member) return { resp: allowanceResp('the AI could not be checked against your household\'s allowance (you are not in that household). Reload the app and try again.', 403) };
  try {
    const db = await meterDb(env), month = utcMonthKey(Date.now());
    const row = await db.prepare('SELECT h.cap, h.created_at, h.first_seen, s.usd FROM (SELECT 1) LEFT JOIN ai_households h '
      + 'ON h.project = ?1 AND h.hid = ?2 LEFT JOIN ai_spend s ON s.project = ?1 AND s.hid = ?2 AND s.month = ?3')
      .bind(claims.aud, hid, month).first() || {};
    if (!row.created_at && hh.created) row.created_at = hh.created;
    const spent = row.usd || 0, cap = capFor(row, month, env, claims.aud);
    const ctx = { db, project: claims.aud, hid, month, capped, cap, spent, name: hh.name, code: hh.code, created: hh.created };
    if (capped && spent >= cap) {
      await raiseNotice(env, { what: 'household-ai:' + claims.aud + ':' + hid, kind: 'warning', scope: 'owner', project: claims.aud,   // v79
        until: nextUtcMonth(Date.now()), self: true,
        title: 'The household "' + String(hh.name || hid).slice(0, 60) + '" used its AI allowance for ' + month,
        affects: 'AI features in that household (everything else keeps working)',
        detail: '$' + spent.toFixed(2) + ' of $' + cap.toFixed(2) + '. It renews on the 1st; you can change it in 👑 App owner → 📊 Households.' });
      return { resp: allowanceResp('this month\'s AI allowance for your household is used up ($' + spent.toFixed(2)
        + ' of $' + cap.toFixed(2) + '). It renews on the 1st; everything that does not use the AI keeps working.') };
    }
    return { ctx };
  } catch (e) {
    // Spend that cannot be counted is what an allowance exists to stop — on a
    // strict copy. The family's carries on (v67: it has an allowance, not strict).
    if (strict) return { resp: allowanceResp('the AI could not be checked against your household\'s allowance ('
      + (e && e.message) + '). Reload the app and try again.', 403) };
    return {};
  }
}
// After the answer: add what it cost, and note the household.
async function meterAdd(env, ctx, model, usage) {
  const usd = aiCostUsd(model, usage), now = Date.now();
  try {
    await ctx.db.batch([
      ctx.db.prepare('INSERT INTO ai_spend (project, hid, month, usd, calls) VALUES (?1, ?2, ?3, ?4, 1) '
        + 'ON CONFLICT (project, hid, month) DO UPDATE SET usd = usd + excluded.usd, calls = calls + 1')
        .bind(ctx.project, ctx.hid, ctx.month, usd),
      ctx.db.prepare('INSERT INTO ai_households (project, hid, name, code, created_at, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6) '
        + 'ON CONFLICT (project, hid) DO UPDATE SET name = excluded.name, code = excluded.code, '
        + 'created_at = COALESCE(excluded.created_at, created_at), last_seen = excluded.last_seen')
        .bind(ctx.project, ctx.hid, ctx.name || null, ctx.code || null, ctx.created || null, now)
    ]);
  } catch (e) {}
  return { usd: ctx.spent + usd, cap: ctx.capped ? ctx.cap : null };
}
// `meter-me` — this household's month so far (Sync Health); `meter-admin` —
// every household's, and setting a cap (the management app; owner only).
async function meterAction(request, env, body) {
  if (!env.METER_DB) return jsonResp({ error: 'METER: not set up on this Worker (METER_DB).', needsConfig: true }, 503);
  let claims;
  try { claims = await verifyIdToken(body.idToken, env); }
  catch (e) { return jsonResp({ error: 'METER: your sign-in could not be checked (' + e.message + ').' }, 401); }
  const db = await meterDb(env), month = utcMonthKey(Date.now());
  const capped = isCapped(claims.aud, env);
  if (body.action === 'meter-me') {
    const hid = String(body.hid || '');
    let hh;
    try { hh = await meterMembership(claims, hid, body.idToken, env); } catch (e) { return jsonResp({ error: 'METER: ' + e.message }, 502); }
    if (!hh.member) return jsonResp({ error: 'METER: you are not in that household.' }, 403);
    const row = await db.prepare('SELECT h.cap, h.created_at, h.first_seen, s.usd, s.calls FROM (SELECT 1) LEFT JOIN ai_households h '
      + 'ON h.project = ?1 AND h.hid = ?2 LEFT JOIN ai_spend s ON s.project = ?1 AND s.hid = ?2 AND s.month = ?3')
      .bind(claims.aud, hid, month).first() || {};
    if (!row.created_at && hh.created) row.created_at = hh.created;
    return jsonResp({ month, usd: row.usd || 0, calls: row.calls || 0, cap: capped ? capFor(row, month, env, claims.aud) : null });
  }
  // meter-admin
  const owners = ownerEmails(env);
  if (!claims.email_verified || !owners.length || !owners.includes(String(claims.email || '').toLowerCase()))
    return jsonResp({ error: 'METER: only the app\'s owner may see this.' }, 403);
  // v73 — with Google; with the authenticator once he switched it on; recently, for what cannot be undone.
  const fb = claims.firebase || {};
  if (fb.sign_in_provider !== 'google.com')
    return jsonResp({ error: 'METER: the owner\'s tools need a sign-in with Google (not an e-mail link or a password).', needGoogle: true }, 403);
  let twoStep;
  try { twoStep = await ownerTwoStepOn(claims.aud, body.idToken, env); }
  catch (e) { return jsonResp({ error: 'METER: could not check the owner\'s two-step setting (' + e.message + ') — try again.' }, 502); }
  if (twoStep && fb.sign_in_second_factor !== 'totp')
    return jsonResp({ error: 'METER: the owner\'s tools need a sign-in with the code from your authenticator app.', needTwoStep: true }, 403);
  if (OWNER_DESTRUCTIVE.has(String(body.op || '')) && !(Number(claims.auth_time) > Date.now() / 1000 - 900))
    return jsonResp({ error: 'REAUTH: confirm it is you — sign in again, then do it once more.', reauth: true }, 401);
  try { await ownerWatch(env, db, claims, body, request); } catch (e) {}
  // v62 — the owner's page in one copy manages another copy's households.
  const projects = csvList(env.METER_PROJECTS, METER_PROJECTS_DEFAULT);
  const proj = body.project == null || body.project === '' ? claims.aud : String(body.project);
  if (!projects.includes(proj)) return jsonResp({ error: 'METER: not a copy this server serves.' }, 400);
  // v63 — the owner deleted it from the management page: it stays listed,
  // marked (Tony: "do not remove these entries"); its spending stays too.
  if (body.op === 'mark-deleted' || body.op === 'forget') {
    const hid = String(body.hid || '');
    if (!/^[A-Za-z0-9]{1,64}$/.test(hid)) return jsonResp({ error: 'METER: which household?' }, 400);
    await reportsTable(db);
    await markDeleted(db, proj, hid, { by: String(claims.email || ''), how: 'admin', name: body.name, code: body.code, report: body.report });
    return jsonResp({ ok: true });
  }
  if (body.op === 'set-cap') {
    const hid = String(body.hid || ''), cap = body.cap === null || body.cap === '' ? null : Number(body.cap);
    if (!/^[A-Za-z0-9]{1,64}$/.test(hid) || (cap !== null && !(cap >= 0 && cap <= 1000))) return jsonResp({ error: 'METER: a household and an amount from 0 to 1000.' }, 400);
    await db.batch([
      db.prepare('INSERT INTO ai_households (project, hid, cap, note) VALUES (?1, ?2, ?3, ?4) '
        + 'ON CONFLICT (project, hid) DO UPDATE SET cap = excluded.cap, note = COALESCE(excluded.note, note)')
        .bind(proj, hid, cap, typeof body.note === 'string' ? body.note.slice(0, 500) : null)
    ]);
    return jsonResp({ ok: true, hid, cap });
  }
  if (/^note|^notes/.test(String(body.op || ''))) { const fr = await feedbackAdmin(env, db, body, claims); if (fr) return fr; }
  if (/^error/.test(String(body.op || ''))) { const er = await signalsAdmin(env, db, body); if (er) return er; }   // v69
  // v76 — every copy's counts, added up by month and name, with how many households each came from.
  // v79 — the owner's 🩺 Server allowances: the usage watch's last reading and every notice running.
  // v85 — which alerts also come on WhatsApp: read, and set (only the known kinds; anything not false is on)
  if (body.op === 'alert-prefs') return jsonResp(await alertPrefsAnswer(env));
  if (body.op === 'alert-prefs-set') {
    const p = body.prefs && typeof body.prefs === 'object' && !Array.isArray(body.prefs) ? body.prefs : null;
    if (!p) return jsonResp({ error: 'ALERTS: which alerts?' }, 400);
    const off = {};
    ALERT_KINDS.forEach(([key]) => { if (p[key] === false) off[key] = true; });
    await tableOnce(db, 'owner_prefs', 'CREATE TABLE IF NOT EXISTS owner_prefs (k TEXT PRIMARY KEY, v TEXT)');
    await db.prepare("INSERT INTO owner_prefs (k, v) VALUES ('whatsapp_off', ?1) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(JSON.stringify(off)).run();
    return jsonResp(await alertPrefsAnswer(env));
  }
  // v84 — "Send me a test alert" (the owner's 🩺 page): proves the e-mail and WhatsApp reach him. Once a minute.
  if (body.op === 'alert-test') {
    if (Date.now() - _alertTestAt < 60e3) return jsonResp({ error: 'ALERTS: a test was sent less than a minute ago.' }, 429);
    _alertTestAt = Date.now();
    const wa = await ownerWhatsApp(env, 'A test alert', 'If you can read this, the server can reach you here. Sent from the app at ' + ilTime(Date.now()) + ' (Israel time).');
    const nt = await ownerNtfy(env, 'A test alert', 'If you can read this, the server can reach you in ntfy. Sent at ' + ilTime(Date.now()) + ' (Israel time).');   // v91
    const ntWhy = nt ? '' : _ntfyWhy;   // v92
    const mailTo = String(env.ALERT_TO || '').split(',').filter(x => /@/.test(x)).length;
    let mailed = false;
    if (env.ALERTS && mailTo) mailed = await ownerAlert(env, 'My Kitchen Notes: a test alert',
      'If you can read this, the server can reach you by e-mail. Sent from the app at ' + ilTime(Date.now()) + ' (Israel time).'
      + (env.NTFY_TOPIC ? '\n\nntfy (the phone): ' + (nt ? 'sent.' : 'NOT delivered — ' + ntWhy + '.') : ''), { whatsapp: false });
    return jsonResp({ ok: true, whatsapp: wa, whatsappSet: !!(env.WHATSAPP_PHONE && env.WHATSAPP_KEY), ntfy: nt, ntfySet: !!env.NTFY_TOPIC, ntfyToken: !!env.NTFY_TOKEN, ntfyWhy: ntWhy, mail: mailed, mailTo });
  }
  if (body.op === 'allowances') {
    return jsonResp({ ok: true, usage: await usageSnapshot(env), notices: await serverNotices(env, { owner: true }), watch: !!env.USAGE_KEY,
                      appReads: await appReadsToday(env), links: await linkStats(env) });   // v83, v87
  }
  if (body.op === 'trends') {
    await signalsTable(db);
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 23);
    const since = utcMonthKey(d.getTime());
    const rows = (await db.prepare('SELECT project, month, k, SUM(n) AS n, COUNT(DISTINCT hid) AS households FROM usage_counts '
      + 'WHERE month >= ?1 GROUP BY project, month, k ORDER BY project, month, k').bind(since).all()).results || [];
    const counted = (await db.prepare('SELECT project, month, COUNT(DISTINCT hid) AS households FROM usage_counts '
      + 'WHERE month >= ?1 GROUP BY project, month').bind(since).all()).results || [];
    return jsonResp({ since, rows, counted });
  }
  if (/^survey-/.test(String(body.op || ''))) { const sv = await surveyAdmin(env, db, body, proj); if (sv) return sv; }   // v71
  // v72 — the family moved here: its households' allowances and history come too.
  if (body.op === 'copy-from') {
    const from = String(body.from || '');
    if (!projects.includes(from) || from === proj) return jsonResp({ error: 'METER: copy from which other copy?' }, 400);
    await reportsTable(db); await signalsTable(db);
    const fromCap = projectCap(from, env);
    const hs = (await db.prepare('SELECT hid, name, code, created_at, first_seen, last_seen, cap, note FROM ai_households WHERE project = ?1').bind(from).all()).results || [];
    const n = { households: 0, months: 0, reports: 0, counts: 0 };
    for (const h of hs) {
      const r = await db.prepare('INSERT OR IGNORE INTO ai_households (project, hid, name, code, created_at, first_seen, last_seen, cap, note) '
        + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
        .bind(proj, h.hid, h.name, h.code, h.created_at, h.first_seen, h.last_seen,
              typeof h.cap === 'number' ? h.cap : fromCap, h.note).run();
      n.households += (r.meta && r.meta.changes) || 0;
    }
    const r1 = await db.prepare('INSERT OR IGNORE INTO ai_spend (project, hid, month, usd, calls) SELECT ?1, hid, month, usd, calls FROM ai_spend WHERE project = ?2').bind(proj, from).run();
    const r2 = await db.prepare('INSERT OR IGNORE INTO hh_reports (project, hid, summary, at) SELECT ?1, hid, summary, at FROM hh_reports WHERE project = ?2').bind(proj, from).run();
    const r3 = await db.prepare('INSERT OR IGNORE INTO usage_counts (project, hid, month, k, n) SELECT ?1, hid, month, k, n FROM usage_counts WHERE project = ?2').bind(proj, from).run();
    n.months = (r1.meta && r1.meta.changes) || 0; n.reports = (r2.meta && r2.meta.changes) || 0; n.counts = (r3.meta && r3.meta.changes) || 0;
    return jsonResp({ ok: true, copied: n, of: hs.length });
  }
  if (body.op === 'set-note') {
    const hid = String(body.hid || '');
    if (!/^[A-Za-z0-9]{1,64}$/.test(hid)) return jsonResp({ error: 'METER: which household?' }, 400);
    await db.prepare('INSERT INTO ai_households (project, hid, note) VALUES (?1, ?2, ?3) ON CONFLICT (project, hid) DO UPDATE SET note = excluded.note')
      .bind(proj, hid, String(body.note || '').slice(0, 500)).run();
    return jsonResp({ ok: true });
  }
  // list: every household this copy has counted, and its last three months.
  // v62 — `all: true`: every copy's, counted or reported, each with its project.
  const months = [0, 1, 2].map(i => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return utcMonthKey(d.getTime()); });
  const want = body.all ? projects : [claims.aud];
  await reportsTable(db);
  await signalsTable(db);   // v69 — each household's feature counts
  const out = [];
  for (const p of want) {
    const pCapped = isCapped(p, env);
    const hs = (await db.prepare('SELECT hid, name, code, created_at, first_seen, last_seen, cap, note FROM ai_households WHERE project = ?1')
      .bind(p).all()).results || [];
    const sp = (await db.prepare('SELECT hid, month, usd, calls FROM ai_spend WHERE project = ?1 AND month >= ?2')
      .bind(p, months[2]).all()).results || [];
    const reps = body.all ? ((await db.prepare('SELECT hid, summary, at FROM hh_reports WHERE project = ?1').bind(p).all()).results || []) : [];
    const byHid = new Map();
    hs.forEach(h => byHid.set(h.hid, Object.assign({}, h)));
    reps.forEach(r => {
      let sum = null;
      try { sum = JSON.parse(r.summary); } catch (e) {}
      const h = byHid.get(r.hid) || { hid: r.hid, name: null, code: null, created_at: null, first_seen: null, last_seen: null, cap: null, note: null };
      h.report = sum; h.reportAt = r.at;
      if (sum) { if (!h.name) h.name = sum.name || null; if (!h.code) h.code = sum.code || null; if (!h.created_at) h.created_at = sum.createdAt || null; }
      byHid.set(r.hid, h);
    });
    const use = (await db.prepare('SELECT hid, month, k, n FROM usage_counts WHERE project = ?1 AND month >= ?2')
      .bind(p, months[2]).all()).results || [];
    byHid.forEach(h => {
      const mine = sp.filter(s => s.hid === h.hid);
      // v69 — what it used, by month: { 'YYYY-MM': { feature: times } }
      const u = {};
      use.filter(x => x.hid === h.hid).forEach(x => { (u[x.month] = u[x.month] || {})[x.k] = x.n; });
      if (Object.keys(u).length) h.usage = u;
      out.push(Object.assign(h, {
        project: p, capped: pCapped,
        capNow: pCapped ? capFor(h, month, env, p) : null,
        months: months.map(m => { const s = mine.filter(x => x.month === m)[0]; return { month: m, usd: s ? s.usd : 0, calls: s ? s.calls : 0 }; })
      }));
    });
  }
  return jsonResp({ project: claims.aud, capped, month, months, households: out, projects: want,
    defaults: { cap: parseFloat(env.AI_CAP_USD) || AI_CAP_USD_DEFAULT, firstMonth: parseFloat(env.AI_CAP_FIRST_USD) || AI_CAP_FIRST_USD_DEFAULT,
                byProject: Object.fromEntries(projects.map(q => [q, projectCap(q, env)]).filter(x => x[1] !== null)) } });   // v67
}

// ─── ONE HOUSEHOLDS PAGE (v62) ───────────────────────────────────────────────
// Each copy's households live in that copy's own Firebase project, which the
// owner's page in another copy cannot read. So a household tells this Worker
// about itself — a member's app sends a short summary at most once a day —
// and the owner's page (`meter-admin` list, `all: true`) lists every copy's.
// Only what the page shows is kept: no recipes, no notes.
let _reportsReady = false;
async function reportsTable(db) {
  if (!_reportsReady) {
    await db.prepare('CREATE TABLE IF NOT EXISTS hh_reports (project TEXT NOT NULL, hid TEXT NOT NULL, summary TEXT, at INTEGER, '
      + 'PRIMARY KEY (project, hid))').run();
    _reportsReady = true;
  }
}
function reportSummary(r) {
  r = r || {};
  const str = (v, max) => String(v == null ? '' : v).slice(0, max);
  const num = v => (typeof v === 'number' && isFinite(v) && v > 0) ? Math.floor(v) : null;
  const okId = v => /^[A-Za-z0-9]{1,64}$/.test(String(v || ''));
  return {
    name: str(r.name, 80), code: str(r.code, 20), createdAt: num(r.createdAt), referredBy: str(r.referredBy, 20) || null,
    members: (Array.isArray(r.members) ? r.members : []).slice(0, 200).map(m => ({
      uid: okId(m && m.uid) ? m.uid : null, email: str(m && m.email, 200), name: str(m && m.name, 120),
      role: str(m && m.role, 20), lastSeen: num(m && m.lastSeen), joinedAt: num(m && m.joinedAt),
      termsAt: num(m && m.termsAt), termsVersion: str(m && m.termsVersion, 20) || null })),   // v65
    left: [],
    links: (Array.isArray(r.links) ? r.links : []).slice(0, 100).filter(l => l && okId(l.hid)).map(l => ({
      hid: l.hid, name: str(l.name, 80), code: str(l.code, 20) })),
    referrals: num(r.referrals) || 0,
    recipes: num(r.recipes)          // v76 — how big the collection is (a number only)
  };
}
async function householdReport(request, env, body) {
  if (!env.METER_DB) return jsonResp({ error: 'REPORT: not set up on this Worker (METER_DB).', needsConfig: true }, 503);
  const hid = String(body.hid || '');
  if (!/^[A-Za-z0-9]{1,64}$/.test(hid)) return jsonResp({ error: 'REPORT: which household?' }, 400);
  let claims;
  try { claims = await verifyIdToken(body.idToken, env); }
  catch (e) { return jsonResp({ error: 'REPORT: your sign-in could not be checked (' + e.message + ').' }, 401); }
  let hh;
  try { hh = await meterMembership(claims, hid, body.idToken, env); } catch (e) { return jsonResp({ error: 'REPORT: ' + e.message }, 502); }
  if (!hh.member) return jsonResp({ error: 'REPORT: you are not in that household.' }, 403);
  const db = await meterDb(env);
  await reportsTable(db);
  // v63 — its owner is deleting it (the household, or their account with
  // it): it stays on the owner's page, marked. Only its owner may say so.
  if (body.gone) {
    if (hh.role !== 'owner') return jsonResp({ error: 'REPORT: only its owner deletes a household.' }, 403);
    await markDeleted(db, claims.aud, hid, { by: String(claims.email || ''), how: body.how === 'account' ? 'account' : 'household',
      name: hh.name, code: hh.code, created: hh.created, report: body.report });
    return jsonResp({ ok: true, gone: true });
  }
  const old = await reportRow(db, claims.aud, hid);
  // v63 — a member deleting their account: noted under the household.
  if (body.left) {
    const sum0 = old || reportSummary(body.report);
    const who = String(claims.email || '').slice(0, 200);
    sum0.members = (sum0.members || []).filter(m => m.uid !== claims.sub && (!who || m.email !== who));
    sum0.left = (sum0.left || []).concat([{ email: who, at: Date.now(), how: 'account' }]).slice(-50);
    if (hh.name) sum0.name = hh.name;
    if (hh.code) sum0.code = hh.code;
    await putReport(db, claims.aud, hid, sum0);
    return jsonResp({ ok: true, left: true });
  }
  const sum = reportSummary(body.report);
  if (old && old.left) sum.left = old.left;      // who left stays
  if (hh.name) sum.name = hh.name;               // what Firestore says wins
  if (hh.code) sum.code = hh.code;
  if (hh.created) sum.createdAt = hh.created;
  if (JSON.stringify(sum).length > 65536) return jsonResp({ error: 'REPORT: too large.' }, 413);
  await putReport(db, claims.aud, hid, sum);
  return jsonResp({ ok: true });
}
async function reportRow(db, project, hid) {
  const r = await db.prepare('SELECT summary FROM hh_reports WHERE project = ?1 AND hid = ?2').bind(project, hid).first();
  try { return r && r.summary ? JSON.parse(r.summary) : null; } catch (e) { return null; }
}
async function putReport(db, project, hid, sum) {
  await db.prepare('INSERT INTO hh_reports (project, hid, summary, at) VALUES (?1, ?2, ?3, ?4) '
    + 'ON CONFLICT (project, hid) DO UPDATE SET summary = excluded.summary, at = excluded.at')
    .bind(project, hid, JSON.stringify(sum), Date.now()).run();
}
// Kept, marked: who deleted it, when, and how (household | account | admin).
async function markDeleted(db, project, hid, o) {
  let sum = await reportRow(db, project, hid);
  if (!sum) sum = reportSummary(o.report || {});
  if (o.name) sum.name = String(o.name).slice(0, 80);
  if (o.code) sum.code = String(o.code).slice(0, 20);
  if (o.created && !sum.createdAt) sum.createdAt = o.created;
  if (!sum.deletedAt) { sum.deletedAt = Date.now(); sum.deletedBy = String(o.by || '').slice(0, 200); sum.deletedHow = o.how; }
  await putReport(db, project, hid, sum);
}

// ─── NOTES FROM TESTERS, ONE INBOX (v61) ─────────────────────────────────────
// The app's 💬 note (v37.64) was kept in each copy's own database, so a note
// sent from the beta was only visible in the beta's management page — Tony
// reads the family app. Now every copy sends it HERE, into the same D1
// database as the AI counts (METER_DB, table `feedback`), and the owner's
// Feedback tab in ANY copy lists them all, with the copy each came from.
// Who sent it is proved as for AI (the Firebase sign-in, checked here).
async function feedbackTable(db) {
  if (!_feedbackReady) {
    await db.prepare('CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, uid TEXT, email TEXT, '
      + 'name TEXT, hid TEXT, household TEXT, text TEXT, shot TEXT, log TEXT, version TEXT, env TEXT, device TEXT, lang TEXT, '
      + 'at INTEGER, status TEXT)').run();
    // v68 — the owner's answers, each for one person in one copy.
    await db.prepare('CREATE TABLE IF NOT EXISTS feedback_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, note_id INTEGER, project TEXT, '
      + 'uid TEXT, text TEXT, note_text TEXT, note_at INTEGER, from_email TEXT, at INTEGER, read_at INTEGER)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS feedback_replies_to ON feedback_replies (project, uid)').run();
    _feedbackReady = true;
  }
}
let _feedbackReady = false;
async function feedbackSend(request, env, body) {
  if (!env.METER_DB) return jsonResp({ error: 'FEEDBACK: not set up on this Worker (METER_DB).', needsConfig: true }, 503);
  let claims;
  try { claims = await verifyIdToken(body.idToken, env); }
  catch (e) { return jsonResp({ error: 'FEEDBACK: your sign-in could not be checked (' + e.message + ').' }, 401); }
  const n = body.note || {}, str = (v, max) => String(v == null ? '' : v).slice(0, max);
  const text = str(n.text, 5000).trim();
  if (!text) return jsonResp({ error: 'FEEDBACK: the note is empty.' }, 400);
  const shot = str(n.shot, 750000);
  if (shot && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(shot)) return jsonResp({ error: 'FEEDBACK: the screenshot is not a picture.' }, 400);
  const db = await meterDb(env);
  await feedbackTable(db);
  const r = await db.prepare('INSERT INTO feedback (project, uid, email, name, hid, household, text, shot, log, version, env, device, lang, at, status) '
    + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, \'new\')')
    .bind(claims.aud, claims.sub, str(claims.email, 200), str(n.name, 120), str(n.hid, 64), str(n.household, 120), text, shot,
          str(n.log, 200000), str(n.version, 20), str(n.env, 20), str(n.device, 300), str(n.lang, 10), Date.now()).run();
  return jsonResp({ ok: true, id: (r && r.meta && r.meta.last_row_id) || null });
}
// The owner's side, through meter-admin: notes (newest 300, every copy),
// note-status, note-delete, notes-new (how many are new).
async function feedbackAdmin(env, db, body, claims) {
  await feedbackTable(db);
  if (body.op === 'notes') {
    const rows = (await db.prepare('SELECT id, project, uid, email, name, hid, household, text, shot, log, version, env, device, lang, at, status '
      + 'FROM feedback ORDER BY at DESC LIMIT 300').all()).results || [];
    // v68 — the answers sent to these notes, and whether each has been read.
    const replies = (await db.prepare('SELECT id, note_id, text, at, read_at FROM feedback_replies '
      + 'WHERE note_id IN (SELECT id FROM feedback ORDER BY at DESC LIMIT 300) ORDER BY at').all()).results || [];
    return jsonResp({ notes: rows, replies });
  }
  // v64 — a note kept in a copy's own database (before the inbox, or by an
  // app that thought it missing), moved here by the owner's app. Its writer,
  // time and copy are kept as they were; the same note twice is kept once.
  if (body.op === 'notes-import') {
    const n = body.note || {}, str = (v, max) => String(v == null ? '' : v).slice(0, max);
    const project = String(body.project || '');
    if (!csvList(env.METER_PROJECTS, METER_PROJECTS_DEFAULT).includes(project)) return jsonResp({ error: 'FEEDBACK: not a copy this server serves.' }, 400);
    const text = str(n.text, 5000).trim(), at = Number(n.at) || Date.now();
    if (!text) return jsonResp({ error: 'FEEDBACK: the note is empty.' }, 400);
    const shot = str(n.shot, 750000);
    if (shot && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(shot)) return jsonResp({ error: 'FEEDBACK: the screenshot is not a picture.' }, 400);
    const dup = await db.prepare('SELECT id FROM feedback WHERE project = ?1 AND uid = ?2 AND at = ?3 AND text = ?4')
      .bind(project, str(n.uid, 128), at, text).first();
    if (dup) return jsonResp({ ok: true, id: dup.id, already: true });
    const st = ['new', 'seen', 'done'].indexOf(n.status) === -1 ? 'new' : n.status;
    const r = await db.prepare('INSERT INTO feedback (project, uid, email, name, hid, household, text, shot, log, version, env, device, lang, at, status) '
      + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)')
      .bind(project, str(n.uid, 128), str(n.email, 200), str(n.name, 120), str(n.hid, 64), str(n.household, 120), text, shot,
            str(n.log, 200000), str(n.version, 20), str(n.env, 20), str(n.device, 300), str(n.lang, 10), at, st).run();
    return jsonResp({ ok: true, id: (r && r.meta && r.meta.last_row_id) || null });
  }
  // v88 — several at once: one statement, one alert
  if (body.op === 'notes-delete') {
    const ids = idBatch(body.ids);
    if (!ids || !ids.length) return jsonResp({ error: 'FEEDBACK: which notes? (1 to 100 at a time)' }, 400);
    const r = await db.prepare('DELETE FROM feedback WHERE id IN (' + ids.map((_, i) => '?' + (i + 1)).join(', ') + ')').bind(...ids).run();
    return jsonResp({ ok: true, deleted: (r && r.meta && r.meta.changes) != null ? r.meta.changes : ids.length });
  }
  if (body.op === 'notes-status') {       // v89 — several marked seen or done: one statement
    const ids = idBatch(body.ids, 99);
    if (!ids || !ids.length) return jsonResp({ error: 'FEEDBACK: which notes? (1 to 99 at a time)' }, 400);
    if (['new', 'seen', 'done'].indexOf(body.status) === -1) return jsonResp({ error: 'FEEDBACK: new, seen or done.' }, 400);
    const r = await db.prepare('UPDATE feedback SET status = ?1 WHERE id IN (' + ids.map((_, i) => '?' + (i + 2)).join(', ') + ')').bind(body.status, ...ids).run();
    return jsonResp({ ok: true, changed: (r && r.meta && r.meta.changes) != null ? r.meta.changes : ids.length });
  }
  if (body.op === 'notes-new') {
    const r = await db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'").first();
    return jsonResp({ new: (r && r.n) || 0, server: await serverNotices(env, { owner: true }) });   // v78/v79 — every allowance notice
  }
  const id = parseInt(body.id, 10);
  if (!(id > 0)) return jsonResp({ error: 'FEEDBACK: which note?' }, 400);
  if (body.op === 'note-status') {
    if (['new', 'seen', 'done'].indexOf(body.status) === -1) return jsonResp({ error: 'FEEDBACK: new, seen or done.' }, 400);
    await db.prepare('UPDATE feedback SET status = ?1 WHERE id = ?2').bind(body.status, id).run();
    return jsonResp({ ok: true });
  }
  if (body.op === 'note-delete') {
    await db.prepare('DELETE FROM feedback WHERE id = ?1').bind(id).run();
    return jsonResp({ ok: true });
  }
  // v68 — an answer, kept for the note's writer (their copy, their account).
  // A new note is marked seen: it has been read to be answered.
  if (body.op === 'note-reply') {
    const text = String(body.text == null ? '' : body.text).slice(0, 5000).trim();
    if (!text) return jsonResp({ error: 'FEEDBACK: the answer is empty.' }, 400);
    const n = await db.prepare('SELECT id, project, uid, text, at FROM feedback WHERE id = ?1').bind(id).first();
    if (!n) return jsonResp({ error: 'FEEDBACK: that note is not in the inbox any more.' }, 404);
    if (!n.uid || !n.project) return jsonResp({ error: 'FEEDBACK: that note does not say who wrote it.' }, 400);
    const at = Date.now();
    const r = await db.prepare('INSERT INTO feedback_replies (note_id, project, uid, text, note_text, note_at, from_email, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(id, n.project, n.uid, text, String(n.text || '').slice(0, 300), n.at || 0, String((claims && claims.email) || '').slice(0, 200), at).run();
    await db.prepare("UPDATE feedback SET status = 'seen' WHERE id = ?1 AND status = 'new'").bind(id).run();
    return jsonResp({ ok: true, reply: { id: (r && r.meta && r.meta.last_row_id) || null, note_id: id, text, at, read_at: null } });
  }
  return null;
}
// v68 — a person's own answers from the owner (newest 50), in the copy they
// signed in to. `read: [ids]` marks those read — only their own.
async function feedbackReplies(request, env, body) {
  if (!env.METER_DB) return jsonResp({ error: 'FEEDBACK: not set up on this Worker (METER_DB).', needsConfig: true }, 503);
  let claims;
  try { claims = await verifyIdToken(body.idToken, env); }
  catch (e) { return jsonResp({ error: 'FEEDBACK: your sign-in could not be checked (' + e.message + ').' }, 401); }
  const db = await meterDb(env);
  await feedbackTable(db);
  const ids = (Array.isArray(body.read) ? body.read : []).map(x => parseInt(x, 10)).filter(x => x > 0).slice(0, 50);
  if (ids.length) {
    const now = Date.now();
    await db.batch(ids.map(x => db.prepare('UPDATE feedback_replies SET read_at = ?1 WHERE id = ?2 AND project = ?3 AND uid = ?4 AND read_at IS NULL')
      .bind(now, x, claims.aud, claims.sub)));
  }
  const rows = (await db.prepare('SELECT id, note_id, text, note_text, note_at, at, read_at FROM feedback_replies '
    + 'WHERE project = ?1 AND uid = ?2 ORDER BY at DESC LIMIT 50').bind(claims.aud, claims.sub).all()).results || [];
  return jsonResp({ replies: rows });
}

// ─── WHAT THE TESTERS' APPS REPORT (v69) ─────────────────────────────────────
// Tony, before the beta: "let the beta's run for a while and then see what we
// can learn". The copies whose `insights` feature is on (the beta and the test
// copy) send, now and then, one call carrying both:
//   errors — the app's own error messages (what its log would say: a recipe's
//     NAME at most, never its contents), the screen, version, device and
//     language. One row per person, version, kind, wording and place, with a
//     count, so an error that repeats is one line that says how often.
//   usage  — for the person's household, how many times each feature was used
//     this month (or the month before, if it was counted then): a name and a
//     number. Only a member of the household may add to its counts.
// The owner reads them in 📊 Households: ⚠️ Errors, and each household's
// "What they use".
let _signalsReady = false;
async function signalsTable(db) {
  if (!_signalsReady) {
    await db.prepare('CREATE TABLE IF NOT EXISTS app_errors (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, uid TEXT, email TEXT, hid TEXT, '
      + 'kind TEXT, message TEXT, place TEXT, screen TEXT, version TEXT, env TEXT, device TEXT, lang TEXT, first_at INTEGER, last_at INTEGER, '
      + 'n INTEGER, status TEXT)').run();
    await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS app_errors_one ON app_errors (project, uid, version, kind, message, place)').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS usage_counts (project TEXT NOT NULL, hid TEXT NOT NULL, month TEXT NOT NULL, k TEXT NOT NULL, '
      + 'n INTEGER, PRIMARY KEY (project, hid, month, k))').run();
    _signalsReady = true;
  }
}
const SIGNAL_KEY = /^[a-z][a-z0-9_.-]{0,39}$/;
const ERRORS_PER_DAY = 200;       // new error lines a person may add in a day: a loop cannot fill the table
const ERRORS_KEPT_DAYS = 120;
async function appSignals(request, env, body) {
  if (!env.METER_DB) return jsonResp({ error: 'SIGNALS: not set up on this Worker (METER_DB).', needsConfig: true }, 503);
  let claims;
  try { claims = await verifyIdToken(body.idToken, env); }
  catch (e) { return jsonResp({ error: 'SIGNALS: your sign-in could not be checked (' + e.message + ').' }, 401); }
  const str = (v, max) => String(v == null ? '' : v).slice(0, max);
  const now = Date.now();
  const hid = /^[A-Za-z0-9]{1,64}$/.test(String(body.hid || '')) ? String(body.hid) : '';
  const errors = (Array.isArray(body.errors) ? body.errors : []).filter(e => e && typeof e === 'object' && String(e.message || '').trim()).slice(0, 30);
  const usage = body.usage && typeof body.usage === 'object' ? body.usage : null;
  const counts = (usage && usage.counts && typeof usage.counts === 'object' && !Array.isArray(usage.counts) ? Object.entries(usage.counts) : [])
    .filter(([k, n]) => SIGNAL_KEY.test(k) && Number.isInteger(n) && n > 0).slice(0, 80).map(([k, n]) => [k, Math.min(n, 1000)]);
  // this month, or the one before (counted on the last day, sent on the first)
  const prev = (() => { const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return utcMonthKey(d.getTime()); })();
  const month = usage && (usage.month === prev) ? prev : utcMonthKey(now);
  if (counts.length) {
    if (!hid) return jsonResp({ error: 'SIGNALS: which household?' }, 400);
    let hh;
    try { hh = await meterMembership(claims, hid, body.idToken, env); } catch (e) { return jsonResp({ error: 'SIGNALS: ' + e.message }, 502); }
    if (!hh.member) return jsonResp({ error: 'SIGNALS: you are not in that household.' }, 403);
  }
  const db = await meterDb(env);
  await signalsTable(db);
  const stmts = [];
  let keptErrors = 0;
  if (errors.length) {
    const today = await db.prepare('SELECT COUNT(*) AS n FROM app_errors WHERE project = ?1 AND uid = ?2 AND first_at > ?3')
      .bind(claims.aud, claims.sub, now - 864e5).first();
    const room = Math.max(0, ERRORS_PER_DAY - ((today && today.n) || 0));
    errors.slice(0, room).forEach(e => {
      const at = Number(e.at) > 0 && Number(e.at) <= now + 60000 ? Math.floor(Number(e.at)) : now;
      const n = Number.isInteger(e.n) && e.n > 0 ? Math.min(e.n, 1000) : 1;
      stmts.push(db.prepare('INSERT INTO app_errors (project, uid, email, hid, kind, message, place, screen, version, env, device, lang, first_at, last_at, n, status) '
        + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13, ?14, \'new\') '
        + 'ON CONFLICT (project, uid, version, kind, message, place) DO UPDATE SET n = n + excluded.n, last_at = MAX(last_at, excluded.last_at), '
        + 'screen = excluded.screen, device = excluded.device, lang = excluded.lang, hid = CASE WHEN excluded.hid = \'\' THEN hid ELSE excluded.hid END')
        .bind(claims.aud, claims.sub, str(claims.email, 200), hid, str(e.kind, 30), str(e.message, 500).trim(), str(e.where, 200), str(e.screen, 80),
              str(e.version, 20), str(e.env, 20), str(e.device, 300), str(e.lang, 10), at, n));
      keptErrors++;
    });
  }
  counts.forEach(([k, n]) => {
    stmts.push(db.prepare('INSERT INTO usage_counts (project, hid, month, k, n) VALUES (?1, ?2, ?3, ?4, ?5) '
      + 'ON CONFLICT (project, hid, month, k) DO UPDATE SET n = n + excluded.n').bind(claims.aud, hid, month, k, n));
  });
  // v83 — Firestore reads as the apps count them (the audit, 20 Oct). Firebase's own count reaches the hourly watch
  // only with the Monitoring role, on GitHub's clock — which drops most runs; the 50,000 free reads of a day are the
  // allowance 20 testers come nearest to. Every app adds what it read since it last said; the owner hears at 70%.
  const fsReads = Number.isInteger(body.reads) && body.reads > 0 ? Math.min(body.reads, FS_READS_PER_CALL) : 0;
  const readsKey = 'fsreads:' + claims.aud + ':' + pacificDayKey(now);
  if (fsReads) {
    await tableOnce(db, 'counters', 'CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, until INTEGER)');
    stmts.push(db.prepare('INSERT INTO counters (k, n, until) VALUES (?1, ?2, ?3) ON CONFLICT (k) DO UPDATE SET n = n + excluded.n')
      .bind(readsKey, fsReads, nextPacificMidnight(now) + 2 * 864e5));
  }
  if (stmts.length) await db.batch(stmts);
  let readsToday = null;
  if (fsReads) {
    const row = await db.prepare('SELECT n FROM counters WHERE k = ?1').bind(readsKey).first();
    readsToday = (row && Number(row.n)) || 0;
    const pct = Math.round(100 * readsToday / FS_FREE_READS);
    if (pct >= 70) await raiseNotice(env, { what: 'usage:firestoreReadsApps:' + claims.aud, kind: 'warning', scope: 'owner',
      until: nextPacificMidnight(now), self: true,
      title: 'Firestore reads at about ' + pct + '% of the free allowance today, as the apps count them',
      affects: 'the recipes in the cloud (' + String(claims.aud).slice(0, 40) + ')',
      detail: readsToday.toLocaleString('en-US') + ' of ' + FS_FREE_READS.toLocaleString('en-US') + ' today (Firebase\'s day ends at midnight in California). '
        + 'At 100% Firebase refuses every read until then — Firebase → Usage and billing shows its own count.' });
  }
  return jsonResp({ ok: true, errors: keptErrors, dropped: errors.length - keptErrors, counts: counts.length, month,
                    reads: fsReads || undefined, readsToday: readsToday == null ? undefined : readsToday });
}
// v83 — the Spark plan's reads a day, per project; one call may add at most this many (a runaway or a forged count
// can only raise a warning, never refuse anything).
const FS_FREE_READS = 50000, FS_READS_PER_CALL = 20000;
async function appReadsToday(env) {
  if (!env.METER_DB) return null;
  try {
    const rows = (await env.METER_DB.prepare('SELECT k, n FROM counters WHERE k LIKE ?1').bind('fsreads:%:' + pacificDayKey(Date.now())).all()).results || [];
    const out = {}; rows.forEach(r => { out[String(r.k).split(':')[1]] = Number(r.n) || 0; });
    return { day: pacificDayKey(Date.now()), byProject: out, limit: FS_FREE_READS };
  } catch (e) { return null; }
}
// The owner's side, through meter-admin: errors (newest 300, every copy),
// errors-new (how many are new), error-status (new | done), error-delete.
async function signalsAdmin(env, db, body) {
  await signalsTable(db);
  if (body.op === 'errors') {
    await db.prepare('DELETE FROM app_errors WHERE last_at < ?1').bind(Date.now() - ERRORS_KEPT_DAYS * 864e5).run();
    const rows = (await db.prepare('SELECT id, project, uid, email, hid, kind, message, place, screen, version, env, device, lang, first_at, last_at, n, status '
      + 'FROM app_errors ORDER BY last_at DESC LIMIT 300').all()).results || [];
    return jsonResp({ errors: rows });
  }
  if (body.op === 'errors-new') {
    const r = await db.prepare("SELECT COUNT(*) AS n FROM app_errors WHERE status = 'new'").first();
    return jsonResp({ new: (r && r.n) || 0 });
  }
  if (body.op === 'errors-delete') {      // v88 — several at once: one statement, one alert
    const ids = idBatch(body.ids);
    if (!ids || !ids.length) return jsonResp({ error: 'SIGNALS: which errors? (1 to 100 at a time)' }, 400);
    const r = await db.prepare('DELETE FROM app_errors WHERE id IN (' + ids.map((_, i) => '?' + (i + 1)).join(', ') + ')').bind(...ids).run();
    return jsonResp({ ok: true, deleted: (r && r.meta && r.meta.changes) != null ? r.meta.changes : ids.length });
  }
  if (body.op === 'errors-status') {      // v89 — several marked done (or not done) at once
    const ids = idBatch(body.ids, 99);
    if (!ids || !ids.length) return jsonResp({ error: 'SIGNALS: which errors? (1 to 99 at a time)' }, 400);
    if (['new', 'done'].indexOf(body.status) === -1) return jsonResp({ error: 'SIGNALS: new or done.' }, 400);
    const r = await db.prepare('UPDATE app_errors SET status = ?1 WHERE id IN (' + ids.map((_, i) => '?' + (i + 2)).join(', ') + ')').bind(body.status, ...ids).run();
    return jsonResp({ ok: true, changed: (r && r.meta && r.meta.changes) != null ? r.meta.changes : ids.length });
  }
  const id = parseInt(body.id, 10);
  if (!(id > 0)) return jsonResp({ error: 'SIGNALS: which error?' }, 400);
  if (body.op === 'error-status') {
    if (['new', 'done'].indexOf(body.status) === -1) return jsonResp({ error: 'SIGNALS: new or done.' }, 400);
    await db.prepare('UPDATE app_errors SET status = ?1 WHERE id = ?2').bind(body.status, id).run();
    return jsonResp({ ok: true });
  }
  if (body.op === 'error-delete') {
    await db.prepare('DELETE FROM app_errors WHERE id = ?1').bind(id).run();
    return jsonResp({ ok: true });
  }
  return null;
}

// ─── THE END-OF-BETA QUESTION (v71) ─────────────────────────────────────────
// A few questions the owner asks the testers of one copy, once he decides to.
// Nothing is asked until he opens it; the answers are names and words, read
// only by him (📊 Households → 📝 Beta question).
let _surveyReady = false;
async function surveyTables(db) {
  if (!_surveyReady) {
    await db.prepare('CREATE TABLE IF NOT EXISTS surveys (project TEXT NOT NULL, survey TEXT NOT NULL, opened_at INTEGER, closed_at INTEGER, '
      + 'PRIMARY KEY (project, survey))').run();
    await db.prepare('CREATE TABLE IF NOT EXISTS survey_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, survey TEXT, uid TEXT, email TEXT, '
      + 'hid TEXT, household TEXT, keep TEXT, change TEXT, price TEXT, other TEXT, lang TEXT, version TEXT, at INTEGER)').run();
    await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS survey_answers_one ON survey_answers (project, survey, uid)').run();
    _surveyReady = true;
  }
}
const SURVEY_ID = /^[a-z0-9-]{1,40}$/;
const SURVEY_KEEP = ['yes', 'probably', 'unsure', 'probably-not', 'no'];
const SURVEY_PRICE = ['free', 'up-to-1', '1-3', '3-5', 'more-5'];
async function openSurvey(db, project) {
  return await db.prepare('SELECT survey, opened_at FROM surveys WHERE project = ?1 AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1').bind(project).first();
}
async function surveyAction(request, env, body) {
  if (!env.METER_DB) return jsonResp({ error: 'SURVEY: not set up on this Worker (METER_DB).', needsConfig: true }, 503);
  let claims;
  try { claims = await verifyIdToken(body.idToken, env); }
  catch (e) { return jsonResp({ error: 'SURVEY: your sign-in could not be checked (' + e.message + ').' }, 401); }
  const db = await meterDb(env);
  await surveyTables(db);
  const open = await openSurvey(db, claims.aud);
  if (body.action === 'survey-status') {
    if (!open) return jsonResp({ survey: null });
    const mine = await db.prepare('SELECT at FROM survey_answers WHERE project = ?1 AND survey = ?2 AND uid = ?3').bind(claims.aud, open.survey, claims.sub).first();
    return jsonResp({ survey: { id: open.survey, openedAt: open.opened_at }, answered: !!mine });
  }
  // survey-answer
  const a = body.answers || {}, str = (v, max) => String(v == null ? '' : v).slice(0, max);
  if (!open || open.survey !== String(body.survey || '')) return jsonResp({ error: 'SURVEY: that question is not open any more.' }, 409);
  const keep = SURVEY_KEEP.includes(a.keep) ? a.keep : '', price = SURVEY_PRICE.includes(a.price) ? a.price : '';
  const change = str(a.change, 2000).trim(), other = str(a.other, 2000).trim();
  if (!keep && !price && !change && !other) return jsonResp({ error: 'SURVEY: nothing was answered.' }, 400);
  await db.prepare('INSERT INTO survey_answers (project, survey, uid, email, hid, household, keep, change, price, other, lang, version, at) '
    + 'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) ON CONFLICT (project, survey, uid) DO UPDATE SET '
    + 'email = excluded.email, hid = excluded.hid, household = excluded.household, keep = excluded.keep, change = excluded.change, '
    + 'price = excluded.price, other = excluded.other, lang = excluded.lang, version = excluded.version, at = excluded.at')
    .bind(claims.aud, open.survey, claims.sub, str(claims.email, 200), /^[A-Za-z0-9]{1,64}$/.test(String(body.hid || '')) ? String(body.hid) : '',
          str(body.household, 120), keep, change, price, other, str(body.lang, 10), str(body.version, 20), Date.now()).run();
  return jsonResp({ ok: true });
}
// The owner's side, through meter-admin (`project`: which copy; default his own).
async function surveyAdmin(env, db, body, proj) {
  await surveyTables(db);
  if (body.op === 'survey-list') {
    const surveys = (await db.prepare('SELECT project, survey, opened_at, closed_at FROM surveys ORDER BY opened_at DESC').all()).results || [];
    const answers = (await db.prepare('SELECT id, project, survey, uid, email, hid, household, keep, change, price, other, lang, version, at '
      + 'FROM survey_answers ORDER BY at DESC LIMIT 1000').all()).results || [];
    return jsonResp({ surveys, answers, choices: { keep: SURVEY_KEEP, price: SURVEY_PRICE } });
  }
  const id = String(body.survey || '');
  if (!SURVEY_ID.test(id)) return jsonResp({ error: 'SURVEY: which question?' }, 400);
  if (body.op === 'survey-open') {
    const other = await openSurvey(db, proj);
    if (other && other.survey !== id) await db.prepare('UPDATE surveys SET closed_at = ?1 WHERE project = ?2 AND survey = ?3').bind(Date.now(), proj, other.survey).run();
    await db.prepare('INSERT INTO surveys (project, survey, opened_at, closed_at) VALUES (?1, ?2, ?3, NULL) '
      + 'ON CONFLICT (project, survey) DO UPDATE SET closed_at = NULL').bind(proj, id, Date.now()).run();
    return jsonResp({ ok: true, project: proj, survey: id });
  }
  if (body.op === 'survey-close') {
    await db.prepare('UPDATE surveys SET closed_at = ?1 WHERE project = ?2 AND survey = ?3 AND closed_at IS NULL').bind(Date.now(), proj, id).run();
    return jsonResp({ ok: true });
  }
  return null;
}

// ─── VIDEO RECIPES (v43, v44) ────────────────────────────────────────────────
// The daily ceiling both video actions share. null = go ahead.
async function videoDailyCap(env) {
  if (!env.METER_DB && !env.BRING_KV) return null;
  const vMax = parseInt(env.VIDEO_DAILY_MAX || '', 10) || VIDEO_DAILY_DEFAULT;
  try {
    const vDay = await ceilingCount(env, 'rl:vid:' + utcDayKey(Date.now()), 60 * 60 * 48, 1);   // v78 — D1 when bound
    if (vDay.used >= vMax) {
      return jsonResp({ error: 'VIDEO_CAP: this Worker\'s daily ceiling for reading videos has been reached ('
        + vDay.used + '/' + vMax + '). Raise VIDEO_DAILY_MAX, or try again tomorrow.', rateLimited: true }, 429);
    }
    await vDay.credit();
  } catch (e) { /* unmetered is acceptable here: no billing on the key (see VIDEO RECIPES) */ }
  return null;
}
function geminiModel(env) { return String(env.GEMINI_MODEL || GEMINI_MODEL_DEFAULT).replace(/[^a-zA-Z0-9._-]/g, ''); }
// v45 — which model to use: the one remembered (found earlier), else the
// configured/default name.
async function geminiModelNow(env) {
  if (!env.GEMINI_MODEL && env.BRING_KV) {
    try { const m = await env.BRING_KV.get('gemini:model'); if (m) return m; } catch (e) {}
  }
  return geminiModel(env);
}
// The newest general "flash" model this key may use to read video.
function pickGeminiModel(list) {
  const ok = (list || []).filter(m => m && m.name && (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => String(m.name).replace(/^models\//, ''))
    .filter(n => /^gemini-/.test(n) && !/(image|tts|audio|live|embed|vision|thinking|exp|learnlm|robotics|computer|native)/i.test(n));
  const ver = n => { const v = /gemini-(\d+(?:\.\d+)?)/.exec(n); return v ? parseFloat(v[1]) : 0; };
  const score = n => ver(n) * 100 + (/flash/.test(n) && !/lite/.test(n) ? 30 : /flash-lite/.test(n) ? 20 : /pro/.test(n) ? 10 : 0)
    + (/latest$/.test(n) ? 2 : 0) - (/preview|\d{2}-\d{2}$|-\d{3}$/.test(n) ? 1 : 0);
  ok.sort((a, b) => score(b) - score(a));
  return ok[0] || '';
}
function rankGeminiModels(list) {
  const out = [];
  let rest = (list || []).slice();
  for (let i = 0; i < 6; i++) {
    const m = pickGeminiModel(rest);
    if (!m) break;
    out.push(m);
    rest = rest.filter(x => String(x && x.name).replace(/^models\//, '') !== m);
  }
  return out;
}
// Ask Google which models this key may use; remember the pick for a day.
async function findGeminiModel(env) {
  let all = [], page = '';
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${GEMINI_API}/v1beta/models?pageSize=200` + (page ? '&pageToken=' + encodeURIComponent(page) : ''),
      { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return '';
    const d = await r.json();
    all = all.concat(d.models || []);
    if (!d.nextPageToken) break;
    page = d.nextPageToken;
  }
  const ranked = rankGeminiModels(all);
  const m = ranked[0] || '';
  if (m && env.BRING_KV) {
    try { await env.BRING_KV.put('gemini:model', m, { expirationTtl: 86400 });
          await env.BRING_KV.put('gemini:models', JSON.stringify(ranked), { expirationTtl: 86400 }); } catch (e) {}
  }
  _geminiRanked = ranked;
  return m;
}
let _geminiRanked = null;
// v46 — the next model to try when one is busy: the ranked list (remembered,
// or asked for once), minus those already tried.
async function nextGeminiModel(env, tried) {
  let ranked = null;
  if (env.BRING_KV) { try { ranked = JSON.parse(await env.BRING_KV.get('gemini:models') || 'null'); } catch (e) {} }
  if (!ranked || !ranked.length) ranked = _geminiRanked;
  if (!ranked || !ranked.length) { try { await findGeminiModel(env); ranked = _geminiRanked; } catch (e) {} }
  return (ranked || []).find(m => !tried.includes(m)) || '';
}
function geminiBusy(status, msg) {
  return status === 503 || status === 500 || status === 429
    || /overload|high demand|unavailable|try again later|resource.?exhausted/i.test(String(msg || ''));
}
// Google's answer, in words this app's owner can act on.
function geminiFault(status, msg, model) {
  if (status === 429) return jsonResp({ error: 'VIDEO_QUOTA: Google\'s free allowance for reading videos is used up for now. Try again later.', rateLimited: true }, 429);
  if (status === 404) return jsonResp({ error: 'VIDEO_MODEL: Gemini has no model "' + model + '" for this key, and none could be found to use instead (' + String(msg).slice(0, 160) + ').', needsConfig: true }, 503);
  if ((status === 400 || status === 401 || status === 403) && /api key|api_key|credential|permission|unauth/i.test(msg))
    return jsonResp({ error: 'VIDEO_KEY: the GEMINI_API_KEY was refused by Google (' + String(msg).slice(0, 160) + ').', needsConfig: true }, 503);
  return jsonResp({ error: 'The video could not be read: ' + String(msg).slice(0, 300) }, 502);
}
// One fixed request: the video (a YouTube link, or a file uploaded here) and
// VIDEO_RECIPE_PROMPT. Nothing the caller sends reaches Gemini but the video.
async function geminiRecipe(env, fileData, extra) {
  let model = await geminiModelNow(env);
  const tried = [];
  let lost = false;
  for (let ask = 0; ask < 4; ask++) {
    tried.push(model);
    let r, data = null;
    try {
      r = await fetch(`${GEMINI_API}/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [ { file_data: fileData }, { text: VIDEO_RECIPE_PROMPT } ] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(110000),
      });
      try { data = await r.json(); } catch (e) {}
    } catch (err) {
      return jsonResp({ error: 'The video could not be read: ' + (err && err.name === 'TimeoutError' ? 'it took too long' : (err && err.message) || 'failed') }, 504);
    }
    if (r.ok) {
      const cand = data && data.candidates && data.candidates[0];
      const text = ((cand && cand.content && cand.content.parts) || []).map(p => p && p.text || '').join('').trim();
      if (!text) return jsonResp({ error: 'The video could not be read' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.' }, 502);
      const none = /^NO RECIPE\.?$/i.test(text);
      return jsonResp(Object.assign({ text: none ? '' : text.slice(0, 20000), noRecipe: none, via: 'gemini', model }, extra || {}));
    }
    const msg = (data && data.error && data.error.message) || ('HTTP ' + r.status);
    // v45 — that model is gone (or not for this key): find one, try again.
    if (r.status === 404 && !lost) {
      lost = true;
      let found = '';
      try { found = await findGeminiModel(env); } catch (e) {}
      if (found && !tried.includes(found)) { model = found; continue; }
      return geminiFault(r.status, msg, model);
    }
    // v46 — busy: once more on the same model after a pause, then the next one.
    if (geminiBusy(r.status, msg)) {
      if (ask === 0 && r.status !== 429) { await new Promise(res => setTimeout(res, 2500)); tried.pop(); continue; }
      const next = await nextGeminiModel(env, tried);
      if (next) { model = next; continue; }
      if (r.status === 429) return geminiFault(r.status, msg, model);   // the allowance, not a spike
      return jsonResp({ error: 'VIDEO_BUSY: Google\'s video reader is busy right now (' + String(msg).slice(0, 120) + '). Try again in a minute or two.', busy: true, rateLimited: true }, 503);
    }
    return geminiFault(r.status, msg, model);
  }
  return jsonResp({ error: 'VIDEO_BUSY: Google\'s video reader is busy right now. Try again in a minute or two.', busy: true, rateLimited: true }, 503);
}
// v44 — a video file: checked, uploaded to Gemini's Files API, read, deleted.
async function videoFileRecipe(request, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) return jsonResp({ error: 'VIDEO_AI: reading recipes from videos is not set up on the server (GEMINI_API_KEY).', needsConfig: true }, 503);
  let type = String(request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!/^video\/[a-z0-9.+-]+$/.test(type)) return jsonResp({ error: 'That is not a video file.' }, 415);
  // An iPhone screen recording is QuickTime; Gemini calls that type video/mov.
  if (type === 'video/quicktime') type = 'video/mov';
  const maxMb = parseInt(env.VIDEO_MAX_MB || '', 10) || VIDEO_MAX_MB_DEFAULT;
  const declared = parseInt(request.headers.get('Content-Length') || '', 10);
  if (declared > maxMb * 1048576) return jsonResp({ error: 'VIDEO_TOO_BIG: the video is larger than ' + maxMb + ' MB. Record just the part with the recipe, or a lower quality.', tooBig: true }, 413);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return jsonResp({ error: 'The video arrived empty.' }, 400);
  if (bytes.byteLength > maxMb * 1048576) return jsonResp({ error: 'VIDEO_TOO_BIG: the video is larger than ' + maxMb + ' MB. Record just the part with the recipe, or a lower quality.', tooBig: true }, 413);
  return await videoBytesRecipe(env, bytes, type);
}
// v48 — the upload/read/delete, shared by a file sent by the app and a reel's
// video fetched from Facebook's or Instagram's video servers.
async function videoBytesRecipe(env, bytes, type) {
  const key = env.GEMINI_API_KEY;
  const capped = await videoDailyCap(env);
  if (capped) return capped;
  const model = await geminiModelNow(env);
  let fileName = '';
  try {
    // 1. Start a resumable upload; Google answers with where to send the bytes.
    const start = await fetch(`${GEMINI_API}/upload/v1beta/files`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength), 'X-Goog-Upload-Header-Content-Type': type,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ file: { display_name: 'recipe-video' } }),
      signal: AbortSignal.timeout(30000),
    });
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!start.ok || !uploadUrl) {
      let d = null; try { d = await start.json(); } catch (e) {}
      return geminiFault(start.status, (d && d.error && d.error.message) || ('upload refused, HTTP ' + start.status), model);
    }
    // 2. The bytes, in one go.
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Length': String(bytes.byteLength), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
      body: bytes,
      signal: AbortSignal.timeout(90000),
    });
    let info = null; try { info = await up.json(); } catch (e) {}
    const file = info && info.file;
    if (!up.ok || !file || !file.name) return geminiFault(up.status, (info && info.error && info.error.message) || 'the upload did not finish', model);
    fileName = file.name;
    // 3. Google prepares a video before it can be read; wait for it (≤ ~80 s).
    let state = file.state, uri = file.uri, mime = file.mimeType || type;
    for (let i = 0; i < 40 && state === 'PROCESSING'; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const g = await fetch(`${GEMINI_API}/v1beta/${fileName}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15000) });
      let gd = null; try { gd = await g.json(); } catch (e) {}
      if (gd) { state = gd.state || state; uri = gd.uri || uri; mime = gd.mimeType || mime; }
    }
    if (state !== 'ACTIVE') return jsonResp({ error: 'The video could not be read: Google ' + (state === 'FAILED' ? 'could not process it' : 'took too long to prepare it') + '.' }, 502);
    // 4. Read it, with the same fixed request as a YouTube video.
    return await geminiRecipe(env, { mime_type: mime, file_uri: uri }, { fromFile: true });
  } catch (err) {
    return jsonResp({ error: 'The video could not be read: ' + (err && err.name === 'TimeoutError' ? 'it took too long' : (err && err.message) || 'failed') }, 504);
  } finally {
    // 5. Not kept at Google: deleted as soon as it has been read (or failed).
    if (fileName) { try { await fetch(`${GEMINI_API}/v1beta/${fileName}`, { method: 'DELETE', headers: { 'x-goog-api-key': key } }); } catch (e) {} }
  }
}

// ─── A REEL'S VIDEO (v48) ────────────────────────────────────────────────────
// Only the platforms' own video servers — this must never become a way to make
// the Worker download anything from anywhere.
function isPlatformVideo(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && /(^|\.)(fbcdn\.net|cdninstagram\.com)$/i.test(x.hostname);
  } catch (e) { return false; }
}
// A video address inside a public embed page (escaped JSON or a <video> tag).
function videoUrlIn(html) {
  const h = String(html || '');
  const pats = [/"(?:browser_native_hd_url|playable_url_quality_hd|hd_src|video_url|browser_native_sd_url|playable_url|sd_src)"\s*:\s*"([^"]+)"/,
                /<video[^>]+src="([^"]+)"/i, /<source[^>]+src="([^"]+)"/i];
  for (const re of pats) {
    const m = re.exec(h);
    if (!m) continue;
    let u = m[1].replace(/\\\//g, '/').replace(/\\u0025/gi, '%').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');
    if (isPlatformVideo(u)) return u;
  }
  return '';
}
// v49 — a <meta property|name="…" content="…"> value, either attribute order.
function metaIn(html, prop) {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]*content="([^"]*)"', 'i').exec(html)
         || new RegExp('<meta[^>]+content="([^"]*)"[^>]*(?:property|name)=["\']' + p + '["\']', 'i').exec(html);
  return m ? m[1] : '';
}
// Letters and digits only, lower-case: how two texts are compared.
function captionKey(t) { return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
// v50 — a post's own words in the page's data: "message":{…"text":"…"}.
// The longest one is the post (a reel page carries only its own caption).
function fbMessageIn(html) {
  const h = String(html || '');
  let best = '';
  const re = /"message":\{/g;
  let m;
  while ((m = re.exec(h))) {
    const t = /"text":"((?:[^"\\]|\\.)*)"/.exec(h.slice(m.index, m.index + 6000));
    if (!t) continue;
    let s = '';
    try { s = JSON.parse('"' + t[1] + '"'); } catch (e) { continue; }
    s = fbPostText(s.replace(/\r/g, ''));
    if (s.length > best.length) best = s;
  }
  return best;
}
function ogVideoIn(html) {
  for (const p of ['og:video:secure_url', 'og:video:url', 'og:video']) {
    const u = metaIn(html, p).replace(/&amp;/g, '&');
    if (isPlatformVideo(u)) return u;
  }
  return '';
}
async function videoFromUrl(env, u) {
  if (!env.GEMINI_API_KEY) return jsonResp({ error: 'VIDEO_AI: reading recipes from videos is not set up on the server (GEMINI_API_KEY).', needsConfig: true }, 503);
  if (!isPlatformVideo(u)) return jsonResp({ error: 'Only a video on Facebook\'s or Instagram\'s own video servers can be read this way.' }, 400);
  const maxMb = parseInt(env.VIDEO_MAX_MB || '', 10) || VIDEO_MAX_MB_DEFAULT;
  let r;
  try { r = await fetch(u, { headers: FB_UA, signal: AbortSignal.timeout(30000) }); }
  catch (e) { return jsonResp({ error: 'The video could not be fetched: ' + e.message }, 502); }
  if (!r.ok) return jsonResp({ error: 'The video could not be fetched (HTTP ' + r.status + ').' }, 502);
  const len = parseInt(r.headers.get('content-length') || '', 10);
  if (len > maxMb * 1048576) return jsonResp({ error: 'VIDEO_TOO_BIG: the video is larger than ' + maxMb + ' MB.', tooBig: true }, 413);
  let type = String(r.headers.get('content-type') || 'video/mp4').split(';')[0].trim().toLowerCase();
  if (!/^video\//.test(type)) type = 'video/mp4';
  const bytes = await r.arrayBuffer();
  if (!bytes.byteLength) return jsonResp({ error: 'The video came back empty.' }, 502);
  if (bytes.byteLength > maxMb * 1048576) return jsonResp({ error: 'VIDEO_TOO_BIG: the video is larger than ' + maxMb + ' MB.', tooBig: true }, 413);
  return await videoBytesRecipe(env, bytes, type);
}

// ─── FACEBOOK (v47) ──────────────────────────────────────────────────────────
const FB_UA = { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)', 'Accept-Language': 'he,en;q=0.9' };
function isFacebookAddress(u) { return /^https:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.watch)\//i.test(String(u || '')); }
function htmlText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// Lines of Facebook's own furniture, which are not the post.
const FB_CHROME = /^(facebook|log in|sign up|create new account|forgotten (account|password)\??|see more|see less|like|comment|share|follow|watch|reels?|\d+[kKmM]? (likes?|comments?|shares?|views?)|·|…)$/i;
function fbPostText(t) {
  return String(t || '').split('\n').map(l => l.trim()).filter(l => l && !FB_CHROME.test(l)).join('\n')
    .replace(/\n?Posted by [\s\S]*$/i, '').trim();
}
// v52 — a post's plain address: Facebook's tracking (referral_source,
// original_uri, mibextid, …) dropped, only what names the post kept. Tony's
// link from the Share menu carried "?referral_source=external_deeplink&
// original_uri=https://www.facebook.com/", which went on to Google as is.
function fbCanonical(u) {
  let x;
  try { x = new URL(u); } catch (e) { return u; }
  const keep = { '/watch': ['v'], '/watch/': ['v'], '/permalink.php': ['story_fbid', 'id'], '/story.php': ['story_fbid', 'id'], '/photo.php': ['fbid'], '/photo': ['fbid'], '/photo/': ['fbid'] }[x.pathname] || [];
  const q = keep.filter(k => x.searchParams.get(k)).map(k => k + '=' + encodeURIComponent(x.searchParams.get(k))).join('&');
  const host = /(^|\.)fb\.watch$/i.test(x.hostname) ? x.hostname : 'www.facebook.com';
  return 'https://' + host + x.pathname + (q ? '?' + q : '');
}
async function facebookFetch(env, url) {
  const tried = [];
  // 1. A share link → the post it points at (no login pages).
  for (let i = 0; i < 4 && /\/share\/|fb\.watch|\/l\.php/.test(url); i++) {
    let r;
    try { r = await fetch(url, { redirect: 'manual', headers: FB_UA, signal: AbortSignal.timeout(10000) }); } catch (e) { tried.push('share link: ' + e.message); break; }
    const loc = r.headers.get('location');
    if (!loc) { tried.push('share link: no redirect (' + r.status + ')'); break; }
    const next = new URL(loc, url).href;
    if (!isFacebookAddress(next) || /\/login|checkpoint/.test(next)) { tried.push('share link: leads to a login page'); break; }
    url = next;
  }
  const clean = fbCanonical(url);
  const video = /\/(reel|videos|watch)\b|fb\.watch/.test(clean);
  // 2. Facebook's official oEmbed.
  const token = env.FB_APP_TOKEN ? '&access_token=' + encodeURIComponent(env.FB_APP_TOKEN) : '';
  for (const kind of (video ? ['oembed_video', 'oembed_post'] : ['oembed_post', 'oembed_video'])) {
    try {
      const r = await fetch(`https://graph.facebook.com/v23.0/${kind}?omitscript=true&url=${encodeURIComponent(clean)}${token}`,
        { headers: FB_UA, signal: AbortSignal.timeout(10000) });
      let d = null; try { d = await r.json(); } catch (e) {}
      if (!r.ok || !d) { tried.push(kind + ': ' + ((d && d.error && d.error.message) || ('HTTP ' + r.status)).slice(0, 140)); continue; }
      const quote = (String(d.html || '').match(/<blockquote[\s\S]*?<\/blockquote>/i) || [''])[0];
      const text = fbPostText(htmlText(quote || d.html || ''));
      if (text.length >= 60) return { text: text.slice(0, 20000), via: kind, url: clean, author: d.author_name || '' };
      tried.push(kind + ': no text in the embed');
    } catch (e) { tried.push(kind + ': ' + e.message); }
  }
  // 3. (v49) The post's own page — its preview tags (og:description is the
  //    caption that a link preview shows) and the video's address.
  let videoUrl = '', caption = '';
  try {
    const r = await fetch(clean, { headers: Object.assign({ Accept: 'text/html' }, FB_UA), redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!r.ok) tried.push('page: HTTP ' + r.status);
    else if (/\/login|checkpoint/.test(r.url || '')) tried.push('page: leads to a login page');
    else {
      const html = await r.text();
      videoUrl = videoUrlIn(html) || ogVideoIn(html);
      let desc = fbPostText(htmlText(metaIn(html, 'og:description') || metaIn(html, 'description')));
      if (/log ?in(to)? (to )?facebook|on facebook\.?$|see posts, photos and more/i.test(desc)) desc = '';   // the login wall's own words
      // v50 — the WHOLE caption, from the page's own data: a preview's
      // og:description is cut short ("…"), and the recipe is in the rest.
      let msg = fbMessageIn(html);
      // v58 — the 🔬 test found it: the page's data DOES hold the whole caption
      // (2,067 chars for Tony's cake reel), just not under "message". Any
      // string in the data that carries the preview's opening words, the
      // longest — the same scan the test graded "whole text".
      if (desc) {
        const data = probeBestText(html, desc);
        if (/^page data/.test(data.how) && captionKey(data.text).length > captionKey(msg).length) msg = fbPostText(data.text);
      }
      if (msg.length > desc.replace(/(\.\.\.|…)$/, '').length) desc = msg;
      const title = htmlText(metaIn(html, 'og:title'));
      // Only the preview (~200 chars, cut mid-sentence) and nothing longer in
      // the data: `cut` lets the app say so if it falls back to the video.
      const whole = !!(msg && desc === msg);
      if (desc.length >= 60) return { text: desc.slice(0, 20000), via: whole ? 'page-data' : 'page', url: clean, title, videoUrl, tried,
                                      cut: !whole && desc.length < 400 };
      caption = desc;
      tried.push('page: ' + (desc ? 'caption too short' : 'no caption') + (videoUrl ? ', video found' : ', no video'));
    }
  } catch (e) { tried.push('page: ' + e.message); }
  // 4. The public embed page, as a website's iframe shows it — its text, and
  //    (v48) the video's address, for when the words hold no recipe.
  for (const plugin of (video ? ['video', 'post'] : ['post', 'video'])) {
    try {
      const r = await fetch(`https://www.facebook.com/plugins/${plugin}.php?href=${encodeURIComponent(clean)}&show_text=true&width=500`,
        { headers: Object.assign({ Accept: 'text/html' }, FB_UA), signal: AbortSignal.timeout(12000) });
      if (!r.ok) { tried.push('embed ' + plugin + ': HTTP ' + r.status); continue; }
      const html = await r.text();
      videoUrl = videoUrl || videoUrlIn(html);
      const body = (html.match(/<body[\s\S]*<\/body>/i) || [html])[0];
      const text = fbPostText(htmlText(body));
      if (text.length >= 60) return { text: text.slice(0, 20000), via: 'embed-' + plugin, url: clean, videoUrl };
      tried.push('embed ' + plugin + ': no text');
    } catch (e) { tried.push('embed ' + plugin + ': ' + e.message); }
  }
  return { text: '', url: clean, tried, videoUrl, caption };
}

// ─── THE FACEBOOK READING TEST (v57) ─────────────────────────────────────────
// Tony: "think of several ways to get to the text and design a test to check
// all of them". Each route is graded the same way against the preview Facebook
// gives everyone (~200 characters): WHOLE text, PREVIEW only, or NOTHING.
// Diagnostic only — nothing here imports a recipe.
function probeGrade(text, preview) {
  const t = String(text || '').trim();
  if (!t) return 'nothing';
  const k = captionKey(t), p = captionKey(preview || '');
  if (p && k.length >= p.length + 40 && k.indexOf(p.slice(0, 30)) !== -1) return 'whole';
  if (p && k.indexOf(p.slice(0, 30)) !== -1) return 'preview';
  return t.length >= 300 ? 'other' : 'preview';
}
// The best candidate for the post's text in a page: its preview tags, its
// data's "message" text, any string in its data that starts like the preview,
// and the page's visible words from where the preview starts.
function probeBestText(html, preview) {
  const h = String(html || '');
  const cands = [];
  const og = htmlText(metaIn(h, 'og:description') || metaIn(h, 'description'));
  if (og) cands.push({ how: 'og:description', text: og });
  const msg = fbMessageIn(h);
  if (msg) cands.push({ how: 'page data (message)', text: msg });
  const p30 = captionKey(preview || og).slice(0, 30);
  if (p30) {
    const re = /[:,\[]\s*"((?:[^"\\]|\\.){80,})"/g;   // a value in the data, not an HTML attribute
    let m, n = 0;
    while ((m = re.exec(h)) && n < 4000) {
      n++;
      let s = '';
      try { s = JSON.parse('"' + m[1] + '"'); } catch (e) { continue; }
      if (captionKey(s).indexOf(p30) !== -1) cands.push({ how: 'page data (string)', text: s });
    }
    const body = htmlText((h.match(/<body[\s\S]*<\/body>/i) || [h])[0]);
    const words = String(preview || og).trim().slice(0, 24);
    const at = words ? body.indexOf(words) : -1;
    if (at !== -1) cands.push({ how: 'visible words', text: body.slice(at, at + 6000) });
  }
  cands.sort((a, b) => captionKey(b.text).length - captionKey(a.text).length);
  return cands[0] || { how: '', text: '' };
}
function probeRow(route, status, best, preview, note) {
  const t = String((best && best.text) || '').replace(/\s+/g, ' ').trim();
  return { route, status: status || 0, grade: probeGrade(t, preview), chars: t.length, how: (best && best.how) || '',
           head: t.slice(0, 70), tail: t.length > 140 ? t.slice(-70) : '', note: note || '' };
}
async function probeFetch(u, extra) {
  try {
    const r = await fetch(u, Object.assign({ headers: Object.assign({ Accept: 'text/html' }, FB_UA), redirect: 'follow', signal: AbortSignal.timeout(12000) }, extra || {}));
    const html = await r.text();
    return { status: r.status, html, final: r.url || u };
  } catch (e) { return { status: 0, html: '', note: e.message }; }
}
async function fbProbe(env, url) {
  const clean = fbCanonical(url);
  const id = (/\/(?:reel|videos)\/(\d+)/.exec(clean) || /[?&]v=(\d+)/.exec(clean) || [])[1] || '';
  const rows = [];
  const s1 = await probeFetch(clean);
  const preview = htmlText(metaIn(s1.html, 'og:description') || '');
  const page = (label, res) => {
    const login = /\/login|checkpoint/.test(res.final || '');
    rows.push(probeRow(label, res.status, login ? null : probeBestText(res.html, preview), preview,
      login ? 'sent to a login page' : (res.note || (res.html ? Math.round(res.html.length / 1024) + ' KB page' : ''))));
  };
  page('server: the post page', s1);
  page('server: mobile site', await probeFetch(clean.replace('://www.facebook.com/', '://m.facebook.com/')));
  if (id) page('server: watch page', await probeFetch('https://www.facebook.com/watch/?v=' + id));
  for (const plugin of ['video', 'post'])
    page('server: embed (' + plugin + ')', await probeFetch(`https://www.facebook.com/plugins/${plugin}.php?href=${encodeURIComponent(clean)}&show_text=true&width=500`));
  for (const kind of ['oembed_video', 'oembed_post']) {
    const token = env.FB_APP_TOKEN ? '&access_token=' + encodeURIComponent(env.FB_APP_TOKEN) : '';
    try {
      const r = await fetch(`https://graph.facebook.com/v23.0/${kind}?omitscript=true&url=${encodeURIComponent(clean)}${token}`, { headers: FB_UA, signal: AbortSignal.timeout(10000) });
      let d = null; try { d = await r.json(); } catch (e) {}
      const quote = (String((d && d.html) || '').match(/<blockquote[\s\S]*?<\/blockquote>/i) || [''])[0];
      rows.push(probeRow('server: official embed (' + kind + ')', r.status, { how: 'embed quote', text: fbPostText(htmlText(quote)) }, preview,
        (d && d.error && d.error.message) ? String(d.error.message).slice(0, 90) : (token ? '' : 'no FB_APP_TOKEN')));
    } catch (e) { rows.push(probeRow('server: official embed (' + kind + ')', 0, null, preview, e.message)); }
  }
  return { url: clean, preview, rows };
}

// ─── LOGS GO, CORRESPONDENCE AND STATISTICS STAY (v75) ──────────────────────
// Tony, 13 Oct 2026: notes and replies "stay for ever. These could be personal correspondences that people
// may wish to keep, as opposed to logs and other maintenance info", and keep "statistics of user activities
// … which may help understand pain points and development directions". Run daily by `scheduled`
// (worker/wrangler.jsonc → triggers.crons). So, after six months:
//   • the device log attached to a note is dropped — the note itself, its picture and the replies stay;
//   • the owner's device records go (a security log);
//   • a deleted household's summary, and the members who left a household, lose the names and addresses
//     in them: what remains — dates, roles, counts — is statistics that identify no one;
// and error reports go 120 days after they last happened. Never touched: notes, replies, survey answers,
// usage counts, AI spend, allowances, and the summaries of households that exist.
// Each step on its own: a table that does not exist yet is skipped, never an error. Returns counts only.
const KEEP_DAYS = 183;
async function retentionSweep(env, now) {
  const db = env.METER_DB;
  if (!db) return null;
  now = now || Date.now();
  const cut = now - KEEP_DAYS * 864e5;
  const done = {};
  const run = async (name, sql, ...args) => {
    try { const r = await db.prepare(sql).bind(...args).run(); done[name] = (done[name] || 0) + ((r && r.meta && r.meta.changes) || 0); }
    catch (e) { if (!(name in done)) done[name] = 0; }
  };
  await run('noteLogs', 'UPDATE feedback SET log = NULL WHERE at < ?1 AND log IS NOT NULL', cut);
  await run('errors', 'DELETE FROM app_errors WHERE last_at < ?1', now - ERRORS_KEPT_DAYS * 864e5);
  await run('ownerDevices', 'DELETE FROM owner_devices WHERE last_at < ?1', cut);
  let rows = [];
  try { rows = (await db.prepare('SELECT project, hid, summary FROM hh_reports').all()).results || []; } catch (e) {}
  for (const r of rows) {
    let sum = null;
    try { sum = JSON.parse(r.summary || 'null'); } catch (e) {}
    if (!sum || typeof sum !== 'object') continue;
    let changed = false;
    const left = Array.isArray(sum.left) ? sum.left : [];
    sum.left = left.map(x => {
      if (!x || !x.email || !(Number(x.at) < cut)) return x;
      changed = true; return { at: x.at, how: x.how || '' };
    });
    if (sum.deletedAt && sum.deletedAt < cut && !sum.anonymisedAt) {
      sum = { name: '', code: '', createdAt: sum.createdAt || 0, referredBy: '',
              members: (Array.isArray(sum.members) ? sum.members : []).map(m => ({ role: (m && m.role) || '', joinedAt: (m && m.joinedAt) || 0, lastSeen: (m && m.lastSeen) || 0 })),
              links: [], linkCount: Array.isArray(sum.links) ? sum.links.length : 0, left: sum.left,
              deletedAt: sum.deletedAt, deletedBy: '', deletedHow: sum.deletedHow || '', anonymisedAt: now };
      changed = true;
      await run('householdNames', 'UPDATE ai_households SET name = NULL, code = NULL, note = NULL WHERE project = ?1 AND hid = ?2', r.project, r.hid);
    }
    if (changed) await run('summaries', 'UPDATE hh_reports SET summary = ?3 WHERE project = ?1 AND hid = ?2', r.project, r.hid, JSON.stringify(sum));
  }
  return done;
}

// ─── REPORTS TO A PRIVATE REPOSITORY (v90) ───────────────────────────────────
// Tony, 24 Oct 2026: "Please find a way in which reports, sent by the beta users, could be read by you, without me
// having to copy/paste them … there may be urgent issues which will wait for hours or even days for a resolution,
// instead of an immediate response." Each new note, and each new kind of error report, becomes an issue in a PRIVATE
// GitHub repository (REPORTS_REPO, rozinante2004-hash/kitchen-reports), written with a token that may touch only that
// repository (the secret REPORTS_GITHUB_TOKEN, set by the deploy job from the GitHub secret of the same name). A
// screenshot and the app's log go in as files beside it. No e-mail address, no name, no account id: the sender is a
// short fingerprint, so two notes from one person can be told apart; answers still go through the app. A comment on
// the open "📥" pull request there wakes the Claude session that watches it. Run after each note or error report
// (waitUntil) and with the hourly cron; without the token nothing happens at all.
const REPORTS_REPO_DEFAULT = 'rozinante2004-hash/kitchen-reports';
const REPORTS_PER_RUN = 6;                 // issues a run may open (each is up to three calls to GitHub)
const REPORTS_ERRORS_SINCE_DAYS = 7;       // error reports older than this are not sent on the first run
const REPORT_COPIES = { 'my-kitchen-notes-beta': 'beta', 'tonys-recipes-test': 'test', 'recipes-f379d': 'family' };
function reportsRepo(env) {
  const r = String(env.REPORTS_REPO || REPORTS_REPO_DEFAULT);
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(r) ? r : REPORTS_REPO_DEFAULT;
}
async function reportsGh(env, method, path, body) {
  const f = env.__fetch || fetch;
  const r = await f('https://api.github.com' + path, { method, headers: {
    'Authorization': 'Bearer ' + env.REPORTS_GITHUB_TOKEN, 'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'my-kitchen-notes-worker', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error('GitHub ' + r.status + ' on ' + method + ' ' + path.split('?')[0].replace(/\/repos\/[^/]+\/[^/]+/, '')
    + (data && data.message ? ': ' + String(data.message).slice(0, 140) : ''));
  return data;
}
async function reportsHash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}
function reportsB64(s) {                   // UTF-8 text → base64, in pieces (a log can be 200 KB)
  const bytes = new TextEncoder().encode(String(s));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// The tester's words, shown as they are and never as markdown: in a fence longer than any run of ~ in them, so no
// @mention can notify anyone and nothing in a note can dress up as something else. A title has no fence: its @ goes.
function reportsFence(text) {
  const runs = String(text).match(/~{3,}/g) || [];
  const n = Math.max(4, ...runs.map(x => x.length + 1));
  const f = '~'.repeat(n);
  return f + 'text\n' + String(text) + '\n' + f;
}
function reportsTitle(s) { return String(s).replace(/\s+/g, ' ').replace(/@/g, '＠').trim().slice(0, 90); }
function reportsCode(s, max) { return '`' + (String(s == null || s === '' ? '?' : s).replace(/[`\r\n]/g, ' ').slice(0, max || 120) || '?') + '`'; }
function reportsVersion(v) { return /^v?[0-9][0-9A-Za-z.\-]{0,18}$/.test(String(v || '')) ? String(v) : '?'; }
async function reportLinksTable(db) {
  await tableOnce(db, 'report_links', 'CREATE TABLE IF NOT EXISTS report_links (kind TEXT NOT NULL, ref TEXT NOT NULL, issue INTEGER, at INTEGER, '
    + 'PRIMARY KEY (kind, ref))');
}
// A row here before the issue is made: two runs at once cannot both send the same report.
async function reportsClaim(db, kind, ref) {
  const r = await db.prepare('INSERT OR IGNORE INTO report_links (kind, ref, issue, at) VALUES (?1, ?2, NULL, ?3)').bind(kind, String(ref), Date.now()).run();
  return !!(r && r.meta && r.meta.changes);
}
async function reportsFile(env, repo, path, b64, what) {
  await reportsEnsureBranch(env, repo);   // v91 — on their own branch, rewritten monthly (reportsRetention)
  const d = await reportsGh(env, 'PUT', '/repos/' + repo + '/contents/' + path, { message: what, content: b64, branch: REPORTS_FILES_BRANCH });
  return (d && d.content && d.content.html_url) || ('https://github.com/' + repo + '/blob/' + REPORTS_FILES_BRANCH + '/' + path);
}
async function reportsForward(env, opts) {
  const out = { configured: !!(env.REPORTS_GITHUB_TOKEN && env.METER_DB), sent: [], errors: [] };
  if (!out.configured) return out;
  const max = Math.min(Math.max(1, (opts && opts.max) || REPORTS_PER_RUN), 20);
  const repo = reportsRepo(env), db = await meterDb(env);
  await reportLinksTable(db); await feedbackTable(db); await signalsTable(db);
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  const todo = [];
  // Notes not yet sent and not done, newest first.
  const notes = (await db.prepare('SELECT f.id, f.project, f.uid, f.hid, f.text, f.shot, f.log, f.version, f.env, f.device, f.lang, f.at '
    + 'FROM feedback f LEFT JOIN report_links l ON l.kind = \'note\' AND l.ref = CAST(f.id AS TEXT) '
    + 'WHERE l.ref IS NULL AND f.status != \'done\' ORDER BY f.at DESC LIMIT ?1').bind(max).all()).results || [];
  notes.forEach(n => todo.push({ kind: 'note', ref: String(n.id), row: n }));
  // Error reports by kind: one issue for each wording, place and version — however many people it happened to.
  if (todo.length < max) {
    const groups = (await db.prepare('SELECT project, kind, message, place, version, MIN(first_at) AS first_at, MAX(last_at) AS last_at, '
      + 'SUM(n) AS n, COUNT(DISTINCT uid) AS people, MAX(screen) AS screen, MAX(device) AS device, MAX(lang) AS lang, MAX(env) AS env '
      + 'FROM app_errors WHERE status = \'new\' AND last_at > ?1 GROUP BY project, kind, message, place, version ORDER BY MAX(last_at) DESC LIMIT 200')
      .bind(Date.now() - REPORTS_ERRORS_SINCE_DAYS * 864e5).all()).results || [];
    const sent = new Set(((await db.prepare('SELECT ref FROM report_links WHERE kind = \'err\'').all()).results || []).map(x => x.ref));
    for (const g of groups) {
      if (todo.length >= max) break;
      const sig = (await reportsHash([g.project, g.kind, g.version, g.place, g.message].join('\u0001'))).slice(0, 32);
      if (!sent.has(sig)) todo.push({ kind: 'err', ref: sig, row: g });
    }
  }
  for (const t of todo) {
    if (!(await reportsClaim(db, t.kind, t.ref))) continue;
    const r = t.row, copy = REPORT_COPIES[r.project] || r.project, when = ilTime(t.kind === 'note' ? r.at : r.last_at) + ' (Israel time)';
    const ver = reportsVersion(r.version);
    try {
      let title, body, labels;
      if (t.kind === 'note') {
        const who = (await reportsHash(r.project + '|' + r.uid)).slice(0, 8);
        const stem = day(r.at) + '-note-' + r.id;
        const extra = [];
        const shot = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(r.shot || ''));
        if (shot) {
          const url = await reportsFile(env, repo, 'shots/' + stem + '.' + (shot[1] === 'jpeg' ? 'jpg' : shot[1]), shot[2], 'Screenshot of note ' + r.id);
          extra.push('📷 The screenshot: ' + url + '\n\n![screenshot](' + url + '?raw=true)');
        }
        if (String(r.log || '').trim()) {
          const url = await reportsFile(env, repo, 'logs/' + stem + '.txt', reportsB64(r.log), 'The app\'s log with note ' + r.id);
          extra.push('📋 What the app was doing (its log): ' + url);
        }
        title = '💬 ' + copy + ' ' + ver + ' — ' + reportsTitle(String(r.text).split('\n')[0]);
        labels = ['note', copy];
        body = '**💬 A note** from the **' + copy + '** copy · ' + ver + ' · ' + when + '\n\n'
          + '- Sender: `' + who + '` (a fingerprint: notes from the same person share it)\n'
          + '- Household: ' + reportsCode(r.hid, 64) + ' · language: ' + reportsCode(r.lang, 10) + '\n'
          + '- Device: ' + reportsCode(r.device, 300) + '\n\n'
          + reportsFence(r.text) + '\n\n' + (extra.length ? extra.join('\n\n') + '\n\n' : '')
          + 'Note #' + r.id + ' — answered in the app: ⚙️ → 👑 App owner → 📊 Households → 💬 Feedback.';
      } else {
        title = '⚠️ ' + copy + ' ' + ver + ' — ' + reportsTitle(r.message);
        labels = ['error', copy];
        body = '**⚠️ An error report** from the **' + copy + '** copy · ' + ver + ' · kind ' + reportsCode(r.kind, 30) + '\n\n'
          + '- Where: ' + reportsCode(r.place, 200) + ' · screen: ' + reportsCode(r.screen, 80) + '\n'
          + '- ' + (Number(r.n) || 1) + ' time(s), to ' + (Number(r.people) || 1) + ' person(s): first ' + ilTime(r.first_at) + ', last ' + when + '\n'
          + '- Device: ' + reportsCode(r.device, 300) + ' · language: ' + reportsCode(r.lang, 10) + '\n\n'
          + reportsFence(r.message) + '\n\n'
          + 'In the app: ⚙️ → 👑 App owner → 📊 Households → ⚠️ Errors.';
      }
      const issue = await reportsGh(env, 'POST', '/repos/' + repo + '/issues', { title, body: body.slice(0, 60000), labels });
      await db.prepare('UPDATE report_links SET issue = ?1 WHERE kind = ?2 AND ref = ?3').bind(issue.number, t.kind, t.ref).run();
      out.sent.push({ issue: issue.number, title });
    } catch (e) {
      // Not sent: the claim goes, so the next run tries again; the rest wait for it.
      await db.prepare('DELETE FROM report_links WHERE kind = ?1 AND ref = ?2').bind(t.kind, t.ref).run();
      out.errors.push(String((e && e.message) || e).slice(0, 300));
      if (/GitHub (401|403|404)/.test(out.errors[0])) {
        try {
          await raiseNotice(env, { what: 'reports:github', kind: 'warning', scope: 'owner', until: nextUtcMidnight(Date.now()), self: true,
            title: 'Reports cannot reach the private repository on GitHub', affects: 'notes and error reports reaching Claude (the app keeps them as before)',
            detail: out.errors[0] + ' — the token REPORTS_GITHUB_TOKEN may have expired, or lost its access to ' + repo + '.' });
        } catch (e2) {}
      }
      break;
    }
  }
  if (out.sent.length) {
    try {
      let inbox = await db.prepare('SELECT issue FROM report_links WHERE kind = \'inbox\' AND ref = \'pr\'').first();
      let pr = inbox && inbox.issue;
      if (!pr) {
        const pulls = await reportsGh(env, 'GET', '/repos/' + repo + '/pulls?state=open&per_page=30');
        const p = (Array.isArray(pulls) ? pulls : []).filter(x => /^📥/.test(String(x.title || '')))[0];
        if (p) { pr = p.number; await db.prepare('INSERT OR REPLACE INTO report_links (kind, ref, issue, at) VALUES (\'inbox\', \'pr\', ?1, ?2)').bind(pr, Date.now()).run(); }
      }
      if (pr) {
        try {
          await reportsGh(env, 'POST', '/repos/' + repo + '/issues/' + pr + '/comments',
            { body: '📥 New: ' + out.sent.map(s => '#' + s.issue + ' ' + s.title).join('\n📥 New: ') });
          out.inbox = pr;
        } catch (e) {
          await db.prepare('DELETE FROM report_links WHERE kind = \'inbox\' AND ref = \'pr\'').run();   // found again next time
          throw e;
        }
      }
    } catch (e) { out.errors.push('inbox: ' + String((e && e.message) || e).slice(0, 200)); }
  }
  return out;
}
// v91 — HOW LONG THE REPORTS STAY (Tony, 25 Oct 2026: "They cannot stay there forever. We need some cleanup
// mechanism"; agreed: 90 days after a report is closed, 180 days at most). Run by the daily sweep. An expired report's
// screenshot and log are deleted, then the issue itself (GraphQL deleteIssue — GitHub lets only an admin's token do it).
// If GitHub refuses that, the issue is emptied instead (title, body, comments) and the owner is told once, in 🩺, which
// permission the token lacks. New screenshots and logs go to their own branch (REPORTS_FILES_BRANCH), which once a
// month is rewritten as a single commit of what is left, so a deleted screenshot leaves the history too; the inbox pull
// request (on main) is not touched. At the end of the beta Tony deletes the repository.
const REPORTS_FILES_BRANCH = 'files';
const REPORTS_KEEP_CLOSED_DAYS = 90, REPORTS_KEEP_MAX_DAYS = 180, REPORTS_SQUASH_DAYS = 30, REPORTS_EXPIRE_PER_RUN = 20;
async function reportsEnsureBranch(env, repo) {
  try { await reportsGh(env, 'GET', '/repos/' + repo + '/git/ref/heads/' + REPORTS_FILES_BRANCH); return true; }
  catch (e) { if (!/GitHub 404/.test(String(e.message))) throw e; }
  const main = await reportsGh(env, 'GET', '/repos/' + repo + '/git/ref/heads/main');
  await reportsGh(env, 'POST', '/repos/' + repo + '/git/refs', { ref: 'refs/heads/' + REPORTS_FILES_BRANCH, sha: main.object.sha });
  return true;
}
async function reportsRetention(env, now) {
  const out = { expired: 0, deleted: 0, emptied: 0, files: 0, squashed: false, errors: [] };
  if (!env.REPORTS_GITHUB_TOKEN || !env.METER_DB) return out;
  now = now || Date.now();
  const repo = reportsRepo(env), db = await meterDb(env);
  await reportLinksTable(db);
  try {
    const old = [];
    for (let page = 1; page <= 5 && old.length < REPORTS_EXPIRE_PER_RUN; page++) {
      const list = await reportsGh(env, 'GET', '/repos/' + repo + '/issues?state=all&sort=created&direction=asc&per_page=100&page=' + page);
      if (!Array.isArray(list) || !list.length) break;
      list.forEach(i => {
        if (i.pull_request || /^\[removed\]/.test(String(i.title || ''))) return;   // the inbox; one already emptied
        const closed = i.state === 'closed' && Date.parse(i.closed_at) < now - REPORTS_KEEP_CLOSED_DAYS * 864e5;
        const ancient = Date.parse(i.created_at) < now - REPORTS_KEEP_MAX_DAYS * 864e5;
        if ((closed || ancient) && old.length < REPORTS_EXPIRE_PER_RUN) old.push(i);
      });
      if (list.length < 100) break;
    }
    out.expired = old.length;
    for (const i of old) {
      const paths = Array.from(new Set((String(i.body || '').match(/\/blob\/(?:main|files)\/(?:shots|logs)\/[A-Za-z0-9._-]+/g) || [])));
      for (const p of paths) {
        const m = /\/blob\/(main|files)\/(.+)$/.exec(p);
        try {
          const f = await reportsGh(env, 'GET', '/repos/' + repo + '/contents/' + m[2] + '?ref=' + m[1]);
          await reportsGh(env, 'DELETE', '/repos/' + repo + '/contents/' + m[2], { message: 'Retention: issue #' + i.number, sha: f.sha, branch: m[1] });
          out.files++;
        } catch (e) { if (!/GitHub 404/.test(String(e.message))) throw e; }
      }
      const g = await reportsGh(env, 'POST', '/graphql', { query: 'mutation($id: ID!) { deleteIssue(input: { issueId: $id }) { clientMutationId } }', variables: { id: i.node_id } });
      if (g && !g.errors) { out.deleted++; continue; }
      // Not allowed to delete: empty it, and its comments.
      const cs = await reportsGh(env, 'GET', '/repos/' + repo + '/issues/' + i.number + '/comments?per_page=100');
      for (const c of (Array.isArray(cs) ? cs : [])) await reportsGh(env, 'DELETE', '/repos/' + repo + '/issues/comments/' + c.id);
      await reportsGh(env, 'PATCH', '/repos/' + repo + '/issues/' + i.number, { title: '[removed] after the retention period',
        body: 'Removed under the reports retention (' + REPORTS_KEEP_CLOSED_DAYS + ' days after closing, ' + REPORTS_KEEP_MAX_DAYS + ' at most).', state: 'closed', labels: [] });
      out.emptied++;
    }
    if (out.emptied) {
      try {
        await raiseNotice(env, { what: 'reports:retention', kind: 'warning', scope: 'owner', until: nextUtcMidnight(now) + 6 * 864e5, self: true,
          title: 'Old reports were emptied, not deleted', affects: 'the reports retention in the private repository',
          detail: 'GitHub lets only a token with admin rights delete issues. To delete them fully, give the token REPORTS_GITHUB_TOKEN the repository permission "Administration: Read and write" (github.com → Settings → Developer settings → Fine-grained tokens → kitchen-reports-worker → Edit).' });
      } catch (e) {}
    }
    // Once a month: the files branch as one commit of what is left.
    const last = await db.prepare('SELECT at FROM report_links WHERE kind = \'squash\' AND ref = \'files\'').first();
    if (!last || last.at < now - REPORTS_SQUASH_DAYS * 864e5) {
      let ref = null;
      try { ref = await reportsGh(env, 'GET', '/repos/' + repo + '/git/ref/heads/' + REPORTS_FILES_BRANCH); } catch (e) { if (!/GitHub 404/.test(String(e.message))) throw e; }
      if (ref) {
        const head = await reportsGh(env, 'GET', '/repos/' + repo + '/git/commits/' + ref.object.sha);
        const fresh = await reportsGh(env, 'POST', '/repos/' + repo + '/git/commits', { message: 'Reports files as of ' + new Date(now).toISOString().slice(0, 10) + ' (monthly: deleted files leave the history)', tree: head.tree.sha, parents: [] });
        await reportsGh(env, 'PATCH', '/repos/' + repo + '/git/refs/heads/' + REPORTS_FILES_BRANCH, { sha: fresh.sha, force: true });
        out.squashed = true;
      }
      await db.prepare('INSERT OR REPLACE INTO report_links (kind, ref, issue, at) VALUES (\'squash\', \'files\', NULL, ?1)').bind(now).run();
    }
  } catch (e) { out.errors.push(String((e && e.message) || e).slice(0, 300)); }
  return out;
}
function reportsLater(env, ctx) {
  if (!env.REPORTS_GITHUB_TOKEN || !env.METER_DB) return;
  const p = reportsForward(env).catch(() => null);
  if (ctx && ctx.waitUntil) ctx.waitUntil(p);
}

export default {
  // v75 — the daily sweep (cron in worker/wrangler.jsonc).
  async scheduled(event, env, ctx) {
    const at = (event && Number(event.scheduledTime)) || Date.now();
    // v84 — the hourly usage check (its own cron); the daily sweep is the other
    if (event && event.cron === HOURLY_CRON) {
      // v90 — and any report a run after it was sent could not pass on
      const h = Promise.all([hourlyUsage(env), env.REPORTS_GITHUB_TOKEN && env.METER_DB ? reportsForward(env).catch(() => null) : null]);
      if (ctx && ctx.waitUntil) ctx.waitUntil(h); else await h; return;
    }
    const p = retentionSweep(env, at).then(async function (done) {
      // v91 — and the reports in the private repository that have run their time
      if (env.REPORTS_GITHUB_TOKEN && env.METER_DB) { try { done = Object.assign({}, done, { reports: await reportsRetention(env, at) }); } catch (e) {} }
      // v78 — the AI ceiling counters and the allowance notices that have run their time.
      if (env.METER_DB) {
        try { await env.METER_DB.prepare('DELETE FROM counters WHERE until < ?1').bind(at).run(); } catch (e) {}
        try { await env.METER_DB.prepare('DELETE FROM server_notices WHERE until < ?1').bind(at).run(); } catch (e) {}
      }
      return done;
    });
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  },
  async fetch(request, env, ctx) {
    const cors = corsFor(request, env);
    let resp;
    try {
      resp = await handleRequest(request, env, ctx);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      // v78 — D1's daily allowance used up: remembered (in KV) and said, with when it comes back.
      // …and KV's (a Bring! page): the same, remembered in D1.
      if (/\bKV\b|put\(\)/.test(msg) && isLimitError(err)) {
        await noteServerLimit(env, 'kv', err);
        resp = jsonResp({ error: 'SERVER_LIMIT: the server\'s free daily allowance for storage writes is used up, so this '
          + 'cannot be done just now. It comes back by itself at 00:00 UTC.', serverLimit: true,
          notice: (await serverNotices(env)).filter(function (n) { return n.what === 'kv'; })[0] || null }, 503);
      } else if (/\bD1\b|D1_/.test(msg) && isLimitError(err)) {
        await noteServerLimit(env, 'd1', err);
        resp = jsonResp({ error: 'SERVER_LIMIT: the server\'s free daily allowance for its database is used up, so this '
          + 'cannot be done just now. It comes back by itself at 00:00 UTC.', serverLimit: true,
          notice: (await serverNotices(env)).filter(function (n) { return n.what === 'd1'; })[0] || null }, 503);
      } else resp = jsonResp({ error: 'Worker error: ' + msg }, 500);
    }
    // v79 — Google's free allowance for videos, said wherever it was met.
    if (resp.status === 429) {
      try { const j = await resp.clone().json();
        if (j && /^VIDEO_QUOTA/.test(String(j.error || '')))
          await raiseNotice(env, { what: 'gemini', kind: 'paused', scope: 'all', self: true, until: nextPacificMidnight(Date.now()),
            title: 'Google\'s free allowance for reading videos (Gemini) is used up', affects: 'reading a recipe from a video',
            detail: 'It comes back at midnight California time.' });
      } catch (e) {}
    }
    // Stamp CORS on EVERY response, whatever produced it — including the binary
    // download path and anything that throws. Handlers no longer decide this.
    const h = new Headers(resp.headers);
    Object.keys(cors).forEach(function(k){ h.set(k, cors[k]); });
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
  }
};

// ── END OF WORKER v93 ── If this is the last line in the Cloudflare editor, the whole file was pasted.
