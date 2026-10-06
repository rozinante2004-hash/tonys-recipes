// Firestore rules for HOUSEHOLDS (WP-D), tested against the real emulator
// (v36.84). Every "may" and "may not" below is a line of the HOUSEHOLDS part of
// firestore.rules (merged there, alongside the family's `shared` rules, in v36.86).
//
//   npx firebase emulators:exec --only firestore --project demo-households \
//     "node tests/firestore-households-rules.test.mjs"
//
// People: alice founds household h1; bob, dave and erin join with her link
// (read only) and she makes bob an editor and erin an admin; michal is the family member whose place is kept
// by e-mail (how the family arrives at migration); carol is a stranger.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp,
         collection, collectionGroup, query, where, getDocs } from 'firebase/firestore';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  .replaceAll('{{READ}}', "'nobody@example.com'").replaceAll('{{WRITE}}', "'nobody@example.com'")
  .replaceAll('{{ADMIN}}', "'nobody@example.com'").replaceAll('{{APP_ADMINS}}', "'alice@example.com'");
const env = await initializeTestEnvironment({ projectId: 'demo-households', firestore: { rules } });
const person = (uid, extra) => env.authenticatedContext(uid, Object.assign({ email: uid + '@example.com', email_verified: true }, extra || {})).firestore();
const alice = person('alice'), bob = person('bob'), carol = person('carol'), dave = person('dave'),
      erin = person('erin'), michal = person('michal'), frank = person('frank'),
      unverified = person('michal2', { email: 'michal@example.com', email_verified: false }),
      nobody = env.unauthenticatedContext().firestore();
let failures = 0;
async function check(name, p, shouldPass) {
  try { await (shouldPass ? assertSucceeds(p) : assertFails(p)); console.log('  ok   ' + name); }
  catch (e) { failures++; console.log('  FAIL ' + name + ' — ' + String(e && e.message || e).split('\n')[0]); }
}
const later = Timestamp.fromMillis(Date.now() + 7 * 864e5), earlier = Timestamp.fromMillis(Date.now() - 1000);
function found(db, hid, uid) {
  const b = writeBatch(db);
  b.set(doc(db, 'households/' + hid), { name: 'Home', ownerUid: uid, createdAt: 1 });
  b.set(doc(db, 'households/' + hid + '/members/' + uid), { uid, role: 'owner', email: uid + '@example.com', joinedAt: 1 });
  return b.commit();
}
const join = (db, hid, uid, role, invite) =>
  setDoc(doc(db, 'households/' + hid + '/members/' + uid),
         Object.assign({ uid, role, email: uid + '@example.com', joinedAt: 2 }, invite ? { invite } : {}));

console.log('Founding a household');
await check('alice founds h1, as its owner',                 found(alice, 'h1', 'alice'), true);
await check('a household cannot be founded without its owner',
            setDoc(doc(carol, 'households/hx'), { name: 'X', ownerUid: 'carol', createdAt: 1 }), false);
await check('nobody founds a household in someone else\'s name', found(carol, 'hy', 'alice'), false);
await check('bob cannot make himself owner of h1',            join(bob, 'h1', 'bob', 'owner'), false);
await check('bob cannot read h1 before he is in it',          getDoc(doc(bob, 'households/h1')), false);

console.log('Invitations');
// v37.13 — Tony: a link can be passed on, so it only ever lets people READ;
// writing is given to a person, afterwards (or when they ask).
await check('the owner invites a viewer',    setDoc(doc(alice, 'invites/INV-VW'), { hid: 'h1', role: 'viewer', createdBy: 'alice', expiresAt: later }), true);
await check('…but not an editor (v37.13)',   setDoc(doc(alice, 'invites/INV-ED'), { hid: 'h1', role: 'editor', createdBy: 'alice', expiresAt: later }), false);
await check('…nor an admin (v37.13)',        setDoc(doc(alice, 'invites/INV-AD'), { hid: 'h1', role: 'admin',  createdBy: 'alice', expiresAt: later }), false);
await check('nobody is invited as owner',    setDoc(doc(alice, 'invites/INV-OW'), { hid: 'h1', role: 'owner',  createdBy: 'alice', expiresAt: later }), false);
await check('a stranger cannot invite to h1', setDoc(doc(carol, 'invites/INV-C'), { hid: 'h1', role: 'viewer', createdBy: 'carol', expiresAt: later }), false);
await check('an old invitation, for the test', env.withSecurityRulesDisabled(ctx =>
            setDoc(doc(ctx.firestore(), 'invites/INV-OLD'), { hid: 'h1', role: 'viewer', createdBy: 'alice', expiresAt: earlier })), true);
await check('a link made before v37.13, for writing', env.withSecurityRulesDisabled(ctx =>
            setDoc(doc(ctx.firestore(), 'invites/INV-LEG'), { hid: 'h1', role: 'editor', createdBy: 'alice', expiresAt: later })), true);
