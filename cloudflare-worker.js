// Tony's Recipes — Cloudflare Worker v66
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

const WORKER_VERSION = 'v66';
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
const KV_SAMPLE_CHEAP = 5;    // count 1 request in 5 on the non-AI paths
const KV_SAMPLE_MONTH = 10;   // the monthly total is a coarse guard rail
const AI_DAILY_DEFAULT = 300;     // Anthropic calls per day, all callers
const AI_MONTHLY_DEFAULT = 3000;  // …and per calendar month

// Isolate-scoped circuit breaker. A Worker isolate is short-lived and there are
// many of them, so this is not a global truth — it does not need to be. Its job
// is that once writes start failing in THIS isolate, the money-spending path
// stops immediately instead of running unmetered until the isolate is recycled.
let _kvWritesFailing = false;

function utcDayKey(now)   { return new Date(now).toISOString().slice(0, 10); }  // YYYY-MM-DD
function utcMonthKey(now) { return new Date(now).toISOString().slice(0, 7); }   // YYYY-MM

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

// Read a counter, decide, then credit it. Returns the value it read.
async function kvCount(kv, key, ttlSec, sample) {
  const used = parseInt(await kv.get(key) || '0', 10) || 0;
  return { used, credit: async () => {
    if (sample > 1 && Math.random() >= 1 / sample) return;   // sampled out — no write
    try {
      await kv.put(key, String(used + sample), { expirationTtl: ttlSec });
      _kvWritesFailing = false;   // writes work again — let the AI path back in
    } catch (e) { _kvWritesFailing = true; }
  } };
}

// KV is eventually consistent, so all of this is approximate — which is fine:
// the job is to bound a runaway, not to meter precisely.
async function rateLimited(request, env, action) {
  const kv = env.BRING_KV;
  // The AI path (no action) is the expensive one; browsing photos is cheap.
  const costly = !action || action === 'ai' || action === 'instagram-fetch' || action === 'video-recipe' || action === 'video-from-url';
  // Narrower than `costly`: instagram-fetch is slow but it does not spend
  // Anthropic credits, so it must not eat into the AI ceilings.
  const aiSpend = !action || action === 'ai';

  // No KV bound at all is a DEPLOYMENT fact, not an attack — there is nothing
  // to read and nothing to write, and breaking the family's app to punish a
  // hypothetical abuser is the wrong trade. `health` reports rateLimiting:false
  // so it is visible rather than silent.
  if (!kv) return null;

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
  const key = 'rl:' + ip + ':' + bucket + (costly ? ':ai' : ':x');
  // A 600/min ceiling counted 1-in-5 would still be 120 writes a minute, so the
  // burstiest path is sampled the hardest.
  const sample = costly ? 1 : (photoBytes ? KV_SAMPLE_MONTH : KV_SAMPLE_CHEAP);

  // If writes are already known to be failing in this isolate we cannot meter,
  // and unmeterable spend is the thing these ceilings exist to stop.
  if (aiSpend && _kvWritesFailing) {
    return jsonResp({ error: 'RATE_LIMIT: the spend guard rail cannot record this call, so AI '
      + 'requests are paused. This usually means the Worker\'s KV write allowance is used up for '
      + 'today. Everything that does not call the AI still works.', rateLimited: true }, 429);
  }

  let minute;
  try { minute = await kvCount(kv, key, windowSec * 2, sample); }
  catch (e) {
    // KV is bound but not answering. Carry on for the cheap paths; refuse the
    // one that spends money.
    if (!aiSpend) return null;
    return jsonResp({ error: 'RATE_LIMIT: the spend guard rail is not answering, so AI requests '
      + 'are paused rather than run unmetered. Everything that does not call the AI still works.',
      rateLimited: true }, 429);
  }
  if (minute.used >= limit) {
    return jsonResp({ error: 'RATE_LIMIT: too many requests in the last minute (' + minute.used + '/' + limit
      + '). Wait a minute and try again.', rateLimited: true, retryAfter: windowSec }, 429);
  }

  // Daily and monthly ceilings, on the Anthropic path only and across ALL
  // callers — an IP is free to change, an API bill is not. A per-minute limit
  // alone allows ~57,000 calls a day on Tony's credits.
  if (aiSpend) {
    const dayMax = parseInt(env.AI_DAILY_MAX || '', 10) || AI_DAILY_DEFAULT;
    const monMax = parseInt(env.AI_MONTHLY_MAX || '', 10) || AI_MONTHLY_DEFAULT;
    let day, mon;
    try {
      day = await kvCount(kv, 'rl:day:' + utcDayKey(now), 60 * 60 * 48, 1);
      mon = await kvCount(kv, 'rl:mon:' + utcMonthKey(now), 60 * 60 * 24 * 40, KV_SAMPLE_MONTH);
    } catch (e) {
      return jsonResp({ error: 'RATE_LIMIT: the spend guard rail is not answering, so AI requests '
        + 'are paused rather than run unmetered. Everything that does not call the AI still works.',
        rateLimited: true }, 429);
    }
    if (day.used >= dayMax) return ceilingResp('daily', day.used, dayMax);
    if (mon.used >= monMax) return ceilingResp('monthly', mon.used, monMax);
    await day.credit();
    await mon.credit();
  }

  await minute.credit();
  return null;
}

