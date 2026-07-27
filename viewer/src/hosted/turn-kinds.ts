import { isMyChessTurn, isMyRenjuTurn, isMyTurn } from "./game-bar";

/**
 * "Which game inside this game is waiting for me?"
 *
 * A hosted game row is really three games in one - the Gaia game itself, the sidebar's shared chess
 * board, and the research panel's shared renju board - and any combination of them can be on your
 * move at once. They all drive the same green pulse around the game bar, which used to leave no way
 * to tell what the pulse was actually asking for (owner request: "a little tiny icon on the game
 * bar if the pulsing is for Gaia, chess, renju or any other future game").
 *
 * This module is the single place that knows the full list. Adding a future side game means adding
 * one entry to TURN_KINDS below plus its `pending` predicate - the game-bar badge, the pulse itself
 * and (via the matching `NotificationKind`/prefs column) the settings modal's category row all
 * follow from that. `order` is the display order everywhere the icons appear.
 */
export type TurnKind = "gaia" | "chess" | "renju";

export type TurnKindBadge = {
  kind: TurnKind;
  /** A single text glyph, not an emoji: it inherits `currentColor` so it can be tinted to match the pulse. */
  glyph: string;
  /** Tooltip/aria wording, also reused as the notification-settings category label. */
  label: string;
  /** The notification_prefs column that switches this game's "your move" push on and off. */
  pushPrefKey: "turn_pushes" | "chess_pushes" | "renju_pushes";
  pending: (game: any, myUserId: string, userEmail: string) => boolean;
};

export const TURN_KINDS: TurnKindBadge[] = [
  { kind: "gaia", glyph: "⬢", label: "Your Gaia turn", pushPrefKey: "turn_pushes", pending: isMyTurn },
  {
    kind: "chess",
    glyph: "♟",
    label: "Your chess move",
    pushPrefKey: "chess_pushes",
    pending: (game, myUserId) => isMyChessTurn(game, myUserId),
  },
  {
    kind: "renju",
    glyph: "⬤",
    label: "Your renju move",
    pushPrefKey: "renju_pushes",
    pending: (game, myUserId) => isMyRenjuTurn(game, myUserId),
  },
];

/** Every sub-game of `game` currently waiting on this viewer, in TURN_KINDS order (may be empty). */
export function pendingTurnBadges(game: any, myUserId: string, userEmail: string): TurnKindBadge[] {
  return TURN_KINDS.filter((badge) => badge.pending(game, myUserId, userEmail));
}

/** Whether the game bar should pulse at all - i.e. whether anything in this game wants a move. */
export function hasPendingTurn(game: any, myUserId: string, userEmail: string): boolean {
  return TURN_KINDS.some((badge) => badge.pending(game, myUserId, userEmail));
}
