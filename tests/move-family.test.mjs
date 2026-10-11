
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
console.log(fails ? fails + ' FAILED' : 'all move checks passed');
process.exit(fails ? 1 : 0);
