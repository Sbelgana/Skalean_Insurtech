/**
 * sw-template.js -- Workbox-based service worker template
 * Reference: task-1.4.9 Sprint 4 Phase 1
 *
 * This file is a plain JS template to be bundled by the consuming Next.js app.
 * It is excluded from the TypeScript compilation.
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Take control immediately
clientsClaim();

// Precache assets injected by build tooling
// eslint-disable-next-line no-undef
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Skip waiting on message
// eslint-disable-next-line no-undef
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // eslint-disable-next-line no-undef
    self.skipWaiting();
  }
});

// API routes: NetworkFirst with 24h expiration
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'insurtech-api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  }),
);

// Static assets: CacheFirst
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new CacheFirst({
    cacheName: 'insurtech-static-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// Images: StaleWhileRevalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'insurtech-image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);

// Push notification handler
// eslint-disable-next-line no-undef
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Skalean InsurTech', body: event.data.text() };
  }
  const title = payload.title || 'Skalean InsurTech';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    data: payload.data || {},
  };
  // eslint-disable-next-line no-undef
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
// eslint-disable-next-line no-undef
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';
  // eslint-disable-next-line no-undef
  event.waitUntil(
    // eslint-disable-next-line no-undef
    clients.openWindow(url),
  );
});
