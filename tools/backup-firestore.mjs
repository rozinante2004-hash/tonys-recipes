/**
 * v38.18 — a copy of a Firestore database, every document in every collection
 * and sub-collection, compressed and ENCRYPTED, for the nightly job
 * (.github/workflows/backup-beta.yml). Tony: "daily backups of the beta's
 * database".
 *
 *     FIREBASE_KEY='<service account JSON>' BACKUP_PASSPHRASE='…' \
 *       node tools/backup-firestore.mjs --project my-kitchen-notes-beta --out backup/
 *
 * The file is useless without BACKUP_PASSPHRASE: the repository is public, and
 * so are its Actions files to anyone signed in to GitHub. AES-256-GCM, the key
 * stretched from the passphrase with scrypt; a changed byte makes it unreadable
 * rather than wrong. Read back (and restored) with tools/restore-firestore.mjs.
 *
 * The service account only reads: "Cloud Datastore Viewer" on the project is
 * enough. Nothing about the contents is printed — only how many documents each
 * top-level collection holds.
 *
 * Checked against a stand-in (FIRESTORE_BASE=http://…, FIREBASE_KEY=stand-in).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : dflt; };
const project = arg('project', 'my-kitchen-notes-beta');
const outDir = arg('out', 'backup');
if (!/^[a-z0-9-]{4,40}$/.test(project)) { console.error('which project? --project <id>'); process.exit(2); }
const BASE = (process.env.FIRESTORE_BASE || 'https://firestore.googleapis.com/v1/') + 'projects/' + project + '/databases/(default)/documents';
const pass = process.env.BACKUP_PASSPHRASE || '';
if (pass.length < 16) { console.log('::error::BACKUP_PASSPHRASE is missing or shorter than 16 characters — nothing was backed up.'); process.exit(1); }

async function headers() {
  const key = process.env.FIREBASE_KEY || '';
  if (process.env.FIRESTORE_BASE && key === 'stand-in') return { 'Content-Type': 'application/json' };
  let credentials = null; try { credentials = JSON.parse(key.trim()); } catch (e) {}
  if (!credentials || credentials.type !== 'service_account') throw new Error('FIREBASE_KEY is not a service account key');
  const { GoogleAuth } = require('google-auth-library');
  const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient();
  const t = await client.getAccessToken();
  return { Authorization: 'Bearer ' + (t.token || t), 'Content-Type': 'application/json' };
}
let H = null, calls = 0;
async function call(url, init) {
  for (let attempt = 1; ; attempt++) {
    calls++;
    const r = await fetch(url, Object.assign({ headers: H }, init || {}));
    if (r.ok) return r.json();
    const t = await r.text();
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise(s => setTimeout(s, 2000 * attempt)); continue; }
    if (r.status === 403) throw new Error('the service account may not read ' + project + ' (403) — give it the "Cloud Datastore Viewer" role there: ' + t.slice(0, 200));
    throw new Error(url.replace(BASE, '') + ': HTTP ' + r.status + ' ' + t.slice(0, 200));
  }
}
// The collections under the root ('' ) or under one document.
async function collectionIds(docPath) {
  const ids = []; let pageToken;
  do {
    const d = await call(BASE + (docPath ? '/' + docPath : '') + ':listCollectionIds', { method: 'POST', body: JSON.stringify({ pageSize: 300, pageToken }) });
    (d.collectionIds || []).forEach(x => ids.push(x)); pageToken = d.nextPageToken;
  } while (pageToken);
  return ids;
}
const docs = [];
// Every document of one collection, then the collections under each (a document
// that only has sub-collections is listed too: showMissing).
async function walk(colPath) {
  let pageToken;
  do {
    const q = '?pageSize=300&showMissing=true' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const d = await call(BASE + '/' + colPath + q);
    for (const doc of d.documents || []) {
      const rel = doc.name.slice(doc.name.indexOf('/documents/') + '/documents/'.length);
      if (doc.fields || doc.createTime) docs.push({ path: rel, fields: doc.fields || {}, createTime: doc.createTime, updateTime: doc.updateTime });
      for (const sub of await collectionIds(rel)) await walk(rel + '/' + sub);
    }
    pageToken = d.nextPageToken;
  } while (pageToken);
}
// gzip, then AES-256-GCM: "MKNB1" | salt 16 | iv 12 | tag 16 | ciphertext.
function seal(buf) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(zlib.gzipSync(buf)), c.final()]);
  return Buffer.concat([Buffer.from('MKNB1'), salt, iv, c.getAuthTag(), body]);
}

try {
  H = await headers();
  const started = Date.now();
  const top = await collectionIds('');
  for (const c of top) await walk(c);
  const at = new Date().toISOString();
  const json = Buffer.from(JSON.stringify({ project, at, count: docs.length, docs }));
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'backup-' + project + '-' + at.slice(0, 19).replace(/[:T]/g, '-') + '.mknb');
  fs.writeFileSync(file, seal(json));
  const per = {}; docs.forEach(d => { const t = d.path.split('/')[0]; per[t] = (per[t] || 0) + 1; });
  console.log('backed up ' + project + ': ' + docs.length + ' documents (' + Object.keys(per).sort().map(k => k + ' ' + per[k]).join(', ') + ')'
    + ' in ' + Math.round((Date.now() - started) / 1000) + ' s, ' + calls + ' requests → ' + file + ' (' + Math.round(fs.statSync(file).size / 1024) + ' KB, encrypted)');
} catch (e) {
  console.log('::error::the backup failed: ' + ((e && e.message) || e));
  process.exit(1);
}
