/**
 * v38.23 — switches on sign-in with an authenticator app (TOTP) for one Firebase
 * project, so the app's owner can set one up (⚙️ → 👑 → 🔐 Two-step sign-in).
 * Run by .github/workflows/owner-two-step.yml, by hand.
 *
 *     FIREBASE_KEY='<service account JSON>' node tools/enable-totp.mjs --project my-kitchen-notes-beta
 *
 * Identity Platform's project config: PATCH …/admin/v2/projects/<p>/config?updateMask=mfa
 * with mfa.providerConfigs = [{ state: ENABLED, totpProviderConfig: { adjacentIntervals: 5 } }]
 * (codes one 30-second step either side still count: a phone's clock drifts).
 * Needs: the project upgraded to "Firebase Authentication with Identity Platform"
 * (a console click, on the Blaze plan), and "Firebase Authentication Admin" for
 * the service account. Prints only what it did.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const project = arg('project', '');
if (!/^[a-z0-9-]{4,40}$/.test(project)) { console.error('--project <id>'); process.exit(2); }
const base = (process.env.IDENTITY_ADMIN_BASE || 'https://identitytoolkit.googleapis.com/') + 'admin/v2/projects/' + project + '/config';
try {
  let credentials = null; try { credentials = JSON.parse(String(process.env.FIREBASE_KEY || '').trim()); } catch (e) {}
  if (!credentials || credentials.type !== 'service_account') throw new Error('FIREBASE_KEY is not a service account key');
  const { GoogleAuth } = require('google-auth-library');
  const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const t = await client.getAccessToken();
  // (no X-Goog-User-Project: naming the project as the one billed asks for "Service Usage Consumer" there —
  // refused on 12 Oct 2026; the move job's own Identity Toolkit calls, without it, were answered)
  const H = { Authorization: 'Bearer ' + (t.token || t), 'Content-Type': 'application/json' };
  const r = await fetch(base + '?updateMask=mfa', { method: 'PATCH', headers: H,
    body: JSON.stringify({ mfa: { providerConfigs: [{ state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 5 } }] } }) });
  const txt = await r.text();
  if (!r.ok) {
    let why = ''; try { why = JSON.parse(txt).error.message; } catch (e) { why = txt.slice(0, 200); }
    if (r.status === 403) throw new Error('refused (403): ' + why + ' — the service account needs "Firebase Authentication Admin" on ' + project);
    if (/IDENTITY_PLATFORM|not enabled|upgrade/i.test(why)) throw new Error(why + ' — upgrade ' + project + ' to Firebase Authentication with Identity Platform first');
    throw new Error('HTTP ' + r.status + ': ' + why);
  }
  const back = JSON.parse(txt || '{}');
  const on = ((back.mfa || {}).providerConfigs || []).some(c => c.state === 'ENABLED' && c.totpProviderConfig);
  console.log(on ? '::notice::authenticator sign-in (TOTP) is ON for ' + project : '::warning::the answer does not show TOTP as on for ' + project);
  if (!on) process.exit(1);
} catch (e) {
  console.log('::error::' + ((e && e.message) || e));
  process.exit(1);
}
