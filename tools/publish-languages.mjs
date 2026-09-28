#!/usr/bin/env node
/**
 * Publish the interface languages into the repository (v36.91).
 *
 *     node tools/publish-languages.mjs [--force]
 *
 * Run by .github/workflows/publish-languages.yml every 10 minutes (and on
 * demand). Reads the CENTRAL translations — the family project's
 * shared/i18n_<lang> documents, which the rules let anyone read — over plain
 * REST (no key, no secret), and writes them as i18n/<lang>.json plus
 * i18n/index.json. Every copy of the app then serves its languages as files
 * of its own: instant, cached, offline, no database reads, and every change
 * kept in git history.
 *
 * It writes only when something changed: a language's `updatedAt` moved, a
 * language appeared or went, or someone pressed "Publish languages" in the
 * app (shared/i18n_publish.requestedAt is newer than the last publish).
 * Exit code 0 with nothing written is the normal case.
 *
 * v36.93 — it also KEEPS the last few versions of each language, beside the
 * app, in i18n/archive/<lang>/<time>.json with a list in
 * i18n/archive/index.json. The app's "↩️ Put back a language…" reads them from
 * its own site, so an earlier version can be chosen from a list on any device
 * (the work iPhone cannot open GitHub, and is never routed round that).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : null; };
const outDir = path.resolve(repo, opt('out') || 'i18n');
const force = argv.includes('--force');

// Where the app itself says the languages live.
const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const src = /languageSource:\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(html);
if (!src) { console.error('index.html has no languageSource'); process.exit(1); }
const field = n => (new RegExp(n + ":\\s*'([^']+)'").exec(src[1]) || [])[1];
const projectId = field('projectId'), prefix = field('prefix'), indexPath = field('index');
if (!projectId || !prefix || !indexPath) { console.error('languageSource is incomplete'); process.exit(1); }
// LANG_SOURCE_BASE: tests point this at the Firestore emulator instead.
const base = process.env.LANG_SOURCE_BASE || `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/`;

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
async function get(docPath) {
  const r = await fetch(base + docPath);
  if (r.status === 404) return null;
  if (r.status === 403) {
    console.log(`refused (403) reading ${docPath} — the family project's rules are not published yet `
      + '(Family Access → Show Firestore security rules → Publish). Nothing written.');
    process.exit(0);
  }
  if (!r.ok) throw new Error(`${docPath}: HTTP ${r.status}`);
  const j = await r.json();
  return val({ mapValue: { fields: j.fields || {} } });
}
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
// Keys sorted, one per line: a changed phrase is a one-line diff in history.
function stable(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

const idxDoc = await get(indexPath);
// v36.97 — no index is not "no languages": the translations may be on their
// way to a new place (i18n/_index), and publishing nothing would delete every
// file the app serves. Change nothing until the index is there.
if (!idxDoc || !idxDoc.langs || !Object.keys(idxDoc.langs).length) {
  console.log(`no language list at ${indexPath} (yet) — nothing changed`);
  process.exit(0);
}
const idx = idxDoc;
const langs = Object.keys(idx.langs || {}).filter(c => /^[a-z]{2,3}$/.test(c) && c !== 'en').sort();
const request = (await get(prefix + 'publish')) || {};
const had = readJson(path.join(outDir, 'index.json')) || { langs: {} };

const KEEP = 12;                                   // versions kept per language
const archDir = path.join(outDir, 'archive');
const archIndexFile = path.join(archDir, 'index.json');
const arch = readJson(archIndexFile) || { langs: {} };

const signature = o => JSON.stringify(Object.keys(o || {}).sort().map(c => [c, (o[c] || {}).at || 0, (o[c] || {}).count || 0]));
const requested = (request.requestedAt || 0) > (had.publishedAt || 0);
if (!force && !requested && signature(idx.langs) === signature(had.langs) && fs.existsSync(archIndexFile)) {
  console.log(`nothing changed (${langs.length} languages, last published ${had.publishedAt ? new Date(had.publishedAt).toISOString() : 'never'})`);
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
const written = {};
const now = Date.now();
const stamp = new Date(now).toISOString().replace(/:/g, '');   // 2026-09-27T205412.345Z
// Keep this version unless it is word for word the newest one kept already.
function keep(code, doc) {
  const list = arch.langs[code] || [];
  const newest = list[0] && readJson(path.join(archDir, list[0].file));
  if (newest && JSON.stringify(stable(newest.strings || {})) === JSON.stringify(doc.strings)) return;
  // Never over another kept version: two runs in the same moment (two quick
  // "Run workflow"s) would otherwise share a name, and one would be lost.
  let file = `${code}/${stamp}.json`;
  for (let n = 2; list.some(v => v.file === file) || fs.existsSync(path.join(archDir, file)); n++) file = `${code}/${stamp}-${n}.json`;
  fs.mkdirSync(path.join(archDir, code), { recursive: true });
  fs.writeFileSync(path.join(archDir, file), JSON.stringify(doc, null, 1) + '\n');
  list.unshift({ file, at: doc.updatedAt, count: doc.count, savedAt: now });
  for (const old of list.splice(KEEP)) { try { fs.unlinkSync(path.join(archDir, old.file)); } catch (e) {} }
  arch.langs[code] = list;
  console.log(`  ${code}: kept as ${file} (${list.length} version${list.length === 1 ? '' : 's'})`);
}
for (const code of langs) {
  const d = await get(prefix + code);
  if (!d || !d.strings || typeof d.strings !== 'object') { console.log(`  ${code}: no document — skipped`); continue; }
  const strings = {};
  for (const [k, v] of Object.entries(d.strings)) if (typeof v === 'string') strings[k] = v;
  const count = Object.keys(strings).length;
  if (!count) { console.log(`  ${code}: empty — skipped`); continue; }
  const doc = { lang: code, updatedAt: d.updatedAt || (idx.langs[code] || {}).at || 0, count, strings: stable(strings) };
  fs.writeFileSync(path.join(outDir, code + '.json'), JSON.stringify(doc, null, 1) + '\n');
  keep(code, doc);
  written[code] = { at: (idx.langs[code] || {}).at || doc.updatedAt, count };
  console.log(`  ${code}: ${count} phrases`);
}
// A language no longer in the cloud is no longer published — but its kept
// versions stay, so it can be put back.
for (const f of fs.readdirSync(outDir)) {
  const m = /^([a-z]{2,3})\.json$/.exec(f);
  if (m && !written[m[1]]) { fs.unlinkSync(path.join(outDir, f)); console.log(`  ${m[1]}: removed`); }
}
fs.mkdirSync(archDir, { recursive: true });
fs.writeFileSync(archIndexFile, JSON.stringify({ keep: KEEP, updatedAt: now, langs: arch.langs }, null, 1) + '\n');
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({
  source: `${projectId}/${prefix}*`, publishedAt: now,
  requestedBy: requested ? (request.by || '') : '', langs: written
}, null, 1) + '\n');
console.log(`published ${Object.keys(written).length} languages${requested ? ' (requested in the app)' : ''}`);
