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

(async () => {
  const browser = await chromium.launch();
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
