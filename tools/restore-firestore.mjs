/**
 * v38.18 — reads a backup made by tools/backup-firestore.mjs, and if asked,
 * puts documents back.
 *
 *     BACKUP_PASSPHRASE='…' node tools/restore-firestore.mjs <file.mknb> --list
 *         what is in it: the documents per collection (no contents)
 *     BACKUP_PASSPHRASE='…' node tools/restore-firestore.mjs <file.mknb> --json out.json
 *         the whole backup as readable JSON (it holds people's recipes: keep it safe, delete it after)
 *     BACKUP_PASSPHRASE='…' FIREBASE_KEY='<service account JSON>' \
 *       node tools/restore-firestore.mjs <file.mknb> --restore [--only households/abc] [--write]
 *         puts the documents back as they were in the backup — WITHOUT --write
 *         it only says what it would write. Only documents (paths) starting with
 *         --only, if given. Needs "Cloud Datastore User" on the project.
 *
 * A restore overwrites what is there now with the backup's version and leaves
 * documents that are not in the backup alone. Done on Tony's request only.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const file = process.argv[2];
const has = (f) => process.argv.includes('--' + f);
const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : ''; };
if (!file || !fs.existsSync(file)) { console.error('usage: node tools/restore-firestore.mjs <file.mknb> --list | --json out.json | --restore [--only prefix] [--write]'); process.exit(2); }
const pass = process.env.BACKUP_PASSPHRASE || '';

function openBackup(buf, passphrase) {
  if (buf.slice(0, 5).toString() !== 'MKNB1') throw new Error('not a My Kitchen Notes backup');
  const salt = buf.slice(5, 21), iv = buf.slice(21, 33), tag = buf.slice(33, 49), body = buf.slice(49);
  const key = crypto.scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  let plain;
  try { plain = Buffer.concat([d.update(body), d.final()]); }
  catch (e) { throw new Error('it cannot be opened: the passphrase is wrong, or the file was changed'); }
  return JSON.parse(zlib.gunzipSync(plain).toString('utf8'));
}

try {
  const b = openBackup(fs.readFileSync(file), pass);
  console.log('backup of ' + b.project + ', taken ' + b.at + ': ' + b.count + ' documents');
  if (has('list')) {
    const per = {}; b.docs.forEach(d => { const k = d.path.split('/').filter((x, i) => i % 2 === 0).join('/'); per[k] = (per[k] || 0) + 1; });
    Object.keys(per).sort().forEach(k => console.log('  ' + k + ': ' + per[k]));
  }
  if (has('json')) { fs.writeFileSync(arg('json'), JSON.stringify(b, null, 1)); console.log('written: ' + arg('json') + ' — it holds people’s recipes: delete it when done'); }
  if (has('restore')) {
    const only = arg('only'), write = has('write');
    const list = b.docs.filter(d => !only || d.path === only || d.path.startsWith(only.replace(/\/$/, '') + '/'));
    const BASE = (process.env.FIRESTORE_BASE || 'https://firestore.googleapis.com/v1/') + 'projects/' + b.project + '/databases/(default)/documents/';
    console.log((write ? 'restoring ' : 'would restore (add --write to do it) ') + list.length + ' documents' + (only ? ' under ' + only : '') + ' into ' + b.project);
    if (write) {
      let H = { 'Content-Type': 'application/json' };
      const key = process.env.FIREBASE_KEY || '';
      if (!(process.env.FIRESTORE_BASE && key === 'stand-in')) {
        const credentials = JSON.parse(key);
        const { GoogleAuth } = require('google-auth-library');
        const t = await (await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient()).getAccessToken();
        H.Authorization = 'Bearer ' + (t.token || t);
      }
      let n = 0;
      for (const d of list) {
        const r = await fetch(BASE + d.path, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: d.fields }) });
        if (!r.ok) throw new Error(d.path + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
        if (++n % 100 === 0) console.log('  ' + n + '…');
      }
      console.log('restored ' + n + ' documents');
    } else list.slice(0, 20).forEach(d => console.log('  ' + d.path));
  }
} catch (e) { console.error('::error::' + ((e && e.message) || e)); process.exit(1); }
