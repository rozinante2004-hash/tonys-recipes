// Uploads the Firefox copy of the extension (dist-extension/my-kitchen-notes-extension-firefox.zip,
// built by tools/build-extension.mjs live) to addons.mozilla.org (AMO) and submits it — the
// first time as a new listed add-on, after that as a new version. Mozilla checks it at once
// and signs it; a person may review it later. Run by .github/workflows/deploy-extension.yml
// when a release that changes the extension reaches `main` (Tony's yes), or by hand.
//
//   AMO_JWT_ISSUER='user:…' AMO_JWT_SECRET='…' node tools/publish-extension-firefox.mjs
//
// 9 Oct 2026 — Tony: "Can we create the same for Firefox as for chrome?" AMO's API v5 with the
// account's API credentials (addons.mozilla.org → Tools → Manage API Keys). A version AMO
// already has is skipped. Firefox keeps only signed extensions, so this store is the only way.
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';

const API = process.env.AMO_API || 'https://addons.mozilla.org/api/v5/';   // AMO_API: a stand-in server, for checking this script
const root = new URL('..', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('dist-extension/live-firefox/manifest.json', root), 'utf8'));
const version = manifest.version;
const guid = manifest.browser_specific_settings.gecko.id;
const zip = readFileSync(new URL('dist-extension/my-kitchen-notes-extension-firefox.zip', root));
console.log('the Firefox copy, ' + guid + ' version ' + version + ' (' + zip.length + ' bytes)');

const ISS = (process.env.AMO_JWT_ISSUER || '').trim(), SECRET = (process.env.AMO_JWT_SECRET || '').trim();
if (!ISS || !SECRET) { console.log('::warning::AMO_JWT_ISSUER / AMO_JWT_SECRET are not set — nothing was sent to addons.mozilla.org.'); process.exit(0); }
if (!/^user:\d+:\d+$/.test(ISS)) {
  console.log('::error::AMO_JWT_ISSUER does not look like the "JWT issuer" AMO shows (it starts with user: and has two numbers, e.g. user:12345678:123). '
    + 'Copy it again from addons.mozilla.org → Tools → Manage API Keys.');
  process.exit(1);
}

// A fresh signed token for each request (AMO accepts one for at most five minutes).
const b64u = (b) => Buffer.from(b).toString('base64url');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: ISS, jti: randomUUID(), iat: now, exp: now + 120 }));
  return head + '.' + body + '.' + createHmac('sha256', SECRET).update(head + '.' + body).digest('base64url');
}
let _lastWrite = 0;
async function amo(path, opts = {}) {
  // 9 Oct 2026 — AMO throttled the third change in a row ("Request was throttled. Expected
  // available in 58 seconds"): changes are spaced out a little.
  if (opts.method && opts.method !== 'GET') { const wait = _lastWrite + 2500 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); _lastWrite = Date.now(); }
  const headers = Object.assign({ Authorization: 'JWT ' + token() }, opts.json ? { 'Content-Type': 'application/json' } : {});
  const r = await fetch(API + path, { method: opts.method || 'GET', headers, body: opts.json ? JSON.stringify(opts.json) : opts.form });
  let d = null; const text = await r.text(); try { d = JSON.parse(text); } catch (e) { d = { raw: text.slice(0, 400) }; }
  return { status: r.status, d };
}
const say = (x) => JSON.stringify(x.d).slice(0, 900);

