import { supabaseConfig } from "./config";
import { SupabaseClient } from "./supabase-client";
import { startHostedUpdatePrompt } from "./update-prompt";

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** This device's IANA timezone (e.g. "America/New_York"), or null if the browser won't report it. */
function localTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Whether this device already has a live push subscription - checked entirely browser-side
 * (Notification.permission + an actual PushManager subscription), no Supabase round trip needed.
 * Lets the UI show "notifications enabled" instead of an "Enable notifications" button that would
 * otherwise offer to (re-)request permission indefinitely, with no memory of a prior grant.
 */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") {
    return false;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return false;
  }
  const subscription = await registration.pushManager.getSubscription();
  return subscription != null;
}

/**
 * This device's push endpoint (the primary key of its `push_subscriptions` row), or null when it
 * has no live subscription. Used to report per-device presence while a game is open, so the
 * `notify` function can tell "this phone is showing the board" from "some other device of theirs
 * is" - see migration 20260808121000 and hosted.ts's heartbeat.
 */
export async function currentPushEndpoint(): Promise<string | null> {
  try {
    if (!(await isPushEnabled())) {
      return null;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}

/**
 * Backfill the reminder sweep's timezone for a subscription that predates the `tz` column.
 * Subscriptions created before turn reminders shipped have `tz = null`, and a null timezone is
 * never quiet-hours-suppressed - so those devices would get 3am reminders until the user toggled
 * notifications off/on. Instead, whenever a device that already has push enabled loads the app, fill
 * in its timezone once (only while still null, so it's a single write and never fights the
 * enable-time value). Best-effort: any failure is swallowed so it can't break app boot.
 */
export async function backfillSubscriptionTimezone(client: SupabaseClient): Promise<void> {
  try {
    if (!(await isPushEnabled())) {
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    const tz = localTimeZone();
    if (!subscription || !tz) {
      return;
    }
    await client.from("push_subscriptions").update({ tz }).eq("endpoint", subscription.endpoint).is("tz", null);
  } catch {
    // Non-critical - a device without its timezone backfilled just isn't quiet-hours-gated yet.
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  startHostedUpdatePrompt({
    registrationUpdate: () => registration.update(),
  });
  return registration;
}

/**
 * Set by `hosted.ts`'s `launchGame` while a game is mounted: swaps the board to `gameId` in place
 * (the same path GameNavPanel.vue's rows take) and returns whether it took the navigation. Null
 * whenever no game is mounted - the lobby, sign-in, self-contained play - in which case a push
 * target is reached by an ordinary page load instead.
 */
type InAppGameNavigation = (gameId: string) => boolean;

let inAppGameNavigation: InAppGameNavigation | null = null;

export function setInAppGameNavigation(handler: InAppGameNavigation | null): void {
  inAppGameNavigation = handler;
}

export type PushTarget =
  /** Already exactly here - the service worker's `focus()` was the whole navigation. */
  | { action: "ignore" }
  /** Another game, with a game already mounted: swap the board in place. */
  | { action: "swap-game"; gameId: string }
  /** Anything else: an ordinary page load, which is what this always used to do. */
  | { action: "load"; href: string };

/**
 * Where a clicked push notification should take a window currently at `currentHref`. Pure, so the
 * decision can be tested without a service worker or a real navigation.
 *
 * "You're in a game, and it's now your turn in a DIFFERENT one" is the case this exists for: a page
 * load to reach the other game re-fetches and re-replays its entire move history behind a
 * "Loading game…" spinner, which is neither immediate nor kind to a half-composed turn in the game
 * being left. When a game is mounted, hand the switch to it instead (`canSwapGame`) - that swap is
 * the same operation as clicking the game in the left menu, and updates the URL itself. A push for
 * the game already on screen must resolve to `ignore` rather than reloading the board.
 */
export function resolvePushTarget(rawUrl: string, currentHref: string, canSwapGame: boolean): PushTarget {
  const current = new URL(currentHref);
  const target = new URL(rawUrl, current.origin);
  if (target.href === current.href) {
    return { action: "ignore" };
  }
  const gameId = target.searchParams.get("game");
  // Same document, only a different `game` - i.e. exactly what the in-place swap covers. A target on
  // another origin or path (a different deployment, a future route) is left to a real load.
  if (canSwapGame && gameId && target.origin === current.origin && target.pathname === current.pathname) {
    return { action: "swap-game", gameId };
  }
  return { action: "load", href: target.href };
}

/** Applies `resolvePushTarget` to this window, and reports what it did. */
export function navigateToPushTarget(rawUrl: string): PushTarget {
  const target = resolvePushTarget(rawUrl, window.location.href, inAppGameNavigation !== null);
  if (target.action === "ignore") {
    return target;
  }
  if (target.action === "swap-game" && inAppGameNavigation!(target.gameId)) {
    return target;
  }
  // Either an ordinary load, or a mounted game that declined the swap - reach it the old way.
  const href = new URL(rawUrl, window.location.origin).href;
  window.location.href = href;
  return { action: "load", href };
}

/**
 * Tapping a push notification should land on the specific game it's about, not the lobby. `sw.js`'s
 * `notificationclick` handler can't do that on its own: installed/standalone PWAs are commonly
 * single-instance, so `clients.openWindow(url)` just refocuses the existing window at whatever URL
 * it already had, and `client.url` is specified as the client's *creation* URL - which goes stale
 * the moment the in-app game switch (`history.pushState`) moves this window to another game, so the
 * worker can't reliably tell which game a window is showing either. The worker therefore focuses its
 * best guess and always posts a `{type: "navigate", url}` message to it; this listener is what
 * actually resolves the target, from a window that does know where it is.
 */
export function registerServiceWorkerNavigationListener(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (data && data.type === "navigate" && typeof data.url === "string") {
      navigateToPushTarget(data.url);
    }
  });
}

/**
 * Full opt-in flow — must run from a user gesture (browsers require one for
 * the permission prompt). Stores the subscription per user+device; the
 * `notify` Edge Function pushes turn notifications to every stored device.
 */
export async function enablePushNotifications(client: SupabaseClient, userId: string): Promise<string> {
  if (!pushSupported()) {
    return "This browser can't do push notifications. On iPhone/iPad: share → Add to Home Screen, then enable them from the installed app (iOS 16.4+).";
  }
  const registration = await registerServiceWorker();
  if (!registration) {
    return "Service worker registration failed.";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "Notifications are blocked for this site — allow them in the browser settings and try again.";
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(supabaseConfig.vapidPublicKey),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys) {
    return "The browser returned an unusable push subscription.";
  }
  const { error } = await client.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      // IANA timezone for the turn-reminder sweep's quiet-hours gate (so it won't nudge at 3am).
      tz: localTimeZone(),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    return `Could not save the subscription: ${error.message}`;
  }
  return "Turn notifications enabled on this device.";
}

/**
 * Opt-out flow: unsubscribes this device's push manager and removes its stored subscription row,
 * so the `notify` Edge Function stops pushing to it.
 */
export async function disablePushNotifications(client: SupabaseClient): Promise<string> {
  if (!pushSupported()) {
    return "This browser can't do push notifications.";
  }
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const { error } = await client.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) {
      return `Could not remove the subscription: ${error.message}`;
    }
  }
  return "Turn notifications disabled on this device.";
}
