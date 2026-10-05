/*
 * Service worker Sesam-Market — stratégie « faible connexion » :
 *  - ressources statiques Next (/_next/static) : cache d'abord (immuables) ;
 *  - pages : réseau d'abord, repli sur le cache puis sur la page hors-ligne ;
 *  - API : jamais mises en cache (données de commande/paiement toujours fraîches).
 */
const VERSION = "sesam-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Pages publiques uniquement (pas de pages personnelles en cache partagé).
          const publicPage = ["/", "/achats-groupes", "/categories", "/communautes", "/points-relais"].includes(url.pathname);
          if (res.ok && publicPage) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL))),
    );
  }
});

// Notifications push : charge utile { title, body, url } envoyée par le serveur (Web Push)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Sesam-Market", {
      body: data.body || "",
      icon: "/images/app-icon.png",
      badge: "/icons/icon-192.png",
      lang: "fr",
      tag: data.url || "sesam",
      renotify: true,
      data: { url: data.url || "/notifications" },
    }),
  );
});

// Toucher la notification : réutilise un onglet Sesam-Market ouvert, sinon en ouvre un.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) return win.navigate(target).then((w) => (w || win).focus());
      return self.clients.openWindow(target);
    }),
  );
});
