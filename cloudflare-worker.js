// Tony's Recipes — Cloudflare Worker v37
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

const WORKER_VERSION = 'v37';
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
  return {
    'Content-Type': 'application/json',
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

// KV-backed sliding window, keyed on the caller's IP. KV is eventually
// consistent, so this is approximate — which is fine: the job is to bound a
// runaway, not to meter precisely. Fails OPEN if no KV is bound, because
// breaking the family's app to punish a hypothetical abuser is the wrong trade.
async function rateLimited(request, env, action) {
  const kv = env.BRING_KV;
  if (!kv) return null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // The AI path (no action) is the expensive one; browsing photos is cheap.
  const costly = !action || action === 'ai' || action === 'instagram-fetch';
  const limit = parseInt(env.RATE_LIMIT || '', 10) || (costly ? 40 : 150);
  const windowSec = 60;
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = 'rl:' + ip + ':' + bucket + (costly ? ':ai' : ':x');
  let used = 0;
  try { used = parseInt(await kv.get(key) || '0', 10) || 0; } catch (e) { return null; }
  if (used >= limit) {
    return jsonResp({ error: 'RATE_LIMIT: too many requests in the last minute (' + used + '/' + limit
      + '). Wait a minute and try again.', rateLimited: true, retryAfter: windowSec }, 429);
  }
  try { await kv.put(key, String(used + 1), { expirationTtl: windowSec * 2 }); } catch (e) {}
  return null;
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

    // GET: serve stored file with correct Content-Disposition header
    if (request.method === 'GET') {
      const dlKey = new URL(request.url).searchParams.get('dl');
      // URL path may contain encoded filename (for Chrome filename detection)
      if (dlKey && env.BRING_KV) {
        try {
          const stored = await env.BRING_KV.get(dlKey);
          if (!stored) return new Response('File expired', { status: 404 });
          const { data, filename, mime } = JSON.parse(stored);
          await env.BRING_KV.delete(dlKey);
          const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
          const encodedName = encodeURIComponent(filename);
          return new Response(bytes, {
            status: 200,
            headers: {
              'Content-Type': mime || 'application/octet-stream',
              'Content-Disposition': "attachment; filename*=UTF-8''" + encodedName,
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store',
            }
          });
        } catch(e) {
          return new Response('Error: ' + e.message, { status: 500 });
        }
      }
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
      return jsonResp({
        ok: true,
        // Keep in step with the header at the top of this file. It said v34 on a
        // v36 Worker, which made `health` — the one endpoint whose entire job is
        // to report the truth about this Worker — quietly wrong about it.
        version: WORKER_VERSION,
        originAllowed: origin !== false,
        appKeyRequired: !!env.APP_SHARED_KEY,
        appKeyAccepted: appKeyOk(request, env, body),
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
        let text = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<header[\s\S]*?<\/header>/gi, ' ')
          .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
          .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
          .replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n')
          .trim().slice(0, 10000);
        return jsonResp({ text });
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

    // ── File download: store in KV, return one-time GET URL ──────────────────
    if (body.action === 'download-store') {
      try {
        const { data, filename, mime } = body;
        if (!data || !filename) return jsonResp({ error: 'Missing data or filename' }, 400);
        const key = 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
        await env.BRING_KV.put(key, JSON.stringify({ data, filename, mime }), { expirationTtl: 60 });
        // Put filename in URL path — Chrome uses path segment as filename
        const baseUrl = request.url.split('?')[0];
        const encodedFilename = encodeURIComponent(filename);
        const getUrl = baseUrl + encodedFilename + '?dl=' + encodeURIComponent(key);
        return jsonResp({ url: getUrl });
      } catch(err) {
        return jsonResp({ error: 'download-store failed: ' + err.message }, 500);
      }
    }

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
