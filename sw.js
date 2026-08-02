// Tony's Recipes — Service Worker v4
// Strategy: stale-while-revalidate for the document, cache-first for assets.
// version.json is never cached, and the in-app update banner is what tells the
// user a newer version has landed — see the note on the fetch handler below.

const CACHE_NAME = 'tonys-recipes-v7';
const URLS_TO_CACHE = [
  '/tonys-recipes/',
  '/tonys-recipes/index.html',
  '/tonys-recipes/manifest.json',
  '/tonys-recipes/icons/icon-192.png',
  '/tonys-recipes/icons/icon-512.png',
];

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
  // Only handle same-origin requests for our app files
  if (!event.request.url.includes('/tonys-recipes/')) return;

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
  if (event.request.destination === 'document' ||
      event.request.url.endsWith('/tonys-recipes/') ||
      event.request.url.endsWith('/tonys-recipes/index.html')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        var network = fetch(event.request)
          .then(function(response) {
            if (response && response.ok) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, clone);
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
        return cached || network;
      })
    );
    return;
  }

  // For other assets (icons, manifest): cache first, network fallback
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
