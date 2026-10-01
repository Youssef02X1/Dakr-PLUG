// SERVICE WORKER - Dakar PLUG
// Cache offline + gestion notifications push

const CACHE_NAME    = 'dakar-plug-v10';
const STATIC_ASSETS = [
  '/index.html',
  '/activite.html',
  '/reservation.html',
  '/espace-utilisateur.html',
  '/auth.html',
  '/cgv.html',
  '/404.html',
  '/styles.css',
  '/app.js',
  '/supabase-config.js',
  '/paiement.js',
  '/emails.js',
  '/seo.js',
  '/notifications.js',
  '/manifest.json',
];

// Installation : mise en cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activation : nettoyage ancien cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch : cache-first pour assets, network pour API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les appels Supabase, Resend, Wave, Orange
  const apiDomains = ['supabase.co', 'api.resend.com', 'api.wave.com', 'api.orange.com'];
  if (apiDomains.some(d => url.hostname.includes(d))) return;

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Page offline de fallback
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/404.html');
        }
      });
    })
  );
});

// Réception d'une notification push
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const options = {
    body:    data.body    || 'Nouvelle notification',
    icon:    data.icon    || '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/' },
    actions: [
      { action: 'voir',    title: 'Voir' },
      { action: 'fermer', title: 'Fermer' },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dakar PLUG', options)
  );
});

// Clic sur une notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'fermer') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});