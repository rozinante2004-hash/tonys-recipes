// The "Save recipes" extension (any site; buttons on Facebook, Instagram, TikTok) (extension 1.0, after app v37.22), in a real Chromium with
// the extension installed, against an imitation Facebook feed and reel page
// (the real Facebook needs a signed-in person, and cannot be reached from CI).
//
//   node tools/build-extension.mjs test && node tests/extension.mjs
//
// Checks: a button under each post with text (not under comments, not under a
// post with no text); clicking it opens "See more" and sends the WHOLE post
// text — not the comments — and the post's link to the app, after '#'; a reel
// page gets a floating button that sends its caption.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reqCwd = createRequire(path.join(process.cwd(), 'noop.js'));
let playwright;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { playwright = reqCwd(p); break; } catch (e) {} }
if (!playwright) { console.error('Could not require("playwright")'); process.exit(2); }
// Both builds at once, as Tony runs them (1.2): each must put its own button
// under every post.
const ext = path.join(repo, 'dist-extension', 'test'), extLive = path.join(repo, 'dist-extension', 'live');
for (const d of [ext, extLive]) if (!fs.existsSync(path.join(d, 'manifest.json'))) { console.error('build both first: node tools/build-extension.mjs test / live'); process.exit(2); }
const VERSION = JSON.parse(fs.readFileSync(path.join(repo, 'extension', 'manifest.json'), 'utf8')).version;
const appOf = d => (/MKN_APP = "([^"]+)"/.exec(fs.readFileSync(path.join(d, 'config.js'), 'utf8')) || [])[1];
const APP = appOf(ext), APP_LIVE = appOf(extLive);
// 1.7 — the store copy (live) sends to My Kitchen Notes (the beta), and to the
// family app once this browser has opened it.
const APP_FAMILY = (/MKN_FAMILY_APP = "([^"]+)"/.exec(fs.readFileSync(path.join(extLive, 'config.js'), 'utf8')) || [])[1];
if (!APP_FAMILY || APP_FAMILY === APP_LIVE) { console.error('the store build has no family app beside the beta'); process.exit(2); }

let failures = 0;
const ok = (name, cond, detail) => { if (cond) console.log('  ok   ' + name); else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } };

const FULL = '🍫✨ העוגה הוויראלית – שכבות שוקולד\nמצרכים:\n• 6 ביצים\n• כוס סוכר\n• כוס שמן\nאופן הכנה:\n1. טורפים ביצים וסוכר עד שהתערובת בהירה';
const feed = `<!doctype html><meta charset=utf-8><body>
<div role="banner"><span>Facebook</span><div role="button">More</div></div>
<div role="feed">
  <div role="article" id="p1">
    <div data-ad-comet-preview="message"><div dir="auto" id="cap">🍫✨ העוגה הוויראלית – שכבות שוקולד… <div role="button" id="more">See more</div></div></div>
    <a href="https://www.facebook.com/patisselir/posts/pfbid123?__cft__[0]=x">2h</a>
    <div role="article" aria-label="Comment by Dana"><div dir="auto">What a beautiful cake, I must try this one this weekend with my kids!!!</div></div>
  </div>
  <div role="article" id="p2"><img alt="just a photo" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>
  <div role="article" id="p3"><div dir="auto">Lentil soup: 1 cup lentils, 1 onion, 2 carrots, 1 litre water. Cook 30 minutes and blend.</div></div>
</div>
<script>document.getElementById('more').onclick=function(){ document.getElementById('cap').innerText=${JSON.stringify(FULL)}+'\\nSee less'; };</script>`;
const reel = `<!doctype html><meta charset=utf-8><meta property="og:description" content="short"><body>
<div role="banner"><span>Facebook</span></div>
<div><video></video><div dir="auto" id="rc">Hazelnut mousse: 120 g dark chocolate, 120 g milk chocolate, 300 g cream. Melt, chill, whip.</div></div>`;

