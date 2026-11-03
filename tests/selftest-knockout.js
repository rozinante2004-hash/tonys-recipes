#!/usr/bin/env node
/**
 * Do the Self Tests test what they say? (v39.25) Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/selftest-knockout.js --port 8137 [--workers 3] [--only id,id] [--out report.json]
 *
 * Tony, 3 Nov 2026: "please make sure all the self test tests are indeed testing what they are supposed to test."
 * A test that cannot fail proves nothing. So each test is run as usual (it must pass), and then again with each app
 * function it calls KNOCKED OUT — replaced by one that does nothing and returns nothing — one at a time. A test that
 * still passes whatever is knocked out does not depend on the code it names; it is listed for a person to read and fix.
 * (A knock-out that makes the test fail, or hang, counts as caught. Functions the suite defines itself are not knocked
 * out, nor the browser's own.) Each test gets a freshly loaded page; the page is loaded again after a hang.
 *
 * --subject: does a test depend on what its NAME says? The app functions whose names share a word with the test's id or
 * name ("crud_fav" → toggleFav) are its subject. Each subject it calls is knocked out in a page of its own; a test that
 * passes with every one of them gone, or that calls none of them although the app has them, is listed for a person.
 */
const fs = require('fs');
function loadPlaywright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return require(m); } catch (e) { /* next */ } }
  console.error('Could not require("playwright").'); process.exit(2);
}
const { chromium } = loadPlaywright();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = arg('port', '8137'), WORKERS = +arg('workers', '3'), ONLY = arg('only', ''), OUT = arg('out', ''), CAP = +arg('cap', '14');
const RUN_MS = +arg('ms', '8000');   // a test that runs longer (the farm's animals walk for 5-10 s) needs --ms 30000
const SUITE_SRC = fs.readFileSync(require('path').join(__dirname, '..', 'self-tests.js'), 'utf8');
const SUITE_FUNCS = new Set(Array.from(SUITE_SRC.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)).map(m => m[1]));

async function freshPage(browser) {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.route(/firebasejs|gstatic|googleapis|workers\.dev|accounts\.google/, r => r.fulfill({ status: 503, body: '' }));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.loadSelfTests());
  await page.waitForFunction(() => window._selfTestsLoaded === true, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const o = document.getElementById('selfTestOverlay'); if (o) o.classList.add('open');
    if (typeof window._selfTestPark === 'function') window._parkedForKnockout = await window._selfTestPark();
    if (typeof window._selfTestRunning !== 'undefined') window._selfTestRunning = true;
  });
  return { context, page };
}
async function runOne(page, id, knock) {
  return page.evaluate(async ({ id, knock, ms }) => {
    const t = window.SELF_TESTS.find(x => x.id === id);
    let real = null;
    if (knock) { real = window[knock]; window[knock] = function () { return undefined; }; }
    try {
      const res = await Promise.race([Promise.resolve().then(() => t.test()), new Promise((_, rej) => setTimeout(() => rej(new Error('__hung__')), ms))]);
      return { ok: true, msg: String(res).slice(0, 120) };
    } catch (e) {
      // a crash (the test could not even set itself up) is not the test catching anything
      return { ok: false, err: String((e && e.message) || e).slice(0, 160), hung: String(e && e.message) === '__hung__',
               crash: e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError };
    } finally {
      if (knock) window[knock] = real;
      document.querySelectorAll('#askOverlay').forEach(o => o.remove());
    }
  }, { id, knock, ms: RUN_MS });
}
// A test's own text, from the suite's file — not t.test.toString(): some tests are wrapped when the suite loads (the
// sync-restore list at its end), and the wrapper's text says nothing about what the test calls.
function sourceOf(id) {
  const i = SUITE_SRC.indexOf("{ id:'" + id + "'"); if (i < 0) return '';
  const j = SUITE_SRC.indexOf("\n  { id:'", i + 5);
  return SUITE_SRC.slice(i, j > -1 ? j : i + 20000);
}
function candidatesIn(page, id) {
  return page.evaluate(({ id, suiteFuncs, cap, text }) => {
    const t = window.SELF_TESTS.find(x => x.id === id), src = text || t.test.toString();
    const KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'await', 'async', 'Error', 'String', 'Number', 'Boolean', 'Object', 'Array', 'JSON', 'Math', 'Date', 'Promise', 'RegExp', 'parseInt', 'parseFloat', 'isNaN', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'fetch', 'getComputedStyle', 'encodeURIComponent', 'decodeURIComponent']);
    const seen = new Map();
    for (const m of src.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const n = m[1]; if (KW.has(n) || suiteFuncs.includes(n)) continue;
      const f = window[n]; if (typeof f !== 'function') continue;
      if (/\[native code\]/.test(Function.prototype.toString.call(f))) continue;
      seen.set(n, (seen.get(n) || 0) + 1);
    }
    // what the test is about first; the helpers every test uses to set itself up last
    const GENERIC = new Set(['normalizeRecipe', 'wait', 'saveLocal', 'saveData', 'renderGrid', 'renderFilters', 'escH', 'escA', 'jsA', 'syncLog',
      'readSyncLog', 'purgeSyncLog', 'setLogEnabled', 'logEnabled', 'closeDrop', 'closeM', 'newUid', 'hashStr', 'T', 'i18nPhrase', 'isTestFixture',
      'cancelSelectMode', '_cloudSnapshotForTest', '_cloudRestoreForTest', 'ownerKeyOf', 'loadLocal', 'applyOwnerOnlyItems']);
    return Array.from(seen.entries()).sort((a, b) => (GENERIC.has(a[0]) - GENERIC.has(b[0])) || (b[1] - a[1])).map(e => e[0]).slice(0, cap);
  }, { id, suiteFuncs: Array.from(SUITE_FUNCS), cap: CAP, text: sourceOf(id) });
}

