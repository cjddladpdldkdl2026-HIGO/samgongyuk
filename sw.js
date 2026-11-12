/* 삼공육 service worker (upgrade 3, 2026-11-11)
 * Lets phones install the site as an app and opens games fast the second time.
 *  - Hub page (highgo.html / index.html): network first, so changes show at once
 *    when online; the saved copy is used offline.
 *  - Games and files (images, 3D models, scripts): the saved copy opens at once
 *    and a fresh copy is fetched in the background for next time.
 *  - Music and other ranged requests go straight to the network.
 * Roll back: don't just delete this file (phones keep the old worker). Replace
 * its body with a worker that clears CACHE and calls self.registration.unregister(),
 * and drop the register line in highgo.html.
 */
const CACHE = 'samgongyuk-v6';   // bump on every game update so phones drop the old copy
const HUB = /\/(highgo\.html|index\.html)?$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const save = (req, res) => {
  if (res && res.ok && res.type === 'basic') caches.open(CACHE).then(c => c.put(req, res)).catch(() => {});
};

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.headers.has('range') || /\.(mp3|ogg|wav|m4a)$/i.test(url.pathname)) return;

  if (req.mode === 'navigate' && HUB.test(url.pathname)) {
    e.respondWith(fetch(req)
      .then(res => { save(req, res.clone()); return res; })
      .catch(() => caches.match(req).then(m => m || caches.match('./highgo.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const fresh = fetch(req).then(res => { save(req, res.clone()); return res; }).catch(() => hit);
    if (hit) { e.waitUntil(fresh); return hit; }
    return fresh;
  }));
});
