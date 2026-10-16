#!/usr/bin/env node
/**
 * Double-clicks, with a real mouse (v38.48). Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/double-click.js --port 8137
 *
 * Tony, as a new tester on Firefox: after "Start my own recipe collection" the
 * Free-hand window "automatically opened". It was the second half of a
 * double-click: the first click on "Let's cook! 🍳" closed the box, and the
 * second landed on "✍️ Paste the text", which sits right under it. The app now
 * counts a double-click only in the window where it began.
 *
 * The self-test suite cannot show this: a click a script makes is never a
 * "real" one, and the guard only ever holds back real ones. Playwright's mouse
 * is real to the page, so this is where it is proved.
 */
function loadPlaywright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(m); } catch (e) { /* try the next one */ }
  }
  console.error('Could not require("playwright").');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const PORT = (function () {
  const i = process.argv.indexOf('--port');
  return (i > -1 && process.argv[i + 1]) ? process.argv[i + 1] : '8137';
})();

let failures = [];
function expect(name, cond, detail) {
  if (cond) console.log(`  ok   ${name}`);
  else { failures.push(`${name}: ${detail}`); console.log(`  FAIL ${name} — ${detail}`); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1819, height: 995 } });   // Tony's screen
  const crashes = [];
  page.on('pageerror', e => crashes.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });

  // A button that fills the screen, above the sign-in screen: whatever a stray
  // click lands on, it lands here and is counted.
  async function underneath() {
    await page.evaluate(() => {
      const old = document.getElementById('__under'); if (old) old.remove();
      const b = document.createElement('button');
      b.id = '__under'; b.textContent = 'under';
      b.style.cssText = 'position:fixed;inset:0;z-index:10000;opacity:0.01;';
      window.__under = 0; b.onclick = () => { window.__under++; };
      document.body.appendChild(b);
    });
  }
  async function centre(sel) {
    return page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  }
  // Clear of the last test's double-click, so the next one starts a new count.
  const settle = () => page.waitForTimeout(800);

  // 1. Tony's case: a box's button double-clicked. The first click answers it;
  //    the second must not reach what was under the box.
  await underneath();
  await page.evaluate(() => { window.__ans = 'pending'; askConfirm({ title: 'Name your kitchen', message: 'x', okLabel: 'Let’s cook!', z: 10001 }).then(v => { window.__ans = v; }); });
  await page.waitForSelector('#askOverlay #askOk');
  let p = await centre('#askOverlay #askOk');
  await page.mouse.dblclick(p.x, p.y);
  await page.waitForTimeout(200);
  let st = await page.evaluate(() => ({ ans: window.__ans, under: window.__under, box: !!document.getElementById('askOverlay') }));
  expect('the double-clicked button answers the box', st.ans === true && !st.box, JSON.stringify(st));
  expect('…and its second click does not reach what was under the box', st.under === 0, `the button under it was clicked ${st.under} time(s)`);

  // 2. The other way round: a page button that opens a box, double-clicked.
  //    The second click must not land in the new box (its backdrop closes it).
  await settle();
  await page.evaluate(() => {
    const u = document.getElementById('__under');
    window.__ans = 'pending';
    u.onclick = () => { window.__under++; askConfirm({ title: 'Opened', message: 'x', okLabel: 'OK', z: 10001 }).then(v => { window.__ans = v; }); };
  });
  await page.mouse.dblclick(30, 30);   // the corner: the box's backdrop, once it is there
  await page.waitForTimeout(200);
  st = await page.evaluate(() => ({ ans: window.__ans, under: window.__under, box: !!document.getElementById('askOverlay') }));
  expect('a box opened by the first click stays open after the second', st.box && st.ans === 'pending', JSON.stringify(st));
  expect('…and was opened once', st.under === 1, `opened ${st.under} time(s)`);
  await page.evaluate(() => { const o = document.getElementById('askOverlay'); if (o) o.querySelector('#askCancel').click(); });

  // 3. Nothing changes under the mouse: both clicks count, as they always did.
  await settle();
  await underneath();
  await page.mouse.dblclick(400, 400);
  st = await page.evaluate(() => ({ under: window.__under }));
  expect('a double-click where nothing opens or closes counts twice', st.under === 2, `counted ${st.under}`);

  // 4. Two separate clicks, a moment apart: the second is a click of its own.
  await settle();
  await underneath();
  await page.evaluate(() => { askConfirm({ title: 'Once more', message: 'x', okLabel: 'OK', z: 10001 }); });
  await page.waitForSelector('#askOverlay #askOk');
  p = await centre('#askOverlay #askOk');
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(800);
  await page.mouse.click(p.x, p.y);
  st = await page.evaluate(() => ({ under: window.__under }));
  expect('a later, separate click on the page counts', st.under === 1, `counted ${st.under}`);

  expect('nothing threw', crashes.length === 0, crashes.slice(0, 2).join(' | '));
  await browser.close();
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('\ndouble-clicks stay where they began');
})();
