// Tony's Recipes — Cloudflare Worker v22
// Added: YouTube Data API for video description extraction

const BRING_LIST_UUID = 'c00cd610-3865-4120-8e6d-769fcfc952ce';
const BRING_USER_UUID = '998f9b84-613e-45ed-8c5d-49c1e27b3658';
const BRING_API_V2    = 'https://api.getbring.com/rest/v2';

let BRING_TOKEN = 'eyJraWQiOiJwcm9kX2FjY2Vzc3Rva2VuXzIwMjAtMDUtMTEiLCJhbGciOiJIUzUxMiJ9.eyJleHAiOjE3ODAwNzY2MjgsInN1YiI6ImJybjpicmluZzp1c2VyOmIwZThlZWI1LTU2MjItNDdiOS1hMGJhLTZhZjRlOTUwNmJhZCIsInJvbGVzIjoiUk9MRV9VU0VSIiwiYnJuIjoiYnJuOmJyaW5nOnVzZXI6YjBlOGVlYjUtNTYyMi00N2I5LWEwYmEtNmFmNGU5NTA2YmFkIiwicHJpdmF0ZVV1aWQiOiJiMGU4ZWViNS01NjIyLTQ3YjktYTBiYS02YWY0ZTk1MDZiYWQiLCJlbWFpbCI6InJvemluYW50ZTIwMDRAZ21haWwuY29tIn0.iPYVn9GJzJNioBPBkz8H_Ppstz_aklkIV3ztqiiEBl81KEDmV2ClA9hSbA6XhX3H0MLOgRsp37WpOv8QCvZcrA';

const BRING_HEADERS = {
  'X-BRING-CLIENT':        'WebApp',
  'X-BRING-CLIENT-SOURCE': 'webApp',
  'X-BRING-COUNTRY':       'IL',
  'X-BRING-API-KEY':       'cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Ef',
  'Origin':                'https://web.getbring.com',
  'Referer':               'https://web.getbring.com/',
};

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

async function getToken(env) {
  if (env.BRING_KV) {
    try {
      const stored = await env.BRING_KV.get('accessToken');
      if (stored) return stored;
    } catch(e) {}
  }
  return BRING_TOKEN;
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }});
    }

    if (request.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);

    let body;
    try { body = JSON.parse(await request.text()); }
    catch(e) { return jsonResp({ error: 'Invalid JSON' }, 400); }

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
      const targetList = listUuid || BRING_LIST_UUID;
      try {
        const token = await getToken(env);
        const results = [];
        for (const item of items) {
          const form = new URLSearchParams();
          form.append('purchase', item.name);
          form.append('specification', item.spec || '');
          const r = await fetch(BRING_API_V2 + '/bringlists/' + targetList, {
            method: 'PUT',
            headers: { ...BRING_HEADERS, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
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
      try {
        const token = await getToken(env);
        const r = await fetch(BRING_API_V2 + '/bringlists/' + BRING_USER_UUID, {
          headers: { ...BRING_HEADERS, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        });
        const text = await r.text();
        let data = {};
        try { data = JSON.parse(text); } catch(e) {}
        return jsonResp({ status: r.status, ok: r.ok, lists: data.lists ? data.lists.map(l => ({ name: l.name, uuid: l.listUuid })) : [] });
      } catch(err) { return jsonResp({ error: err.message }, 500); }
    }

    // ── bring-settoken ────────────────────────────────────────────────────────
    if (body.action === 'bring-settoken') {
      const { token, secret } = body;
      if (secret !== 'tonys-recipes-2024') return jsonResp({ error: 'Unauthorized' }, 403);
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
    if (body.action === 'photo-search') {
      const query = body.query;
      if (!query) return jsonResp({ error: 'No query' }, 400);
      const pixabayKey = env.PIXABAY_API_KEY;
      if (!pixabayKey) return jsonResp({
        error: 'PIXABAY_API_KEY not set in Worker. Go to: https://dash.cloudflare.com/4dbc420100c13bf94fda83047ce0a7ac/workers/services/view/lively-bread-273a/production/settings → Bindings → Add variable PIXABAY_API_KEY'
      }, 500);
      try {
        const url = 'https://pixabay.com/api/?key=' + pixabayKey
          + '&q=' + encodeURIComponent(query)
          + '&image_type=photo&per_page=9&safesearch=true&order=popular';
        const resp = await fetch(url);
        const rawText = await resp.text();
        // Parse JSON
        let data;
        try { data = JSON.parse(rawText); }
        catch(e) { return jsonResp({ error: 'Pixabay returned invalid JSON. Status: ' + resp.status + '. Body: ' + rawText.slice(0,200) }, 500); }
        if (!resp.ok || data.error) {
          return jsonResp({ error: 'Pixabay API error ' + resp.status + ': ' + (data.error || rawText.slice(0,200)) }, 500);
        }
        if (!data.hits || !data.hits.length) {
          return jsonResp({ images: [], total: 0 });
        }
        const images = data.hits.map(hit => ({
          url: hit.largeImageURL || hit.webformatURL,
          thumb: hit.webformatURL || hit.previewURL,
          credit: hit.user,
          creditUrl: 'https://pixabay.com/users/' + hit.user + '-' + hit.user_id + '/'
        }));
        return jsonResp({ images, total: data.totalHits });
      } catch(err) {
        return jsonResp({ error: 'Photo search exception: ' + err.message + ' | stack: ' + (err.stack||'').slice(0,200) }, 500);
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
