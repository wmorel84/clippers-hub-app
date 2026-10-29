// Service worker de Clippers Media (PWA).
// Estrategia segura para una app con datos en vivo:
// - La API (/api/) NUNCA se cachea: siempre va a la red.
// - Páginas: red primero (si no hay conexión, la copia guardada).
// - Archivos estáticos: copia inmediata + actualización en segundo plano,
//   para que los despliegues nuevos lleguen solos sin trabar a nadie.
// Al cambiar archivos importantes, sube la versión de CACHE.
const CACHE = 'clippers-media-v1';
const STATIC = [
  '/styles.css',
  '/app.js',
  '/acceso.js',
  '/brief.js',
  '/pwa.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // datos siempre frescos

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

// ---------- Notificaciones push ----------
// Al llegar un push se muestra la notificación del sistema: suena y vibra
// según el tono que el teléfono tenga configurado para notificaciones.
self.addEventListener('push', (event) => {
  let data = { title: 'Clippers Media', body: '', url: '/' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) { /* texto plano: se ignora y va el aviso genérico */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      data: { url: data.url || '/' },
      vibrate: [120, 60, 120],
    })
  );
});

// Al tocar la notificación: enfoca la app si está abierta; si no, la abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
