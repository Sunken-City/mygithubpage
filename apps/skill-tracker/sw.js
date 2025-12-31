const CACHE = "skill-tracker-v10";
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

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isAvatarList = url.pathname.endsWith("/profile/avatars.json");
  const isAvatarImg  = url.pathname.includes("/profile/avatars/");
  if (isAvatarList || isAvatarImg) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        cache.put(req, fresh.clone()).catch(()=>{});
        return fresh;
      } catch {
        return (await cache.match(req)) || (await caches.match("./"));
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      cache.put(req, fresh.clone()).catch(()=>{});
      return fresh;
    } catch {
      return caches.match("./");
    }
  })());
});