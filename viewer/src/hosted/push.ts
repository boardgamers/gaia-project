import { supabaseConfig } from "./config";
import { SupabaseClient } from "./supabase-client";

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

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  return navigator.serviceWorker.register("/sw.js");
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
