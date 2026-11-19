// Service worker mínimo: deixa o app instalável (PWA) sem guardar cache,
// para nunca servir uma versão antiga depois de um deploy.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
