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
const MAX_CHROME_SCROLLED = 0.13;   // measured 0.101 after v36.30 — the bar alone
const MIN_RECLAIMED_PX    = 150;    // measured 206: the whole header

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
  // How far the header can move, from the app itself. Inferring it by comparing
  // two samples breaks the moment the behaviour is direction-based, because
  // reaching the second sample can itself move the header.
  const slideMax = await page.evaluate(() => window.headerSlidePx());

  console.log('Phone chrome at 390x844:');
  await scrollTo(0);
  const top = await read();
  const topShare = (top.header + top.bar) / top.viewport;
  console.log(`  at the top:  header ${top.header} + bar ${top.bar} = ${top.header + top.bar}px `
    + `(${(topShare * 100).toFixed(1)}% of the screen)`);
  expect('the header is whole at the top', top.slide <= 0, `${top.slide}px of it is already gone`);
  expect(`fixed chrome at the top is under ${(MAX_CHROME_AT_TOP * 100).toFixed(0)}%`,
    topShare <= MAX_CHROME_AT_TOP, `${(topShare * 100).toFixed(1)}% — something new is living in the header`);

  // It moves AT THE PACE OF THE SCROLL rather than vanishing at a threshold.
  // Measured on the way DOWN, monotonically from the top — since v36.28 the
  // header follows the thumb, so scrolling up to reach a sample point would
  // bring it back and make this read as a jump.
  {
    let prev = top, travelled = 0;
    for (const step of [Math.round(slideMax / 4), Math.round(slideMax / 4), Math.round(slideMax / 4)]) {
      travelled += step;
      await scrollTo(travelled);
      const mid = await read();
      expect(`at ${travelled}px scrolled the header has moved ${travelled}px`,
        Math.abs((top.header - mid.header) - travelled) <= 2,
        `it moved ${top.header - mid.header}px — the header is jumping, not sliding`);
      expect(`…and the filter bar is still against it at ${travelled}px`, Math.abs(mid.gap) <= 2,
        `a ${mid.gap}px gap opened mid-slide`);
      prev = mid;
    }
  }

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

  // v36.30 — the WHOLE header goes now, search and + Add Recipe with it. That
  // is deliberate: they are one upward scroll away, and what is left is the
  // filter bar on its own. So the assertion is the opposite of what it was —
  // and that they come BACK is checked further down, which is the half that
  // makes this acceptable rather than merely smaller.
  expect('the whole header goes, not just part of it', scrolled.header <= 2,
    `${scrolled.header}px of header is still on screen`);
  expect('the filter bar is what is left', scrolled.bar > 40, `the bar is ${scrolled.bar}px`);

  // The filter bar is pinned by an explicit `top`, so it has to be re-pinned
  // when the header shrinks. Getting this wrong is not subtle: it either floats
  // in a brown gap or sits on top of the first row of recipes.
  expect('the filter bar follows the header up', Math.abs(scrolled.gap) <= 2,
    `it sits ${scrolled.gap}px from the header`);
  expect('the filter bar does not cover the recipes', !scrolled.barCovered, 'it overlaps the header');

  // Coming BACK. Since v36.28 the header is DIRECTION-based: it follows the
  // thumb, so scrolling up anywhere in the page brings it back at the same pace
  // — not only near the top. This is measured from deep in the list, because
  // that is the exact case the position-based version could not do and the one
  // a regression would silently reintroduce.
  await scrollTo(1500);
  const deep = await read();
  expect('deep in the page the header is just the pinned part', deep.header === scrolled.header,
    `${deep.header}px against ${scrolled.header}px`);

  const stepPx = Math.max(8, Math.round(slideMax / 4));
  let y = 1500, prev = deep;
  for (let n = 1; n <= 3; n++) {
    y -= stepPx;
    await scrollTo(y);
    const up = await read();
    expect(`scrolling up ${stepPx}px mid-page gives back ${stepPx}px`,
      Math.abs((up.header - prev.header) - stepPx) <= 2,
      `the header grew ${up.header - prev.header}px — it is not following the scroll upwards`);
    expect(`…and the filter bar stays against it (up, step ${n})`, Math.abs(up.gap) <= 2,
      `a ${up.gap}px gap opened on the way back`);
    prev = up;
  }
  expect('it is still mid-page, not near the top', y > 1000, `y=${y}`);

  // …and reversing again hides it again, from the same spot. A version that
  // simply restores the header once and leaves it would pass everything above.
  for (let n = 1; n <= 2; n++) {
    y += stepPx;
    await scrollTo(y);
    const down = await read();
    expect(`scrolling back down ${stepPx}px takes ${stepPx}px away again`,
      Math.abs((prev.header - down.header) - stepPx) <= 2,
      `the header shrank ${prev.header - down.header}px — it only moves one way`);
    prev = down;
  }

  // Search and + Add Recipe must be back the moment the header is, or hiding the
  // whole thing has taken away the two controls a phone is actually for.
  await scrollTo(y - slideMax - 20);
  const revealed = await read();
  expect('scrolling up brings search back', revealed.search, 'search never returned');
  expect('…and + Add Recipe with it', revealed.add, 'the primary action never returned');

  await scrollTo(0);
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
