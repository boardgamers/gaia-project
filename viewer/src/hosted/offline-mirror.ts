import Engine from "@gaia-project/engine";
import {
  browserOfflineStorage,
  readStoredOfflineGame,
  StoredOfflineGame,
  upsertStoredOfflineGame,
} from "../offline-game";

/**
 * "Convert this online game to an offline game" (the hosted settings menu, HostedBar.vue).
 *
 * Turning the setting on drops a playable copy of the hosted game into this device's offline
 * library (offline-game.ts), and from then on every committed turn the hosted session sees - the
 * local player's own moves, an opponent's move arriving over Realtime, a server-side premove, a
 * full resync - is written straight back into that copy. So the offline library always holds the
 * online game as of the last time this browser had it open, ready to open and read (or play on
 * from) with no account and no connection.
 *
 * **Moves played offline are never lost, and never reverted.** The copy is refreshed only from an
 * online state that is strictly further along the SAME history (`MirrorRelation`) - so a hosted
 * state that is BEHIND the copy, which is exactly what a returning player sees after playing on a
 * plane, cannot overwrite it. Instead the moves the copy holds and the online game doesn't are
 * uploaded to the online game (`planOfflineUpload`, driven by hosted.ts): the two converge forwards,
 * never backwards. Once they match, ordinary mirroring resumes.
 *
 * Because those offline moves become real committed turns in the hosted game, only seats this
 * account actually holds may be played offline - `mirrorSeats` is stored on the record and
 * self-contained.ts locks the offline copy to them, the same way hosted play is seat-locked. A move
 * for someone else's seat could never be committed (`commit_turn` asserts seat ownership), so
 * letting it be made offline would be building an upload that can never happen.
 *
 * (The separate one-shot "Move online" flow - hosted/import-offline-game.ts - is unrelated: it
 * turns a purely local game into a NEW hosted game, and refuses a mirrored record.)
 *
 * The setting is per browser, not per account: the copy it maintains lives in this device's
 * localStorage, so "is this game mirrored" is only ever meaningful for the device holding it.
 * Turning it off only stops the syncing - the copy stays in the offline library, since keeping a
 * readable/playable copy is the entire point of having made one. Deleting that copy in the offline
 * lobby turns the setting off too (OfflineLobby.vue), so a deleted copy can't quietly reappear on
 * the next online move.
 */
export const OFFLINE_MIRROR_PREFS_KEY = "gaia-offline-mirror-v1";

/** Keeps a mirrored record obviously distinct from a locally created game's `offline-…` id. */
export const OFFLINE_MIRROR_ID_PREFIX = "online-";

type OfflineMirrorPrefs = {
  version: 1;
  /** Hosted game ids (NOT the derived offline ids) whose offline copy is being kept up to date. */
  gameIds: string[];
};

export type OfflineMirrorToggleResult = { enabled: boolean; error: string | null };

export type OfflineMirrorSyncResult = {
  save: StoredOfflineGame | null;
  error: string | null;
  /**
   * True when there was deliberately nothing to write: the setting is off, the state is already
   * stored, or - the case that matters - the copy holds offline moves and must not be overwritten.
   */
  skipped: boolean;
  relation: MirrorRelation;
  /** When `relation` is `ahead`: the offline-only moves, for `planOfflineUpload`. */
  offlineMoves: string[];
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The offline library's own id rule (`offline-game.ts`'s `validOfflineGameId`) allows only
 * `[a-z0-9-]`, so anything else in the hosted id is folded to `-`. Hosted ids are uuids in practice,
 * which pass through untouched; the fold only matters for hand-made test/fixture ids.
 */
export function mirrorOfflineGameId(hostedGameId: string): string {
  return `${OFFLINE_MIRROR_ID_PREFIX}${String(hostedGameId).replace(/[^a-z0-9-]+/gi, "-")}`;
}

function isOfflineMirrorPrefs(value: any): value is OfflineMirrorPrefs {
  return (
    value?.version === 1 && Array.isArray(value.gameIds) && value.gameIds.every((id: unknown) => typeof id === "string")
  );
}

function readPrefs(storage: Storage): { prefs: OfflineMirrorPrefs; error: string | null } {
  const empty: OfflineMirrorPrefs = { version: 1, gameIds: [] };
  try {
    const raw = storage.getItem(OFFLINE_MIRROR_PREFS_KEY);
    if (!raw) {
      return { prefs: empty, error: null };
    }
    const parsed = JSON.parse(raw);
    if (!isOfflineMirrorPrefs(parsed)) {
      // Unreadable settings must never take a game's stored copy down with them: treat it as "no
      // game is mirrored" and let the next toggle rewrite the file.
      return { prefs: empty, error: "The offline-copy setting has an unsupported format." };
    }
    return { prefs: parsed, error: null };
  } catch (error) {
    return { prefs: empty, error: `The offline-copy setting could not be read: ${errorMessage(error)}` };
  }
}

