// 14 Oct 2026 — tools/owner-recovery.mjs against the Firestore and Auth emulators: "Require" is
// switched off, the owner's second step is taken off his account, the spare's address is
// used for --who spare, nothing runs without the typed confirmation, and no address or
// account id ever reaches the log.
//   firebase emulators:exec --only firestore,auth --project demo-family "node owner-recovery.test.mjs <tool>"
import { execFileSync } from 'node:child_process';
const FS = 'http://127.0.0.1:8086/v1/', IT = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/';
const P = 'demo-family', TOOL = process.argv[2];
const OWNER = 'owner@example.com', SPARE = 'spare@example.com';
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
let failed = 0;
const ok = (name, cond, more) => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond || !more ? '' : ' — ' + more)); if (!cond) failed++; };
async function j(url, init) { const r = await fetch(url, Object.assign({ headers: H }, init || {})); const t = await r.text(); if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 200)); return t ? JSON.parse(t) : {}; }
function run(args, env) {
  try { return { code: 0, out: execFileSync('node', [TOOL].concat(args), { env: Object.assign({}, process.env,
    { FIRESTORE_BASE: FS, IDENTITY_BASE: IT, FIREBASE_KEY: 'stand-in', OWNER_EMAIL: OWNER, OWNER_SECONDARY_EMAIL: SPARE, GITHUB_ACTIONS: '' }, env || {}), encoding: 'utf8', stdio: 'pipe' }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; }
}
const ITP = IT + 'v1/projects/' + P, FSP = FS + 'projects/' + P + '/databases/(default)/documents';
async function account(email, withSecond) {
  const u = await j(ITP + '/accounts', { method: 'POST', body: JSON.stringify({ email, password: 'pw-123456', emailVerified: true }) });
  if (withSecond) await j(ITP + '/accounts:update', { method: 'POST', body: JSON.stringify({ localId: u.localId,
    mfa: { enrollments: [{ mfaEnrollmentId: 'enr-' + email.split('@')[0], phoneInfo: '+15555550100', displayName: 'second step' }] } }) });
  return u.localId;
}
const seconds = async email => ((await j(ITP + '/accounts:lookup', { method: 'POST', body: JSON.stringify({ email: [email] }) })).users[0].mfaInfo || []).length;
const required = async () => { const d = await j(FSP + '/config/security'); return d.fields.ownerTwoStep.booleanValue; };

const ownerId = await account(OWNER, true);
await j(FSP + '/config/security?updateMask.fieldPaths=ownerTwoStep', { method: 'PATCH', body: JSON.stringify({ fields: { ownerTwoStep: { booleanValue: true } } }) });
ok('set up: the owner has a second step, and it is required', (await seconds(OWNER)) === 1 && (await required()) === true);

let r = run(['--project', P, '--action', 'both', '--who', 'main']);
ok('nothing happens without the typed confirmation', r.code === 2 && (await seconds(OWNER)) === 1 && (await required()) === true, r.out);

r = run(['--project', P, '--action', 'stop-requiring', '--confirm', 'recover the owner']);
ok('stop-requiring: no longer required, the second step kept', r.code === 0 && (await required()) === false && (await seconds(OWNER)) === 1, r.out);
ok('…and it says so', /no longer required/.test(r.out), r.out);

r = run(['--project', P, '--action', 'remove-authenticator', '--who', 'main', '--confirm', 'recover the owner']);
ok('remove-authenticator: the main account has no second step', r.code === 0 && (await seconds(OWNER)) === 0, r.out);
ok('…and it says how many', /Removed 1 authenticator from the main owner account/.test(r.out), r.out);

r = run(['--project', P, '--action', 'remove-authenticator', '--who', 'main', '--confirm', 'recover the owner']);
ok('again: nothing to remove, no failure', r.code === 0 && /nothing to remove/.test(r.out), r.out);

r = run(['--project', P, '--action', 'both', '--who', 'spare', '--confirm', 'recover the owner']);
ok('the spare address with no account there: a plain refusal', r.code === 1 && /no account with the spare owner account/.test(r.out), r.out);

await account(SPARE, true);
await j(FSP + '/config/security?updateMask.fieldPaths=ownerTwoStep', { method: 'PATCH', body: JSON.stringify({ fields: { ownerTwoStep: { booleanValue: true } } }) });
r = run(['--project', P, '--action', 'both', '--who', 'spare', '--confirm', 'recover the owner']);
ok('both, for the spare: its second step gone and not required', r.code === 0 && (await seconds(SPARE)) === 0 && (await required()) === false, r.out);

const all = [run(['--project', P, '--action', 'both', '--who', 'main', '--confirm', 'recover the owner']).out, r.out].join('\n');
ok('no address or account id in the output', !/@/.test(all) && all.indexOf(ownerId) === -1, all);

if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('owner recovery: all checks passed');
