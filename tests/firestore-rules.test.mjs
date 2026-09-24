// Firestore rules, tested against the real emulator (v36.59).
//
// Until this file the rules were pasted into the Firebase console by hand and
// checked by nothing: the `allow write` that silently granted deletion to every
// write-role member survived in the app's fallback copy for a year. Run with
//
//   npx firebase emulators:exec --only firestore --project demo-rules \
//     "node tests/firestore-rules.test.mjs"
//
// (`demo-` projects never touch a real Firebase project.) The placeholders are
// filled with four stand-in people, one per role, exactly as the app fills
// them with the family's member list.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const OWNER = 'owner@example.com', ADMIN = 'admin@example.com',
      WRITER = 'writer@example.com', READER = 'reader@example.com', STRANGER = 'stranger@example.com';
const q = list => list.map(e => "'" + e + "'").join(', ');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  .replaceAll('{{READ}}',  q([OWNER, ADMIN, WRITER, READER]))
  .replaceAll('{{WRITE}}', q([OWNER, ADMIN, WRITER]))
  .replaceAll('{{ADMIN}}', q([OWNER, ADMIN]));

const env = await initializeTestEnvironment({ projectId: 'demo-rules', firestore: { rules } });
const as = email => env.authenticatedContext(email.split('@')[0], { email }).firestore();
let failures = 0;
async function check(name, p, shouldPass) {
  try { await (shouldPass ? assertSucceeds(p) : assertFails(p)); console.log('  ok   ' + name); }
  catch (e) { failures++; console.log('  FAIL ' + name + ' — ' + (e && e.message || e).toString().split('\n')[0]); }
}

await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'shared/recipe_1'), { r: '{}', updatedAt: 1 });
  await setDoc(doc(db, 'shared/access'), { members: [] });
  await setDoc(doc(db, 'shared/i18n_he'), { strings: {} });
});

console.log('Reading');
await check('a reader can read a recipe',            getDoc(doc(as(READER), 'shared/recipe_1')), true);
await check('a stranger cannot read a recipe',       getDoc(doc(as(STRANGER), 'shared/recipe_1')), false);
await check('signed out cannot read',                getDoc(doc(env.unauthenticatedContext().firestore(), 'shared/recipe_1')), false);

console.log('Recipes');
await check('a writer can update a recipe',         setDoc(doc(as(WRITER), 'shared/recipe_1'), { r: '{}', updatedAt: 2 }), true);
await check('a writer can create a recipe',          setDoc(doc(as(WRITER), 'shared/recipe_2'), { r: '{}', updatedAt: 1 }), true);
await check('a reader cannot write a recipe',        setDoc(doc(as(READER), 'shared/recipe_1'), { r: '{}' }), false);
await check('a writer cannot DELETE a recipe',       deleteDoc(doc(as(WRITER), 'shared/recipe_2')), false);
await check('an admin can delete a recipe',          deleteDoc(doc(as(ADMIN), 'shared/recipe_2')), true);

console.log('Admin-only documents (v36.59)');
await check('a writer cannot change the member list',  setDoc(doc(as(WRITER), 'shared/access'), { members: ['x'] }), false);
await check('a writer cannot change a translation',    setDoc(doc(as(WRITER), 'shared/i18n_he'), { strings: { a: 'b' } }), false);
await check('a writer cannot CREATE a translation',    setDoc(doc(as(WRITER), 'shared/i18n_xx'), { strings: {} }), false);
await check('an admin can change the member list',     setDoc(doc(as(ADMIN), 'shared/access'), { members: ['x'] }), true);
await check('the owner can change a translation',      setDoc(doc(as(OWNER), 'shared/i18n_he'), { strings: { a: 'b' } }), true);
await check('a writer can still read a translation',   getDoc(doc(as(WRITER), 'shared/i18n_he')), true);
await check('a document merely CONTAINING "i18n" is not admin-only',
                                                       setDoc(doc(as(WRITER), 'shared/recipe_i18n_x'), { r: '{}' }), true);

console.log('The family backup record (v36.61)');
await check('a writer can record a backup',           setDoc(doc(as(WRITER), 'shared/backups'), { at: 1, device: 'a computer', auto: true }), true);
await check('a reader cannot record a backup',        setDoc(doc(as(READER), 'shared/backups'), { at: 2, device: 'an iPhone', auto: false }), false);
await check('a reader can read the backup record',    getDoc(doc(as(READER), 'shared/backups')), true);

console.log('Legacy per-user documents');
await check('you can write your own user document',  setDoc(doc(as(WRITER), 'users/writer/x/y'), { a: 1 }), true);
await check("you cannot write someone else's",       setDoc(doc(as(WRITER), 'users/reader/x/y'), { a: 1 }), false);

await env.cleanup();
if (failures) { console.log('\n' + failures + ' rules check(s) failed'); process.exit(1); }
console.log('\nall rules checks passed');
