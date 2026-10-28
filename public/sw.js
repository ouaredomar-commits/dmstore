// DzMahall Official Service Worker
// Caches only compatible public static resources; strictly excludes /admin, /commande, orders, personal data, and private APIs.

const CACHE_VERSION = 'dzmahall-static-v3';
const PRECACHE_ASSETS = [
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/assets/aistudio/logo_e0e2fa2a.jpg',
];

// Install: pre-cache essential public static icons & manifest, and activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {
        // Ignore individual precache errors so installation never fails
      })
  );
});

// Activate: remove outdated caches so site updates propagate immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Allow client to trigger immediate activation on update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Helper to determine if a request must NEVER be cached or intercepted
 * (admin routes, checkout, order tracking, Firestore/Auth APIs, personal data)
 */
function isExcludedRequest(request, url) {
  // 1. Only GET requests can ever be cached
  if (request.method !== 'GET') return true;

  // 2. Ignore non-HTTP(S) schemes (chrome-extension, data, etc.)
  if (!url.protocol.startsWith('http')) return true;

  // 3. Strictly exclude Firebase, Firestore, Google Auth, and external API calls
  const host = url.hostname.toLowerCase();
  if (
    host.includes('firestore.googleapis.com') ||
    (host.includes('googleapis.com') && !host.includes('fonts.googleapis.com')) ||
    host.includes('identitytoolkit') ||
    host.includes('securetoken') ||
    host.includes('firebase') ||
    host.includes('facebook.com') ||
    host.includes('connect.facebook.net')
  ) {
    return true;
  }

  // 4. Strictly exclude private, administrative, checkout, order tracking, and API routes
  const pathname = url.pathname.toLowerCase();
  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/commande' ||
    pathname.startsWith('/commande/') ||
    pathname === '/suivi-commande' ||
    pathname.startsWith('/suivi-commande/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/@vite') ||
    pathname.startsWith('/@react-refresh') ||
    pathname.startsWith('/node_modules/') ||
    pathname.startsWith('/src/')
  ) {
    return true;
  }

  // 5. Exclude requests carrying Authorization headers
  if (request.headers.get('Authorization')) {
    return true;
  }

  return false;
}

/**
 * Helper to check if a request is a static media/font asset (icons, images, fonts)
 */
function isStaticMediaAsset(url) {
  const pathname = url.pathname.toLowerCase();
  const host = url.hostname.toLowerCase();

  if (host.includes('fonts.googleapis.com') || host.includes('fonts.gstatic.com')) {
    return true;
  }

  if (url.origin !== self.location.origin) {
    return false;
  }

  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/pwa-') ||
    pathname === '/apple-touch-icon.png' ||
    pathname === '/favicon.png' ||
    pathname === '/manifest.webmanifest' ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$/.test(pathname)
  );
}

/**
 * Helper to check if a request is a compiled JS/CSS bundle (always Network-First so code updates apply immediately)
 */
function isCodeBundleAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const pathname = url.pathname.toLowerCase();
  return /\.(js|css)$/.test(pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept excluded routes/APIs (/api/catalog, Firestore, etc.)
  if (isExcludedRequest(request, url)) {
    return;
  }

  // For public navigation requests (HTML pages) and compiled JS/CSS bundles:
  // Always use Network-First so catalog & code updates propagate immediately across all phones
  if (request.mode === 'navigate' || isCodeBundleAsset(url)) {
    const cacheKey = request.mode === 'navigate' ? '/' : request;
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const copy = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(cacheKey, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(cacheKey);
          if (cached) return cached;
          throw new Error('Network error and no offline shell available.');
        })
    );
    return;
  }

  // For static public media/font assets: Stale-While-Revalidate (fast load + background update)
  if (isStaticMediaAsset(url)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              (networkResponse.type === 'basic' || networkResponse.type === 'cors')
            ) {
              cache.put(request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});