// What the ceilings currently read. Only shown to a caller that presented the
// app key — `health` itself is open on purpose, and the counts are none of an
// anonymous caller's business.
async function spendStatus(env) {
  const kv = env.BRING_KV;
  const out = {
    dailyMax:   parseInt(env.AI_DAILY_MAX || '', 10) || AI_DAILY_DEFAULT,
    monthlyMax: parseInt(env.AI_MONTHLY_MAX || '', 10) || AI_MONTHLY_DEFAULT,
    dailyUsed: null, monthlyUsed: null
  };
  if (!kv) return out;
  const now = Date.now();
  try {
    out.dailyUsed   = parseInt(await kv.get('rl:day:' + utcDayKey(now)) || '0', 10) || 0;
    out.monthlyUsed = parseInt(await kv.get('rl:mon:' + utcMonthKey(now)) || '0', 10) || 0;
  } catch (e) {}
  return out;
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
async function handleRequest(request, env) {
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
        // Keep in step with the header at the top of this file. It said v34 on a
        // v36 Worker, which made `health` — the one endpoint whose entire job is
        // to report the truth about this Worker — quietly wrong about it.
        version: WORKER_VERSION,
        originAllowed: origin !== false,
        appKeyRequired: !!env.APP_SHARED_KEY,
        appKeyAccepted: keyed,
        rateLimiting: !!env.BRING_KV,
        // v60 — the app sends its sign-in and household only to a Worker that
        // strips them before Anthropic (an older one would forward them, and
        // Anthropic refuses unknown fields — the v37 lesson).
        metering: { version: 1, db: !!env.METER_DB },
        feedback: !!env.METER_DB,     // v61 — notes from every copy, one inbox
        reports: !!env.METER_DB,      // v62 — households report themselves, one Households page
        notesImport: !!env.METER_DB,  // v64 — notes kept in a copy's own database move to the inbox
        configured: {
          anthropic: !!env.ANTHROPIC_API_KEY,
          openverse: true,
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
          headers: { 'Accept': 'image/*', 'User-Agent': 'TonysRecipes/1.0' },
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
    if (body.action === 'meter-me' || body.action === 'meter-admin') return await meterAction(request, env, body);
    if (body.action === 'feedback-send') return await feedbackSend(request, env, body);   // v61
    if (body.action === 'household-report') return await householdReport(request, env, body);   // v62

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
//   CAPPED_PROJECTS  …of those, the ones with an allowance (default: the test
//                    copy; add the beta's). The family's is counted, not capped.
//   CAPPED_ORIGINS   pages of capped copies: an AI call from one WITHOUT a
//                    sign-in is refused (default: the test copy's address)
//   AI_CAP_USD       the monthly allowance (2); AI_CAP_FIRST_USD the first
//                    month's, for a household's big first import (4)
//   OWNER_EMAILS     who may read every household's spending and set caps
//                    (`meter-admin`, the management app)
const METER_PROJECTS_DEFAULT = 'recipes-f379d,tonys-recipes-test,my-kitchen-notes-beta';
const CAPPED_PROJECTS_DEFAULT = 'tonys-recipes-test,my-kitchen-notes-beta';
const CAPPED_ORIGINS_DEFAULT = 'https://tonys-recipes-test.pages.dev,https://my-kitchen-notes-beta.pages.dev';
const OWNER_EMAILS_DEFAULT = 'rozinante2004@gmail.com';
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
function capFor(row, month, env) {
  if (row && typeof row.cap === 'number') return row.cap;                    // set in the management app
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
  const capped = csvList(env.CAPPED_PROJECTS, CAPPED_PROJECTS_DEFAULT).includes(aud) || cappedOrigin;
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
    // The household could not be READ (Firestore did not answer): a capped copy
    // refuses; the family's carries on for a proven sign-in, as before.
    if (capped) return { resp: allowanceResp('the AI could not be checked against your household\'s allowance ('
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
    const spent = row.usd || 0, cap = capFor(row, month, env);
    const ctx = { db, project: claims.aud, hid, month, capped, cap, spent, name: hh.name, code: hh.code, created: hh.created };
    if (capped && spent >= cap) {
      return { resp: allowanceResp('this month\'s AI allowance for your household is used up ($' + spent.toFixed(2)
        + ' of $' + cap.toFixed(2) + '). It renews on the 1st; everything that does not use the AI keeps working.') };
    }
    return { ctx };
  } catch (e) {
    // Spend that cannot be counted is what an allowance exists to stop — on a
    // capped copy. The family's copy is only counted, so it carries on.
    if (capped) return { resp: allowanceResp('the AI could not be checked against your household\'s allowance ('
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
  const capped = csvList(env.CAPPED_PROJECTS, CAPPED_PROJECTS_DEFAULT).includes(claims.aud);
  if (body.action === 'meter-me') {
    const hid = String(body.hid || '');
    let hh;
    try { hh = await meterMembership(claims, hid, body.idToken, env); } catch (e) { return jsonResp({ error: 'METER: ' + e.message }, 502); }
    if (!hh.member) return jsonResp({ error: 'METER: you are not in that household.' }, 403);
    const row = await db.prepare('SELECT h.cap, h.created_at, h.first_seen, s.usd, s.calls FROM (SELECT 1) LEFT JOIN ai_households h '
      + 'ON h.project = ?1 AND h.hid = ?2 LEFT JOIN ai_spend s ON s.project = ?1 AND s.hid = ?2 AND s.month = ?3')
      .bind(claims.aud, hid, month).first() || {};
    if (!row.created_at && hh.created) row.created_at = hh.created;
    return jsonResp({ month, usd: row.usd || 0, calls: row.calls || 0, cap: capped ? capFor(row, month, env) : null });
  }
  // meter-admin
  const owners = csvList(env.OWNER_EMAILS, OWNER_EMAILS_DEFAULT).map(s => s.toLowerCase());
  if (!claims.email_verified || !owners.includes(String(claims.email || '').toLowerCase()))
    return jsonResp({ error: 'METER: only the app\'s owner may see this.' }, 403);
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
  if (/^note|^notes/.test(String(body.op || ''))) { const fr = await feedbackAdmin(env, db, body); if (fr) return fr; }
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
  const cappedSet = csvList(env.CAPPED_PROJECTS, CAPPED_PROJECTS_DEFAULT);
  await reportsTable(db);
  const out = [];
  for (const p of want) {
    const pCapped = cappedSet.includes(p);
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
    byHid.forEach(h => {
      const mine = sp.filter(s => s.hid === h.hid);
      out.push(Object.assign(h, {
        project: p, capped: pCapped,
        capNow: pCapped ? capFor(h, month, env) : null,
        months: months.map(m => { const s = mine.filter(x => x.month === m)[0]; return { month: m, usd: s ? s.usd : 0, calls: s ? s.calls : 0 }; })
      }));
    });
  }
  return jsonResp({ project: claims.aud, capped, month, months, households: out, projects: want,
    defaults: { cap: parseFloat(env.AI_CAP_USD) || AI_CAP_USD_DEFAULT, firstMonth: parseFloat(env.AI_CAP_FIRST_USD) || AI_CAP_FIRST_USD_DEFAULT } });
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
    referrals: num(r.referrals) || 0
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
async function feedbackAdmin(env, db, body) {
  await feedbackTable(db);
  if (body.op === 'notes') {
    const rows = (await db.prepare('SELECT id, project, uid, email, name, hid, household, text, shot, log, version, env, device, lang, at, status '
      + 'FROM feedback ORDER BY at DESC LIMIT 300').all()).results || [];
    return jsonResp({ notes: rows });
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
  if (body.op === 'notes-new') {
    const r = await db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'").first();
    return jsonResp({ new: (r && r.n) || 0 });
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
  return null;
}

// ─── VIDEO RECIPES (v43, v44) ────────────────────────────────────────────────
// The daily ceiling both video actions share. null = go ahead.
async function videoDailyCap(env) {
  const kv = env.BRING_KV;
  if (!kv) return null;
  const vMax = parseInt(env.VIDEO_DAILY_MAX || '', 10) || VIDEO_DAILY_DEFAULT;
  try {
    const vDay = await kvCount(kv, 'rl:vid:' + utcDayKey(Date.now()), 60 * 60 * 48, 1);
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

export default {
  async fetch(request, env) {
    const cors = corsFor(request, env);
    let resp;
    try {
      resp = await handleRequest(request, env);
    } catch (err) {
      resp = jsonResp({ error: 'Worker error: ' + (err && err.message ? err.message : String(err)) }, 500);
    }
    // Stamp CORS on EVERY response, whatever produced it — including the binary
    // download path and anything that throws. Handlers no longer decide this.
    const h = new Headers(resp.headers);
    Object.keys(cors).forEach(function(k){ h.set(k, cors[k]); });
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
  }
};

// ── END OF WORKER v66 ── If this is the last line in the Cloudflare editor, the whole file was pasted.
