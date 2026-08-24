// Cross-page "where is this user right now" signal (turn-order presence dots): pure helpers and
// shared types. The roster itself comes from whatever transport the host app provides.

export type PresenceContext = { type: "game"; gameId: string } | { type: "lobby" };
export type PresenceMeta = { context: PresenceContext; focused: boolean };
/** Keyed by user id; each value is that user's tracked metas (normally one per open tab/device). */
export type PresenceState = Record<string, PresenceMeta[]>;

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

export type PresenceStatus = "green" | "yellow" | "grey";

/** How recently `last_active_at` (players table, refreshed every ~20s while a tab is open) still
 * counts as "recently active" for the yellow-dot fallback below. */
const RECENTLY_ACTIVE_UI_MS = 10 * 60_000;

/**
 * green = this user has a tab open on exactly this game, and it's the visible/focused one.
 * yellow = this user is present somewhere (lobby, a different game, or a background tab of this
 * same game) but not actively looking at this game right now - OR they have no live presence
 * entry at all (tab minimized/backgrounded and disconnected) but were seen, via `lastActiveAt`,
 * within the last 10 minutes.
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
