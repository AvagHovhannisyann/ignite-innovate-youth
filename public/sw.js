/* Minimal, safe service worker: network-first for pages, cache-first for
   static assets. No precache manifest — hashes change every deploy, so we
   cache lazily and cap the runtime cache. Never touches API or auth calls. */
const CACHE = "eyh-v1";
const STATIC_RE = /\/(assets|_build)\/|\.(png|svg|woff2?|css|js)$/;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API

  if (STATIC_RE.test(url.pathname)) {
    // cache-first for fingerprinted static assets
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }),
    );
    return;
  }

  // network-first for navigations, falling back to any cached copy when offline
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(e.request)) || (await caches.match("/")) ||
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })),
    );
  }
});
