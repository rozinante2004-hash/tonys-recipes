// Tony's Recipes — Cloudflare Worker v31
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

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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
      return new Response('OK', { status: 200, headers: {'Access-Control-Allow-Origin': '*'} });
    }

    if (request.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);

    let body;
    try { body = JSON.parse(await request.text()); }
    catch(e) { return jsonResp({ error: 'Invalid JSON' }, 400); }

    // ── instagram-fetch ──────────────────────────────────────────────────────
    if (body.action === 'instagram-fetch') {
      const { shortcode } = body;
      if (!shortcode) return jsonResp({ error: 'No shortcode' }, 400);
      // Instagram's oEmbed API now requires authentication and is no longer publicly accessible.
      // We attempt multiple endpoints but gracefully degrade — never returning 500.
      try {
        // Try the graph.facebook.com oEmbed endpoint (most reliable)
        const endpoints = [
          `https://graph.facebook.com/v18.0/instagram_oembed?url=https://www.instagram.com/p/${shortcode}/&fields=title,author_name,thumbnail_url`,
          `https://api.instagram.com/oembed/?url=https://www.instagram.com/p/${shortcode}/`,
          `https://www.instagram.com/api/v1/oembed/?url=https://www.instagram.com/p/${shortcode}/&hidecaption=0`,
        ];
        for (const url of endpoints) {
          try {
            const r = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)', 'Accept': 'application/json' },
              signal: AbortSignal.timeout(6000),
            });
            if (r.ok) {
              const data = await r.json();
              const text = [data.title || '', data.author_name ? 'By: ' + data.author_name : ''].filter(Boolean).join('\n\n');
              return jsonResp({ title: data.title || '', author: data.author_name || '', text, thumbnail: data.thumbnail_url || '' });
            }
          } catch(e) { /* try next endpoint */ }
        }
        // All endpoints failed — Instagram requires auth. Return 404 (not 500) so app can show user-friendly message.
        return jsonResp({ error: 'Instagram import is not available. Instagram now requires authentication for their API. Please copy and paste the caption text manually using the Free-hand import option.', unavailable: true }, 404);
      } catch(err) {
        return jsonResp({ error: 'Instagram fetch failed: ' + err.message, unavailable: true }, 404);
      }
    }

    // ── fetch-url ─────────────────────────────────────────────────────────────
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
      if (secret !== (env.BRING_SETTOKEN_SECRET || 'tonys-recipes-2024')) return jsonResp({ error: 'Unauthorized' }, 403);
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
      try {
        // ── Pixabay ──
        if (source === 'pixabay') {
          const key = env.PIXABAY_API_KEY;
          if (!key) return jsonResp({ source, images: [], notConfigured: true });
          const url = 'https://pixabay.com/api/?key=' + key + '&q=' + encodeURIComponent(query)
            + '&image_type=photo&per_page=' + perPage + '&page=' + page + '&safesearch=true&order=popular';
          const resp = await fetch(url);
          const raw = await resp.text();
          let data; try { data = JSON.parse(raw); } catch(e) { return jsonResp({ source, error: 'Pixabay: invalid JSON (' + resp.status + ')' }); }
          if (!resp.ok || data.error) return jsonResp({ source, error: 'Pixabay error ' + resp.status + ': ' + (data.error || raw.slice(0,120)) });
          const images = (data.hits || []).map(h => ({
            url: h.largeImageURL || h.webformatURL,
            thumb: h.webformatURL || h.previewURL,
            credit: h.user,
            creditUrl: 'https://pixabay.com/users/' + h.user + '-' + h.user_id + '/'
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
          let data; try { data = JSON.parse(raw); } catch(e) { return jsonResp({ source, error: 'Pexels: invalid JSON (' + resp.status + ')' }); }
          if (!resp.ok) return jsonResp({ source, error: 'Pexels error ' + resp.status + ': ' + (data.error || raw.slice(0,120)) });
          const images = (data.photos || []).map(p => ({
            url: (p.src && (p.src.large || p.src.original)) || (p.src && p.src.medium),
            thumb: (p.src && (p.src.medium || p.src.small)) || (p.src && p.src.tiny),
            credit: p.photographer,
            creditUrl: p.photographer_url
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
          let data; try { data = JSON.parse(raw); } catch(e) { return jsonResp({ source, error: 'Unsplash: invalid JSON (' + resp.status + ')' }); }
          if (!resp.ok) return jsonResp({ source, error: 'Unsplash error ' + resp.status + ': ' + ((data.errors && data.errors.join(', ')) || raw.slice(0,120)) });
          const images = (data.results || []).map(p => ({
            url: (p.urls && (p.urls.regular || p.urls.full)) || (p.urls && p.urls.small),
            thumb: (p.urls && (p.urls.small || p.urls.thumb)) || (p.urls && p.urls.regular),
            credit: p.user && p.user.name,
            creditUrl: p.user && p.user.links && p.user.links.html
          }));
          return jsonResp({ source, page, images, total: data.total });
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
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch(err) { return jsonResp({ error: err.message }, 500); }
  }
};