export function listOfflineMirroredGameIds(storage: Storage | null = browserOfflineStorage()): string[] {
  return storage ? readPrefs(storage).prefs.gameIds : [];
}

export function isOfflineMirrorEnabled(
  hostedGameId: string,
  storage: Storage | null = browserOfflineStorage()
): boolean {
  return listOfflineMirroredGameIds(storage).includes(hostedGameId);
}

export function setOfflineMirrorEnabled(
  hostedGameId: string,
  enabled: boolean,
  storage: Storage | null = browserOfflineStorage()
): OfflineMirrorToggleResult {
  if (!storage) {
    return { enabled: false, error: "Local storage is unavailable in this browser." };
  }
  const { prefs } = readPrefs(storage);
  const gameIds = prefs.gameIds.filter((id) => id !== hostedGameId);
  if (enabled) {
    gameIds.unshift(hostedGameId);
  }
  try {
    storage.setItem(OFFLINE_MIRROR_PREFS_KEY, JSON.stringify({ version: 1, gameIds }));
    return { enabled, error: null };
  } catch (error) {
    return {
      enabled: isOfflineMirrorEnabled(hostedGameId, storage),
      error: `The offline-copy setting could not be saved: ${errorMessage(error)}`,
    };
  }
}

function storedHistoryOf(stored: StoredOfflineGame | null): string[] {
  return Array.isArray(stored?.engineData?.moveHistory) ? stored!.engineData.moveHistory : [];
}

/**
 * How the copy on this device relates to the online game's committed history. This is the whole
 * safety mechanism: a copy is only ever refreshed from the online game when the online game is
 * strictly further along the SAME history, so moves played offline can never be reverted by a
 * hosted state that is behind them.
 *
 * Comparing the two histories line by line is reliable because a move line survives a replay
 * byte-identically: the engine's `moveHistory` holds the annotated form (`createMoveToShow`), and
 * re-running that annotated line through a fresh engine (which is exactly what host.ts's
 * `buildEngine` does with the stored `moves` rows) reproduces the same string rather than annotating
 * it twice. So the shared prefix of an unmodified copy and its online source is literally equal.
 */
export type MirrorRelation =
  /** Nothing stored yet for this game - the first sync creates it. */
  | "none"
  /** Identical: nothing to do. */
  | "same"
  /** The copy is a strict prefix of the online game - it is stale and safe to refresh. */
  | "behind"
  /** The online game is a strict prefix of the copy - the copy holds moves played offline. */
  | "ahead"
  /** They agree up to a point and then disagree - offline play raced a move made online. */
  | "diverged";

export function compareMoveHistories(stored: string[], online: string[]): MirrorRelation {
  if (stored.length === 0) {
    return "none";
  }
  const shared = Math.min(stored.length, online.length);
  for (let index = 0; index < shared; index++) {
    if (stored[index] !== online[index]) {
      return "diverged";
    }
  }
  if (stored.length === online.length) {
    return "same";
  }
  return stored.length < online.length ? "behind" : "ahead";
}

export type OfflineMirrorState = {
  relation: MirrorRelation;
  /** When `ahead`: the moves played offline that the online game does not have yet, in order. */
  offlineMoves: string[];
  save: StoredOfflineGame | null;
};

/** What the copy on this device looks like next to one committed online state. */
export function readOfflineMirrorState(
  hostedGameId: string,
  onlineHistory: string[],
  storage: Storage | null = browserOfflineStorage()
): OfflineMirrorState {
  const save = storage ? readStoredOfflineGame(mirrorOfflineGameId(hostedGameId), storage).save : null;
  const stored = storedHistoryOf(save);
  const relation = compareMoveHistories(stored, onlineHistory);
  return { relation, offlineMoves: relation === "ahead" ? stored.slice(onlineHistory.length) : [], save };
}

/**
 * Writes one committed hosted state into this game's offline copy. A no-op unless the setting is on
 * for `hostedGameId`, so hosted.ts can call it unconditionally on every committed state.
 *
 * Refreshes the copy ONLY from a state that is strictly ahead on the same history (`behind`), or
 * creates it when there is nothing stored yet. An `ahead` copy (moves were played offline) or a
 * `diverged` one is left exactly as it is and reported back, so the caller can upload those moves
 * (hosted.ts, via `planOfflineUpload`) instead of destroying them. `same` skips the write, which
 * also keeps an ordinary re-emit - a backgrounded tab resyncing, an invalid-move re-render - from
 * rewriting ~140 KB of localStorage for nothing.
 */
