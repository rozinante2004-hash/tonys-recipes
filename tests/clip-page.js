#!/usr/bin/env node
/**
 * The clip's public page (v39.73). Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/clip-page.js --port 8137
 *
 * A tester's invitation links to clip.html, and the person who gets it has no app and no account
 * (Tony: "if installing the app is mandatory for the clip to be viewable, then it cannot be used as a
 * marketing tool"). So this opens the page as a stranger would — an empty browser, a phone's size and a
 * computer's, light and dark — in English and with ?lang=he, and holds it to that promise:
 *   the right clip and still for the language, both really on the site;
 *   nothing of the app (no script file, no service worker, nothing stored, no cookie);
 *   nothing asked of any other site, nothing the page's own policy refused, no error;
 *   the whole clip on the screen without scrolling, no sideways scroll;
 *   readable (axe: serious or critical fails, colour contrast included).
 * Where the browser can play H.264 (not every test browser can) the clip must really start.
 */
const fs = require('fs'), path = require('path');
function loadPlaywright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(m); } catch (e) { /* try the next one */ }
  }
  console.error('Could not require("playwright").');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const PORT = (function () { const i = process.argv.indexOf('--port'); return (i > -1 && process.argv[i + 1]) ? process.argv[i + 1] : '8137'; })();
const ORIGIN = 'http://127.0.0.1:' + PORT;
let axeSrc = '';
try { axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [process.cwd(), path.join(__dirname, '..')] }), 'utf8'); }
catch (e) { console.error('Could not find axe-core (npm install axe-core).'); process.exit(2); }

const failures = [];
function expect(where, name, cond, detail) {
  if (cond) return;
  failures.push(where + ': ' + name + (detail ? ' — ' + detail : ''));
}
const LANGS = [
  { q: '', lang: 'en', dir: 'ltr', sub: 'The app in one minute', tag: 'All your recipes. One place. For good.', by: 'By invitation only. For now' },
  { q: '?lang=he', lang: 'he', dir: 'rtl', sub: 'האפליקציה בדקה אחת', tag: 'כל המתכונים שלכם. במקום אחד. לתמיד.', by: 'בהזמנה בלבד. בינתיים' },
  // an address with more on it still plays the Hebrew clip; any other language plays the English one
  { q: '?utm=x&lang=he', lang: 'he', dir: 'rtl' },
  { q: '?lang=fr', lang: 'en', dir: 'ltr' },
];
const SIZES = [[390, 844], [360, 640], [1280, 800]];

