const CACHE_NAME = "luxeestates-v2";
const STATIC_ASSETS = [
  "/",
  "/discover",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/favicon.png",
  "/manifest.json",
];

const IMAGE_CACHE = "luxeestates-images-v2";
const FONT_CACHE = "luxeestates-fonts-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== IMAGE_CACHE && key !== FONT_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif)$/i)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408, statusText: "Offline" });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}
