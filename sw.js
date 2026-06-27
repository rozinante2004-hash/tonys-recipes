// Tony's Recipes — Service Worker v3
// Strategy: Network first, fall back to cache
// This ensures updates appear immediately on all devices

const CACHE_NAME = 'tonys-recipes-v6';
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

  // For HTML (the main app): always try network first
  if (event.request.destination === 'document' ||
      event.request.url.endsWith('/tonys-recipes/') ||
      event.request.url.endsWith('/tonys-recipes/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // Got a fresh response — update the cache
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function() {
          // Network failed — serve from cache (offline support)
          return caches.match(event.request);
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
