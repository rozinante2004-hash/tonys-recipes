#!/usr/bin/env node
/**
 * Phone chrome budget (v36.23, audit U1). Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/phone-chrome.js --port 8137
 *
 * It exists for the same reason tests/contrast-scan.js does: the thing being
 * measured only happens BELOW 700px, and the self-test suite runs at the
 * headless default width, so every assertion about the phone would sit there
 * passing vacuously. This drives a real 390×844 viewport.
 *
 * What it defends: on a phone, 198px of header plus an 85px filter bar was 34%
 * of the screen before a single recipe. Scrolling now stands the header down.
 * The numbers below are a BUDGET, not a description — if a future change puts
 * another row in the header, this fails and says by how much.
 */
function loadPlaywright() {
  // Same resolution order as the other runners: CI installs playwright into the
  // workspace, this sandbox has it under /opt.
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

// Budgets, as a share of a 390×844 screen.
const MAX_CHROME_AT_TOP   = 0.36;   // it was 0.335 — this is headroom, not a target
const MAX_CHROME_SCROLLED = 0.26;   // measured 0.233 after v36.23
const MIN_RECLAIMED_PX    = 60;     // measured 86

let failures = [];
function expect(name, cond, detail) {
  if (cond) console.log(`  ok   ${name}`);
  else { failures.push(`${name}: ${detail}`); console.log(`  FAIL ${name} — ${detail}`); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const crashes = [];
  page.on('pageerror', e => crashes.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });

  // The page has to be long enough to scroll, or every "after scrolling"
  // measurement silently reads the top of the page.
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__phoneChromePad'; d.style.height = '3000px';
    document.body.appendChild(d);
  });

  const read = () => page.evaluate(() => {
    const h = document.querySelector('.header');
    const bar = document.getElementById('mobileFilterBar');
    const hr = h.getBoundingClientRect(), br = bar.getBoundingClientRect();
    const visible = sel => {
      const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      return !!(el && el.offsetWidth && el.offsetHeight);
    };
    const byText = (sel, re) => Array.prototype.slice.call(document.querySelectorAll(sel))
      .filter(b => re.test(b.textContent) && b.offsetWidth).length > 0;
    return {
      header: Math.round(hr.height),
      bar: Math.round(br.height),
      collapsed: h.classList.contains('collapsed'),
      gap: Math.round(br.top - hr.bottom),
      viewport: window.innerHeight,
      search: visible('#searchInput'),
      add: byText('.btn-primary', /Add Recipe/),
      barCovered: br.top < hr.bottom - 2,
    };
  });
  const scrollTo = async y => { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(120); };

  console.log('Phone chrome at 390x844:');
  await scrollTo(0);
  const top = await read();
  const topShare = (top.header + top.bar) / top.viewport;
  console.log(`  at the top:  header ${top.header} + bar ${top.bar} = ${top.header + top.bar}px `
    + `(${(topShare * 100).toFixed(1)}% of the screen)`);
  expect('the header is expanded at the top', !top.collapsed, 'it starts collapsed');
  expect(`fixed chrome at the top is under ${(MAX_CHROME_AT_TOP * 100).toFixed(0)}%`,
    topShare <= MAX_CHROME_AT_TOP, `${(topShare * 100).toFixed(1)}% — something new is living in the header`);

  await scrollTo(400);
  const scrolled = await read();
  const scrolledShare = (scrolled.header + scrolled.bar) / scrolled.viewport;
  console.log(`  scrolling:   header ${scrolled.header} + bar ${scrolled.bar} = ${scrolled.header + scrolled.bar}px `
    + `(${(scrolledShare * 100).toFixed(1)}%), ${top.header - scrolled.header}px given back`);
  expect('scrolling collapses the header', scrolled.collapsed, 'the class was never applied');
  expect(`at least ${MIN_RECLAIMED_PX}px is given back`, top.header - scrolled.header >= MIN_RECLAIMED_PX,
    `only ${top.header - scrolled.header}px`);
  expect(`fixed chrome while scrolling is under ${(MAX_CHROME_SCROLLED * 100).toFixed(0)}%`,
    scrolledShare <= MAX_CHROME_SCROLLED, `${(scrolledShare * 100).toFixed(1)}%`);

  // What a phone is actually for has to survive the collapse. Settings may go —
  // it is one flick away — but not these.
  expect('search survives the collapse', scrolled.search, 'the search field went with the header');
  expect('+ Add Recipe survives the collapse', scrolled.add, 'the primary action went with the header');

  // The filter bar is pinned by an explicit `top`, so it has to be re-pinned
  // when the header shrinks. Getting this wrong is not subtle: it either floats
  // in a brown gap or sits on top of the first row of recipes.
  expect('the filter bar follows the header up', Math.abs(scrolled.gap) <= 2,
    `it sits ${scrolled.gap}px from the header`);
  expect('the filter bar does not cover the recipes', !scrolled.barCovered, 'it overlaps the header');

  // Hysteresis. One threshold flickers: collapsing shortens the page, which can
  // scroll you back above the line, which expands it again.
  await scrollTo(60);
  const between = await read();
  expect('it does not flap between the thresholds', between.collapsed,
    'it expanded again at 60px, so it will flicker while scrolling');

  await scrollTo(0);
  const back = await read();
  expect('it comes back at the top', !back.collapsed, 'the header never returns');
  expect('and comes back to its full height', back.header === top.header,
    `${back.header}px against ${top.header}px`);

  expect('nothing threw while scrolling', crashes.length === 0, crashes.slice(0, 2).join(' | '));

  await browser.close();
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('\nphone chrome budget met');
})();
