/* DroneOps — Service Worker v1.0 */
const CACHE_NAME = 'droneops-v1';

// Fichiers à mettre en cache pour le mode hors-ligne
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Installation : mise en cache des ressources de base
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch : stratégie "Network first, fallback cache"
// Pour les APIs externes (météo, METAR, etc.) : réseau uniquement
// Pour les ressources locales : cache en fallback si hors-ligne
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIs externes → réseau uniquement, pas de cache
  const externalAPIs = [
    'api.open-meteo.com',
    'aviationweather.gov',
    'nominatim.openstreetmap.org',
    'api.core.openaip.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ];

  if (externalAPIs.some(api => url.hostname.includes(api))) {
    // Pour les APIs, on tente le réseau. En cas d'échec, on laisse l'app gérer l'erreur.
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({error: 'Hors-ligne'}), {
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }

  // Ressources locales → Network first, puis cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mise en cache de la réponse fraîche
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback sur le cache si hors-ligne
        return caches.match(event.request).then(cached => {
          return cached || caches.match('/index.html');
        });
      })
  );
});
