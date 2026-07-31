import { isMyChessTurn, isMyRenjuTurn, isMyTurn } from "./game-bar";

/**
 * "Which game inside this game is waiting for me?"
 *
 * A hosted game row is really three games in one - the Gaia game itself, the sidebar's shared chess
 * board, and the research panel's shared renju board - and any combination of them can be on your
 * move at once. Each one gets its own tiny glyph on the game bar, so you can tell which of them is
 * waiting on you (owner request: "a little tiny icon on the game bar if the pulsing is for Gaia,
 * chess, renju or any other future game").
 *
 * The green pulse itself is narrower than that: only the Gaia turn flashes the bar (owner request,
 * 2026-07-31 - "don't flash game bar green for anything except when your turn in gaiaproject, mini
 * games not part of this"). A waiting side game still shows its glyph, it just doesn't demand
 * attention the way the real game does - hence the `pulses` flag below rather than a second list.
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
  /**
   * Whether waiting on this game flashes the whole game bar green. Only the Gaia game does - a side
   * game announces itself with its glyph alone. A future side game should be `false` too unless the
   * owner asks otherwise.
   */
  pulses: boolean;
  pending: (game: any, myUserId: string, userEmail: string) => boolean;
};

export const TURN_KINDS: TurnKindBadge[] = [
  { kind: "gaia", glyph: "⬢", label: "Your Gaia turn", pushPrefKey: "turn_pushes", pulses: true, pending: isMyTurn },
  {
    kind: "chess",
    glyph: "♟",
    label: "Your chess move",
    pushPrefKey: "chess_pushes",
    pulses: false,
    pending: (game, myUserId) => isMyChessTurn(game, myUserId),
  },
  {
    kind: "renju",
    glyph: "⬤",
    label: "Your renju move",
    pushPrefKey: "renju_pushes",
    pulses: false,
    pending: (game, myUserId) => isMyRenjuTurn(game, myUserId),
  },
];

/** Every sub-game of `game` currently waiting on this viewer, in TURN_KINDS order (may be empty). */
export function pendingTurnBadges(game: any, myUserId: string, userEmail: string): TurnKindBadge[] {
  return TURN_KINDS.filter((badge) => badge.pending(game, myUserId, userEmail));
}

/**
 * Whether the game bar should pulse green - i.e. whether a sub-game that's allowed to pulse (today
 * only Gaia itself) wants a move. A pending side game deliberately does NOT count here; it still
 * shows up in `pendingTurnBadges`.
 */
export function hasPendingTurn(game: any, myUserId: string, userEmail: string): boolean {
  return TURN_KINDS.some((badge) => badge.pulses && badge.pending(game, myUserId, userEmail));
}
