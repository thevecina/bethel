/* Agente de Dinero: permite abrir la página sin internet.
   Siempre intenta traer la versión nueva; si no hay conexión, usa la guardada. */
const CACHE = 'agente-de-dinero-v4';
const ARCHIVOS = ['./', './index.html', './estilos.css', './app.js', './manifest.webmanifest', './icono.svg', './icono-192.png', './icono-512.png', './icono-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((llaves) => Promise.all(llaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !esFuente) return;
  e.respondWith(
    fetch(pedido)
      .then((respuesta) => {
        if (respuesta.ok || respuesta.type === 'opaque') {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(pedido, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido, { ignoreSearch: true })
        .then((r) => r || (pedido.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
