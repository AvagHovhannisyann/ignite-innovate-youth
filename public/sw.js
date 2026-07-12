/* Minimal, safe service worker: network-first for pages, cache-first for
   static assets. No precache manifest — hashes change every deploy, so we
   cache lazily and cap the runtime cache. Never touches API or auth calls. */
const CACHE = "eyh-v3";
const MAX_ENTRIES = 80;
const STATIC_RE = /\/(assets|_build)\/|\.(png|svg|woff2?|css|js)$/;
const SENSITIVE_PATHS = new Set(["/auth/callback", "/reset-password"]);
const PUBLIC_NAV_PATHS = new Set(["/", "/auth", "/opportunities", "/capabilities"]);

async function cacheResponse(cache, request, response) {
  if (!response.ok || response.headers.get("cache-control")?.includes("no-store")) return;
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)),
  );
}

self.addEventListener("install", () => {
  // Don't skipWaiting automatically — a page mid-typing (chat composer, feed
  // composer) shouldn't get yanked to a new version without warning. The
  // client prompts the user and only then posts SKIP_WAITING.
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API
  // OAuth codes and password-recovery sessions must never enter Cache Storage.
  if (SENSITIVE_PATHS.has(url.pathname)) return;

  if (STATIC_RE.test(url.pathname)) {
    // cache-first for fingerprinted static assets
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        await cacheResponse(cache, e.request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Only public shells enter Cache Storage. Authenticated pages may eventually
  // contain SSR user data and must never be replayed to another session.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(async (res) => {
          if (PUBLIC_NAV_PATHS.has(url.pathname)) {
            const cache = await caches.open(CACHE);
            await cacheResponse(cache, e.request, res.clone());
          }
          return res;
        })
        .catch(
          async () =>
            (await caches.match(e.request)) ||
            (await caches.match("/")) ||
            new Response("Կապ չկա", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        ),
    );
  }
});
