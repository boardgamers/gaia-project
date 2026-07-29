/**
 * Two-way offline sync for the three sidebar minigames (chess, renju, Ultimate tic-tac-toe) inside
 * a copy of an online game (hosted/offline-mirror.ts).
 *
 * The Gaia board and the minigames need the same guarantee - play them on a plane and neither the
 * moves nor the boards are thrown away when you reconnect - but they store state very differently.
 * A Gaia game keeps an append-only move history, so "is the copy ahead?" is a prefix test. A
 * minigame row keeps only its CURRENT position (a FEN, a 225-character renju board, an 81-cell
 * grid), which cannot tell you how it got there. So instead of comparing positions afterwards, this
 * records what the player did as it happens: an ordered op log per game, each op carrying the exact
 * position it moved FROM and TO.
 *
 * That log is precisely what the three backends' `move(previous, next, …)` RPCs already want. Every
 * one of them stores the move only if the board still equals `previous` and hands back whatever is
 * actually stored, and every one of them enforces server-side whose turn it is. So replaying the log
 * on reconnect needs no divergence guesswork of its own: an op whose `previous` no longer matches is
 * rejected by the server, which is exactly the "someone moved first" case, and the upload stops
 * there with the rest of the log untouched.
 *
 * A reset is an op too, in its own position in the log, so "I reset the board and then played three
 * moves" replays as that and not as something else.
 */

export type MinigameKind = "chess" | "renju" | "ultimate";

export const OFFLINE_MINIGAME_STATE_PREFIX = "lf-minigame-mirror:";
export const OFFLINE_MINIGAME_OPS_PREFIX = "lf-minigame-ops:";

/** One thing the player did to a minigame board while offline. */
export type MinigameOp =
  | {
      kind: "move";
      /** The board this move was made from, and the board it produced. */
      previous: string;
      next: string;
      /** Chess only: the squares moved between, for the last-move highlight. */
      from?: string;
      to?: string;
      /** Renju/Ultimate tic-tac-toe only: the cell played. */
      index?: number;
    }
  | { kind: "reset" };

/**
 * The last hosted rows this device saw, plus the account that saw them. Offline there is no session
 * to ask, so the colour/team assignments and the viewer's own user id have to travel with the copy -
 * otherwise the offline board cannot tell whose move it is and would let the player play both sides,
 * building moves that the server would refuse on upload.
 */
export type OfflineMinigameMirror = {
  version: 1;
  userId: string;
  rows: Partial<Record<MinigameKind, any>>;
};

type OpsRecord = { version: 1; ops: Partial<Record<MinigameKind, MinigameOp[]>> };

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The offline game id these keys hang off - the same `?game=` id the board's own local keys use. */
export function offlineMinigameGameId(search = ""): string {
  const gameId = new URLSearchParams(search).get("game");
  return gameId ? encodeURIComponent(gameId) : "sandbox";
}

function stateKey(gameId: string): string {
  return `${OFFLINE_MINIGAME_STATE_PREFIX}${gameId}`;
}

function opsKey(gameId: string): string {
  return `${OFFLINE_MINIGAME_OPS_PREFIX}${gameId}`;
}