export function syncOfflineMirror(
  hostedGameId: string,
  gameName: string,
  engineData: unknown,
  seats: number[] = [],
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now()
): OfflineMirrorSyncResult {
  if (!storage || !isOfflineMirrorEnabled(hostedGameId, storage)) {
    return { save: null, error: null, skipped: true, relation: "none", offlineMoves: [] };
  }
  const moveHistory = (engineData as any)?.moveHistory;
  if (!Array.isArray(moveHistory)) {
    return {
      save: null,
      error: "That game state cannot be stored offline.",
      skipped: false,
      relation: "none",
      offlineMoves: [],
    };
  }

  const state = readOfflineMirrorState(hostedGameId, moveHistory, storage);
  const name = gameName.trim() || "Online game";
  const seatsChanged = state.save ? (state.save.mirrorSeats ?? []).join(",") !== seats.join(",") : true;
  if (state.relation === "ahead" || state.relation === "diverged") {
    return { save: state.save, error: null, skipped: true, relation: state.relation, offlineMoves: state.offlineMoves };
  }
  if (state.relation === "same" && state.save?.name === name && !seatsChanged) {
    return { save: state.save, error: null, skipped: true, relation: "same", offlineMoves: [] };
  }

  const result = upsertStoredOfflineGame(
    mirrorOfflineGameId(hostedGameId),
    engineData,
    name,
    { of: hostedGameId, seats },
    storage,
    now
  );
  return { save: result.save, error: result.error, skipped: false, relation: state.relation, offlineMoves: [] };
}

/**
 * Which seats offline play of `save` may act for, or `null` for "no lock, ordinary hot seat".
 *
 * The distinction between `null` and `[]` is deliberate: a record with no `mirrorSeats` at all is
 * either an ordinary pass-and-play game or a mirrored one written before seats were recorded, and
 * must keep its hot seat; an explicitly EMPTY list is a mirrored game this account holds no seat in
 * (a spectator's copy), which is readable but not playable - none of its moves could ever be
 * committed online. self-contained.ts feeds the result to the same `seatToLock` hosted play uses.
 */
export function offlineMirrorSeatLock(save: StoredOfflineGame | null | undefined): number[] | null {
  if (!save?.mirrorOf || !Array.isArray(save.mirrorSeats)) {
    return null;
  }
  return save.mirrorSeats;
}

export type OfflineUploadPlan = {
  /** The leading run of offline moves that can be sent to the online game, in order. */
  moves: string[];
  /** Why the run stopped, when it did not consume every offline move. */
  blocked: { move: string; seat: number | null; reason: "other-seat" | "rejected" } | null;
};

/**
 * Decides which moves played offline may be uploaded to the online game, by replaying them against
 * a throwaway copy of the online engine.
 *
 * Two hard limits, both of them the server's rules rather than ours: a seat this account does not
 * hold can never be committed for (`commit_turn` asserts seat ownership), and a move the engine
 * rejects from the current online state cannot be played at all. Either one stops the run - moves
 * after the blockage stay in the offline copy untouched rather than being force-fitted, since
 * replaying a Gaia turn out of order would produce a different game, not the intended one.
 *
 * Mirrored copies are seat-locked while playing offline (self-contained.ts reads `mirrorSeats`), so
 * in practice the run covers everything; the `other-seat` branch is the backstop for a record
 * written before that lock existed.
 */
export function planOfflineUpload(
  onlineEngineData: unknown,
  offlineMoves: string[],
  isMySeat: (seat: number) => boolean
): OfflineUploadPlan {
  const moves: string[] = [];
  let engine: Engine;
  try {
    engine = Engine.fromData(JSON.parse(JSON.stringify(onlineEngineData)));
    engine.generateAvailableCommandsIfNeeded();
  } catch {
    return { moves, blocked: offlineMoves.length ? { move: offlineMoves[0], seat: null, reason: "rejected" } : null };
  }

  for (const move of offlineMoves) {
    const seat = engine.playerToMove;
    if (seat === undefined || !isMySeat(seat)) {
      return { moves, blocked: { move, seat: seat ?? null, reason: "other-seat" } };
    }
    try {
      engine.move(move);
      engine.generateAvailableCommandsIfNeeded();
    } catch {
      return { moves, blocked: { move, seat, reason: "rejected" } };
    }
    // A line that doesn't finish its turn is a half-composed move, which the hosted commit rule
    // (host.ts's §J1/§A2 `newTurn` gate) would never accept - stop rather than send it.
    if (!engine.newTurn) {
      return { moves, blocked: { move, seat, reason: "rejected" } };
    }
    moves.push(move);
  }
  return { moves, blocked: null };
}
