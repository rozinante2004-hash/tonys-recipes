/**
 * v39.10 — sent recipes (recipeGifts/<id>) and their pictures (recipeGiftPhotos/<id>)
 * removed once their 4 weeks are over, every night, by
 * .github/workflows/clear-sent-recipes.yml. Firestore's own time-to-live rules need
 * billing switched on (Tony, 29 Oct 2026: "Project my-kitchen-notes-beta has billing
 * disabled") — this job does the same on the free plan. The app's own daily sweep
 * (giftSweep) still clears a kitchen's expired ones; this catches the kitchens that
 * never come back.
 *
 *     FIREBASE_KEY='<service account JSON>' node tools/clear-sent-recipes.mjs --project my-kitchen-notes-beta
 *
 * Only the documents' names are read (expireAt before now), never their contents, and
 * only counts are printed. The service account (FIREBASE_RULES_KEY) needs "Cloud
 * Datastore User" on the project — without it the job warns and does nothing.
 * Checked against the Firestore emulator (FIRESTORE_BASE, FIREBASE_KEY=stand-in).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PROJECT = arg('project', '');
if (!/^[a-z0-9-]{4,40}$/.test(PROJECT)) { console.error('--project <id>'); process.exit(2); }
const ROOT = (process.env.FIRESTORE_BASE || 'https://firestore.googleapis.com/v1/') + 'projects/' + PROJECT + '/databases/(default)';
const DOCS = ROOT + '/documents';
const COLLECTIONS = ['recipeGifts', 'recipeGiftPhotos'];
const PAGE = 300, ROUNDS = 40;

async function headers() {
  const key = process.env.FIREBASE_KEY || '';
  if (process.env.FIRESTORE_BASE && key === 'stand-in') return { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  let credentials = null; try { credentials = JSON.parse(key.trim()); } catch (e) {}
  if (!credentials || credentials.type !== 'service_account') throw new Error('FIREBASE_KEY is not a service account key');
  const { GoogleAuth } = require('google-auth-library');
  const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient();
  const t = await client.getAccessToken();
  return { Authorization: 'Bearer ' + (t.token || t), 'Content-Type': 'application/json' };
}
class Refused extends Error {}
let H = null;
async function call(url, body) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body) });
    if (r.ok) return r.json();
    const t = await r.text();
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise(s => setTimeout(s, 2000 * attempt)); continue; }
    if (r.status === 403) throw new Refused(t.slice(0, 200));
    throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200));
  }
}
// The names of up to PAGE documents of one collection whose expireAt is before now.
async function expired(col, now) {
  const rows = await call(DOCS + ':runQuery', { structuredQuery: {
    from: [{ collectionId: col }],
    where: { fieldFilter: { field: { fieldPath: 'expireAt' }, op: 'LESS_THAN', value: { timestampValue: now } } },
    select: { fields: [{ fieldPath: '__name__' }] },
    limit: PAGE } });
  return rows.filter(x => x.document).map(x => x.document.name);
}

try {
  H = await headers();
  const now = new Date().toISOString();
  const gone = {};
  for (const col of COLLECTIONS) {
    gone[col] = 0;
    for (let round = 0; round < ROUNDS; round++) {
      const names = await expired(col, now);
      if (!names.length) break;
      await call(DOCS + ':commit', { writes: names.map(name => ({ delete: name })) });
      gone[col] += names.length;
      if (names.length < PAGE) break;
    }
  }
  const msg = 'Sent recipes past their 4 weeks removed from ' + PROJECT + ': ' + gone.recipeGifts + ' recipe(s), ' + gone.recipeGiftPhotos + ' picture(s).';
  console.log(process.env.GITHUB_ACTIONS ? '::notice::' + msg : msg);
} catch (e) {
  if (e instanceof Refused) {
    console.log('::warning::The database key may not delete in ' + PROJECT + ' — give its service account "Cloud Datastore User" there. Nothing was removed.');
    process.exit(0);
  }
  console.log('::error::Clearing sent recipes failed: ' + e.message);
  process.exit(1);
}
