#!/usr/bin/env node
/**
 * Tony's Recipes — headless runner for the in-app Self Test suite (5.6).
 *
 * The suite itself lives in index.html as SELF_TESTS and is the real source of
 * truth; this only drives it. Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/run-self-tests.js --port 8137
 *
 * Three things about it are deliberate and easy to get wrong:
 *
 * 1. It opens #selfTestOverlay before running anything. Some checks interact
 *    with modals, and "the topmost dialog" means something different when the
 *    Self Test screen is itself open. A runner that skipped this once let
 *    a11y_basics close the suite out from under itself in the real app while
 *    reporting a clean pass here — the bug reached Tony before it reached CI.
 *
 * 2. net_* and stor_firebase are expected to fail without network and a
 *    signed-in Firebase session, so they are skipped by default rather than
 *    quietly tolerated. --include-network runs them and holds them to the same
 *    standard, for use somewhere they can actually pass.
 *
 * 3. It raises window._selfTestRunning around the loop, because the app's own
 *    runSelfTests() does. This runner calls each t.test() DIRECTLY rather than
 *    going through that function, so anything the app does differently while
 *    tests are running is invisible here otherwise. That is not hypothetical:
 *    v36.3 made syncLog mark the events a test run causes so the log analyser
 *    stops reporting staged failures ("boom", "network down") as real problems,
 *    and without this line the marking worked in Tony's browser and not in CI.
 */
