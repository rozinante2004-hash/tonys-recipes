// Publishes firestore.rules to the three Firebase projects — the family's, the
// test copy's and the beta's — as Family Access → Show rules → paste did by
// hand. Run by .github/workflows/deploy-rules.yml when a release that changes
// the rules reaches `main` (Tony's yes).
//
//   node tools/publish-rules.mjs --dry-run      fill in and check, publish nothing
//   FIREBASE_RULES_KEY='<service account JSON>' node tools/publish-rules.mjs
//
// The placeholders are filled exactly as the app fills them in the household
// layout (all three copies): the old `shared` lists and the app's admins are
// the owner alone (updateAccessRules in index.html). Uses Firebase's rules API
// directly, so the service account needs only "Firebase Rules Admin".
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const envs = JSON.parse(readFileSync(new URL('tools/environments.json', root), 'utf8'));
const owner = (/ownerEmail:\s*'([^']+)'/.exec(html) || [])[1];
const version = (/var APP_VERSION = '([^']+)'/.exec(html) || [])[1];
const live = (/projectId:\s*'([^']+)'/.exec(html) || [])[1];
const projects = [live, envs.test && envs.test.firebase && envs.test.firebase.projectId, envs.beta && envs.beta.firebase && envs.beta.firebase.projectId].filter(Boolean);
if (!owner || !version || projects.length !== 3) throw new Error('could not read the owner, the version or the three projects: ' + JSON.stringify({ owner, version, projects }));

const q = '"' + owner + '"';
const stamp = "// These rules come from Tony's Recipes " + version + ', published by GitHub on '
  + new Date().toISOString().slice(0, 10) + ". (The line above is Firebase's rules-language edition — always '2'.)";
let rules = readFileSync(new URL('firestore.rules', root), 'utf8')
  .replace(/\{\{READ\}\}/g, q).replace(/\{\{WRITE\}\}/g, q).replace(/\{\{ADMIN\}\}/g, q).replace(/\{\{APP_ADMINS\}\}/g, q);
rules = /^rules_version = '2';/m.test(rules) ? rules.replace(/^(rules_version = '2';)/m, '$1\n' + stamp) : stamp + '\n' + rules;
if (/\{\{[A-Z_]+\}\}/.test(rules)) throw new Error('a placeholder is left: ' + rules.match(/\{\{[A-Z_]+\}\}/)[0]);

console.log('rules from ' + version + ' for ' + projects.join(', ') + ' (' + rules.length + ' characters, owner ' + owner + ')');
if (process.argv.includes('--dry-run')) process.exit(0);

const key = process.env.FIREBASE_RULES_KEY;
if (!key) throw new Error('FIREBASE_RULES_KEY is not set');
const { GoogleAuth } = await import('google-auth-library');
const auth = new GoogleAuth({ credentials: JSON.parse(key), scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();
const api = 'https://firebaserules.googleapis.com/v1/';

let failed = 0;
for (const p of projects) {
  try {
    // 1. The rules as a new ruleset — Firebase checks them here and refuses a mistake.
    const rs = await client.request({ url: api + 'projects/' + p + '/rulesets', method: 'POST',
      data: { source: { files: [{ name: 'firestore.rules', content: rules }] } } });
    const rulesetName = rs.data.name;
    // 2. Made the database's live rules.
    const rel = 'projects/' + p + '/releases/cloud.firestore';
    await client.request({ url: api + rel, method: 'PATCH', data: { release: { name: rel, rulesetName } } });
    // 3. Read back.
    const now = await client.request({ url: api + rel, method: 'GET' });
    if (now.data.rulesetName !== rulesetName) throw new Error('the live rules are ' + now.data.rulesetName + ', not ' + rulesetName);
    console.log('  ✓ ' + p + ' → ' + rulesetName);
  } catch (e) {
    failed++;
    const msg = (e.response && e.response.data && e.response.data.error && e.response.data.error.message) || e.message;
    console.log('  ✗ ' + p + ' — ' + msg);
  }
}
if (failed) { console.log(failed + ' of ' + projects.length + ' not published'); process.exit(1); }
console.log('published to all ' + projects.length);
