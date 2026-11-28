// v40.21 — a sent recipe's own page (share/recipe-page.mjs, served at <address>/r/<id> by functions/r/[[path]].js),
// against a stand-in for Firestore's REST answers. What WhatsApp reads for its card (og: tags), the page itself in
// the reader's language, every way it can fail, and its pictures.
//   node tests/share-page.test.mjs
import { handleShare, fsDecode, esc, pageLang, recipeDir } from '../share/recipe-page.mjs';

let failures = 0, checks = 0;
function ok(cond, what) { checks++; if (!cond) { failures++; console.log('FAIL  ' + what); } }

const ID = 'AbCdEfGhIjKlMnOpQrStUvWx', CFG = { projectId: 'demo-beta', site: 'https://mykitchennotes.community/', brand: 'My Kitchen Notes' };
const S = v => ({ stringValue: v }), A = l => ({ arrayValue: { values: l } }), M = o => ({ mapValue: { fields: o } });
const later = new Date(Date.now() + 150 * 864e5).toISOString(), earlier = new Date(Date.now() - 864e5).toISOString();
function giftDoc(extra) {
  return { name: 'projects/demo-beta/databases/(default)/documents/recipeGifts/' + ID, fields: Object.assign({
    name: S('Shakshuka <script>alert(1)</script>'), fromName: S('Tony’s Kitchen Notes'), note: S('The **best** one'),
    photo: { booleanValue: true }, expireAt: { timestampValue: later },
    recipe: M({ emoji: S('🍳'), category: S('Breakfast'), difficulty: S('Easy'), prep: S('25 min'), servings: { integerValue: '4' },
      ingredients: A([M({ sub: S('For the sauce') }), M({ n: S('tomatoes'), a: S('6') }), M({ n: S('eggs'), a: S('**4**'), ind: { booleanValue: true } })]),
      steps: A([S('Cook the tomatoes.'), M({ sub: S('Eggs') }), M({ t: S('Crack the eggs in.') })]),
      notes: S('Serve hot.'), source: S('https://example.com/shakshuka') })
  }, extra || {}) };
}
const PNG = 'iVBORw0KGgo=';
let docs = {}, seen = [];
globalThis.fetch = async function (u) {
  seen.push(String(u));
  const m = /\/v1\/projects\/([^/]+)\/databases\/\(default\)\/documents\/(.+)$/.exec(String(u));
  if (!m) return new Response('no', { status: 400 });
  const d = docs[m[2]];
  if (d === 403 || d === 404 || d === 500) return new Response('{}', { status: d });
  if (!d) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const env = { SHARE_CONFIG: CFG };
async function get(path, headers, e) {
  const r = await handleShare(new Request('https://mykitchennotes.community' + path, { headers: headers || {} }), e || env);
  const ct = r.headers.get('Content-Type') || '';
  return { r, text: /text|json/.test(ct) ? await r.text() : '', bytes: /image/.test(ct) ? new Uint8Array(await r.arrayBuffer()) : null };
}
function meta(html, prop) { const m = new RegExp('<meta (?:property|name)="' + prop + '" content="([^"]*)"').exec(html); return m ? m[1] : null; }

// 1. The recipe, as WhatsApp's preview reads it
docs = { ['recipeGifts/' + ID]: giftDoc(), ['recipeGiftPhotos/' + ID]: { fields: { data: S('data:image/png;base64,' + PNG), thumb: S('data:image/jpeg;base64,/9j/AA==') } } };
let p = await get('/r/' + ID);
ok(p.r.status === 200, 'the page answers 200 (' + p.r.status + ')');
ok(/text\/html/.test(p.r.headers.get('Content-Type')), 'it is a web page');
ok(seen.some(u => u.indexOf('/v1/projects/demo-beta/databases/(default)/documents/recipeGifts/' + ID) > 0), 'it reads the sent copy from this copy’s own database');
ok(meta(p.text, 'og:title') === 'Shakshuka &lt;script&gt;alert(1)&lt;/script&gt;', 'og:title: the name alone (no emoji), escaped: ' + meta(p.text, 'og:title'));
ok(meta(p.text, 'og:image') === 'https://mykitchennotes.community/r/' + ID + '/card', 'og:image: the small picture on this address: ' + meta(p.text, 'og:image'));
ok(/Tony’s Kitchen Notes/.test(meta(p.text, 'og:description') || '') && /The best one/.test(meta(p.text, 'og:description') || ''), 'og:description: the note and the kitchen: ' + meta(p.text, 'og:description'));
ok(/4 servings|Serves 4/.test(meta(p.text, 'og:description') || '') && /2 ingredients/.test(meta(p.text, 'og:description')), 'og:description: servings and how many ingredients');
ok(meta(p.text, 'twitter:card') === 'summary_large_image', 'a large card when there is a photo');
ok(meta(p.text, 'robots') === 'noindex,nofollow' && /noindex/.test(p.r.headers.get('X-Robots-Tag') || ''), 'search engines are told to keep out');
ok(/default-src 'none'/.test(p.r.headers.get('Content-Security-Policy') || '') && !/<script/i.test(p.text), 'no script runs on the page, and none can');
ok(p.text.indexOf('<script>alert') === -1, 'the name cannot inject markup');
ok(/<h2>Ingredients<\/h2>/.test(p.text) && /<h2>Method<\/h2>/.test(p.text), 'the page has Ingredients and Method');
ok(/<li class="sub" dir="auto">For the sauce<\/li>/.test(p.text) && /<h4 dir="auto">Eggs<\/h4>/.test(p.text), 'sub-headings in both lists');
ok(/<li class="ind"><span dir="auto">eggs<\/span><b dir="auto"><strong>4<\/strong><\/b><\/li>/.test(p.text), 'an indented line, its amount in **bold**');
ok(/<ol class="steps"><li><span class="n">1<\/span><div class="t" dir="auto">Cook the tomatoes\.<\/div><\/li><\/ol><h4 dir="auto">Eggs<\/h4><ol class="steps"><li><span class="n">2<\/span><div class="t" dir="auto">Crack the eggs in\.<\/div>/.test(p.text), 'the steps count on across a heading, each number a badge beside its text');
ok(!/<ol start=|list-style:decimal/.test(p.text) && /ol\.steps\{list-style:none/.test(p.text), 'no browser list numbers (a narrow margin cut them, the text ran over them)');
ok(/<q dir="auto">The <strong>best<\/strong> one<\/q>/.test(p.text) && /Sent by Tony’s Kitchen Notes/.test(p.text), 'the sender and their note');
ok(p.text.indexOf('href="https://mykitchennotes.community/?recipe=' + ID + '"') > 0 && /📥 Save to my recipes/.test(p.text), 'Save leads into the app with the recipe');
ok(/This link keeps until \d{1,2} \w+ 20\d\d\./.test(p.text), 'it says until when the link keeps');
ok(/<img class="hero" src="https:\/\/mykitchennotes\.community\/r\/[A-Za-z]+\/photo"/.test(p.text), 'the photo, from this address');
ok(/rel="noopener nofollow">https:\/\/example\.com\/shakshuka<\/a>/.test(p.text), 'the source is a link');
ok(/<html lang="en" dir="ltr">/.test(p.text), 'English, left to right, when nothing says otherwise');
ok(p.r.headers.get('Cache-Control') === 'public, max-age=300', 'kept for five minutes at most');

// 2. Languages
docs['recipeGifts/' + ID] = giftDoc({ name: S('עוגת שמרים'), recipe: M({ category: S('Dessert'), difficulty: S('Medium'), prep: S('3 שעות'), servings: S('12'),
  ingredients: A([M({ n: S('חלב פושר'), a: S('1½ כוסות') }), M({ n: S('קמח'), a: S('1 ק"ג') })]), steps: A([S('מתפיחים 1½ שעות.')]) }) });
const he = await handleShare(new Request('https://mykitchennotes.community/r/' + ID + '?l=he'), { SHARE_CONFIG: CFG, ASSETS: { fetch: async (u) => {
  ok(String(u) === 'https://mykitchennotes.community/i18n/he.json', 'the app’s own Hebrew words, from this copy: ' + u);
  return new Response(JSON.stringify({ strings: { Dessert: 'קינוח', Medium: 'בינוני' } }), { status: 200 }); } } });
const heText = await he.text();
ok(/<div class="pad" dir="rtl">/.test(heText), 'a Hebrew recipe is laid out right to left');
ok(heText.indexOf('<b dir="auto">\u20661½\u2069 כוסות</b>') > 0, 'a number with a fraction is kept whole ("1½ כוסות", not "½1")');
ok(heText.indexOf('מתפיחים \u20661½\u2069 שעות.') > 0, '…in a step too');
ok(heText.indexOf('<div class="meta"><bdi>קינוח</bdi> · <bdi>בינוני</bdi> · <bdi>3 שעות</bdi> · <bdi>12 מנות</bdi></div>') > 0, 'the line under the name: the app’s words, each bit kept whole: ' + (/<div class="meta">.*?<\/div>/.exec(heText) || [''])[0]);
docs['recipeGifts/' + ID] = giftDoc();
p = await get('/r/' + ID + '?l=he');
ok(/<html lang="he" dir="rtl">/.test(p.text) && /<h2>מרכיבים<\/h2>/.test(p.text) && /שמרו במתכונים שלי/.test(p.text), 'Hebrew (?l=he): right to left, its own words');
ok(/<div class="pad" dir="ltr">/.test(p.text) && /<div class="keep" dir="rtl">/.test(p.text), 'an English recipe on a Hebrew page: the recipe left to right, the page’s words right to left');
p = await get('/r/' + ID, { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5' });
ok(/<html lang="fr"/.test(p.text) && /<h2>Ingrédients<\/h2>/.test(p.text), 'the browser’s language when the link names none');
p = await get('/r/' + ID + '?l=xx', { 'Accept-Language': 'sw' });
ok(/<html lang="en"/.test(p.text), 'an unknown language falls back to English');
ok(pageLang(new URL('https://x/r/a?l=ZH-cn'), null) === 'zh', 'a language code is read in any case');

ok(recipeDir('מרק עגבניות', { ingredients: [{ n: 'עגבניות', a: '1 ק"ג' }, { n: 'olive oil', a: '2' }], steps: ['מבשלים.'] }) === 'rtl', 'a Hebrew recipe is laid out right to left');
ok(recipeDir('Soup', { parts: [{ ingredients: [{ n: 'water' }], steps: ['Boil.'] }] }) === 'ltr', '…an English collection left to right');

// 3. A collection: contents, each part, back to the contents
docs['recipeGifts/' + ID] = giftDoc({ recipe: M({ parts: A([
  M({ name: S('Dough'), ingredients: A([M({ n: S('flour'), a: S('500 g') })]), steps: A([S('Knead.')]) }),
  M({ name: S('Filling'), ingredients: A([M({ n: S('cheese'), a: S('200 g') })]), steps: A([S('Mix.')]), notes: S('Salty.') })]) }) });
p = await get('/r/' + ID);
ok(/<nav class="toc" id="toc"><b>Contents<\/b><ol><li><a href="#part0" dir="auto">Dough<\/a><\/li><li><a href="#part1" dir="auto">Filling<\/a><\/li><\/ol><\/nav>/.test(p.text), 'a collection opens with its contents');
ok((p.text.match(/<a href="#toc">↑ Contents<\/a>/g) || []).length === 2 && /<div class="notes" dir="auto">Salty\.<\/div>/.test(p.text), 'each part, its notes, and ↑ Contents');

// 4. No photo: the app's icon on the card, a small card
docs['recipeGifts/' + ID] = giftDoc({ photo: { booleanValue: false }, note: S('') });
p = await get('/r/' + ID);
ok(meta(p.text, 'og:image') === 'https://mykitchennotes.community/icons/icon-512.png' && meta(p.text, 'twitter:card') === 'summary', 'no photo: the app’s icon and a small card');
ok(!/class="hero"/.test(p.text) && /^A recipe from Tony’s Kitchen Notes · /.test(meta(p.text, 'og:description')), 'no photo on the page; the description names the kitchen');

// 5. When it cannot be shown
docs['recipeGifts/' + ID] = 403;
p = await get('/r/' + ID);
ok(p.r.status === 410 && /This recipe link has expired/.test(p.text) && /6 months/.test(p.text), 'expired (the rules refuse it): 410, said so');
ok(p.r.headers.get('Cache-Control') === 'no-store', '…and not kept');
docs['recipeGifts/' + ID] = giftDoc({ expireAt: { timestampValue: earlier } });
p = await get('/r/' + ID);
ok(p.r.status === 410, 'past its time, even if the database still has it');
docs['recipeGifts/' + ID] = 404;
p = await get('/r/' + ID + '?l=de');
ok(p.r.status === 404 && /Unter dieser Adresse gibt es kein Rezept/.test(p.text), 'taken back or never sent: 404, in German');
docs['recipeGifts/' + ID] = 500;
p = await get('/r/' + ID);
ok(p.r.status === 503 && /could not be read just now/.test(p.text), 'the database failing: 503, try again');
seen = [];
p = await get('/r/short');
ok(p.r.status === 404 && seen.length === 0, 'an id too short to be one: 404, without asking the database');
p = await get('/r/' + ID + '/elsewhere');
ok(p.r.status === 404, 'an address under /r/ that is not a recipe: 404');
const post = await handleShare(new Request('https://mykitchennotes.community/r/' + ID, { method: 'POST', body: 'x' }), env);
ok(post.status === 405, 'nothing but reading (POST: ' + post.status + ')');
const none = await handleShare(new Request('https://mykitchennotes.community/r/' + ID), {});
ok(none.status === 404, 'a copy without the settings file serves no recipe pages');
docs['recipeGifts/' + ID] = 404;
const viaAssets = await handleShare(new Request('https://tonys-recipes-test.pages.dev/r/' + ID), { ASSETS: { fetch: async (u) => {
  ok(String(u) === 'https://tonys-recipes-test.pages.dev/share-page.json', 'the settings are this copy’s own file: ' + u);
  return new Response(JSON.stringify({ projectId: 'demo-test', site: 'https://tonys-recipes-test.pages.dev/' }), { status: 200 }); } } });
ok(viaAssets.status === 404 && seen.some(u => /projects\/demo-test\//.test(u)), 'read from share-page.json, the test copy reads its own database');

// 6. The pictures
docs['recipeGiftPhotos/' + ID] = { fields: { data: S('data:image/png;base64,' + PNG), thumb: S('data:image/jpeg;base64,/9j/AA==') } };
p = await get('/r/' + ID + '/card');
ok(p.r.status === 200 && p.r.headers.get('Content-Type') === 'image/jpeg' && p.bytes && p.bytes[0] === 0xFF && p.bytes[1] === 0xD8, 'the card: the small picture, as a picture');
p = await get('/r/' + ID + '/photo');
ok(p.r.status === 200 && p.r.headers.get('Content-Type') === 'image/png' && p.bytes && p.bytes[1] === 0x50, 'the photo: the full one');
docs['recipeGiftPhotos/' + ID] = { fields: { data: S('data:image/png;base64,' + PNG) } };
p = await get('/r/' + ID + '/card');
ok(p.r.status === 200 && p.r.headers.get('Content-Type') === 'image/png', 'a card without a small picture: the full photo');
docs['recipeGiftPhotos/' + ID] = { fields: { data: S('https://images.example.com/a.jpg') } };
p = await get('/r/' + ID + '/photo');
ok(p.r.status === 302 && p.r.headers.get('Location') === 'https://images.example.com/a.jpg', 'a photo that is a web address: sent there');
docs['recipeGiftPhotos/' + ID] = { fields: { data: S('javascript:alert(1)') } };
p = await get('/r/' + ID + '/photo');
ok(p.r.status === 404, 'anything else is not served');
docs['recipeGiftPhotos/' + ID] = 403;
p = await get('/r/' + ID + '/card');
ok(p.r.status === 404, 'an expired photo: 404');

// 7. The small pieces
ok(JSON.stringify(fsDecode(M({ a: A([S('x'), { integerValue: '2' }, { booleanValue: true }, { nullValue: null }]) }))) === '{"a":["x",2,true,null]}', 'Firestore values decoded');
ok(esc('<a href="x">\'&') === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;', 'escaping');

console.log(failures ? failures + ' of ' + checks + ' recipe page check(s) FAILED' : 'all ' + checks + ' recipe page checks passed');
process.exit(failures ? 1 : 0);
