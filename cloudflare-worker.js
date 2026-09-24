// Tony's Recipes — Cloudflare Worker v40
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
// ── BRING SETUP (one-time) ───────────────────────────────────────────────────
// Add these in Cloudflare → Worker → Settings → Variables & Secrets:
//   BRING_TOKEN     – current Bring! access token (or leave unset and let the
//                     bookmarklet/relay store it in KV, which takes precedence)
//   BRING_API_KEY   – the X-BRING-API-KEY value
//   BRING_LIST_UUID – the shopping list to add items to
//   BRING_USER_UUID – your Bring! user uuid
// Nothing Bring!-related is hard-coded here any more, so this file is safe to
// commit publicly. The token that used to be hard-coded here is still in git
// history, but it was rotated on 1 Aug 2026 and the leaked value is now dead.
//
// ── SPEND CEILINGS (v39, optional) ───────────────────────────────────────────
// Both have working defaults, so neither has to be set:
//   AI_DAILY_MAX    – Anthropic calls allowed per UTC day, all callers (300)
//   AI_MONTHLY_MAX  – …and per UTC calendar month (3000)
// They are the ceiling on the API bill if the app key ever leaks. Raise them if
// a real day's use gets close; `health` reports the current counts to a caller
// that presents the app key.

const WORKER_VERSION = 'v41';
const BRING_API_V2 = 'https://api.getbring.com/rest/v2';

function bringHeaders(env) {
  return {
    'X-BRING-CLIENT':        'WebApp',
    'X-BRING-CLIENT-SOURCE': 'webApp',
    'X-BRING-COUNTRY':       env.BRING_COUNTRY || 'IL',
    'X-BRING-API-KEY':       env.BRING_API_KEY || '',
    'Origin':                'https://web.getbring.com',
    'Referer':               'https://web.getbring.com/',
  };
}

// Human-readable error when Bring! config is missing, instead of a confusing 401.
function bringConfigError(missing) {
  return jsonResp({
    error: 'BRING_CONFIG: Bring! is not configured on the server. Missing: ' + missing.join(', ')
      + '.\n\nAdd them in Cloudflare → your Worker → Settings → Variables & Secrets, then redeploy.',
    needsConfig: true
  }, 503);
}

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
  const costly = !action || action === 'ai' || action === 'instagram-fetch';
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

// KV (refreshed by the bookmarklet/relay) wins; otherwise fall back to the env var.
async function getToken(env) {
  if (env.BRING_KV) {
    try {
      const stored = await env.BRING_KV.get('accessToken');
      if (stored) return stored;
    } catch(e) {}
  }
  return env.BRING_TOKEN || '';
}