const IGFULL = 'Shakshuka for two 🍳\nIngredients:\n4 eggs\n2 tomatoes\n1 pepper\nMethod: fry the pepper, add tomatoes, crack the eggs, cover 6 minutes.';
const insta = `<!doctype html><meta charset=utf-8><body>
<nav><a href="/">Instagram</a><div role="button">More</div></nav>
<main><article id="ig1">
  <header><a href="/chef">chef</a></header>
  <div><h1 dir="auto" id="igcap">Shakshuka for two 🍳 Ingredients: 4 eggs…</h1><div role="button" id="igmore">more</div></div>
  <a href="https://www.instagram.com/p/ABC123/">2d</a>
  <ul><li><span dir="auto">Looks delicious, I will make it tomorrow morning for the whole family!</span></li></ul>
</article></main>
<script>document.getElementById('igmore').onclick=function(){ document.getElementById('igcap').innerText=${JSON.stringify('X')}.replace('X', ${JSON.stringify('IGFULL_PLACEHOLDER')}); this.remove(); };</script>`.replace('IGFULL_PLACEHOLDER', IGFULL.replace(/\n/g, '\\n'));
const tiktok = `<!doctype html><meta charset=utf-8><body>
<div data-e2e="browse-video-desc">Easy focaccia: 500 g flour, 400 ml water, 10 g salt, 7 g yeast. Rest overnight, bake at 230°C for 25 minutes.</div>
<div data-e2e="comment-list"><span>So good!!! Tried it yesterday and my family loved it, thank you for sharing</span></div>`;

