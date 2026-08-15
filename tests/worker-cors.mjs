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
