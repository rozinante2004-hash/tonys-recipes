// Tony's Recipes — Service Worker v5
// Strategy: stale-while-revalidate for the document, cache-first for assets.
// version.json is never cached, and the in-app update banner is what tells the
// user a newer version has landed — see the note on the fetch handler below.

const CACHE_NAME = 'tonys-recipes-v9';   // v9 (app v37.33): drops v8's copies filed under ?url=… addresses
// v5 (app v36.72) — WHERE the app lives is no longer written in: it is the
// folder this worker was registered for. The live site is served from
// /tonys-recipes/ (so nothing changes there); the test copy from the root of its
// own address. `SW_BASE` lets the self-test's probe, which loads this file from
// tests/, say which folder to act as.
const SCOPE = self.registration ? new URL(self.registration.scope) : null;
const BASE = self.SW_BASE || (SCOPE ? SCOPE.pathname : new URL('./', self.location).pathname);
const URLS_TO_CACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
];

// This worker caches THE APP SHELL AND NOTHING ELSE. Everything above is listed
// deliberately; anything else under /tonys-recipes/ goes straight to the network.
//
// It did not used to. The fetch handler claimed every same-scope request, and
// `event.request.destination === 'document'` matches EVERY html page, not just
// the app — so filename-test.html landed in the stale-while-revalidate branch and
// the first copy a browser ever fetched was served for ever after. index.html can
// survive that because it polls version.json and raises the update banner; a
// standalone page has no such tell, so it went silently stale, and a fixed copy
// simply could not reach Tony — he ran the same broken test twice and reported
// identical results while the fix sat deployed. The old catch-all also meant any
// other file fetched once under this path was pinned cache-first for ever.
function swPath(url) {
  try { return new URL(url).pathname; } catch (e) { return ''; }
}
function isAppDocument(url) {
  const p = swPath(url);
  return p === BASE || p === BASE + 'index.html';
}
function isPrecachedAsset(url) {
  return URLS_TO_CACHE.indexOf(swPath(url)) !== -1;
}

// Install: pre-cache core files
self.addEventListener('install', function(event) {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activate: delete old caches immediately
self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      // Take control of all open pages immediately
      self.clients.claim(),
      // Delete any old cache versions
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) { return name !== CACHE_NAME; })
            .map(function(name) { return caches.delete(name); })
        );
      })
    ])
  );
});

// Fetch: network first, cache fallback
self.addEventListener('fetch', function(event) {
  // Only this site's own files. Was `url.includes('/tonys-recipes/')`, which
  // also matched any OTHER site's address containing that text; and served from
  // a root, a bare path test would claim every request, Firebase's included.
  if (SCOPE && new URL(event.request.url).origin !== SCOPE.origin) return;
  if (swPath(event.request.url).indexOf(BASE) !== 0) return;

  // Never cache version.json — always fetch fresh
  if (event.request.url.includes('version.json')) {
    event.respondWith(fetch(event.request, {cache: 'no-store'}));
    return;
  }

  // For HTML (the main app): stale-while-revalidate (5.12).
  //
  // This used to be network-first, which meant every single load waited on a
  // ~210 KB download before painting anything, even when nothing had changed —
  // on a phone on mobile data that is the whole startup cost.
  //
  // Serving the cached copy first is safe here precisely because the app already
  // has an honest update path: it polls version.json (never cached, see above)
  // against the APP_VERSION baked into the HTML it is running, and shows the
  // update banner when they differ. So a user on a stale copy is TOLD, rather
  // than left to wonder — and the fresh copy is already downloaded by then, so
  // tapping Update Now is instant.
  //
  // v37.33 — ONE copy of the app, filed under its plain address. It used to be
  // filed under the WHOLE address, query included, so a link shared into the
  // app (`/?url=<the reel>`) got a copy of its own: sharing the same reel again
  // served the app version that first opened it. Tony's v37.32 run came back
  // as v37.30, from a share at 17:07 — and a fix could never reach a link
  // shared before it. And a shared link is a fresh action, not a re-open: it
  // goes to the network FIRST (the cache only when offline), so what runs the
  // import is always the newest app.
  if (isAppDocument(event.request.url)) {
    var key = swPath(event.request.url);
    var shared = /\?./.test(event.request.url);
    event.respondWith(
      caches.match(key).then(function(cached) {
        var network = fetch(event.request)
          .then(function(response) {
            if (response && response.ok) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(key, clone);
              });
            }
            return response;
          })
          .catch(function() {
            // Offline. If we had a cached copy we already returned it below;
            // otherwise there is genuinely nothing to serve.
            return cached;
          });
        // Cached copy now if we have one, and the network copy lands in the
        // cache for next time. First ever visit falls through to the network.
        // A shared link waits for the network (falling back to the cache).
        if (shared) return network.then(function(r) { return (r && r.ok) ? r : (cached || r); });
        return cached || network;
      })
    );
    return;
  }

  // Anything else under this path — filename-test.html, and any future diagnostic
  // or one-off page — is none of this worker's business. Returning without calling
  // respondWith hands the request back to the browser, which fetches it normally.
  if (!isPrecachedAsset(event.request.url)) return;

  // For the pre-cached assets (icons, manifest): cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      });
    })
  );
});

// Handle SKIP_WAITING message from app to activate new SW immediately
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