// Instagram's reels feed (1.3): the reel scrolled past (a challah) is still in
// the page above the screen, the next one below, and the page's summary line
// is from the first reel the tab ever opened. Only the one ON SCREEN counts.
const AGLIO = 'Michelin star aglio e olio 🍝\nIngredients: 200 g spaghetti, 6 cloves garlic, 80 ml olive oil, chilli flakes, parsley.\nMethod: toast the garlic slowly, toss with the pasta and a ladle of pasta water.';
const reels = `<!doctype html><meta charset=utf-8>
<meta property="og:url" content="https://www.instagram.com/reel/OLDCHALLAH/">
<meta property="og:description" content="חלות שנשארות טריות לאורך זמן — 1 ק״ג קמח, 2 ביצים, שמרים, סוכר, שמן. לשים, להתפיח ולאפות.">
<body style="margin:0"><nav><a href="/">Instagram</a><span role="button">More</span></nav>
<main>
 <div class="reel" style="position:absolute;top:-1400px;height:900px"><span dir="auto">חלות שנשארות טריות לאורך זמן — 1 ק״ג קמח, 2 ביצים, שמרים, סוכר, שמן. לשים, להתפיח ולאפות.</span></div>
 <div class="reel" style="position:absolute;top:60px;height:600px"><span dir="auto" id="ag">Michelin star aglio e olio 🍝 Ingredients: 200 g spaghetti… <span role="button" id="agmore">more</span></span></div>
 <div class="reel" style="position:absolute;top:1400px;height:900px"><span dir="auto">Next reel: chocolate chip cookies with 250 g butter, 200 g sugar, 2 eggs, 300 g flour and a lot of chocolate.</span></div>
</main>
<script>document.getElementById('agmore').onclick=function(){ document.getElementById('ag').innerText=${JSON.stringify('X')}.replace('X', 'AGLIO_PLACEHOLDER'); };</script>`.replace('AGLIO_PLACEHOLDER', AGLIO.replace(/\n/g, '\\n'));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mkn-ext-'));
const ctx = await playwright.chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true,
  args: ['--disable-extensions-except=' + ext + ',' + extLive, '--load-extension=' + ext + ',' + extLive],
});
try {
  await ctx.route('https://www.facebook.com/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
    body: /\/reel\//.test(r.request().url()) ? reel : feed }));
  await ctx.route('https://www.instagram.com/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
    body: /\/reels\//.test(r.request().url()) ? reels : insta }));
  await ctx.route('https://www.tiktok.com/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: tiktok }));
  await ctx.route(APP + '**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>app</title>' }));
  await ctx.route(APP_LIVE + '**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>the beta</title>' }));
  // 1.7.1 — the family app marks its page once a household is open (?member=1 here, a moment after loading).
  await ctx.route(APP_FAMILY + '**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>family app</title>'
    + (/member=1/.test(r.request().url()) ? '<script>setTimeout(function(){ document.documentElement.setAttribute("data-mkn-member", "1"); }, 300);</script>' : '') }));
  const page = await ctx.newPage();
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.mkn-save').length >= 4, null, { timeout: 15000 }).catch(() => {});
  const where = await page.evaluate(() => Array.from(document.querySelectorAll('.mkn-save')).map(b => (b.closest('[role="article"]') && b.closest('[role="article"]').id || '(none)') + (/TEST/.test(b.textContent) ? ':test' : ':family')));
  ok('both builds: a button each under every post with text', ['p1:test', 'p1:family', 'p3:test', 'p3:family'].every(w => where.includes(w)), JSON.stringify(where));
  ok('…not under a comment, nor under a post with no text', where.length === 4 && !where.some(w => /^p2/.test(w)), JSON.stringify(where));
  // 1.5 — the app's logo; the words come out on hover.
  const look = await page.evaluate(() => { const b = document.querySelector('#p1 .mkn-save.mkn-test'); const l = b && b.querySelector('.mkn-label');
    return b && { img: !!b.querySelector('img.mkn-ico[src^="chrome-extension://"]'), w: l.getBoundingClientRect().width, aria: b.getAttribute('aria-label') }; });
  ok('1.5: the button is the app\'s logo, its words folded away', look && look.img && look.w < 2 && /Save recipe to My Kitchen Notes \(TEST\)/.test(look.aria), JSON.stringify(look));
  await page.hover('#p1 .mkn-save.mkn-test');
  await page.waitForTimeout(400);
  const wOpen = await page.evaluate(() => document.querySelector('#p1 .mkn-save.mkn-test .mkn-label').getBoundingClientRect().width);
  ok('…and they slide out on hover', wOpen > 80, String(wOpen));
  await page.mouse.move(0, 0);
  ok('…placed under the post\'s text', await page.evaluate(() => { const m = document.querySelector('#p1 [data-ad-comet-preview="message"]'); return !!m && !!m.nextElementSibling && m.nextElementSibling.classList.contains('mkn-save'); }));
  const [opFam] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('#p1 .mkn-save:not(:has-text("TEST"))')]);
  ok('1.7: the store build\'s button sends to My Kitchen Notes (the beta), not the family app', opFam.url().startsWith(APP_LIVE) && !opFam.url().startsWith(APP_FAMILY) && /share-text=/.test(opFam.url()), opFam.url().slice(0, 80));
  await opFam.close();

  const [opened] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('#p1 .mkn-save:has-text("TEST")')]);
  const u = opened.url();
  const h = new URLSearchParams(u.split('#')[1] || '');
  ok('clicking it opens the app', u.startsWith(APP), u.slice(0, 80));
  ok('…with the WHOLE text, "See more" opened', h.get('share-text') === FULL, JSON.stringify((h.get('share-text') || '').slice(0, 80)));
  ok('…and nothing of the comments', !/beautiful cake/.test(h.get('share-text') || ''));
  ok('…with the post\'s own link', /\/posts\/pfbid123/.test(h.get('share-url') || '') && !/__cft__/.test(h.get('share-url') || ''), h.get('share-url'));
  ok('…the text only after "#", which no server receives', !/share-text/.test(u.split('#')[0]));
  await opened.close();

  const [op3] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('#p3 .mkn-save:has-text("TEST")')]);
  ok('a post Facebook does not mark still gives its text', /Lentil soup/.test(new URLSearchParams(op3.url().split('#')[1] || '').get('share-text') || ''));
  await op3.close();

  await page.goto('https://www.facebook.com/reel/999', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mkn-float-test', { timeout: 15000 }).catch(() => {});
  ok('a reel page gets a floating button from each build, not on top of each other', await page.evaluate(() => {
    const a = document.querySelector('.mkn-float-test'), b = document.querySelector('.mkn-float-live');
    return !!a && !!b && Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) > 20; }));
  const [op4] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('.mkn-float-test')]);
  const h4 = new URLSearchParams(op4.url().split('#')[1] || '');
  ok('…which sends the reel\'s caption and its address', /Hazelnut mousse/.test(h4.get('share-text') || '') && /\/reel\/999/.test(h4.get('share-url') || ''), op4.url().slice(0, 120));

  // Instagram: under the post, its caption with "more" opened, not the comments.
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#ig1 .mkn-save').length === 2, null, { timeout: 15000 }).catch(() => {});
  ok('Instagram: a button under the post (one per build)', await page.evaluate(() => document.querySelectorAll('.mkn-save').length === 2));
  const [op5] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('#ig1 .mkn-save:has-text("TEST")')]);
  const h5 = new URLSearchParams(op5.url().split('#')[1] || '');
  ok('…sends the whole caption ("more" opened), not the comments, with the post\'s link',
     h5.get('share-text') === IGFULL && /instagram\.com\/p\/ABC123/.test(h5.get('share-url') || ''), JSON.stringify([h5.get('share-text'), h5.get('share-url')]));
  ok('…and the site\'s own "More" menu was never clicked', await page.evaluate(() => !!document.querySelector('nav [role="button"]')));
  await op5.close();

  // Instagram's reels feed: the reel ON SCREEN, never the one scrolled past or
  // the page's stale summary (Tony: an old challah instead of aglio e olio).
  await page.goto('https://www.instagram.com/reels/DaS-2PjBkJ9/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mkn-float-test', { timeout: 15000 }).catch(() => {});
  const [op7] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('.mkn-float-test')]);
  const t7 = new URLSearchParams(op7.url().split('#')[1] || '').get('share-text') || '';
  ok('Instagram reels: the reel on screen, "more" opened — not the one scrolled past, nor the page\'s old summary',
     t7 === AGLIO && !/חלות/.test(t7) && !/cookies/.test(t7), JSON.stringify(t7.slice(0, 120)));
  ok('…and the menu called More was never clicked', await page.evaluate(() => !!document.querySelector('nav [role="button"]')));
  await op7.close();
  // The toolbar button on the same page asks the extension's own script there.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mkn-float-test', { timeout: 15000 }).catch(() => {});
  let sw = null;
  for (const w of ctx.serviceWorkers()) { try { if (await w.evaluate(() => MKN_TAG) === 'test') sw = w; } catch (e) {} }
  await page.bringToFront();
  if (!sw) ok('the TEST build\'s background is running', false);
  else {
    // (The tab the extension opens goes to the real app, which this sandbox
    // cannot reach: record the address it is asked to open instead.)
    const u8 = await sw.evaluate(async () => {
      let asked = null; const real = chrome.tabs.create;
      chrome.tabs.create = async o => { asked = o.url; };
      try { const ts = await chrome.tabs.query({ active: true }); await mknSendFromTab(ts[0]); } finally { chrome.tabs.create = real; }
      return asked;
    });
    const t8 = new URLSearchParams(String(u8 || '').split('#')[1] || '').get('share-text') || '';
    ok('…the toolbar button sends the same reel, opened by the extension itself', String(u8).startsWith(APP) && t8 === AGLIO, String(u8).slice(0, 160));
  }

  // TikTok: a video page gets the floating button; it sends the description.
  await page.goto('https://www.tiktok.com/@baker/video/7300000000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mkn-float-test', { timeout: 15000 }).catch(() => {});
  const [op6] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('.mkn-float-test')]);
  const t6 = new URLSearchParams(op6.url().split('#')[1] || '').get('share-text') || '';
  ok('TikTok: a video page sends its description, not the comments', /^Easy focaccia/.test(t6) && !/Tried it yesterday/.test(t6), JSON.stringify(t6));

  // Any website (1.2): the toolbar button / right-click menu read the recipe
  // the page embeds for search engines (schema.org JSON-LD) first.
  await ctx.route('https://recipes.example/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset=utf-8>
    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name: 'x' }, {
      '@type': ['Recipe'], name: 'Lemon drizzle cake', recipeYield: ['8', '8 slices'], prepTime: 'PT20M', cookTime: 'PT1H5M',
      recipeIngredient: ['225 g butter', '225 g caster sugar', '4 eggs'],
      recipeInstructions: [{ '@type': 'HowToSection', name: 'Cake', itemListElement: [{ '@type': 'HowToStep', text: 'Beat the butter and sugar.' }, { '@type': 'HowToStep', text: 'Add the eggs.' }] },
                           { '@type': 'HowToSection', name: 'Drizzle', itemListElement: [{ '@type': 'HowToStep', text: 'Mix lemon juice and sugar.' }] }] }] })}</script>
    <body><nav>Home · Recipes · Shop</nav><main><h1>Lemon drizzle cake</h1><p>My grandmother's story, 2,000 words…</p></main>` }));
  await page.goto('https://recipes.example/lemon-drizzle', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: path.join(ext, 'shared.js') });
  const any = await page.evaluate(() => mknTakeFromPage());
  ok('any site: the recipe the page embeds is read — ingredients, sections, times, servings',
     /^Lemon drizzle cake/.test(any) && /- 225 g caster sugar/.test(any) && /Cake:\n1\. Beat the butter/.test(any) && /Drizzle:\n3\. Mix lemon/.test(any)
       && /Servings: 8/.test(any) && /Prep: 20 min/.test(any) && /Cook: 1 h 5 min/.test(any) && !/grandmother/.test(any), JSON.stringify(any));
  await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('main')); getSelection().removeAllRanges(); getSelection().addRange(r); });
  ok('…but what the person selected wins', /grandmother/.test(await page.evaluate(() => mknTakeFromPage())));

  // 1.4 — on the app's own pages, each build says it is installed (the app then
  // stops offering it); on any other site it writes nothing.
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const markTest = await page.evaluate(() => [document.documentElement.getAttribute('data-mkn-extension-test'), document.documentElement.getAttribute('data-mkn-extension-live')]);
  ok('1.6: …and that it was loaded from a folder (a store copy says "store")', await page.evaluate(() => document.documentElement.getAttribute('data-mkn-extension-test-from')) === 'folder');
  // 1.7 — the store copy on the beta's pages says so under the beta's name …
  await page.goto(APP_LIVE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const markBeta = await page.evaluate(() => [document.documentElement.getAttribute('data-mkn-extension-beta'), document.documentElement.getAttribute('data-mkn-extension-live'), document.documentElement.getAttribute('data-mkn-extension-test')]);
  // … and on the family app's under the family's.
  await page.goto(APP_FAMILY, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const markLive = await page.evaluate(() => [document.documentElement.getAttribute('data-mkn-extension-live'), document.documentElement.getAttribute('data-mkn-extension-test')]);
  // 1.7.1 — Tony: opening the family app's address is NOT enough to send there.
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.mkn-save').length >= 4, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const [opVisit] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('#p1 .mkn-save:not(:has-text("TEST"))')]);
  ok('1.7.1: merely opening the family app\'s address does not make the store copy send there', opVisit.url().startsWith(APP_LIVE) && !opVisit.url().startsWith(APP_FAMILY), opVisit.url().slice(0, 80));
  await opVisit.close();
  // … only a household opened there for the person (the app's mark) does.
  await page.goto(APP_FAMILY + '?member=1', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  ok('1.4: on each app\'s own page, that build says it is installed — and only that one', markTest[0] === VERSION && !markTest[1] && markLive[0] === VERSION && !markLive[1], JSON.stringify([markTest, markLive]));
  ok('1.7: the store copy says so on the beta\'s pages too, under the beta\'s name', markBeta[0] === VERSION && !markBeta[1] && !markBeta[2], JSON.stringify(markBeta));
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('.mkn-save').length >= 4, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const [opFam2] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), page.click('#p1 .mkn-save:not(:has-text("TEST"))')]);
  ok('1.7.1: once the family app has opened a household here, the store copy sends there', opFam2.url().startsWith(APP_FAMILY) && /share-text=/.test(opFam2.url()), opFam2.url().slice(0, 80));
  await opFam2.close();
  await page.goto('https://recipes.example/lemon-drizzle', { waitUntil: 'load' });
  ok('…and nothing on any other site', !(await page.evaluate(() => [...document.documentElement.attributes].some(a => /^data-mkn-extension/.test(a.name)))));
} finally {
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
if (failures) { console.log('\n' + failures + ' extension check(s) failed'); process.exit(1); }
console.log('\nall extension checks passed');
