// Uploads the store copy of the extension (dist-extension/my-kitchen-notes-extension.zip,
// built by tools/build-extension.mjs live) to the Chrome Web Store and submits it for
// Google's review — what Tony did by hand in the developer dashboard. Run by
// .github/workflows/deploy-extension.yml when a release that changes the extension
// reaches `main` (Tony's yes).
//
//   CWS_KEY='<service account JSON>' node tools/publish-extension.mjs
//
// Chrome Web Store API v2 with a service account (`store-publisher@recipes-f379d…`,
// linked in the dashboard's Settings). A version the store already has (published
// or in review) is skipped; Google still reviews every new one. A NEW PERMISSION
// needs its reason typed in the dashboard (Privacy practices) — the API cannot.
import { readFileSync } from 'node:fs';

const PUBLISHER = '5fd04159-8a6d-424b-b8e9-641af5297186';
const ITEM = 'dofokgilnfbpkjncmnkgfolhpjhpeglk';
const root = new URL('..', import.meta.url);
const version = JSON.parse(readFileSync(new URL('dist-extension/live/manifest.json', root), 'utf8')).version;
const zip = readFileSync(new URL('dist-extension/my-kitchen-notes-extension.zip', root));
console.log('the store copy, version ' + version + ' (' + zip.length + ' bytes)');

const key = process.env.CWS_KEY;
if (!key) throw new Error('CWS_KEY is not set');
let credentials;
try { credentials = JSON.parse(key.trim()); } catch (e) { credentials = null; }
if (!credentials || credentials.type !== 'service_account' || !credentials.private_key) {
  console.log('::error::CWS_KEY is not the key file\'s text. It must start with { and "type": "service_account". '
    + 'Open the downloaded .json in a TEXT EDITOR (not a browser), select all, copy, and paste that.');
  process.exit(1);
}
const { GoogleAuth } = await import('google-auth-library');
const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/chromewebstore'] }).getClient();
const base = 'https://chromewebstore.googleapis.com/';
const path = 'publishers/' + PUBLISHER + '/items/' + ITEM;
const say = e => (e.response && e.response.data && JSON.stringify(e.response.data).slice(0, 800)) || e.message;

// 1. What the store has: skip a version it already holds (published or in review).
let status;
try { status = (await client.request({ url: base + 'v2/' + path + ':fetchStatus', method: 'GET' })).data; }
catch (e) { console.log('::error::the store could not be asked for its status — ' + say(e)); process.exit(1); }
console.log('the store says: ' + JSON.stringify(status).slice(0, 600));
if (new RegExp('"' + version.replace(/\./g, '\\.') + '"').test(JSON.stringify(status))) {
  console.log('version ' + version + ' is already there (published or in review) — nothing to upload');
  process.exit(0);
}

// 2. Upload.
let up;
try {
  up = (await client.request({ url: base + 'upload/v2/' + path + ':upload', method: 'POST',
    headers: { 'Content-Type': 'application/zip' }, body: zip })).data;
} catch (e) { console.log('::error::the upload was refused — ' + say(e)); process.exit(1); }
console.log('uploaded: ' + JSON.stringify(up).slice(0, 600));
if (/FAIL/i.test(String(up.uploadState || up.state || ''))) { console.log('::error::the store did not take the package'); process.exit(1); }

// 3. Submit for Google's review (it publishes itself once approved).
try {
  const pub = (await client.request({ url: base + 'v2/' + path + ':publish', method: 'POST', data: {} })).data;
  console.log('submitted for review: ' + JSON.stringify(pub).slice(0, 600));
} catch (e) {
  console.log('::error::uploaded, but not submitted — ' + say(e)
    + ' (a new permission needs its reason in the dashboard: Privacy practices; then Submit for review there)');
  process.exit(1);
}
