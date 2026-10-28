// Worker tests. Run with:  node tests/worker-cors.mjs
//
// The Worker had NO tests until v36, and it shows: v34 changed jsonResp's default
// CORS header from '*' to 'null' and threaded the real headers through only 8 of
// 51 call sites. The other 43 returned `Access-Control-Allow-Origin: null`, the
// browser rejected every one of those responses, and the app could only report
// "could not be reached from this device" — photo search, AI import, URL fetch,
// translate and nutrition all dead. Tony found it; the self-test suite could not,
// because it only ever tested index.html.
//
// The Worker is a plain ES module with no Cloudflare-specific imports, so it can
// be imported and driven with ordinary Request objects. No wrangler, no network.
//
// The invariant being defended: EVERY response, from every path, including
// errors, refusals and the binary download, must carry CORS for an allowed
// origin — and must never echo one that is not allowed.
import worker from '../cloudflare-worker.js';
import { createRequire } from 'module';

// The Worker samples its KV counters with Math.random, so the write-count
// checks below were a dice roll (one failed at 47 writes, v36.92). A fixed
// sequence (mulberry32, seed 36) still exercises the sampling but gives the
// same count on every run.
{
  let s = 36;
  Math.random = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ORIGIN = 'https://rozinante2004-hash.github.io';
let failures = [];

// v78 — the per-minute ceilings are counted in the Worker's memory, which lives
// as long as this test file does. Each request comes from its own address unless
// a test names one, so one section's burst does not spend the next one's minute.
let _ipN = 0;
function post(body, origin = ORIGIN, extraHeaders = {}) {
  _ipN++;
  return new Request('https://worker.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': origin,
               'CF-Connecting-IP': '198.51.' + ((_ipN >> 8) & 255) + '.' + (_ipN & 255), ...extraHeaders },
    body: JSON.stringify(body),
  });
}
function check(name, resp, expected = ORIGIN) {
  const acao = resp.headers.get('Access-Control-Allow-Origin');
  if (acao === expected) console.log(`  ok   ${name} (${resp.status})`);
  else { failures.push(`${name}: expected Allow-Origin ${expected}, got ${acao} (status ${resp.status})`);
         console.log(`  FAIL ${name} (${resp.status}) Allow-Origin=${acao}`); }
}
function expect(name, cond, detail) {
  if (cond) console.log(`  ok   ${name}`);
  else { failures.push(`${name}: ${detail}`); console.log(`  FAIL ${name} — ${detail}`); }
}

// Deliberately EMPTY env: nothing configured. That is the case v34 broke, because
// the "not configured" early returns were the call sites left without CORS.
const env = {};

console.log('CORS on every path (no keys configured):');
for (const action of ['health', 'photo-search', 'fetch-url', 'instagram-fetch', 'bring-status', 'not-a-real-action']) {
  check(action, await worker.fetch(post({ action, query: 'x', url: 'https://e.com', shortcode: 'a' }), env));
}
check('AI path (no action field)', await worker.fetch(post({ model: 'x', messages: [] }), env));
check('malformed JSON body', await worker.fetch(new Request('https://worker.test', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: '{oops' }), env));
check('OPTIONS preflight', await worker.fetch(new Request('https://worker.test', {
  method: 'OPTIONS', headers: { Origin: ORIGIN } }), env));
check('GET', await worker.fetch(new Request('https://worker.test', { method: 'GET', headers: { Origin: ORIGIN } }), env));

