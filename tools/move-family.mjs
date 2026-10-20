/**
 * v38.22 — THE FAMILY MOVES INTO THE COMMUNITY COPY. Tony, 11 Oct 2026, option B:
 * "testers should be able to join my live and synced set of recipes" — so the
 * family app's households (recipes-f379d) are copied into the community copy's
 * database (my-kitchen-notes-beta, mykitchennotes.community), with the accounts
 * of the people in them, so each person signs in there with the same Google
 * account and lands in the same household, with the same identifier.
 *
 *     FIREBASE_KEY='<service account JSON>' node tools/move-family.mjs \
 *       --from recipes-f379d --to my-kitchen-notes-beta --mode survey|copy|remove [options]
 *
 *   survey  reads both projects and says what a copy would do. Changes nothing.
 *   copy    copies the accounts (same user ids, so Google sign-in finds them)
 *           and every document that belongs to the households, then reads each
 *           one back and compares it field by field. --mark-moved <address> also
 *           marks every family household `movedTo` FIRST (the family app then
 *           stops and sends people to the new address) — and takes the mark off
 *           again if anything fails.
 *   remove  takes a copy away again (a rehearsal in the test copy): the copied
 *           documents and the accounts it created. Needs --confirm remove.
 *   unmark  takes the movedTo mark off the family households again — the family
 *           app works as before (the way back on move day). --confirm unmark.
 *   clear-check   (v38.40, move-day step 9 — "a week after we move … in case something is
 *           missing") reads the family's documents and the community copy's, and counts
 *           which the community copy holds the same, holds changed since (the family has
 *           kept cooking), and does not hold. Changes nothing.
 *   clear-source  deletes from the FAMILY's database (never the target) every document the
 *           community copy holds — the same or changed since; one it does NOT hold stays,
 *           unless --all. A family household's own document is not deleted but cut down to
 *           its moved mark (movedTo, movedAt), so an old copy of the app still sends people
 *           on. --shared also deletes the first layout's shared/ collection. The shared
 *           translations (i18n/), the settings (config/), the notes (feedback/) and the
 *           accounts stay until the family copy is retired. Needs --confirm "clear the family app".
 *
 * What moves: households (and everything under them), their identifiers
 * (codes/), homes/, linkRequests/, linkTalk/, places kept (pending/,
 * pendingNotice/), invitation links (invites/) and each person's own settings
 * (users/<uid>/prefs/). With --i18n also the shared translations (i18n/).
 * Not: the old pre-household collection (shared/), notes (feedback/ — the
 * Worker's inbox has them) or the family copy's own settings (config/).
 *
 * The FAMILY's database is never changed (beyond the movedTo mark). Someone
 * who already has an account in the target under the same e-mail keeps it:
 * their places in the copied documents are given to that account instead.
 *
 * The repository is public and so are its job logs: this prints counts only —
 * never a name, an address, an id or a recipe.
 *
 * The service account needs: on the source "Cloud Datastore Viewer" and
 * "Firebase Authentication Viewer"; on the target "Cloud Datastore User" and
 * "Firebase Authentication Admin". Checked against the Firebase emulators
 * (FIRESTORE_BASE / IDENTITY_BASE, FIREBASE_KEY=stand-in).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : dflt; };
const has = name => process.argv.indexOf('--' + name) > -1;
const FROM = arg('from', ''), TO = arg('to', ''), MODE = arg('mode', 'survey');
const MARK = arg('mark-moved', ''), WITH_I18N = has('i18n'), RESUME = has('resume');
const OWNER = String(process.env.OWNER_EMAIL || '').toLowerCase();
if (!/^[a-z0-9-]{4,40}$/.test(FROM) || !/^[a-z0-9-]{4,40}$/.test(TO) || FROM === TO) { console.error('usage: --from <project> --to <project> --mode survey|copy|remove'); process.exit(2); }
if (['survey', 'copy', 'remove', 'unmark', 'clear-check', 'clear-source', 'clear-detail'].indexOf(MODE) === -1) { console.error('--mode survey, copy, remove, unmark, clear-check, clear-source or clear-detail'); process.exit(2); }
if (MODE === 'clear-source' && arg('confirm', '') !== 'clear the family app') { console.error('clear-source deletes from ' + FROM + ': add --confirm "clear the family app"'); process.exit(2); }
const CLEAR_ALL = has('all'), CLEAR_SHARED = has('shared');
if (MODE === 'unmark' && arg('confirm', '') !== 'unmark') { console.error('unmark lets the family app work again: add --confirm unmark'); process.exit(2); }
if (MODE === 'remove' && arg('confirm', '') !== 'remove') { console.error('remove takes documents and accounts away from ' + TO + ': add --confirm remove'); process.exit(2); }
if (MARK && !/^https:\/\/[a-z0-9.-]+\/[^\s"']*$/.test(MARK)) { console.error('--mark-moved wants the new address, https://…/'); process.exit(2); }

// The job's log cannot be read from outside GitHub — its summary lines are also
// posted as notices, which can (counts only, as everything here).
const say = line => console.log((process.env.GITHUB_ACTIONS === 'true' ? '::notice::' : '') + line);
const FS = p => (process.env.FIRESTORE_BASE || 'https://firestore.googleapis.com/v1/') + 'projects/' + p + '/databases/(default)/documents';
const IT = p => (process.env.IDENTITY_BASE || 'https://identitytoolkit.googleapis.com/') + 'v1/projects/' + p;
const docName = (p, rel) => 'projects/' + p + '/databases/(default)/documents/' + rel;
// In an address each part of a path is encoded: a kept place's id holds ':' and '@'.
const enc = rel => rel.split('/').map(encodeURIComponent).join('/');

let H = null, calls = 0;
async function headers() {
  const key = process.env.FIREBASE_KEY || '';
  if ((process.env.FIRESTORE_BASE || process.env.IDENTITY_BASE) && key === 'stand-in') return { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  let credentials = null; try { credentials = JSON.parse(key.trim()); } catch (e) {}
  if (!credentials || credentials.type !== 'service_account') throw new Error('FIREBASE_KEY is not a service account key');
  const { GoogleAuth } = require('google-auth-library');
  const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const t = await client.getAccessToken();
  return { Authorization: 'Bearer ' + (t.token || t), 'Content-Type': 'application/json' };
}
const ROLE_HINT = {
  read: 'needs "Cloud Datastore Viewer" (or User) and "Firebase Authentication Viewer" there',
  write: 'needs "Cloud Datastore User" and "Firebase Authentication Admin" there'
};
async function call(url, init, project, need) {
  for (let attempt = 1; ; attempt++) {
    calls++;
    const r = await fetch(url, Object.assign({ headers: H }, init || {}));
    if (r.ok) { const t = await r.text(); return t ? JSON.parse(t) : {}; }
    const t = await r.text();
    if ((r.status === 429 || r.status >= 500) && attempt < 6) { await new Promise(s => setTimeout(s, 1500 * attempt)); continue; }
    if (r.status === 403) throw new Error('the service account was refused by ' + project + ' (403) — it ' + ROLE_HINT[need || 'read']);
    if (r.status === 404 && init && init.allow404) return null;
    // (the answer's words only — never a document's path or an address)
    let why = ''; try { why = String(JSON.parse(t).error.message || ''); } catch (e) { why = t; }
    const what = (/:(listCollectionIds|commit|batchGet|batchCreate|batchDelete)\b/.exec(url) || [, (init && init.method) || 'GET'])[1];
    throw new Error(project + ': HTTP ' + r.status + ' (' + what + ') — ' + why.replace(/\S*@\S*/g, '…').replace(/projects\/\S+/g, '…').slice(0, 200));
  }
}

