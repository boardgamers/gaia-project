/* Service worker for the installable app, offline hot-seat play, and Web Push.
 * The production build replaces the config block below with every emitted app asset and a
 * content-derived cache version. Development keeps a small valid fallback list. */

/* __GAIA_PRECACHE_CONFIG_START__ */
const PRECACHE_CONFIG = {
  version: "development",
  urls: [
    "/",
    "/index.html",
    "/manifest.json",
    "/favicon.png",
    "/apple-touch-icon.png",
    "/icon-192.png",
    "/icon-512.png",
    "/icon-maskable-192.png",
    "/icon-maskable-512.png",
    "/notification-badge.png",
    "/?lobby=1",
    "/?offline=1",
  ],
};
/* __GAIA_PRECACHE_CONFIG_END__ */

const APP_CACHE_PREFIX = "gaia-fight-club-app-";
const APP_CACHE = `${APP_CACHE_PREFIX}${PRECACHE_CONFIG.version}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE_CONFIG.urls))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(APP_CACHE_PREFIX) && name !== APP_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put("/index.html", response.clone());
    }
    return response;
  } catch (_error) {
    const url = new URL(request.url);
    // Installed PWAs start at the lobby. When that navigation itself proves the network is down,
    // route to the local game even if navigator.onLine incorrectly still says `true`.
    if (url.pathname === "/" && (url.search === "" || url.searchParams.has("lobby"))) {
      return Response.redirect(`${url.origin}/?offline=1`, 302);
    }
    return (await cache.match("/index.html")) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstResource(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(new URL(request.url).pathname, response.clone());
    }
    return response;
  } catch (_error) {
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // The changelog is the app's update probe, so prefer the network while retaining an offline copy.
  if (url.pathname === "/release.json") {
    event.respondWith(networkFirstResource(request));
    return;
  }

  event.respondWith(cacheFirstAsset(request));
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
      icon: "/icon-192.png",
      badge: "/notification-badge.png",
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