await check('bob cannot join as an editor with the viewer link', join(bob, 'h1', 'bob', 'editor', 'INV-VW'), false);
await check('…nor with a link made for writing before v37.13',   join(bob, 'h1', 'bob', 'editor', 'INV-LEG'), false);
await check('bob joins with the link, as a viewer',             join(bob, 'h1', 'bob', 'viewer', 'INV-VW'), true);
await check('dave joins with the link, as a viewer',            join(dave, 'h1', 'dave', 'viewer', 'INV-VW'), true);
await check('erin joins with the link, as a viewer',            join(erin, 'h1', 'erin', 'viewer', 'INV-VW'), true);
await check('the owner gives bob writing',                      updateDoc(doc(alice, 'households/h1/members/bob'), { role: 'editor' }), true);
await check('the owner gives erin full access',                 updateDoc(doc(alice, 'households/h1/members/erin'), { role: 'admin' }), true);
await check('an expired invitation does not work',             join(carol, 'h1', 'carol', 'viewer', 'INV-OLD'), false);
await check('nobody joins without an invitation',              join(carol, 'h1', 'carol', 'viewer'), false);
await check('nobody can make SOMEONE ELSE a member',           join(bob, 'h1', 'carol', 'viewer', 'INV-VW'), false);
await check('invitations cannot be listed',                    getDocs(collection(carol, 'invites')), false);
await check('an admin invites a viewer',   setDoc(doc(erin, 'invites/INV-E2'), { hid: 'h1', role: 'viewer', createdBy: 'erin', expiresAt: later }), true);
await check('an admin cannot invite an editor', setDoc(doc(erin, 'invites/INV-E3'), { hid: 'h1', role: 'editor', createdBy: 'erin', expiresAt: later }), false);
await check('an editor cannot invite',     setDoc(doc(bob, 'invites/INV-B'), { hid: 'h1', role: 'viewer', createdBy: 'bob', expiresAt: later }), false);

console.log('Recipes');
await check('an editor adds a recipe',        setDoc(doc(bob, 'households/h1/recipes/1'), { r: '{}', updatedAt: 1 }), true);
await check('an editor changes a recipe',     setDoc(doc(bob, 'households/h1/recipes/1'), { r: '{}', updatedAt: 2 }), true);
await check('an editor cannot DELETE a recipe', deleteDoc(doc(bob, 'households/h1/recipes/1')), false);
await check('a viewer reads it',              getDoc(doc(dave, 'households/h1/recipes/1')), true);
await check('a viewer cannot change it',      setDoc(doc(dave, 'households/h1/recipes/1'), { r: '{}' }), false);
await check('a stranger cannot read it',      getDoc(doc(carol, 'households/h1/recipes/1')), false);
await check('signed out cannot read it',      getDoc(doc(nobody, 'households/h1/recipes/1')), false);
await check('an editor writes a photo and the meta', Promise.all([
            setDoc(doc(bob, 'households/h1/photos/1'), { p: 'x' }), setDoc(doc(bob, 'households/h1/state/meta'), { ids: [1] })]), true);
await check('an admin deletes a recipe',      deleteDoc(doc(erin, 'households/h1/recipes/1')), true);

console.log('Households are separate');
await check('carol founds h2',                               found(carol, 'h2', 'carol'), true);
await check('carol adds a recipe to h2',                     setDoc(doc(carol, 'households/h2/recipes/9'), { r: '{}' }), true);
await check('bob (a member of h1) cannot read h2',           getDoc(doc(bob, 'households/h2/recipes/9')), false);
await check('carol cannot write into h1',                    setDoc(doc(carol, 'households/h1/recipes/5'), { r: '{}' }), false);

console.log('Asking to write (v37.13)');
const ask = (db, uid, extra) => setDoc(doc(db, 'households/h1/requests/' + uid), Object.assign({ uid, at: 1 }, extra || {}));
await check('a request carries nothing else (no role to ask for)', ask(dave, 'dave', { role: 'admin' }), false);
await check('a viewer asks to add and change recipes',   ask(dave, 'dave'), true);
await check('…only for himself',                         ask(dave, 'carol'), false);
await check('an editor has nothing to ask',              ask(bob, 'bob'), false);
await check('a stranger cannot ask',                     ask(carol, 'carol'), false);
await check('the viewer sees his own request',           getDoc(doc(dave, 'households/h1/requests/dave')), true);
await check('an editor cannot see it',                   getDoc(doc(bob, 'households/h1/requests/dave')), false);
await check('an admin lists the requests',               getDocs(collection(erin, 'households/h1/requests')), true);
await check('an editor cannot list them',                getDocs(collection(bob, 'households/h1/requests')), false);
await check('nobody changes a request',                  updateDoc(doc(dave, 'households/h1/requests/dave'), { at: 2 }), false);
await check('an admin answers it (removes it)',          deleteDoc(doc(erin, 'households/h1/requests/dave')), true);

console.log('Managing members');
await check('an admin makes a viewer an editor',  updateDoc(doc(erin, 'households/h1/members/dave'), { role: 'editor' }), true);
await check('an admin cannot make anyone admin',  updateDoc(doc(erin, 'households/h1/members/dave'), { role: 'admin' }), false);
await check('an admin cannot touch the owner',    updateDoc(doc(erin, 'households/h1/members/alice'), { role: 'viewer' }), false);
await check('an admin cannot promote herself',    updateDoc(doc(erin, 'households/h1/members/erin'), { role: 'owner' }), false);
await check('an editor cannot change roles',      updateDoc(doc(bob, 'households/h1/members/dave'), { role: 'viewer' }), false);
await check('nobody changes the e-mail on file',  updateDoc(doc(alice, 'households/h1/members/bob'), { email: 'x@example.com' }), false);
await check('the owner makes bob an admin',       updateDoc(doc(alice, 'households/h1/members/bob'), { role: 'admin' }), true);
await check('an admin cannot remove another admin', deleteDoc(doc(erin, 'households/h1/members/bob')), false);
await check('an admin removes an editor',         deleteDoc(doc(erin, 'households/h1/members/dave')), true);
await check('a member may leave',                 deleteDoc(doc(bob, 'households/h1/members/bob')), true);
await check('the owner may not simply leave',     deleteDoc(doc(alice, 'households/h1/members/alice')), false);
await check('…nor step down without a handover',  updateDoc(doc(alice, 'households/h1/members/alice'), { role: 'admin' }), false);
await check('the owner renames the household',    updateDoc(doc(alice, 'households/h1'), { name: 'The Schvekhers' }), true);
await check('an admin renames it too',            updateDoc(doc(erin, 'households/h1'), { name: 'Home' }), true);
await check('an admin cannot take it over',       updateDoc(doc(erin, 'households/h1'), { ownerUid: 'erin' }), false);

