import { factionName } from "../data/factions";
import { presenceStatus, PresenceState } from "./presence";

/**
 * Pure, no-`this` game-row logic shared between Lobby.vue's own game list and GameNavPanel.vue's
 * desktop in-game menu (owner request: the two must render identically, and any change to one
 * must apply to both automatically) - both use these functions for sorting/filtering the raw game
 * list and for what a row displays, and both render through the same GameBar.vue presentational
 * component, so there's exactly one implementation of "what does this game's row look like" in
 * the whole app.
 */

export function playerAtSeat(game: any, seat: number | null): any {
  return (game.players ?? []).find((p: any) => p.seat === seat);
}

export function isMyTurn(game: any, myUserId: string, userEmail: string): boolean {
  if (game.status !== "active" || game.current_seat == null) {
    return false;
  }
  const seat = playerAtSeat(game, game.current_seat);
  if (!seat) {
    return false;
  }
  const email = (userEmail ?? "").toLowerCase();
  return seat.user_id === myUserId || (seat.invited_email ?? "").toLowerCase() === email;
}

export function isMyGame(game: any, myUserId: string, userEmail: string): boolean {
  if (game.created_by === myUserId) {
    return true;
  }
  const email = (userEmail ?? "").toLowerCase();
  return (game.players ?? []).some(
    (player: any) => player.user_id === myUserId || (player.invited_email ?? "").toLowerCase() === email
  );
}

export function lastMoveTimestamp(game: any): string | null {
  return game.latest_move_committed_at ?? game._latest_move_created_at ?? null;
}

export function lastMoveTime(game: any): number {
  const value = lastMoveTimestamp(game);
  return value ? new Date(value).getTime() : 0;
}

export function claimedSeats(game: any): number {
  return (game.players ?? []).filter((player: any) => !!player.user_id).length;
}

export function auctionLabel(game: any): string {
  switch (game.options?.auction) {
    case "silent":
      return "Silent Auction";
    case "choose-bid":
      return "Choose, Then Bid";
    case "bid-while-choosing":
      return "Bid While Choosing";
    default:
      return "Standard";
  }
}

export function isTestGame(game: any): boolean {
  if (game.status === "open") {
    return false;
  }
  const players = game.players ?? [];
  const userIds = players.map((p: any) => p.user_id).filter((id: string | null) => !!id);
  return userIds.length > 0 && new Set(userIds).size < players.length;
}

export function summaryForGame(game: any): string | null {
  if (game.status === "open") {
    // Only a join event (join_open_game_seat writes latest_move_summary directly - see
    // 0029_join_event_summary.sql) is expected here; there's no move-log fallback to try since
    // commit_turn never runs before the game goes active.
    return game.latest_move_summary || null;
  }
  return game.latest_move_summary || game._fallback_latest_move_summary || null;
}

export function formatMoveAge(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const rawMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(rawMs)) {
    return null;
  }
  // A slightly-behind client clock (or a move committed within the same second as this render) can
  // make the delta briefly negative - clamp to 0 ("just now") instead of hiding the age entirely,
  // which previously made the whole age display vanish for any client with even a few seconds of
  // clock skew relative to the server.
  const ms = Math.max(0, rawMs);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function moveAge(game: any): string | null {
  if (game.status === "open" && !game.latest_move_summary) {
    return null;
  }
  return formatMoveAge(lastMoveTimestamp(game));
}

export function playersWithSummary(game: any): any[] {
  return (game.players ?? [])
    .filter((p: any) => !!p.faction)
    .slice()
    .sort((a: any, b: any) => a.seat - b.seat);
}

export function playerRows(game: any): any[][] {
  const players = playersWithSummary(game);
  return players.length >= 3 ? [players.slice(0, 2), players.slice(2, 4)] : [players];
}

export function factionInitial(player: any): string {
  return player.faction ? player.faction.substr(0, 1).toUpperCase() : "";
}

export function playerBarTitle(player: any): string {
  const name = player.display_name || "Unknown player";
  const vp = player.score != null ? `${player.score} VP` : "no score yet";
  return `${name} - ${factionName(player.faction)} - ${vp}`;
}

export function playerPresence(game: any, player: any, presenceState: PresenceState): "green" | "yellow" | "grey" {
  return presenceStatus(presenceState, player.user_id ?? null, game.id, player.last_active_at ?? null);
}

/** Ordering (owner request): your-turn games first, then by most-recent-move-first; finished games
 * sort separately by most-recently-finished first, using the same "last move" timestamp as a
 * finish-time proxy. Both non-finished tiers and the finished tier all sort the same direction
 * (newest activity first) - only "is it my turn" ever takes priority over recency. */
export function sortGames(games: any[], myUserId: string, userEmail: string): any[] {
  return [...games].sort((a, b) => {
    const aFinished = a.status === "finished";
    const bFinished = b.status === "finished";
    if (aFinished !== bFinished) {
      return aFinished ? 1 : -1;
    }
    if (aFinished) {
      return lastMoveTime(b) - lastMoveTime(a);
    }
    const aTurn = isMyTurn(a, myUserId, userEmail);
    const bTurn = isMyTurn(b, myUserId, userEmail);
    if (aTurn !== bTurn) {
      return aTurn ? -1 : 1;
    }
    return lastMoveTime(b) - lastMoveTime(a);
  });
}
