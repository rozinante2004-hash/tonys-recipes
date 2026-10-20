// What a tester's sign-in e-mails look like (the audit, 20 Oct 2026) — read only.
//
// Firebase sends the address check, the password reset and the sign-in link itself, from its own templates.
// Their sender name and subject carry the project's public-facing name (%APP_NAME%); left at Google's default it
// is "project-557995593102", which reads like spam to a tester and to their mail provider. This reads the
// copies' Authentication settings and says what the mails will say.
//
// Run by .github/workflows/auth-mail-check.yml with FIREBASE_RULES_KEY (its service account has "Firebase
// Authentication Admin" on the community copy). The log is public: names, subjects and yes/no only — no
// e-mail address is printed (a reply-to address is reported as set or not).
//
//   node tools/auth-mail-check.mjs my-kitchen-notes-beta [tonys-recipes-test]

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const say = line => console.log((process.env.GITHUB_ACTIONS === 'true' ? '::notice::' : '') + line);
const warn = line => console.log((process.env.GITHUB_ACTIONS === 'true' ? '::warning::' : 'WARNING ') + line);

async function token() {
  let credentials = null;
  try { credentials = JSON.parse(String(process.env.FIREBASE_KEY || '').trim()); } catch (e) {}
  if (!credentials || credentials.type !== 'service_account') throw new Error('FIREBASE_KEY is not a service account key');
  const { GoogleAuth } = require('google-auth-library');
  const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const t = await client.getAccessToken();
  return t.token || t;
}

async function get(url, bearer) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + bearer } });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, status: r.status, body, message: body && body.error ? body.error.message : '' };
}

async function check(project, bearer) {
  say('== ' + project);
  const cfg = await get('https://identitytoolkit.googleapis.com/admin/v2/projects/' + project + '/config', bearer);
  if (!cfg.ok) { warn(project + ': the Authentication settings could not be read (' + cfg.status + ' ' + cfg.message + ')'); return; }
  const c = cfg.body || {};
  const email = (c.signIn && c.signIn.email) || {};
  say('sign-in by e-mail: ' + (email.enabled ? 'on' : 'off') + (email.enabled ? (email.passwordRequired === false ? ' (password and link)' : ' (password)') : ''));
  const domains = c.authorizedDomains || [];
  say('authorised domains: ' + domains.length + ' — ' + domains.filter(d => !/localhost/.test(d)).join(', '));

  const send = (c.notification && c.notification.sendEmail) || {};
  say('mail sent by: ' + (send.method === 'CUSTOM_SMTP' ? 'its own mail server' : 'Firebase'));
  const dns = send.dnsInfo || {};
  if (dns.customDomain || dns.useCustomDomain) say('custom sender domain: ' + (dns.customDomain || '(none)') + ' — ' + (dns.customDomainState || '?') + (dns.useCustomDomain ? ', in use' : ', not in use'));
  if (send.callbackUri) { try { say('links in the mails open: ' + new URL(send.callbackUri).host); } catch (e) {} }
  const kinds = [['verifyEmailTemplate', 'confirm the address'], ['resetPasswordTemplate', 'reset the password'],
                 ['changeEmailTemplate', 'address changed'], ['revertSecondFactorAdditionTemplate', 'second factor added']];
  let defaultName = false;
  for (const [k, what] of kinds) {
    const t = send[k];
    if (!t) continue;
    say(what + ': sender "' + (t.senderDisplayName || '(none — the public-facing name)') + '", subject "' + (t.subject || '(default)') + '"'
      + (t.customized ? ', changed from the default' : ', Google’s default') + ', reply-to ' + (t.replyTo ? 'set' : 'not set'));
    if (!t.senderDisplayName && /%APP_NAME%/.test(t.subject || '%APP_NAME%')) defaultName = true;
  }
  // The public-facing name (%APP_NAME%) is the OAuth consent screen's application name.
  const proj = await get('https://cloudresourcemanager.googleapis.com/v1/projects/' + project, bearer);
  const number = proj.ok && proj.body ? proj.body.projectNumber : '';
  if (number) {
    const brands = await get('https://iap.googleapis.com/v1/projects/' + number + '/brands', bearer);
    if (brands.ok) {
      const b = (brands.body && brands.body.brands) || [];
      const name = b.length ? b[0].applicationTitle : '';
      say('public-facing name (%APP_NAME%): ' + (name ? '"' + name + '"' : '(not set — the mails say "project-' + number + '")'));
      if (!name && defaultName) warn(project + ': the sign-in e-mails will say "project-' + number + '" — set the public-facing name');
    } else say('public-facing name: could not be read here (' + brands.status + ') — look in Firebase → Project settings → General');
  } else say('public-facing name: the project number could not be read (' + proj.status + ') — look in Firebase → Project settings → General');
}

const projects = process.argv.slice(2);
if (!projects.length) { console.error('usage: node tools/auth-mail-check.mjs <project> [<project>…]'); process.exit(2); }
const bearer = await token();
for (const p of projects) {
  try { await check(p, bearer); } catch (e) { warn(p + ': ' + (e && e.message)); }
}