console.log('A place kept by e-mail (how the family arrives)');
const kept = (db, hid, email, role) => setDoc(doc(db, 'pending/' + hid + ':' + email), { hid, email, role });
await check('the owner keeps a place for michal as editor', kept(alice, 'h1', 'michal@example.com', 'editor'), true);
await check('…under the right name only',             setDoc(doc(alice, 'pending/h1:someone'), { hid: 'h1', email: 'x@example.com', role: 'editor' }), false);
await check('an admin cannot keep a place as admin',  kept(erin, 'h1', 'x@example.com', 'admin'), false);
await check('an editor cannot keep places',           kept(bob, 'h1', 'y@example.com', 'viewer'), false);
await check('nobody keeps places in another household', kept(alice, 'h2', 'z@example.com', 'viewer'), false);
await check('michal FINDS her kept place',            getDocs(query(collection(michal, 'pending'), where('email', '==', 'michal@example.com'))), true);
await check('frank cannot look at michal\'s',          getDocs(query(collection(frank, 'pending'), where('email', '==', 'michal@example.com'))), false);
await check('michal cannot claim more than was kept', join(michal, 'h1', 'michal', 'admin'), false);
await check('an UNVERIFIED address cannot claim it',  setDoc(doc(unverified, 'households/h1/members/michal2'), { uid: 'michal2', role: 'editor', email: 'michal@example.com', joinedAt: 3 }), false);
await check('frank cannot claim michal\'s place',     setDoc(doc(frank, 'households/h1/members/frank'), { uid: 'frank', role: 'editor', email: 'frank@example.com', joinedAt: 3 }), false);
await check('michal claims her place as editor',      join(michal, 'h1', 'michal', 'editor'), true);
await check('…and tidies up the kept place',          deleteDoc(doc(michal, 'pending/h1:michal@example.com')), true);

console.log('Which households am I in?');
await check('michal finds her own memberships', getDocs(query(collectionGroup(michal, 'members'), where('uid', '==', 'michal'))), true);
await check('…but cannot list everyone\'s',     getDocs(collectionGroup(michal, 'members')), false);

console.log('Handing the household over');
{
  const b = writeBatch(alice);
  b.update(doc(alice, 'households/h1/members/erin'), { role: 'owner' });
  b.update(doc(alice, 'households/h1'), { ownerUid: 'erin' });
  await check('alice hands h1 to erin (one batch)', b.commit(), true);
}
await check('alice may now step down to admin',  updateDoc(doc(alice, 'households/h1/members/alice'), { role: 'admin' }), true);
await check('only the new owner deletes it',     deleteDoc(doc(alice, 'households/h1')), false);

console.log('Deleting a household (v36.99)');
await check('frank founds h9',                       found(frank, 'h9', 'frank'), true);
await check('…and invites someone',                 setDoc(doc(frank, 'invites/INV-H9'), { hid: 'h9', role: 'viewer', createdBy: 'frank', expiresAt: later }), true);
await check('…and keeps a place for michal',         setDoc(doc(frank, 'pending/h9:michal@example.com'), { hid: 'h9', email: 'michal@example.com', role: 'viewer' }), true);
await check('…and adds a recipe',                    setDoc(doc(frank, 'households/h9/recipes/1'), { r: '{}' }), true);
await check('the owner still may not simply leave',  deleteDoc(doc(frank, 'households/h9/members/frank')), false);
await check('the owner deletes the content',         deleteDoc(doc(frank, 'households/h9/recipes/1')), true);
await check('…and the kept place',                   deleteDoc(doc(frank, 'pending/h9:michal@example.com')), true);
await check('someone else cannot delete h9',         deleteDoc(doc(carol, 'households/h9')), false);
{
  const b = writeBatch(frank);
  b.delete(doc(frank, 'households/h9'));
  b.delete(doc(frank, 'households/h9/members/frank'));
  await check('the household and the owner\'s membership go together (one batch)', b.commit(), true);
}
await check('a leftover invitation opens nothing',   join(carol, 'h9', 'carol', 'editor', 'INV-H9'), false);
await check('a kept place for a deleted household opens nothing', env.withSecurityRulesDisabled(ctx =>
            setDoc(doc(ctx.firestore(), 'pending/h9:michal@example.com'), { hid: 'h9', email: 'michal@example.com', role: 'viewer' }))
            .then(() => join(michal, 'h9', 'michal', 'viewer')).then(() => { throw new Error('joined'); }, e => { if (String(e).indexOf('joined') !== -1) throw e; return 'refused'; }), true);