// ── Documents ────────────────────────────────────────────────────────────────
async function collectionIds(p, docPath) {
  const ids = []; let pageToken;
  do {
    const d = await call(FS(p) + (docPath ? '/' + enc(docPath) : '') + ':listCollectionIds', { method: 'POST', body: JSON.stringify({ pageSize: 300, pageToken }) }, p);
    (d.collectionIds || []).forEach(x => ids.push(x)); pageToken = d.nextPageToken;
  } while (pageToken);
  return ids;
}
// Every document under one collection (sub-collections included).
async function walk(p, colPath, out, keep) {
  let pageToken;
  do {
    const q = '?pageSize=300&showMissing=true' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const d = await call(FS(p) + '/' + enc(colPath) + q, null, p);
    for (const doc of d.documents || []) {
      const rel = doc.name.slice(doc.name.indexOf('/documents/') + '/documents/'.length);
      if ((doc.fields || doc.createTime) && (!keep || keep(rel))) out.push({ path: rel, fields: doc.fields || {}, updated: Date.parse(doc.updateTime || '') || 0 });
      // (an id with ':' — a place kept or a request by e-mail — never has sub-collections, and
      // listing under it is refused: the ':' reads as the method's own)
      if (rel.split('/').pop().indexOf(':') === -1)
        for (const sub of await collectionIds(p, rel)) await walk(p, rel + '/' + sub, out, keep);
    }
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}
const MOVED = ['households', 'codes', 'homes', 'linkRequests', 'linkTalk', 'pending', 'pendingNotice', 'invites', 'users'];
async function sourceDocs() {
  const all = [];
  const top = await collectionIds(FROM, '');
  for (const c of MOVED.concat(WITH_I18N ? ['i18n'] : [])) {
    if (top.indexOf(c) === -1) continue;
    // users/<uid>/… — only the person's own settings (prefs/), never older leftovers.
    await walk(FROM, c, all, c === 'users' ? rel => /^users\/[^/]+\/prefs\/[^/]+$/.test(rel) : null);
  }
  return { docs: all, top };
}

// ── Accounts ─────────────────────────────────────────────────────────────────
async function accounts(p) {
  const out = []; let nextPageToken;
  do {
    const d = await call(IT(p) + '/accounts:batchGet?maxResults=1000' + (nextPageToken ? '&nextPageToken=' + encodeURIComponent(nextPageToken) : ''), null, p);
    (d.users || []).forEach(u => out.push(u)); nextPageToken = d.nextPageToken;
  } while (nextPageToken);
  return out;
}
function importRecord(u) {
  const r = { localId: u.localId };
  ['email', 'emailVerified', 'displayName', 'photoUrl', 'disabled', 'createdAt', 'lastLoginAt', 'customAttributes'].forEach(k => { if (u[k] !== undefined) r[k] = u[k]; });
  r.providerUserInfo = (u.providerUserInfo || []).filter(x => x.providerId && x.providerId !== 'password')
    .map(x => { const o = { providerId: x.providerId, rawId: x.rawId || x.federatedId }; ['email', 'displayName', 'photoUrl'].forEach(k => { if (x[k]) o[k] = x[k]; }); return o; });
  return r;
}

// ── Someone already in the target under the same address keeps that account ──
let uidMap = {};
function mapUid(s) { return Object.prototype.hasOwnProperty.call(uidMap, s) ? uidMap[s] : s; }
function mapPath(rel) { return rel.split('/').map(mapUid).join('/'); }
function mapValue(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return { stringValue: mapUid(v.stringValue) };
  if ('arrayValue' in v) return { arrayValue: { values: (v.arrayValue.values || []).map(mapValue) } };
  if ('mapValue' in v) return { mapValue: { fields: mapFields(v.mapValue.fields || {}) } };
  return v;
}
function mapFields(f) { const o = {}; Object.keys(f).forEach(k => { o[mapUid(k)] = mapValue(f[k]); }); return o; }
function strip(rel, fields) {
  if (!/^households\/[^/]+$/.test(rel)) return fields;
  const o = Object.assign({}, fields); delete o.movedTo; delete o.movedAt; return o;   // the mark stays behind
}
const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { o[k] = sortKeys(v[k]); }); return o; }
  return v;
}

