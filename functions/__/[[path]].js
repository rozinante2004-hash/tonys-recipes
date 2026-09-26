/**
 * Google sign-in on the app's own address (v36.75) — Cloudflare Pages only.
 *
 * Firebase's sign-in page normally lives on <project>.firebaseapp.com. On an
 * iPhone — above all in an app added to the Home Screen — Safari keeps that
 * site's storage apart from the app's, and sign-in stops half-way with
 * "Unable to process request due to missing initial state". Firebase's own
 * remedy is to serve its sign-in pages from the app's address instead: this
 * relays https://<this site>/__/auth/… and /__/firebase/… to the Firebase
 * project, byte for byte, and the test copy's authDomain is then this site
 * (tools/environments.json).
 *
 * It relays those two folders of that one Firebase project and nothing else,
 * unchanged (as Firebase's documented relay does), and holds nothing secret.
 * Cloudflare Pages runs files in functions/ as server code; GitHub Pages (the
 * family's copy) does not, and the build leaves this folder out of the site.
 */
const FIREBASE_HOST = 'tonys-recipes-test.firebaseapp.com';   // the test copy's Firebase project

export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (!/^\/__\/(auth|firebase)\//.test(url.pathname)) return new Response('Not found', { status: 404 });
  const headers = new Headers(request.headers);
  headers.delete('host');
  return fetch('https://' + FIREBASE_HOST + url.pathname + url.search, {
    method: request.method,
    headers,
    body: (request.method === 'GET' || request.method === 'HEAD') ? undefined : request.body,
    redirect: 'manual'                                         // Google's redirects go to the browser, as they would direct
  });
}
