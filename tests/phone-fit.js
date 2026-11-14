#!/usr/bin/env node
/**
 * Windows that must fit a phone (v38.84). Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/phone-fit.js --port 8137
 *
 * Tony, 23 Oct 2026, two screenshots from his iPhone: "They are messy and do not fit the screen. Please adjust them
 * to a mobile use as well as the PC one. On the PC it looks very good." 👥 Family Access put six things on one line —
 * the name shrank to nothing, 💬 Chat was drawn over it, ✕ and the role menu stood outside the card; and the owner's
 * 📊 Households took the whole page sideways (its tabs ran off the screen) with a ten-column table squeezed into it.
 * Both only go wrong below about 600–700 px, where the self-test suite never looks — so this drives a real 390×844
 * phone (and 360, a small one), with stand-in people and households, and measures: nothing may stick out of its card,
 * a name must have room, and the page must not scroll sideways. A computer's width is checked too (1280): the PC look
 * Tony likes must not change, and the row of someone asking to add recipes did not fit there either.
 *
 * v39.24 — Tony, 2 Nov 2026: "the opened modals (like a recipe) do not match the screen's size. They often open too big,
 * or to the side … All modals should auto-adjust their sizes to the screen when opened." So, with a signed-in kitchen and
 * recipes with long names: on 320 px (an iPhone with Display Zoom — the header made the page 49 px wider than that) and on
 * 390 px, and on 390 px zoomed in as a phone does after a tap in a small text box, every window and menu checked here
 * must open inside what the screen shows, and the page must not be wider than the screen.
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

async function familyAccess(page) {
  await page.evaluate(() => {
    const l = document.getElementById('loginScreen'); if (l) l.style.display = 'none';
    window._fbUser = { uid: 'uMe', email: 'owner.longname@example.com', displayName: 'Owner Longname' };
    window._household = { hid: 'hH', role: 'owner', name: 'Admin Kitchen Notes', code: 'MKN-J5DM-F9BX', ownerUid: 'uMe', ownerName: 'Owner Longname',
      ownerEmail: 'owner.longname@example.com', links: [{ hid: 'hL', name: 'Tester’s Kitchen Notes', code: 'MKN-QPMV-F5VB', at: 1 }], asking: [] };
    window.cloudLayout = () => 'households'; window.householdOf = () => null; window.householdCanManage = () => true;
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify([
      { email: 'person.one@example.com', name: 'Person Schvekher-Longname', role: 'write', hhRole: 'editor', uid: 'u1' },
      { email: 'michal.d@example.com', name: 'Michal Dlongname', role: 'read', hhRole: 'viewer', uid: 'u2', asks: true },
      { email: 'gal.someone@example.com', name: '', role: 'read', hhRole: 'viewer', pending: true }]));
    openAccessControl();
  });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#accessOverlay .access-row').forEach(row => {
      if (!row.offsetParent) return;
      const rr = row.getBoundingClientRect(), what = row.textContent.trim().replace(/\s+/g, ' ').slice(0, 30);
      Array.from(row.children).forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.width && (r.right > rr.right + 1 || r.left < rr.left - 1)) out.push(`“${what}”: ${(c.className || c.tagName)} sticks out by ${Math.round(Math.max(r.right - rr.right, rr.left - r.left))}px`);
      });
      const info = row.querySelector(':scope > .access-info');
      if (info && info.getBoundingClientRect().width < 120) out.push(`“${what}”: the name has ${Math.round(info.getBoundingClientRect().width)}px`);
      // nothing drawn over the name
      const name = row.querySelector('.access-name');
      if (name) Array.from(row.querySelectorAll('button, select')).forEach(b => {
        const a = name.getBoundingClientRect(), c = b.getBoundingClientRect();
        if (c.width && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) out.push(`“${what}”: ${b.textContent.trim().slice(0, 12)} is drawn over the name`);
      });
    });
    return { out, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

async function households(page) {
  await page.evaluate(async () => {
    window.isAppOwner = () => true; window.feedbackInboxHere = () => true;
    const realFetch = window.fetch;
    window.fetch = async (u, o) => (String(u) === WORKER_ENDPOINT ? new Response(JSON.stringify({ notes: [], errors: [] }), { status: 200 }) : realFetch(u, o));
    await loadManagement();
    mknManage.reload = async () => true;
    await mknManage.open();
    const S = mknManage._state, now = Date.now();
    const mk = (hid, name, copy, owner, n, usd, links) => ({ key: copy + ':' + hid, hid, name, code: 'MKN-AAAA-2222', copy, remote: copy !== 'beta', owner,
      members: Array.from({ length: n }, (_, i) => ({ email: i ? 'member' + i + '@example.com' : owner, role: i ? 'viewer' : 'owner', uid: hid + i, lastSeen: now })),
      cap: 10, capSet: false, month: usd, months: [{ month: '2026-10', usd, calls: 3 }, { month: '2026-09', usd: 0, calls: 0 }],
      links: links.map(x => ({ name: x, code: 'MKN-XXXX-1111' })), referred: 1, lastSeen: now, asked: [], asking: [], left: [],
      createdAt: now, note: '', features: {}, project: 'p', reportAt: now, capped: true });
    S.rows = [mk('hA', 'Admin Kitchen Notes', 'beta', 'owner.longname@example.com', 3, 1.2, ['Tester’s Kitchen Notes']),
      mk('hF', 'Admin Kitchen Notes', 'family', 'owner.longname@example.com', 2, 0, []),
      mk('hT', 'Tester’s Kitchen Notes', 'beta', 'tester1.longname@proton.example', 1, 0.3, ['Admin Kitchen Notes'])];
    S.meter = { defaults: { cap: 2, firstMonth: 4 }, months: ['2026-10', '2026-09'], capped: true };
    S.founding = false; S.notes = []; S.errors = [];
    mknManage._render();
  });
  await page.waitForTimeout(300);
  const res = {};
  for (const step of ['households', 'details', 'feedback', 'errors', 'use', 'survey']) {
    await page.evaluate(step => {
      if (step === 'details') mknManage.show('beta:hA'); else if (step !== 'households') mknManage.tabTo(step);
    }, step);
    await page.waitForTimeout(200);
    res[step] = await page.evaluate(() => {
      const ov = document.getElementById('manageOverlay'), vw = ov.clientWidth, wide = [];
      ov.querySelectorAll('*').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > vw + 1 && !el.closest('.mg-scroll:not(.mg-hhwrap)')) wide.push((el.className || el.tagName) + ' ' + Math.round(r.right)); });
      return { sideways: ov.scrollWidth - ov.clientWidth, wide: wide.slice(0, 4) };
    });
  }
  return res;
}

async function windowsFit(page) {
  await page.evaluate(() => {
    const l = document.getElementById('loginScreen'); if (l) l.style.display = 'none';
    window._fbUser = { uid: 'uMe', email: 'owner.longname@example.com', displayName: 'Owner Longname', emailVerified: true, providerData: [{ providerId: 'google.com' }] };
    window._household = { hid: 'hH', role: 'owner', name: 'Admin Kitchen Notes', code: 'MKN-J5DM-F9BX', ownerUid: 'uMe', ownerName: 'Owner Longname',
      links: [{ hid: 'hL', name: 'Tester’s Kitchen Notes', code: 'MKN-QPMV-F5VB', at: 1 }], asking: [] };
    recipes.length = 0;
    ['Slow-roasted lamb shoulder with pomegranate molasses, za’atar and charred lemon', 'מרק עגבניות קלויות עם בצל, שום וטימין', 'Shakshuka'].forEach((n, i) =>
      recipes.push(normalizeRecipe({ id: 9000 + i, uid: 'u' + i, name: n, category: 'Soups', emoji: '🍲', time: '1h 30m', servings: 4, difficulty: 'Medium', tags: ['family', 'holiday'],
        ingredients: [{ a: '2 tbsp', n: 'olive oil, extra-virgin, the good one from the market' }], steps: ['Heat the oil in a heavy, wide, ovenproof pot until shimmering.'],
        source: 'https://www.example.com/a/very/long/path/to/a/recipe/page/that/goes/on', updatedAt: Date.now() })));
    try { renderFilters(); renderGrid(); householdBrand(); } catch (e) {}
  });
  await page.waitForTimeout(300);
  const measure = sel => page.evaluate(sel => {
    const vv = window.visualViewport, de = document.documentElement;
    const scr = vv ? { l: vv.offsetLeft, t: vv.offsetTop, r: vv.offsetLeft + vv.width, b: vv.offsetTop + vv.height } : { l: 0, t: 0, r: innerWidth, b: innerHeight };
    const out = { page: de.scrollWidth - de.clientWidth };
    if (!sel) return out;
    const ov = document.querySelector(sel); if (!ov) return Object.assign(out, { problem: 'did not open' });
    const card = ov.matches('.drop-menu') ? ov : Array.from(ov.children).find(c => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 40) || ov;
    const r = card.getBoundingClientRect();
    if (r.left < scr.l - 1 || r.top < scr.t - 1 || r.right > scr.r + 1 || r.bottom > scr.b + 1)
      out.problem = `outside the screen: ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')} on ${[scr.l, scr.t, scr.r, scr.b].map(Math.round).join(',')}`;
    return out;
  }, sel);
  const res = { main: await measure(null) };
  const wins = [
    ['a recipe', 'openView(9000)', '#viewOverlay', 'closeView()'],
    ['a recipe in Hebrew', 'openView(9001)', '#viewOverlay', 'closeView()'],
    ['the recipe editor', 'openAddModal(9000)', '#editOverlay', "document.getElementById('editOverlay').classList.remove('open')"],
    ['··· More', "toggleDrop('moreDrop')", '#moreDrop', "closeDrop('moreDrop')"],
    ['⚙️ Settings', "toggleDrop('settingsDrop')", '#settingsDrop', "closeDrop('settingsDrop')"],
    ['Help', 'openHelp()', '#helpOverlay', "document.getElementById('helpOverlay').classList.remove('open')"],
    ['the player', 'openTourClip()', '#playerOverlay', "closeM('playerOverlay')"],   // v39.72
    // v39.74 — a recipe's source in the player: a tall clip (a reel) and a wide film, each with its "open outside" row (a stand-in address: nothing is fetched)
    ['the player, a tall clip from a video site', "openPlayer({ title: '\u{1F3AC} Cook One\u2019s shakshuka with a rather long name', titleIsData: true, embed: 'about:blank#fit', aspect: '9 / 16', outside: 'https://example.com/v/1' })", '#playerOverlay', "closeM('playerOverlay')"],
    ['the player, a wide film from a video site', "openPlayer({ title: '\u{1F3AC} Cook One\u2019s soup', titleIsData: true, embed: 'about:blank#fit', aspect: '16 / 9', outside: 'https://example.com/v/2' })", '#playerOverlay', "closeM('playerOverlay')"],
    ['👥 Family Access', 'openAccessControl()', '#accessOverlay', "document.getElementById('accessOverlay').classList.remove('open')"],
    ['📤 Share', 'toggleShare(9000)', '#shareRecipeOverlay', "document.getElementById('shareRecipeOverlay').classList.remove('open')"],
    ['a question', "askConfirm({ icon: '🔑', title: 'Reset their password?', message: 'Sends someone.with.a.long.address@example.com an e-mail.', okLabel: 'Send the e-mail' })", '#askOverlay', "document.getElementById('askOverlay').remove()"],
    ['a Service Error', "showServiceError('PERMISSION: test\\n\\nhttps://console.firebase.google.com/u/0/project/my-kitchen-notes-beta/firestore/databases/-default-/security/rules')", '#serviceErrorOverlay', "document.getElementById('serviceErrorOverlay').remove()"],
  ];
  // v39.25 — a finger a little off a small button still lands on it (an invisible margin round the header's round
  // buttons and a card's ❤️, which are drawn 24–28 px)
  res['a tap just beside a small button'] = await page.evaluate(() => {
    const out = { page: 0 }, miss = [];
    if (!matchMedia('(pointer: coarse)').matches) return out;
    [['the header\u2019s ⚙️', '#settingsBtn'], ['a card\u2019s ❤️', '#recipeGrid .fav-btn']].forEach(([what, sel]) => {
      const el = document.querySelector(sel); if (!el) { miss.push(what + ' is not there'); return; }
      if (el.getBoundingClientRect().bottom > innerHeight) el.scrollIntoView({ block: 'center' });   // below the fold on 320 px
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top - 6;
      if (y < 0) return;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) miss.push(`a tap 6 px above ${what} landed on ${hit ? (hit.id || hit.className || hit.tagName) : 'nothing'}`);
    });
    window.scrollTo(0, 0);
    if (miss.length) out.problem = miss.join('; ');
    return out;
  });
  // v39.25 — a notice with a button: its words beside or above the button, not one word to a line (the backup reminder,
  // centred with left:50%, had half the screen to lay out in)
  res['a notice with a button'] = await page.evaluate(async () => {
    toastAction('💾 No backup has been taken yet', 'Back up now', function () {}, 9000);
    await new Promise(r => setTimeout(r, 450));
    const t = document.getElementById('toast'), span = t.querySelector('span'), vv = window.visualViewport;
    const r = t.getBoundingClientRect(), sr = span.getBoundingClientRect(), out = { page: 0 };
    const lines = span.getClientRects().length;   // one box per line of an inline element
    // (a notice is not a window: on a page zoomed in it is not fitted to the screen — checked at the normal zoom only)
    if (vv && Math.abs(vv.scale - 1) > 0.01) { toastHide(t); return out; }
    if (sr.width < 100 || lines > 2) out.problem = `its words are ${Math.round(sr.width)} px wide over ${lines} lines`;
    if (r.left < -1 || r.right > document.documentElement.clientWidth + 1) out.problem = 'it sticks out of the screen';
    toastHide(t);
    return out;
  });
  for (const [label, open, sel, close] of wins) {
    // `void`: a question's window answers only when someone presses a button — not waited for here
    try { await page.evaluate('void (' + open + ')'); } catch (e) { res[label] = { problem: 'could not open: ' + String(e.message || e).slice(0, 80) }; continue; }
    await page.waitForTimeout(450);
    res[label] = await measure(sel);
    try { await page.evaluate(close); } catch (e) { /* closed already */ }
    await page.waitForTimeout(120);
  }
  return res;
}

