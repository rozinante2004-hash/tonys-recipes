// The chat notifications' key (Worker v108, app v40.02) — the server's VAPID key pair (RFC 8292), as the JWK the Worker's
// secret VAPID_JWK holds. Made from the Cloudflare token the deploy job already has (as the usage watch's key is), so
// there is nothing new to keep anywhere and every deploy sets the same key. Written to stdout, for
//   node tools/vapid-key.mjs | npx wrangler secret put VAPID_JWK …
// — never into a log. A new Cloudflare token makes a new key: the apps notice (push-key) and sign their devices up again.
import { createHmac, createECDH } from 'node:crypto';

const seed = process.env.CLOUDFLARE_API_TOKEN;
if (!seed) { console.error('CLOUDFLARE_API_TOKEN is not set'); process.exit(1); }
for (let i = 0; i < 100; i++) {
  const d = createHmac('sha256', seed).update('mkn-web-push-v1:' + i).digest();
  let pub;
  try { const e = createECDH('prime256v1'); e.setPrivateKey(d); pub = e.getPublicKey(); }
  catch (e) { continue; }   // outside the curve's range (about once in 4 billion): the next one
  process.stdout.write(JSON.stringify({ kty: 'EC', crv: 'P-256', d: d.toString('base64url'),
    x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }));
  process.exit(0);
}
process.exit(1);