const path = require('path');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* try the next one */ }
  }
  console.error('Could not require("playwright").');
  console.error('Note: `npx playwright install` downloads the browsers but does NOT');
  console.error('make the package resolvable here. Install it too:');
  console.error('  npm install playwright@1.56.1 && npx playwright install chromium');
  process.exit(2);
}

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const PORT = arg('port', '8137');
const INCLUDE_NETWORK = argv.includes('--include-network');
// These need real network and a signed-in Firebase session. They cannot pass in
// a sandbox or in CI, and pretending otherwise would make the suite meaningless.
const NETWORK_DEPENDENT = id => /^net_/.test(id) || id === 'stor_firebase';

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message)));

  // --prefs '{"tonys_view_unit":"imperial"}' — start with a DEVICE's saved
  // settings rather than a factory-fresh browser (v36.54). Four times now a
  // test has failed on Tony's phone and passed here, because something he had
  // chosen (signed in, a recipe with history, a fully illustrated library, and
  // then Imperial units) was simply never true in CI. Written once, before the
  // first load, so a test that changes a setting and puts it back is not
  // second-guessed on a later navigation.
  const PREFS = arg('prefs', '');
  if (PREFS) {
    let prefs;
    try { prefs = JSON.parse(PREFS); } catch (e) { console.error('--prefs is not JSON: ' + e.message); process.exit(2); }
    await page.addInitScript(p => {
      try {
        if (sessionStorage.getItem('__prefsSeeded')) return;
        Object.keys(p).forEach(k => localStorage.setItem(k, p[k]));
        sessionStorage.setItem('__prefsSeeded', '1');
      } catch (e) {}
    }, prefs);
    console.log('starting with device preferences: ' + PREFS);
  }

  const url = `http://127.0.0.1:${PORT}/index.html`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.error(`Could not load ${url} — is the static server running?`);
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(2500);

  // v36.15 — the suite is a separate file, fetched on demand. CI has to ask for
  // it; the app deliberately does not load it on its own.
  try {
    await page.evaluate(() => window.loadSelfTests());
    await page.waitForFunction(() => window._selfTestsLoaded === true, null, { timeout: 20000 });
  } catch (e) {
    console.error('Could not load self-tests.js: ' + e.message);
    console.error('It must sit next to index.html and be served by the same server.');
    await browser.close();
    process.exit(2);
  }

  const ready = await page.evaluate(() => Array.isArray(window.SELF_TESTS) && window.SELF_TESTS.length > 0);
  if (!ready) {
    // A single-file app fails silently and completely on a syntax error, so this
    // is the most likely reason and worth saying out loud.
    console.error('SELF_TESTS is empty — self-tests.js loaded but defined nothing, or index.html threw first.');
    pageErrors.slice(0, 5).forEach(e => console.error('  ' + e));
    await browser.close();
    process.exit(2);
  }

  const results = await page.evaluate(async (includeNetwork) => {
    const overlay = document.getElementById('selfTestOverlay');
    if (overlay) overlay.classList.add('open');   // see note 1 in the header
    // see note 3 — the app raises this flag around its own run, and anything
    // that behaves differently while tests are running is invisible here unless
    // this runner raises it too.
    const hasFlag = typeof window._selfTestRunning !== 'undefined';
    if (hasFlag) window._selfTestRunning = true;
    const out = [];
    for (const t of window.SELF_TESTS) {
      const skip = !includeNetwork && (/^net_/.test(t.id) || t.id === 'stor_firebase');
      if (skip) { out.push({ id: t.id, group: t.group, name: t.name, skipped: true }); continue; }
      const started = Date.now();
      // v36.55 — A TEST MUST LEAVE THE SYNC STATE AS IT FOUND IT. Eleven did
      // not, and Tony's Sync Health report showed their fixtures as a damaged
      // cloud document and two phantom cloud recipes. runSelfTests() now
      // restores the whole lot around a run, so his session is safe either way
      // — this is what keeps each test honest, by failing the one that leaks.
      const fp = typeof window._cloudFingerprintForTest === 'function' ? window._cloudFingerprintForTest : null;
      const before = fp ? fp() : null;
      const snap = typeof window._cloudSnapshotForTest === 'function' ? window._cloudSnapshotForTest() : null;
      // v36.57 — A TEST MUST NOT CHANGE A REAL RECIPE. crud_fav and feat_cook
      // used recipes[0] — on Tony's machine his chestnut collection — and left
      // it stamped modified (and "last cooked" at the time of the run), so the
      // next save wrote it to the family's cloud every time. Fixtures (ids at
      // or above TEST_ID_MIN) are exempt; everything else must come out exactly
      // as it went in.
      // `recipes`, not `window.recipes`: it is a top-level `let`, which is NOT
      // a property of window. Reading window.recipes compared nothing with
      // nothing and passed the old, guilty tests — found by running them.
      // eslint-disable-next-line no-undef
      const realOf = () => JSON.stringify(((typeof recipes !== 'undefined') ? recipes : [])
        .filter(r => !(typeof window.isTestFixture === 'function' && window.isTestFixture(r)))
        .map(r => typeof window.slimRecipeForCloud === 'function' ? window.slimRecipeForCloud(r) : r));
      const realBefore = realOf();
      // v36.61 — A TEST MUST NOT CLAIM A BACKUP WAS TAKEN. Three tests pressed
      // Back up now against a fake folder and left the real device's "last
      // backup" at the moment of the run, which then silenced the reminder.
      const bk = typeof window._backupRecordForTest === 'function' ? window._backupRecordForTest : null;
      const bkBefore = bk ? bk() : null;
      try {
        await t.test();
        if (realOf() !== realBefore)
          throw new Error('changed a REAL recipe (not a fixture) and did not put it back exactly — '
            + 'on a signed-in device that change is written to the family cloud. Use a fixture id ≥ TEST_ID_MIN.');
        if (bk && JSON.stringify(bk()) !== JSON.stringify(bkBefore)) {
          const z = bk();
          const what = Object.keys(z).filter(k => z[k] !== bkBefore[k]);
          throw new Error('left the backup record altered (' + what.join(', ') + ') — the device would '
            + 'believe a backup was taken. Wrap it in _backupRecordForTest() / _backupRecordRestoreForTest()');
        }
        const after = fp ? fp() : null;
        if (fp && before !== after) {
          const a = JSON.parse(before), z = JSON.parse(after);
          const what = Object.keys(z).filter(k => JSON.stringify(a[k]) !== JSON.stringify(z[k]));
          throw new Error('left the sync state altered (' + what.join(', ') + ') — '
            + 'wrap it in _cloudSnapshotForTest() / _cloudRestoreForTest()');
        }
        out.push({ id: t.id, group: t.group, name: t.name, ok: true, ms: Date.now() - started });
      } catch (e) {
        // Put it back regardless, so one leaking test does not make every test
        // after it look like it leaked too.
        if (snap && fp && fp() !== before) window._cloudRestoreForTest(snap);
        if (bk) window._backupRecordRestoreForTest(bkBefore);
        out.push({ id: t.id, group: t.group, name: t.name, ok: false, ms: Date.now() - started,
                   err: String((e && e.message) || e) });
      }
    }
    if (hasFlag) window._selfTestRunning = false;
    return {
      tests: out,
      sawSelfTestFlag: hasFlag,
      suiteStillOpen: !!(overlay && overlay.classList.contains('open')),
      leftOpen: Array.from(document.querySelectorAll('.open')).map(e => e.id).filter(Boolean)
    };
  }, INCLUDE_NETWORK);

  const tests   = results.tests;
  const passed  = tests.filter(t => t.ok).length;
  const failed  = tests.filter(t => t.ok === false);
  const skipped = tests.filter(t => t.skipped);

  console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped (network/Firebase)\n`);

  if (failed.length) {
    console.log('FAILURES');
    for (const f of failed) console.log(`  ✗ [${f.group}] ${f.id} — ${f.name}\n      ${f.err}`);
    console.log('');
  }

  // A test that closes the suite, or strands a dialog, is a real defect even
  // when every assertion passed — it makes every later test run blind.
  let hygiene = 0;
  if (!results.suiteStillOpen) {
    console.log('✗ HYGIENE: a test closed #selfTestOverlay — everything after it ran blind.');
    hygiene++;
  }
  const stranded = results.leftOpen.filter(id => id !== 'selfTestOverlay');
  if (stranded.length) {
    console.log(`✗ HYGIENE: dialogs left open: ${stranded.join(', ')} — close them in finally, not try.`);
    hygiene++;
  }

  if (pageErrors.length) {
    console.log(`\nUncaught page errors (${pageErrors.length}):`);
    pageErrors.slice(0, 5).forEach(e => console.log('  ' + e));
  }

  await browser.close();
  process.exit(failed.length || hygiene ? 1 : 0);
})();