(async () => {
  const browser = await chromium.launch();
  // v39.24 — every window opens inside what the screen shows: a small screen, a usual one, and one zoomed in
  for (const [w, h, zoom, label] of [[320, 690, 1, 'an iPhone with Display Zoom'], [390, 844, 1, 'iPhone'], [390, 844, 1.25, 'iPhone, zoomed in after a tap in a text box']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const crashes = [];
    page.on('pageerror', e => crashes.push(String(e && e.message || e)));
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
    if (zoom !== 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom }); await page.waitForTimeout(300); }
    console.log(`\n${label} (${w}px${zoom !== 1 ? ', zoom ' + zoom : ''}): the windows`);
    const res = await windowsFit(page);
    Object.keys(res).forEach(k => expect(k === 'main' ? 'the page is not wider than the screen' : `${k}: opens inside the screen`,
      !res[k].problem && res[k].page <= 0, res[k].problem || `the page is ${res[k].page}px wider than the screen`));
    expect('no page errors', !crashes.length, crashes.join(' | '));
    await ctx.close();
  }
  // v39.29 — the Self Test window's ▶ Execute row on the screen (Tony's iPhone, 3 Nov 2026: "the Execute button is placed
  // too low on the screen"): Safari tabs on an iPhone 15 and an SE, a small Android, and the installed app on an
  // iPhone 15 with its notch band and home bar — env() is 0 in Chromium, so --top-safe / --bottom-safe stand in for it.
  for (const [w, h, label, safe] of [[393, 659, 'an iPhone 15, Safari tab'], [375, 548, 'an iPhone SE, Safari tab'], [360, 640, 'a small Android phone'],
                                     [393, 852, 'an iPhone 15, the installed app', { top: 83, bottom: 34 }]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
    if (safe) await page.addStyleTag({ content: `:root { --top-safe: ${safe.top}px; --bottom-safe: ${safe.bottom}px; }` });
    const r = await page.evaluate(async (bar) => {
      const l = document.getElementById('loginScreen'); if (l) l.style.display = 'none';
      try { setSelfTestsEnabled(true); } catch (e) {}
      await loadSelfTests(); await openSelfTest();
      await new Promise(res => setTimeout(res, 700));
      const m = document.getElementById('selfTestModal').getBoundingClientRect(), x = document.getElementById('selfTestRunBtn').getBoundingClientRect();
      const list = document.getElementById('selfTestList').getBoundingClientRect(), floor = innerHeight - bar, out = {};
      if (x.bottom > m.bottom + 0.5) out.problem = `▶ Execute ends ${Math.round(x.bottom - m.bottom)} px below the window's edge`;
      else if (x.bottom > floor + 0.5) out.problem = `▶ Execute ends ${Math.round(x.bottom - floor)} px under the home bar or off the screen`;
      else if (list.height < 90) out.problem = `the list of tests is only ${Math.round(list.height)} px tall`;
      return out;
    }, safe ? safe.bottom : 0);
    expect(`the Self Test window, ${label} (${w}×${h}): ▶ Execute on the screen`, !r.problem, r.problem);
    await ctx.close();
  }
  for (const [w, h, label] of [[390, 844, 'iPhone'], [360, 740, 'a small phone'], [1280, 900, 'a computer']]) {
    for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, isMobile: w < 600, hasTouch: w < 600 });
      const page = await ctx.newPage();
      const crashes = [];
      page.on('pageerror', e => crashes.push(String(e && e.message || e)));
      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });
      console.log(`\n${label} (${w}px, ${scheme})`);
      const fa = await familyAccess(page);
      expect(`👥 Family Access: every row inside its card, names with room`, !fa.out.length, fa.out.join('; '));
      expect(`👥 Family Access: the page does not scroll sideways`, fa.sideways <= 0, `${fa.sideways}px`);
      await page.evaluate(() => { const o = document.getElementById('accessOverlay'); if (o) o.classList.remove('open'); });
      const hh = await households(page);
      Object.keys(hh).forEach(k => expect(`📊 Households (${k}): fits the width`, hh[k].sideways <= 0 && !hh[k].wide.length,
        `${hh[k].sideways}px sideways; too wide: ${hh[k].wide.join(', ')}`));
      expect('no page errors', !crashes.length, crashes.join(' | '));
      await ctx.close();
    }
  }
  await browser.close();
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('\nevery window checked fits');
})();