// v38.06 — Tony could not find where AMO keeps the privacy policy and the screenshots.
// The job puts them on the add-on's page itself, once: what is there already is left alone.
const tr = (v) => (v && typeof v === 'object') ? Object.values(v).filter(Boolean).join('') : String(v || '');
async function listing() {
  const id = encodeURIComponent(guid);
  const a = await amo('addons/addon/' + id + '/');
  if (a.status !== 200) { console.log('::warning::the listing could not be read (' + a.status + ') — screenshots and privacy policy not checked'); return; }
  // Screenshots: the Chrome listing's two (1280×800).
  const have = a.d.previews || [];
  if (have.length) console.log('screenshots: ' + have.length + ' already on the page');
  else {
    const shots = ['store-1-button.png', 'store-2-in-the-app.png'];
    for (let i = 0; i < shots.length; i++) {
      const fd = new FormData();
      fd.append('image', new Blob([readFileSync(new URL('extension/store/' + shots[i], root))], { type: 'image/png' }), shots[i]);
      fd.append('position', String(i));
      const r = await amo('addons/addon/' + id + '/previews/', { method: 'POST', form: fd });
      console.log(r.status < 300 ? 'screenshot added: ' + shots[i] : '::warning::screenshot ' + shots[i] + ' not added (' + r.status + '): ' + say(r));
    }
  }
  // The privacy policy: AMO keeps the text itself — extension/PRIVACY.md, as plain text.
  const policyNow = async () => { const p = await amo('addons/addon/' + id + '/eula_policy/'); return p.status === 200 ? tr(p.d.privacy_policy) : null; };
  const before = await policyNow();
  if (before) console.log('privacy policy: already on the page');
  else {
    const text = readFileSync(new URL('extension/PRIVACY.md', root), 'utf8')
      .replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const body = { privacy_policy: { 'en-US': text } };
    let r = await amo('addons/addon/' + id + '/eula_policy/', { method: 'PATCH', json: body });
    if (!(await policyNow())) r = await amo('addons/addon/' + id + '/', { method: 'PATCH', json: body });
    console.log((await policyNow()) ? 'privacy policy added (' + text.length + ' characters)'
      : '::warning::the privacy policy could not be set through the API (' + r.status + ': ' + say(r) + ') — it can be added by hand on the add-on\'s page in the Developer Hub');
  }
  // v38.13 — Tony: the page says "… by Tony". The name after "by" is the AMO account's display
  // name (its profile, not the add-on): set to My Kitchen Notes, and read back.
  const AUTHOR = process.env.AMO_AUTHOR_NAME || 'My Kitchen Notes';
  const me = await amo('accounts/profile/');
  if (me.status !== 200 || !me.d || !me.d.id) console.log('::warning::the account could not be read (' + me.status + ') — the name after "by" not checked');
  else if (me.d.display_name === AUTHOR) console.log('shown as: by ' + AUTHOR);
  else {
    const r = await amo('accounts/account/' + me.d.id + '/', { method: 'PATCH', json: { display_name: AUTHOR } });
    const again = await amo('accounts/profile/');
    console.log(again.d && again.d.display_name === AUTHOR ? 'shown as: by ' + AUTHOR + ' (was "' + me.d.display_name + '")'
      : '::warning::the name after "by" could not be changed (' + r.status + ': ' + say(r) + ') — on addons.mozilla.org: your name at the top → Edit My Profile → Display Name');
  }
  // Its homepage: My Kitchen Notes, where the store copy sends recipes.
  if (!a.d.homepage) {
    const home = 'https://my-kitchen-notes-beta.pages.dev/';
    const r = await amo('addons/addon/' + id + '/', { method: 'PATCH', json: { homepage: { 'en-US': home } } });
    console.log(r.status < 300 ? 'homepage set: ' + home : '::warning::homepage not set (' + r.status + '): ' + say(r));
  }
}

// 1. Is the add-on there yet, and does it already have this version?
let addon = await amo('addons/addon/' + encodeURIComponent(guid) + '/');
if (addon.status === 401 || addon.status === 403) {
  console.log('::error::addons.mozilla.org refused the API keys (' + addon.status + '): ' + say(addon) + ' — generate new ones (Tools → Manage API Keys) and paste both again.');
  process.exit(1);
}
const isNew = addon.status === 404;
if (!isNew && addon.status !== 200) { console.log('::error::could not ask addons.mozilla.org about the add-on (' + addon.status + '): ' + say(addon)); process.exit(1); }
if (!isNew) {
  const vs = await amo('addons/addon/' + encodeURIComponent(guid) + '/versions/?filter=all_with_unlisted&page_size=50');
  // v38.12 — Tony: "This is not a public listing … Download failed". Say where Mozilla's review stands.
  const st = addon.d.status, vlist = (vs.d && vs.d.results) || [];
  console.log('on addons.mozilla.org: the add-on is "' + st + '"' + (addon.d.is_disabled ? ' (disabled by its owner)' : '') + '; versions: '
    + (vlist.map((v) => v.version + ' ' + ((v.file && v.file.status) || '?') + (v.channel && v.channel !== 'listed' ? ' (' + v.channel + ')' : '')).join(', ') || 'none'));
  if (st !== 'public' && st !== 'approved')
    console.log('::notice::Firefox: the listing is not public yet ("' + st + '") — Mozilla still has to approve it. Until then its page is visible to its owner only, and "Add to Firefox" cannot download it.');
  if ((vs.d && vs.d.results || []).some((v) => v.version === version)) {
    console.log('version ' + version + ' is already on addons.mozilla.org — nothing to upload');
    await listing();
    process.exit(0);
  }
}