console.log('A word for an unconfirmed address (v37.11)');
await check('an admin leaves a notice for an address',       setDoc(doc(alice, 'pendingNotice/newbie@example.com'), { email: 'newbie@example.com', hid: 'h1', at: 1 }), true);
await check('a stranger cannot leave one for h1',             setDoc(doc(carol, 'pendingNotice/x@example.com'), { email: 'x@example.com', hid: 'h1', at: 1 }), false);
await check('…nor a notice under another address\'s name',     setDoc(doc(alice, 'pendingNotice/a@example.com'), { email: 'b@example.com', hid: 'h1', at: 1 }), false);
const newbieUnconfirmed = env.authenticatedContext('newbie', { email: 'newbie@example.com', email_verified: false }).firestore();
await check('the address reads its notice even unconfirmed', getDoc(doc(newbieUnconfirmed, 'pendingNotice/newbie@example.com')), true);
await check('nobody else reads it',                           getDoc(doc(carol, 'pendingNotice/newbie@example.com')), false);
await check('notices cannot be listed',                       getDocs(collection(newbieUnconfirmed, 'pendingNotice')), false);
await check('…but the kept place itself stays closed to it',  getDocs(query(collection(newbieUnconfirmed, 'pending'), where('email', '==', 'newbie@example.com'))), false);
await check('the address removes its own notice',             deleteDoc(doc(newbieUnconfirmed, 'pendingNotice/newbie@example.com')), true);

console.log('Household identifiers (v37.49)');
function foundWithCode(db, hid, uid, code, codeHid) {
  const b = writeBatch(db);
  b.set(doc(db, 'households/' + hid), { name: 'Coded', ownerUid: uid, createdAt: 1, code });
  b.set(doc(db, 'households/' + hid + '/members/' + uid), { uid, role: 'owner', email: uid + '@example.com', joinedAt: 1 });
  b.set(doc(db, 'codes/' + code), { hid: codeHid || hid, at: 1 });
  return b.commit();
}
await check('a household is founded with its identifier, reserved in the same batch', foundWithCode(frank, 'hc1', 'frank', 'MKN-ABCD-2345'), true);
await check('…no other household can take the same identifier',   foundWithCode(carol, 'hc2', 'carol', 'MKN-ABCD-2345'), false);
await check('…nor one reserved for another household',            foundWithCode(carol, 'hc2', 'carol', 'MKN-WXYZ-6789', 'hc1'), false);
await check('…nor one in the wrong form (O, 0, I, 1, L)',          foundWithCode(carol, 'hc2', 'carol', 'MKN-OOOO-1111'), false);
await check('…nor an identifier that is not reserved', (() => { const b = writeBatch(carol);
  b.set(doc(carol, 'households/hc2'), { name: 'X', ownerUid: 'carol', createdAt: 1, code: 'MKN-QRST-3456' });
  b.set(doc(carol, 'households/hc2/members/carol'), { uid: 'carol', role: 'owner', email: 'carol@example.com', joinedAt: 1 }); return b.commit(); })(), false);
await check('anyone signed in looks an identifier up', getDoc(doc(carol, 'codes/MKN-ABCD-2345')), true);
await check('…but not signed out',                      getDoc(doc(nobody, 'codes/MKN-ABCD-2345')), false);
await check('an identifier never changes', (() => { const b = writeBatch(frank);
  b.update(doc(frank, 'households/hc1'), { code: 'MKN-HJKM-7892' }); b.set(doc(frank, 'codes/MKN-HJKM-7892'), { hid: 'hc1', at: 2 }); return b.commit(); })(), false);
await check('…and its register entry is not removed while the household exists', deleteDoc(doc(carol, 'codes/MKN-ABCD-2345')), false);
await check('a household made before identifiers', found(michal, 'hc4', 'michal'), true);
await check('…gets one from its owner, reserved in the same batch', (() => { const b = writeBatch(michal);
  b.update(doc(michal, 'households/hc4'), { code: 'MKN-PQRS-4567' }); b.set(doc(michal, 'codes/MKN-PQRS-4567'), { hid: 'hc4', at: 2 }); return b.commit(); })(), true);
await check('a stranger cannot give a household an identifier', (() => { const b = writeBatch(carol);
  b.update(doc(carol, 'households/hc1'), { name: 'Mine' }); return b.commit(); })(), false);
await check('the owner stops link requests through the app', updateDoc(doc(frank, 'households/hc1'), { appRequests: false }), true);
await check('…with a yes or no only',                       updateDoc(doc(frank, 'households/hc1'), { appRequests: 'maybe' }), false);
await check('…and the identifier survives a rename',        updateDoc(doc(frank, 'households/hc1'), { name: 'Frank\'s Kitchen' }), true);

console.log('Linked households (v37.53)');
// gina owns L1 (hank reads in it), ivy owns L2 (jo reads in it), kim owns L3,
// which takes no link requests through the app.
const gina = person('gina'), hank = person('hank'), ivy = person('ivy'), jo = person('jo'), kim = person('kim'),
      joUnconfirmed = person('jo2', { email: 'jo@example.com', email_verified: false });
await check('three households, with identifiers', Promise.all([
  foundWithCode(gina, 'L1', 'gina', 'MKN-GGGG-2222'), foundWithCode(ivy, 'L2', 'ivy', 'MKN-HHHH-3333'),
  foundWithCode(kim, 'L3', 'kim', 'MKN-KKKK-4444')]), true);