const STOP = new Set(('the and for with not are its one all test tests works work when from into that this what they them then than has have '
  + 'been can cannot does each every only also its it is be by of to in on at as or an a no yes new old own same other once twice still more less '
  + 'after before about like just even never never always any some must may should would could will was were how why who where which while '
  + 'there their here make made makes say says said get gets set sets put use used uses way ways see sees seen keep kept done does doing').split(' '));
function wordsOf(text) {
  return Array.from(new Set(String(text).replace(/\\u[0-9a-f]{4}/gi, ' ').toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 3 && !STOP.has(w))));
}
async function subjectsOf(page, id) {
  return page.evaluate(({ id, suiteFuncs, words, text }) => {
    const tokens = n => n.replace(/^_+/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase().split(' ').filter(Boolean);
    const matches = (tk, w) => tk === w || (w.length >= 4 && tk.length >= 4 && (tk.startsWith(w) || w.startsWith(tk)));
    const all = Object.keys(window).filter(n => { try { return typeof window[n] === 'function' && !suiteFuncs.includes(n) && !/\[native code\]/.test(Function.prototype.toString.call(window[n])); } catch (e) { return false; } });
    const subj = all.filter(n => tokens(n).some(tk => words.some(w => matches(tk, w))));
    const called = new Set(); for (const m of text.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) called.add(m[1]);
    return { called: subj.filter(n => called.has(n)), uncalled: subj.filter(n => !called.has(n)).slice(0, 8), n: subj.length };
  }, { id, suiteFuncs: Array.from(SUITE_FUNCS), words: wordsOf(id.replace(/_/g, ' ') + ' ' + (nameOf(id) || '')), text: sourceOf(id) });
}
function nameOf(id) { const src = sourceOf(id), m = /name:\s*'((?:[^'\\]|\\.)*)'/.exec(src); return m ? m[1] : ''; }

