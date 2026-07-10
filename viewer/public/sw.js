/* Service worker for turn notifications (Web Push). Kept intentionally
 * minimal: no offline caching, only push display + click-through, so it can
 * never serve a stale build of the game. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "GP: Fight Club";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/?lobby=1" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/?lobby=1";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const targetPath = new URL(url, self.location.origin).pathname + new URL(url, self.location.origin).search;
      for (const client of windows) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname + clientUrl.search === targetPath && "focus" in client) {
          return client.focus();
        }
      }
      // No window is already showing this exact game. Installed/standalone PWAs are commonly
      // single-instance: if a window exists at all, `clients.openWindow(url)` often just refocuses
      // it at whatever URL it already had (e.g. the lobby) instead of actually navigating - that's
      // the "notification click lands on the lobby" bug. Ask the app to navigate itself instead
      // (push.ts's registerServiceWorkerNavigationListener), falling back to openWindow only when
      // no window exists yet to receive that message.
      if (windows.length > 0) {
        const client = windows[0];
        client.postMessage({ type: "navigate", url });
        return "focus" in client ? client.focus() : undefined;
      }
      return self.clients.openWindow(url);
    })
  );
});
