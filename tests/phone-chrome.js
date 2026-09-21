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

  // `header` is what is VISIBLE, not the element's height. Since v36.27 the
  // header slides up behind the top of the viewport rather than shrinking, so
  // its height never changes — rect.bottom is the number that matters to
  // someone looking at their phone.
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
      header: Math.round(hr.bottom),
      bar: Math.round(br.height),
      slide: Math.round(-hr.top),
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
  expect('the header is whole at the top', top.slide <= 0, `${top.slide}px of it is already gone`);
  expect(`fixed chrome at the top is under ${(MAX_CHROME_AT_TOP * 100).toFixed(0)}%`,
    topShare <= MAX_CHROME_AT_TOP, `${(topShare * 100).toFixed(1)}% — something new is living in the header`);

  await scrollTo(400);
  const scrolled = await read();
  const scrolledShare = (scrolled.header + scrolled.bar) / scrolled.viewport;
  console.log(`  scrolling:   header ${scrolled.header} + bar ${scrolled.bar} = ${scrolled.header + scrolled.bar}px `
    + `(${(scrolledShare * 100).toFixed(1)}%), ${top.header - scrolled.header}px given back`);
  expect('scrolling takes the brand row away', scrolled.header < top.header,
    `the header still fills ${scrolled.header}px`);
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

  // The point of v36.27: it moves AT THE PACE OF THE SCROLL rather than
  // vanishing at a threshold. Halfway through the slide the header must have
  // moved by exactly the distance scrolled — that is the difference between
  // "slides out under your thumb" and "disappears", and a threshold-based
  // version passes every other assertion in this file.
  const slideMax = top.header - scrolled.header;
  for (const y of [Math.round(slideMax * 0.25), Math.round(slideMax * 0.5), Math.round(slideMax * 0.75)]) {
    await scrollTo(y);
    const mid = await read();
    expect(`at ${y}px scrolled the header has moved ${y}px`, Math.abs((top.header - mid.header) - y) <= 2,
      `it moved ${top.header - mid.header}px — the header is jumping, not sliding`);
    expect(`…and the filter bar is still against it at ${y}px`, Math.abs(mid.gap) <= 2,
      `a ${mid.gap}px gap opened mid-slide`);
  }

  // Coming BACK has to be just as paced. A version that restores the header the
  // moment you scroll up, or restores it in one step, passes everything above —
  // this is the only place the upward direction is checked, and it is checked
  // from deep in the page so the return is a real return and not a wobble.
  await scrollTo(900);
  const deep = await read();
  expect('deep in the page the header is still just the pinned part', deep.header === scrolled.header,
    `${deep.header}px against ${scrolled.header}px`);
  let prev = deep;
  for (const y of [Math.round(slideMax * 0.75), Math.round(slideMax * 0.5), Math.round(slideMax * 0.25), 0]) {
    await scrollTo(y);
    const up = await read();
    const grew = up.header - prev.header;
    const moved = Math.abs(prev.y === undefined ? 0 : 0);   // distances come from the scroll targets
    expect(`scrolling up to ${y}px gives the header back gradually`,
      grew >= 0 && up.header === top.header - y,
      `the header is ${up.header}px at y=${y}; expected ${top.header - y} — it is reappearing in a jump`);
    expect(`…and the filter bar stays against it at ${y}px`, Math.abs(up.gap) <= 2,
      `a ${up.gap}px gap opened on the way back`);
    prev = up;
  }

  const back = await read();
  expect('it comes back whole at the top', back.header === top.header,
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
