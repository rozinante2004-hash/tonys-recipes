// Firestore rules for HOUSEHOLDS (WP-D), tested against the real emulator
// (v36.84). Every "may" and "may not" below is a line of the HOUSEHOLDS part of
// firestore.rules (merged there, alongside the family's `shared` rules, in v36.86).
//
//   npx firebase emulators:exec --only firestore --project demo-households \
//     "node tests/firestore-households-rules.test.mjs"
//
// People: alice founds household h1; bob is invited as an editor, dave as a
// viewer, erin as an admin; michal is the family member whose place is kept
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
await check('the owner invites an editor',   setDoc(doc(alice, 'invites/INV-ED'), { hid: 'h1', role: 'editor', createdBy: 'alice', expiresAt: later }), true);
await check('the owner invites a viewer',    setDoc(doc(alice, 'invites/INV-VW'), { hid: 'h1', role: 'viewer', createdBy: 'alice', expiresAt: later }), true);
await check('the owner invites an admin',    setDoc(doc(alice, 'invites/INV-AD'), { hid: 'h1', role: 'admin',  createdBy: 'alice', expiresAt: later }), true);
await check('nobody is invited as owner',    setDoc(doc(alice, 'invites/INV-OW'), { hid: 'h1', role: 'owner',  createdBy: 'alice', expiresAt: later }), false);
await check('a stranger cannot invite to h1', setDoc(doc(carol, 'invites/INV-C'), { hid: 'h1', role: 'editor', createdBy: 'carol', expiresAt: later }), false);
await check('an old invitation, for the test', env.withSecurityRulesDisabled(ctx =>
            setDoc(doc(ctx.firestore(), 'invites/INV-OLD'), { hid: 'h1', role: 'editor', createdBy: 'alice', expiresAt: earlier })), true);
await check('bob joins with the editor invitation',            join(bob, 'h1', 'bob', 'editor', 'INV-ED'), true);
await check('dave cannot use the editor invitation to be admin', join(dave, 'h1', 'dave', 'admin', 'INV-ED'), false);
await check('dave joins with the viewer invitation',           join(dave, 'h1', 'dave', 'viewer', 'INV-VW'), true);
await check('erin joins with the admin invitation',            join(erin, 'h1', 'erin', 'admin', 'INV-AD'), true);
await check('an expired invitation does not work',             join(carol, 'h1', 'carol', 'editor', 'INV-OLD'), false);
await check('nobody joins without an invitation',              join(carol, 'h1', 'carol', 'viewer'), false);
await check('nobody can make SOMEONE ELSE a member',           join(bob, 'h1', 'carol', 'viewer', 'INV-VW'), false);
await check('invitations cannot be listed',                    getDocs(collection(carol, 'invites')), false);
await check('an admin invites an editor',  setDoc(doc(erin, 'invites/INV-E2'), { hid: 'h1', role: 'editor', createdBy: 'erin', expiresAt: later }), true);
await check('an admin cannot invite an admin', setDoc(doc(erin, 'invites/INV-E3'), { hid: 'h1', role: 'admin', createdBy: 'erin', expiresAt: later }), false);
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
await check('…and invites an editor',                setDoc(doc(frank, 'invites/INV-H9'), { hid: 'h9', role: 'editor', createdBy: 'frank', expiresAt: later }), true);
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
