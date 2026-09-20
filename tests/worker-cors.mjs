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

console.log('\nBring! set-token secret:');
const noSecret = await worker.fetch(post({ action: 'bring-settoken', token: 't', secret: 'x' }), env);
expect('closed when BRING_SETTOKEN_SECRET is unset', noSecret.status === 503,
  `got ${noSecret.status} — an unset secret must CLOSE the endpoint, never fall back to a default`);

if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nall worker checks passed');
