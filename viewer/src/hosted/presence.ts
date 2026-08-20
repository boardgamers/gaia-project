import { SupabaseClient } from "./supabase-client";

// Cross-page "where is this user right now" signal (turn-order presence dots, PROGRESS.md Gaia 9):
// a single Realtime Presence channel shared by every hosted page (lobby + every game), keyed by
// user id. No schema/table needed - Presence is purely a live channel roster, and a dropped
// connection (tab closed/navigated away) is automatically untracked by Supabase for us.

export type PresenceContext = { type: "game"; gameId: string } | { type: "lobby" };
export type PresenceMeta = { context: PresenceContext; focused: boolean };
/** Keyed by user id; each value is that user's tracked metas (normally one per open tab/device). */
export type PresenceState = Record<string, PresenceMeta[]>;

const CHANNEL_NAME = "presence:app";

/**
 * "Is this user genuinely looking at this page right now" - the signal behind the green presence
 * dot. Page Visibility alone (`document.visibilityState`) is not enough on desktop: a tab that is
 * the selected tab in its window still counts as "visible" even when the whole browser window is
 * behind another application (alt-tabbed away, another window on top), and `visibilitychange`
 * doesn't even fire for that case. Requiring `document.hasFocus()` as well means green only shows
 * when the tab is BOTH the foreground tab AND its window currently holds OS focus - i.e. the user
 * really is in the game, not just leaving it open behind something else. On mobile there is no
 * windowing, so `hasFocus()` tracks visibility and this stays accurate there too (minimizing or
 * switching apps drops both).
 */
export function isActivelyFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Joins the shared presence channel as `userId`, tracking `context` and whether *this* tab is the
 * one the user is actively looking at right now (`isActivelyFocused` above - foreground tab AND
 * window-focused, not merely open). Re-tracks immediately on every transition (tab switch, window
 * minimize, and - crucially for the "forefront" requirement - the window gaining/losing OS focus
 * via `focus`/`blur`), so the green/yellow flip propagates to everyone in realtime rather than on a
 * timer. `onState` fires with the full cross-user roster whenever anyone's presence changes, not
 * just this tab's own.
 */
export function trackPresence(
  client: SupabaseClient,
  userId: string,
  context: PresenceContext,
  onState: (state: PresenceState) => void
): () => void {
  // `private: true` is required for this project: Realtime Authorization is on by default (RLS on
  // `realtime.messages`, migration 0015_realtime_presence_authorization.sql grants authenticated
  // users select/insert) and a non-private channel is never granted access to read/write it, so
  // presence silently never syncs without this - confirmed live before adding it.
  const channel = client.channel(CHANNEL_NAME, { config: { presence: { key: userId }, private: true } });

  const track = () => {
    channel.track({ context, focused: isActivelyFocused() } as PresenceMeta);
  };
  // `visibilitychange` catches tab switches and minimize; `focus`/`blur` catch the window losing or
  // regaining OS focus while the tab stays selected (desktop alt-tab / another window on top) -
  // which visibility never reports. Together they cover every "no longer in the forefront" case.
  const retrack = () => track();

  channel.on("presence", { event: "sync" }, () => onState(channel.presenceState() as PresenceState));
  channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      track();
    }
  });
  document.addEventListener("visibilitychange", retrack);
  window.addEventListener("focus", retrack);
  window.addEventListener("blur", retrack);

  return () => {
    document.removeEventListener("visibilitychange", retrack);
    window.removeEventListener("focus", retrack);
    window.removeEventListener("blur", retrack);
    client.removeChannel(channel);
  };
}

/**
 * Subscribes read-only to the shared presence channel without tracking anything for this tab -
 * for a page (e.g. the Lobby) that wants to know who's around but has already tracked its own
 * presence separately, or has none of its own to track.
 */
export function subscribePresence(client: SupabaseClient, onState: (state: PresenceState) => void): () => void {
  const channel = client.channel(CHANNEL_NAME, { config: { presence: { key: "__readonly__" }, private: true } });
  channel.on("presence", { event: "sync" }, () => onState(channel.presenceState() as PresenceState));
  channel.subscribe();
  return () => client.removeChannel(channel);
}

/** Simple "is this user around at all right now" check, context-agnostic (unlike `presenceStatus`
 * below, which distinguishes "focused on this exact game" from "present somewhere else") - for UI
 * that just wants an online/offline dot per user, e.g. the Lobby Chat message list. */
export function isOnline(state: PresenceState, userId: string): boolean {
  return (state[userId]?.length ?? 0) > 0;
}

/** The set of user ids that currently have at least one tab open on this exact game (any focus
 * state - a backgrounded tab of the game still counts as "in the game"). Used to detect someone
 * newly arriving in a game you're already in (hosted.ts's entrant notice) by diffing this set
 * across presence syncs. */
export function usersInGame(state: PresenceState, gameId: string): Set<string> {
  const ids = new Set<string>();
  for (const [userId, metas] of Object.entries(state)) {
    if (metas.some((m) => m.context.type === "game" && m.context.gameId === gameId)) {
      ids.add(userId);
    }
  }
  return ids;
}

export type PresenceStatus = "green" | "yellow" | "grey";

/** How recently `last_active_at` (players table, refreshed every ~20s while a tab is open, see
 * hosted.ts's markSeatsActive) still counts as "recently active" for the yellow-dot fallback below.
 * Deliberately its own, longer constant rather than reusing the `notify` edge function's 45s
 * RECENTLY_ACTIVE_MS - that one is tuned to avoid duplicate push notifications for a tab that's
 * merely still open, not to answer "should this look online" for a UI status dot. */
const RECENTLY_ACTIVE_UI_MS = 10 * 60_000;

/**
 * green = this user has a tab open on exactly this game, and it's the visible/focused one.
 * yellow = this user is present somewhere (lobby, a different game, or a background tab of this
 * same game) but not actively looking at this game right now - OR they have no live Realtime
 * Presence entry at all (tab minimized/backgrounded and disconnected) but were seen, via
 * `lastActiveAt`, within the last 10 minutes.
 * grey = no live presence and no recent activity - fully offline.
 */
export function presenceStatus(
  state: PresenceState,
  userId: string | null,
  gameId: string,
  lastActiveAt?: string | null
): PresenceStatus {
  if (!userId) {
    return "grey";
  }
  const metas = state[userId];
  if (metas && metas.length > 0) {
    const activeHere = metas.some((m) => m.context.type === "game" && m.context.gameId === gameId && m.focused);
    return activeHere ? "green" : "yellow";
  }
  if (lastActiveAt) {
    const ageMs = Date.now() - new Date(lastActiveAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= RECENTLY_ACTIVE_UI_MS) {
      return "yellow";
    }
  }
  return "grey";
}
