// Offline support: the app shell and plant data are cached on install; images are
// cached as they are viewed, so a visitor who browses at the Library keeps them in the field.
const VERSION = "pf-v4";
const SHELL = ["./", "index.html", "css/plantfinder.css", "js/app.js", "js/viz.js", "config.js", "data/species.json", "data/plantings.json", "data/zonemap.svg", "art/blot.webp", "manifest.webmanifest", "icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Data and app code: network first so updates show up, cache as fallback
  if (url.origin === location.origin && !url.pathname.includes("/img/")) {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // Images and fonts: cache first
  if (url.pathname.includes("/img/") || url.hostname.includes("fonts.g")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return r; })));
  }
});