await check('…people reading in two of them', (async () => {
  await setDoc(doc(gina, 'invites/INV-L1'), { hid: 'L1', role: 'viewer', createdBy: 'gina', expiresAt: later });
  await setDoc(doc(ivy, 'invites/INV-L2'), { hid: 'L2', role: 'viewer', createdBy: 'ivy', expiresAt: later });
  await join(hank, 'L1', 'hank', 'viewer', 'INV-L1'); await join(jo, 'L2', 'jo', 'viewer', 'INV-L2');
  await updateDoc(doc(kim, 'households/L3'), { appRequests: false });
  await setDoc(doc(ivy, 'households/L2/recipes/1'), { name: 'Ivy\'s soup' });
  await setDoc(doc(ivy, 'households/L2/photos/1'), { photo: 'data:' });
  await setDoc(doc(gina, 'households/L1/recipes/7'), { name: 'Gina\'s cake' });
})(), true);
const byCode = (from, to, by, extra) => Object.assign({ from, fromName: 'Coded', fromCode: { L1: 'MKN-GGGG-2222', L2: 'MKN-HHHH-3333', L3: 'MKN-KKKK-4444' }[from],
  to, via: 'code', by, at: 1 }, extra || {});
await check('a reader cannot ask for the household',        setDoc(doc(hank, 'linkRequests/L1_L2'), byCode('L1', 'L2', 'hank')), false);
await check('the owner cannot ask under another name',      setDoc(doc(gina, 'linkRequests/L1_L2'), byCode('L1', 'L2', 'gina', { fromName: 'Tony\'s Kitchen' })), false);
await check('…nor with another household\'s identifier',    setDoc(doc(gina, 'linkRequests/L1_L2'), byCode('L1', 'L2', 'gina', { fromCode: 'MKN-HHHH-3333' })), false);
await check('…nor on someone else\'s behalf',                setDoc(doc(gina, 'linkRequests/L1_L2'), byCode('L1', 'L2', 'ivy')), false);
await check('…nor her own household',                        setDoc(doc(gina, 'linkRequests/L1_L1'), byCode('L1', 'L1', 'gina')), false);
await check('…nor one that takes no requests through the app', setDoc(doc(gina, 'linkRequests/L1_L3'), byCode('L1', 'L3', 'gina')), false);
await check('…nor carry anything else',                      setDoc(doc(gina, 'linkRequests/L1_L2'), byCode('L1', 'L2', 'gina', { role: 'admin' })), false);
await check('…nor a note over 500 characters (v37.81)',      setDoc(doc(gina, 'linkRequests/L1_L2'), byCode('L1', 'L2', 'gina', { note: 'x'.repeat(501) })), false);
await check('…nor the first message without the request',    setDoc(doc(gina, 'linkTalk/L1_L2/messages/m0'), { from: 'L1', name: 'Coded', text: 'Hi!', at: 1, by: 'gina' }), false);
await check('the owner asks by identifier, with a note — and the note as the first message, in one batch', (async () => {
  const b = writeBatch(gina);
  b.set(doc(gina, 'linkRequests/L1_L2'), byCode('L1', 'L2', 'gina', { note: 'Hi! We met at the market.' }));
  b.set(doc(gina, 'linkTalk/L1_L2/messages/m0'), { from: 'L1', name: 'Coded', text: 'Hi! We met at the market.', at: 1, by: 'gina' });
  await b.commit(); })(), true);
await check('…and sees it waiting',                          getDocs(query(collection(gina, 'linkRequests'), where('from', '==', 'L1'))), true);
await check('the household asked: its owner sees it',        getDocs(query(collection(ivy, 'linkRequests'), where('to', '==', 'L2'))), true);
// v37.80 — everyone in a household sees its requests page (Tony); only the owner and admins answer.
await check('…and its readers too (the requests page)',      getDocs(query(collection(jo, 'linkRequests'), where('to', '==', 'L2'))), true);
await check('…and the asking household\'s readers theirs',  getDocs(query(collection(hank, 'linkRequests'), where('from', '==', 'L1'))), true);
await check('…but a reader cannot refuse it',                updateDoc(doc(jo, 'linkRequests/L1_L2'), { declined: true }), false);
await check('…nor does a stranger',                          getDoc(doc(carol, 'linkRequests/L1_L2')), false);
await check('the sender cannot change it',                   updateDoc(doc(gina, 'linkRequests/L1_L2'), { to: 'L3' }), false);
await check('the owner asked marks it refused',              updateDoc(doc(ivy, 'linkRequests/L1_L2'), { declined: true }), true);
await check('…and nothing else',                             updateDoc(doc(ivy, 'linkRequests/L1_L2'), { fromName: 'X' }), false);
// v37.80 — what became of each request, and who is blocked: households/<hid>/requestLog/<other>.
const logOf = (status, by, extra) => Object.assign({ hid: 'L1', name: 'Coded', code: 'MKN-GGGG-2222', status, at: 1, decidedAt: 2, by }, extra || {});
await check('the owner asked keeps what became of it',       setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('rejected', 'ivy')), true);
await check('…blocks the household',                         setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('blocked', 'ivy')), true);
await check('…accepted and revoked are kept too',            Promise.all([setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('revoked', 'ivy')),
                                                                          setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('accepted', 'ivy'))]), true);