export function readOfflineMinigameMirror(
  gameId: string,
  storage: Storage | null = browserStorage()
): OfflineMinigameMirror | null {
  if (!storage || !gameId) {
    return null;
  }
  try {
    const parsed = JSON.parse(storage.getItem(stateKey(gameId)) ?? "null");
    if (parsed?.version !== 1 || typeof parsed.userId !== "string" || !parsed.rows) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Called from hosted play (hosted.ts) whenever the copy is refreshed from the online game. */
export function writeOfflineMinigameMirror(
  gameId: string,
  userId: string,
  rows: Partial<Record<MinigameKind, any>>,
  storage: Storage | null = browserStorage()
): boolean {
  if (!storage || !gameId) {
    return false;
  }
  try {
    const mirror: OfflineMinigameMirror = { version: 1, userId, rows };
    storage.setItem(stateKey(gameId), JSON.stringify(mirror));
    return true;
  } catch {
    return false;
  }
}

function readOpsRecord(gameId: string, storage: Storage): OpsRecord {
  try {
    const parsed = JSON.parse(storage.getItem(opsKey(gameId)) ?? "null");
    if (parsed?.version === 1 && parsed.ops) {
      return parsed;
    }
  } catch {
    // A corrupt log is treated as empty rather than blocking play; the boards themselves still hold
    // their positions in their own local keys.
  }
  return { version: 1, ops: {} };
}

export function readOfflineMinigameOps(
  gameId: string,
  kind: MinigameKind,
  storage: Storage | null = browserStorage()
): MinigameOp[] {
  if (!storage || !gameId) {
    return [];
  }
  return readOpsRecord(gameId, storage).ops[kind] ?? [];
}

/** Appends one op played offline. No-op outside a mirrored copy - the caller checks that. */
export function queueOfflineMinigameOp(
  gameId: string,
  kind: MinigameKind,
  op: MinigameOp,
  storage: Storage | null = browserStorage()
): boolean {
  if (!storage || !gameId) {
    return false;
  }
  try {
    const record = readOpsRecord(gameId, storage);
    record.ops[kind] = [...(record.ops[kind] ?? []), op];
    storage.setItem(opsKey(gameId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function clearOfflineMinigameOps(
  gameId: string,
  kind: MinigameKind,
  storage: Storage | null = browserStorage()
): void {
  if (!storage || !gameId) {
    return;
  }
  try {
    const record = readOpsRecord(gameId, storage);
    delete record.ops[kind];
    storage.setItem(opsKey(gameId), JSON.stringify(record));
  } catch {
    // Best effort: a log that fails to clear is replayed again next time, and every op in it is
    // idempotent-or-rejected server-side (the `previous` check), so it cannot corrupt the board.
  }
}

export function hasPendingOfflineMinigameOps(gameId: string, storage: Storage | null = browserStorage()): boolean {
  if (!storage || !gameId) {
    return false;
  }
  const record = readOpsRecord(gameId, storage);
  return Object.values(record.ops).some((ops) => (ops?.length ?? 0) > 0);
}

/** The minimal slice of a backend this replay needs - satisfied by all three (see logic/*-backend.ts). */
export type MinigameUploadBackend = {
  move(previous: string, next: string, a: any, b?: any): Promise<string>;
  reset(): Promise<void>;
};

export type MinigameUploadResult = {
  uploaded: number;
  /** Ops left unsent because the online board had moved on, or the server refused them. */
  remaining: MinigameOp[];
  conflict: boolean;
};

/**
 * Replays one game's offline op log onto the online board, in order, stopping at the first op the
 * server does not accept.
 *
 * "Does not accept" covers both cases without needing to tell them apart: a rejected move throws
 * (the RPC's own "not your move" / invalid-move guards), and a move that lands somewhere other than
 * its own `next` means the board had already changed underneath it. Either way the remaining ops
 * are handed back rather than dropped, so nothing the player did offline is lost - the caller keeps
 * them queued and reports the conflict.
 */
export async function uploadOfflineMinigameOps(
  backend: MinigameUploadBackend,
  kind: MinigameKind,
  ops: MinigameOp[]
): Promise<MinigameUploadResult> {
  let uploaded = 0;
  for (let index = 0; index < ops.length; index++) {
    const op = ops[index];
    try {
      if (op.kind === "reset") {
        await backend.reset();
      } else {
        const stored =
          kind === "chess"
            ? await backend.move(op.previous, op.next, op.from, op.to)
            : await backend.move(op.previous, op.next, op.index);
        if (stored !== op.next) {
          return { uploaded, remaining: ops.slice(index), conflict: true };
        }
      }
      uploaded++;
    } catch {
      return { uploaded, remaining: ops.slice(index), conflict: true };
    }
  }
  return { uploaded, remaining: [], conflict: false };
}
