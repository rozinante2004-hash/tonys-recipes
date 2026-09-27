// The language-publishing job (tools/publish-languages.mjs, v36.91), run
// against the Firestore emulator with the real rules: it must read the
// translations signed out (they are public), write one file per language and
// an index, do nothing when nothing changed, and publish again when the app
// asks (shared/i18n_publish) or a language changes.
//
//   npx firebase emulators:exec --only firestore --project demo-langs "node tests/publish-languages.test.mjs"
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const repo = process.env.REPO ? path.resolve(process.env.REPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = fs.readFileSync(path.join(repo, 'firestore.rules'), 'utf8')
  .replaceAll('{{READ}}', "'a@b.c'").replaceAll('{{WRITE}}', "'a@b.c'").replaceAll('{{ADMIN}}', "'a@b.c'").replaceAll('{{APP_ADMINS}}', "'a@b.c'");
const env = await initializeTestEnvironment({ projectId: 'demo-langs', firestore: { rules, host: '127.0.0.1', port: 8085 } });
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'langs-'));
const run = (...extra) => execFileSync('node', [path.join(repo, 'tools/publish-languages.mjs'), '--out', out, ...extra], {
  env: { ...process.env, LANG_SOURCE_BASE: 'http://127.0.0.1:8085/v1/projects/demo-langs/databases/(default)/documents/' }, encoding: 'utf8' });
async function seed(fn) { await env.withSecurityRulesDisabled(async ctx => { await fn(ctx.firestore()); }); }
let failures = 0;
const ok = (name, cond, detail) => { if (cond) console.log('  ok   ' + name); else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } };
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')); } catch (e) { return null; } };

await seed(async db => {
  await setDoc(doc(db, 'shared/i18n_he'), { strings: { Save: 'שמור', Delete: 'מחק', n: 5 }, count: 2, updatedAt: 100 });
  await setDoc(doc(db, 'shared/i18n_ru'), { strings: { Save: 'Сохранить' }, count: 1, updatedAt: 200 });
  await setDoc(doc(db, 'shared/i18n_index'), { langs: { he: { at: 100, count: 2 }, ru: { at: 200, count: 1 } }, probed: true });
  await setDoc(doc(db, 'shared/recipe_1'), { r: '{"name":"secret"}' });
});
let log = run();
const he = read('he.json'), idx = read('index.json');
ok('it reads the central languages signed out, and writes one file each', he && he.strings.Save === 'שמור' && read('ru.json'), log);
ok('…only the words (a non-text value is dropped)', he && he.strings.n === undefined && he.count === 2, JSON.stringify(he));
ok('…keys sorted, so a change is a one-line difference', he && Object.keys(he.strings).join() === 'Delete,Save');
ok('…with an index of what it published', idx && idx.langs.he && idx.langs.ru && idx.publishedAt > 0, JSON.stringify(idx));
ok('nothing else of the family\'s is ever read', !fs.readdirSync(out).some(f => /recipe/.test(f)));
const before = fs.readFileSync(path.join(out, 'index.json'), 'utf8');
log = run();
ok('when nothing changed it writes nothing', /nothing changed/.test(log) && fs.readFileSync(path.join(out, 'index.json'), 'utf8') === before, log);
await seed(async db => { await setDoc(doc(db, 'shared/i18n_publish'), { requestedAt: Date.now() + 1000, by: 'tony@example.com' }); });
log = run();
ok('"Publish languages now" in the app makes it publish again', /published 2 languages \(requested in the app\)/.test(log), log);
await seed(async db => {
  await setDoc(doc(db, 'shared/i18n_he'), { strings: { Save: 'שמירה', Delete: 'מחק' }, count: 2, updatedAt: 300 });
  await setDoc(doc(db, 'shared/i18n_index'), { langs: { he: { at: 300, count: 2 } }, probed: true });
});
log = run();
ok('a changed language is published by itself', (read('he.json') || {}).strings.Save === 'שמירה', log);
ok('…and one no longer in the cloud is removed', !fs.existsSync(path.join(out, 'ru.json')), fs.readdirSync(out).join());

await env.cleanup();
console.log(failures ? failures + ' publishing check(s) FAILED' : 'all publishing checks passed');
process.exit(failures ? 1 : 0);
