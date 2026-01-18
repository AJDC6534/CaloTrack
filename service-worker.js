// CaloTrack PWA Service Worker - GitHub Pages Fix
const CACHE_NAME = 'calotrack-v1.1';

// IMPORTANT: Update this to match your GitHub Pages path
const BASE_PATH = '/';  // Change if your repo name is different

const urlsToCache = [
  `/`,
  `/index.html`,
  `/manifest.json`,
  `/icon-192.png`,
  `/icon-512.png`
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          console.log('📦 Serving from cache:', event.request.url);
          return response;
        }
        
        // If not in cache, fetch from network
        return fetch(event.request).then((fetchResponse) => {
          // Don't cache if not successful
          if (!fetchResponse || fetchResponse.status !== 200) {
            return fetchResponse;
          }
          
          // Cache the new response for future use
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
      .catch(() => {
        console.log('📡 Service Worker: Offline mode - no cache available');
        // Return offline page if you have one
        // return caches.match(`${BASE_PATH}/offline.html`);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('✨ Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