console.log('\nOrigin handling:');
const foreign = await worker.fetch(post({ action: 'health' }, 'https://evil.example'), env);
check('a foreign origin is not echoed', foreign, 'null');
const preflightForeign = await worker.fetch(new Request('https://worker.test', {
  method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
expect('foreign preflight is refused', preflightForeign.status === 403, `got ${preflightForeign.status}`);

// v70 — the beta's own address (Tony's domain) is the app's, like its old one.
for (const o of ['https://mykitchennotes.community', 'https://my-kitchen-notes-beta.pages.dev']) {
  check('v70: the beta at ' + o, await worker.fetch(post({ action: 'health' }, o), env), o);
  const pf = await worker.fetch(new Request('https://worker.test', { method: 'OPTIONS', headers: { Origin: o } }), env);
  expect('v70: …its preflight is granted (' + o + ')', pf.status === 200 && pf.headers.get('Access-Control-Allow-Origin') === o, 'status ' + pf.status);
}
check('v70: www. is not the app (it forwards in the browser)', await worker.fetch(post({ action: 'health' }, 'https://www.mykitchennotes.community'), env), 'null');

console.log('\nApp key (configured):');
const keyed = { APP_SHARED_KEY: 'secret-k' };
const good = await worker.fetch(post({ action: 'health', appKey: 'secret-k' }), keyed);
expect('key in the BODY is accepted', (await good.json()).appKeyAccepted === true, 'health reported it rejected');
const viaHeader = await worker.fetch(post({ action: 'health' }, ORIGIN, { 'X-App-Key': 'secret-k' }), keyed);
expect('key in the header still works', (await viaHeader.json()).appKeyAccepted === true, 'header form was dropped');
const wrong = await worker.fetch(post({ action: 'photo-search', query: 'x', appKey: 'nope' }), keyed);
expect('a wrong key is refused', wrong.status === 403, `got ${wrong.status}`);
check('a 403 refusal still carries CORS', wrong);
const openHealth = await worker.fetch(post({ action: 'health' }), keyed);
expect('health stays open without a key', openHealth.status === 200, `got ${openHealth.status}`);

console.log('\nThe Bring! bookmarklet\'s origin:');
// The bookmarklet runs ON web.getbring.com. v34 added the origin allowlist
// without it, so the browser blocked the reply and the only symptom the user
// could see was "Failed to fetch" — indistinguishable from the Worker being down.
const bringOrigin = 'https://web.getbring.com';
check('web.getbring.com is allowed', await worker.fetch(
  post({ action: 'bring-status' }, bringOrigin), env), bringOrigin);
const bringPreflight = await worker.fetch(new Request('https://worker.test', {
  method: 'OPTIONS', headers: { Origin: bringOrigin } }), env);
expect('its preflight is accepted', bringPreflight.status === 200, `got ${bringPreflight.status}`);

console.log('\nAI path — what actually reaches Anthropic:');
// v35 moved the app key into the request BODY to avoid a CORS preflight. That
// was right. What went unchecked: this path forwards the body VERBATIM, so the
// key went to Anthropic too, which rejects unknown top-level fields —
// 400 invalid_request_error: appKey: Extra inputs are not permitted. Every AI
// feature was dead. Testing CORS alone could never have seen it; the assertion
// has to be about the body we send onward.
{
  const realFetch = globalThis.fetch;
  let sentUrl = null, sentBody = null;
  globalThis.fetch = async (url, init) => {
    sentUrl = String(url);
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const aiResp = await worker.fetch(post({
      model: 'claude-sonnet-4-5', max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
      appKey: 'secret-k',
    }), { ANTHROPIC_API_KEY: 'sk-test' });

    expect('it reaches the Messages API', sentUrl === 'https://api.anthropic.com/v1/messages', `got ${sentUrl}`);
    expect('appKey is STRIPPED before forwarding', sentBody && sentBody.appKey === undefined,
      'appKey was forwarded — Anthropic answers 400 "Extra inputs are not permitted" and every AI feature dies');
    expect('the real payload survives', sentBody && sentBody.model === 'claude-sonnet-4-5'
      && Array.isArray(sentBody.messages) && sentBody.messages[0].content === 'hi',
      'stripping removed more than it should: ' + JSON.stringify(sentBody));
    check('the AI response still carries CORS', aiResp);
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nBring! recipe import page (v42):');
{
  // Bring!'s official, token-free import: the app stores the ingredient lines,
  // Bring!'s servers fetch the page, the Bring! app opens with them ready.
  const store = new Map();
  const kv = { get: async k => store.has(k) ? store.get(k).v : null,
               put: async (k, v, o) => { store.set(k, { v, o }); } };
  const envB = { APP_SHARED_KEY: 'secret-k', BRING_KV: kv };
  const refused = await worker.fetch(post({ action: 'bring-recipe-page', name: 'x', ingredients: ['a'] }), envB);
  expect('without the app key it is refused', refused.status === 403, `got ${refused.status}`);
  const made = await worker.fetch(post({ action: 'bring-recipe-page', appKey: 'secret-k', name: 'Soup <b>',
    ingredients: ['2 onions', '<script>alert(1)</script> salt', '', '  1 l   water '], servings: 4 }), envB);
  const j = await made.json();
  expect('it answers with a page and Bring!\'s import link', made.status === 200 && /\/bring-recipe\/[a-f0-9]{32}$/.test(j.url || '')
    && j.deeplink === 'https://api.getbring.com/rest/bringrecipes/deeplink?url=' + encodeURIComponent(j.url) + '&source=web', JSON.stringify(j));
  // The rate limiter shares this KV and sometimes writes its own counter first
  // (it samples), so pick the page by its key.
  const stored = [...store.entries()].filter(([k]) => k.startsWith('bringrecipe:')).map(([, x]) => x)[0];
  expect('it expires (15 minutes)', stored && stored.o && stored.o.expirationTtl === 900, JSON.stringify(stored && stored.o));
  const page = await worker.fetch(new Request(j.url, { method: 'GET' }), envB);
  const html = await page.text();
  expect('the page is served to anyone with the code (Bring!\'s servers have no key)', page.status === 200, `got ${page.status}`);
  expect('…as a schema.org Recipe, one line per ingredient', (html.match(/itemprop="recipeIngredient"/g) || []).length === 3
    && html.includes('itemtype="https://schema.org/Recipe"') && html.includes('"@type":"Recipe"'), html.slice(0, 300));
  expect('…with every value escaped', !html.includes('<script>alert') && html.includes('&lt;script&gt;') && html.includes('Soup &lt;b&gt;'), html);
  expect('…tidied (blank lines dropped, spaces collapsed)', html.includes('>1 l water<'), html);
  expect('…and not indexed', page.headers.get('X-Robots-Tag') === 'noindex, nofollow', page.headers.get('X-Robots-Tag'));
  const missing = await worker.fetch(new Request('https://worker.test/bring-recipe/' + '0'.repeat(32), { method: 'GET' }), envB);
  expect('an unknown or expired code gets nothing', missing.status === 404, `got ${missing.status}`);
  const odd = await worker.fetch(new Request('https://worker.test/bring-recipe/../../x', { method: 'GET' }), envB);
  expect('anything else is still just the liveness check', (await odd.text()) === 'OK', 'another path answered');
  const empty = await worker.fetch(post({ action: 'bring-recipe-page', appKey: 'secret-k', name: 'x', ingredients: [] }), envB);
  expect('an empty list is refused', empty.status === 400, `got ${empty.status}`);
  const big = await worker.fetch(post({ action: 'bring-recipe-page', appKey: 'secret-k', name: 'x'.repeat(999),
    ingredients: Array.from({ length: 500 }, (_, i) => 'item ' + i + ' ' + 'y'.repeat(999)) }), envB);
  const bj = JSON.parse([...store.values()].pop().v);
  expect('…and a huge one is capped (200 lines, 300 characters, name 200)', big.status === 200 && bj.ingredients.length === 200
    && bj.ingredients[0].length === 300 && bj.name.length === 200, `${bj.ingredients.length} lines`);
}

console.log('\nfetch-url text extraction (v36.0):');
{
  // This is what every import path is built on. Before v36.0 every tag became a
  // SPACE, so a <li> ingredient list arrived as one run-on line and the page's
  // own structure — the strongest signal for where one ingredient ends — was
  // thrown away before the AI ever saw it.
  const page = '<html><body><nav>menu</nav>'
    + '<h2>Gnocchi</h2><p>Ingredients:</p>'
    + '<ul><li>1 kg potatoes</li><li>coarse salt</li><li>500 g flour</li></ul>'
    + '<p>Mix <b>gently</b> and rest</p>'
    + '<footer>bye</footer></body></html>';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(page, { status: 200, headers: { 'Content-Type': 'text/html' } });
  try {
    const resp = await worker.fetch(post({ action: 'fetch-url', url: 'https://example.com/r', appKey: 'secret-k' }), env);
    const data = await resp.json();
    const lines = String(data.text || '').split('\n').map(l => l.trim()).filter(Boolean);

    expect('each list item is its own line',
      lines.includes('1 kg potatoes') && lines.includes('coarse salt') && lines.includes('500 g flour'),
      'the ingredients ran together: ' + JSON.stringify(lines));
    expect('an inline tag does NOT split its own sentence',
      lines.includes('Mix gently and rest'),
      'a <b> inside a sentence broke it apart: ' + JSON.stringify(lines));
    expect('nav and footer are still stripped',
      !String(data.text).includes('menu') && !String(data.text).includes('bye'),
      'chrome leaked into the text');
    expect('a short page is not reported as truncated', data.truncated === false,
      `truncated was ${data.truncated}`);
  } finally { globalThis.fetch = realFetch; }

  // A long round-up must SAY it was cut short. Returning 6 of 10 recipes and
  // calling it a success is the failure mode this flag exists to prevent.
  const long = '<p>' + 'x'.repeat(70000) + '</p>';
  const realFetch2 = globalThis.fetch;
  globalThis.fetch = async () => new Response(long, { status: 200, headers: { 'Content-Type': 'text/html' } });
  try {
    const resp = await worker.fetch(post({ action: 'fetch-url', url: 'https://example.com/long', appKey: 'secret-k' }), env);
    const data = await resp.json();
    expect('a page past the cap reports truncated', data.truncated === true,
      'a cut-short page looked complete, so an import silently returns fewer recipes than the page has');
    expect('the cap is big enough for a ten-recipe article', String(data.text).length >= 60000,
      `only ${String(data.text).length} characters came back`);
  } finally { globalThis.fetch = realFetch2; }
}

console.log('\nfetch-url link collection (v38):');
{
  // A round-up that only LINKS to its recipes. Every <a> becomes its label and
  // the href is thrown away by the text pipeline, so without this the app saw
  // ten recipe names and had no way to reach a single one of them.
  //
  // This list is what the app goes on to FETCH, so its limits are the point:
  // same host only, no other schemes, no duplicates, no self-link.
  const page = '<html><body>'
    + '<nav><a href="/news">News</a><a href="/sport">Sport</a></nav>'
    + '<header><a href="/login">Login</a></header>'
    + '<h1>10 great soups</h1>'
    + '<a href="/food/article/aaa">Sweet potato soup</a>'
    + '<a href="/food/article/aaa">10 minutes</a>'          // same recipe again
    + '<a href="https://www.example.com/food/article/bbb">Tomato soup</a>'
    + '<a href="https://evil.example.org/steal">Elsewhere</a>'
    + '<a href="javascript:alert(1)">Nasty</a>'
    + '<a href="mailto:a@b.c">Mail us</a>'
    // Same host, different scheme. javascript: and mailto: have no hostname so
    // the host check alone stops them — this one does NOT, so it is the only
    // case where the scheme check is what is doing the work.
    + '<a href="ftp://www.example.com/food/article/ddd">Download</a>'
    + '<a href="/food/article/ccc#top">Onion soup</a>'
    + '<a href="/food/article/roundup">This very page</a>'
    + '<footer><a href="/terms">Terms</a></footer>'
    + '</body></html>';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(page, { status: 200, headers: { 'Content-Type': 'text/html' } });
  try {
    const resp = await worker.fetch(post({ action: 'fetch-url',
      url: 'https://www.example.com/food/article/roundup', appKey: 'secret-k' }), env);
    const data = await resp.json();
    const hrefs = (data.links || []).map(l => l.href);

    expect('the recipe links come back at all', hrefs.length >= 3,
      'got ' + JSON.stringify(hrefs));
    expect('a relative href is made absolute',
      hrefs.includes('https://www.example.com/food/article/aaa'),
      'relative links were dropped or left relative: ' + JSON.stringify(hrefs));
    expect('the same recipe is not listed twice',
      hrefs.filter(h => h.endsWith('/aaa')).length === 1,
      'the app would open the same page twice: ' + JSON.stringify(hrefs));
    expect('a fragment is not a different page',
      hrefs.includes('https://www.example.com/food/article/ccc'),
      '#top was kept, so the same page can be fetched twice: ' + JSON.stringify(hrefs));
    expect('an off-site link is never offered',
      !hrefs.some(h => h.includes('evil.example.org')),
      'the Worker would fetch another site on request: ' + JSON.stringify(hrefs));
    expect('only http(s) is ever offered',
      hrefs.every(h => /^https?:\/\//i.test(h)),
      'a non-http scheme survived — ftp:, javascript: or mailto:: ' + JSON.stringify(hrefs));
    expect('the page does not link to itself',
      !hrefs.includes('https://www.example.com/food/article/roundup'),
      'the import could fetch the round-up again forever: ' + JSON.stringify(hrefs));
    expect('nav, header and footer links are left out',
      !hrefs.some(h => /\/news|\/sport|\/login|\/terms/.test(h)),
      'site furniture became candidate recipes: ' + JSON.stringify(hrefs));
    expect('each link keeps its own words', (data.links || []).some(l => l.text === 'Sweet potato soup'),
      'the labels are how the AI tells a recipe from a tag: ' + JSON.stringify(data.links));
    // The change must not have disturbed what every other import depends on.
    expect('the page text still comes back', String(data.text || '').includes('10 great soups'),
      'collecting links broke the text extraction: ' + JSON.stringify(String(data.text || '').slice(0, 120)));
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nSpend guard rails (v39):');
{
  // A fake KV that counts what it is asked to do. The whole point of v39 is how
  // MANY writes happen and what the limiter does when they stop working, so the
  // assertions are about the write count and the refusals — not about CORS.
  function fakeKv(opts = {}) {
    const store = new Map();
    return {
      reads: 0, writes: 0, store,
      async get(k) { this.reads++; if (opts.getThrows) throw new Error('KV down'); return store.get(k) ?? null; },
      async put(k, v) { this.writes++; if (opts.putThrows) throw new Error('KV write limit'); store.set(k, v); },
    };
  }
  const aiBody = () => ({ model: 'claude-haiku-4-5', max_tokens: 10, messages: [], appKey: 'secret-k' });   // v66: a model the app uses
  const photoBody = () => ({ action: 'photo-search', query: 'soup', appKey: 'secret-k' });
  // Nothing here should ever reach the real Anthropic API. Without this a
  // mutation that lets a call THROUGH makes a live network request and comes
  // back 401 — which happens to fail the assertion, but for the wrong reason
  // and only on a machine with egress.
  async function noNetwork(fn) {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('{"stub":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    try { return await fn(); } finally { globalThis.fetch = realFetch; }
  }

  // (a) The cheap, high-volume path writes NOTHING (v78). v39 sampled it (one
  // write in five), and that was still the whole allowance: four idle windows
  // asking every two minutes were 1,107 KV writes a day (18–19 Oct 2026). The
  // per-minute ceiling is counted in memory — and still fires.
  {
    const kv = fakeKv();
    const env2 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k' };
    const one = { 'CF-Connecting-IP': '203.0.113.7' };
    let refused = 0, first = -1;
    for (let i = 0; i < 200; i++) {
      const r = await worker.fetch(post(photoBody(), ORIGIN, one), env2);
      if (r.status === 429) { refused++; if (first < 0) first = i; }
    }
    expect('200 photo searches write nothing to KV', kv.writes === 0,
      `${kv.writes} KV writes — ordinary requests are spending the 1,000-a-day allowance again`);
    expect('…and the per-minute ceiling still holds (150 a minute)', first === 150 && refused === 50,
      `first refusal at request ${first}, ${refused} refused — the limiter is decorative`);
    const other = await worker.fetch(post(photoBody(), ORIGIN, { 'CF-Connecting-IP': '203.0.113.8' }), env2);
    expect('…for that caller only', other.status !== 429, `got ${other.status} for someone else`);
  }

  // (b) The AI path is counted EXACTLY — it is rare, and it is the one that
  // spends money, so accuracy is worth the write.
  {
    const kv = fakeKv();
    const env2 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test' };
    await noNetwork(async () => { for (let i = 0; i < 5; i++) await worker.fetch(post(aiBody()), env2); });
    expect('no per-minute counter is written (v78: memory)', ![...kv.store.keys()].some(k => /:(ai|x)$/.test(k)),
      [...kv.store.keys()].join(', '));
    const dayKey = [...kv.store.keys()].find(k => k.startsWith('rl:day:'));
    expect('the daily ceiling counts them too', kv.store.get(dayKey) === '5',
      `the daily counter reads ${kv.store.get(dayKey)} after 5 calls`);
  }

  // (c) The daily ceiling actually stops the spending, and says whose it is.
  {
    const kv = fakeKv();
    const day = 'rl:day:' + new Date().toISOString().slice(0, 10);
    kv.store.set(day, '7');
    const resp = await noNetwork(() => worker.fetch(post(aiBody()),
      { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test', AI_DAILY_MAX: '7' }));
    const data = await resp.json();
    expect('the daily ceiling refuses', resp.status === 429, `got ${resp.status}`);
    expect('and names itself, not Anthropic', /this Worker's own daily ceiling/.test(data.error || ''),
      `the message sends the reader to the wrong place: ${data.error}`);
    check('a ceiling refusal still carries CORS', resp);
    // …and a photo search is untouched by an AI ceiling.
    const ok = await worker.fetch(post(photoBody()),
      { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', AI_DAILY_MAX: '7' });
    expect('a spent AI ceiling does not break photo search', ok.status !== 429, `got ${ok.status}`);
    // instagram-fetch is the case the `costly` / `aiSpend` split exists for: it
    // is slow and rate-limited like the AI path, but it spends no Anthropic
    // credits, so it must not eat the AI ceiling or be stopped by it.
    const ig = await noNetwork(() => worker.fetch(post({ action: 'instagram-fetch', shortcode: 'abc', appKey: 'secret-k' }),
      { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', AI_DAILY_MAX: '7' }));
    expect('…nor Instagram, which spends no Anthropic credits', ig.status !== 429, `got ${ig.status}`);
    const dayAfter = kv.store.get(day);
    expect('…and Instagram does not count against the AI ceiling', dayAfter === '7',
      `the daily AI counter moved to ${dayAfter} because of a non-AI request`);
  }

  // (d) The monthly ceiling is separate from the daily one.
  {
    const kv = fakeKv();
    kv.store.set('rl:mon:' + new Date().toISOString().slice(0, 7), '10000');
    const resp = await noNetwork(() => worker.fetch(post(aiBody()),
      { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test' }));
    expect('the monthly ceiling refuses on its own', resp.status === 429, `got ${resp.status}`);
    expect('and says which ceiling it was', (await resp.json()).spendCap === 'monthly', 'it blamed the wrong one');
  }

  // (e) Fail CLOSED on the money path when KV is bound but not answering — and
  // fail OPEN on the cheap ones, because those spend nothing.
  {
    const env2 = { BRING_KV: fakeKv({ getThrows: true }), APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test' };
    const ai = await noNetwork(() => worker.fetch(post(aiBody()), env2));
    expect('a dead KV pauses AI rather than running it unmetered', ai.status === 429, `got ${ai.status}`);
    const photo = await worker.fetch(post(photoBody()), { BRING_KV: fakeKv({ getThrows: true }), APP_SHARED_KEY: 'secret-k' });
    expect('a dead KV does NOT break photo search', photo.status !== 429, `got ${photo.status}`);
  }

  // (f) An unbound KV still allows everything. This is a deployment fact, not an
  // attack, and breaking every AI feature over it is the wrong trade.
  {
    const ai = await noNetwork(() => worker.fetch(post(aiBody()),
      { APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test' }));
    expect('no KV bound still allows AI', ai.status === 200, `got ${ai.status}`);
    const h = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k' }), { APP_SHARED_KEY: 'secret-k' })).json();
    expect('…and health says the limiter is off', h.rateLimiting === false, 'health hid it');
  }

  // (f2) The circuit breaker. A KV whose WRITES fail is the exact shape of
  // "the daily write allowance is used up": v38 caught that, threw it away, and
  // kept answering "not limited" for the rest of the day. Now the first failed
  // write closes the money path until a write succeeds again.
  //
  // This mutates module state shared by everything after it, so it also drives
  // the recovery — which is worth asserting anyway: a breaker that never reopens
  // is its own outage.
  {
    const kv = fakeKv({ putThrows: true });
    const env2 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test' };
    const first = await noNetwork(() => worker.fetch(post(aiBody()), env2));
    expect('the first AI call still goes through', first.status === 200, `got ${first.status}`);
    const second = await noNetwork(() => worker.fetch(post(aiBody()), env2));
    expect('a failed KV write closes the AI path behind it', second.status === 429,
      `got ${second.status} — writes are failing and AI calls keep running unmetered, which is exactly v38's bug`);
    const sj = await second.json();
    expect('and says so in words a person can act on', /KV write allowance/.test(sj.error || '') && sj.paused === true,
      'the message does not say what is actually wrong');
    expect('…naming the allowance and when it comes back (v78)', sj.notice && sj.notice.what === 'kv'
      && sj.notice.until === Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)
      && /AI features/.test(sj.notice.affects || ''), JSON.stringify(sj.notice));

    // Recovery (v78): nothing but an AI call writes a counter now, so the breaker
    // lets one call try again after five minutes, and a write that works reopens it.
    const healthy = fakeKv();
    const env3 = { BRING_KV: healthy, APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test' };
    const stillShut = await noNetwork(() => worker.fetch(post(aiBody()), env3));
    expect('within five minutes it stays shut', stillShut.status === 429, `got ${stillShut.status}`);
    const realNow = Date.now;
    Date.now = () => realNow() + 5 * 60e3 + 1000;
    let after, again;
    try {
      after = await noNetwork(() => worker.fetch(post(aiBody()), env3));
      again = await noNetwork(() => worker.fetch(post(aiBody()), env3));
    } finally { Date.now = realNow; }
    expect('five minutes on, a call tries again and a working KV reopens it', after.status === 200 && again.status === 200,
      `got ${after.status}, ${again.status} — the breaker never resets, so one write failure disables AI until the isolate dies`);
  }

  // (g) health reports the ceilings to a keyed caller, and to nobody else.
  {
    const kv = fakeKv();
    kv.store.set('rl:day:' + new Date().toISOString().slice(0, 10), '12');
    const e2 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k' };
    const keyedH = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k' }), e2)).json();
    expect('health reports the daily count to the app', keyedH.spend && keyedH.spend.dailyUsed === 12,
      'the app cannot see how close the bill is to its ceiling: ' + JSON.stringify(keyedH.spend));
    expect('and the ceiling itself (v81: 1,000)', keyedH.spend && keyedH.spend.dailyMax === 1000,
      JSON.stringify(keyedH.spend));
    const anonH = await (await worker.fetch(post({ action: 'health' }), e2)).json();
    expect('an anonymous health ping is told nothing about the bill', anonH.spend === undefined,
      'the counts leak to any caller: ' + JSON.stringify(anonH.spend));
  }
}

console.log('\nEvery response says what it actually is (v40):');
{
  // corsFor() carried 'Content-Type: application/json', and the fetch wrapper
  // stamps corsFor()'s result on EVERY response — so the binary paths were
  // labelled as JSON. The KV file download has been served that way since v36,
  // and it would have handed photo-fetch's caller an "image" the browser
  // refuses to decode.
  const json = await worker.fetch(post({ action: 'health' }), env);
  expect('a JSON answer is still application/json',
    (json.headers.get('Content-Type') || '').includes('application/json'),
    `got ${json.headers.get('Content-Type')}`);
}

console.log('\nphoto-fetch (v40):');
{
  // A fetch-anything primitive with Tony's name on the bandwidth bill, so the
  // assertions are about what it REFUSES as much as what it returns.
  const realFetch = globalThis.fetch;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
  const env2 = { APP_SHARED_KEY: 'secret-k' };
  const ask = (url) => worker.fetch(post({ action: 'photo-fetch', url, appKey: 'secret-k' }), env2);
  let asked = null;
  const serve = (body, headers, status = 200) => {
    globalThis.fetch = async (u) => { asked = String(u); return new Response(body, { status, headers }); };
  };
  try {
    serve(png, { 'Content-Type': 'image/png', 'Content-Length': String(png.length) });
    const ok = await ask('https://live.staticflickr.com/1/2_3_b.jpg');
    expect('an image comes back as an image', ok.status === 200
      && (ok.headers.get('Content-Type') || '').startsWith('image/'),
      `status ${ok.status}, type ${ok.headers.get('Content-Type')}`);
    expect('the bytes are passed through unchanged',
      new Uint8Array(await ok.arrayBuffer()).length === png.length, 'the body was altered');
    check('it carries CORS like everything else', ok);
    expect('it fetched the URL it was given', asked === 'https://live.staticflickr.com/1/2_3_b.jpg', `got ${asked}`);

    // Not an image. Handing the app an HTML error page to compress into a
    // recipe photo is the failure this check exists for.
    serve('<html>not found</html>', { 'Content-Type': 'text/html' });
    const html = await ask('https://example.com/oops');
    expect('an HTML page is refused, not relayed', html.status === 415, `got ${html.status}`);
    expect('and says what came back instead', /not an image/.test((await html.json()).error || ''), 'unclear message');
    // v66 — nor SVG: an "image" that can carry a script.
    serve('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', { 'Content-Type': 'image/svg+xml' });
    const svg = await ask('https://example.com/pic.svg');
    expect('v66: an SVG is refused (it can carry a script)', svg.status === 415, `got ${svg.status}`);

    // Size. A Worker that will stream an arbitrary file of any size on request
    // is a bandwidth amplifier.
    serve(png, { 'Content-Type': 'image/png', 'Content-Length': String(99 * 1024 * 1024) });
    expect('an oversized image is refused on its declared length', (await ask('https://e.com/huge.png')).status === 413,
      'the declared content-length was ignored');
    // …and content-length is a claim, not a promise.
    serve(new Uint8Array(13 * 1024 * 1024), { 'Content-Type': 'image/png' });
    expect('…and on its actual length when it lies', (await ask('https://e.com/liar.png')).status === 413,
      'a body bigger than the cap was relayed anyway');

    // Only http(s). Without this the Worker would follow file: and data: URLs.
    globalThis.fetch = async () => { throw new Error('photo-fetch must not fetch a non-http scheme'); };
    for (const bad of ['file:///etc/passwd', 'data:image/png;base64,AAAA', 'ftp://e.com/a.png']) {
      const r = await ask(bad);
      expect(`${bad.split(':')[0]}: is refused`, r.status === 400, `got ${r.status}`);
    }
    expect('a missing URL is refused', (await ask('')).status === 400, 'it accepted an empty url');

    // The same gate as everything else: no app key, no fetch.
    globalThis.fetch = async () => { throw new Error('photo-fetch ran without an app key'); };
    const nokey = await worker.fetch(post({ action: 'photo-fetch', url: 'https://e.com/a.png' }), env2);
    expect('no app key, no fetch', nokey.status === 403, `got ${nokey.status}`);

    // Its own ceiling: 600/min, because one auto-fetch is 300 in a burst.
    {
      const kv = { store: new Map(), writes: 0,
        async get(k) { return this.store.get(k) ?? null; },
        async put(k, v) { this.writes++; this.store.set(k, v); } };
      serve(png, { 'Content-Type': 'image/png' });
      const e3 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k' };
      let refused = 0;
      for (let i = 0; i < 300; i++) {
        const r = await worker.fetch(post({ action: 'photo-fetch', url: 'https://e.com/a.png', appKey: 'secret-k' }, ORIGIN,
          { 'CF-Connecting-IP': '203.0.113.20' }), e3);   // one caller: the burst is one app's
        if (r.status === 429) refused++;
      }
      expect('300 photo downloads in a burst are all allowed', refused === 0,
        `${refused} were refused — "auto-fetch missing photos" over a big library would half-fail`);
      expect('…and cost no KV writes (v78)', kv.writes === 0, `${kv.writes} writes`);
    }
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nNo file hosting (v41):');
{
  // download-store stored any data under any filename and served it back from
  // this Worker's address — an open file host for anyone with the public app
  // key. It must be gone in BOTH halves: nothing stored, nothing served.
  const kv = { puts: [], async get() { return null; }, async put(k, v) { this.puts.push(k); }, async delete() {} };
  const e = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k' };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"stub":true}', { status: 200 });
  let stored;
  try {
    stored = await worker.fetch(post({ action: 'download-store', data: btoa('MZ evil'), filename: 'invoice.exe',
      mime: 'application/x-msdownload', appKey: 'secret-k' }), e);
  } finally { globalThis.fetch = realFetch; }
  expect('download-store writes nothing to KV', !kv.puts.some(k => /^dl_/.test(k)), 'stored ' + kv.puts.join(','));
  const body = await stored.text();
  expect('download-store stores nothing and returns no link', !/"url"/.test(body) && !/dl_/.test(body),
    'got ' + stored.status + ' ' + body.slice(0, 120));
  const served = await worker.fetch(new Request('https://worker.test/invoice.exe?dl=dl_1_abc', { method: 'GET', headers: { Origin: ORIGIN } }), e);
  const txt = await served.text();
  expect('a ?dl= GET serves no file', served.status === 200 && txt === 'OK' && !/attachment/.test(served.headers.get('Content-Disposition') || ''),
    'got ' + served.status + ' ' + (served.headers.get('Content-Disposition') || '') + ' ' + txt.slice(0, 60));
}

console.log('\nvideo-recipe (v43):');
{
  const e = { APP_SHARED_KEY: 'secret-k' };
  const off = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtube.com/shorts/WMTuLDQJHJw?si=x', appKey: 'secret-k' }), e);
  const offBody = await off.json();
  expect('without GEMINI_API_KEY it says it is not set up', off.status === 503 && offBody.needsConfig === true, `got ${off.status} ${JSON.stringify(offBody)}`);
  check('…with CORS', off);
  const ek = { APP_SHARED_KEY: 'secret-k', GEMINI_API_KEY: 'g-key' };
  const notYt = await worker.fetch(post({ action: 'video-recipe', url: 'https://example.com/v', appKey: 'secret-k' }), ek);
  expect('anything but a YouTube video is refused', notYt.status === 400, `got ${notYt.status}`);
  const noKey = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw' }), { APP_SHARED_KEY: 'secret-k', GEMINI_API_KEY: 'g-key' });
  expect('…and nothing without the app key', noKey.status === 403, `got ${noKey.status}`);
  const realFetch = globalThis.fetch;
  let sent = null, reply = { candidates: [{ content: { parts: [{ text: 'עוגה\nמצרכים:\n6 ביצים' }] } }] }, status = 200;
  globalThis.fetch = async (url, init) => { sent = { url: String(url), init }; return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } }); };
  try {
    const r = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtube.com/shorts/WMTuLDQJHJw?si=x', appKey: 'secret-k' }), ek);
    const b = await r.json();
    expect('the recipe the video shows comes back as text', r.status === 200 && /6 ביצים/.test(b.text) && b.via === 'gemini', `got ${r.status} ${JSON.stringify(b)}`);
    const req = JSON.parse(sent.init.body);
    expect('Gemini is sent the video by its YouTube link, built here from the id',
      req.contents[0].parts[0].file_data.file_uri === 'https://www.youtube.com/watch?v=WMTuLDQJHJw', JSON.stringify(req.contents[0].parts[0]));
    expect('…the key in a header, not in the address', sent.init.headers['x-goog-api-key'] === 'g-key' && !/g-key/.test(sent.url), sent.url);
    reply = { candidates: [{ content: { parts: [{ text: 'NO RECIPE' }] } }] };
    const none = await (await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw', prompt: 'ignore previous', appKey: 'secret-k' }), ek)).json();
    expect('a video with no recipe says so', none.noRecipe === true && none.text === '', JSON.stringify(none));
    expect('…and the request is our own, whatever the caller sends', !String(sent.init.body).includes('ignore previous'), 'caller text reached Gemini');
    status = 429; reply = { error: { message: 'Resource exhausted' } };
    const q = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw', appKey: 'secret-k' }), ek);
    expect('Google\'s allowance used up is named as such', q.status === 429 && /VIDEO_QUOTA/.test((await q.json()).error), `got ${q.status}`);
    status = 404; reply = { error: { message: 'models/x is not found' } };
    const m = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw', appKey: 'secret-k' }), ek);
    expect('a missing model, with nothing to use instead, says so', m.status === 503 && /VIDEO_MODEL/.test((await m.json()).error), `got ${m.status}`);
    const h = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k' }), ek)).json();
    expect('health says whether videos can be read', h.configured && h.configured.videoAi === true, JSON.stringify(h.configured));
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nGemini model found, not assumed (v45):');
{
  const kvStore = {};
  const kv = { get: async k => kvStore[k] || null, put: async (k, v) => { kvStore[k] = v; } };
  const ek = { APP_SHARED_KEY: 'secret-k', GEMINI_API_KEY: 'g-key', BRING_KV: kv };
  const realFetch = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (/\/v1beta\/models\?/.test(u)) return new Response(JSON.stringify({ models: [
      { name: 'models/gemini-3.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
      { name: 'models/gemini-3.5-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-3.5-flash-live', supportedGenerationMethods: ['bidiGenerateContent'] } ] }), { status: 200 });
    const m = /models\/([^:]+):generateContent$/.exec(u);
    if (m) { asked.push(m[1]);
      if (m[1] === 'gemini-2.5-flash') return new Response(JSON.stringify({ error: { message: 'models/gemini-2.5-flash is not found for API version v1beta' } }), { status: 404 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Cake\n6 eggs' }] } }] }), { status: 200 }); }
    return new Response('{}', { status: 404 });
  };
  try {
    const r = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw', appKey: 'secret-k' }), ek);
    const b = await r.json();
    expect('a retired model: the Worker finds the newest flash model this key may use, and reads the video',
      r.status === 200 && b.model === 'gemini-3.5-flash' && asked.join() === 'gemini-2.5-flash,gemini-3.5-flash', `got ${r.status} ${JSON.stringify(b)} asked ${asked}`);
    expect('…and remembers it', kvStore['gemini:model'] === 'gemini-3.5-flash', JSON.stringify(kvStore));
    asked.length = 0;
    await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw', appKey: 'secret-k' }), ek);
    expect('…so the next video goes straight to it', asked.join() === 'gemini-3.5-flash', asked.join());
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nGoogle busy is not the end (v46):');
{
  const kvStore = { 'gemini:model': 'gemini-3.5-flash', 'gemini:models': JSON.stringify(['gemini-3.5-flash', 'gemini-3.0-flash', 'gemini-3.5-flash-lite']) };
  const kv = { get: async k => kvStore[k] || null, put: async (k, v) => { kvStore[k] = v; } };
  const ek = { APP_SHARED_KEY: 'secret-k', GEMINI_API_KEY: 'g-key', BRING_KV: kv };
  const realFetch = globalThis.fetch;
  const asked = [];
  let busyFor = new Set(['gemini-3.5-flash']);
  globalThis.fetch = async (url) => {
    const m = /models\/([^:]+):generateContent$/.exec(String(url));
    if (m) { asked.push(m[1]);
      if (busyFor.has(m[1])) return new Response(JSON.stringify({ error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } }), { status: 503 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Cake\n6 eggs' }] } }] }), { status: 200 }); }
    return new Response('{}', { status: 404 });
  };
  try {
    let r = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw', appKey: 'secret-k' }), ek);
    let b = await r.json();
    expect('busy: asked again, then the next model answers', r.status === 200 && b.model === 'gemini-3.0-flash'
      && asked.join() === 'gemini-3.5-flash,gemini-3.5-flash,gemini-3.0-flash', `got ${r.status} ${JSON.stringify(b)} asked ${asked}`);
    asked.length = 0; busyFor = new Set(['gemini-3.5-flash', 'gemini-3.0-flash', 'gemini-3.5-flash-lite']);
    r = await worker.fetch(post({ action: 'video-recipe', url: 'https://youtu.be/WMTuLDQJHJw', appKey: 'secret-k' }), ek);
    b = await r.json();
    expect('all busy: said as busy, try again shortly — at most four asks', r.status === 503 && b.busy === true && /VIDEO_BUSY/.test(b.error) && asked.length <= 4,
      `got ${r.status} ${JSON.stringify(b)} asked ${asked}`);
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nfacebook-fetch (v47):');
{
  const ek = { APP_SHARED_KEY: 'secret-k' };
  const notFb = await worker.fetch(post({ action: 'facebook-fetch', url: 'https://example.com/x', appKey: 'secret-k' }), ek);
  expect('only a Facebook address is read', notFb.status === 400, `got ${notFb.status}`);
  const realFetch = globalThis.fetch;
  const asked = [];
  let oembedOk = true;
  const CAP = '🍫 העוגה הוויראלית – שכבות שוקולד ומוס אגוזי לוז<br />מצרכים:<br />• 6 ביצים<br />• כוס סוכר<br />• כוס שמן<br />• מיכל שמנת מתוקה';
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url); asked.push({ u, h: init.headers || {} });
    if (/\/share\/r\//.test(u)) return new Response('', { status: 302, headers: { location: 'https://www.facebook.com/reel/777/?mibextid=abc&rdid=x' } });
    if (/oembed_video/.test(u)) return oembedOk
      ? new Response(JSON.stringify({ author_name: 'patisselir', html: '<div class="fb-video"><blockquote cite="x" class="fb-xfbml-parse-ignore"><p>' + CAP + '</p>Posted by <a href="#">patisselir</a> on Monday</blockquote></div>' }), { status: 200 })
      : new Response(JSON.stringify({ error: { message: 'Requires an access token' } }), { status: 400 });
    if (/oembed_post/.test(u)) return new Response(JSON.stringify({ error: { message: 'Requires an access token' } }), { status: 400 });
    if (/plugins\/video\.php/.test(u)) return new Response('<html><body><div>Facebook</div><div>Log in</div><div dir="auto">Hazelnut mousse: 120 g dark chocolate, 120 g milk chocolate, 300 g cream. Melt, chill and whip.</div><span>See more</span></body></html>', { status: 200 });
    return new Response('nope', { status: 404 });
  };
  try {
    let b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/share/r/1AkSMeYV4w/', appKey: 'secret-k' }), ek)).json();
    expect('a share link is followed to its reel, tracking removed', b.url === 'https://www.facebook.com/reel/777/', JSON.stringify(b.url));
    expect('the official embed gives the post\'s text, lines kept, "Posted by" left out',
      b.via === 'oembed_video' && /מצרכים:\n• 6 ביצים\n• כוס סוכר/.test(b.text) && !/Posted by/.test(b.text), JSON.stringify(b));
    expect('…with an honest User-Agent', asked.every(a => /recipe-importer/.test(a.h['User-Agent'] || '')), JSON.stringify(asked.map(a => a.h['User-Agent'])));
    oembedOk = false;
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/777', appKey: 'secret-k' }), ek)).json();
    expect('without the embed, the public embed page, Facebook\'s own words left out',
      b.via === 'embed-video' && /^Hazelnut mousse/.test(b.text) && !/Log in|See more/.test(b.text), JSON.stringify(b));
    globalThis.fetch = async () => new Response('', { status: 404 });
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/777', appKey: 'secret-k' }), ek)).json();
    expect('nothing readable: empty text, and each attempt said', b.text === '' && Array.isArray(b.tried) && b.tried.length >= 3, JSON.stringify(b));
    // v49 — the post's own page: its preview caption and its video.
    let pageHtml = '<html><head><meta property="og:title" content="Pistachio cake" /><meta property="og:description" content="Pistachio cake: 3 eggs, 1 cup sugar, 1 cup ground pistachios, 1/2 cup oil. Bake 35 minutes at 180&#064;C." />'
      + '<meta property="og:video:secure_url" content="https://video.xx.fbcdn.net/v/p.mp4?a=1&amp;b=2" /></head><body></body></html>';
    asked.length = 0;
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url); asked.push({ u, h: init.headers || {} });
      if (/^https:\/\/www\.facebook\.com\/reel\/888\/?$/.test(u)) return new Response(pageHtml, { status: 200 });
      if (/graph\.facebook\.com/.test(u)) return new Response(JSON.stringify({ error: { message: 'Requires an access token' } }), { status: 400 });
      return new Response('', { status: 404 });
    };
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/888', appKey: 'secret-k' }), ek)).json();
    expect('v49: the post\'s own page gives its caption and its video', b.via === 'page' && /^Pistachio cake: 3 eggs/.test(b.text) && b.videoUrl === 'https://video.xx.fbcdn.net/v/p.mp4?a=1&b=2', JSON.stringify(b));
    expect('…with the same honest User-Agent', asked.every(a => /recipe-importer/.test(a.h['User-Agent'] || '')), JSON.stringify(asked.map(a => a.h['User-Agent'])));
    pageHtml = '<html><head><meta property="og:description" content="Log in to Facebook to start sharing and connecting with your friends, family and people you know." /></head></html>';
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/888', appKey: 'secret-k' }), ek)).json();
    expect('…the login wall\'s own words are not taken for a caption', b.text === '' && b.tried.some(t => /^page: no caption/.test(t)), JSON.stringify(b));
    // v50 — the preview is cut short; the page's data holds the whole caption.
    pageHtml = '<html><head><meta property="og:description" content="Pistachio cake that everyone asks me for, here is how I make it..." /></head><body><script type="application/json">'
      + '{"story":{"message":{"ranges":[],"text":"Pistachio cake that everyone asks me for, here is how I make it\\n\\u05de\\u05e6\\u05e8\\u05db\\u05d9\\u05dd:\\n3 eggs\\n1 cup sugar\\n1 cup ground pistachios\\nBake 35 minutes at 180\\u00b0C"}},'
      + '"comment":{"message":{"text":"Yum!"}}}</script></body></html>';
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/888', appKey: 'secret-k' }), ek)).json();
    expect('v50: the whole caption from the page\'s data, not the cut-short preview', b.via === 'page-data' && /מצרכים:\n3 eggs\n1 cup sugar/.test(b.text) && /180°C$/.test(b.text), JSON.stringify(b));
    pageHtml = '<html><head><meta property="og:description" content="So good 😍" /><meta property="og:video" content="https://video.xx.fbcdn.net/v/p.mp4" /></head></html>';
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/888', appKey: 'secret-k' }), ek)).json();
    expect('…a caption too short to be a recipe is still said, with the video', b.text === '' && b.caption === 'So good 😍' && b.videoUrl === 'https://video.xx.fbcdn.net/v/p.mp4', JSON.stringify(b));
    // v59 — only the preview, nothing longer in the data: said as cut off.
    const START = '🍫✨ העוגה הוויראלית – שכבות שוקולד, מוס אגוזי לוז ופייטה קראנץ׳ ✨🍫 עוגת החלומות שכולם מדברים עליה — רכה, עשירה, קראנצ׳ית, ונמסה בפה. נראית כמו מקונדיטוריה, אבל';
    pageHtml = '<html><head><meta property="og:description" content="' + START + '" /></head></html>';
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url);
      if (/^https:\/\/www\.facebook\.com\/reel\/888\/?$/.test(u)) return new Response(pageHtml, { status: 200 });
      if (/generativelanguage|anthropic/.test(u)) throw new Error('the web was searched');
      if (/graph\.facebook\.com/.test(u)) return new Response(JSON.stringify({ error: { message: 'Requires an access token' } }), { status: 400 });
      return new Response('', { status: 404 });
    };
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/888', appKey: 'secret-k' }), Object.assign({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, ek))).json();
    expect('v59: only the preview — said as cut off, and the web is not searched', b.via === 'page' && b.cut === true && b.text === START, JSON.stringify(b).slice(0, 300));
    // v52 — a post's plain address, Facebook's tracking left out.
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://m.facebook.com/reel/888/?referral_source=external_deeplink&original_uri=https://www.facebook.com/&mibextid=Z', appKey: 'secret-k' }), ek)).json();
    expect('v52: the post\'s plain address, Facebook\'s tracking left out', b.url === 'https://www.facebook.com/reel/888/', JSON.stringify(b.url));
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nthe Facebook reading test (v57, v59):');
{
  const ek = { APP_SHARED_KEY: 'secret-k' };
  const realFetch = globalThis.fetch;
  const PREV = 'The viral cake everyone is talking about: soft, rich, crunchy, melting in the mouth. Looks like it came from a patisserie, but';
  const WHOLE = PREV + ' it is easy to make at home!\\nIngredients:\\n6 eggs\\n1 cup sugar\\n1 cup oil\\n200 g dark chocolate\\nBake 30 minutes at 180C.';
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === 'https://www.facebook.com/reel/555/') return new Response('<html><head><meta property="og:description" content="' + PREV + '" /></head><body>Log in</body></html>', { status: 200 });
    if (u === 'https://m.facebook.com/reel/555/') return new Response('<html><body><script>{"x":{"text":"' + WHOLE + '"}}</script></body></html>', { status: 200 });
    if (/graph\.facebook\.com/.test(u)) return new Response(JSON.stringify({ error: { message: 'Requires an access token' } }), { status: 400 });
    return new Response('', { status: 404 });
  };
  try {
    const r = await (await worker.fetch(post({ action: 'fb-probe', url: 'https://www.facebook.com/reel/555/?mibextid=x', appKey: 'secret-k' }), ek)).json();
    const by = n => r.rows.find(x => x.route === n) || {};
    expect('every server route is tried and graded', r.rows.length === 7 && r.preview === PREV, JSON.stringify(r.rows.map(x => x.route)));
    expect('…the post page: preview only', by('server: the post page').grade === 'preview', JSON.stringify(by('server: the post page')));
    expect('…a page whose data holds the whole text: WHOLE', by('server: mobile site').grade === 'whole' && /180C\.$/.test(by('server: mobile site').tail), JSON.stringify(by('server: mobile site')));
    // v58 — the import takes it too: the whole caption from a data string.
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u === 'https://www.facebook.com/reel/555/') return new Response('<html><head><meta property="og:description" content="' + PREV + '" /></head><body><script>{"a":{"b":"' + WHOLE + '"}}</script></body></html>', { status: 200 });
      if (/graph\.facebook\.com/.test(u)) return new Response(JSON.stringify({ error: { message: 'Requires an access token' } }), { status: 400 });
      if (/generativelanguage|anthropic/.test(u)) throw new Error('the web was searched although the page held the text');
      return new Response('', { status: 404 });
    };
    const ff = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/555/', appKey: 'secret-k' }), Object.assign({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' }, ek))).json();
    expect('v58: facebook-fetch takes the whole caption from the page\'s data — no web search', ff.via === 'page-data' && /Ingredients:\n6 eggs/.test(ff.text) && /180C\.$/.test(ff.text), JSON.stringify(ff).slice(0, 300));
    expect('…an official embed refused: nothing, and why', by('server: official embed (oembed_video)').grade === 'nothing' && /access token/.test(by('server: official embed (oembed_video)').note), JSON.stringify(by('server: official embed (oembed_video)')));
    const gone = await (await worker.fetch(post({ action: 'fb-probe-html', html: 'x', appKey: 'secret-k' }), ek)).json();
    expect('v59: the phone endpoints are gone', !gone.row, JSON.stringify(gone).slice(0, 120));
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nthe cascade (v48):');
{
  const ek = { APP_SHARED_KEY: 'secret-k', GEMINI_API_KEY: 'g-key' };
  const realFetch = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url); asked.push(u);
    if (/instagram_oembed|api\.instagram\.com\/oembed/.test(u)) return new Response(JSON.stringify({ title: '', author_name: 'chef', html: '<blockquote>View this post on Instagram</blockquote>' }), { status: 200 });
    if (/\/embed\/captioned\//.test(u)) return new Response('<html><body><div class="Caption"><a class="CaptionUsername" href="#">chef</a><br>Shakshuka for two: 4 eggs, 2 tomatoes, 1 pepper. Fry, add, cover 6 minutes.<div class="CaptionComments">View all 12 comments</div></div><script>{"video_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/abc.mp4?x=1\\u0026y=2"}</script></body></html>', { status: 200 });
    if (/plugins\/video\.php/.test(u)) return new Response('<html><body><div>Facebook</div><script>{"browser_native_hd_url":"https:\\/\\/video.xx.fbcdn.net\\/v\\/reel.mp4?a=1"}</script></body></html>', { status: 200 });
    if (/graph\.facebook\.com/.test(u)) return new Response(JSON.stringify({ error: { message: 'Requires an access token' } }), { status: 400 });
    if (/fbcdn\.net\/v\/reel\.mp4/.test(u)) return new Response(new Uint8Array(2000), { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '2000' } });
    if (/upload\/v1beta\/files$/.test(u)) return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.example/u/9' } });
    if (u === 'https://upload.example/u/9') return new Response(JSON.stringify({ file: { name: 'files/r9', uri: 'https://g.example/files/r9', state: 'ACTIVE', mimeType: 'video/mp4' } }), { status: 200 });
    if (/:generateContent$/.test(u)) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Aglio e olio\n200 g spaghetti' }] } }] }), { status: 200 });
    if (/files\/r9$/.test(u)) return new Response('{}', { status: 200 });
    return new Response('', { status: 404 });
  };
  try {
    let b = await (await worker.fetch(post({ action: 'instagram-fetch', shortcode: 'ABC123', appKey: 'secret-k' }), ek)).json();
    expect('Instagram: no caption in the official embed → the captioned embed page, username left out',
      b.via === 'embed-captioned' && /^Shakshuka for two/.test(b.text) && !/chef|View all/.test(b.text), JSON.stringify(b));
    expect('…with the post\'s video address, unescaped', b.videoUrl === 'https://scontent.cdninstagram.com/v/abc.mp4?x=1&y=2', b.videoUrl);
    b = await (await worker.fetch(post({ action: 'facebook-fetch', url: 'https://www.facebook.com/reel/777', appKey: 'secret-k' }), ek)).json();
    expect('Facebook: no words, but the reel\'s video address from the public embed page', b.text === '' && b.videoUrl === 'https://video.xx.fbcdn.net/v/reel.mp4?a=1', JSON.stringify(b));
    const bad = await worker.fetch(post({ action: 'video-from-url', url: 'https://evil.example/x.mp4', appKey: 'secret-k' }), ek);
    expect('video-from-url: only Facebook\'s and Instagram\'s video servers', bad.status === 400, `got ${bad.status}`);
    const bad2 = await worker.fetch(post({ action: 'video-from-url', url: 'https://fbcdn.net.evil.example/x.mp4', appKey: 'secret-k' }), ek);
    expect('…not a look-alike address', bad2.status === 400, `got ${bad2.status}`);
    asked.length = 0;
    b = await (await worker.fetch(post({ action: 'video-from-url', url: 'https://video.xx.fbcdn.net/v/reel.mp4?a=1', appKey: 'secret-k' }), ek)).json();
    expect('…the reel\'s video is read into its recipe, and deleted from Google after', /200 g spaghetti/.test(b.text) && asked.some(u => /files\/r9$/.test(u)), JSON.stringify(b));
  } finally { globalThis.fetch = realFetch; }
}

console.log('\nvideo-file (v44):');
{
  const vpost = (bytes, type, headers = {}, origin = ORIGIN) => new Request('https://worker.test/?action=video-file', {
    method: 'POST', headers: { 'Content-Type': type, 'Origin': origin, 'Content-Length': String(bytes.length), ...headers }, body: bytes });
  const vid = new Uint8Array(3000).fill(7);
  const ek = { APP_SHARED_KEY: 'secret-k', GEMINI_API_KEY: 'g-key' };
  const noKey = await worker.fetch(vpost(vid, 'video/mp4'), ek);
  expect('a video without the app key is refused', noKey.status === 403, `got ${noKey.status}`);
  const foreign = await worker.fetch(vpost(vid, 'video/mp4', { 'X-App-Key': 'secret-k' }, 'https://evil.example'), ek);
  expect('…and from another site', foreign.status === 403, `got ${foreign.status}`);
  const notVideo = await worker.fetch(vpost(vid, 'text/html', { 'X-App-Key': 'secret-k' }), ek);
  expect('only a video file is taken', notVideo.status === 415, `got ${notVideo.status}`);
  const big = await worker.fetch(vpost(new Uint8Array(1100000), 'video/mp4', { 'X-App-Key': 'secret-k' }), Object.assign({ VIDEO_MAX_MB: '1' }, ek));
  expect('a video over the size cap is refused, saying so', big.status === 413 && (await big.json()).tooBig === true, `got ${big.status}`);
  const off = await worker.fetch(vpost(vid, 'video/mp4', { 'X-App-Key': 'secret-k' }), { APP_SHARED_KEY: 'secret-k' });
  expect('without GEMINI_API_KEY it says it is not set up', off.status === 503 && (await off.json()).needsConfig === true, `got ${off.status}`);
  check('…with CORS', off);
  const realFetch = globalThis.fetch;
  const calls = [];
  let polls = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url); calls.push({ u, m: init.method || 'GET', h: init.headers || {}, b: init.body });
    if (/upload\/v1beta\/files$/.test(u)) return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.example/u/1' } });
    if (u === 'https://upload.example/u/1') return new Response(JSON.stringify({ file: { name: 'files/abc', uri: 'https://g.example/files/abc', state: 'PROCESSING', mimeType: 'video/mp4' } }), { status: 200 });
    if (/v1beta\/files\/abc$/.test(u) && (init.method || 'GET') === 'GET') { polls++; return new Response(JSON.stringify({ name: 'files/abc', state: 'ACTIVE', uri: 'https://g.example/files/abc', mimeType: 'video/mp4' }), { status: 200 }); }
    if (/v1beta\/files\/abc$/.test(u) && init.method === 'DELETE') return new Response('{}', { status: 200 });
    if (/:generateContent$/.test(u)) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'עוגה\nמצרכים:\n6 ביצים' }] } }] }), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  try {
    const r = await worker.fetch(vpost(vid, 'video/mp4', { 'X-App-Key': 'secret-k' }), ek);
    const b = await r.json();
    expect('a video file is read into the recipe it shows', r.status === 200 && /6 ביצים/.test(b.text) && b.fromFile === true, `got ${r.status} ${JSON.stringify(b)}`);
    const upBody = calls.find(c => c.u === 'https://upload.example/u/1');
    expect('…the whole video was uploaded to Google', upBody && upBody.b && upBody.b.byteLength === vid.length, JSON.stringify(upBody && upBody.b && upBody.b.byteLength));
    expect('…after Google said it was ready', polls >= 1, 'no wait for ACTIVE');
    const gen = calls.find(c => /:generateContent$/.test(c.u));
    const parts = JSON.parse(gen.b).contents[0].parts;
    expect('…read with the fixed request, by its uploaded address', parts[0].file_data.file_uri === 'https://g.example/files/abc' && /NO RECIPE/.test(parts[1].text), JSON.stringify(parts[0]));
    expect('…and deleted from Google straight after', calls.some(c => c.m === 'DELETE' && /files\/abc$/.test(c.u)), 'no DELETE');
    expect('…the key always in a header, never in an address', calls.every(c => !/g-key/.test(c.u)), 'key in a URL');
    calls.length = 0;
    await worker.fetch(vpost(vid, 'video/quicktime', { 'X-App-Key': 'secret-k' }), ek);
    const st = calls.find(c => /upload\/v1beta\/files$/.test(c.u));
    expect('an iPhone screen recording (QuickTime) goes to Google as video/mov', st && st.h['X-Goog-Upload-Header-Content-Type'] === 'video/mov', JSON.stringify(st && st.h));
  } finally { globalThis.fetch = realFetch; }
}

// v66 — sending straight to a Bring! list is retired (Tony): the four actions
// that used the family's Bring! token answer 410 to everyone — the set-token one
// even with its old secret (it is in the public repository) and a secret set.
console.log('\nBring! direct sending retired (v66):');
for (const action of ['bring-settoken', 'bring-add', 'bring-lists', 'bring-token-status']) {
  const rr = await worker.fetch(post({ action, token: 'a.b.c', secret: 'tonys-recipes-2024', items: [{ name: 'milk' }], appKey: 'secret-k' }),
    { BRING_SETTOKEN_SECRET: 'tonys-recipes-2024', BRING_TOKEN: 'a.b.c', BRING_API_KEY: 'k', BRING_LIST_UUID: 'l', BRING_USER_UUID: 'u', APP_SHARED_KEY: 'secret-k' });
  let dd = {}; try { dd = await rr.json(); } catch (e) {}
  expect(action + ' is retired', rr.status === 410 && /^BRING_RETIRED/.test(dd.error || ''), `got ${rr.status} ${JSON.stringify(dd)}`);
}

// v60 — AI per household. Real RS256 tokens signed with a key made here, a real
// SQLite standing in for D1 (node:sqlite), Firestore and Anthropic faked.
console.log('\nAI per household (v60):');
{
  const { DatabaseSync } = await import('node:sqlite');
  function fakeD1() {
    const raw = new DatabaseSync(':memory:');
    const stmt = (sql, args) => ({
      bind: (...a) => stmt(sql, a),
      first: async () => raw.prepare(sql).get(...(args || [])) || null,
      all: async () => ({ results: raw.prepare(sql).all(...(args || [])) }),
      run: async () => { const x = raw.prepare(sql).run(...(args || [])); return { success: true, meta: { last_row_id: Number(x.lastInsertRowid), changes: Number(x.changes) } }; },
      _run() { raw.prepare(sql).run(...(args || [])); }
    });
    return { raw, prepare: (sql) => stmt(sql, []), batch: async (list) => { raw.exec('BEGIN'); try { list.forEach(s => s._run()); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } return []; } };
  }
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
  async function token(claims, key = kp.privateKey, kid = 'k1') {
    const now = Math.floor(Date.now() / 1000);
    const c = Object.assign({ iss: 'https://securetoken.google.com/' + (claims.aud || 'tonys-recipes-test'), aud: 'tonys-recipes-test',
      sub: 'uA', email: 'a@example.com', email_verified: true, iat: now - 10, exp: now + 3600,
      auth_time: now - 10, firebase: { sign_in_provider: 'google.com' } }, claims);   // v73 — signed in with Google, just now
    if (claims.aud && !claims.iss) c.iss = 'https://securetoken.google.com/' + claims.aud;
    const head = b64u({ alg: 'RS256', kid }), body = b64u(c);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body));
    return head + '.' + body + '.' + Buffer.from(sig).toString('base64url');
  }
  const TEST_ORIGIN = 'https://tonys-recipes-test.pages.dev';
  const TEST_OWNER = 'owner@worker-test.example';
  const db = fakeD1();
  // v74 — the owner's address comes from the Worker's settings (the secret OWNER_EMAIL), never from the code.
  const envM = { ANTHROPIC_API_KEY: 'sk-test', METER_DB: db, __testKeys: { k1: Object.assign({ kid: 'k1' }, pub) },
                 ALLOWED_ORIGINS: TEST_ORIGIN, __firestoreBase: 'https://fs.test', OWNER_EMAIL: TEST_OWNER };
  // Firestore: uA is in hA (created long ago); uB is in nothing.
  const members = { 'hA/uA': true, 'hF/uF': true };
  const security = {};   // v73 — config/security per project: true / false / 'fail'
  let anthropicCalls = 0, sent = null, firestoreAsks = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    url = String(url);
    if (url.startsWith('https://fs.test/')) {
      firestoreAsks.push({ url, auth: init && init.headers && init.headers.Authorization });
      if (/\/config\/security$/.test(url)) {
        const sp = security[/projects\/([^/]+)/.exec(url)[1]];
        if (sp === undefined) return new Response('{}', { status: 404 });
        if (sp === 'fail') return new Response('oops', { status: 500 });
        return new Response(JSON.stringify({ fields: { ownerTwoStep: { booleanValue: sp } } }), { status: 200 });
      }
      const m = /households\/([^/]+)(?:\/members\/([^/?]+))?$/.exec(url);
      const mem = members[m[1] + '/' + m[2]];
      if (m[2]) return new Response(mem ? JSON.stringify({ fields: { role: { stringValue: typeof mem === 'string' ? mem : 'owner' } } }) : '{}', { status: mem ? 200 : 403 });
      return new Response(JSON.stringify({ fields: { name: { stringValue: 'Kitchen A' }, code: { stringValue: 'MKN-AAAA-2222' }, createdAt: { integerValue: String(Date.parse('2026-01-05')) } } }), { status: 200 });
    }
    if (url === 'https://api.anthropic.com/v1/messages') {
      anthropicCalls++; sent = JSON.parse(init.body);
      // 100k input + 20k output on Sonnet 5 = $0.20 + $0.20 = $0.40
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 100000, output_tokens: 20000 } }), { status: 200 });
    }
    return realFetch(url, init);
  };
  const ai = async (extra, origin = TEST_ORIGIN, env = envM) => {
    const r = await worker.fetch(post(Object.assign({ model: 'claude-sonnet-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }, extra), origin), env);
    let d = null; try { d = await r.json(); } catch (e) {}
    return { status: r.status, d };
  };
  try {
    const health = await (await worker.fetch(post({ action: 'health' }), envM)).json();
    expect('health says metering is on (so the app sends its sign-in)', health.metering && health.metering.version === 1 && health.metering.db === true, JSON.stringify(health.metering));
    const tA = await token({ sub: 'uA' });
    let r = await ai({ idToken: tA, hid: 'hA' });
    expect('a member\'s call goes through', r.status === 200 && anthropicCalls === 1, JSON.stringify(r));
    expect('…the sign-in and the household are NOT forwarded to Anthropic', sent && sent.idToken === undefined && sent.hid === undefined && sent.appKey === undefined, JSON.stringify(Object.keys(sent || {})));
    expect('…membership was read with the person\'s own sign-in', firestoreAsks.some(a => /households\/hA\/members\/uA$/.test(a.url) && a.auth === 'Bearer ' + tA), JSON.stringify(firestoreAsks));
    expect('…and the answer says what the household has used', r.d && r.d._meter && Math.abs(r.d._meter.usd - 0.40) < 1e-9 && r.d._meter.cap === 2, JSON.stringify(r.d && r.d._meter));
    const row = db.raw.prepare('SELECT * FROM ai_spend').get();
    expect('…counted in the database, in dollars, from the answer\'s own usage', row && row.hid === 'hA' && row.project === 'tonys-recipes-test' && Math.abs(row.usd - 0.40) < 1e-9 && row.calls === 1, JSON.stringify(row));
    const hrow = db.raw.prepare('SELECT * FROM ai_households').get();
    expect('…with the household\'s name, identifier and last use', hrow && hrow.name === 'Kitchen A' && hrow.code === 'MKN-AAAA-2222' && hrow.last_seen > 0, JSON.stringify(hrow));
    for (let i = 0; i < 4; i++) await ai({ idToken: tA, hid: 'hA' });            // $2.00 now
    const before = anthropicCalls;
    r = await ai({ idToken: tA, hid: 'hA' });
    expect('past the $2 allowance: refused, kindly, before any cost', r.status === 429 && r.d.rateLimited === true && /^AI_ALLOWANCE: this month's AI allowance/.test(r.d.error) && /renews on the 1st/.test(r.d.error) && anthropicCalls === before, JSON.stringify(r));
    const tB = await token({ sub: 'uB' });
    r = await ai({ idToken: tB, hid: 'hA' });
    expect('someone not in the household is refused', r.status === 403 && /not in that household/.test(r.d.error), JSON.stringify(r));
    r = await ai({ idToken: tA.slice(0, -4) + 'AAAA', hid: 'hA' });
    expect('a forged sign-in is refused', r.status === 403 && /signature/.test(r.d.error), JSON.stringify(r));
    r = await ai({ idToken: await token({ sub: 'uA' }, other.privateKey), hid: 'hA' });
    expect('a sign-in signed by anyone but Google is refused', r.status === 403, JSON.stringify(r));
    r = await ai({ idToken: await token({ sub: 'uA', exp: Math.floor(Date.now() / 1000) - 3600 }), hid: 'hA' });
    expect('an expired sign-in is refused', r.status === 403 && /expired/.test(r.d.error), JSON.stringify(r));
    r = await ai({ idToken: await token({ sub: 'uA', aud: 'someone-elses-app' }), hid: 'hA' });
    expect('a sign-in from another Firebase project is refused', r.status === 403 && /does not serve/.test(r.d.error), JSON.stringify(r));
    r = await ai({});
    expect('the test copy without a sign-in: refused (it is counted per household)', r.status === 401 && /sign in/.test(r.d.error), JSON.stringify(r));
    // A new household this month gets $4.
    members['hN/uN'] = true;
    const realFetch2 = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url) === 'https://fs.test/v1/projects/tonys-recipes-test/databases/(default)/documents/households/hN')
        return new Response(JSON.stringify({ fields: { name: { stringValue: 'New' }, createdAt: { integerValue: String(Date.now()) } } }), { status: 200 });
      return realFetch2(url, init);
    };
    const tN = await token({ sub: 'uN' });
    for (let i = 0; i < 5; i++) r = await ai({ idToken: tN, hid: 'hN' });
    expect('a household new this month has $4: still going at $2.00', r.status === 200 && Math.abs(r.d._meter.usd - 2.0) < 1e-9 && r.d._meter.cap === 4, JSON.stringify(r.d && r.d._meter));
    globalThis.fetch = realFetch2;
    // The family's copy: counted, never capped, and nothing breaks without a sign-in.
    const tF = await token({ sub: 'uF', aud: 'recipes-f379d' });
    for (let i = 0; i < 7; i++) r = await ai({ idToken: tF, hid: 'hF' }, ORIGIN);
    // v67 — Tony: the family's copy has an allowance too, $10 a month per household.
    expect('v67: the family\'s copy is counted, with its own $10 allowance ($2.80, still answering)', r.status === 200 && Math.abs(r.d._meter.usd - 2.8) < 1e-9 && r.d._meter.cap === 10, JSON.stringify(r));
    // v66 — Tony asked about hardening: the family's address and the app key are
    // public (the repository is), so on the family's copy too there is no AI
    // without a sign-in that checks out and membership of the household.
    let callsNow = anthropicCalls;
    r = await ai({}, ORIGIN);
    expect('v66: the family\'s copy without a sign-in is refused (its address proves nothing)', r.status === 401 && /sign in/.test(r.d.error) && anthropicCalls === callsNow, JSON.stringify(r));
    r = await ai({ idToken: tF.slice(0, -4) + 'AAAA', hid: 'hF' }, ORIGIN);
    expect('v66: …and with a forged sign-in', r.status === 403 && /signature/.test(r.d.error) && anthropicCalls === callsNow, JSON.stringify(r));
    r = await ai({ idToken: await token({ sub: 'uStranger', aud: 'recipes-f379d' }), hid: 'hF' }, ORIGIN);
    expect('v66: …and for someone signed in who is not in the household', r.status === 403 && /not in that household/.test(r.d.error) && anthropicCalls === callsNow, JSON.stringify(r));
    // Only the COUNTING failing (Firestore not answering) still lets a proven sign-in through there.
    const realFetch3 = globalThis.fetch;
    globalThis.fetch = async (url, init) => String(url).startsWith('https://fs.test/') && /uF2/.test(String(url))
      ? new Response('{}', { status: 500 }) : realFetch3(url, init);
    r = await ai({ idToken: await token({ sub: 'uF2', aud: 'recipes-f379d' }), hid: 'hF' }, ORIGIN);
    globalThis.fetch = realFetch3;
    expect('v66: …but a proven sign-in whose household cannot be read carries on there, as before', r.status === 200 && anthropicCalls === callsNow + 1, JSON.stringify(r));
    // Only what the app asks for: its models, its sizes.
    callsNow = anthropicCalls;
    r = await ai({ idToken: tF, hid: 'hF', model: 'claude-opus-5' }, ORIGIN);
    expect('v66: a model the app does not use is refused, before any cost', r.status === 400 && /not one this app uses/.test(r.d.error) && anthropicCalls === callsNow, JSON.stringify(r));
    r = await ai({ idToken: tF, hid: 'hF', max_tokens: 100000 }, ORIGIN);
    expect('v66: an answer longer than the app ever asks for is refused', r.status === 400 && /more than this app asks for/.test(r.d.error) && anthropicCalls === callsNow, JSON.stringify(r));
    r = await ai({ idToken: tF, hid: 'hF', model: 'claude-haiku-4-5', max_tokens: 24000 }, ORIGIN);
    expect('v66: a long answer (24000 tokens, Haiku) goes through', r.status === 200 && anthropicCalls === callsNow + 1, JSON.stringify(r));
    r = await ai({}, TEST_ORIGIN, { ANTHROPIC_API_KEY: 'sk-test', ALLOWED_ORIGINS: TEST_ORIGIN });
    expect('without METER_DB nothing changes (the test copy works unsigned)', r.status === 200, JSON.stringify(r));
    // meter-me and meter-admin
    let m = await (await worker.fetch(post({ action: 'meter-me', idToken: tA, hid: 'hA' }, TEST_ORIGIN), envM)).json();
    expect('meter-me: the household\'s month so far', Math.abs(m.usd - 2.0) < 1e-9 && m.cap === 2 && m.calls === 5, JSON.stringify(m));
    let adm = await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: tA }, TEST_ORIGIN), envM);
    expect('meter-admin is refused to anyone but the owner', adm.status === 403, 'status ' + adm.status);
    const tOwner = await token({ sub: 'uT', email: TEST_OWNER });
    adm = await (await worker.fetch(post({ action: 'meter-admin', op: 'set-cap', hid: 'hA', cap: 5, idToken: tOwner }, TEST_ORIGIN), envM)).json();
    expect('the owner raises a household\'s cap', adm.ok === true && adm.cap === 5, JSON.stringify(adm));
    // v74 — no owner's address in the Worker's settings: nobody is the owner (not everybody).
    const envNoOwner = Object.assign({}, envM); delete envNoOwner.OWNER_EMAIL;
    let noOwn = await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: tOwner }, TEST_ORIGIN), envNoOwner);
    expect('v74: with no owner set, the owner\'s tools are refused to everyone', noOwn.status === 403, 'status ' + noOwn.status);
    noOwn = await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: tOwner }, TEST_ORIGIN), Object.assign({}, envNoOwner, { OWNER_EMAILS: 'someone@else.example, ' + TEST_OWNER.toUpperCase() }));
    expect('v74: OWNER_EMAILS (a list, any case) still names the owner', noOwn.status === 200, 'status ' + noOwn.status);
    const hOwn = await (await worker.fetch(post({ action: 'health' }, TEST_ORIGIN), envM)).json(), hNone = await (await worker.fetch(post({ action: 'health' }, TEST_ORIGIN), envNoOwner)).json();
    expect('v74: health says whether the owner is set', hOwn.owner === true && hNone.owner === false, JSON.stringify([hOwn.owner, hNone.owner]));
    expect('v74: no e-mail address is written in the Worker', !/[A-Za-z0-9._%+-]+@(?!example\b|system\.gserviceaccount\.com\b)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.test((await import('node:fs')).readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8')), 'an address is in the code');
    r = await ai({ idToken: tA, hid: 'hA' });
    expect('…and the household answers again', r.status === 200 && r.d._meter.cap === 5, JSON.stringify(r));
    // v67 — the family's copy: $10 a month per household, paused or changed by the owner.
    members['hP/uP'] = true;
    const tP = await token({ sub: 'uP', aud: 'recipes-f379d' });
    adm = await (await worker.fetch(post({ action: 'meter-admin', op: 'set-cap', project: 'recipes-f379d', hid: 'hP', cap: 0, idToken: tOwner }, TEST_ORIGIN), envM)).json();
    let callsP = anthropicCalls;
    r = await ai({ idToken: tP, hid: 'hP' }, ORIGIN);
    expect('v67: the owner pauses a family household\'s AI ($0): refused, before any cost', adm.ok && r.status === 429 && /allowance/.test(r.d.error) && anthropicCalls === callsP, JSON.stringify(r));
    await worker.fetch(post({ action: 'meter-admin', op: 'set-cap', project: 'recipes-f379d', hid: 'hP', cap: null, idToken: tOwner }, TEST_ORIGIN), envM);
    for (let i = 0; i < 25; i++) r = await ai({ idToken: tP, hid: 'hP' }, ORIGIN);     // $0.40 each → $10.00 after 25
    callsP = anthropicCalls;
    r = await ai({ idToken: tP, hid: 'hP' }, ORIGIN);
    expect('v67: back to the default, a family household stops at $10', r.status === 429 && /\$10\.00/.test(r.d.error) && anthropicCalls === callsP, JSON.stringify(r));
    await worker.fetch(post({ action: 'meter-admin', op: 'set-cap', project: 'recipes-f379d', hid: 'hP', cap: 50, idToken: tOwner }, TEST_ORIGIN), envM);
    r = await ai({ idToken: tP, hid: 'hP' }, ORIGIN);
    expect('v67: …and goes on when the owner raises it', r.status === 200 && r.d._meter.cap === 50, JSON.stringify(r));
    const list = await (await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: tOwner }, TEST_ORIGIN), envM)).json();
    const hA = (list.households || []).filter(h => h.hid === 'hA')[0];
    expect('the owner lists every household with this month and the two before', hA && hA.capNow === 5 && hA.months.length === 3 && Math.abs(hA.months[0].usd - 2.4) < 1e-9 && list.capped === true, JSON.stringify(list).slice(0, 300));
    const unverified = await token({ sub: 'uT', email: TEST_OWNER, email_verified: false });
    adm = await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: unverified }, TEST_ORIGIN), envM);
    expect('…but not with an unconfirmed address', adm.status === 403, 'status ' + adm.status);
    // v61 — notes from every copy, one inbox.
    const fb = async (body, origin = TEST_ORIGIN) => { const rr = await worker.fetch(post(body, origin), envM); let dd = null; try { dd = await rr.json(); } catch (e) {} return { status: rr.status, d: dd }; };
    let f = await fb({ action: 'feedback-send', idToken: tA, note: { text: 'The import was slow', shot: 'data:image/jpeg;base64,AAAA', log: 'L', version: 'v37.68', env: 'test', household: 'Kitchen A', hid: 'hA' } });
    expect('a signed-in person leaves a note', f.status === 200 && f.d.ok === true, JSON.stringify(f));
    const fam = await token({ sub: 'uF', aud: 'recipes-f379d', email: 'f@example.com' });
    f = await fb({ action: 'feedback-send', idToken: fam, note: { text: 'From the family', env: 'live' } }, ORIGIN);
    expect('…from any copy', f.status === 200, JSON.stringify(f));
    f = await fb({ action: 'feedback-send', idToken: tA, note: { text: '   ' } });
    expect('an empty note is refused', f.status === 400, JSON.stringify(f));
    f = await fb({ action: 'feedback-send', idToken: tA, note: { text: 'x', shot: 'javascript:alert(1)' } });
    expect('a "screenshot" that is not a picture is refused', f.status === 400, JSON.stringify(f));
    f = await fb({ action: 'feedback-send', idToken: tA.slice(0, -4) + 'AAAA', note: { text: 'forged' } });
    expect('a forged sign-in cannot leave one', f.status === 401, JSON.stringify(f));
    const nrow = db.raw.prepare("SELECT * FROM feedback WHERE text = 'The import was slow'").get();
    expect('…kept with WHO sent it from the sign-in, not from the note', nrow && nrow.uid === 'uA' && nrow.email === 'a@example.com' && nrow.project === 'tonys-recipes-test' && nrow.status === 'new', JSON.stringify(nrow));
    f = await fb({ action: 'meter-admin', op: 'notes', idToken: tA });
    expect('nobody but the owner reads them', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes', idToken: tOwner }, ORIGIN);
    expect('the owner reads every copy\'s notes, from any copy, newest first', f.status === 200 && f.d.notes.length === 2 && f.d.notes.map(n => n.project).sort().join() === 'recipes-f379d,tonys-recipes-test', JSON.stringify(f.d).slice(0, 200));
    f = await fb({ action: 'meter-admin', op: 'notes-new', idToken: tOwner });
    expect('…counts the new ones', f.d && f.d.new === 2, JSON.stringify(f.d));
    expect('v78: …and carries the server\'s notices (an array, empty when all is well)', f.d && Array.isArray(f.d.server), JSON.stringify(f.d));
    {
      const before = db.raw.prepare('SELECT last_at FROM owner_devices').all().map(r => r.last_at).join();
      await fb({ action: 'meter-admin', op: 'notes-new', idToken: tOwner });
      const after = db.raw.prepare('SELECT last_at FROM owner_devices').all().map(r => r.last_at).join();
      expect('v78: the owner\'s device "last seen" is not rewritten on every call', before && before === after, before + ' → ' + after);
    }
    // v68 — the owner answers a note in its writer's own app.
    const slowId = nrow.id;
    f = await fb({ action: 'meter-admin', op: 'note-reply', id: slowId, text: 'Thanks — fixed in the next version', idToken: tA });
    expect('v68: nobody but the owner answers a note', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'note-reply', id: slowId, text: '   ', idToken: tOwner }, ORIGIN);
    expect('v68: an empty answer is refused', f.status === 400, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'note-reply', id: 999999, text: 'x', idToken: tOwner }, ORIGIN);
    expect('v68: an answer to a note no longer there is refused', f.status === 404, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'note-reply', id: slowId, text: 'Thanks — fixed in the next version', idToken: tOwner }, ORIGIN);
    const rrow1 = db.raw.prepare('SELECT * FROM feedback_replies WHERE note_id = ?').get(slowId);
    expect('v68: the owner answers from the family app — kept for the writer\'s copy and account, with what they wrote',
      f.status === 200 && f.d.ok && f.d.reply.id > 0 && rrow1 && rrow1.project === 'tonys-recipes-test' && rrow1.uid === 'uA'
      && rrow1.note_text === 'The import was slow' && rrow1.from_email === TEST_OWNER && rrow1.read_at === null, JSON.stringify([f, rrow1]));
    expect('v68: …and the note, new until now, is marked seen', db.raw.prepare('SELECT status FROM feedback WHERE id = ?').get(slowId).status === 'seen');
    f = await fb({ action: 'meter-admin', op: 'notes', idToken: tOwner }, ORIGIN);
    expect('v68: the owner\'s list shows the answers with their notes', f.d.replies && f.d.replies.length === 1 && f.d.replies[0].note_id === slowId && f.d.replies[0].read_at === null, JSON.stringify(f.d.replies));
    f = await fb({ action: 'feedback-replies', idToken: tA });
    expect('v68: the writer\'s app gets the answer', f.status === 200 && f.d.replies.length === 1 && f.d.replies[0].text === 'Thanks — fixed in the next version'
      && f.d.replies[0].note_text === 'The import was slow' && f.d.replies[0].read_at === null, JSON.stringify(f));
    f = await fb({ action: 'feedback-replies', idToken: tB });
    expect('v68: …and nobody else does', f.status === 200 && f.d.replies.length === 0, JSON.stringify(f));
    const tAfam = await token({ sub: 'uA', aud: 'recipes-f379d', email: 'a@example.com' });
    f = await fb({ action: 'feedback-replies', idToken: tAfam }, ORIGIN);
    expect('v68: …nor the same account in another copy', f.status === 200 && f.d.replies.length === 0, JSON.stringify(f));
    f = await fb({ action: 'feedback-replies', idToken: tB, read: [rrow1.id] });
    expect('v68: someone else cannot mark it read', db.raw.prepare('SELECT read_at FROM feedback_replies WHERE id = ?').get(rrow1.id).read_at === null, JSON.stringify(f));
    f = await fb({ action: 'feedback-replies', idToken: tA.slice(0, -4) + 'AAAA' });
    expect('v68: a forged sign-in gets nothing', f.status === 401, JSON.stringify(f));
    f = await fb({ action: 'feedback-replies', idToken: tA, read: [rrow1.id, 'x', -3] });
    expect('v68: the writer marks it read', f.status === 200 && f.d.replies[0].read_at > 0, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes', idToken: tOwner }, ORIGIN);
    expect('v68: …and the owner sees that it was read', f.d.replies[0].read_at > 0, JSON.stringify(f.d.replies));
    const id = db.raw.prepare("SELECT id FROM feedback WHERE text = 'From the family'").get().id;
    f = await fb({ action: 'meter-admin', op: 'note-status', id, status: 'done', idToken: tOwner });
    expect('…marks one done', f.status === 200 && db.raw.prepare('SELECT status FROM feedback WHERE id = ?').get(id).status === 'done', JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'note-delete', id, idToken: tOwner });
    expect('…and removes it', f.status === 200 && !db.raw.prepare('SELECT id FROM feedback WHERE id = ?').get(id), JSON.stringify(f));
    // v88 — several at once (Tony: select reports, then "Delete selected")
    for (const t of ['Batch one', 'Batch two', 'Batch three']) await fb({ action: 'feedback-send', idToken: tA, note: { text: t } });
    const batchLeft = () => db.raw.prepare("SELECT id FROM feedback WHERE text LIKE 'Batch %' ORDER BY id").all().map(x => x.id);
    const bIds = batchLeft();
    f = await fb({ action: 'meter-admin', op: 'notes-delete', ids: bIds.slice(0, 2), idToken: tA });
    expect('v88: only the owner deletes several notes', f.status === 403 && batchLeft().length === 3, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes-delete', ids: [bIds[0], String(bIds[1]), bIds[0], 'x', -4], idToken: tOwner });
    expect('v88: the owner deletes several notes in one go (each once, nonsense left out); the others stay', f.status === 200 && f.d.deleted === 2
      && batchLeft().join() === String(bIds[2]), JSON.stringify([f, batchLeft()]));
    // v89 — several marked seen or done at once
    for (const t2 of ['Mark one', 'Mark two', 'Mark three']) await fb({ action: 'feedback-send', idToken: tA, note: { text: t2 } });
    const mIds = db.raw.prepare("SELECT id FROM feedback WHERE text LIKE 'Mark %' ORDER BY id").all().map(x => x.id);
    const mSt = () => db.raw.prepare("SELECT status FROM feedback WHERE text LIKE 'Mark %' ORDER BY id").all().map(x => x.status).join();
    f = await fb({ action: 'meter-admin', op: 'notes-status', ids: mIds.slice(0, 2), status: 'done', idToken: tA });
    expect('v89: only the owner marks several notes', f.status === 403 && mSt() === 'new,new,new', JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes-status', ids: mIds.slice(0, 2), status: 'done', idToken: tOwner });
    expect('v89: the owner marks several notes done in one go; the other stays', f.status === 200 && f.d.changed === 2 && mSt() === 'done,done,new', JSON.stringify([f, mSt()]));
    f = await fb({ action: 'meter-admin', op: 'notes-status', ids: mIds, status: 'seen', idToken: tOwner });
    expect('v89: …and seen', f.status === 200 && mSt() === 'seen,seen,seen', mSt());
    f = await fb({ action: 'meter-admin', op: 'notes-status', ids: mIds, status: 'gone', idToken: tOwner });
    expect('v89: …only new, seen or done', f.status === 400 && mSt() === 'seen,seen,seen', JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes-status', ids: Array.from({ length: 100 }, (_, i) => i + 1), status: 'done', idToken: tOwner });
    expect('v89: …at most 99 at once (with the status, D1\'s 100 values)', f.status === 400 && mSt() === 'seen,seen,seen', JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes-delete', ids: [], idToken: tOwner });
    expect('v88: …none named: refused', f.status === 400, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes-delete', ids: Array.from({ length: 101 }, (_, i) => i + 1), idToken: tOwner });
    expect('v88: …more than 100 at once: refused, nothing deleted', f.status === 400 && batchLeft().length === 1, JSON.stringify(f));
    // v64 — notes left in a copy's own database move to the inbox, as they were.
    const old = { uid: 'uOld', email: 'old@example.com', text: 'Left in the beta', at: 1759500000000, status: 'new', env: 'beta', shot: 'data:image/png;base64,AAAA' };
    f = await fb({ action: 'meter-admin', op: 'notes-import', project: 'my-kitchen-notes-beta', note: old, idToken: tA });
    expect('only the owner moves notes in', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes-import', project: 'my-kitchen-notes-beta', note: old, idToken: tOwner });
    const im = db.raw.prepare("SELECT * FROM feedback WHERE text = 'Left in the beta'").all();
    expect('a note left in the beta\'s database joins the inbox — its writer, time and copy kept', f.status === 200 && im.length === 1 && im[0].email === 'old@example.com' && im[0].project === 'my-kitchen-notes-beta' && im[0].at === 1759500000000 && im[0].status === 'new', JSON.stringify(im));
    f = await fb({ action: 'meter-admin', op: 'notes-import', project: 'my-kitchen-notes-beta', note: old, idToken: tOwner });
    expect('…and moved twice, it is kept once', f.status === 200 && f.d.already === true && db.raw.prepare("SELECT COUNT(*) AS n FROM feedback WHERE text = 'Left in the beta'").get().n === 1, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'notes-import', project: 'someone-elses-app', note: old, idToken: tOwner });
    expect('…only from a copy this server serves', f.status === 400, JSON.stringify(f));
    const hh2 = await (await worker.fetch(post({ action: 'health' }), envM)).json();
    expect('health says notes go here (so the app sends them)', hh2.feedback === true && hh2.notesImport === true, JSON.stringify(hh2));
    expect('v68: health says answers can be asked for', hh2.replies === true, JSON.stringify(hh2));
    // v62 — one Households page for every copy.
    expect('health says households may report themselves', hh2.reports === true, JSON.stringify(hh2.reports));
    const report = { name: 'ignored', members: [{ uid: 'uF', email: 'f@example.com', name: 'F', role: 'owner', lastSeen: 1759600000000, extra: 'x', termsAt: 1759700000000, termsVersion: '1.1' }],
                     links: [{ hid: 'hA', name: 'Kitchen A', code: 'MKN-AAAA-2222' }, { hid: 'bad id!', name: 'x' }], recipes: ['secret'] };
    f = await fb({ action: 'household-report', idToken: fam, hid: 'hF', report }, ORIGIN);
    expect('a member reports their household', f.status === 200 && f.d.ok === true, JSON.stringify(f));
    const rrow = db.raw.prepare("SELECT * FROM hh_reports WHERE hid = 'hF'").get();
    const rsum = rrow && JSON.parse(rrow.summary);
    expect('v65 — …with each member\'s agreement to the terms', rsum && rsum.members[0].termsAt === 1759700000000 && rsum.members[0].termsVersion === '1.1', JSON.stringify(rsum && rsum.members));
    expect('…kept under its copy, with only what the page shows', rrow && rrow.project === 'recipes-f379d' && rsum.members.length === 1 && rsum.members[0].extra === undefined
      && rsum.links.length === 1 && rsum.recipes === null && !/secret/.test(rrow.summary) && rsum.name === 'Kitchen A', JSON.stringify(rrow));
    // v76 — how many recipes: a number, never what they are.
    f = await fb({ action: 'household-report', idToken: fam, hid: 'hF', report: Object.assign({}, report, { recipes: 42 }) }, ORIGIN);
    expect('v76: …and how many recipes it holds, as a number', f.status === 200
      && JSON.parse(db.raw.prepare("SELECT summary FROM hh_reports WHERE hid = 'hF'").get().summary).recipes === 42);
    f = await fb({ action: 'household-report', idToken: tB, hid: 'hA', report });
    expect('someone not in the household cannot report it', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'household-report', idToken: tA.slice(0, -4) + 'AAAA', hid: 'hA', report });
    expect('…nor can a forged sign-in', f.status === 401, JSON.stringify(f));
    members['hR/uR'] = true;
    f = await fb({ action: 'household-report', idToken: await token({ sub: 'uR', aud: 'my-kitchen-notes-beta' }), hid: 'hR', report: { members: [] } });
    expect('a household that never used the AI reports too (the beta)', f.status === 200, JSON.stringify(f));
    members['hG/uR'] = true;
    const tR = await token({ sub: 'uR', aud: 'my-kitchen-notes-beta' });
    await fb({ action: 'household-report', idToken: tR, hid: 'hG', report: { members: [] } });
    db.raw.prepare("INSERT INTO ai_spend (project, hid, month, usd, calls) VALUES ('my-kitchen-notes-beta', 'hG', '2099-01', 1.5, 3)").run();
    members['hG/uV'] = 'viewer';
    f = await fb({ action: 'household-report', idToken: await token({ sub: 'uV', aud: 'my-kitchen-notes-beta' }), hid: 'hG', gone: true });
    expect('only its owner may say a household is deleted', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'household-report', idToken: await token({ sub: 'uV', aud: 'my-kitchen-notes-beta', email: 'v@example.com' }), hid: 'hG', left: true });
    const gl = JSON.parse(db.raw.prepare("SELECT summary FROM hh_reports WHERE hid = 'hG'").get().summary);
    expect('a member who deletes their account is noted under the household', f.status === 200 && gl.left.length === 1 && gl.left[0].email === 'v@example.com' && gl.left[0].at > 0, JSON.stringify(gl));
    await fb({ action: 'household-report', idToken: tR, hid: 'hG', report: { members: [] } });
    expect('…and stays noted after the next daily report', JSON.parse(db.raw.prepare("SELECT summary FROM hh_reports WHERE hid = 'hG'").get().summary).left.length === 1);
    f = await fb({ action: 'household-report', idToken: tR, hid: 'hG', gone: true, how: 'account' });
    const gs = JSON.parse((db.raw.prepare("SELECT summary FROM hh_reports WHERE hid = 'hG'").get() || {}).summary || '{}');
    expect('a household deleted by its owner STAYS listed, marked: who, when, how', f.status === 200 && gs.deletedAt > 0 && gs.deletedBy === 'a@example.com' && gs.deletedHow === 'account' && gs.name === 'Kitchen A', JSON.stringify(gs));
    expect('…but its spending stays (no member can reset an allowance that way)', !!db.raw.prepare("SELECT 1 FROM ai_spend WHERE hid = 'hG'").get());
    f = await fb({ action: 'meter-admin', op: 'list', all: true, idToken: fam }, ORIGIN);
    expect('nobody but the owner lists every copy', f.status === 403, JSON.stringify(f));
    const famOwner = await token({ sub: 'uO', aud: 'recipes-f379d', email: TEST_OWNER });
    f = await fb({ action: 'meter-admin', op: 'list', all: true, idToken: famOwner }, ORIGIN);
    const rows = (f.d && f.d.households) || [];
    const rowOf = (p, h) => rows.filter(x => x.project === p && x.hid === h)[0];
    expect('the owner, in the family app, lists every copy\'s households', f.status === 200 && rowOf('tonys-recipes-test', 'hA') && rowOf('recipes-f379d', 'hF') && rowOf('my-kitchen-notes-beta', 'hR'), JSON.stringify(rows.map(x => x.project + '/' + x.hid)));
    expect('…each with its copy\'s allowance (v67: the family\'s $10)', rowOf('tonys-recipes-test', 'hA').capNow === 5 && rowOf('recipes-f379d', 'hF').capNow === 10 /* v67 */ && rowOf('my-kitchen-notes-beta', 'hR').capped === true, JSON.stringify(rows).slice(0, 400));
    expect('…the counted ones with their months, the reported ones with their members', Math.abs(rowOf('recipes-f379d', 'hF').months[0].usd - 3.0) < 1e-9 /* $2.80 + v66's one Haiku call, $0.20 */ && rowOf('recipes-f379d', 'hF').report.members[0].email === 'f@example.com' && rowOf('my-kitchen-notes-beta', 'hR').name === 'Kitchen A', JSON.stringify(rowOf('recipes-f379d', 'hF')));
    f = await fb({ action: 'meter-admin', op: 'list', idToken: famOwner }, ORIGIN);
    expect('without `all`, only this copy (as before)', f.d.households.every(x => x.project === 'recipes-f379d'), JSON.stringify(f.d.households.map(x => x.project)));
    f = await fb({ action: 'meter-admin', op: 'set-cap', project: 'my-kitchen-notes-beta', hid: 'hR', cap: 7, idToken: famOwner }, ORIGIN);
    expect('the owner sets the beta\'s allowance from the family app', f.status === 200 && db.raw.prepare("SELECT cap FROM ai_households WHERE project = 'my-kitchen-notes-beta' AND hid = 'hR'").get().cap === 7, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'set-note', project: 'someone-elses-app', hid: 'hR', note: 'x', idToken: famOwner }, ORIGIN);
    expect('…but not a copy this server does not serve', f.status === 400, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'mark-deleted', project: 'recipes-f379d', hid: 'hF', idToken: famOwner }, ORIGIN);
    const fs2 = JSON.parse(db.raw.prepare("SELECT summary FROM hh_reports WHERE hid = 'hF'").get().summary);
    expect('a household the owner deletes stays listed, marked as his doing', f.status === 200 && fs2.deletedHow === 'admin' && fs2.deletedBy === TEST_OWNER && fs2.members.length === 1, JSON.stringify(fs2));
    expect('…and its spending stays', !!db.raw.prepare("SELECT 1 FROM ai_spend WHERE hid = 'hF'").get());
    f = await fb({ action: 'meter-admin', op: 'mark-deleted', project: 'recipes-f379d', hid: 'hNever', name: 'Old one', code: 'MKN-OOOO-7777', idToken: famOwner }, ORIGIN);
    const nv = JSON.parse(db.raw.prepare("SELECT summary FROM hh_reports WHERE hid = 'hNever'").get().summary);
    expect('…even one that never reported (named from the page)', nv.name === 'Old one' && nv.deletedAt > 0, JSON.stringify(nv));
    // v69 — what the testers' apps report: errors, and how often each feature was used.
    const hh3 = await (await worker.fetch(post({ action: 'health' }), envM)).json();
    expect('v69: health says the apps may report (so they send)', hh3.signals === true, JSON.stringify(hh3));
    const err1 = { kind: 'error', message: 'Cannot read properties of null (reading \'x\')', where: 'index.html:120', screen: 'viewOverlay', version: 'v38.15', env: 'test', device: 'UA', lang: 'he', at: Date.now() - 5000, n: 2 };
    f = await fb({ action: 'app-signals', idToken: tA, hid: 'hA', errors: [err1, { kind: 'error', message: '   ' }, 'nonsense'] });
    expect('v69: a signed-in tester\'s app reports an error (empty ones dropped)', f.status === 200 && f.d.errors === 1, JSON.stringify(f));
    f = await fb({ action: 'app-signals', idToken: tA, errors: [Object.assign({}, err1, { n: 1, screen: 'main', at: Date.now() })] });
    let er = db.raw.prepare('SELECT * FROM app_errors').all();
    expect('v69: …the same error again is one line, counted (2 + 1), with the latest screen', er.length === 1 && er[0].n === 3 && er[0].screen === 'main' && er[0].email === 'a@example.com'
      && er[0].project === 'tonys-recipes-test' && er[0].status === 'new' && er[0].last_at > er[0].first_at, JSON.stringify(er));
    f = await fb({ action: 'app-signals', idToken: tA, errors: [Object.assign({}, err1, { version: 'v38.16' })] });
    expect('v69: …a new version is a new line', db.raw.prepare('SELECT COUNT(*) AS n FROM app_errors').get().n === 2, JSON.stringify(f));
    f = await fb({ action: 'app-signals', idToken: tA.slice(0, -4) + 'AAAA', errors: [err1] });
    expect('v69: a forged sign-in reports nothing', f.status === 401, JSON.stringify(f));
    const nowMonth = new Date().toISOString().slice(0, 7);
    f = await fb({ action: 'app-signals', idToken: tA, hid: 'hA', usage: { month: nowMonth, counts: { 'added.link': 3, 'scale': 1, 'Bad Key!': 4, 'cook': -2, 'print': 1.5, 'open': 5000 } } });
    let uc = db.raw.prepare("SELECT k, n FROM usage_counts WHERE project = 'tonys-recipes-test' AND hid = 'hA' ORDER BY k").all();
    expect('v69: a member adds to their household\'s feature counts — names and numbers only, each at most 1000 a call',
      f.status === 200 && JSON.stringify(uc) === JSON.stringify([{ k: 'added.link', n: 3 }, { k: 'open', n: 1000 }, { k: 'scale', n: 1 }]), JSON.stringify(uc));
    await fb({ action: 'app-signals', idToken: tA, hid: 'hA', usage: { month: '1999-01', counts: { 'added.link': 2 } } });
    expect('v69: …which add up, under this month (not a month long gone)', db.raw.prepare("SELECT n FROM usage_counts WHERE hid = 'hA' AND k = 'added.link' AND month = ?").get(nowMonth).n === 5);
    f = await fb({ action: 'app-signals', idToken: tB, hid: 'hA', usage: { counts: { 'added.link': 50 } } });
    expect('v69: someone not in the household cannot add to its counts', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'app-signals', idToken: tA, usage: { counts: { 'scale': 1 } } });
    expect('v69: …nor counts with no household', f.status === 400, JSON.stringify(f));
    // v83 — Firestore reads, as the apps count them: added up per copy and Firebase's day, the owner warned at 70%.
    f = await fb({ action: 'app-signals', idToken: tA, reads: 300 });
    expect('v83: an app says how many documents it read — no household needed', f.status === 200 && f.d.reads === 300 && f.d.readsToday === 300, JSON.stringify(f));
    f = await fb({ action: 'app-signals', idToken: tB, reads: 500 });
    expect('v83: …every app of the copy adds to one count for the day', f.d.readsToday === 800, JSON.stringify(f));
    f = await fb({ action: 'app-signals', idToken: tA, reads: -5 });
    const f2 = await fb({ action: 'app-signals', idToken: tA, reads: 1.5 });
    expect('v83: …a nonsense count adds nothing', f.status === 200 && f.d.readsToday === undefined && f2.d.readsToday === undefined
      && db.raw.prepare("SELECT n FROM counters WHERE k LIKE 'fsreads:tonys-recipes-test:%'").get().n === 800, JSON.stringify([f, f2]));
    expect('v83: …no warning below 70%', !db.raw.prepare("SELECT 1 FROM allowance_notices WHERE what LIKE 'usage:firestoreReadsApps:%'").get());
    f = await fb({ action: 'app-signals', idToken: tA, reads: 999999 });
    expect('v83: …at most 20,000 from one call (a runaway or a forged count can only warn)', f.d.readsToday === 20800, JSON.stringify(f));
    f = await fb({ action: 'app-signals', idToken: tA, reads: 15000 });
    const fra = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:firestoreReadsApps:tonys-recipes-test'").get();
    expect('v83: at 70% of the 50,000 free reads the owner is warned, until midnight in California',
      f.d.readsToday === 35800 && fra && fra.kind === 'warning' && fra.scope === 'owner' && /72%/.test(fra.title) && /35,800 of 50,000/.test(fra.detail) && fra.until > Date.now(), JSON.stringify(fra));
    f = await fb({ action: 'meter-admin', op: 'allowances', idToken: famOwner }, ORIGIN);
    expect('v83: the owner\'s 🩺 page reads today\'s count, per copy', f.status === 200 && f.d.appReads && f.d.appReads.byProject['tonys-recipes-test'] === 35800
      && f.d.appReads.limit === 50000 && /^\d{4}-\d\d-\d\d$/.test(f.d.appReads.day), JSON.stringify(f.d && f.d.appReads));
    // v87 — the sign-in-link e-mails (Tony: "We are collecting stats about it, right?"): each counted per copy and day.
    f = await fb({ action: 'link-sent', project: 'nowhere' });
    expect('v87: a link is counted only for a copy this server serves', f.status === 400, JSON.stringify(f));
    const linkRows = () => db.raw.prepare("SELECT k, n FROM counters WHERE k LIKE 'links%:my-kitchen-notes-beta:%'").all();
    for (let i = 1; i <= 3; i++) { f = await fb({ action: 'link-sent', project: 'my-kitchen-notes-beta' }); }
    expect('v87: no sign-in needed (it comes before one); the day\'s count comes back', f.status === 200 && f.d.today === 3
      && !db.raw.prepare("SELECT 1 FROM allowance_notices WHERE what = 'usage:signinLinks:my-kitchen-notes-beta'").get(), JSON.stringify([f, linkRows()]));
    f = await fb({ action: 'link-sent', project: 'my-kitchen-notes-beta' });
    const lw = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:signinLinks:my-kitchen-notes-beta'").get();
    expect('v87: at 4 of 5 the owner is warned, until Firebase\'s midnight, in Israel time', f.d.today === 4 && lw && lw.kind === 'warning' && lw.scope === 'owner'
      && /4 of the 5/.test(lw.title) && /Israel time/.test(lw.detail) && !/UTC/.test(lw.detail), JSON.stringify(lw));
    await fb({ action: 'link-sent', project: 'my-kitchen-notes-beta' });
    await fb({ action: 'limit-report', what: 'auth-email', project: 'my-kitchen-notes-beta' });
    f = await fb({ action: 'meter-admin', op: 'allowances', idToken: famOwner }, ORIGIN);
    const lb = f.d && f.d.links && f.d.links.byProject['my-kitchen-notes-beta'];
    expect('v87: the owner\'s 🩺 page: today 5 of 5, the most in a day, days all 5 went, days someone was turned away',
      f.d.links.limit === 5 && lb && lb.today === 5 && lb.most === 5 && lb.full === 1 && lb.refused === 1 && lb.days === 1, JSON.stringify(f.d && f.d.links));
    db.raw.prepare("INSERT INTO counters (k, n, until) VALUES ('links:my-kitchen-notes-beta:2001-01-01', 5, ?)").run(Date.now() + 864e5);
    db.raw.prepare("UPDATE counters SET n = 50 WHERE k LIKE 'links:my-kitchen-notes-beta:2%' AND k NOT LIKE '%2001-01-01'").run();
    f = await fb({ action: 'link-sent', project: 'my-kitchen-notes-beta' });
    const f3 = await fb({ action: 'meter-admin', op: 'allowances', idToken: famOwner }, ORIGIN);
    expect('v87: a count stops at 50 a day (a forged one can only warn); days older than 30 are left out', f.d.today === 50
      && f3.d.links.byProject['my-kitchen-notes-beta'].full === 1 && f3.d.links.byProject['my-kitchen-notes-beta'].most === 50, JSON.stringify([f.d, f3.d.links]));
    // v76 — the trends: every copy's counts added up by month and name, for the owner only.
    db.raw.prepare("INSERT INTO usage_counts (project, hid, month, k, n) VALUES ('tonys-recipes-test', 'hT2', ?, 'added.link', 4), ('tonys-recipes-test', 'hOld', '2001-01', 'added.link', 9)").run(nowMonth);
    f = await fb({ action: 'meter-admin', op: 'trends', idToken: tA });
    expect('v76: only the owner reads the trends', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'trends', idToken: famOwner }, ORIGIN);
    const tl = (f.d.rows || []).filter(x => x.project === 'tonys-recipes-test' && x.month === nowMonth && x.k === 'added.link')[0];
    const tc = (f.d.counted || []).filter(x => x.project === 'tonys-recipes-test' && x.month === nowMonth)[0];
    expect('v76: the owner reads the counts added up by month and name, with how many households each came from',
      f.status === 200 && tl && tl.n === 9 && tl.households === 2 && tc && tc.households === 2, JSON.stringify(f.d));
    expect('v76: …the last 24 months, nothing older, and no household named', !(f.d.rows || []).some(x => x.month === '2001-01' || 'hid' in x), JSON.stringify(f.d.rows));
    const tZ = await token({ sub: 'uZ' });
    const ins = db.raw.prepare("INSERT INTO app_errors (project, uid, version, kind, message, place, first_at, last_at, n, status) VALUES ('tonys-recipes-test', 'uZ', 'v1', 'error', ?, '', ?, ?, 1, 'new')");
    for (let i = 0; i < 199; i++) ins.run('loop ' + i, Date.now(), Date.now());
    f = await fb({ action: 'app-signals', idToken: tZ, errors: [{ message: 'one more' }, { message: 'and another' }] });
    expect('v69: an app in a loop cannot fill the table (200 new lines a person a day)', f.status === 200 && f.d.errors === 1 && f.d.dropped === 1, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'errors', idToken: tA });
    expect('v69: only the owner reads the errors', f.status === 403, JSON.stringify(f));
    db.raw.prepare("UPDATE app_errors SET last_at = ? WHERE message = 'loop 0'").run(Date.now() - 200 * 864e5);
    f = await fb({ action: 'meter-admin', op: 'errors', idToken: famOwner }, ORIGIN);
    const mine = (f.d.errors || []).filter(x => x.uid === 'uA');
    expect('v69: the owner reads every copy\'s errors, newest first, with who and where', f.status === 200 && mine.length === 2 && mine[0].version === 'v38.15'
      && mine[0].n === 3 && mine[0].lang === 'he' && mine[0].last_at >= mine[1].last_at, JSON.stringify(mine));
    expect('v69: …and a report without a household keeps the one already known', mine[0].hid === 'hA', JSON.stringify(mine[0]));
    expect('v69: …and errors older than 120 days are gone', !db.raw.prepare("SELECT 1 FROM app_errors WHERE message = 'loop 0'").get());
    f = await fb({ action: 'meter-admin', op: 'errors-new', idToken: famOwner }, ORIGIN);
    const nNew = f.d.new;
    f = await fb({ action: 'meter-admin', op: 'error-status', id: mine[1].id, status: 'done', idToken: famOwner }, ORIGIN);
    expect('v69: the owner marks one done', f.status === 200 && db.raw.prepare('SELECT status FROM app_errors WHERE id = ?').get(mine[1].id).status === 'done', JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'errors-new', idToken: famOwner }, ORIGIN);
    expect('v69: …and the count of new ones goes down', f.d.new === nNew - 1, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'error-delete', id: mine[0].id, idToken: famOwner }, ORIGIN);
    expect('v69: …and removes one', f.status === 200 && !db.raw.prepare('SELECT 1 FROM app_errors WHERE id = ?').get(mine[0].id), JSON.stringify(f));
    // v88 — several error reports at once
    const ein = db.raw.prepare("INSERT INTO app_errors (project, uid, version, kind, message, place, first_at, last_at, n, status) VALUES ('tonys-recipes-test', 'uQ', 'v1', 'error', ?, '', ?, ?, 1, 'new')");
    const eIds = ['batch e1', 'batch e2', 'batch e3'].map(m => Number(ein.run(m, Date.now(), Date.now()).lastInsertRowid));
    const errLeft = () => db.raw.prepare("SELECT id FROM app_errors WHERE message LIKE 'batch e%' ORDER BY id").all().map(x => x.id);
    f = await fb({ action: 'meter-admin', op: 'errors-delete', ids: eIds.slice(0, 2), idToken: tA });
    expect('v88: only the owner deletes several error reports', f.status === 403 && errLeft().length === 3, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'errors-delete', ids: eIds.slice(0, 2), idToken: famOwner }, ORIGIN);
    expect('v88: the owner deletes several error reports in one go; the others stay', f.status === 200 && f.d.deleted === 2 && errLeft().join() === String(eIds[2]), JSON.stringify([f, errLeft()]));
    // v89 — several marked done at once
    const e4 = ['batch e4', 'batch e5'].map(m => Number(ein.run(m, Date.now(), Date.now()).lastInsertRowid));
    const eSt = () => db.raw.prepare("SELECT status FROM app_errors WHERE message IN ('batch e4', 'batch e5') ORDER BY id").all().map(x => x.status).join();
    f = await fb({ action: 'meter-admin', op: 'errors-status', ids: e4, status: 'done', idToken: tA });
    expect('v89: only the owner marks several errors', f.status === 403 && eSt() === 'new,new', JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'errors-status', ids: e4, status: 'done', idToken: famOwner }, ORIGIN);
    expect('v89: the owner marks several errors done in one go', f.status === 200 && f.d.changed === 2 && eSt() === 'done,done', JSON.stringify([f, eSt()]));
    f = await fb({ action: 'meter-admin', op: 'errors-status', ids: e4, status: 'seen', idToken: famOwner }, ORIGIN);
    expect('v89: …only new or done for an error', f.status === 400 && eSt() === 'done,done', JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'list', all: true, idToken: famOwner }, ORIGIN);
    const hAu = ((f.d.households || []).filter(x => x.project === 'tonys-recipes-test' && x.hid === 'hA')[0] || {}).usage;
    expect('v69: the Households list carries each household\'s feature counts by month', hAu && hAu[nowMonth] && hAu[nowMonth]['added.link'] === 5 && hAu[nowMonth].scale === 1, JSON.stringify(hAu));
    // v71 — the end-of-beta question: asked only once the owner opens it.
    const hh4 = await (await worker.fetch(post({ action: 'health' }), envM)).json();
    expect('v71: health says the question can be asked', hh4.survey === true, JSON.stringify(hh4));
    f = await fb({ action: 'survey-status', idToken: tA });
    expect('v71: nothing is asked until the owner opens it', f.status === 200 && f.d.survey === null, JSON.stringify(f));
    f = await fb({ action: 'survey-answer', idToken: tA, survey: 'end-of-beta-1', answers: { keep: 'yes' } });
    expect('v71: …and nothing can be answered then', f.status === 409, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'survey-open', project: 'tonys-recipes-test', survey: 'end-of-beta-1', idToken: tA });
    expect('v71: only the owner opens it', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'survey-open', project: 'tonys-recipes-test', survey: 'end-of-beta-1', idToken: famOwner }, ORIGIN);
    expect('v71: the owner opens it for the test copy from the family app', f.status === 200 && f.d.ok === true, JSON.stringify(f));
    f = await fb({ action: 'survey-status', idToken: tA });
    expect('v71: a tester\'s app sees it, unanswered', f.d.survey && f.d.survey.id === 'end-of-beta-1' && f.d.answered === false, JSON.stringify(f));
    f = await fb({ action: 'survey-status', idToken: fam }, ORIGIN);
    expect('v71: …and the family app does not (it was opened for the test copy)', f.d.survey === null, JSON.stringify(f));
    f = await fb({ action: 'survey-answer', idToken: tA, survey: 'end-of-beta-1', hid: 'hA', household: 'Kitchen A', lang: 'he', version: 'v38.18',
      answers: { keep: 'probably', change: 'Faster imports', price: '1-3', other: '' } });
    expect('v71: a tester answers', f.status === 200 && f.d.ok === true, JSON.stringify(f));
    f = await fb({ action: 'survey-answer', idToken: tA, survey: 'end-of-beta-1', answers: { keep: 'yes', change: 'Faster imports, please', price: 'bogus' } });
    let sa = db.raw.prepare("SELECT * FROM survey_answers WHERE uid = 'uA'").all();
    expect('v71: …a second answer replaces the first (one per person), and a choice not on the list is not kept',
      sa.length === 1 && sa[0].keep === 'yes' && sa[0].change === 'Faster imports, please' && sa[0].price === '' && sa[0].email === 'a@example.com', JSON.stringify(sa));
    f = await fb({ action: 'survey-answer', idToken: tB, survey: 'end-of-beta-1', answers: {} });
    expect('v71: an empty answer is refused', f.status === 400, JSON.stringify(f));
    f = await fb({ action: 'survey-status', idToken: tA });
    expect('v71: answered, it is not asked again', f.d.answered === true, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'survey-list', idToken: famOwner }, ORIGIN);
    expect('v71: the owner reads every survey and its answers', f.status === 200 && f.d.surveys.length === 1 && f.d.answers.length === 1 && f.d.answers[0].change === 'Faster imports, please'
      && f.d.choices.keep.length === 5, JSON.stringify(f.d));
    f = await fb({ action: 'meter-admin', op: 'survey-close', project: 'tonys-recipes-test', survey: 'end-of-beta-1', idToken: famOwner }, ORIGIN);
    f = await fb({ action: 'survey-status', idToken: tB });
    expect('v71: closed, nobody is asked', f.d.survey === null, JSON.stringify(f));
    f = await fb({ action: 'survey-answer', idToken: tB, survey: 'end-of-beta-1', answers: { keep: 'no' } });
    expect('v71: …and late answers are refused', f.status === 409, JSON.stringify(f));
    // v72 — the family moves into the community copy: its allowances and history come too.
    db.raw.prepare("INSERT INTO ai_households (project, hid, name, code, created_at, first_seen, last_seen, cap, note) VALUES ('recipes-f379d', 'hFam', 'Fam', 'MKN-FFFF-FFFF', 1, 1, 2, NULL, 'the family')").run();
    db.raw.prepare("INSERT INTO ai_households (project, hid, name, code, created_at, first_seen, last_seen, cap, note) VALUES ('recipes-f379d', 'hFam2', 'Fam2', 'MKN-GGGG-GGGG', 1, 1, 2, 4.5, NULL)").run();
    db.raw.prepare("INSERT INTO ai_spend (project, hid, month, usd, calls) VALUES ('recipes-f379d', 'hFam', '2026-09', 3.25, 40)").run();
    db.raw.prepare("INSERT INTO hh_reports (project, hid, summary, at) VALUES ('recipes-f379d', 'hFam', '{\"name\":\"Fam\"}', 5)").run();
    const comOwner = await token({ sub: 'uO2', email: TEST_OWNER });
    f = await fb({ action: 'meter-admin', op: 'copy-from', from: 'recipes-f379d', idToken: tA });
    expect('v72: only the owner brings another copy\'s households over', f.status === 403, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'copy-from', from: 'tonys-recipes-test', idToken: comOwner });
    expect('v72: …from another copy, not its own', f.status === 400, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'copy-from', from: 'recipes-f379d', idToken: comOwner });
    const famRow = db.raw.prepare("SELECT * FROM ai_households WHERE project = 'tonys-recipes-test' AND hid = 'hFam'").get();
    const famRow2 = db.raw.prepare("SELECT cap FROM ai_households WHERE project = 'tonys-recipes-test' AND hid = 'hFam2'").get();
    expect('v72: the family\'s households, their spending and reports come over', f.status === 200 && f.d.copied.households >= 2 && f.d.copied.households === f.d.of && f.d.copied.months >= 1 && f.d.copied.reports >= 1
      && famRow && famRow.note === 'the family' && famRow.code === 'MKN-FFFF-FFFF'
      && db.raw.prepare("SELECT usd FROM ai_spend WHERE project = 'tonys-recipes-test' AND hid = 'hFam' AND month = '2026-09'").get().usd === 3.25, JSON.stringify(f));
    expect('v72: …a household with no allowance of its own keeps the family\'s $10; one with its own keeps that', famRow.cap === 10 && famRow2.cap === 4.5, JSON.stringify([famRow, famRow2]));
    f = await fb({ action: 'meter-admin', op: 'copy-from', from: 'recipes-f379d', idToken: comOwner });
    expect('v72: …a second time nothing is copied again (and nothing overwritten)', f.status === 200 && f.d.copied.households === 0 && f.d.copied.months === 0, JSON.stringify(f));
    expect('v72: …and the family\'s own rows stay', !!db.raw.prepare("SELECT 1 FROM ai_spend WHERE project = 'recipes-f379d' AND hid = 'hFam'").get());
    // v73 — the owner's powers, protected.
    const nowS = Math.floor(Date.now() / 1000);
    const ownerLink = await token({ sub: 'uO2', email: TEST_OWNER, firebase: { sign_in_provider: 'emailLink' } });
    const ownerPw = await token({ sub: 'uO2', email: TEST_OWNER, firebase: { sign_in_provider: 'password' } });
    const ownerOld = await token({ sub: 'uO2', email: TEST_OWNER, auth_time: nowS - 3600 });
    const owner2f = await token({ sub: 'uO2', email: TEST_OWNER, firebase: { sign_in_provider: 'google.com', sign_in_second_factor: 'totp' } });
    f = await fb({ action: 'meter-admin', op: 'list', idToken: ownerLink });
    expect('v73: signed in by an e-mail link, the owner\'s address opens none of his tools', f.status === 403 && f.d.needGoogle === true, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'list', idToken: ownerPw });
    expect('v73: …nor with a password', f.status === 403 && f.d.needGoogle === true, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'list', idToken: comOwner });
    expect('v73: with Google they open', f.status === 200, JSON.stringify(f).slice(0, 200));
    f = await fb({ action: 'meter-admin', op: 'list', idToken: ownerOld });
    expect('v73: an hour after signing in he still reads', f.status === 200, JSON.stringify(f).slice(0, 200));
    f = await fb({ action: 'meter-admin', op: 'set-cap', hid: 'hA', cap: 3, idToken: ownerOld });
    expect('v73: …but what cannot be undone asks him to sign in again', f.status === 401 && f.d.reauth === true, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'set-cap', hid: 'hA', cap: 3, idToken: comOwner });
    expect('v73: …and just signed in, it is done', f.status === 200, JSON.stringify(f));
    security['tonys-recipes-test'] = true;
    f = await fb({ action: 'meter-admin', op: 'list', idToken: comOwner });
    expect('v73: once he switched the authenticator on, Google alone is not enough', f.status === 403 && f.d.needTwoStep === true, JSON.stringify(f));
    f = await fb({ action: 'meter-admin', op: 'list', idToken: owner2f });
    expect('v73: …Google with the authenticator is', f.status === 200, JSON.stringify(f).slice(0, 200));
    security['tonys-recipes-test'] = 'fail';
    let asksBefore = firestoreAsks.length;
    f = await fb({ action: 'meter-admin', op: 'list', idToken: owner2f });
    expect('v96: signed in with the authenticator, he is let in without the switch being read (on or off, it passes)',
      f.status === 200 && !firestoreAsks.slice(asksBefore).some(a => /config\/security$/.test(a.url)), JSON.stringify(f).slice(0, 200));
    f = await fb({ action: 'meter-admin', op: 'list', idToken: comOwner });
    expect('v96: the switch unreadable: the setting read last ("on") still asks Google alone for the code', f.status === 403 && f.d.needTwoStep === true, JSON.stringify(f));
    const keptRow = db.raw.prepare("SELECT v FROM owner_prefs WHERE k = 'two_step:tonys-recipes-test'").get();
    expect('v96: …it was kept in D1 when it was read', keptRow && JSON.parse(keptRow.v).on === true, JSON.stringify(keptRow));
    db.raw.prepare("DELETE FROM owner_prefs WHERE k = 'two_step:tonys-recipes-test'").run();
    f = await fb({ action: 'meter-admin', op: 'list', idToken: comOwner });
    expect('v73: if the switch cannot be read and nothing was kept, the tools stay shut (never "off" by mistake)', f.status === 502, JSON.stringify(f));
    // v96 — a read the database never answers: asked twice, then the kept setting decides.
    security['tonys-recipes-test'] = false;
    f = await fb({ action: 'meter-admin', op: 'list', idToken: comOwner });
    expect('v96: switched off and read: Google alone opens the tools', f.status === 200, JSON.stringify(f).slice(0, 200));
    const fetchWas = globalThis.fetch;
    let hung = 0;
    globalThis.fetch = async (url, init) => {
      if (/\/config\/security$/.test(String(url))) { hung++; throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); }
      return fetchWas(url, init);
    };
    try {
      f = await fb({ action: 'meter-admin', op: 'list', idToken: comOwner });
      expect('v96: the database does not answer: asked twice, and the setting read a moment ago ("off") decides', f.status === 200 && hung === 2, hung + ' ' + JSON.stringify(f).slice(0, 200));
      db.raw.prepare("UPDATE owner_prefs SET v = ?1 WHERE k = 'two_step:tonys-recipes-test'").run(JSON.stringify({ on: false, at: Date.now() - 31 * 864e5 }));
      f = await fb({ action: 'meter-admin', op: 'list', idToken: comOwner });
      expect('v96: …but an "off" not read for a month does not', f.status === 502 && /timeout/.test(f.d.error), JSON.stringify(f));
    } finally { globalThis.fetch = fetchWas; }
    db.raw.prepare("DELETE FROM owner_prefs WHERE k = 'two_step:tonys-recipes-test'").run();
    delete security['tonys-recipes-test'];
    // …and he hears about it.
    const mails = [];
    class FakeEmail { constructor(from, to, raw) { this.from = from; this.to = to; this.raw = raw; } }
    const envAlert = Object.assign({}, envM, { ALERTS: { send: async m => { mails.push(m); } }, ALERT_TO: 'second@example.com', __EmailMessage: FakeEmail });
    const fa = async (body) => { const rr = await worker.fetch(post(body, TEST_ORIGIN), envAlert); let dd = null; try { dd = await rr.json(); } catch (e) {} return { status: rr.status, d: dd }; };
    const hh5 = await (await worker.fetch(post({ action: 'health' }), envAlert)).json();
    expect('v73: health says the alerts are set up', hh5.alerts === true && (await (await worker.fetch(post({ action: 'health' }), envM)).json()).alerts === false, JSON.stringify(hh5));
    f = await fa({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-AAAA1111' });
    expect('v73: the owner\'s tools on a new device: an e-mail to his second address', f.status === 200 && mails.length === 1 && mails[0].to === 'second@example.com'
      && /new device/.test(mails[0].raw) && /^From: My Kitchen Notes <alerts@mykitchennotes\.community>/m.test(mails[0].raw) && /Copy: tonys-recipes-test/.test(mails[0].raw), JSON.stringify(mails.map(m => m.raw.slice(0, 300))));
    f = await fa({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-AAAA1111' });
    expect('v73: …the same device again: nothing', mails.length === 1, String(mails.length));
    f = await fa({ action: 'meter-admin', op: 'set-cap', hid: 'hA', cap: 2, idToken: comOwner, device: 'dev-AAAA1111' });
    expect('v73: …and every action that cannot be undone is told', f.status === 200 && mails.length === 2 && /owner action "set-cap"/.test(mails[1].raw) && /household hA/.test(mails[1].raw), JSON.stringify(mails.map(m => m.raw.slice(0, 200))));
    f = await fa({ action: 'meter-admin', op: 'list', idToken: tA, device: 'dev-BBBB2222' });
    expect('v73: …someone who is not the owner: refused, and no e-mail', f.status === 403 && mails.length === 2, String(mails.length));
    f = await fa({ action: 'meter-admin', op: 'errors-delete', ids: [999991, 999992, 999993], idToken: comOwner, device: 'dev-AAAA1111' });
    expect('v88: deleting several at once is told ONCE, with how many', f.status === 200 && mails.length === 3 && /owner action "errors-delete"/.test(mails[2].raw)
      && /\(3 of them\)/.test(mails[2].raw), JSON.stringify(mails.map(m => m.raw.slice(0, 240))));
    // v75 — a spare owner key: two owner addresses; the alerts go to every alert address, and one refused
    // address does not stop the others.
    const spare = await token({ sub: 'uSpare', email: 'spare@worker-test.example' });
    const env2 = Object.assign({}, envAlert, { OWNER_EMAIL: TEST_OWNER + ', spare@worker-test.example', ALERT_TO: 'second@example.com, bad@example.com,owner@worker-test.example',
      ALERTS: { send: async m => { if (m.to === 'bad@example.com') throw new Error('destination address not verified'); mails.push(m); } } });
    const mailsBefore = mails.length;
    const rs = await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: spare, device: 'dev-CCCC3333' }, TEST_ORIGIN), env2);
    const toNow = mails.slice(mailsBefore).map(m => m.to).sort().join(',');
    expect('v75: the spare owner account is an owner too', rs.status === 200, 'status ' + rs.status);
    expect('v75: …and its first use is told to every alert address (a refused one does not stop the rest)',
      toNow === 'owner@worker-test.example,second@example.com' && /Account: spare@worker-test\.example/.test(mails[mails.length - 1].raw), toNow);
    // v84 — and on WhatsApp, through CallMeBot, when the number and its key are set.
    const wa = [];
    const envWa = Object.assign({}, envAlert, { WHATSAPP_PHONE: '+972 50-000-0000', WHATSAPP_KEY: 'k123',
      __fetch: async (url) => { wa.push(String(url)); return new Response('Message queued. You will receive it in a few seconds.', { status: 200 }); } });
    const mailsBeforeWa = mails.length;
    await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa);
    const u = wa[0] ? new URL(wa[0]) : null;
    expect('v84: an owner alert goes on WhatsApp too (CallMeBot: the number, the message, the key)', wa.length === 1 && u && u.host === 'api.callmebot.com'
      && u.searchParams.get('phone') === '+972500000000' && u.searchParams.get('apikey') === 'k123' && /new device/.test(u.searchParams.get('text') || '')
      && mails.length === mailsBeforeWa + 1, JSON.stringify([wa, mails.length - mailsBeforeWa]));
    wa.length = 0;
    await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-EEEE5555' }, TEST_ORIGIN), envAlert);
    expect('v84: …and not without them', wa.length === 0, String(wa.length));
    f = await (async () => { const rr = await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: tA }, TEST_ORIGIN), envWa); return { status: rr.status }; })();
    expect('v84: only the owner sends a test alert', f.status === 403 && wa.length === 0, JSON.stringify(f));
    const mailsBeforeT = mails.length;
    let ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa)).json();
    expect('v84: the owner\'s test alert reaches WhatsApp once and e-mail once', ta.ok === true && ta.whatsapp === true && ta.whatsappSet === true && ta.mail === true
      && wa.length === 1 && /test/.test(new URL(wa[0]).searchParams.get('text')) && mails.length === mailsBeforeT + 1 && /a test alert/.test(mails[mails.length - 1].raw), JSON.stringify([ta, wa.length, mails.length - mailsBeforeT]));
    const again = await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa);
    expect('v84: …once a minute', again.status === 429, 'got ' + again.status);
    const envBadKey = Object.assign({}, envWa, { __fetch: async () => new Response('APIKey is invalid. Please check it', { status: 200 }) });
    const realNowWa = Date.now; Date.now = () => realNowWa() + 120e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envBadKey)).json(); }
    finally { Date.now = realNowWa; }
    expect('v84: …and says so when CallMeBot refuses the key', ta.ok === true && ta.whatsapp === false && ta.whatsappSet === true, JSON.stringify(ta));
    // v91 — ntfy: the title and first line only, addresses masked, and the test alert says whether it went
    const nposts = [];
    const envNt = Object.assign({}, envAlert, { NTFY_TOPIC: 'Kitchen-test-123', __fetch: async (url, init) => { nposts.push({ u: String(url), b: JSON.parse(init.body) }); return new Response('{"id":"x"}', { status: 200 }); } });
    Date.now = () => realNowWa() + 240e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envNt)).json(); }
    finally { Date.now = realNowWa; }
    expect('v91: the test alert rings in ntfy (the topic, a title, the first line)', ta.ntfy === true && ta.ntfySet === true && nposts.length >= 1
      && nposts[0].u === 'https://ntfy.sh/' && nposts[0].b.topic === 'Kitchen-test-123' && /test alert/i.test(nposts[0].b.title) && /details are in your e-mail/.test(nposts[0].b.message), JSON.stringify([ta, nposts[0]]));
    nposts.length = 0;
    await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-HHHH8888' }, TEST_ORIGIN), envNt);
    expect('v91: …an owner alert too, with no e-mail address in it', nposts.length === 1 && !/@/.test(JSON.stringify(nposts[0].b)), JSON.stringify(nposts));
    nposts.length = 0;
    await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-IIII9999' }, TEST_ORIGIN), Object.assign({}, envNt, { NTFY_TOPIC: 'bad topic/../x' }));
    expect('v91: …and nothing to a malformed topic', nposts.length === 0, String(nposts.length));
    // v92 — a whole link is taken as the topic; a refusal says why, never the topic
    nposts.length = 0;
    Date.now = () => realNowWa() + 360e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN),
      Object.assign({}, envNt, { NTFY_TOPIC: ' https://ntfy.sh/Kitchen-test-123 ' }))).json(); }
    finally { Date.now = realNowWa; }
    expect('v92: the topic saved as a whole link still rings', ta.ntfy === true && nposts.length >= 1 && nposts[0].b.topic === 'Kitchen-test-123', JSON.stringify([ta, nposts[0] && nposts[0].b.topic]));
    const mailsBeforeWhy = mails.length;
    Date.now = () => realNowWa() + 480e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN),
      Object.assign({}, envNt, { __fetch: async () => new Response('{"code":42901,"http":429,"error":"limit reached for Kitchen-test-123"}', { status: 429 }) }))).json(); }
    finally { Date.now = realNowWa; }
    const whyMail = mails.slice(mailsBeforeWhy).map(m => m.raw).join('');
    expect('v92: …a refusal says why (ntfy\'s status and words), on screen and in the e-mail, never the topic', ta.ntfy === false && /ntfy answered 429/.test(ta.ntfyWhy || '')
      && !/Kitchen-test-123/.test(ta.ntfyWhy) && /NOT delivered/.test(whyMail) && !/Kitchen-test-123/.test(whyMail), JSON.stringify([ta, whyMail.slice(-300)]));
    Date.now = () => realNowWa() + 600e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN),
      Object.assign({}, envNt, { NTFY_TOPIC: 'My Kitchen Alerts' }))).json(); }
    finally { Date.now = realNowWa; }
    expect('v92: …and a topic ntfy does not take is named as such', ta.ntfy === false && /has a space/.test(ta.ntfyWhy || ''), JSON.stringify(ta));
    // v93 — with NTFY_TOKEN: sent with it; a 429 without one says what to do
    let auth = '';
    Date.now = () => realNowWa() + 720e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN),
      Object.assign({}, envNt, { NTFY_TOKEN: 'tk_test123', __fetch: async (u, init) => { auth = (init.headers || {}).Authorization || ''; return new Response('{"id":"x"}', { status: 200 }); } }))).json(); }
    finally { Date.now = realNowWa; }
    expect('v93: with NTFY_TOKEN the message goes with the account\'s token', ta.ntfy === true && ta.ntfyToken === true && auth === 'Bearer tk_test123', JSON.stringify([ta, auth]));
    Date.now = () => realNowWa() + 840e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN),
      Object.assign({}, envNt, { __fetch: async () => new Response('{"code":42908,"http":429,"error":"limit reached: daily message quota reached; increase your limits with a paid plan, see https://ntfy.sh","link":"https://ntfy.sh/docs/publish/#limitations"}', { status: 429 }) }))).json(); }
    finally { Date.now = realNowWa; }
    expect('v93: …and the shared address\'s quota says what it is (v94: a paid plan, not a free token)', /answered 429: limit reached: daily message quota reached/.test(ta.ntfyWhy || '')
      && /paid ntfy plan/.test(ta.ntfyWhy) && !/"code"/.test(ta.ntfyWhy), JSON.stringify(ta));
    // v95 — Pushover, when its two secrets are set: it rings instead of ntfy; addresses masked; a refusal says why
    const pposts = [];
    const envPo = Object.assign({}, envAlert, { NTFY_TOPIC: 'Kitchen-test-123', PUSHOVER_TOKEN: 'aTok123', PUSHOVER_USER: 'uKey456',
      __fetch: async (url, init) => { pposts.push({ u: String(url), b: String(init.body) }); return new Response('{"status":1}', { status: 200 }); } });
    Date.now = () => realNowWa() + 960e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envPo)).json(); }
    finally { Date.now = realNowWa; }
    const pb = pposts[0] ? new URLSearchParams(pposts[0].b) : null;
    expect('v95: with Pushover set, the test alert rings there (its key, the user key, a title), not in ntfy', ta.pushover === true && ta.pushoverSet === true
      && pposts.length === 1 && pposts[0].u === 'https://api.pushover.net/1/messages.json' && pb.get('token') === 'aTok123' && pb.get('user') === 'uKey456'
      && /test alert/i.test(pb.get('title')), JSON.stringify([ta, pposts]));
    pposts.length = 0;
    await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-JJJJ1111' }, TEST_ORIGIN), envPo);
    expect('v95: …an owner alert too, with no e-mail address in it', pposts.length === 1 && !/@/.test(decodeURIComponent(pposts[0].b)), JSON.stringify(pposts));
    Date.now = () => realNowWa() + 1080e3;
    try { ta = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-test', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN),
      Object.assign({}, envPo, { __fetch: async () => new Response('{"user":"invalid","errors":["user identifier is not a valid user, group, or subscribed user key"],"status":0}', { status: 400 }) }))).json(); }
    finally { Date.now = realNowWa; }
    expect('v95: …and a refusal says why, never the keys', ta.pushover === false && /Pushover answered 400: user identifier is not a valid/.test(ta.pushoverWhy || '')
      && /PUSHOVER_USER/.test(ta.pushoverWhy) && !/uKey456|aTok123/.test(ta.pushoverWhy), JSON.stringify(ta));
    // v85 — each kind of alert on WhatsApp, or not: all on by default, e-mail never affected.
    let ap = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-prefs', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa)).json();
    expect('v85: eight kinds of alert, all on WhatsApp by default', ap.ok === true && ap.kinds.length === 8 && ap.kinds.every(k => k.on === true) && ap.whatsappSet === true
      && ap.kinds.map(k => k.key).join() === 'new-device,owner-action,near-limit,limit-reached,ai-service,household-ai,server-errors,usage-check', JSON.stringify(ap));
    const apNo = await worker.fetch(post({ action: 'meter-admin', op: 'alert-prefs', idToken: tA }, TEST_ORIGIN), envWa);
    expect('v85: …only the owner reads or sets them', apNo.status === 403, 'got ' + apNo.status);
    ap = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-prefs-set', prefs: { 'new-device': false, 'owner-action': true, bogus: false }, idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa)).json();
    expect('v85: the owner switches one off (an unknown name is ignored)', ap.ok === true && ap.kinds.filter(k => !k.on).map(k => k.key).join() === 'new-device', JSON.stringify(ap));
    wa.length = 0; const mailsBeforeOff = mails.length;
    await worker.fetch(post({ action: 'meter-admin', op: 'list', idToken: comOwner, device: 'dev-FFFF6666' }, TEST_ORIGIN), envWa);
    expect('v85: …a new device is then e-mailed, not sent on WhatsApp — in Israel time', wa.length === 0 && mails.length === mailsBeforeOff + 1
      && /When: [^\n]*\(Israel time\)/.test(mails[mails.length - 1].raw) && !/When: [^\n]*GMT/.test(mails[mails.length - 1].raw), JSON.stringify([wa.length, mails.length - mailsBeforeOff, (mails[mails.length - 1].raw.match(/When: [^\n]*/) || [])[0]]));
    await worker.fetch(post({ action: 'meter-admin', op: 'set-cap', hid: 'hA', cap: 3, idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa);
    expect('v85: …while an owner action (still on) goes on WhatsApp too', wa.length === 1 && /owner action/.test(new URL(wa[0]).searchParams.get('text')), JSON.stringify(wa));
    await worker.fetch(post({ action: 'meter-admin', op: 'alert-prefs-set', prefs: {}, idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa);
    ap = await (await worker.fetch(post({ action: 'meter-admin', op: 'alert-prefs', idToken: comOwner, device: 'dev-DDDD4444' }, TEST_ORIGIN), envWa)).json();
    expect('v85: …and back on', ap.kinds.every(k => k.on), JSON.stringify(ap.kinds));
  } finally { globalThis.fetch = realFetch; }
}

// v75 — the daily sweep: logs and names go after six months; notes, replies and statistics stay.
{
  console.log('Logs go, correspondence and statistics stay (v75)');
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, args) => ({ bind: (...a) => stmt(sql, a),
    all: async () => ({ results: raw.prepare(sql).all(...(args || [])) }),
    run: async () => { const x = raw.prepare(sql).run(...(args || [])); return { success: true, meta: { changes: Number(x.changes) } }; } });
  const d1 = { prepare: (sql) => stmt(sql, []) };
  const now = Date.UTC(2026, 9, 13, 12), old = now - 200 * 864e5, recent = now - 10 * 864e5;
  const mOld = new Date(old).toISOString().slice(0, 7), mNew = new Date(recent).toISOString().slice(0, 7);
  raw.exec(`CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, text TEXT, log TEXT, at INTEGER);
    CREATE TABLE feedback_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, note_id INTEGER, text TEXT, at INTEGER);
    CREATE TABLE survey_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, at INTEGER);
    CREATE TABLE app_errors (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, last_at INTEGER);
    CREATE TABLE owner_devices (email TEXT, device TEXT, last_at INTEGER);
    CREATE TABLE ai_spend (project TEXT, hid TEXT, month TEXT, usd REAL);
    CREATE TABLE usage_counts (project TEXT, hid TEXT, month TEXT, k TEXT, n INTEGER);
    CREATE TABLE ai_households (project TEXT, hid TEXT, name TEXT, code TEXT, note TEXT, cap REAL);
    CREATE TABLE hh_reports (project TEXT, hid TEXT, summary TEXT, at INTEGER);`);
  raw.prepare('INSERT INTO feedback (id, email, text, log, at) VALUES (1, ?, ?, ?, ?), (2, ?, ?, ?, ?)').run('a@example.com', 'old note', 'old log', old, 'b@example.com', 'new note', 'new log', recent);
  raw.prepare('INSERT INTO feedback_replies (note_id, text, at) VALUES (1, ?, ?), (2, ?, ?), (99, ?, ?)').run('answer to the old note', old, 'answer to the new', recent, 'answer to a note since deleted', old);
  raw.prepare('INSERT INTO survey_answers (email, at) VALUES (?, ?), (?, ?)').run('a@example.com', old, 'b@example.com', recent);
  raw.prepare('INSERT INTO app_errors (message, last_at) VALUES (?, ?), (?, ?)').run('old error', now - 130 * 864e5, 'new error', recent);
  raw.prepare('INSERT INTO owner_devices VALUES (?, ?, ?), (?, ?, ?)').run('o@example.com', 'old-device', old, 'o@example.com', 'new-device', recent);
  raw.prepare('INSERT INTO ai_spend VALUES (?, ?, ?, 1), (?, ?, ?, 1), (?, ?, ?, 1)').run('p', 'live', mOld, 'p', 'live', mNew, 'p', 'gone', mOld);
  raw.prepare('INSERT INTO usage_counts VALUES (?, ?, ?, ?, 1), (?, ?, ?, ?, 1), (?, ?, ?, ?, 1)').run('p', 'live', mOld, 'open', 'p', 'live', mNew, 'open', 'p', 'gone', mOld, 'open');
  raw.prepare('INSERT INTO ai_households VALUES (?, ?, ?, ?, ?, 5), (?, ?, ?, ?, ?, 2)').run('p', 'gone', 'Gone Kitchen', 'GONE1', 'the Smiths', 'p', 'live', 'Live Kitchen', 'LIVE1', 'friends');
  raw.prepare('INSERT INTO hh_reports VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)').run(
    'p', 'gone', JSON.stringify({ name: 'Gone Kitchen', code: 'GONE1', createdAt: old - 864e5, referredBy: 'LIVE1', deletedAt: old, deletedBy: 'g@example.com', deletedHow: 'household',
      members: [{ uid: 'u1', email: 'g@example.com', name: 'G', role: 'owner', joinedAt: old - 864e5, lastSeen: old }, { uid: 'u2', email: 'h@example.com', name: 'H', role: 'member', joinedAt: old, lastSeen: old }],
      links: [{ hid: 'live', name: 'Live Kitchen', code: 'LIVE1' }] }), old,
    'p', 'justgone', JSON.stringify({ name: 'Just Gone', deletedAt: recent, deletedBy: 'j@example.com', members: [{ email: 'j@example.com', role: 'owner' }] }), recent,
    'p', 'quiet', JSON.stringify({ name: 'Quiet Kitchen', members: [{ email: 'q@example.com', role: 'owner' }] }), old,
    'p', 'live', JSON.stringify({ name: 'Live Kitchen', members: [{ email: 'l@example.com', role: 'owner' }], left: [{ email: 'x@example.com', at: old, how: 'account' }, { email: 'y@example.com', at: recent, how: 'account' }] }), recent);
  const waits = [];
  await worker.scheduled({ cron: '23 3 * * *', scheduledTime: now }, { METER_DB: d1 }, { waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  const q = (sql) => raw.prepare(sql).all();
  const dump = JSON.stringify(q('SELECT summary FROM hh_reports')) + JSON.stringify(q('SELECT * FROM ai_households'));
  expect('v75: every note stays, old ones too (Tony: "stay for ever")', q('SELECT text FROM feedback ORDER BY id').map(r => r.text).join() === 'old note,new note');
  expect('v75: …but a note\'s attached device log goes after six months', q('SELECT log FROM feedback ORDER BY id').map(r => r.log).join() === ',new log');
  expect('v75: every reply stays, even to a note since deleted', q('SELECT COUNT(*) AS n FROM feedback_replies')[0].n === 3);
  expect('v75: survey answers stay', q('SELECT COUNT(*) AS n FROM survey_answers')[0].n === 2);
  expect('v75: statistics stay — spend and feature counts of every month, a deleted household\'s too',
    q('SELECT COUNT(*) AS n FROM ai_spend')[0].n === 3 && q('SELECT COUNT(*) AS n FROM usage_counts')[0].n === 3);
  expect('v75: error reports go 120 days after they last happened', q('SELECT message FROM app_errors').map(r => r.message).join() === 'new error');
  expect('v75: the owner\'s device records go after six months', q('SELECT device FROM owner_devices').map(r => r.device).join() === 'new-device');
  const gone = JSON.parse(q("SELECT summary FROM hh_reports WHERE hid = 'gone'")[0].summary);
  expect('v75: a household deleted over six months ago stays listed, with its dates and counts',
    gone.deletedAt === old && gone.deletedHow === 'household' && gone.members.length === 2 && gone.members[0].role === 'owner' && gone.linkCount === 1 && gone.anonymisedAt === now, JSON.stringify(gone));
  expect('v75: …but no name, identifier, address or note is left of it', !/g@example|h@example|Gone Kitchen|GONE1|the Smiths|"name":"[^"]/.test(JSON.stringify(gone))
    && q("SELECT name, code, note FROM ai_households WHERE hid = 'gone'").every(r => r.name === null && r.code === null && r.note === null), JSON.stringify(gone));
  expect('v75: …its allowance row stays (a statistic)', q("SELECT cap FROM ai_households WHERE hid = 'gone'")[0].cap === 5);
  expect('v75: one deleted recently keeps its details (for now), and a quiet household is left alone',
    /j@example\.com/.test(dump) && /Just Gone/.test(dump) && /Quiet Kitchen/.test(dump) && /q@example\.com/.test(dump) && q('SELECT COUNT(*) AS n FROM hh_reports')[0].n === 4);
  const liveSum = JSON.parse(q("SELECT summary FROM hh_reports WHERE hid = 'live'")[0].summary);
  expect('v75: members who left more than six months ago stay counted, without their address',
    liveSum.left.length === 2 && !liveSum.left[0].email && liveSum.left[0].at === old && liveSum.left[1].email === 'y@example.com' && liveSum.name === 'Live Kitchen', JSON.stringify(liveSum.left));
  expect('v75: a live household\'s own details are untouched', q("SELECT name FROM ai_households WHERE hid = 'live'")[0].name === 'Live Kitchen');
  const before = JSON.stringify(q('SELECT * FROM hh_reports'));
  const w2 = []; await worker.scheduled({}, { METER_DB: d1 }, { waitUntil: p => w2.push(p) }); await Promise.all(w2);
  expect('v75: running it again changes nothing, and tables that do not exist are skipped',
    JSON.stringify(q('SELECT * FROM hh_reports')) === before && q('SELECT COUNT(*) AS n FROM feedback')[0].n === 2);
  const h = await (await worker.fetch(post({ action: 'health' }), { METER_DB: d1 })).json();
  expect('v75: health says the sweep is there', h.retention && h.retention.days === 183 && h.retention.db === true, JSON.stringify(h.retention));
}

// v41 — the file said "Worker v40" on line 1 and 'v41' in WORKER_VERSION; Tony
// spotted it while pasting. The number he sees at the top of the file he
// pastes must be the number Sync Health then reports.
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../cloudflare-worker.js', import.meta.url), 'utf8');
  const head = (src.match(/^\/\/ Tony's Recipes — Cloudflare Worker (v\d+)/) || [])[1];
  const code = (src.match(/const WORKER_VERSION = '(v\d+)'/) || [])[1];
  const log  = (src.match(/^\/\/ (v\d+):/m) || [])[1];
  console.log('Version labels');
  if (head && head === code && log === code) console.log(`  ok   heading, changelog and WORKER_VERSION all say ${code}`);
  else failures.push(`version labels disagree: heading ${head}, newest changelog entry ${log}, WORKER_VERSION ${code}`);
  // …and the LAST line says it is the end, with the same number. Tony's first
  // paste into Cloudflare stopped a sixth of the way in ("Unexpected end of
  // input at 150:73"); with this line he can see at a glance whether it all
  // arrived, and the app's copy button refuses a file without it.
  const last = src.trimEnd().split('\n').pop();
  const endV = (last.match(/^\/\/ ── END OF WORKER (v\d+) ──/) || [])[1];
  if (endV === code) console.log(`  ok   the last line marks the end of ${code}`);
  else failures.push(`the last line is not the end marker for ${code}: ${JSON.stringify(last.slice(0, 60))}`);
}

console.log('\nWikimedia Commons for photos (v77):');
{
  // Tony, 16 Oct 2026: Openverse "takes ages" (12–28 s a search, measured). Commons answers in under a second.
  const realFetch = globalThis.fetch; let asked = null, ua = '';
  globalThis.fetch = async (url, init) => {
    asked = String(url); ua = (init && init.headers && init.headers['User-Agent']) || '';
    return new Response(JSON.stringify({ query: { pages: {
      '11': { index: 2, title: 'File:Small.png', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Small.png', mime: 'image/png', width: 300,
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Small.png', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Small.png',
        extmetadata: { Artist: { value: '' }, LicenseShortName: { value: 'CC0' } } }] },
      '10': { index: 1, title: 'File:Shakshuka.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Shakshuka.jpg', mime: 'image/jpeg', width: 4000,
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Shakshuka.jpg/330px-Shakshuka.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Shakshuka.jpg',
        extmetadata: { Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Cook">Cook &amp; Co</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
      '12': { index: 3, title: 'File:Plan.tif', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Plan.tif', mime: 'image/tiff', width: 2000 }] }
    } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const r = await worker.fetch(post({ action: 'photo-search', query: 'shakshuka', source: 'wikimedia', page: 2 }), env);
    const d = await r.json();
    check('wikimedia answer carries CORS', r);
    expect('asks Commons for pictures, page 2 as an offset', /commons\.wikimedia\.org\/w\/api\.php/.test(asked) && /gsroffset=9\b/.test(asked) && /filetype%3Abitmap%20shakshuka/.test(asked), asked);
    expect('introduces itself with the app\'s address', /mykitchennotes\.community/.test(ua), ua);
    const im = d.images || [];
    expect('photos only, in Commons\' order', im.length === 2 && /Shakshuka/.test(im[0].thumb) && /Small/.test(im[1].url), JSON.stringify(im.map(i => i.url)));
    expect('a big original is kept as its 960-pixel copy', im[0] && im[0].url === 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Shakshuka.jpg/960px-Shakshuka.jpg', im[0] && im[0].url);
    expect('a small one as it is', im[1] && im[1].url === 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Small.png', im[1] && im[1].url);
    expect('the creator as plain text, with the licence and the file page', im[0] && im[0].credit === 'Cook & Co' && im[0].license === 'CC BY-SA 4.0'
      && im[0].creditUrl === 'https://commons.wikimedia.org/wiki/File:Shakshuka.jpg' && im[0].sourceLabel === 'Wikimedia Commons', JSON.stringify(im[0]));
    expect('no creator named: the source is', im[1] && im[1].credit === 'Wikimedia Commons', im[1] && im[1].credit);
    globalThis.fetch = async () => new Response('Too many requests', { status: 429 });
    const lim = await (await worker.fetch(post({ action: 'photo-search', query: 'x', source: 'wikimedia' }), env)).json();
    expect('a refusal is an error the app moves past', lim.rateLimited === true && /Wikimedia Commons/.test(lim.error || ''), JSON.stringify(lim));
  } finally { globalThis.fetch = realFetch; }
}

// v78 — 18–19 Oct 2026: four idle windows used the account's 1,000 KV writes a day
// and nobody was told. Ordinary requests now write nothing; the AI ceilings live in
// D1; a used-up allowance is remembered in the other store and said, with its end.
console.log('\nA used-up allowance is said, not swallowed (v78):');
{
  const { DatabaseSync } = await import('node:sqlite');
  function d1(opts = {}) {
    const raw = new DatabaseSync(':memory:');
    const st = (sql, args) => ({
      bind: (...a) => st(sql, a),
      first: async () => raw.prepare(sql).get(...(args || [])) || null,
      all: async () => ({ results: raw.prepare(sql).all(...(args || [])) }),
      run: async () => {
        if (opts.writesFail && /^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) throw new Error('D1_ERROR: Exceeded maximum daily rows written: SQLITE_ERROR');
        const x = raw.prepare(sql).run(...(args || [])); return { success: true, meta: { changes: Number(x.changes) } };
      }
    });
    return { raw, prepare: (sql) => st(sql, []) };
  }
  function kvStore(opts = {}) {
    const store = new Map();
    return { store, writes: 0,
      async get(k) { return store.has(k) ? store.get(k) : null; },
      async put(k, v) { this.writes++; if (opts.putThrows) throw new Error('KV put() limit exceeded for the day.'); store.set(k, v); } };
  }
  const ai = () => ({ model: 'claude-haiku-4-5', max_tokens: 10, messages: [], appKey: 'secret-k' });
  const stub = async (fn) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('{"stub":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    try { return await fn(); } finally { globalThis.fetch = realFetch; }
  };
  const midnight = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };

  // (a) With D1 bound, the AI day/month ceilings are counted there, exactly — KV is not touched.
  {
    const db = d1(), kv = kvStore();
    const e = { METER_DB: db, BRING_KV: kv, APP_SHARED_KEY: 'secret-k' };
    await stub(async () => { for (let i = 0; i < 3; i++) await worker.fetch(post(ai()), e); });
    const rows = db.raw.prepare('SELECT k, n FROM counters ORDER BY k').all();
    expect('three AI calls: the day and the month each read 3, in D1', rows.length === 2 && rows.every(r => r.n === 3)
      && /^rl:day:/.test(rows[0].k) && /^rl:mon:/.test(rows[1].k), JSON.stringify(rows));
    expect('…and KV is not written at all', kv.writes === 0, kv.writes + ' KV writes');
    for (let i = 0; i < 50; i++) await worker.fetch(post({ action: 'feedback-replies', appKey: 'secret-k' }), e);
    expect('fifty ordinary requests write nothing either', kv.writes === 0 && db.raw.prepare('SELECT SUM(n) AS t FROM counters').get().t === 6,
      kv.writes + ' KV writes');
    const h = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k' }), e)).json();
    expect('health: the day so far comes from D1, and says where the counters live', h.spend && h.spend.dailyUsed === 3
      && h.limits && h.limits.minute === 'memory' && h.limits.ceilings === 'd1', JSON.stringify([h.spend, h.limits]));
    db.raw.prepare("UPDATE counters SET n = 1000 WHERE k LIKE 'rl:day:%'").run();   // v81: the default daily ceiling
    const capped = await stub(() => worker.fetch(post(ai()), e));
    const cj = await capped.json();
    expect('the daily ceiling still stops the spending', capped.status === 429 && cj.spendCap === 'daily', JSON.stringify(cj));
  }

  // (b) D1's daily allowance used up: the AI path pauses, the notice is kept in KV until 00:00 UTC, and it is said.
  {
    const db = d1({ writesFail: true }), kv = kvStore();
    const e = { METER_DB: db, BRING_KV: kv, APP_SHARED_KEY: 'secret-k' };
    const first = await stub(() => worker.fetch(post(ai()), e));
    expect('the call whose count failed was not refused by the guard rail', first.status !== 429, 'got ' + first.status);
    const noted = JSON.parse(kv.store.get('notice:d1') || 'null');
    expect('…and the used-up allowance is kept in KV until it comes back', noted && noted.until === midnight(), JSON.stringify(noted));
    const second = await stub(() => worker.fetch(post(ai()), e));
    const sj = await second.json();
    expect('the next AI call is paused, naming D1 and when it ends', second.status === 429 && sj.paused === true
      && sj.notice && sj.notice.what === 'd1' && sj.notice.until === midnight() && /notes to the app owner/.test(sj.notice.affects), JSON.stringify(sj));
    const h = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k' }), e)).json();
    expect('health tells every app (keyed)', Array.isArray(h.notices) && h.notices.some(n => n.what === 'd1' && n.until === midnight()), JSON.stringify(h.notices));
    const anon = await (await worker.fetch(post({ action: 'health' }), e)).json();
    expect('…and nobody else', anon.notices === undefined, JSON.stringify(anon.notices));
    kv.writes = 0;
    await stub(() => worker.fetch(post(ai()), e));
    expect('said once, not once per request', kv.writes === 0, kv.writes + ' more KV writes');
    // the breaker would hold for five minutes; reopen it for what follows
    const realNow = Date.now; Date.now = () => realNow() + 6 * 60e3;
    try { await stub(() => worker.fetch(post(ai()), { METER_DB: d1(), APP_SHARED_KEY: 'secret-k' })); } finally { Date.now = realNow; }
  }

  // (c) A D1 failure elsewhere (a note) is answered as what it is, not as "Worker error".
  {
    const db = d1({ writesFail: true }), kv = kvStore();
    const thrown = await worker.fetch(post({ action: 'bring-recipe-page', appKey: 'secret-k', name: 'x', ingredients: ['a'] }),
      { APP_SHARED_KEY: 'secret-k', BRING_KV: kvStore({ putThrows: true }), METER_DB: db });
    const tj = await thrown.json();
    expect('KV used up under a Bring! page: 503 SERVER_LIMIT with its notice', thrown.status === 503 && /^SERVER_LIMIT/.test(tj.error)
      && tj.notice && tj.notice.what === 'kv' && /Bring!/.test(tj.notice.affects), JSON.stringify(tj));
    check('…with CORS', thrown);
  }
}

// v79 — Tony: "Please make sure the Admin gets a notification if any allowance is exceeded or blocked."
console.log('\nEvery allowance, told to the owner (v79):');
{
  const { DatabaseSync } = await import('node:sqlite');
  function d1() {
    const raw = new DatabaseSync(':memory:');
    const st = (sql, args) => ({ bind: (...a) => st(sql, a),
      first: async () => raw.prepare(sql).get(...(args || [])) || null,
      all: async () => ({ results: raw.prepare(sql).all(...(args || [])) }),
      run: async () => { const x = raw.prepare(sql).run(...(args || [])); return { success: true, meta: { changes: Number(x.changes) } }; } });
    return { raw, prepare: (sql) => st(sql, []) };
  }
  class FakeEmail { constructor(from, to, raw) { this.from = from; this.to = to; this.raw = raw; } }
  const mails = [];
  const base = () => ({ APP_SHARED_KEY: 'secret-k', ALERTS: { send: async m => { mails.push(m); } }, ALERT_TO: 'owner@example.com', __EmailMessage: FakeEmail });
  const ai = () => ({ model: 'claude-haiku-4-5', max_tokens: 10, messages: [], appKey: 'secret-k' });
  const stub = async (reply, fn) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
    try { return await fn(); } finally { globalThis.fetch = realFetch; }
  };
  const ok200 = { status: 200, body: { stub: true } };

  // (a) The daily AI ceiling reached: a notice for everyone, one e-mail, not one per refusal.
  {
    const db = d1(), e = Object.assign(base(), { METER_DB: db, AI_DAILY_MAX: '2', ANTHROPIC_API_KEY: 'sk-test' });
    mails.length = 0;
    await stub(ok200, async () => { for (let i = 0; i < 5; i++) await worker.fetch(post(ai()), e); });
    const row = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'ai-day'").get();
    expect('the daily AI ceiling raises a notice for everyone', row && row.kind === 'paused' && row.scope === 'all' && /ceiling on AI calls \(2\)/.test(row.title), JSON.stringify(row));
    expect('…and the owner is e-mailed once, not once per refusal', mails.length === 1 && /Subject: My Kitchen Notes: paused - The server's daily ceiling/.test(mails[0].raw)
      && /What stops: AI features/.test(mails[0].raw) && /Israel time/.test(mails[0].raw), mails.length + ' ' + (mails[0] && mails[0].raw.slice(0, 400)));
    const h = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k', project: 'tonys-recipes-test' }), e)).json();
    expect('every app hears it (health)', (h.notices || []).some(n => n.what === 'ai-day' && n.detail === ''), JSON.stringify(h.notices));
  }

  // (b) Anthropic refusing for want of credit: the owner hears of it, and it is not "comes back by itself".
  {
    const kv = { store: new Map(), async get(k) { return this.store.get(k) ?? null; }, async put(k, v) { this.store.set(k, v); } };
    const e = Object.assign(base(), { BRING_KV: kv, ANTHROPIC_API_KEY: 'sk-test' });
    mails.length = 0;
    const bill = { status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } } };
    await stub(bill, async () => { await worker.fetch(post(ai()), e); await worker.fetch(post(ai()), e); });
    expect('no credit at Anthropic: one e-mail, saying to top up', mails.length === 1 && /credit balance is used up/.test(mails[0].raw) && /console\.anthropic\.com\/settings\/billing/.test(mails[0].raw)
      && /needs you to act/.test(mails[0].raw), mails.length + ' ' + (mails[0] && mails[0].raw.slice(0, 300)));
  }

  // (c) The apps' reports of Firebase's limits.
  {
    const db = d1(), e = Object.assign(base(), { METER_DB: db });
    mails.length = 0;
    const fs = await worker.fetch(post({ action: 'limit-report', what: 'firestore', project: 'tonys-recipes-test', appKey: 'secret-k' }), e);
    expect('"Firestore is used up" needs a sign-in (it is told to everyone)', fs.status === 401, 'got ' + fs.status);
    const odd = await worker.fetch(post({ action: 'limit-report', what: 'anything', project: 'tonys-recipes-test', appKey: 'secret-k' }), e);
    expect('…and only known limits, in copies this server serves', odd.status === 400, 'got ' + odd.status);
    const realNow = Date.now;
    Date.now = () => Date.parse('2026-10-19T22:00:00Z');                    // 15:00 in California (summer time)
    let ae;
    try { ae = await (await worker.fetch(post({ action: 'limit-report', what: 'auth-email', project: 'tonys-recipes-test', appKey: 'secret-k' }), e)).json(); }
    finally { Date.now = realNow; }
    const row = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'auth-email:tonys-recipes-test'").get();
    expect('"no more sign-in e-mails today": kept for the owner, until midnight in California', ae.ok === true && ae.notice === null && row && row.scope === 'owner'
      && row.until === Date.parse('2026-10-20T07:00:00Z'), JSON.stringify([ae, row && row.until, row && new Date(row.until).toISOString()]));
    expect('…and e-mailed to the owner', mails.length === 1 && /sign-in e-mail/.test(mails[0].raw), mails.length + '');
    Date.now = () => Date.parse('2026-12-01T10:00:00Z');                    // 02:00 in California (winter time)
    try { await worker.fetch(post({ action: 'limit-report', what: 'auth-email', project: 'my-kitchen-notes-beta', appKey: 'secret-k' }), e); }
    finally { Date.now = realNow; }
    const w = db.raw.prepare("SELECT until FROM allowance_notices WHERE what = 'auth-email:my-kitchen-notes-beta'").get();
    expect('…in winter time too', w && w.until === Date.parse('2026-12-02T08:00:00Z'), w && new Date(w.until).toISOString());
    const h = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k', project: 'tonys-recipes-test' }), e)).json();
    expect('a tester\'s app is not shown the owner\'s notices', !(h.notices || []).some(n => n.scope === 'owner'), JSON.stringify(h.notices));
  }

  // (d) The hourly usage watch: its key, a warning at 70%, the last reading kept for the owner.
  {
    const db = d1(), e = Object.assign(base(), { METER_DB: db, USAGE_KEY: 'k'.repeat(64) });
    mails.length = 0;
    const metrics = { kvWrites: { used: 812, limit: 1000 }, workerRequests: { used: 6000, limit: 100000 }, pagesBuilds: { used: 497, limit: 500, period: 'month' } };
    const bad = await worker.fetch(post({ action: 'usage-report', key: 'nope', metrics, appKey: 'secret-k' }), e);
    expect('the usage watch needs its key', bad.status === 403, 'got ' + bad.status);
    const none = await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics, appKey: 'secret-k' }), Object.assign(base(), { METER_DB: d1() }));
    expect('…and without USAGE_KEY set, nobody may report', none.status === 403, 'got ' + none.status);
    const r = await (await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics, appKey: 'secret-k' }), e)).json();
    expect('70% or more is warned, below is not', JSON.stringify(r.warned) === '["kvWrites","pagesBuilds"]', JSON.stringify(r));
    const kvw = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:kvWrites'").get();
    expect('…for the owner, saying the numbers', kvw && kvw.scope === 'owner' && kvw.kind === 'warning' && /^Cloudflare KV writes: 812 of 1,000 today \(81% of the free allowance\)$/.test(kvw.title)
      && /starts again on .+ \(Israel time\)/.test(kvw.detail) && /usage watch/.test(kvw.detail) && !/UTC/.test(kvw.detail), JSON.stringify(kvw));
    expect('…by e-mail, once each', mails.length === 2, mails.length + '');
    await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics, appKey: 'secret-k' }), e);
    expect('the next hour\'s same reading is not e-mailed again', mails.length === 2, mails.length + '');
    const snap = db.raw.prepare('SELECT metrics FROM usage_snapshot').get();
    expect('the last reading is kept for the owner\'s page', snap && JSON.parse(snap.metrics).kvWrites.used === 812, JSON.stringify(snap));
    const realNow = Date.now;
    Date.now = () => Date.parse('2026-10-20T12:00:00Z');                   // 05:00 in California
    try { await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics: { firestoreReads: { used: 41000, limit: 50000, period: 'pacific-day', project: 'my-kitchen-notes-beta' } }, appKey: 'secret-k' }), e); }
    finally { Date.now = realNow; }
    const fsr = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:firestoreReads'").get();
    expect('Firestore\'s day is California\'s: warned until its midnight', fsr && fsr.until === Date.parse('2026-10-21T07:00:00Z') && /^Firebase Firestore reads: 41,000 of 50,000 today \(82%/.test(fsr.title)
      && /starts again on Wed 21 Oct, 10:00 \(Israel time\)/.test(fsr.detail) && /Firebase’s own figures/.test(fsr.detail) && /my-kitchen-notes-beta/.test(fsr.affects), JSON.stringify(fsr));
    const er = await (await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics: { workerErrors: { used: 10, of: 100 } }, appKey: 'secret-k' }), e)).json();
    expect('v82: a handful of server errors is not warned (fewer than 25)', JSON.stringify(er.warned) === '[]', JSON.stringify(er));
    const er2 = await (await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics: { workerErrors: { used: 60, of: 2000 } }, appKey: 'secret-k' }), e)).json();
    const ern = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:workerErrors'").get();
    expect('v82: …3% of the day\'s requests is (owner, with where to look)', JSON.stringify(er2.warned) === '["workerErrors"]' && ern && ern.scope === 'owner'
      && /60 times today \(3% of requests\)/.test(ern.title) && /Logs/.test(ern.detail), JSON.stringify([er2, ern]));
  }

  // (g) v86 — Tony, 20 Oct: "What is Paused? Where is this message coming from?" Pages builds over 500 are a warning
  // (Cloudflare kept building), named per copy, with the day the count starts again; new figures are written, not
  // mailed; a refused build is "paused" and mailed at once.
  {
    const db = d1(), e = Object.assign(base(), { METER_DB: db, USAGE_KEY: 'k'.repeat(64) });
    const realNow = Date.now; let at = Date.parse('2026-10-20T12:00:00Z'); Date.now = () => at;
    const report = (pb) => worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics: { pagesBuilds: Object.assign({ limit: 500, period: 'month' }, pb) }, appKey: 'secret-k' }), e);
    const row = () => db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:pagesBuilds'").get();
    try {
      // the notice Tony saw: kept from the first reading, "paused", 918
      db.raw.exec('CREATE TABLE IF NOT EXISTS allowance_notices (what TEXT PRIMARY KEY, kind TEXT, scope TEXT, project TEXT, since INTEGER, until INTEGER, title TEXT, affects TEXT, detail TEXT, self INTEGER, mailed_at INTEGER)');
      db.raw.prepare("INSERT INTO allowance_notices VALUES ('usage:pagesBuilds', 'paused', 'owner', '', ?, ?, 'Pages builds at 184% of the free allowance this month', 'publishing new versions of the app', '918 of 500 this month.', 1, ?)")
        .run(at - 10 * 3600e3, Date.parse('2026-11-01T00:00:00Z'), at - 10 * 3600e3);
      mails.length = 0;
      await report({ used: 949, lastOk: true, per: { 'tonys-recipes-test': 518, 'my-kitchen-notes-beta': 431 } });
      let n = row();
      expect('v86: Pages builds over 500, the latest built: a warning, not "paused"', n.kind === 'warning', JSON.stringify(n));
      expect('v86: …saying how many, per copy, that nothing stopped, when it starts again (Israel time) and who counted',
        /^Cloudflare Pages: 949 builds this month, over the 500 the free plan includes \(190%\)$/.test(n.title)
        && /the test copy 518, the community app 431/.test(n.detail) && /Nothing has stopped/.test(n.detail)
        && /starts again on Sun 1 Nov, 02:00 \(Israel time\)/.test(n.detail) && /usage watch/.test(n.detail)
        && /family app is published by GitHub/.test(n.affects) && n.since === at - 10 * 3600e3, JSON.stringify(n));
      expect('v86: …the better news is not mailed again', mails.length === 0, String(mails.length));
      at += 1800e3;
      await report({ used: 951, lastOk: true, per: { 'tonys-recipes-test': 519, 'my-kitchen-notes-beta': 432 } });
      n = row();
      expect('v86: the next reading\'s figures replace the first (it said 918 all day)', /951 builds/.test(n.title) && /test copy 519/.test(n.detail) && mails.length === 0, JSON.stringify([n.title, mails.length]));
      at += 1800e3;
      await report({ used: 953, lastOk: false, per: { 'tonys-recipes-test': 520, 'my-kitchen-notes-beta': 433 } });
      n = row();
      expect('v86: a refused build is "paused" — and mailed at once, within the day', n.kind === 'paused' && /Cloudflare refused the latest build/.test(n.detail) && mails.length === 1
        && /Subject: My Kitchen Notes: paused - Cloudflare Pages/.test(mails[0].raw), JSON.stringify([n.kind, mails.length]));
      await report({ used: 300, per: { 'tonys-recipes-test': 300 } });
      expect('v86: under 70% nothing new is raised', row().kind === 'paused' && /953/.test(row().title), row().title);
      db.raw.prepare("DELETE FROM allowance_notices WHERE what = 'usage:pagesBuilds'").run();
      await report({ used: 360, per: { 'tonys-recipes-test': 360 } });
      expect('v86: 72% says the share, not "over"', /^Cloudflare Pages: 360 builds this month, 72% of the 500 the free plan includes$/.test(row().title)
        && row().kind === 'warning' && !/Nothing has stopped/.test(row().detail), row().title);
    } finally { Date.now = realNow; }
    // the count itself: an entry Cloudflare filed but never built, and a direct upload, are not builds
    const { countBuilds } = createRequire(import.meta.url)('../tools/cf-usage.js');
    const d = (when, env, type, name, status) => ({ created_on: when, environment: env, deployment_trigger: { type }, latest_stage: { name, status } });
    const c = countBuilds([d('2026-10-20T10:00:00Z', 'production', 'github:push', 'deploy', 'success'), d('2026-10-20T11:00:00Z', 'preview', 'github:push', 'queued', 'idle'),
      d('2026-10-20T11:05:00Z', 'preview', 'github:push', 'queued', 'skipped'), d('2026-10-20T11:10:00Z', 'production', 'ad_hoc', 'deploy', 'success'),
      d('2026-10-19T09:00:00Z', 'preview', 'github:push', 'deploy', 'success'), d('2026-09-30T23:00:00Z', 'production', 'github:push', 'deploy', 'success')], '2026-10');
    expect('v86: the watch counts real builds only (not "queued", never built; not a direct upload; not last month)', c.used === 2 && c.lastOk === true, JSON.stringify(c));
    const c2 = countBuilds([d('2026-10-20T10:00:00Z', 'production', 'github:push', 'deploy', 'success'), d('2026-10-20T12:00:00Z', 'production', 'github:push', 'build', 'failure')], '2026-10');
    expect('v86: …and says when the latest production build failed', c2.used === 2 && c2.lastOk === false, JSON.stringify(c2));
  }

  // (f) v85 — a notice's kind decides WhatsApp: near-limit off, server errors on.
  {
    const db = d1(), sent = [];
    const e = Object.assign(base(), { METER_DB: db, USAGE_KEY: 'k'.repeat(64), WHATSAPP_PHONE: '+972500000000', WHATSAPP_KEY: 'k',
      __fetch: async (url) => { sent.push(new URL(String(url)).searchParams.get('text')); return new Response('Message queued', { status: 200 }); } });
    db.raw.exec('CREATE TABLE IF NOT EXISTS owner_prefs (k TEXT PRIMARY KEY, v TEXT)');
    db.raw.prepare("INSERT INTO owner_prefs (k, v) VALUES ('whatsapp_off', ?)").run(JSON.stringify({ 'near-limit': true }));
    mails.length = 0;
    await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics: { kvWrites: { used: 800, limit: 1000 } }, appKey: 'secret-k' }), e);
    expect('v85: an allowance at 70% with "near limit" off: e-mailed, not on WhatsApp', mails.length === 1 && sent.length === 0, JSON.stringify([mails.length, sent]));
    await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics: { workerErrors: { used: 60, of: 1000 } }, appKey: 'secret-k' }), e);
    expect('v85: …server errors (on) come on WhatsApp too', mails.length === 2 && sent.length === 1 && /error/.test(sent[0]), JSON.stringify([mails.length, sent]));
    await worker.fetch(post({ action: 'usage-report', key: 'k'.repeat(64), metrics: { d1RowsWritten: { used: 100000, limit: 100000 } }, appKey: 'secret-k' }), e);
    expect('v85: …an allowance used up is "limit reached" (on): on WhatsApp', sent.length === 2 && /paused|D1 rows written/.test(sent[1]), JSON.stringify(sent));
  }

  // (e) v84 — the hourly check on Cloudflare's own clock, with an analytics-only token.
  {
    const db = d1(), calls = [];
    const gql = { data: { viewer: { accounts: [{ kv: [{ sum: { requests: 850 }, dimensions: { actionType: 'write' } }, { sum: { requests: 4000 }, dimensions: { actionType: 'read' } }],
      w: [{ sum: { requests: 9000, errors: 3 } }], d1: [{ sum: { rowsRead: 1000, rowsWritten: 2000 } }] }] } } };
    const e = Object.assign(base(), { METER_DB: db, CF_ANALYTICS_TOKEN: 'cf-t',
      __fetch: async (url, init) => { calls.push({ url: String(url), auth: init && init.headers && init.headers.Authorization }); return new Response(JSON.stringify(gql), { status: 200 }); } });
    mails.length = 0;
    db.raw.exec('CREATE TABLE IF NOT EXISTS usage_snapshot (id INTEGER PRIMARY KEY, at INTEGER, metrics TEXT)');
    db.raw.prepare('INSERT INTO usage_snapshot (id, at, metrics) VALUES (1, ?, ?)').run(Date.now() - 3600e3, JSON.stringify({ pagesBuilds: { used: 120, limit: 500, period: 'month' } }));
    const w1 = []; await worker.scheduled({ cron: '17 * * * *', scheduledTime: Date.now() }, e, { waitUntil: p => w1.push(p) }); await Promise.all(w1);
    const kv = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:kvWrites'").get();
    expect('v84: the hourly cron reads Cloudflare\'s analytics with its token and warns at 70%', calls.length === 1 && /graphql/.test(calls[0].url) && calls[0].auth === 'Bearer cf-t'
      && kv && /KV writes: 850 of 1,000 today \(85%/.test(kv.title) && mails.length === 1, JSON.stringify([calls, kv && kv.title, mails.length]));
    const sn = JSON.parse(db.raw.prepare('SELECT metrics FROM usage_snapshot WHERE id = 1').get().metrics);
    expect('v84: …and keeps the GitHub watch\'s figures beside its own (Pages builds)', sn.kvWrites.used === 850 && sn.pagesBuilds && sn.pagesBuilds.used === 120 && sn.workerErrors.of === 9000, JSON.stringify(sn));
    const daily = []; const w2 = []; await worker.scheduled({ cron: '23 3 * * *', scheduledTime: Date.now() }, e, { waitUntil: p => w2.push(p) }); await Promise.all(w2);
    expect('v84: the daily sweep does not read the analytics', calls.length === 1, String(calls.length));
    const e2 = Object.assign(base(), { METER_DB: d1(), __fetch: async () => { throw new Error('no token, no call'); } });
    const w3 = []; await worker.scheduled({ cron: '17 * * * *', scheduledTime: Date.now() }, e2, { waitUntil: p => w3.push(p) }); await Promise.all(w3);
    expect('v84: without the token the hourly cron does nothing', !e2.METER_DB.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'allowance_notices'").get(), 'made a table');
    const db3 = d1(), e3 = Object.assign(base(), { METER_DB: db3, CF_ANALYTICS_TOKEN: 'old', __fetch: async () => new Response(JSON.stringify({ errors: [{ message: 'Authentication error' }] }), { status: 403 }) });
    const w4 = []; await worker.scheduled({ cron: '17 * * * *', scheduledTime: Date.now() }, e3, { waitUntil: p => w4.push(p) }); await Promise.all(w4);
    const wn = db3.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'usage:watch'").get();
    expect('v84: a token that stopped working is told to the owner', wn && wn.scope === 'owner' && /cannot read/.test(wn.title) && /403/.test(wn.detail), JSON.stringify(wn));
  }
}

// v90 — the testers' reports, on to a private repository (GitHub faked; SQLite for D1)
console.log('\nReports to the private repository (v90):');
{
  const { DatabaseSync } = await import('node:sqlite');
  const d1 = () => {
    const raw = new DatabaseSync(':memory:');
    const stmt = (sql, args) => ({
      bind: (...a) => stmt(sql, a),
      first: async () => raw.prepare(sql).get(...(args || [])) || null,
      all: async () => ({ results: raw.prepare(sql).all(...(args || [])) }),
      run: async () => { const x = raw.prepare(sql).run(...(args || [])); return { success: true, meta: { last_row_id: Number(x.lastInsertRowid), changes: Number(x.changes) } }; },
      _run() { raw.prepare(sql).run(...(args || [])); }
    });
    return { raw, prepare: (sql) => stmt(sql, []), batch: async (list) => { raw.exec('BEGIN'); try { list.forEach(s => s._run()); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } return []; } };
  };
  const db = d1(), now = Date.now();
  db.raw.exec('CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, uid TEXT, email TEXT, name TEXT, hid TEXT, household TEXT, text TEXT, shot TEXT, log TEXT, version TEXT, env TEXT, device TEXT, lang TEXT, at INTEGER, status TEXT)');
  db.raw.exec('CREATE TABLE app_errors (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, uid TEXT, email TEXT, hid TEXT, kind TEXT, message TEXT, place TEXT, screen TEXT, version TEXT, env TEXT, device TEXT, lang TEXT, first_at INTEGER, last_at INTEGER, n INTEGER, status TEXT)');
  const note = db.raw.prepare('INSERT INTO feedback (project, uid, email, name, hid, household, text, shot, log, version, env, device, lang, at, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  note.run('my-kitchen-notes-beta', 'uSecret1', 'dana@tester.example', 'Dana Tester', 'hDana', 'Dana\'s Kitchen', 'The import froze @octocat\n~~~~\nfake end', 'data:image/jpeg;base64,QUJD', 'log line ✓', 'v38.91', 'beta', 'iPhone `Safari`', 'he', now - 60000, 'new');
  note.run('my-kitchen-notes-beta', 'uSecret1', 'dana@tester.example', 'Dana Tester', 'hDana', 'Dana\'s Kitchen', 'Already handled', '', '', 'v38.80', 'beta', 'x', 'en', now - 9e6, 'done');
  const err = db.raw.prepare('INSERT INTO app_errors (project, uid, email, hid, kind, message, place, screen, version, env, device, lang, first_at, last_at, n, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  err.run('my-kitchen-notes-beta', 'uSecret1', 'dana@tester.example', 'hDana', 'error', 'Cannot read x of undefined', 'saveRecipe', 'editor', 'v38.91', 'beta', 'iPhone', 'he', now - 5000, now - 4000, 2, 'new');
  err.run('my-kitchen-notes-beta', 'uSecret2', 'eli@tester.example', 'hEli', 'error', 'Cannot read x of undefined', 'saveRecipe', 'editor', 'v38.91', 'beta', 'Android', 'en', now - 3000, now - 2000, 1, 'new');
  err.run('my-kitchen-notes-beta', 'uSecret3', 'old@tester.example', 'hOld', 'error', 'Long ago', 'x', 'y', 'v38.50', 'beta', 'z', 'en', now - 30 * 864e5, now - 20 * 864e5, 1, 'new');
  const calls = []; let issueN = 1, refuse = 0, filesBranch = false;
  const ghFetch = async (url, init) => {
    const u = String(url), b = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ u, m: init.method, b, auth: init.headers && init.headers.Authorization });
    if (refuse) { refuse--; return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }); }
    if (/\/git\/ref\/heads\/files$/.test(u)) return filesBranch ? new Response('{"object":{"sha":"f1"}}', { status: 200 }) : new Response('{"message":"Not Found"}', { status: 404 });
    if (/\/git\/ref\/heads\/main$/.test(u)) return new Response('{"object":{"sha":"m1"}}', { status: 200 });
    if (/\/git\/refs$/.test(u)) { filesBranch = b && b.sha === 'm1' && b.ref === 'refs/heads/files'; return new Response('{}', { status: 201 }); }
    if (/\/contents\//.test(u)) return new Response(JSON.stringify({ content: { html_url: 'https://github.com/rozinante2004-hash/kitchen-reports/blob/main/' + u.split('/contents/')[1] } }), { status: 201 });
    if (/\/pulls\?/.test(u)) return new Response(JSON.stringify([{ number: 7, title: 'Not this one' }, { number: 1, title: '📥 Reports inbox' }]), { status: 200 });
    if (/\/issues\/1\/comments$/.test(u)) return new Response('{"id":1}', { status: 201 });
    if (/\/issues$/.test(u)) { issueN++; return new Response(JSON.stringify({ number: issueN }), { status: 201 }); }
    return new Response('{"message":"Not Found"}', { status: 404 });
  };
  const env = { METER_DB: db, REPORTS_GITHUB_TOKEN: 'gh-test-token', __fetch: ghFetch };
  const hourly = async (e) => { const w = []; await worker.scheduled({ cron: '17 * * * *', scheduledTime: Date.now() }, e, { waitUntil: p => w.push(p) }); await Promise.all(w); };
  await hourly(env);
  const issues = calls.filter(c => c.m === 'POST' && /\/issues$/.test(c.u));
  expect('v90: the hourly run sends the open note and ONE issue for an error two people had (not the done note, not the old error)',
    issues.length === 2 && /^💬 beta v38\.91 — The import froze ＠octocat$/.test(issues[0].b.title) && /^⚠️ beta v38\.91 — Cannot read x of undefined$/.test(issues[1].b.title),
    JSON.stringify(issues.map(i => i.b.title)));
  expect('v90: …every call to the private repository with its token', calls.every(c => c.u.startsWith('https://api.github.com/repos/rozinante2004-hash/kitchen-reports/') && c.auth === 'Bearer gh-test-token'), JSON.stringify(calls.map(c => c.u)));
  const all = JSON.stringify(calls.map(c => c.b));
  expect('v90: …no address, no name, no account id leaves', !/@tester\.example|Dana Tester|Dana\\u0027s|Dana's Kitchen|uSecret/.test(all), all.slice(0, 400));
  const nb = issues[0].b.body;
  expect('v90: …the tester\'s words fenced (no @mention, no fake end), the device in a code span',
    /~~~~~text\nThe import froze @octocat\n~~~~\nfake end\n~~~~~/.test(nb) && /Device: `iPhone  Safari `/.test(nb) && /Sender: `[0-9a-f]{8}`/.test(nb) && /3 time\(s\), to 2 person\(s\)/.test(issues[1].b.body), nb);
  const files = calls.filter(c => c.m === 'PUT');
  expect('v90: …the screenshot and the log as files beside it, linked from the issue',
    files.length === 2 && /\/contents\/shots\/\d{4}-\d\d-\d\d-note-1\.jpg$/.test(files[0].u) && files[0].b.content === 'QUJD' && files[0].b.branch === 'files' && filesBranch
    && /\/contents\/logs\/\d{4}-\d\d-\d\d-note-1\.txt$/.test(files[1].u) && Buffer.from(files[1].b.content, 'base64').toString('utf8') === 'log line ✓'
    && /shots\/.*note-1\.jpg\?raw=true/.test(nb) && /logs\/.*note-1\.txt/.test(nb), JSON.stringify(files.map(f => f.u)));
  const comment = calls.filter(c => /\/issues\/1\/comments$/.test(c.u));
  expect('v90: …and one comment on the open 📥 pull request wakes the watcher', comment.length === 1 && /#2 💬/.test(comment[0].b.body) && /#3 ⚠️/.test(comment[0].b.body), JSON.stringify(comment));
  const n1 = calls.length;
  await hourly(env);
  expect('v90: the next run sends nothing twice', calls.length === n1, String(calls.length - n1));
  // GitHub refuses: kept, said to the owner, and sent on a later run
  note.run('my-kitchen-notes-beta', 'uSecret2', 'eli@tester.example', 'Eli', 'hEli', 'Eli\'s', 'Second note', '', '', 'v38.91', 'beta', 'Android', 'en', Date.now(), 'new');
  refuse = 1; await hourly(env);
  const notice = db.raw.prepare("SELECT * FROM allowance_notices WHERE what = 'reports:github'").get();
  expect('v90: a token GitHub refuses: the note waits, and 🩺 tells the owner', notice && notice.scope === 'owner' && /REPORTS_GITHUB_TOKEN/.test(notice.detail)
    && !db.raw.prepare("SELECT * FROM report_links WHERE kind = 'note' AND ref = '3'").get(), JSON.stringify(notice));
  await hourly(env);
  const l3 = db.raw.prepare("SELECT issue FROM report_links WHERE kind = 'note' AND ref = '3'").get();
  expect('v90: …and goes on the next run', l3 && l3.issue > 0, JSON.stringify(l3));
  // without the token: nothing at all
  const db2 = d1(); const e2 = { METER_DB: db2, __fetch: async () => { throw new Error('no token, no call'); } };
  await hourly(e2);
  expect('v90: without the token nothing is sent and no table is made', !db2.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'report_links'").get(), 'made a table');
  const h = await (await worker.fetch(post({ action: 'health' }), env)).json();
  expect('v90: health says the reports go on', h.metering && h.metering.reports === true || h.reports === true || JSON.stringify(h).indexOf('"reports":true') !== -1, JSON.stringify(h).slice(0, 300));
}


// v91 — the reports do not stay for ever; alerts through ntfy
console.log('\nReports retention and ntfy (v91):');
{
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, args) => ({ bind: (...a) => stmt(sql, a), first: async () => raw.prepare(sql).get(...(args || [])) || null,
    all: async () => ({ results: raw.prepare(sql).all(...(args || [])) }),
    run: async () => { const x = raw.prepare(sql).run(...(args || [])); return { success: true, meta: { last_row_id: Number(x.lastInsertRowid), changes: Number(x.changes) } }; },
    _run() { raw.prepare(sql).run(...(args || [])); } });
  const db = { raw, prepare: (sql) => stmt(sql, []), batch: async (l) => { l.forEach(x => x._run()); return []; } };
  const now = Date.now(), day = 864e5, iso = t => new Date(t).toISOString();
  const B = 'https://github.com/rozinante2004-hash/kitchen-reports/blob/';
  const issues = [
    { number: 1, node_id: 'PR1', title: '📥 Reports inbox', state: 'open', created_at: iso(now - 200 * day), pull_request: {} },
    { number: 2, node_id: 'I2', title: 'old closed', state: 'closed', closed_at: iso(now - 91 * day), created_at: iso(now - 100 * day),
      body: 'x ' + B + 'files/shots/2026-07-01-note-2.jpg y ' + B + 'main/logs/2026-07-01-note-2.txt' },
    { number: 3, node_id: 'I3', title: 'ancient open', state: 'open', created_at: iso(now - 181 * day), body: 'no files' },
    { number: 4, node_id: 'I4', title: 'recent closed', state: 'closed', closed_at: iso(now - 10 * day), created_at: iso(now - 20 * day), body: '' },
    { number: 5, node_id: 'I5', title: 'open, young', state: 'open', created_at: iso(now - 30 * day), body: '' }
  ];
  let calls = [], mayDelete = true;
  const gh = async (url, init) => {
    const u = String(url), m = init.method, b = init.body ? JSON.parse(init.body) : null;
    calls.push({ u, m, b });
    if (/\/issues\?state=all/.test(u)) return new Response(JSON.stringify(/page=1$/.test(u) ? issues : []), { status: 200 });
    if (m === 'GET' && /\/contents\//.test(u)) return new Response('{"sha":"s-' + u.split('/').pop() + '"}', { status: 200 });
    if (m === 'DELETE' && /\/contents\//.test(u)) return new Response('{}', { status: 200 });
    if (/\/graphql$/.test(u)) return new Response(JSON.stringify(mayDelete ? { data: { deleteIssue: { clientMutationId: null } } } : { errors: [{ message: 'must have admin rights' }] }), { status: 200 });
    if (/\/issues\/\d+\/comments\?/.test(u)) return new Response('[{"id":71},{"id":72}]', { status: 200 });
    if (m === 'DELETE' && /\/issues\/comments\//.test(u)) return new Response(null, { status: 204 });
    if (m === 'PATCH' && /\/issues\/\d+$/.test(u)) return new Response('{}', { status: 200 });
    if (/\/git\/ref\/heads\/files$/.test(u)) return new Response('{"object":{"sha":"f9"}}', { status: 200 });
    if (/\/git\/commits\/f9$/.test(u)) return new Response('{"tree":{"sha":"t9"}}', { status: 200 });
    if (m === 'POST' && /\/git\/commits$/.test(u)) return new Response('{"sha":"n1"}', { status: 201 });
    if (m === 'PATCH' && /\/git\/refs\/heads\/files$/.test(u)) return new Response('{}', { status: 200 });
    return new Response('{"message":"Not Found"}', { status: 404 });
  };
  const env = { METER_DB: db, REPORTS_GITHUB_TOKEN: 'gh-test', __fetch: gh };
  const daily = async (e) => { const w = []; await worker.scheduled({ cron: '23 3 * * *', scheduledTime: now }, e, { waitUntil: p => w.push(p) }); await Promise.all(w); };
  await daily(env);
  const gq = calls.filter(c => /\/graphql$/.test(c.u)).map(c => c.b.variables.id);
  expect('v91: 90 days after closing and 180 at most: those two go, the young ones and the inbox stay', JSON.stringify(gq) === '["I2","I3"]', JSON.stringify(gq));
  const del = calls.filter(c => c.m === 'DELETE' && /\/contents\//.test(c.u));
  expect('v91: …with their screenshot and log, each from its own branch', del.length === 2 && del[0].b.branch === 'files' && del[0].b.sha === 's-2026-07-01-note-2.jpg?ref=files'.replace('?ref=files', '') || (del.length === 2 && del.some(d => d.b.branch === 'main')), JSON.stringify(del.map(d => [d.u, d.b])));
  const sq = calls.filter(c => c.m === 'POST' && /\/git\/commits$/.test(c.u))[0], fr = calls.filter(c => c.m === 'PATCH' && /\/git\/refs\/heads\/files$/.test(c.u))[0];
  expect('v91: once a month the files branch is one commit of what is left (deleted files leave its history)',
    sq && sq.b.tree === 't9' && Array.isArray(sq.b.parents) && sq.b.parents.length === 0 && fr && fr.b.sha === 'n1' && fr.b.force === true, JSON.stringify([sq, fr]));
  calls = []; await daily(env);
  expect('v91: …and not again the next day', !calls.some(c => /\/git\/commits$/.test(c.u)), 'squashed twice');
  raw.exec('CREATE TABLE IF NOT EXISTS allowance_notices (what TEXT PRIMARY KEY, kind TEXT, scope TEXT, project TEXT, since INTEGER, until INTEGER, title TEXT, affects TEXT, detail TEXT, self INTEGER, mailed_at INTEGER)');   // tableOnce remembers it from an earlier section
  calls = []; mayDelete = false; await daily(env);
  const emptied = calls.filter(c => c.m === 'PATCH' && /\/issues\/\d+$/.test(c.u));
  const nt = raw.prepare("SELECT * FROM allowance_notices WHERE what = 'reports:retention'").get();
  expect('v91: a token that may not delete: the issue is emptied (comments too) and 🩺 says which permission is missing',
    emptied.length === 2 && /^\[removed\]/.test(emptied[0].b.title) && emptied[0].b.state === 'closed' && calls.filter(c => /\/issues\/comments\//.test(c.u)).length === 4
    && nt && /Administration: Read and write/.test(nt.detail), JSON.stringify([emptied.length, nt && nt.detail]));
  const before = calls.length;
  await daily({ METER_DB: db, __fetch: gh });
  expect('v91: without the token: nothing', calls.length === before, 'called GitHub');
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nall worker checks passed');
