import Engine from "@gaia-project/engine";
import { offlineGameListRow, StoredOfflineGame } from "../offline-game";

export type ImportedMoveRow = { seq: number; seat: number; move: string };

export type ImportSeat = { seat: number; userId: string; displayName: string };

/**
 * The offline creation path (CreateGame.vue's offline branch) hands a real Engine construction its
 * options object directly instead of a clone, so a stored offline game's `engineData.options`
 * already has the generated map baked in (see host.ts's `engineOptions()` doc comment for the same
 * problem on the hosted side) - `init` rejects a preset map combined with lostFleet, and the map
 * regenerates deterministically from the seed anyway, so it's dropped rather than carried over.
 */
function importedOptions(options: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(options ?? {}));
  delete clone.map;
  return clone;
}

/**
 * Reconstructs the (seat, move) pairs a hosted game's `moves` table would have recorded for this
 * history, one committed turn at a time - mirrors host.ts's `applyAndCommit`, which captures
 * `playerToMove` immediately before applying each turn, since a move's acting seat is only known
 * from the engine's own live state while it is being played, not by inspecting the move text
 * afterward. `moveHistory` is a restored offline game's full history (index 0 is the "init" line,
 * never stored as its own `moves` row - see 0001_multiplayer.sql).
 */
export function deriveImportedMoveRows(
  seed: string,
  playerCount: number,
  options: Record<string, unknown>,
  moveHistory: string[]
): ImportedMoveRow[] {
  const engine = new Engine([`init ${playerCount} ${seed}`], importedOptions(options));
  engine.generateAvailableCommandsIfNeeded();

  const rows: ImportedMoveRow[] = [];
  for (let seq = 1; seq < moveHistory.length; seq++) {
    const move = moveHistory[seq];
    rows.push({ seq, seat: engine.playerToMove, move });
    engine.move(move);
    engine.generateAvailableCommandsIfNeeded();
  }
  return rows;
}

/**
 * Builds the `import_offline_game` RPC arguments from a stored offline save and the seats the
 * importing player has assigned to registered accounts (ImportOfflineGame.vue) - reuses
 * `offlineGameListRow` for the same status/current-seat/round/summary/faction/score derivation the
 * offline lobby row already shows, so the imported game's lobby row starts out looking identical.
 */
export function buildImportGameParams(game: StoredOfflineGame, seats: ImportSeat[]) {
  const data = game.engineData ?? {};
  const row = offlineGameListRow(game);
  const moveHistory: string[] = Array.isArray(data.moveHistory) ? data.moveHistory : [];
  const options = importedOptions(row.options);
  const finished = row.status === "finished";

  return {
    p_name: game.name,
    p_seed: row.seed,
    p_player_count: row.player_count,
    p_options: options,
    p_invites: seats.map((s) => ({ user_id: s.userId, seat: s.seat, display_name: s.displayName })),
    p_moves: deriveImportedMoveRows(row.seed, row.player_count, options, moveHistory),
    p_current_seat: finished ? null : row.current_seat,
    p_finished: finished,
    p_current_round: row.current_round,
    p_latest_move_summary: row.latest_move_summary,
    p_player_updates: row.players
      .filter((p) => !!p.faction)
      .map((p) => ({ seat: p.seat, faction: p.faction, score: p.score })),
  };
}
