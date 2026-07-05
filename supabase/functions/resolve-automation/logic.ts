// Pure decision logic for the resolve-automation Edge Function (PREMOVE_PLAN.md §4c), separated
// from index.ts's Deno.serve/service-role-client plumbing so it can be exercised by a plain test
// (no network, no Deno-specific globals) with a fake backend - mirrors how viewer/src/hosted/host.ts
// separates HostedGameHost's pure logic from its injected HostedBackend.
//
// Resolves exactly ONE committed turn per invocation, then returns - the commit's own current_seat
// change re-fires the trigger for the next seat/decision (mirrors the client's own recursion via
// repeated trigger firings, see host.ts's resolveAutoDecisions/applyAndCommit chain).
//
// Phase 1 only implements the Phase.RoundMove branch (the RoundLeech/auto-charge branch is Phase 2 -
// see PREMOVE_PLAN.md's phasing). Any other phase (setup, income, gaia, leech, scoring, endgame) is
// a no-op: the premove stays queued untouched, waiting for its moment.

export type GameRow = {
  id: string;
  seed: string;
  player_count: number;
  options: Record<string, unknown> | null;
  move_count: number;
};

export type MoveRow = { seq: number; move: string };
export type PremoveRow = { seq: number; move: string };

export type PlayerUpdate = { seat: number; faction: string; score: number };

export type CommitAutomatedTurnArgs = {
  gameId: string;
  seq: number;
  seat: number;
  move: string;
  nextSeat: number | null;
  finished: boolean;
  currentRound: number;
  playerUpdates: PlayerUpdate[];
};

// The slice of the bundled engine module this logic needs - kept minimal and structural so this
// file has no direct dependency on the engine bundle's own types.
export type EngineModule = {
  Engine: new (moves: string[], options?: Record<string, unknown>) => EngineInstance;
  Phase: { RoundMove: string; EndGame: string };
};

export type EngineInstance = {
  playerToMove: number | undefined;
  phase: string;
  round: number;
  newTurn: boolean;
  moveHistory: string[];
  players: { player: number; faction?: string; data: { victoryPoints: number } }[];
  generateAvailableCommandsIfNeeded(): unknown;
  move(line: string): void;
};

export type Backend = {
  fetchGame(gameId: string): Promise<GameRow>;
  fetchMoves(gameId: string): Promise<MoveRow[]>;
  fetchLowestSeqPremove(gameId: string, seat: number): Promise<PremoveRow | null>;
  deletePremove(gameId: string, seat: number, seq: number): Promise<void>;
  insertPremoveFailure(gameId: string, seat: number, move: string, reason: string): Promise<void>;
  commitAutomatedTurn(args: CommitAutomatedTurnArgs): Promise<void>;
};

export type Result =
  | { outcome: "stale-trigger" }
  | { outcome: "no-premove-queued" }
  | { outcome: "wrong-phase"; phase: string }
  | { outcome: "premove-failed"; reason: string }
  | { outcome: "premove-incomplete-turn" }
  | { outcome: "committed"; seq: number }
  | { outcome: "seq-conflict" }
  | { outcome: "replay-failed"; reason: string };

const SEQ_CONFLICT_PREFIX = "seq_conflict";

function isSeqConflict(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes(SEQ_CONFLICT_PREFIX);
}

function engineOptions(game: GameRow): Record<string, unknown> {
  const options = JSON.parse(JSON.stringify(game.options ?? {}));
  delete (options as Record<string, unknown>).map;
  return options;
}

function playerUpdatesOf(engine: EngineInstance): PlayerUpdate[] {
  return engine.players
    .filter((pl) => !!pl.faction)
    .map((pl) => ({ seat: pl.player, faction: pl.faction!, score: pl.data.victoryPoints }));
}

export async function resolveOneAutomatedTurn(
  engineModule: EngineModule,
  backend: Backend,
  gameId: string,
  seat: number
): Promise<Result> {
  const { Engine, Phase } = engineModule;

  const [game, moves] = await Promise.all([backend.fetchGame(gameId), backend.fetchMoves(gameId)]);
  const ordered = [...moves].sort((a, b) => a.seq - b.seq);
  const initLine = `init ${game.player_count} ${game.seed}`;

  let engine: EngineInstance;
  try {
    engine = new Engine([initLine, ...ordered.map((m) => m.move)], engineOptions(game));
    engine.generateAvailableCommandsIfNeeded();
  } catch (err) {
    return { outcome: "replay-failed", reason: err instanceof Error ? err.message : String(err) };
  }

  // Stale-trigger guard: the game moved on since this trigger fired.
  if (engine.playerToMove !== seat) {
    return { outcome: "stale-trigger" };
  }

  if (engine.phase !== Phase.RoundMove) {
    // Includes Phase.RoundLeech - Phase 2 adds that branch. The queued premove (if any) is left
    // untouched; it's still there waiting the next time this seat's turn genuinely arrives in
    // Phase.RoundMove.
    return { outcome: "wrong-phase", phase: engine.phase };
  }

  const premove = await backend.fetchLowestSeqPremove(gameId, seat);
  if (!premove) {
    return { outcome: "no-premove-queued" };
  }

  const clone = new Engine([initLine, ...ordered.map((m) => m.move)], engineOptions(game));
  clone.generateAvailableCommandsIfNeeded();

  let threw: unknown = null;
  try {
    clone.move(premove.move);
    clone.generateAvailableCommandsIfNeeded();
  } catch (err) {
    threw = err;
  }

  if (threw) {
    const reason = threw instanceof Error ? threw.message : String(threw);
    await backend.deletePremove(gameId, seat, premove.seq);
    await backend.insertPremoveFailure(gameId, seat, premove.move, reason);
    return { outcome: "premove-failed", reason };
  }

  if (!clone.newTurn) {
    await backend.deletePremove(gameId, seat, premove.seq);
    await backend.insertPremoveFailure(gameId, seat, premove.move, "premove did not complete a turn");
    return { outcome: "premove-incomplete-turn" };
  }

  const finished = clone.phase === Phase.EndGame;
  const commitArgs: CommitAutomatedTurnArgs = {
    gameId,
    seq: ordered.length + 1,
    seat,
    move: premove.move,
    nextSeat: finished ? null : (clone.playerToMove as number),
    finished,
    currentRound: clone.round,
    playerUpdates: playerUpdatesOf(clone),
  };

  try {
    await backend.commitAutomatedTurn(commitArgs);
  } catch (err) {
    if (isSeqConflict(err)) {
      // Someone else already handled this (the player's own fast-path, or a duplicate trigger
      // delivery) - silent no-op, do NOT write a failure row and do NOT delete the premove (the
      // winning path already consumed it).
      return { outcome: "seq-conflict" };
    }
    throw err;
  }

  await backend.deletePremove(gameId, seat, premove.seq);
  return { outcome: "committed", seq: commitArgs.seq };
}