await check('…in her own name only',                         setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('blocked', 'jo')), false);
await check('…with a known answer only',                     setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('maybe', 'ivy')), false);
await check('…about another household, under its own id',    setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('blocked', 'ivy', { hid: 'L3' })), false);
await check('…with the request\'s note (v37.81)',            setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('blocked', 'ivy', { note: 'Hi from Dana' })), true);
await check('…and nothing else in it',                       setDoc(doc(ivy, 'households/L2/requestLog/L1'), logOf('blocked', 'ivy', { phone: 'x' })), false);
await check('a reader of the household reads it',            getDocs(collection(jo, 'households/L2/requestLog')), true);
await check('…but cannot write it',                          setDoc(doc(jo, 'households/L2/requestLog/L1'), logOf('accepted', 'jo')), false);
await check('…nor can a stranger read it',                   getDocs(collection(carol, 'households/L2/requestLog')), false);
await check('…nor the household that asked',                 getDocs(collection(gina, 'households/L2/requestLog')), false);
await check('the owner clears an entry',                     deleteDoc(doc(ivy, 'households/L2/requestLog/L1')), true);
const accept = (db, extra) => { const b = writeBatch(db);
  b.set(doc(db, 'households/L2/links/L1'), { hid: 'L1', name: 'Coded', code: 'MKN-GGGG-2222', at: 1 });
  b.set(doc(db, 'households/L1/links/L2'), { hid: 'L2', name: 'Coded', code: 'MKN-HHHH-3333', at: 1 });
  if (!extra || !extra.keep) b.delete(doc(db, 'linkRequests/L1_L2'));
  return b.commit(); };
await check('a reader of the household asked cannot accept', accept(jo), false);
await check('accepting removes the request in the same batch', accept(ivy, { keep: true }), false);
await check('no link without a request',                     setDoc(doc(ivy, 'households/L2/links/L3'), { hid: 'L3', name: 'X', code: '', at: 1 }), false);
await check('hank, before the link, cannot read L2',         getDoc(doc(hank, 'households/L2/recipes/1')), false);
await check('the owner asked accepts: both halves, one batch', accept(ivy), true);
await check('both households see the link',                  Promise.all([getDocs(collection(hank, 'households/L1/links')), getDocs(collection(jo, 'households/L2/links'))]), true);
await check('a stranger does not',                           getDocs(collection(carol, 'households/L1/links')), false);
await check('nobody changes a link',                         updateDoc(doc(gina, 'households/L1/links/L2'), { name: 'X' }), false);
// v37.81 — two households talking about a link: linkTalk/<a>_<b>/messages (a < b).
const msg = (from, by, extra) => Object.assign({ from, name: 'Coded', text: 'Hello from the next street!', at: 5, by }, extra || {});
await check('the owner writes to the linked household',      setDoc(doc(gina, 'linkTalk/L1_L2/messages/m1'), msg('L1', 'gina')), true);
await check('…and so does anyone in it (Tony)',               setDoc(doc(hank, 'linkTalk/L1_L2/messages/m2'), msg('L1', 'hank')), true);
await check('…and the other household answers',              setDoc(doc(jo, 'linkTalk/L1_L2/messages/m3'), msg('L2', 'jo')), true);
await check('both households read it',                       Promise.all([getDocs(collection(hank, 'linkTalk/L1_L2/messages')), getDocs(collection(jo, 'linkTalk/L1_L2/messages'))]), true);
await check('…a stranger does not',                          getDocs(collection(carol, 'linkTalk/L1_L2/messages')), false);
await check('nobody writes for a household they are not in', setDoc(doc(gina, 'linkTalk/L1_L2/messages/m4'), msg('L2', 'gina')), false);
await check('…or under another household\'s name',           setDoc(doc(gina, 'linkTalk/L1_L2/messages/m4'), msg('L1', 'gina', { name: 'Tony\'s Kitchen' })), false);
await check('…or as someone else',                           setDoc(doc(gina, 'linkTalk/L1_L2/messages/m4'), msg('L1', 'hank')), false);
await check('…or more than 500 characters',                  setDoc(doc(gina, 'linkTalk/L1_L2/messages/m4'), msg('L1', 'gina', { text: 'x'.repeat(501) })), false);
await check('…or anything else in it',                       setDoc(doc(gina, 'linkTalk/L1_L2/messages/m4'), msg('L1', 'gina', { phone: '050' })), false);
await check('…or with the pair the wrong way round',         setDoc(doc(gina, 'linkTalk/L2_L1/messages/m4'), msg('L1', 'gina')), false);
await check('…or to a household with no request or link',    setDoc(doc(gina, 'linkTalk/L1_L3/messages/m4'), msg('L1', 'gina')), false);
await check('a message is never changed',                    updateDoc(doc(gina, 'linkTalk/L1_L2/messages/m1'), { text: 'edited' }), false);
await check('…nor removed',                                  deleteDoc(doc(gina, 'linkTalk/L1_L2/messages/m1')), false);
await check('hank says where he looks from: his household',  setDoc(doc(hank, 'homes/hank'), { hid: 'L1', at: 1 }), true);
await check('…never one he is not in',                       setDoc(doc(hank, 'homes/hank'), { hid: 'L2', at: 1 }), false);
await check('…nor for someone else',                         setDoc(doc(hank, 'homes/jo'), { hid: 'L1', at: 1 }), false);
await check('hank reads L2\'s recipes',                      Promise.all([getDoc(doc(hank, 'households/L2/recipes/1')), getDocs(collection(hank, 'households/L2/recipes'))]), true);
await check('…and its photos',                               getDocs(collection(hank, 'households/L2/photos')), true);
await check('…but writes nothing there',                     setDoc(doc(hank, 'households/L2/recipes/1'), { name: 'Mine now' }), false);
await check('…nor can gina, who owns L1',       setDoc(doc(gina, 'households/L2/recipes/2'), { name: 'X' }), false);
await check('…nor reads its members, settings or chats',     getDocs(collection(hank, 'households/L2/members')), false);
await check('…nor the household itself',                     getDoc(doc(hank, 'households/L2')), false);
await check('…nor its state',                                getDoc(doc(hank, 'households/L2/state/meta')), false);
await check('jo, in L2, reads L1\'s recipes too', (async () => { await setDoc(doc(jo, 'homes/jo'), { hid: 'L2', at: 1 });
  await getDoc(doc(jo, 'households/L1/recipes/7')); })(), true);
