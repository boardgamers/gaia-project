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
 * Joins the shared presence channel as `userId`, tracking `context` and whether *this* tab is the
 * visible one (Page Visibility API - the same signal hosted.ts already uses for resync-on-refocus,
 * see its own `visibilitychange` listener). `onState` fires with the full cross-user roster
 * whenever anyone's presence changes, not just this tab's own.
 */
export function trackPresence(
  client: SupabaseClient,
  userId: string,
  context: PresenceContext,
  onState: (state: PresenceState) => void
): () => void {
  const channel = client.channel(CHANNEL_NAME, { config: { presence: { key: userId } } });

  const track = () => {
    channel.track({ context, focused: document.visibilityState === "visible" } as PresenceMeta);
  };
  const visibilityListener = () => track();

  channel.on("presence", { event: "sync" }, () => onState(channel.presenceState() as PresenceState));
  channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      track();
    }
  });
  document.addEventListener("visibilitychange", visibilityListener);

  return () => {
    document.removeEventListener("visibilitychange", visibilityListener);
    client.removeChannel(channel);
  };
}

/**
 * Subscribes read-only to the shared presence channel without tracking anything for this tab -
 * for a page (e.g. the Lobby) that wants to know who's around but has already tracked its own
 * presence separately, or has none of its own to track.
 */
export function subscribePresence(client: SupabaseClient, onState: (state: PresenceState) => void): () => void {
  const channel = client.channel(CHANNEL_NAME, { config: { presence: { key: "__readonly__" } } });
  channel.on("presence", { event: "sync" }, () => onState(channel.presenceState() as PresenceState));
  channel.subscribe();
  return () => client.removeChannel(channel);
}

export type PresenceStatus = "green" | "yellow" | "grey";

/**
 * green = this user has a tab open on exactly this game, and it's the visible/focused one.
 * yellow = this user is present somewhere (lobby, a different game, or a background tab of this
 * same game) but not actively looking at this game right now.
 * grey = no live presence at all (fully offline).
 */
export function presenceStatus(state: PresenceState, userId: string | null, gameId: string): PresenceStatus {
  if (!userId) {
    return "grey";
  }
  const metas = state[userId];
  if (!metas || metas.length === 0) {
    return "grey";
  }
  const activeHere = metas.some((m) => m.context.type === "game" && m.context.gameId === gameId && m.focused);
  return activeHere ? "green" : "yellow";
}
