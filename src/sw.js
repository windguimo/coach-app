// Service worker source for vite-plugin-pwa (injectManifest strategy). The
// build step injects the precache list at the self.__WB_MANIFEST
// placeholder below — this file is never the actual served sw.js, it's
// compiled into one (see vite.config.js). Deliberately precaches only the
// app shell (built JS/CSS/HTML + offline.html), never Supabase data: no
// fetch handler here ever caches a Supabase request, and Supabase calls
// always hit the network directly, online-only.
//
// The push notification / notification-click handlers are the same ones
// this file always had (previously public/sw.js, hand-registered) — moved
// here unchanged so the precaching plumbing can be layered around them.

import { precacheAndRoute, matchPrecache } from "workbox-precaching";
import { APP_NAME } from "./data/content";

precacheAndRoute(self.__WB_MANIFEST);

// Offline fallback: any navigation that can't reach the network gets the
// precached offline page instead of the browser's default error screen.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => matchPrecache("offline.html"))
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: APP_NAME, body: "C'est l'heure de votre séance." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // ignore malformed payloads, fall back to defaults
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: { url: payload.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "./";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
