
import { execFileSync } from 'node:child_process';
const FS = 'http://127.0.0.1:8086/v1/', IT = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/';
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
// v38.22 — tools/move-family.mjs rehearsed against the Firebase emulators (Firestore + Auth), two demo projects:
// the family and the community copy. Run by CI (Self Tests → Family move (emulator)).
const TOOL = process.argv[2];
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const sv = s => ({ stringValue: s });
async function put(p, rel, fields) { const r = await fetch(FS + 'projects/' + p + '/databases/(default)/documents/' + rel, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) }); if (!r.ok) throw new Error(rel + ' ' + r.status + ' ' + await r.text()); }
async function get(p, rel) { const r = await fetch(FS + 'projects/' + p + '/databases/(default)/documents/' + rel, { headers: H }); return r.ok ? r.json() : null; }
async function users(p, list) { const r = await fetch(IT + 'v1/projects/' + p + '/accounts:batchCreate', { method: 'POST', headers: H, body: JSON.stringify({ users: list }) }); const j = await r.json(); if (!r.ok || (j.error && j.error.length)) throw new Error(JSON.stringify(j)); }
async function allUsers(p) { const r = await fetch(IT + 'v1/projects/' + p + '/accounts:batchGet?maxResults=1000', { headers: H }); return (await r.json()).users || []; }
function run(args, env) {
  try { return { code: 0, out: execFileSync('node', [TOOL].concat(args), { env: Object.assign({}, process.env, { FIRESTORE_BASE: FS, IDENTITY_BASE: IT, FIREBASE_KEY: 'stand-in', OWNER_EMAIL: 'owner@example.com' }, env || {}), encoding: 'utf8' }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; }
}
const F = 'demo-family', T = 'demo-community';
// The family.
await users(F, [
  { localId: 'uOWNERfam', email: 'owner@example.com', emailVerified: true, displayName: 'Owner', providerUserInfo: [{ providerId: 'google.com', rawId: 'g-111', email: 'owner@example.com' }] },
  { localId: 'uKIDfam000', email: 'kid@example.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com', rawId: 'g-222', email: 'kid@example.com' }] }
]);
await put(F, 'households/H1', { name: sv("Family's Recipes"), ownerUid: sv('uOWNERfam'), code: sv('MKN-AAAA-BBBB'), createdAt: { integerValue: '1' } });
await put(F, 'households/H1/members/uOWNERfam', { role: sv('owner'), email: sv('owner@example.com') });
await put(F, 'households/H1/members/uKIDfam000', { role: sv('editor'), email: sv('kid@example.com') });
for (let i = 0; i < 5; i++) await put(F, 'households/H1/recipes/r' + i, { name: sv('Recipe ' + i), uid: sv(i % 2 ? 'uKIDfam000' : 'uOWNERfam'), seen: { mapValue: { fields: { uOWNERfam: { booleanValue: true } } } }, tags: { arrayValue: { values: [sv('a'), sv('uKIDfam000')] } } });
await put(F, 'households/H1/photos/r1', { data: sv('x'.repeat(300000)) });
await put(F, 'households/H1/chats/c1', { t: sv('hi') });
await put(F, 'households/H1/state/s', { v: { integerValue: '3' } });
await put(F, 'households/H2', { name: sv('Kid household'), ownerUid: sv('uKIDfam000'), code: sv('MKN-CCCC-DDDD'), createdAt: { integerValue: '2' } });
await put(F, 'households/H2/members/uKIDfam000', { role: sv('owner') });
await put(F, 'households/H2/links/H1', { hid: sv('H1') });
await put(F, 'households/H1/links/H2', { hid: sv('H2') });
await put(F, 'codes/MKN-AAAA-BBBB', { hid: sv('H1') });
await put(F, 'codes/MKN-CCCC-DDDD', { hid: sv('H2') });
await put(F, 'homes/uOWNERfam', { hid: sv('H1') });
await put(F, 'homes/uKIDfam000', { hid: sv('H2') });
await put(F, 'linkTalk/H1_H2/messages/m1', { text: sv('hello'), by: sv('uOWNERfam') });
await put(F, 'pending/H1:aunt@example.com', { hid: sv('H1'), email: sv('aunt@example.com'), role: sv('viewer') });
await put(F, 'invites/INV1', { hid: sv('H1'), role: sv('viewer'), createdBy: sv('uOWNERfam') });
await put(F, 'users/uOWNERfam/prefs/legal', { v: sv('1.2') });
await put(F, 'users/uOWNERfam/old/thing', { v: sv('stale') });
await put(F, 'shared/legacy', { v: sv('old') });
await put(F, 'feedback/n1', { text: sv('note') });
await put(F, 'config/founding', { open: { booleanValue: false } });
await put(F, 'i18n/he', { v: sv('shalom') });
// The community copy: the owner already has an account there (another id) and a home of his own.
await users(T, [{ localId: 'uOWNERcom', email: 'owner@example.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com', rawId: 'g-111', email: 'owner@example.com' }] }]);
await put(T, 'homes/uOWNERcom', { hid: sv('BETAHH') });

