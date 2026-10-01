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

function post(body, origin = ORIGIN, extraHeaders = {}) {
  return new Request('https://worker.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': origin, ...extraHeaders },
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
  const aiBody = () => ({ model: 'm', max_tokens: 10, messages: [], appKey: 'secret-k' });
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

  // (a) The cheap, high-volume path is SAMPLED. 300 photo requests used to be
  // 300 KV writes against a 1,000/day allowance. RATE_LIMIT is lifted well clear
  // of 300 on purpose: otherwise the per-minute limit refuses the tail of the
  // burst and the write count looks low because the requests never ran.
  {
    const kv = fakeKv();
    const env2 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', RATE_LIMIT: '100000' };
    for (let i = 0; i < 300; i++) await worker.fetch(post(photoBody()), env2);
    expect('300 photo requests cost far fewer than 300 KV writes', kv.writes < 120,
      `${kv.writes} writes for 300 requests — the sampling is not in effect, so a photo burst still eats the daily allowance`);
    expect('…but it still counts them', kv.writes > 10,
      `${kv.writes} writes — nothing is being recorded at all, so the limiter is decorative`);
    const counted = parseInt(kv.store.get([...kv.store.keys()][0]) || '0', 10);
    expect('the sampled count still tracks the real number', counted > 200 && counted < 400,
      `the counter reads ${counted} after 300 requests — sampling without crediting the skipped ones `
      + 'means the limiter under-counts by 5x and never fires');
  }

  // (b) The AI path is counted EXACTLY — it is rare, and it is the one that
  // spends money, so accuracy is worth the write.
  {
    const kv = fakeKv();
    const env2 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test' };
    await noNetwork(async () => { for (let i = 0; i < 5; i++) await worker.fetch(post(aiBody()), env2); });
    const minuteKey = [...kv.store.keys()].find(k => k.endsWith(':ai'));
    expect('five AI calls are counted as five', kv.store.get(minuteKey) === '5',
      `the per-minute counter reads ${kv.store.get(minuteKey)} after 5 calls`);
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
    kv.store.set('rl:mon:' + new Date().toISOString().slice(0, 7), '3000');
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
    expect('and says so in words a person can act on', /KV write allowance/.test((await second.json()).error || ''),
      'the message does not say what is actually wrong');

    // Recovery: a healthy KV write reopens it. 100 requests so the 1-in-5
    // sampling is certain to have written at least once.
    const healthy = fakeKv();
    const env3 = { BRING_KV: healthy, APP_SHARED_KEY: 'secret-k', ANTHROPIC_API_KEY: 'sk-test', RATE_LIMIT: '100000' };
    for (let i = 0; i < 100; i++) await worker.fetch(post(photoBody()), env3);
    const after = await noNetwork(() => worker.fetch(post(aiBody()), env3));
    expect('a working KV reopens it', after.status === 200,
      `got ${after.status} — the breaker never resets, so one transient write failure disables AI for good`);
  }

  // (g) health reports the ceilings to a keyed caller, and to nobody else.
  {
    const kv = fakeKv();
    kv.store.set('rl:day:' + new Date().toISOString().slice(0, 10), '12');
    const e2 = { BRING_KV: kv, APP_SHARED_KEY: 'secret-k' };
    const keyedH = await (await worker.fetch(post({ action: 'health', appKey: 'secret-k' }), e2)).json();
    expect('health reports the daily count to the app', keyedH.spend && keyedH.spend.dailyUsed === 12,
      'the app cannot see how close the bill is to its ceiling: ' + JSON.stringify(keyedH.spend));
    expect('and the ceiling itself', keyedH.spend && keyedH.spend.dailyMax === 300,
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
        const r = await worker.fetch(post({ action: 'photo-fetch', url: 'https://e.com/a.png', appKey: 'secret-k' }), e3);
        if (r.status === 429) refused++;
      }
      expect('300 photo downloads in a burst are all allowed', refused === 0,
        `${refused} were refused — "auto-fetch missing photos" over a big library would half-fail`);
      expect('…and cost few KV writes', kv.writes < 45, `${kv.writes} writes`);
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

console.log('\nBring! set-token secret:');
const noSecret = await worker.fetch(post({ action: 'bring-settoken', token: 't', secret: 'x' }), env);
expect('closed when BRING_SETTOKEN_SECRET is unset', noSecret.status === 503,
  `got ${noSecret.status} — an unset secret must CLOSE the endpoint, never fall back to a default`);

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

if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nall worker checks passed');