if (process.argv.includes('--subject')) {
  (async () => {
    const browser = await chromium.launch();
    let { context, page } = await freshPage(browser);
    let ids = await page.evaluate(() => window.SELF_TESTS.filter(t => !/^net_/.test(t.id) && t.id !== 'stor_firebase').map(t => t.id));
    await context.close();
    if (ONLY) { const want = ONLY.split(','); ids = ids.filter(i => want.includes(i)); }
    const report = {}; let next = 0, done = 0;
    async function worker() {
      while (next < ids.length) {
        const id = ids[next++], r = report[id] = { id, caught: [], missed: [] };
        try {
          const f0 = await freshPage(browser); const sj = await subjectsOf(f0.page, id); await f0.context.close();
          r.subjects = sj.called; r.uncalled = sj.uncalled;
          for (const k of sj.called.slice(0, 6)) {
            const f = await freshPage(browser);
            let res; try { res = await runOne(f.page, id, k); } catch (e) { res = { ok: false, hung: true }; }
            await f.context.close();
            (res.ok ? r.missed : r.caught).push(k);
            if (!res.ok) break;   // it depends on its subject: enough
          }
        } catch (e) { r.error = String(e.message || e).slice(0, 120); }
        if (++done % 25 === 0) console.error(`… ${done}/${ids.length}`);
      }
    }
    await Promise.all(Array.from({ length: WORKERS }, () => worker()));
    await browser.close();
    const all = Object.values(report);
    const passesWithout = all.filter(r => r.subjects && r.subjects.length && !r.caught.length);
    const neverCalls = all.filter(r => r.subjects && !r.subjects.length && r.uncalled && r.uncalled.length);
    console.log(`\n${all.length} tests; ${all.filter(r => r.caught.length).length} fail without their subject; ${passesWithout.length} pass without it; ${neverCalls.length} call none of the functions their name points to\n`);
    if (passesWithout.length) { console.log('PASS WITH THEIR SUBJECT KNOCKED OUT:'); passesWithout.forEach(r => console.log(`  ${r.id}  [${r.subjects.join(', ')}]`)); }
    if (neverCalls.length) { console.log('\nCALL NONE OF WHAT THEIR NAME POINTS TO (the app has: …):'); neverCalls.forEach(r => console.log(`  ${r.id}  [${r.uncalled.join(', ')}]`)); }
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  })();
} else (async () => {
  const browser = await chromium.launch();
  let { context, page } = await freshPage(browser);
  let ids = await page.evaluate(() => window.SELF_TESTS.filter(t => !/^net_/.test(t.id) && t.id !== 'stor_firebase').map(t => t.id));
  await context.close();
  if (ONLY) { const want = ONLY.split(','); ids = ids.filter(i => want.includes(i)); }
  const report = {};
  let next = 0, done = 0;
  async function worker(w) {
    while (next < ids.length) {
      const id = ids[next++];
      let cp = await freshPage(browser);
      const r = report[id] = { id, caught: [], missed: [], hung: [] };
      try {
        const base = await runOne(cp.page, id, null);
        if (!base.ok) { r.baseline = 'FAILS on its own: ' + base.err; }
        else {
          r.candidates = await candidatesIn(cp.page, id);
          // One knock-out can leave the page changed for the next (a menu left open, a flag left set), so the verdict
          // rests on runs in a page of their own: the first catch is confirmed there, and — for a test that catches
          // nothing in the shared page — every knock-out is run there again before it is called blind.
          const confirm = async (k) => { const f = await freshPage(browser); try { return await runOne(f.page, id, k); } catch (e) { return { ok: false, hung: true }; } finally { await f.context.close(); } };
          for (const k of r.candidates) {
            let res;
            try { res = await runOne(cp.page, id, k); } catch (e) { res = { ok: false, hung: true, err: String(e.message || e).slice(0, 80) }; }
            if (res.hung) { await cp.context.close(); cp = await freshPage(browser); }
            if (res.ok) { r.missed.push(k); continue; }
            const again = await confirm(k);
            if (again.ok) { r.missed.push(k); continue; }   // it failed only because of an earlier knock-out
            if (again.hung) { r.hung.push(k); continue; }
            if (again.crash) { (r.crashed = r.crashed || []).push(k); continue; }
            r.caught.push(k); r.why = String(again.err || '').slice(0, 120); break;
          }
          if (!r.caught.length) {
            const missed = r.missed; r.missed = [];
            for (const k of missed) {
              const res = await confirm(k);
              if (res.ok) r.missed.push(k); else if (res.hung) r.hung.push(k); else if (res.crash) (r.crashed = r.crashed || []).push(k);
              else { r.caught.push(k); r.why = String(res.err || '').slice(0, 120); break; }
            }
          }
        }
      } catch (e) { r.error = String(e.message || e).slice(0, 160); }
      try { await cp.context.close(); } catch (e) { /* closed */ }
      done++;
      if (done % 20 === 0) console.error(`… ${done}/${ids.length}`);
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)));
  await browser.close();
  const all = Object.values(report);
  const blind = all.filter(r => !r.baseline && !r.error && r.candidates && !r.caught.length);
  const failing = all.filter(r => r.baseline);
  console.log(`\n${all.length} tests; ${all.length - blind.length - failing.length} fail when their code is knocked out; ${blind.length} do not; ${failing.length} fail on their own here\n`);
  if (blind.length) {
    console.log('NO ASSERTION OF THEIRS FAILS WHATEVER IS KNOCKED OUT (read these):');
    blind.forEach(r => console.log(`  ${r.id}  [${r.candidates.join(', ') || 'calls no app function'}]` + (r.crashed ? `  crashes without: ${r.crashed.join(', ')}` : '') + (r.hung.length ? `  hangs without: ${r.hung.join(', ')}` : '')));
  }
  if (failing.length) { console.log('\nFAIL ON THEIR OWN HERE:'); failing.forEach(r => console.log(`  ${r.id}: ${r.baseline}`)); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
})();