await check('a household not linked reads nothing', (async () => { await setDoc(doc(kim, 'homes/kim'), { hid: 'L3', at: 1 });
  await getDoc(doc(kim, 'households/L2/recipes/1')); })(), false);
await check('a stranger naming L1 as home is refused',       setDoc(doc(carol, 'homes/carol'), { hid: 'L1', at: 1 }), false);

const byMail = (from, email, by, extra) => Object.assign({ from, fromName: 'Coded', fromCode: { L1: 'MKN-GGGG-2222', L2: 'MKN-HHHH-3333', L3: 'MKN-KKKK-4444' }[from],
  email, via: 'email', by, at: 1 }, extra || {});
await check('an owner asks by e-mail, even a household that takes none through the app',
            setDoc(doc(ivy, 'linkRequests/L2:kim@example.com'), byMail('L2', 'kim@example.com', 'ivy')), true);
await check('…the address written small only',              setDoc(doc(kim, 'linkRequests/L3:Jo@example.com'), byMail('L3', 'Jo@example.com', 'kim')), false);
await check('…under its own name only',                      setDoc(doc(kim, 'linkRequests/L3:x@example.com'), byMail('L3', 'jo@example.com', 'kim')), false);
await check('kim asks jo (who only reads, in L2) by e-mail', setDoc(doc(kim, 'linkRequests/L3:jo@example.com'), byMail('L3', 'jo@example.com', 'kim')), true);
await check('jo finds it',                                   getDocs(query(collection(jo, 'linkRequests'), where('email', '==', 'jo@example.com'))), true);
await check('…not with the address unconfirmed',            getDocs(query(collection(joUnconfirmed, 'linkRequests'), where('email', '==', 'jo@example.com'))), false);
await check('…nor does anyone else',                         getDocs(query(collection(carol, 'linkRequests'), where('email', '==', 'jo@example.com'))), false);
const passOn = (db, to, opts) => { const b = writeBatch(db);
  b.set(doc(db, 'linkRequests/L3_' + to), { from: 'L3', fromName: 'Coded', fromCode: 'MKN-KKKK-4444', to, via: 'email', by: (opts && opts.by) || 'kim', at: 1 });
  if (!(opts && opts.keep)) b.delete(doc(db, 'linkRequests/L3:jo@example.com'));
  return b.commit(); };
await check('jo cannot pass it to a household she is not in', passOn(jo, 'L1'), false);
await check('…nor keep the e-mail one as well',              passOn(jo, 'L2', { keep: true }), false);
await check('…nor say someone else sent it',                 passOn(jo, 'L2', { by: 'ivy' }), false);
await check('jo passes it on to her household',              passOn(jo, 'L2'), true);
await check('…where its owner sees it',                      getDoc(doc(ivy, 'linkRequests/L3_L2')), true);
await check('a stranger cannot withdraw it',                 deleteDoc(doc(carol, 'linkRequests/L3_L2')), false);
await check('the sender withdraws it',                       deleteDoc(doc(kim, 'linkRequests/L3_L2')), true);
await check('the person asked by e-mail may let it go',      deleteDoc(doc(kim, 'linkRequests/L2:kim@example.com')), true);

const unlink = (db) => { const b = writeBatch(db);
  b.delete(doc(db, 'households/L1/links/L2')); b.delete(doc(db, 'households/L2/links/L1')); return b.commit(); };
await check('a reader cannot remove the link',               unlink(hank), false);
await check('either owner removes it, both halves at once',  unlink(gina), true);
await check('…and hank reads L2 no more',                    getDoc(doc(hank, 'households/L2/recipes/1')), false);

console.log('The management app, last seen and referrals (v37.58)');
// alice is the app's owner here ({{APP_ADMINS}}).
await check('the app\'s owner lists every household',          getDocs(collection(alice, 'households')), true);
await check('…nobody else may',                                 getDocs(collection(carol, 'households')), false);
await check('…every member of every household',                 getDocs(collectionGroup(alice, 'members')), true);
await check('…every link',                                      getDocs(collectionGroup(alice, 'links')), true);
await check('…but nobody else every link',                      getDocs(collectionGroup(carol, 'links')), false);
await check('…every link request',                              getDocs(collection(alice, 'linkRequests')), true);
await check('…but nobody else every request',                   getDocs(collection(carol, 'linkRequests')), false);
await check('…and NOT their recipes',                           getDocs(collection(alice, 'households/L2/recipes')), false);
await check('…nor their photos',                                getDocs(collection(alice, 'households/L2/photos')), false);
await check('an unconfirmed owner\'s address is not enough',
            getDocs(collection(person('alice2', { email: 'alice@example.com', email_verified: false }), 'households')), false);
await check('a member notes when they last opened the app',     updateDoc(doc(hank, 'households/L1/members/hank'), { lastSeen: Date.now() }), true);
await check('…a number only',                                   updateDoc(doc(hank, 'households/L1/members/hank'), { lastSeen: 'today' }), false);
await check('…and nothing else with it',                        updateDoc(doc(hank, 'households/L1/members/hank'), { lastSeen: 5, role: 'admin' }), false);
await check('…only on their own membership',                    updateDoc(doc(hank, 'households/L1/members/gina'), { lastSeen: 5 }), false);
await check('a household founded through a share link says whose', (() => { const b = writeBatch(frank);
  b.set(doc(frank, 'households/R1'), { name: 'Referred', ownerUid: 'frank', createdAt: 1, referredBy: 'MKN-GGGG-2222' });
  b.set(doc(frank, 'households/R1/members/frank'), { uid: 'frank', role: 'owner', email: 'frank@example.com', joinedAt: 1 }); return b.commit(); })(), true);
