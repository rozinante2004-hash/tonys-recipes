const CACHE = 'tonys-recipes-v2';
const PRECACHE = ['/', '/index.html', '/manifest.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname==='api.anthropic.com'||url.hostname.includes('googleapis')||url.hostname.includes('gstatic')||url.hostname.includes('firestore')) {
    e.respondWith(fetch(e.request).catch(()=>new Response('{"error":"offline"}',{headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{
    if(e.request.method==='GET'&&res.ok){const r=res.clone();caches.open(CACHE).then(c=>c.put(e.request,r));}
    return res;
  }).catch(()=>e.request.mode==='navigate'?caches.match('/index.html'):new Response('Offline',{status:503}))));
});
