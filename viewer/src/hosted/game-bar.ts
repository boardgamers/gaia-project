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
  // The email arm only counts for a viewer who actually has one: the offline game list renders the
  // same bar with no identity at all (my-user-id="", no email), and its unclaimed seats carry no
  // invited_email either - without this guard "" === "" would make every offline row "my turn".
  return seat.user_id === myUserId || (!!email && (seat.invited_email ?? "").toLowerCase() === email);
}

// `chess_board` is a 1:1 join (its primary key is the game's own id), but PostgREST embeds a
// to-one relationship as an array unless it can prove uniqueness from the query shape alone - so
// callers may see either a single object or a one-element array depending on how the embed was
// requested. Normalize both here rather than assuming one shape at every call site.
export function chessBoardOf(game: any): any | null {
  const board = game.chess_board;
  if (!board) {
    return null;
  }
  return Array.isArray(board) ? board[0] ?? null : board;
}

// Mirrors move_chess's own "who moves next" resolution (supabase/migrations/
// 20260724185341_persist_chess_last_move.sql): the *_next_user columns exist for 2v2 relay chess
// and take priority; a solo team falls back to its single seated user.
export function chessMover(board: any): string | null {
  const active = (board.fen ?? "").split(" ")[1];
  return active === "w"
    ? board.white_next_user ?? board.white_user ?? board.white_user_2 ?? null
    : board.black_next_user ?? board.black_user ?? board.black_user_2 ?? null;
}

// Owner request: a finished Gaia game stops asking for attention altogether - no side-game pulse
// around its bar and no side-game push (the server half of this is notify/logic.ts's
// isSideGameSilenced). The boards themselves stay open and playable; they just stop nagging, the
// same way a finished game's Gaia turn has nothing left to ask for.
function isSideGameSilenced(game: any): boolean {
  return game.status === "finished";
}

// Whether it's this viewer's move in the game's shared chess board - used alongside isMyTurn to
// decide the game bar's "your turn" pulse, since a game can need your attention for its Gaia turn,
// its chess turn, its renju turn, or any combination.
export function isMyChessTurn(game: any, myUserId: string): boolean {
  const board = chessBoardOf(game);
  if (!board || !board.fen || !myUserId || isSideGameSilenced(game)) {
    return false;
  }
  return chessMover(board) === myUserId;
}

/** The renju counterpart of chessBoardOf - same PostgREST to-one embed shape caveat. */
export function renjuBoardOf(game: any): any | null {
  const board = game.renju_board;
  if (!board) {
    return null;
  }
  return Array.isArray(board) ? board[0] ?? null : board;
}

// Mirrors move_renju's own "who moves next" resolution (supabase/migrations/
// 20260726190000_shared_renju_board.sql). Renju has no FEN: black opens, so the side to move is
// black exactly while both colours have played the same number of stones.
export function renjuMover(board: any): string | null {
  const position: string = board.board ?? "";
  if (position.length !== 225) {
    return null;
  }
  let black = 0;
  let white = 0;
  for (let index = 0; index < position.length; index++) {
    const cell = position.charAt(index);
    if (cell === "b") {
      black++;
    } else if (cell === "w") {
      white++;
    }
  }
  return black === white
    ? board.black_next_user ?? board.black_user ?? board.black_user_2 ?? null
    : board.white_next_user ?? board.white_user ?? board.white_user_2 ?? null;
}

/** Whether it's this viewer's move on the game's shared renju board (the research panel's face two). */
export function isMyRenjuTurn(game: any, myUserId: string): boolean {
  const board = renjuBoardOf(game);
  if (!board || !board.board || !myUserId || isSideGameSilenced(game)) {
    return false;
  }
  return renjuMover(board) === myUserId;
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
    case "preference-split":
      return "Preference Split Auction";
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