// Decode a JWT payload without verifying it — we only want the `exp` claim so
// the app can report the *real* expiry instead of guessing from a per-device
// localStorage value that goes stale the moment the token is refreshed
// somewhere else (which is exactly what made the app cry "expired" wrongly).
function decodeJwtExp(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch (e) { return null; }
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

    // GET is a liveness check and nothing else. (v41 — it used to serve files
    // stored by the `download-store` action; see the note where that was.)
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

    let body;
    try { body = JSON.parse(await request.text()); }
    catch(e) { return jsonResp({ error: 'Invalid JSON' }, 400, corsHeaders); }

    // health is deliberately open: the app pings it to tell "Worker down" apart
    // from "Worker refusing me", and it reveals nothing and costs nothing.
    if (body.action !== 'health') {
      // bring-settoken comes from a bookmarklet running on web.getbring.com, so
      // it cannot satisfy the origin or app-key checks. Its own secret is what
      // authenticates it — see below, where the insecure default was removed.
      if (body.action !== 'bring-settoken') {
        if (!appKeyOk(request, env, body)) {
          return jsonResp({ error: 'FORBIDDEN: missing or wrong app key.' }, 403, corsHeaders);
        }
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
        configured: {
          anthropic: !!env.ANTHROPIC_API_KEY,
          openverse: true,
          pixabay: !!env.PIXABAY_API_KEY,
          pexels: !!env.PEXELS_API_KEY,
          unsplash: !!env.UNSPLASH_ACCESS_KEY,
          youtube: !!env.YOUTUBE_API_KEY,
          bringToken: !!(env.BRING_KV || env.BRING_TOKEN),
          bringSetToken: !!env.BRING_SETTOKEN_SECRET
        }
      }, 200, corsHeaders);
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
          return jsonResp({
            title, author, text,
            thumbnail: data.thumbnail_url || '',
            // < 40 chars is not a recipe. Say so rather than letting the app feed
            // "View this post on Instagram" to Claude and call the result a recipe.
            partial: caption.trim().length < 40,
          });
        } catch(e) { /* try the next endpoint */ }
      }
      // 404 rather than 500: this is "no caption available", not a broken Worker.
      return jsonResp({
        error: 'Instagram did not return a caption for this post. Copy the caption and paste it into the free-hand importer instead.',
        unavailable: true,
      }, 404);
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

    // ── bring-add ─────────────────────────────────────────────────────────────
    if (body.action === 'bring-add') {
      const { items, listUuid } = body;
      if (!items || !items.length) return jsonResp({ error: 'No items' }, 400);
      const targetList = listUuid || env.BRING_LIST_UUID;
      const token = await getToken(env);
      const missing = [];
      if (!token) missing.push('BRING_TOKEN (or a token in KV)');
      if (!env.BRING_API_KEY) missing.push('BRING_API_KEY');
      if (!targetList) missing.push('BRING_LIST_UUID');
      if (missing.length) return bringConfigError(missing);
      try {
        const results = [];
        for (const item of items) {
          const form = new URLSearchParams();
          form.append('purchase', item.name);
          form.append('specification', item.spec || '');
          const r = await fetch(BRING_API_V2 + '/bringlists/' + targetList, {
            method: 'PUT',
            headers: { ...bringHeaders(env), 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString()
          });
          results.push({ item: item.name, status: r.status, ok: r.ok });
          if (r.status === 401) break;
        }
        const expired = results.some(r => r.status === 401);
        if (expired) return jsonResp({ success: false, tokenExpired: true }, 401);
        return jsonResp({ success: results.every(r => r.ok), results, listUuid: targetList });
      } catch(err) { return jsonResp({ error: err.message }, 500); }
    }

    // ── bring-lists ───────────────────────────────────────────────────────────
    if (body.action === 'bring-lists') {
      const token = await getToken(env);
      const missing = [];
      if (!token) missing.push('BRING_TOKEN (or a token in KV)');
      if (!env.BRING_API_KEY) missing.push('BRING_API_KEY');
      if (!env.BRING_USER_UUID) missing.push('BRING_USER_UUID');
      if (missing.length) return bringConfigError(missing);
      try {
        const r = await fetch(BRING_API_V2 + '/bringlists/' + env.BRING_USER_UUID, {
          headers: { ...bringHeaders(env), 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        const text = await r.text();
        let data = {};
        try { data = JSON.parse(text); } catch(e) {}
        return jsonResp({ status: r.status, ok: r.ok, lists: data.lists ? data.lists.map(l => ({ name: l.name, uuid: l.listUuid })) : [] });
      } catch(err) { return jsonResp({ error: err.message }, 500); }
    }

    // ── bring-token-status ────────────────────────────────────────────────────
    // The single source of truth for "is the Bring! token still good?".
    // Returns the token's real expiry (from its JWT `exp`) plus, on request,
    // a live probe against the Bring! API. No token material is returned.
    if (body.action === 'bring-token-status') {
      const token = await getToken(env);
      if (!token) {
        return jsonResp({ configured: false, valid: false, exp: null, daysLeft: null,
                          reason: 'No Bring! token stored (KV empty and BRING_TOKEN unset).' });
      }
      const exp = decodeJwtExp(token);
      const now = Math.floor(Date.now() / 1000);
      const secondsLeft = exp === null ? null : exp - now;
      const out = {
        configured: true,
        exp,
        daysLeft: secondsLeft === null ? null : Math.floor(secondsLeft / 86400),
        secondsLeft,
        expired: secondsLeft === null ? null : secondsLeft <= 0,
        source: env.BRING_KV ? 'kv-or-env' : 'env',
      };
      // Optional live check — the JWT may be structurally valid but revoked.
      if (body.probe && env.BRING_API_KEY && env.BRING_USER_UUID) {
        try {
          const r = await fetch(BRING_API_V2 + '/bringlists/' + env.BRING_USER_UUID, {
            headers: { ...bringHeaders(env), 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
          });
          out.probed = true;
          out.valid = r.ok;
          out.probeStatus = r.status;
          if (r.status === 401) out.expired = true;
        } catch (err) {
          out.probed = false;
          out.probeError = err.message;
        }
      }
      if (out.valid === undefined) out.valid = out.expired === false;
      return jsonResp(out);
    }

    // ── bring-settoken ────────────────────────────────────────────────────────
    if (body.action === 'bring-settoken') {
      const { token, secret } = body;
      // Override with a BRING_SETTOKEN_SECRET env var if you want a different one
      // (the default matches the bookmarklet the app generates today).
      // The old fallback secret was committed in a PUBLIC repo, so if the env
      // var was unset anyone could overwrite the shared Bring! token. No default:
      // unset now means the endpoint is closed, which is the safe direction.
      if (!env.BRING_SETTOKEN_SECRET) {
        return jsonResp({ error: 'BRING_SETTOKEN_SECRET is not set on the Worker, so this endpoint is closed. Set it in Cloudflare → Settings → Variables & Secrets.' }, 503, corsHeaders);
      }
      if (secret !== env.BRING_SETTOKEN_SECRET) return jsonResp({ error: 'Unauthorized' }, 403, corsHeaders);
      if (!token || token.split('.').length !== 3) return jsonResp({ error: 'Invalid token' }, 400);
      if (env.BRING_KV) {
        try {
          await env.BRING_KV.put('accessToken', token);
          return jsonResp({ success: true, message: 'Token updated in KV' });
        } catch(e) {}
      }
      return jsonResp({ success: false, message: 'KV not available' });
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
      if (ct.indexOf('image/') !== 0) {
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
        if (k === 'appKey' || k === 'action') return;   // Worker-only, never Anthropic's
        forwarded[k] = body[k];
      });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(forwarded),
      });
      const data = await r.json();
      // CORS is applied centrally by the fetch wrapper (v36); it overwrites
      // whatever is set here, so this carries only Content-Type.
      return new Response(JSON.stringify(data), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch(err) { return jsonResp({ error: err.message }, 500); }
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