// ── Writing ──────────────────────────────────────────────────────────────────
async function commit(p, writes) {
  let batch = [], size = 0;
  async function flush() {
    if (!batch.length) return;
    await call(FS(p) + ':commit', { method: 'POST', body: JSON.stringify({ writes: batch }) }, p, 'write');
    batch = []; size = 0;
  }
  for (const w of writes) {
    const s = JSON.stringify(w).length;
    if (batch.length && (batch.length >= 400 || size + s > 8 * 1024 * 1024)) await flush();
    batch.push(w); size += s;
  }
  await flush();
}
async function batchGet(p, rels) {
  const found = {};
  for (let i = 0; i < rels.length; i += 100) {
    const d = await call(FS(p) + ':batchGet', { method: 'POST', body: JSON.stringify({ documents: rels.slice(i, i + 100).map(r => docName(p, r)) }) }, p);
    (Array.isArray(d) ? d : [d]).forEach(x => {
      if (x && x.found) found[x.found.name.slice(x.found.name.indexOf('/documents/') + '/documents/'.length)] = x.found.fields || {};
    });
  }
  return found;
}
// When each was last written, by Firestore's own clock (20 Oct 2026: step 9 deletes a document only where the
// community copy's is the newer).
async function updateTimes(p, rels) {
  const at = {};
  for (let i = 0; i < rels.length; i += 100) {
    const d = await call(FS(p) + ':batchGet', { method: 'POST', body: JSON.stringify({ documents: rels.slice(i, i + 100).map(r => docName(p, r)) }) }, p);
    (Array.isArray(d) ? d : [d]).forEach(x => {
      if (x && x.found) at[x.found.name.slice(x.found.name.indexOf('/documents/') + '/documents/'.length)] = Date.parse(x.found.updateTime || '') || 0;
    });
  }
  return at;
}
// clear-detail (20 Oct 2026 — Tony: "What do the 4 deleted items and the 135 shared/ documents contain?"): what the
// documents the community copy does not hold are — names, dates, and whether a recipe of that name or id IS in the
// community copy. Names cannot go in the log (the repository is public), so the list is sealed for whoever holds the
// private key of --pubkey (base64 of a PEM): RSA-OAEP over a fresh AES-256-GCM key; the log carries ciphertext only.
async function sealedDetail(missingL, shared, hids, src) {
  const crypto = require('node:crypto');
  const pem = Buffer.from(String(arg('pubkey', '')), 'base64').toString('utf8');
  if (!/BEGIN PUBLIC KEY/.test(pem)) throw new Error('clear-detail needs --pubkey: a PEM public key, base64');
  const nameIn = (v, depth) => {
    if (!v || depth > 5) return '';
    if (v.mapValue) { const f = v.mapValue.fields || {}; if (f.name && f.name.stringValue) return f.name.stringValue;
      for (const k of Object.keys(f)) { const n = nameIn(f[k], depth + 1); if (n) return n; } }
    if (v.arrayValue) for (const x of v.arrayValue.values || []) { const n = nameIn(x, depth + 1); if (n) return n; }
    if (v.stringValue && /^\s*[[{]/.test(v.stringValue)) { try { const j = JSON.parse(v.stringValue); const n = (j && (j.name || (Array.isArray(j) && j[0] && j[0].name))) || ''; if (n) return String(n); } catch (e) {} }
    return '';
  };
  const nameOf = fields => nameIn({ mapValue: { fields } }, 0);
  const norm = n => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const there = { names: {}, ids: {} };
  for (const h of hids) for (const r of await shallow(TO, 'households/' + h + '/recipes')) {
    there.ids[r.path.split('/').pop()] = true; const n = nameOf(r.fields); if (n) there.names[norm(n)] = n; }
  const fieldsOf = path => ((src.docs.find(d => d.path === path) || {}).fields) || {};
  const describe = (path, fields, updated) => {
    const id = path.split('/').pop(), rid = id.replace(/^(photo|recipe)_/, ''), name = nameOf(fields);
    return { path, name, updated: updated ? new Date(updated).toISOString() : '', fields: Object.keys(fields).sort().slice(0, 25),
      bytes: JSON.stringify(fields).length, sameNameInCommunity: name ? (there.names[norm(name)] || false) : null, sameIdInCommunity: !!there.ids[rid] };
  };
  const detail = { at: new Date().toISOString(), communityRecipes: Object.keys(there.ids).length,
    notThere: missingL.map(x => describe(x.from, fieldsOf(x.from), (src.docs.find(d => d.path === x.from) || {}).updated)),
    shared: shared.map(d => describe(d.path, d.fields || {}, d.updated)) };
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(detail), 'utf8')), c.final()]);
  const ek = crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key);
  const len = Buffer.alloc(2); len.writeUInt16BE(ek.length);
  const blob = Buffer.concat([len, ek, iv, c.getAuthTag(), ct]).toString('base64');
  for (let i = 0; i < blob.length; i += 3000) console.log('SEALED ' + String(i / 3000).padStart(4, '0') + ' ' + blob.slice(i, i + 3000));
  say('the detail of ' + detail.notThere.length + ' not in ' + TO + ' and ' + detail.shared.length + ' in shared/, sealed (' + blob.length + ' characters)');
}
// The documents of one collection only (no sub-collections).
async function shallow(p, colPath) {
  const out = []; let pageToken;
  do {
    const d = await call(FS(p) + '/' + enc(colPath) + '?pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''), null, p);
    (d.documents || []).forEach(doc => out.push({ path: doc.name.slice(doc.name.indexOf('/documents/') + '/documents/'.length), fields: doc.fields || {} }));
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}
async function mark(on) {
  const hh = await shallow(FROM, 'households');
  for (const h of hh) {
    const mask = '?updateMask.fieldPaths=movedTo&updateMask.fieldPaths=movedAt';
    const fields = on ? { movedTo: { stringValue: MARK }, movedAt: { integerValue: String(Date.now()) } } : {};
    await call(FS(FROM) + '/' + enc(h.path) + mask, { method: 'PATCH', body: JSON.stringify({ fields }) }, FROM, 'write');
  }
  return hh.length;
}
const count = list => { const per = {}; list.forEach(d => { const t = d.path.split('/')[0]; per[t] = (per[t] || 0) + 1; }); return per; };
const table = per => Object.keys(per).sort().map(k => k + ' ' + per[k]).join(', ') || 'nothing';

async function main() {
  H = await headers();
  const started = Date.now();
  say('== ' + MODE + ': ' + FROM + ' → ' + TO);
  if (MODE === 'unmark') { const n = await mark(false); say('took the moved mark off ' + n + ' family household(s) — the family app works as before'); return; }

  // Accounts on both sides.
  const fromUsers = await accounts(FROM), toUsers = await accounts(TO);
  const toById = {}, toByEmail = {};
  toUsers.forEach(u => { toById[u.localId] = u; if (u.email) toByEmail[u.email.toLowerCase()] = u; });
  uidMap = {};
  const create = [], kept = [], clash = [];
  let password = 0, ownerKept = false;
  for (const u of fromUsers) {
    const em = String(u.email || '').toLowerCase();
    const there = em && toByEmail[em];
    if (there && there.localId !== u.localId) { uidMap[u.localId] = there.localId; kept.push(u); if (em === OWNER) ownerKept = true; continue; }
    if (toById[u.localId]) {
      if (String(toById[u.localId].email || '').toLowerCase() === em) { kept.push(u); continue; }   // already copied (a second run)
      clash.push(u); continue;                                                                       // the same id, someone else
    }
    if (u.passwordHash) password++;
    create.push(u);
  }
  say('accounts: ' + fromUsers.length + ' in ' + FROM + ', ' + toUsers.length + ' in ' + TO
    + ' — ' + create.length + ' to create (same ids), ' + kept.length + ' already there'
    + (Object.keys(uidMap).length ? ' (' + Object.keys(uidMap).length + ' under another id: their places go to that account'
      + (OWNER ? '; the owner\'s address ' + (ownerKept ? 'IS one of them' : 'is not') : '') + ')' : '')
    + (clash.length ? ', ' + clash.length + ' CLASH (an id taken by someone else)' : '')
    + (password ? ', ' + password + ' sign in with a password (they will need "Forgot password" once)' : ''));

  // Documents.
  const src = await sourceDocs();
  const docs = src.docs.map(d => ({ path: mapPath(d.path), fields: strip(d.path, mapFields(d.fields)) }));
  const hids = docs.filter(d => /^households\/[^/]+$/.test(d.path)).map(d => d.path.split('/')[1]);
  const codes = docs.filter(d => /^codes\/[^/]+$/.test(d.path)).map(d => d.path);
  say('documents in ' + FROM + ': ' + docs.length + ' (' + table(count(docs)) + '); households ' + hids.length
    + '; not moved: ' + (src.top.filter(c => MOVED.indexOf(c) === -1 && !(WITH_I18N && c === 'i18n')).join(', ') || 'nothing'));

  // In the way? A household or an identifier already there (a second run says --resume).
  const there = await batchGet(TO, hids.map(h => 'households/' + h).concat(codes));
  const inTheWay = Object.keys(there).length;
  // Per-person documents of someone who already has an account there: theirs win.
  const personal = docs.filter(d => /^(homes|users)\//.test(d.path) && Object.values(uidMap).indexOf(d.path.split('/')[1]) > -1).map(d => d.path);
  const personalThere = personal.length ? Object.keys(await batchGet(TO, personal)) : [];
  say('already in ' + TO + ': ' + inTheWay + ' of the households and identifiers'
    + (personalThere.length ? '; ' + personalThere.length + ' personal settings of people already there (kept as they are)' : ''));

  if (MODE === 'survey') { say('survey only — nothing changed (' + calls + ' requests, ' + Math.round((Date.now() - started) / 1000) + ' s)'); return; }

  if (MODE === 'clear-check' || MODE === 'clear-source' || MODE === 'clear-detail') {
    // Each family document beside what the community copy holds under its (mapped) name.
    const pairs = src.docs.map((d, i) => ({ from: d.path, to: docs[i].path, fields: docs[i].fields }))
      .filter(x => !/^i18n\//.test(x.from));
    const held = await batchGet(TO, pairs.map(x => x.to));
    const sameL = [], changedL = [], missingL = [];
    pairs.forEach(x => { if (!held[x.to]) missingL.push(x); else if (same(held[x.to], x.fields)) sameL.push(x); else changedL.push(x); });
    const shared = src.top.indexOf('shared') > -1 ? await walk(FROM, 'shared', []) : [];
    const asList = l => l.map(x => ({ path: x.from }));
    say('in ' + FROM + ': ' + pairs.length + ' documents of the moved households and their people — in ' + TO
      + ' the same: ' + sameL.length + ', changed since: ' + changedL.length + ' (' + table(count(asList(changedL))) + ')'
      + ', not there: ' + missingL.length + (missingL.length ? ' (' + table(count(asList(missingL))) + ')' : '')
      + '; the first layout\'s shared/: ' + shared.length);
    // 16 Oct 2026 — and of what KIND, with the date each was last changed where it says: four "not there" needed
    // a name before deciding. Ids become * (the log is public); the dates say nothing about anyone.
    const kind = p => p.split('/').map((seg, i) => i % 2 ? '*' : seg).join('/');
    const kinds = l => { const per = {}; l.forEach(x => { const k = kind(x.from); per[k] = (per[k] || 0) + 1; });
      return Object.keys(per).sort().map(k => k + ' ' + per[k]).join(', ') || 'nothing'; };
    const when = x => { const f = x.fields || {}, v = f.updatedAt || f.at || f.createdAt || {};
      const ms = +v.integerValue || +v.doubleValue || Date.parse(v.timestampValue || '') || 0;
      return ms ? new Date(ms).toISOString().slice(0, 10) : 'no date'; };
    say('by kind — changed since: ' + kinds(changedL) + '; not there: ' + kinds(missingL)
      + (missingL.length ? ' (last changed in ' + FROM + ': ' + missingL.map(when).sort().join(', ') + ')' : ''));
    // 20 Oct 2026 — Tony: "If I have everything you suggest to delete … in the new one then it is OK to delete the old.
    // Please verify that before deleting." The same: every field equal. Changed since: the community copy's must be
    // the NEWER (Firestore's own last-written time), so nothing written in the family copy after the move is lost.
    const fromAt = {}; src.docs.forEach(d => { fromAt[d.path] = d.updated || 0; });
    const toAt = await updateTimes(TO, changedL.map(x => x.to));
    // (a household already cut down to its moved mark by an earlier clearing is our own write, not the family's)
    const onlyMark = x => /^households\/[^/]+$/.test(x.from) && Object.keys((src.docs.find(d => d.path === x.from) || {}).fields || {}).every(k => k === 'movedTo' || k === 'movedAt');
    const olderThere = changedL.filter(x => !onlyMark(x) && !(toAt[x.to] > 0 && toAt[x.to] >= (fromAt[x.from] || 0)));
    say('verified: all ' + (sameL.length + changedL.length) + ' to be deleted are in ' + TO + ' — ' + sameL.length + ' with every field the same, '
      + (changedL.length - olderThere.length) + ' of the ' + changedL.length + ' changed since written there later than here'
      + (olderThere.length ? '; NOT ' + olderThere.length + ' (' + kinds(olderThere) + '): the family copy has the newer — they would be lost' : ''));
    if (MODE === 'clear-detail') { await sealedDetail(missingL, shared, hids, src); say('detail only — nothing changed (' + calls + ' requests)'); return; }
    if (MODE === 'clear-check') { say('check only — nothing changed (' + calls + ' requests, ' + Math.round((Date.now() - started) / 1000) + ' s)'); return; }
    if (olderThere.length) throw new Error(olderThere.length + ' document(s) are newer in ' + FROM + ' than in ' + TO + ' — nothing was deleted');
    const gone = sameL.concat(changedL).concat(CLEAR_ALL ? missingL : []);
    const isHH = rel => /^households\/[^/]+$/.test(rel);
    const writes = [];
    gone.forEach(x => {
      if (isHH(x.from)) {
        const f = (src.docs.find(d => d.path === x.from) || {}).fields || {};
        const keep = {}; if (f.movedTo) keep.movedTo = f.movedTo; if (f.movedAt) keep.movedAt = f.movedAt;
        writes.push(Object.keys(keep).length ? { update: { name: docName(FROM, x.from), fields: keep } } : { delete: docName(FROM, x.from) });
      } else writes.push({ delete: docName(FROM, x.from) });
    });
    if (CLEAR_SHARED) shared.forEach(d => writes.push({ delete: docName(FROM, d.path) }));
    await commit(FROM, writes);
    // Read back: what was deleted is gone; a household is its moved mark and nothing else.
    const asked = writes.map(w => (w.delete || w.update.name)).map(n => n.slice(n.indexOf('/documents/') + '/documents/'.length));
    const left = await batchGet(FROM, asked);
    const wrong = Object.keys(left).filter(rel => !(isHH(rel) && Object.keys(left[rel]).every(k => k === 'movedTo' || k === 'movedAt')));
    const marks = Object.keys(left).length - wrong.length;
    say('cleared from ' + FROM + ': ' + (asked.length - marks) + ' documents deleted (' + table(count(asList(gone).filter(d => !isHH(d.path)).concat(CLEAR_SHARED ? shared : []))) + ')'
      + ', ' + marks + ' household(s) cut down to the moved mark'
      + (CLEAR_ALL ? '' : ', ' + missingL.length + ' not in ' + TO + ' kept (--all deletes them too)')
      + (CLEAR_SHARED ? '' : ', shared/ kept (' + shared.length + '; --shared deletes it)')
      + ' — ' + wrong.length + ' still there');
    if (wrong.length) throw new Error(wrong.length + ' document(s) could not be cleared');
    return;
  }

  if (MODE === 'remove') {
    // Everything the copy wrote — the shared translations never; and of the
    // personal settings of someone who already had an account there, only
    // those that are still exactly what the copy put there.
    const now = personal.length ? await batchGet(TO, personal) : {};
    const own = docs.filter(d => !/^i18n\//.test(d.path)
      && (personal.indexOf(d.path) === -1 || (now[d.path] && same(now[d.path], d.fields))));
    await commit(TO, own.map(d => ({ delete: docName(TO, d.path) })));
    // Accounts this tool made: the same ids, created by the copy (never someone who had one before).
    const made = fromUsers.filter(u => toById[u.localId] && String(toById[u.localId].email || '').toLowerCase() === String(u.email || '').toLowerCase()).map(u => u.localId);
    for (let i = 0; i < made.length; i += 1000)
      await call(IT(TO) + '/accounts:batchDelete', { method: 'POST', body: JSON.stringify({ localIds: made.slice(i, i + 1000), force: true }) }, TO, 'write');
    const left = await batchGet(TO, own.map(d => d.path));
    say('removed from ' + TO + ': ' + own.length + ' documents, ' + made.length + ' accounts'
      + ' — ' + Object.keys(left).length + ' still there');
    if (Object.keys(left).length) throw new Error(Object.keys(left).length + ' documents could not be removed');
    return;
  }

  // copy
  const writing = docs.filter(d => personalThere.indexOf(d.path) === -1);
  if (clash.length) throw new Error(clash.length + ' account id(s) in ' + TO + ' belong to someone else — nothing was copied');
  if (inTheWay && !RESUME) throw new Error(inTheWay + ' of the households or identifiers are already in ' + TO + ' — nothing was copied (a second run of the same copy: --resume)');
  let marked = 0;
  try {
    if (MARK) { marked = await mark(true); say('marked ' + marked + ' family household(s) as moved — the family app stops and points to the new address'); }
    if (process.env.MOVE_TEST_FAIL === 'after-mark') throw new Error('a failure on purpose (the tests)');
    // Accounts first: a document naming someone who cannot sign in is no use.
    for (let i = 0; i < create.length; i += 500) {
      const users = create.slice(i, i + 500).map(importRecord);
      const r = await call(IT(TO) + '/accounts:batchCreate', { method: 'POST', body: JSON.stringify({ users }) }, TO, 'write');
      const errs = (r && r.error) || [];
      if (errs.length) throw new Error(errs.length + ' account(s) could not be created: ' + errs.slice(0, 3).map(e => String(e.message).replace(/\S+@\S+/g, '…')).join('; '));
    }
    const afterUsers = await accounts(TO), afterIds = {};
    afterUsers.forEach(u => { afterIds[u.localId] = true; });
    const missingUsers = create.filter(u => !afterIds[u.localId]).length;
    if (missingUsers) throw new Error(missingUsers + ' account(s) are not in ' + TO + ' after the copy');
    say('accounts created: ' + create.length);

    await commit(TO, writing.map(d => ({ update: { name: docName(TO, d.path), fields: d.fields } })));
    // Read every one back and compare.
    const back = await batchGet(TO, writing.map(d => d.path));
    const wrong = writing.filter(d => !back[d.path] || !same(back[d.path], d.fields));
    say('documents copied: ' + writing.length + ' (' + table(count(writing)) + ') — read back: ' + Object.keys(back).length + ', different: ' + wrong.length);
    if (wrong.length) throw new Error(wrong.length + ' document(s) did not read back the same (' + table(count(wrong)) + ')');
  } catch (e) {
    if (marked) { try { await mark(false); say('the moved mark was taken off again — the family app works as before'); } catch (e2) { console.log('::error::could not take the moved mark off: ' + e2.message); } }
    throw e;
  }
  say('done in ' + Math.round((Date.now() - started) / 1000) + ' s, ' + calls + ' requests');
}

main().catch(e => { console.log('::error::' + ((e && e.message) || e)); process.exit(1); });
