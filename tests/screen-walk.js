#!/usr/bin/env node
/**
 * The screen walk (the audit of 10 Nov 2026, v39.63): every main screen on a phone (English and Hebrew, light and
 * dark) and on a computer, with a signed-in kitchen of ten recipes (a collection, a link, a Hebrew recipe). Each
 * screen gets a screenshot and a measurement — sideways scroll, anything outside the screen, text under 12 px, tap
 * targets under 30 px, the page's own errors — and the summary says which screens need a look. Not run by CI (it is
 * for looking, after a change to the screens):
 *
 *     python3 -m http.server 8137 &
 *     node tests/screen-walk.js <out-dir> [phone-en,phone-he,phone-dark,pc-en] [--port 8137]
 */
function loadPlaywright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return require(m); } catch (e) { /* next */ } }
  console.error('Could not require("playwright").'); process.exit(2);
}
const { chromium } = loadPlaywright();
const PORT = (function () { const i = process.argv.indexOf('--port'); return (i > -1 && process.argv[i + 1]) ? process.argv[i + 1] : '8137'; })();
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const WANT = (process.argv[3] || 'phone-en,phone-he,phone-dark,pc-en').split(',');
const VARIANTS = {
  'phone-en':   { w: 390, h: 844, mobile: true, scheme: 'light', lang: '' },
  'phone-he':   { w: 390, h: 844, mobile: true, scheme: 'light', lang: 'he' },
  'phone-dark': { w: 390, h: 844, mobile: true, scheme: 'dark',  lang: '' },
  'pc-en':      { w: 1280, h: 900, mobile: false, scheme: 'light', lang: '' },
};
const FIX = `
  const l = document.getElementById('loginScreen'); if (l) l.style.display = 'none';
  window._fbUser = { uid: 'uMe', email: 'dana.cohen@example.com', displayName: 'Dana Cohen', emailVerified: true, providerData: [{ providerId: 'google.com' }], getIdToken: async () => 'tok' };
  window._household = { hid: 'hH', role: 'owner', name: 'Dana’s Kitchen', code: 'MKN-J5DM-F9BX', ownerUid: 'uMe', ownerName: 'Dana Cohen',
    links: [{ hid: 'hL', name: 'Grandma’s Kitchen', code: 'MKN-QPMV-F5VB', at: 1 }], asking: [] };
  window.cloudLayout = () => 'households';
  recipes.length = 0;
  const mk = (id, name, cat, extra) => normalizeRecipe(Object.assign({ id, uid: 'u' + id, name, category: cat, emoji: '🍲', time: '45m', servings: 4, difficulty: 'Medium',
    ingredients: [{ a: '2 tbsp', n: 'olive oil' }, { a: '1', n: 'onion, chopped' }, { a: '400 g', n: 'tomatoes' }, { a: '', n: 'salt and pepper' }],
    steps: ['Heat the oil in a wide pan over medium heat.', 'Fry the onion until soft, about 8 minutes.', 'Add the tomatoes and simmer 20 minutes.', 'Season and serve.'],
    notes: 'Serve with crusty bread.', source: 'https://www.example.com/recipes/' + id, updatedAt: Date.now() - id * 1000, createdAt: Date.now() - id * 86400e3 }, extra || {}));
  recipes.push(mk(700001, 'Shakshuka', 'Breakfast', { favorite: true, diets: ['Vegetarian'], cookedDates: [Date.now() - 2 * 86400e3], rating: 5 }));
  recipes.push(mk(700002, 'Slow-roasted lamb shoulder with pomegranate', 'Dinner', { time: '4h', difficulty: 'Hard' }));
  recipes.push(mk(700003, 'מרק עדשים אדומות', 'Soup', { ingredients: [{ a: '1 כוס', n: 'עדשים אדומות' }, { a: '1', n: 'בצל' }], steps: ['לטגן את הבצל.', 'להוסיף עדשים ומים ולבשל 25 דקות.'] }));
  recipes.push(mk(700004, 'Tahini sauce', 'Snack', { time: '5m', difficulty: 'Easy', ingredients: [{ a: '1/2 cup', n: 'tahini' }, { a: '1', n: 'lemon, juiced' }] }));
  recipes.push(mk(700005, 'Falafel', 'Lunch', { diets: ['Vegan'], links: [{ t: 'tahini sauce', to: 700004, h: '' }], steps: ['Blend the chickpeas with herbs.', 'Fry in batches.', 'Serve in pita with tahini sauce and salad.'] }));
  recipes.push(mk(700006, 'Chocolate babka', 'Dessert', { time: '3h', difficulty: 'Hard' }));
  recipes.push(mk(700007, 'Friday night dinner', 'Dinner', { parts: [
    { uid: 'p1', name: 'Chicken soup', category: 'Soup', ingredients: [{ a: '1', n: 'chicken' }, { a: '3', n: 'carrots' }], steps: ['Simmer 2 hours.'] },
    { uid: 'p2', name: 'Roast potatoes', category: 'Dinner', ingredients: [{ a: '1 kg', n: 'potatoes' }], steps: ['Roast at 220° for 45 minutes.'] },
    { uid: 'p3', name: 'Apple cake', category: 'Dessert', ingredients: [{ a: '3', n: 'apples' }, { a: '2', n: 'eggs' }], steps: ['Bake 50 minutes.'] } ] }));
  recipes.push(mk(700008, 'Granola', 'Breakfast', { diets: ['Vegan'] }));
  recipes.push(mk(700009, 'Lemon chicken with potatoes', 'Dinner', {}));
  recipes.push(mk(700010, 'Green salad with za’atar', 'Lunch', { diets: ['Vegan'], time: '10m', difficulty: 'Easy' }));
  try { renderFilters(); renderGrid(); householdBrand(); } catch (e) {}
`;
const SCREENS = [
  ['main', ``],
  ['add-menu', `toggleDrop('addDrop')`],
  ['files-menu', `(function(){ var b=[...document.querySelectorAll('button')].find(x=>/Files/.test(x.textContent)&&x.closest('.header, header')); b && b.click(); })()`],
  ['more-menu', `toggleDrop('moreDrop')`],
  ['more-kitchens', `toggleDrop('moreDrop'); setTimeout(()=>{ var h=[...document.querySelectorAll('#moreDrop .set-head, #moreDrop button')].find(x=>/Kitchens and people/.test(x.textContent)); h && h.click(); }, 150)`],
  ['settings', `toggleDrop('settingsDrop')`],
  ['settings-household', `toggleDrop('settingsDrop'); setTimeout(()=>{ var h=document.querySelector('.set-group[data-group="household"] > .set-head'); h && h.click(); }, 150)`],
  ['sort', `toggleDrop('sortDrop')`],
  ['calc', `openCalcModal()`],
  ['view', `openView(700005)`],
  ['view-steps', `openView(700005); setTimeout(()=>{ var m=document.querySelector('#viewOverlay .modal'); if(m) m.scrollTop=900; var o=document.getElementById('viewOverlay'); if(o) o.scrollTop=900; }, 400)`],
  ['collection', `openView(700007)`],
  ['collection-part', `openView(700007); setTimeout(()=>{ var p=document.querySelector('#viewOverlay [data-coll-part="1"]'); if(p) p.scrollIntoView({block:'start'}); }, 400)`],
  ['editor', `openAddModal(700005)`],
  ['editor-ingredients', `openAddModal(700005); setTimeout(()=>{ var f=document.getElementById('f-ingredients')||document.querySelector('#editOverlay textarea'); if(f) f.scrollIntoView({block:'center'}); }, 400)`],
  ['rl-picker', `openAddModal(700005); setTimeout(()=>{ try { var f=document.getElementById('f-ingredients')||document.querySelector('#editOverlay textarea'); rlPickOpen('ing'); } catch(e){ console.log('rlPickOpen: '+e.message); } }, 400)`],
  ['select', `toggleSelectMode(); setTimeout(()=>{ try { selectedIds.add(700001); selectedIds.add(700002); renderGrid(); if(typeof updateDeleteBar==='function') updateDeleteBar(); if(typeof renderSelectBar==='function') renderSelectBar(); } catch(e){} }, 150)`],
  ['ask-admin-delete', `_household.role='viewer'; _household.ownerUid='uX'; toggleSelectMode(); setTimeout(()=>{ try { selectedIds.add(700001); selectedIds.add(700002); renderGrid(); if(typeof deleteSelected==='function') deleteSelected(); } catch(e){ console.log('del: '+e.message); } }, 150)`],
  ['del-asks', `window.householdCanManage=()=>true; window.hhRef=()=>({ collection:()=>({ get: async()=>({ forEach(f){ [{id:'a1',d:{by:'u1',name:'Yael',what:'recipe',rid:'700002',puid:'',title:'Slow-roasted lamb shoulder with pomegranate',at:Date.now()-3600e3}},{id:'a2',d:{by:'u2',name:'Omer',what:'part',rid:'700007',puid:'p3',title:'Apple cake',at:Date.now()-7200e3}}].forEach(x=>f({id:x.id,data:()=>x.d})); } }) }) }); openDeleteAsks()`],
  ['family-access', `localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify([{ email: 'yael.levi@example.com', name: 'Yael Levi', role: 'write', hhRole: 'editor', uid: 'u1' },{ email: 'omer.cohen@example.com', name: 'Omer Cohen', role: 'read', hhRole: 'viewer', uid: 'u2', asks: true },{ email: 'guest@example.com', name: '', role: 'read', hhRole: 'viewer', pending: true }])); window.householdOf=()=>null; window.householdCanManage=()=>true; openAccessControl()`],
  ['help', `openHelp()`],
  ['help-answer', `window.aiCall=async()=>'**Link one recipe to another**\\n\\n1. Open the recipe and tap ✏️ Edit.\\n2. Select the words (for example "tahini sauce") and tap 🔗.\\n3. Pick the recipe and save.\\n\\nThe words become a link; ← Back returns you.'; openHelp(); setTimeout(()=>{ try { askHelpQ('How do I link one recipe to another?'); } catch(e){ console.log('help: '+e.message); } }, 300)`],
  ['share-app', `window.hhFoundingOpen=async()=>true; openShareAppModal()`],
  ['sync-health', `openSyncHealth()`],
  ['pantry', `openPantry()`],
  ['explore', `openExploreModal()`],
  ['translate', `(function(){ try { openTranslate(700005); } catch(e){ console.log('translate: '+e.message); } })()`],
  ['backup-save', `backupSave()`],
  ['login', `document.getElementById('loginScreen').style.display='flex'`],
  ['empty', `recipes.length=0; renderFilters(); renderGrid()`],
];
(async () => {
  const b = await chromium.launch();
  const report = {};
  for (const vname of WANT) {
    const v = VARIANTS[vname]; if (!v) continue;
    report[vname] = {};
    for (const [name, code] of SCREENS) {
      const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, isMobile: v.mobile, hasTouch: v.mobile, deviceScaleFactor: 1, colorScheme: v.scheme, locale: v.lang === 'he' ? 'he-IL' : 'en-US' });
      const p = await ctx.newPage();
      const errs = [], logs = [];
      p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
      p.on('console', m => { const t = m.text(); if (/Failed to load resource|firestore: Firestore|frame-ancestors|ERR_TUNNEL|net::ERR/.test(t)) return; if (m.type() === 'error' || /rlPickOpen|del:|help:|translate:/.test(t)) logs.push(t.slice(0, 160)); });
      if (v.lang) await p.addInitScript(l => { try { localStorage.setItem('tonys_ui_lang', l); } catch (e) {} }, v.lang);
      await p.route(/firebasejs|gstatic|googleapis|workers\.dev|accounts\.google/, r => r.fulfill({ status: 503, body: '' }));
      await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => typeof openView === 'function' && typeof normalizeRecipe === 'function', null, { timeout: 30000 });
      await p.waitForTimeout(v.lang ? 2500 : 900);
      try { await p.evaluate(FIX); } catch (e) { errs.push('FIX: ' + e.message); }
      await p.waitForTimeout(200);
      try { await p.evaluate(code); } catch (e) { errs.push('STEP: ' + e.message.slice(0, 200)); }
      await p.waitForTimeout(900);
      const m = await p.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight, de = document.documentElement;
        const out = { sideways: de.scrollWidth - de.clientWidth, small: [], taps: [], outside: [], open: [] };
        document.querySelectorAll('[id$="Overlay"].open, [id$="Modal"].open, #askOverlay, .drop.open, .dropdown.open, [id$="Drop"].open').forEach(o => out.open.push(o.id || o.className));
        const seen = new Set();
        document.querySelectorAll('body *').forEach(el => {
          if (!(el instanceof HTMLElement)) return;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
          if (r.bottom < 0 || r.top > vh) return;
          const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0') return;
          const fs = parseFloat(cs.fontSize);
          const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
          if (own && fs && fs < 12 && out.small.length < 12) { const t = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40); const k = fs + '|' + t; if (!seen.has(k)) { seen.add(k); out.small.push(fs + 'px “' + t + '”'); } }
          if ((el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') && r.height < 30 && r.width < 30 && out.taps.length < 10) out.taps.push(el.tagName + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + ' “' + el.textContent.trim().slice(0, 20) + '”');
          if ((r.right > vw + 2 || r.left < -2) && el.offsetParent !== null && !el.closest('.filter-frame, [class*="scroll"], .mg-scroll') && out.outside.length < 8) out.outside.push((el.id || el.className || el.tagName).toString().slice(0, 40) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        });
        return out;
      });
      m.errors = errs; m.logs = logs;
      report[vname][name] = m;
      await p.screenshot({ path: `${OUT}/${vname}-${name}.png`, fullPage: false });
      await ctx.close();
    }
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const vn of Object.keys(report)) for (const s of Object.keys(report[vn])) {
    const m = report[vn][s];
    const flags = [];
    if (m.sideways > 1) flags.push('sideways ' + m.sideways);
    if (m.outside.length) flags.push('outside: ' + m.outside.join(' | '));
    if (m.small.length) flags.push('small: ' + m.small.join(' | '));
    if (m.taps.length) flags.push('taps: ' + m.taps.join(' | '));
    if (m.errors.length) flags.push('ERR: ' + m.errors.join(' | '));
    if (m.logs.length) flags.push('log: ' + m.logs.join(' | '));
    console.log(vn + '/' + s + ': ' + (flags.length ? flags.join(' ;; ') : 'ok') + ' [' + m.open.join(',') + ']');
  }
  await b.close();
})();
