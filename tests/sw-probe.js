// Test harness for sw.js — loaded as a DEDICATED worker, not a service worker.
//
// The self-test suite needs to prove what sw.js's fetch handler actually DOES with
// a given URL, not what its source text looks like. It cannot use eval (the app's
// CSP has no 'unsafe-eval', deliberately) and it cannot install a second service
// worker mid-suite. So: run the real sw.js in a dedicated worker with
// self.addEventListener stubbed out, capture the handler it registers, and drive it
// with synthetic events against fake caches/fetch.
//
// Why this exists at all: sw.js used to claim EVERY html page under /tonys-recipes/
// via `event.request.destination === 'document'`. filename-test.html therefore got
// stale-while-revalidate treatment and the first copy a browser ever fetched was
// served for ever after — with no update banner to say so, because only the app has
// one. A fixed test page could not reach Tony. A source-text assertion would not
// have caught it; driving the handler does.

var captured = {};
var realAdd = self.addEventListener.bind(self);
self.addEventListener = function(type, fn) { captured[type] = fn; };

// sw.js only touches these inside event handlers, but give it somewhere to land.
self.skipWaiting = self.skipWaiting || function() {};
self.clients = self.clients || { claim: function() { return Promise.resolve(); } };

var loadError = null;
try {
  importScripts('../sw.js');
} catch (e) {
  loadError = String((e && e.message) || e);
}

self.addEventListener = realAdd;

function install(name, value) {
  try { Object.defineProperty(self, name, { value: value, configurable: true, writable: true }); }
  catch (e) { self[name] = value; }
}

// Drive one request and report what the handler did with it.
//
//   responded  — did it call respondWith? false means "not mine, browser, fetch it
//                yourself", which is the correct answer for anything but the shell.
//   revalidated — did it hit the network EVEN THOUGH the cache had a hit? That is
//                what separates stale-while-revalidate from cache-first, and the
//                app document must be revalidated or the update banner never fires.
async function claims(url, destination) {
  if (typeof captured.fetch !== 'function') return null;

  var responded = false, fetched = false;
  var cachedHit = { ok: true, clone: function() { return this; }, _fake: 'cached' };

  var realFetch = self.fetch;
  var realCaches = self.caches;
  install('fetch', function() { fetched = true; return Promise.resolve(cachedHit); });
  install('caches', {
    match: function() { return Promise.resolve(cachedHit); },
    open: function() { return Promise.resolve({ put: function() { return Promise.resolve(); },
                                                addAll: function() { return Promise.resolve(); } }); },
    keys: function() { return Promise.resolve([]); },
    delete: function() { return Promise.resolve(true); }
  });

  try {
    var event = {
      request: { url: url, destination: destination || '', mode: 'navigate' },
      respondWith: function(p) { responded = true; if (p && p.catch) p.catch(function() {}); },
      waitUntil: function() {}
    };
    try { captured.fetch(event); }
    catch (e) { return { error: 'threw: ' + ((e && e.message) || e) }; }
    // Let the handler's promise chain run; the revalidating fetch is a microtask
    // or two behind the caches.match that precedes it.
    for (var i = 0; i < 5; i++) await Promise.resolve();
    await new Promise(function(r) { setTimeout(r, 0); });
  } finally {
    install('fetch', realFetch);
    install('caches', realCaches);
  }
  return { responded: responded, revalidated: fetched };
}

realAdd('message', function(e) {
  var urls = (e.data && e.data.urls) || [];
  (async function() {
    var results = [];
    for (var i = 0; i < urls.length; i++) {
      results.push(await claims(urls[i].url, urls[i].destination));
    }
    self.postMessage({
      loadError: loadError,
      hasFetchHandler: typeof captured.fetch === 'function',
      results: results
    });
  })();
});