let r = run(['--from', F, '--to', T, '--mode', 'survey']);
console.log(r.out);
ok(r.code === 0, 'survey runs');
ok(/accounts: 2 in demo-family, 1 in demo-community — 1 to create \(same ids\), 1 already there \(1 under another id: their places go to that account; the owner's address IS one of them\)/.test(r.out), 'survey: one account to create, the owner kept under his id');
ok(/households 2/.test(r.out) && /not moved: config, feedback, i18n, shared/.test(r.out), 'survey: two households; config, feedback, shared stay');
ok(!/example\.com|uOWNER|uKID|MKN-|Recipe /.test(r.out), 'survey prints no address, id, identifier or recipe');
ok(!(await get(T, 'households/H1')), 'survey changed nothing');

r = run(['--from', F, '--to', T, '--mode', 'copy', '--mark-moved', 'https://new.example/'], { MOVE_TEST_FAIL: 'after-mark' });
ok(r.code === 1 && /the moved mark was taken off again/.test(r.out), 'a failure after marking takes the mark off');
const h1a = await get(F, 'households/H1');
ok(h1a && !h1a.fields.movedTo, 'the family household is not marked after a failure');
ok(!(await get(T, 'households/H1')), '…and nothing was copied');

r = run(['--from', F, '--to', T, '--mode', 'copy', '--mark-moved', 'https://new.example/']);
console.log(r.out);
ok(r.code === 0, 'copy runs');
ok(/read back: \d+, different: 0/.test(r.out), 'every document read back the same');
ok(!/example\.com\b(?!\/)|uOWNER|uKID|MKN-/.test(r.out.replace('https://new.example/', '')), 'copy prints no address, id or identifier');
const h1 = await get(T, 'households/H1');
ok(h1 && h1.fields.ownerUid.stringValue === 'uOWNERcom', "the owner's place goes to his existing account");
ok(h1 && !h1.fields.movedTo, 'the copied household carries no moved mark');
ok(!!(await get(T, 'households/H1/members/uOWNERcom')) && !(await get(T, 'households/H1/members/uOWNERfam')), 'his membership is under his existing id');
ok(!!(await get(T, 'households/H1/members/uKIDfam000')), "the kid's membership keeps its id");
const r0 = await get(T, 'households/H1/recipes/r0'), r1 = await get(T, 'households/H1/recipes/r1');
ok(r0.fields.uid.stringValue === 'uOWNERcom' && r1.fields.uid.stringValue === 'uKIDfam000', 'ids inside fields are mapped');
ok(!!r0.fields.seen.mapValue.fields.uOWNERcom && !r0.fields.seen.mapValue.fields.uOWNERfam, 'ids as map keys are mapped');
ok((await get(T, 'households/H1/photos/r1')).fields.data.stringValue.length === 300000, 'a large photo arrives whole');
ok(!!(await get(T, 'households/H2/links/H1')) && !!(await get(T, 'linkTalk/H1_H2/messages/m1')), 'links and their conversation');
ok(!!(await get(T, 'codes/MKN-AAAA-BBBB')) && !!(await get(T, 'invites/INV1')) && !!(await get(T, 'pending/H1:aunt@example.com')), 'identifiers, invitations and kept places');
ok((await get(T, 'homes/uOWNERcom')).fields.hid.stringValue === 'BETAHH', "the owner's own home there is kept as it was");
ok(!!(await get(T, 'homes/uKIDfam000')), "the kid's home is copied");
ok(!!(await get(T, 'users/uOWNERcom/prefs/legal')) && !(await get(T, 'users/uOWNERcom/old/thing')), 'personal settings: prefs only');
ok(!(await get(T, 'shared/legacy')) && !(await get(T, 'feedback/n1')) && !(await get(T, 'config/founding')) && !(await get(T, 'i18n/he')), 'shared, feedback, config and (without --i18n) i18n stay behind');
const tu = await allUsers(T);
const kid = tu.find(u => u.localId === 'uKIDfam000');
ok(tu.length === 2 && kid && kid.email === 'kid@example.com' && (kid.providerUserInfo || []).some(p => p.providerId === 'google.com' && p.rawId === 'g-222'), "the kid's account is created with the same id and Google identity");
const h1f = await get(F, 'households/H1'), h2f = await get(F, 'households/H2');
ok(h1f.fields.movedTo.stringValue === 'https://new.example/' && h2f.fields.movedTo, 'every family household is marked as moved');
ok((await get(F, 'households/H1/recipes/r0')).fields.uid.stringValue === 'uOWNERfam', "the family's own documents are unchanged");

r = run(['--from', F, '--to', T, '--mode', 'unmark']);
ok(r.code === 2, 'unmark needs --confirm unmark');
r = run(['--from', F, '--to', T, '--mode', 'unmark', '--confirm', 'unmark']);
const h1u = await get(F, 'households/H1');
ok(r.code === 0 && !h1u.fields.movedTo && !h1u.fields.movedAt && h1u.fields.name.stringValue === "Family's Recipes", 'unmark takes the mark off (the way back), and nothing else');
r = run(['--from', F, '--to', T, '--mode', 'copy']);
ok(r.code === 1 && /already in demo-community — nothing was copied/.test(r.out), 'a second copy refuses without --resume');
r = run(['--from', F, '--to', T, '--mode', 'copy', '--resume', '--i18n']);
ok(r.code === 0 && !!(await get(T, 'i18n/he')), 'a second copy with --resume (and --i18n) runs');

r = run(['--from', F, '--to', T, '--mode', 'remove']);
ok(r.code === 2, 'remove needs --confirm remove');
r = run(['--from', F, '--to', T, '--mode', 'remove', '--confirm', 'remove']);
console.log(r.out);
ok(r.code === 0 && /still there$|— 0 still there/m.test(r.out), 'remove runs');
ok(!(await get(T, 'households/H1')) && !(await get(T, 'households/H1/recipes/r0')) && !(await get(T, 'codes/MKN-AAAA-BBBB')), 'the copied documents are gone');
ok((await get(T, 'homes/uOWNERcom')).fields.hid.stringValue === 'BETAHH', "the owner's own home there is still there");
ok(!!(await get(T, 'i18n/he')), 'the shared translations are never removed');
const tu2 = await allUsers(T);
ok(tu2.length === 1 && tu2[0].localId === 'uOWNERcom', 'the account it created is gone; his own stays');

// Someone else under the same id: refused.
await users(T, [{ localId: 'uKIDfam000', email: 'stranger@example.com', emailVerified: true }]);
r = run(['--from', F, '--to', T, '--mode', 'copy']);
ok(r.code === 1 && /belong to someone else — nothing was copied/.test(r.out), 'an id taken by someone else stops the copy');
// v38.40 — move-day step 9: clearing the FAMILY's database a week later, only what the community copy holds.
{
  const F2 = 'demo-family2', T2 = 'demo-community2';
  await users(F2, [{ localId: 'uMOMfam', email: 'mom@example.com', emailVerified: true, providerUserInfo: [{ providerId: 'google.com', rawId: 'g-333', email: 'mom@example.com' }] }]);
  await put(F2, 'households/H9', { name: sv('Kitchen'), ownerUid: sv('uMOMfam'), code: sv('MKN-EEEE-FFFF') });
  await put(F2, 'households/H9/members/uMOMfam', { role: sv('owner'), email: sv('mom@example.com') });
  for (let i = 0; i < 4; i++) await put(F2, 'households/H9/recipes/r' + i, { name: sv('Dish ' + i) });
  await put(F2, 'codes/MKN-EEEE-FFFF', { hid: sv('H9') });
  await put(F2, 'homes/uMOMfam', { hid: sv('H9') });
  await put(F2, 'shared/recipe_1', { r: sv('old layout') });
  await put(F2, 'i18n/he', { v: sv('shalom') });
  await put(F2, 'config/founding', { open: { booleanValue: false } });
  let c = run(['--from', F2, '--to', T2, '--mode', 'copy', '--mark-moved', 'https://new.example/']);
  ok(c.code === 0, 'step 9 set-up: the copy runs');
  // A week of cooking in the community copy: one recipe changed, one deleted.
  await put(T2, 'households/H9/recipes/r2', { name: sv('Dish 2, improved') });
  await fetch(FS + 'projects/' + T2 + '/databases/(default)/documents/households/H9/recipes/r3', { method: 'DELETE', headers: H });
  c = run(['--from', F2, '--to', T2, '--mode', 'clear-check']);
  console.log(c.out);
  ok(c.code === 0 && /the same: 6, changed since: 1 \(households 1\), not there: 1 \(households 1\); the first layout's shared\/: 1/.test(c.out), 'clear-check counts the same, the changed and the missing');
  ok(!!(await get(F2, 'households/H9/recipes/r0')), 'clear-check changes nothing');
  ok(/by kind — changed since: households\/\*\/recipes\/\* 1; not there: households\/\*\/recipes\/\* 1 \(last changed in demo-family2: (no date|\d{4}-\d\d-\d\d)\)/.test(c.out) && !/H9|r3|uMOMfam/.test(c.out.split('by kind')[1] || ''),
    'clear-check says of what kind, with no ids');
  ok(/verified: all 7 to be deleted are in demo-community2 — 6 with every field the same, 1 of the 1 changed since written there later than here/.test(c.out), 'clear-check proves the community copy holds all it would delete, the changed ones newer');
  c = run(['--from', F2, '--to', T2, '--mode', 'clear-source']);
  ok(c.code === 2 && !!(await get(F2, 'households/H9/recipes/r0')), 'clear-source needs --confirm "clear the family app"');
  // 20 Oct 2026 — a document changed in the FAMILY copy after the community copy's: nothing is deleted.
  await new Promise(r => setTimeout(r, 20));
  await put(F2, 'households/H9/recipes/r2', { name: sv('Dish 2, changed in the old app') });
  c = run(['--from', F2, '--to', T2, '--mode', 'clear-source', '--confirm', 'clear the family app']);
  ok(c.code === 1 && /NOT 1 \(households\/\*\/recipes\/\* 1\)/.test(c.out) && /nothing was deleted/.test(c.out)
    && !!(await get(F2, 'households/H9/recipes/r0')) && !!(await get(F2, 'codes/MKN-EEEE-FFFF')), 'a document newer in the family copy stops the clearing — nothing deleted');
  await put(T2, 'households/H9/recipes/r2', { name: sv('Dish 2, improved again') });   // the community copy written last again
  c = run(['--from', F2, '--to', T2, '--mode', 'clear-source', '--confirm', 'clear the family app']);
  console.log(c.out);
  ok(c.code === 0 && /— 0 still there/.test(c.out), 'clear-source runs');
  ok(!(await get(F2, 'households/H9/recipes/r0')) && !(await get(F2, 'households/H9/recipes/r2')) && !(await get(F2, 'households/H9/members/uMOMfam'))
    && !(await get(F2, 'codes/MKN-EEEE-FFFF')) && !(await get(F2, 'homes/uMOMfam')), 'what the community copy holds is gone from the family database (the same, and the changed since)');
  ok(!!(await get(F2, 'households/H9/recipes/r3')), 'a recipe the community copy does not hold is kept');
  const tomb = await get(F2, 'households/H9');
  ok(tomb && Object.keys(tomb.fields).sort().join(',') === 'movedAt,movedTo', 'the household is cut down to its moved mark (an old app still sends people on)');
  ok(!!(await get(F2, 'shared/recipe_1')) && !!(await get(F2, 'i18n/he')) && !!(await get(F2, 'config/founding')), 'shared/ (without --shared), i18n/ and config/ stay');
  ok((await allUsers(F2)).length === 1, 'the accounts stay');
  ok(!!(await get(T2, 'households/H9/recipes/r0')) && (await get(T2, 'households/H9/recipes/r2')).fields.name.stringValue === 'Dish 2, improved again', 'the community copy is untouched');
  ok(!/example\.com|uMOM|MKN-|Dish /.test(c.out), 'clear prints no address, id, identifier or recipe');
  // 20 Oct 2026 — clear-detail: what the rest is, sealed for the holder of a private key (the log is public).
  {
    const { generateKeyPairSync, privateDecrypt, createDecipheriv, constants } = await import('node:crypto');
    const kp = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    c = run(['--from', F2, '--to', T2, '--mode', 'clear-detail']);
    ok(c.code !== 0 && /needs --pubkey/.test(c.out), 'clear-detail needs a key to seal for');
    c = run(['--from', F2, '--to', T2, '--mode', 'clear-detail', '--pubkey', Buffer.from(kp.publicKey).toString('base64')]);
    const blob = Buffer.from(c.out.split('\n').filter(l => /^SEALED \d{4} /.test(l)).map(l => l.slice(12)).join(''), 'base64');
    let detail = null;
    try {
      const n = blob.readUInt16BE(0), key = privateDecrypt({ key: kp.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, blob.subarray(2, 2 + n));
      const d = createDecipheriv('aes-256-gcm', key, blob.subarray(2 + n, 14 + n)); d.setAuthTag(blob.subarray(14 + n, 30 + n));
      detail = JSON.parse((await import('node:zlib')).inflateRawSync(Buffer.concat([d.update(blob.subarray(30 + n)), d.final()])).toString('utf8'));
    } catch (e) { console.log(c.out); }
    ok(c.code === 0 && detail && detail.notThere.length === 1 && detail.notThere[0].name === 'Dish 3' && detail.notThere[0].sameNameInCommunity === false
      && detail.shared.length === 1 && detail.shared[0].path === 'shared/recipe_1', 'clear-detail lists what the community copy does not hold, sealed: ' + JSON.stringify(detail));
    ok(!/Dish |old layout|example\.com/.test(c.out) && !!(await get(F2, 'households/H9/recipes/r3')), 'clear-detail prints no name and changes nothing');
  }
  c = run(['--from', F2, '--to', T2, '--mode', 'clear-source', '--all', '--shared', '--confirm', 'clear the family app']);
  ok(c.code === 0 && !(await get(F2, 'households/H9/recipes/r3')) && !(await get(F2, 'shared/recipe_1')) && !!(await get(F2, 'i18n/he')), '--all and --shared clear the rest (never i18n/)');
}
console.log(fails ? fails + ' FAILED' : 'all move checks passed');
process.exit(fails ? 1 : 0);
