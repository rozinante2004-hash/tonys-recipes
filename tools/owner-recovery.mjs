/**
 * 14 Oct 2026 — the way back in when the owner's authenticator is gone (a lost, replaced or
 * company phone). Tony, 14 Oct 2026: "the phone is a work phone and I won't always have
 * it … my next phone may not be an iPhone". Run by .github/workflows/owner-recovery.yml,
 * by hand — so it needs only his GitHub account, never the phone.
 *
 *     FIREBASE_KEY='<service account JSON>' OWNER_EMAIL=… OWNER_SECONDARY_EMAIL=… \
 *       node tools/owner-recovery.mjs --project my-kitchen-notes-beta \
 *         --action stop-requiring|remove-authenticator|both --who main|spare --confirm "recover the owner"
 *
 * stop-requiring        config/security.ownerTwoStep → false: the owner's tools no longer
 *                       need the code (turned on again from the app, with a new code).
 * remove-authenticator  takes every second step off ONE owner account (the main address
 *                       or the spare one), so Google alone signs it in — then a new
 *                       authenticator is set up in the app (⚙️ → 👑 → 🔐).
 * both                  the two together.
 *
 * The repository is public and so are its job logs: this prints what changed, never an
 * address or an account id. The addresses come from the GitHub secrets OWNER_EMAIL and
 * OWNER_SECONDARY_EMAIL. The service account (FIREBASE_RULES_KEY) needs "Cloud Datastore
 * User" and "Firebase Authentication Admin" on the project. Checked against the Firebase
 * emulators (FIRESTORE_BASE / IDENTITY_BASE, FIREBASE_KEY=stand-in).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PROJECT = arg('project', ''), ACTION = arg('action', ''), WHO = arg('who', 'main');
if (!/^[a-z0-9-]{4,40}$/.test(PROJECT)) { console.error('--project <id>'); process.exit(2); }
if (['stop-requiring', 'remove-authenticator', 'both'].indexOf(ACTION) === -1) { console.error('--action stop-requiring, remove-authenticator or both'); process.exit(2); }
if (['main', 'spare'].indexOf(WHO) === -1) { console.error('--who main or spare'); process.exit(2); }
if (arg('confirm', '') !== 'recover the owner') { console.error('this changes the owner\'s protection: add --confirm "recover the owner"'); process.exit(2); }

const say = line => console.log((process.env.GITHUB_ACTIONS === 'true' ? '::notice::' : '') + line);
const FS = (process.env.FIRESTORE_BASE || 'https://firestore.googleapis.com/v1/') + 'projects/' + PROJECT + '/databases/(default)/documents';
const IT = (process.env.IDENTITY_BASE || 'https://identitytoolkit.googleapis.com/') + 'v1/projects/' + PROJECT;

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
let H = null;
async function call(url, init, what) {
  const r = await fetch(url, Object.assign({ headers: H }, init || {}));
  const t = await r.text();
  if (r.ok) return t ? JSON.parse(t) : {};
  if (r.status === 404 && init && init.allow404) return null;
  if (r.status === 403) throw new Error(what + ': the service account was refused (403) — it needs "Cloud Datastore User" and "Firebase Authentication Admin" on ' + PROJECT);
  let why = ''; try { why = String(JSON.parse(t).error.message || ''); } catch (e) { why = t; }
  throw new Error(what + ': HTTP ' + r.status + ' — ' + why.replace(/\S*@\S*/g, '…').replace(/projects\/\S+/g, '…').slice(0, 200));
}

async function stopRequiring() {
  const doc = await call(FS + '/config/security', { allow404: true }, 'reading the switch');
  const was = !!(doc && doc.fields && doc.fields.ownerTwoStep && doc.fields.ownerTwoStep.booleanValue);
  const mask = ['ownerTwoStep', 'by', 'at'].map(f => 'updateMask.fieldPaths=' + f).join('&');
  await call(FS + '/config/security?' + mask, { method: 'PATCH', body: JSON.stringify({ fields: {
    ownerTwoStep: { booleanValue: false }, by: { stringValue: 'owner recovery (GitHub)' }, at: { integerValue: String(Date.now()) } } }) }, 'changing the switch');
  const back = await call(FS + '/config/security', {}, 'reading the switch back');
  if (back.fields.ownerTwoStep.booleanValue !== false) throw new Error('the switch did not change');
  say('The authenticator is ' + (was ? 'no longer required' : 'still not required (it was not)') + ' for the owner\'s tools in ' + PROJECT + '.');
}

async function removeAuthenticator() {
  const email = String(WHO === 'spare' ? process.env.OWNER_SECONDARY_EMAIL || '' : process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const label = WHO === 'spare' ? 'the spare owner account' : 'the main owner account';
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error('no address for ' + label + ' (GitHub secret ' + (WHO === 'spare' ? 'OWNER_SECONDARY_EMAIL' : 'OWNER_EMAIL') + ')');
  const look = async () => {
    const d = await call(IT + '/accounts:lookup', { method: 'POST', body: JSON.stringify({ email: [email] }) }, 'finding ' + label);
    const u = (d.users || [])[0];
    if (!u) throw new Error('there is no account with ' + label + '\'s address in ' + PROJECT);
    return u;
  };
  const u = await look();
  const n = (u.mfaInfo || []).length;
  if (!n) { say(label.charAt(0).toUpperCase() + label.slice(1) + ' had no authenticator in ' + PROJECT + ' — nothing to remove.'); return; }
  await call(IT + '/accounts:update', { method: 'POST', body: JSON.stringify({ localId: u.localId, mfa: {} }) }, 'removing the authenticator');
  let after = await look();
  if ((after.mfaInfo || []).length) {   // (the same request in the shape with an empty list)
    await call(IT + '/accounts:update', { method: 'POST', body: JSON.stringify({ localId: u.localId, mfa: { enrollments: [] } }) }, 'removing the authenticator');
    after = await look();
  }
  if ((after.mfaInfo || []).length) throw new Error(label + ' still has ' + after.mfaInfo.length + ' second step(s)');
  say('Removed ' + n + ' authenticator' + (n === 1 ? '' : 's') + ' from ' + label + ' in ' + PROJECT + ': it signs in with Google alone until a new one is set up.');
}

try {
  H = await headers();
  if (ACTION === 'stop-requiring' || ACTION === 'both') await stopRequiring();
  if (ACTION === 'remove-authenticator' || ACTION === 'both') await removeAuthenticator();
} catch (e) {
  console.log('::error::' + ((e && e.message) || e));
  process.exit(1);
}
