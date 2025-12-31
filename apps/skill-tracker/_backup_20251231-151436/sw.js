const CACHE = "skill-tracker-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/pako.min.js",
  "./profile/avatars.json",
  "./profile/avatars/default.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

// Stale-while-revalidate for most assets.
// Network-first for avatar list + avatar images so changes show up immediately.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  const isAvatarList = url.pathname.endsWith("/profile/avatars.json");
  const isAvatarImg = url.pathname.includes("/profile/avatars/");

  if (isAvatarList || isAvatarImg) {
    // network-first
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        return caches.match("./");
      }
    })());
    return;
  }

  // stale-while-revalidate
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((fresh) => {
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    }).catch(() => null);

    return cached || (await fetchPromise) || (await caches.match("./"));
  })());
});