await check('…and that never changes',                          updateDoc(doc(frank, 'households/R1'), { referredBy: 'MKN-KKKK-4444' }), false);
await check('…while renaming still works',                      updateDoc(doc(frank, 'households/R1'), { name: 'Frank\'s' }), true);

console.log('The owner deletes a household from the management app (v37.61)');
await check('the app\'s owner cannot read a household\'s recipes before marking it', getDocs(collection(alice, 'households/L2/recipes')), false);
await check('nobody else may mark a household for deletion', updateDoc(doc(carol, 'households/L2'), { deleting: true }), false);
await check('…nor its own reader',                            updateDoc(doc(jo, 'households/L2'), { deleting: true }), false);
await check('the mark carries nothing else',                  updateDoc(doc(alice, 'households/L2'), { deleting: true, name: 'X' }), false);
await check('the app\'s owner marks it',                      updateDoc(doc(alice, 'households/L2'), { deleting: true }), true);
await check('…and now reads what is in it, to remove it',    Promise.all([getDocs(collection(alice, 'households/L2/recipes')), getDocs(collection(alice, 'households/L2/photos')),
  getDocs(collection(alice, 'households/L2/chats')), getDocs(collection(alice, 'households/L2/state')), getDocs(collection(alice, 'households/L2/requests'))]), true);
await check('…but still not another household\'s',           getDocs(collection(alice, 'households/L1/recipes')), false);
await check('a stranger may not delete a marked household',  deleteDoc(doc(carol, 'households/L2')), false);
await check('…nor its content',                               deleteDoc(doc(carol, 'households/L2/recipes/1')), false);
await check('the owner of the app removes its content',      Promise.all([deleteDoc(doc(alice, 'households/L2/recipes/1')), deleteDoc(doc(alice, 'households/L2/photos/1'))]), true);
await check('…its members',                                   deleteDoc(doc(alice, 'households/L2/members/jo')), true);
await check('…and the household, its owner\'s place and its identifier, together', (() => { const b = writeBatch(alice);
  b.delete(doc(alice, 'households/L2/members/ivy')); b.delete(doc(alice, 'households/L2')); b.delete(doc(alice, 'codes/MKN-HHHH-3333')); return b.commit(); })(), true);
await check('a household nobody marked cannot be deleted by him', deleteDoc(doc(alice, 'households/L3')), false);

console.log('Notes from testers (v37.64)');
const note = (uid, extra) => Object.assign({ uid, email: uid + '@example.com', text: 'The import was slow', shot: '', log: 'log',
  version: 'v37.64', env: 'beta', device: 'x', lang: 'en', where: '/', at: 1, status: 'new' }, extra || {});
await check('anyone signed in leaves a note, as themselves',   setDoc(doc(carol, 'feedback/n1'), note('carol')), true);
await check('…not in someone else\'s name',                    setDoc(doc(carol, 'feedback/n2'), note('bob')), false);
await check('…not signed out',                                 setDoc(doc(nobody, 'feedback/n3'), note('carol')), false);
await check('…not empty',                                      setDoc(doc(carol, 'feedback/n4'), note('carol', { text: '' })), false);
await check('…not already marked done',                        setDoc(doc(carol, 'feedback/n5'), note('carol', { status: 'done' })), false);
await check('…and nothing else with it',                       setDoc(doc(carol, 'feedback/n6'), note('carol', { role: 'admin' })), false);
await check('the sender cannot read notes back',               getDoc(doc(carol, 'feedback/n1')), false);
await check('…nor can anyone else',                            getDocs(collection(bob, 'feedback')), false);
await check('the app\'s owner reads them',                     getDocs(collection(alice, 'feedback')), true);
await check('…marks one seen',                                 updateDoc(doc(alice, 'feedback/n1'), { status: 'seen' }), true);
await check('…but does not rewrite it',                        updateDoc(doc(alice, 'feedback/n1'), { text: 'changed' }), false);
await check('…and removes it',                                 deleteDoc(doc(alice, 'feedback/n1')), true);

console.log('Translations and personal settings');
await check('anyone signed in reads a translation', getDoc(doc(carol, 'i18n/he')), true);
await check('signed out can too (public, v36.88)',   getDoc(doc(nobody, 'i18n/he')), true);
await check('…but cannot list them',                getDocs(collection(nobody, 'i18n')), false);
await check('…nor write one',                       setDoc(doc(nobody, 'i18n/he'), { strings: {} }), false);
await check('an app admin writes one',              setDoc(doc(alice, 'i18n/he'), { strings: { a: 'b' } }), true);
await check('a household owner who is not an app admin cannot', setDoc(doc(carol, 'i18n/he'), { strings: {} }), false);
await check('my own settings',                      setDoc(doc(bob, 'users/bob/prefs/ui'), { theme: 'dark' }), true);
await check('not someone else\'s',                  getDoc(doc(carol, 'users/bob/prefs/ui')), false);

await env.cleanup();
console.log(failures ? failures + ' household rules check(s) FAILED' : 'all household rules checks passed');
process.exit(failures ? 1 : 0);