// 2. Upload, and wait for Mozilla's automatic check.
const form = new FormData();
form.append('upload', new Blob([zip], { type: 'application/zip' }), 'my-kitchen-notes-extension-firefox.zip');
form.append('channel', 'listed');
let up = await amo('addons/upload/', { method: 'POST', form });
if (up.status >= 300 || !up.d || !up.d.uuid) { console.log('::error::the upload was refused (' + up.status + '): ' + say(up)); process.exit(1); }
const uuid = up.d.uuid;
for (let i = 0; i < 60 && !(up.d && up.d.processed); i++) {
  await new Promise((r) => setTimeout(r, 5000));
  up = await amo('addons/upload/' + uuid + '/');
}
if (!up.d.processed) { console.log('::error::Mozilla\'s check did not finish in five minutes — run the job again later.'); process.exit(1); }
if (!up.d.valid) {
  const msgs = ((up.d.validation && up.d.validation.messages) || []).filter((m) => m.type === 'error').map((m) => '- ' + m.message + (m.file ? ' (' + m.file + ')' : ''));
  console.log('::error::Mozilla\'s check refused the package:\n' + (msgs.join('\n') || say(up)));
  process.exit(1);
}
console.log('Mozilla\'s check passed (upload ' + uuid + ')');

// 3. Submit: a new listed add-on the first time, a new version after that.
const LICENSE = 'all-rights-reserved';
let res;
if (isNew) {
  const listing = {
    slug: 'my-kitchen-notes',
    summary: { 'en-US': 'Save recipes from any website, and from Facebook, Instagram and TikTok posts, into My Kitchen Notes in one click.' },
    description: { 'en-US': 'Found a recipe in a Facebook, Instagram or TikTok post or reel? Click “📘 Save recipe to My Kitchen Notes” under it. '
      + 'The extension opens the post’s “See more”, takes the post’s own text — never the comments — and opens My Kitchen Notes with it, '
      + 'where it becomes a recipe: ingredients, steps, and the post as its source.\n\n'
      + 'On any other website, the toolbar button (Alt+Shift+S) or the right-click menu sends the recipe: the one the page publishes for '
      + 'search engines, or the text you selected. Right-click a link to import that page instead.\n\n'
      + 'Nothing is read until you click. The text goes straight to your own collection in your browser.' },
    categories: ['bookmarks'],
    version: { upload: uuid, license: LICENSE },
  };
  res = await amo('addons/addon/', { method: 'POST', json: listing });
  // Older API wording: categories by application; or the address already taken.
  if (res.status === 400 && /categor/i.test(say(res))) { listing.categories = { firefox: ['bookmarks'] }; res = await amo('addons/addon/', { method: 'POST', json: listing }); }
  if (res.status === 400 && /slug/i.test(say(res))) { delete listing.slug; res = await amo('addons/addon/', { method: 'POST', json: listing }); }
} else {
  res = await amo('addons/addon/' + encodeURIComponent(guid) + '/versions/', { method: 'POST', json: { upload: uuid } });
  if (res.status === 400 && /licen/i.test(say(res))) res = await amo('addons/addon/' + encodeURIComponent(guid) + '/versions/', { method: 'POST', json: { upload: uuid, license: LICENSE } });
}
if (res.status >= 300) { console.log('::error::uploaded and checked, but not submitted (' + res.status + '): ' + say(res)); process.exit(1); }

await listing();
const slug = (res.d && (res.d.slug || (res.d.addon && res.d.addon.slug))) || (addon.d && addon.d.slug) || 'my-kitchen-notes';
console.log('submitted: ' + (isNew ? 'a new add-on' : 'version ' + version) + ' — its page: https://addons.mozilla.org/firefox/addon/' + slug + '/');
console.log('::notice::Firefox: ' + (isNew ? 'the add-on is on addons.mozilla.org' : 'version ' + version + ' is submitted') + ' — https://addons.mozilla.org/firefox/addon/' + slug + '/ (Mozilla signs it after its check; a person may review it later).');
