// v39.10 — tools/clear-sent-recipes.mjs against the Firestore emulator: sent recipes and
// pictures past their expireAt go, those still within their 4 weeks stay, other
// collections are never touched, more than one page is cleared, and nothing but counts
// reaches the log.
//   firebase emulators:exec --only firestore --project demo-gifts "node clear-sent-recipes.test.mjs <tool>"
import { execFileSync } from 'node:child_process';
const FS = 'http://127.0.0.1:8086/v1/', P = 'demo-gifts', TOOL = process.argv[2];
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const DOCS = FS + 'projects/' + P + '/databases/(default)/documents';
let failed = 0;
const ok = (name, cond, more) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond || !more ? '' : ' — ' + more)); if (!cond) failed++; };
async function j(url, init) { const r = await fetch(url, Object.assign({ headers: H }, init || {})); const t = await r.text(); if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 200)); return t ? JSON.parse(t) : {}; }
function run(args) {
  try { return { code: 0, out: execFileSync('node', [TOOL].concat(args), { env: Object.assign({}, process.env,
    { FIRESTORE_BASE: FS, FIREBASE_KEY: 'stand-in', GITHUB_ACTIONS: '' }), encoding: 'utf8', stdio: 'pipe' }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; }
}
const day = 86400000, at = ms => new Date(Date.now() + ms).toISOString();
const doc = (path, expireAt) => ({ update: { name: 'projects/' + P + '/databases/(default)/documents/' + path,
  fields: { expireAt: { timestampValue: expireAt }, fromName: { stringValue: 'Hidden Kitchen' }, name: { stringValue: 'Secret Stew' } } } });
const exists = async path => { const r = await fetch(DOCS + '/' + path, { headers: H }); return r.ok; };
async function count(col) {
  let n = 0, tok = '';
  do { const d = await j(DOCS + '/' + col + '?pageSize=300' + (tok ? '&pageToken=' + encodeURIComponent(tok) : '')); n += (d.documents || []).length; tok = d.nextPageToken; } while (tok);
  return n;
}

// 305 expired sent recipes (more than one page of 300), 2 within their weeks, 1 expired picture,
// 1 picture within its weeks, and an expired-looking document in another collection.
const writes = [];
for (let i = 0; i < 305; i++) writes.push(doc('recipeGifts/old' + String(i).padStart(3, '0') + 'AAAAAAAAAAAAAAAAAA', at(-day - i * 1000)));
writes.push(doc('recipeGifts/freshAAAAAAAAAAAAAAAAAAA', at(27 * day)), doc('recipeGifts/fresh2AAAAAAAAAAAAAAAAAA', at(60000)));
writes.push(doc('recipeGiftPhotos/old000AAAAAAAAAAAAAAAAAA', at(-day)), doc('recipeGiftPhotos/freshAAAAAAAAAAAAAAAAAAA', at(27 * day)));
writes.push(doc('recipes/keepme', at(-day)));
await j(DOCS + ':commit', { method: 'POST', body: JSON.stringify({ writes: writes.slice(0, 300) }) });
await j(DOCS + ':commit', { method: 'POST', body: JSON.stringify({ writes: writes.slice(300) }) });
ok('set up: 307 sent recipes, 2 pictures', (await count('recipeGifts')) === 307 && (await count('recipeGiftPhotos')) === 2);

let r = run(['--project', P]);
ok('the job ends well', r.code === 0, r.out);
ok('every expired sent recipe is gone (more than one page)', (await count('recipeGifts')) === 2, r.out);
ok('the ones within their 4 weeks stay', (await exists('recipeGifts/freshAAAAAAAAAAAAAAAAAAA')) && (await exists('recipeGifts/fresh2AAAAAAAAAAAAAAAAAA')));
ok('the expired picture is gone, the other stays', !(await exists('recipeGiftPhotos/old000AAAAAAAAAAAAAAAAAA')) && (await exists('recipeGiftPhotos/freshAAAAAAAAAAAAAAAAAAA')));
ok('other collections are never touched', await exists('recipes/keepme'));
ok('it says how many', /305 recipe\(s\), 1 picture\(s\)/.test(r.out), r.out);
ok('nothing but counts in the log', !/Hidden Kitchen|Secret Stew|old0|fresh|keepme/.test(r.out), r.out);

r = run(['--project', P]);
ok('a second run finds nothing more', r.code === 0 && /0 recipe\(s\), 0 picture\(s\)/.test(r.out) && (await count('recipeGifts')) === 2, r.out);

r = run([]);
ok('no project, no run', r.code === 2);

console.log(failed ? failed + ' failed' : 'all passed');
process.exit(failed ? 1 : 0);
