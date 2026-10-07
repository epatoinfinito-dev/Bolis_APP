/* BoliOS Service Worker
   Estrategia: network-first para código (actualizaciones automáticas cuando hay red),
   cache-first para librerías vendor e iconos. Offline total garantizado. */
const CACHE = "bolios-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/app.js",
  "./js/scene3d.js",
  "./vendor/three.min.js",
  "./vendor/chart.umd.min.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  url.pathname.includes("/vendor/") || url.pathname.includes("/icons/") ||
  url.hostname.includes("gstatic") || url.hostname.includes("googleapis");

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Librerías, iconos y fuentes: cache-first (son inmutables)
  if (isStatic(url)) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((cached) =>
        cached || fetch(e.request).then((res) => {
          if (res.ok) { const c = res.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, c)); }
          return res;
        })
      )
    );
    return;
  }

  // Código y documentos: network-first con respaldo en caché (offline)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((cached) =>
          cached || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())
        )
      )
  );
});
