#!/usr/bin/env node
/**
 * Translates the app's NEW phrases into every published language — what
 * "🔄 Update all supported languages" does in the family app, done by GitHub
 * right after a release reaches `main` (v38.14). Tony: "Is there a way you could
 * run Update all supported languages in the family app once it is updated
 * instead of every time asking me to do it? … it is delaying the publication of
 * the new translation to when I'm available to do it."
 *
 *     ANTHROPIC_API_KEY=… FIREBASE_RULES_KEY='<service account JSON>' node tools/translate-new.mjs
 *     node tools/translate-new.mjs --dry-run      what each language lacks; no AI, nothing written
 *
 * The app does the work itself. A hidden Chromium opens this checkout's
 * index.html; the app collects every phrase (i18nHarvest: each panel, signed in
 * and signed out, and the messages in its own source), finds what each language
 * lacks (i18nGapList) and translates exactly that with its own prompt, batches
 * and checks (i18nTranslateAll). Only its `aiCall` is answered from here —
 * straight from Anthropic, with ANTHROPIC_API_KEY, on the model the app names.
 *
 * The new phrases are then ADDED to the central translations (the family
 * project's i18n/<lang>, read afresh just before and written only if unchanged
 * since — nothing an admin changed meanwhile is lost; nothing already there is
 * replaced) with the service account in FIREBASE_RULES_KEY, which needs the
 * "Cloud Datastore User" role on recipes-f379d. publish-languages.yml then
 * publishes them into i18n/*.json, as after a run in the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);      // finds the packages beside the checkout, or on NODE_PATH

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const MAX_NEW = 600;              // more than this at once means something is wrong (a broken harvest): stop

const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const version = (/var APP_VERSION = '([^']+)'/.exec(html) || [])[1] || '?';
const src = /languageSource:\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(html);
const field = n => (new RegExp(n + ":\\s*'([^']+)'").exec(src ? src[1] : '') || [])[1];
const projectId = field('projectId'), prefix = field('prefix'), indexPath = field('index');
if (!projectId || !prefix || !indexPath) { console.error('index.html has no complete languageSource'); process.exit(1); }
const DOCS = process.env.LANG_SOURCE_BASE || `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/`;
const AI_URL = process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages';

// ── Firestore, by REST (reading needs nothing: the rules let anyone read them) ──
function val(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; }
  return null;
}
async function readDoc(docPath) {
  const r = await fetch(DOCS + docPath);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(docPath + ': HTTP ' + r.status);
  const j = await r.json();
  return { data: val({ mapValue: { fields: j.fields || {} } }), updateTime: j.updateTime };
}
let _authed = null;
async function authHeaders() {
  if (_authed) return _authed;
  const key = process.env.FIREBASE_RULES_KEY || '';
  if (process.env.LANG_SOURCE_BASE && key === 'stand-in') return (_authed = { 'Content-Type': 'application/json' });   // the script's own check
  let credentials = null; try { credentials = JSON.parse(key.trim()); } catch (e) {}
  if (!credentials || credentials.type !== 'service_account') throw new Error('FIREBASE_RULES_KEY is not a service account key');
  const { GoogleAuth } = require('google-auth-library');
  const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient();
  const t = await client.getAccessToken();
  _authed = { Authorization: 'Bearer ' + (t.token || t), 'Content-Type': 'application/json' };
  return _authed;
}
const fsString = s => ({ stringValue: String(s) });
const fsInt = n => ({ integerValue: String(Math.round(n)) });
// Only the fields named are written (the rest of the document stays), and only if
// the document is still what was read (updateTime): otherwise read again and merge.
async function patchDoc(docPath, fields, updateTime, paths) {
  const mask = (paths || Object.keys(fields)).map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const pre = updateTime ? '&currentDocument.updateTime=' + encodeURIComponent(updateTime) : '';
  const r = await fetch(DOCS + docPath + '?' + mask + pre, { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ fields }) });
  if (r.ok) return 'ok';
  const t = await r.text();
  if (r.status === 400 && /FAILED_PRECONDITION|precondition/i.test(t)) return 'changed';
  if (r.status === 403) throw new Error('the service account may not write the translations (403) — give it the "Cloud Datastore User" role on ' + projectId + ': ' + t.slice(0, 200));
  throw new Error(docPath + ': HTTP ' + r.status + ' ' + t.slice(0, 300));
}

// ── the app, served from this checkout ─────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(repo, p);
  if (!f.startsWith(repo) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

let browser, exitCode = 0;
try {
  const { chromium } = require('playwright');
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => console.log('  (page: ' + String(e.message).slice(0, 160) + ')'));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);

  // 1. Every phrase the app shows, as the app collects it.
  const catalogue = await page.evaluate(async () => { await i18nHarvest(); return Array.from(new Set(i18nFullCatalogue())); });
  const model = await page.evaluate(() => (typeof AI_MODEL !== 'undefined' ? AI_MODEL : ''));
  console.log(`the app (${version}) shows ${catalogue.length} phrases; translations by ${model}`);

  // 2. The published languages, as they are NOW in the central store.
  const idx = await readDoc(indexPath);
  const langs = Object.keys((idx && idx.data && idx.data.langs) || {}).filter(c => /^[a-z]{2,3}$/.test(c) && c !== 'en').sort();
  if (!langs.length) { console.log('no languages in ' + indexPath + ' — nothing to do'); process.exit(0); }
  const plan = [];
  for (const lang of langs) {
    const d = await readDoc(prefix + lang);
    const strings = (d && d.data && d.data.strings) || null;
    if (!strings) { console.log(`  ${lang}: no document — skipped`); continue; }
    const gaps = await page.evaluate(([dict, cat]) => i18nGapList(dict, [], cat), [strings, catalogue]);
    plan.push({ lang, gaps });
    console.log(`  ${lang}: ${gaps.length ? gaps.length + ' new phrase' + (gaps.length === 1 ? '' : 's') : 'up to date'}`);
  }
  const total = plan.reduce((n, p) => n + p.gaps.length, 0);
  if (!total) { console.log('every language is up to date'); process.exit(0); }
  if (DRY) {
    plan.filter(p => p.gaps.length).forEach(p => console.log(`  ${p.lang}: ` + p.gaps.slice(0, 8).map(g => JSON.stringify(g.slice(0, 60))).join(', ') + (p.gaps.length > 8 ? ' …' : '')));
    console.log('(dry run — nothing translated, nothing written)');
    process.exit(0);
  }
  if (plan.some(p => p.gaps.length > MAX_NEW)) {
    console.log(`::error::${total} phrases to translate at once — more than a release ever adds. Nothing was translated: run "🔄 Update all supported languages" in the family app, or this job with a reason to trust it.`);
    process.exit(1);
  }

  // 3. Translated by the app's own code; its AI calls answered from here.
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) { console.log('::error::ANTHROPIC_API_KEY is not set — nothing translated'); process.exit(1); }
  let calls = 0, inTok = 0, outTok = 0;
  await page.exposeFunction('__ciAI', async (prompt, maxTokens, mdl, system) => {
    const body = { model: mdl || model, max_tokens: maxTokens || 2000, messages: [{ role: 'user', content: prompt }] };
    if (system) body.system = system;
    for (let attempt = 1; ; attempt++) {
      const r = await fetch(AI_URL, { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        calls++; inTok += (d.usage && d.usage.input_tokens) || 0; outTok += (d.usage && d.usage.output_tokens) || 0;
        return (d.content || []).map(b => b.text || '').join('\n');
      }
      if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise(s => setTimeout(s, 4000 * attempt)); continue; }
      throw new Error('Anthropic answered ' + r.status + ': ' + JSON.stringify(d).slice(0, 300));
    }
  });
  await page.evaluate(() => { window.aiCall = function (prompt, maxTokens, tools, model, system) { return window.__ciAI(prompt, maxTokens, model || null, system || null); }; });
  const results = [];
  for (const p of plan.filter(x => x.gaps.length)) {
    const got = await page.evaluate(async ([lang, gaps]) => {
      const res = await i18nTranslateAll(lang, gaps, function () {}, {}, I18N_LANES);
      const out = {};
      gaps.forEach(g => { if (res.dict[g]) out[g] = res.dict[g]; });
      return { filled: out, missing: (res.missing || []).length };
    }, [p.lang, p.gaps]);
    results.push({ lang: p.lang, filled: got.filled, missing: got.missing });
  }
  console.log(`AI: ${calls} call${calls === 1 ? '' : 's'}, ${inTok} tokens in, ${outTok} out`);

  // 4. Added to the central translations — to what is there NOW, never over it.
  const now = Date.now();
  for (const r of results) {
    const n = Object.keys(r.filled).length;
    if (!n) { console.log(`  ${r.lang}: nothing came back` + (r.missing ? ` (${r.missing} still missing)` : '')); continue; }
    for (let attempt = 1; attempt <= 4; attempt++) {
      const d = await readDoc(prefix + r.lang);
      const strings = Object.assign({}, (d && d.data && d.data.strings) || {});
      let added = 0;
      for (const [k, v] of Object.entries(r.filled)) if (!strings[k]) { strings[k] = v; added++; }
      if (!added) { console.log(`  ${r.lang}: already there`); break; }
      const fields = { strings: { mapValue: { fields: Object.fromEntries(Object.entries(strings).map(([k, v]) => [k, fsString(v)])) } },
        count: fsInt(Object.keys(strings).length), updatedAt: fsInt(now), by: fsString('GitHub, after ' + version) };
      const w = await patchDoc(prefix + r.lang, fields, d && d.updateTime);
      if (w === 'changed') { console.log(`  ${r.lang}: changed meanwhile — reading it again`); continue; }
      await patchDoc(indexPath, { langs: { mapValue: { fields: { [r.lang]: { mapValue: { fields: { at: fsInt(now), count: fsInt(Object.keys(strings).length) } } } } } } }, null, ['langs.' + r.lang]);
      console.log(`  ${r.lang}: +${added}` + (r.missing ? ` (${r.missing} could not be translated)` : ''));
      break;
    }
  }
  console.log('::notice::Languages: the new phrases are in the shared translations — publish-languages puts them in i18n/*.json.');
} catch (e) {
  console.log('::error::' + (e && e.message || e));
  exitCode = 1;
} finally {
  try { if (browser) await browser.close(); } catch (e) {}
  server.close();
}
process.exit(exitCode);
