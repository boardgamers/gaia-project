import { SupabaseClient } from "./supabase-client";

// Client-side mirror of the server's NotificationPrefs (supabase/functions/notify/logic.ts). These
// are global, per-account settings stored in public.notification_prefs - set once, honored by the
// notify Edge Function for every game and every device. (Whether a *device* is subscribed at all is
// separate and per-device; see push.ts.)
export type NotificationPrefs = {
  turn_pushes: boolean;
  // The two side games notify on their own toggles, so "no renju pings" never costs you the Gaia
  // turn push. A future side game adds one more field here plus a column in notification_prefs.
  chess_pushes: boolean;
  renju_pushes: boolean;
  chat_pushes: boolean;
  invite_pushes: boolean;
  finished_pushes: boolean;
  reminders_enabled: boolean;
  reminder_interval_hours: number;
  reminder_max_count: number;
  quiet_hours_enabled: boolean;
  quiet_start_hour: number;
  quiet_end_hour: number;
  snooze_until: string | null;
};

// Must match DEFAULT_NOTIFICATION_PREFS in the notify function so an unsaved user behaves identically
// whether the UI or the server is deciding: every category on, the 12h reminder on (opt-out), quiet 22-08.
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  turn_pushes: true,
  chess_pushes: true,
  renju_pushes: true,
  chat_pushes: true,
  invite_pushes: true,
  finished_pushes: true,
  reminders_enabled: true,
  reminder_interval_hours: 12,
  reminder_max_count: 3,
  quiet_hours_enabled: true,
  quiet_start_hour: 22,
  quiet_end_hour: 8,
  snooze_until: null,
};

const PREFS_COLUMNS =
  "turn_pushes,chess_pushes,renju_pushes,chat_pushes,invite_pushes,finished_pushes,reminders_enabled," +
  "reminder_interval_hours,reminder_max_count,quiet_hours_enabled,quiet_start_hour,quiet_end_hour,snooze_until";

/** Loads this user's saved prefs, falling back to defaults for any unset field / missing row. */
export async function loadNotificationPrefs(client: SupabaseClient, userId: string): Promise<NotificationPrefs> {
  const { data } = await client.from("notification_prefs").select(PREFS_COLUMNS).eq("user_id", userId).maybeSingle();
  return { ...DEFAULT_NOTIFICATION_PREFS, ...((data as Partial<NotificationPrefs> | null) ?? {}) };
}

/** Upserts the whole prefs row. Returns an error message on failure, or null on success. */
export async function saveNotificationPrefs(
  client: SupabaseClient,
  userId: string,
  prefs: NotificationPrefs
): Promise<string | null> {
  const { error } = await client
    .from("notification_prefs")
    .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
  return error ? error.message : null;
}

/** A snooze timestamp `hours` from now, as an ISO string, for the "pause everything" buttons. */
export function snoozeFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/** Whether a stored snooze_until is still in the future. */
export function isSnoozeActive(snoozeUntil: string | null, now: number = Date.now()): boolean {
  if (!snoozeUntil) {
    return false;
  }
  const until = new Date(snoozeUntil).getTime();
  return Number.isFinite(until) && now < until;
}
