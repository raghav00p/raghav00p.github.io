const CACHE_NAME = "pwa-cache-v1";
const urlsToCache = [
  "index.html",
  "manifest.json",
  "icons/icon-192.png",
  "icon/icon-512.png",
  "flashcards.html"
];

// Install SW
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch from cache
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