(async () => {
  const browser = await chromium.launch();
  let played = 0, cannot = 0, pages = 0;
  for (const L of LANGS) for (const [w, h] of SIZES) for (const scheme of ['light', 'dark']) {
    if (!L.sub && (w !== 390 || scheme !== 'light')) continue;   // the two extra addresses: once is enough
    const where = (L.q || 'no ?lang') + ' ' + w + 'x' + h + ' ' + scheme;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors = [], foreign = [], failed = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (r.url().indexOf(ORIGIN + '/') !== 0 && !/^(data|blob):/.test(r.url())) foreign.push(r.url()); });
    page.on('requestfailed', r => failed.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    await page.goto(ORIGIN + '/clip.html' + L.q, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    pages++;
    const s = await page.evaluate(async () => {
      const v = document.getElementById('clip'), r = v.getBoundingClientRect(), de = document.documentElement;
      const poster = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = v.poster; });
      const sw = navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0;
      return { lang: de.lang, dir: de.dir || 'ltr', src: v.getAttribute('src'), poster: v.getAttribute('poster'), posterW: poster, clipUrl: v.src,
        controls: v.controls, inline: v.playsInline, preload: v.preload,
        sub: document.getElementById('sub').textContent, tag: document.getElementById('tag').textContent, by: document.getElementById('by').textContent,
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], vw: de.clientWidth, vh: window.innerHeight, sideways: de.scrollWidth - de.clientWidth,
        byBottom: Math.round(document.getElementById('by').getBoundingClientRect().bottom),
        scriptFiles: Array.from(document.scripts).filter(x => x.src).length, sw: sw, stored: localStorage.length + sessionStorage.length, cookie: document.cookie,
        h264: v.canPlayType('video/mp4; codecs="avc1.64001F, mp4a.40.2"') };
    });
    // asked from here, not from the page: the page's own policy lets it fetch nothing (as it should)
    s.clip = await ctx.request.head(s.clipUrl).then(x => x.status() + ' ' + (x.headers()['content-type'] || '') + ' ' + (x.headers()['content-length'] || ''), () => 'failed');
    expect(where, 'the page’s language', s.lang === L.lang && s.dir === L.dir, s.lang + ' ' + s.dir);
    expect(where, 'the clip for the language', s.src === 'media/my-kitchen-notes-clip-' + L.lang + '.mp4' && s.poster === 'media/my-kitchen-notes-clip-' + L.lang + '.jpg', s.src + ' / ' + s.poster);
    expect(where, 'the clip is on the site', /^200 video\/mp4 \d{6,}$/.test(s.clip), s.clip);
    expect(where, 'the still is on the site', s.posterW >= 320, 'width ' + s.posterW);
    expect(where, 'controls, plays in the page, nothing downloaded before a tap', s.controls && s.inline && s.preload === 'none', [s.controls, s.inline, s.preload].join(' '));
    if (L.sub) expect(where, 'the words', s.sub === L.sub && s.tag === L.tag && s.by === L.by, [s.sub, s.tag, s.by].join(' | '));
    expect(where, 'the clip inside the screen', s.box[0] >= 0 && s.box[2] <= s.vw && s.box[1] >= 0 && s.box[3] <= s.vh && (s.box[2] - s.box[0]) >= 240, s.box.join(',') + ' in ' + s.vw + 'x' + s.vh);
    expect(where, 'square', Math.abs((s.box[2] - s.box[0]) - (s.box[3] - s.box[1])) <= 1, s.box.join(','));
    expect(where, 'no sideways scroll', s.sideways <= 0, s.sideways + ' px');
    expect(where, 'nothing of the app', s.scriptFiles === 0 && s.sw === 0 && s.stored === 0 && s.cookie === '', JSON.stringify([s.scriptFiles, s.sw, s.stored, s.cookie]));
    expect(where, 'nothing asked of another site', foreign.length === 0, foreign.join(', '));
    expect(where, 'nothing missing', failed.length === 0, failed.join(', '));
    // readable — axe adds its own inline script, which this page's policy would refuse: so on a second, policy-free load
    const p2 = await ctx.newPage();
    await p2.route('**/clip.html*', async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '') }); });
    await p2.goto(ORIGIN + '/clip.html' + L.q, { waitUntil: 'load' });
    await p2.evaluate(() => document.fonts && document.fonts.ready);
    await p2.addScriptTag({ content: axeSrc });
    const bad = await p2.evaluate(async () => (await axe.run(document)).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id + ' (' + v.nodes.map(n => n.target.join(' ')).join('; ') + ')'));
    expect(where, 'readable (axe)', bad.length === 0, bad.join(', '));
    await p2.close();
    // really plays, where this browser can play H.264
    if (s.h264 && L.sub && w === 390) {
      const t = await page.evaluate(async () => {
        const v = document.getElementById('clip'); v.muted = true;
        try { await v.play(); } catch (e) { return 'play refused: ' + e.message; }
        for (let i = 0; i < 100 && v.currentTime < 0.3 && !v.error; i++) await new Promise(r => setTimeout(r, 100));
        return v.error ? 'error ' + v.error.code : (v.currentTime >= 0.3 && v.videoWidth === 1080 && v.duration > 60 ? 'ok' : 'stuck at ' + v.currentTime + ' (' + v.videoWidth + ', ' + v.duration + ')');
      });
      expect(where, 'the clip starts', t === 'ok', t); played++;
    } else if (!s.h264) cannot++;
    expect(where, 'no error on the page', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  if (failures.length) { console.error('FAIL — the clip’s page:\n  ' + failures.join('\n  ')); process.exit(1); }
  console.log('The clip’s page: ' + pages + ' loads (English, Hebrew; phone and computer; light and dark) — the right clip, nothing of the app, nothing from elsewhere, readable.'
    + (played ? ' The clip started ' + played + ' times.' : '') + (cannot ? ' (This browser cannot play H.264 — playing not tried.)' : ''));
})().catch(e => { console.error(e); process.exit(1); });
