import Engine from "@gaia-project/engine";

export const OFFLINE_GAME_STORAGE_KEY = "gaia-offline-game-v1";
export const OFFLINE_GAME_SAVED_EVENT = "gaia-offline-game-saved";
export const OFFLINE_GAME_LIBRARY_KEY = "gaia-offline-games-v1";
export const OFFLINE_GAME_BACKUP_KIND = "gaia-project-offline-game";

const OFFLINE_GAME_SAVE_VERSION = 1;
const OFFLINE_GAME_BACKUP_VERSION = 1;
const OFFLINE_GAME_RECORD_PREFIX = "gaia-offline-game-v2:";
const LEGACY_OFFLINE_GAME_ID = "imported-offline-game";

export type OfflineGameSave = {
  version: 1;
  savedAt: string;
  /** The last fully committed engine state. */
  engineData: any;
  /** A turn that is still being composed in the viewer, if there is one. */
  pendingMove?: string;
};

export type OfflineGameReadResult = {
  save: OfflineGameSave | null;
  error: string | null;
};

export type OfflineGameWriteResult = {
  save: OfflineGameSave | null;
  error: string | null;
};

export type StoredOfflineGame = OfflineGameSave & {
  id: string;
  name: string;
  createdAt: string;
  /**
   * Set only on a record that is an automatically maintained copy of a hosted (online) game: the
   * online game's id (see hosted/offline-mirror.ts). Optional, so every record written before the
   * mirror existed - and every ordinary pass-and-play game - stays valid without a migration.
   */
  mirrorOf?: string;
  /**
   * The seats the mirroring account holds in that hosted game. Playing this copy offline produces
   * real turns that get uploaded when the connection is back, and only an owned seat can ever be
   * committed for - so self-contained.ts locks offline play to these seats instead of the usual
   * hot-seat freedom. Empty/absent means "no lock" (a pre-`mirrorSeats` record, or a spectator).
   */
  mirrorSeats?: number[];
};

export type OfflineGameBackup = {
  kind: typeof OFFLINE_GAME_BACKUP_KIND;
  version: 1;
  exportedAt: string;
  game: StoredOfflineGame;
};

export type OfflineGameLibraryResult = {
  games: StoredOfflineGame[];
  error: string | null;
};

export type StoredOfflineGameWriteResult = {
  save: StoredOfflineGame | null;
  error: string | null;
};

export type OfflineGameDeleteResult = {
  deleted: boolean;
  error: string | null;
};

export type OfflineGameListRow = {
  id: string;
  name: string;
  seed: string;
  player_count: number;
  options: Record<string, unknown>;
  status: "active" | "finished";
  current_seat: number | null;
  move_count: number;
  current_round: number | null;
  latest_move_summary: string | null;
  latest_move_committed_at: string;
  /** The online game this record mirrors, or null for an ordinary local game (see StoredOfflineGame). */
  mirror_of: string | null;
  players: Array<{
    seat: number;
    user_id: null;
    invited_email: string;
    display_name: string;
    faction: string | null;
    score: number | null;
  }>;
};

type OfflineGameIndex = {
  version: 1;
  gameIds: string[];
};

export type RestoredOfflineGame = {
  /** Stable baseline used when the next cumulative command is submitted. */
  engine: Engine;
  /** State shown in the UI, including a partially composed turn when present. */
  displayEngine: Engine;
  pendingMove: string;
  warning: string | null;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isOfflineGameMode(search = ""): boolean {
  return new URLSearchParams(search).has("offline");
}

export function offlineGameIdFromSearch(search = ""): string | null {
  return new URLSearchParams(search).get("game");
}

export function browserOfflineStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

function isOfflineGameSave(value: any): value is OfflineGameSave {
  return (
    value?.version === OFFLINE_GAME_SAVE_VERSION &&
    typeof value.savedAt === "string" &&
    value.engineData != null &&
    Array.isArray(value.engineData.moveHistory) &&
    (value.pendingMove === undefined || typeof value.pendingMove === "string")
  );
}

function isStoredOfflineGame(value: any): value is StoredOfflineGame {
  return (
    isOfflineGameSave(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string"
  );
}

function isOfflineGameIndex(value: any): value is OfflineGameIndex {
  return (
    value?.version === 1 && Array.isArray(value.gameIds) && value.gameIds.every((id: unknown) => typeof id === "string")
  );
}

function validOfflineGameId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/i.test(id);
}

function offlineGameRecordKey(id: string): string {
  return `${OFFLINE_GAME_RECORD_PREFIX}${id}`;
}

function makeOfflineGameId(now: number): string {
  return `offline-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function serializeOfflineGame(engine: Engine, pendingMove: string, now: number): OfflineGameSave {
  return {
    version: OFFLINE_GAME_SAVE_VERSION,
    savedAt: new Date(now).toISOString(),
    engineData: JSON.parse(JSON.stringify(engine)),
    ...(pendingMove ? { pendingMove } : {}),
  };
}

/** A portable, versioned file format for moving a local game between browsers or devices. */
export function serializeOfflineGameBackup(game: StoredOfflineGame, now = Date.now()): string {
  const backup: OfflineGameBackup = {
    kind: OFFLINE_GAME_BACKUP_KIND,
    version: OFFLINE_GAME_BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    game: JSON.parse(JSON.stringify(game)),
  };
  return JSON.stringify(backup, null, 2);
}

export function readOfflineGame(storage: Storage | null = browserOfflineStorage()): OfflineGameReadResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }

  try {
    const raw = storage.getItem(OFFLINE_GAME_STORAGE_KEY);
    if (!raw) {
      return { save: null, error: null };
    }
    const parsed = JSON.parse(raw);
    if (!isOfflineGameSave(parsed)) {
      return { save: null, error: "The saved offline game has an unsupported format." };
    }
    return { save: parsed, error: null };
  } catch (error) {
    return { save: null, error: `The saved offline game could not be read: ${errorMessage(error)}` };
  }
}

function ensureOfflineGameIndex(storage: Storage): { index: OfflineGameIndex | null; error: string | null } {
  try {
    const raw = storage.getItem(OFFLINE_GAME_LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!isOfflineGameIndex(parsed)) {
        return { index: null, error: "The offline game library has an unsupported format." };
      }
      return { index: parsed, error: null };
    }

    const index: OfflineGameIndex = { version: 1, gameIds: [] };
    const legacy = readOfflineGame(storage);
    if (legacy.save) {
      const imported: StoredOfflineGame = {
        ...legacy.save,
        id: LEGACY_OFFLINE_GAME_ID,
        name: "Imported offline game",
        createdAt: legacy.save.savedAt,
      };
      storage.setItem(offlineGameRecordKey(imported.id), JSON.stringify(imported));
      index.gameIds.push(imported.id);
    }
    storage.setItem(OFFLINE_GAME_LIBRARY_KEY, JSON.stringify(index));
    return { index, error: legacy.error };
  } catch (error) {
    return { index: null, error: `The offline game library could not be read: ${errorMessage(error)}` };
  }
}

export function readStoredOfflineGame(
  gameId: string,
  storage: Storage | null = browserOfflineStorage()
): { save: StoredOfflineGame | null; error: string | null } {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }
  if (!validOfflineGameId(gameId)) {
    return { save: null, error: "The offline game id is invalid." };
  }
  try {
    const raw = storage.getItem(offlineGameRecordKey(gameId));
    if (!raw) {
      return { save: null, error: "That offline game is not stored on this device." };
    }
    const parsed = JSON.parse(raw);
    if (!isStoredOfflineGame(parsed) || parsed.id !== gameId) {
      return { save: null, error: "The saved offline game has an unsupported format." };
    }
    return { save: parsed, error: null };
  } catch (error) {
    return { save: null, error: `The saved offline game could not be read: ${errorMessage(error)}` };
  }
}

export function listOfflineGames(storage: Storage | null = browserOfflineStorage()): OfflineGameLibraryResult {
  if (!storage) {
    return { games: [], error: "Local storage is unavailable in this browser." };
  }
  const library = ensureOfflineGameIndex(storage);
  if (!library.index) {
    return { games: [], error: library.error };
  }

  const games: StoredOfflineGame[] = [];
  const warnings = library.error ? [library.error] : [];
  for (const gameId of library.index.gameIds) {
    const stored = readStoredOfflineGame(gameId, storage);
    if (stored.save) {
      games.push(stored.save);
    } else if (stored.error) {
      warnings.push(stored.error);
    }
  }
  games.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return { games, error: warnings.length ? warnings.join(" ") : null };
}

/**
 * The engine keeps no top-level `seed` field, and `SpaceMap.toJSON()` deliberately drops its own
 * runtime `.seed` too (see engine.ts's `lostFleetTerraformingRow` comment - recomputing a serialized
 * map's seed lazily broke §J3 determinism once already) - the only place a seed survives a
 * `JSON.stringify` round trip is as plain text in the stored "init <players> <seed>" line itself
 * (moveHistory[0], never replayed again once restored via Engine.fromData).
 */
function seedFromInitLine(initLine: unknown): string {
  const parts = String(initLine ?? "").split(/\s+/);
  return parts.length > 2 ? parts.slice(2).join(" ") : "";
}

/* Hosted GameBar intentionally consumes database-shaped snake_case fields. */
/* eslint-disable @typescript-eslint/camelcase */
export function offlineGameListRow(game: StoredOfflineGame): OfflineGameListRow {
  const data = game.engineData ?? {};
  const players = Array.isArray(data.players) ? data.players : [];
  const history = Array.isArray(data.moveHistory) ? data.moveHistory : [];
  const lastMove = history.length > 1 ? String(history[history.length - 1]).replace(/\.$/, "") : null;
  return {
    id: game.id,
    name: game.name,
    seed: seedFromInitLine(history[0]),
    player_count: players.length,
    options: data.options ?? {},
    status: data.ended || data.phase === "endGame" ? "finished" : "active",
    current_seat: Number.isInteger(data.currentPlayer) ? data.currentPlayer : null,
    move_count: history.length,
    current_round: Number.isInteger(data.round) && data.round > 0 ? data.round : null,
    latest_move_summary: lastMove,
    latest_move_committed_at: game.savedAt,
    mirror_of: game.mirrorOf ?? null,
    players: players.map((player: any, seat: number) => ({
      seat,
      user_id: null,
      invited_email: "",
      display_name: `Player ${seat + 1}`,
      faction: player?.faction ?? null,
      score: Number.isFinite(player?.data?.victoryPoints) ? player.data.victoryPoints : null,
    })),
  };
}
/* eslint-enable @typescript-eslint/camelcase */

export function createStoredOfflineGame(
  engine: Engine,
  name: string,
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now(),
  gameId = makeOfflineGameId(now)
): StoredOfflineGameWriteResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }
  if (!validOfflineGameId(gameId)) {
    return { save: null, error: "The offline game id is invalid." };
  }

  const library = ensureOfflineGameIndex(storage);
  if (!library.index) {
    return { save: null, error: library.error };
  }
  if (library.index.gameIds.includes(gameId)) {
    return { save: null, error: "An offline game with that id already exists." };
  }

  const state = serializeOfflineGame(engine, "", now);
  const save: StoredOfflineGame = {
    ...state,
    id: gameId,
    name: name.trim() || "Offline game",
    createdAt: state.savedAt,
  };
  try {
    storage.setItem(offlineGameRecordKey(gameId), JSON.stringify(save));
    const nextIndex: OfflineGameIndex = { ...library.index, gameIds: [gameId, ...library.index.gameIds] };
    storage.setItem(OFFLINE_GAME_LIBRARY_KEY, JSON.stringify(nextIndex));
    return { save, error: library.error };
  } catch (error) {
    try {
      storage.removeItem(offlineGameRecordKey(gameId));
    } catch (_rollbackError) {
      // The index was not updated, so an unlisted record is harmless even if rollback is blocked.
    }
    return { save: null, error: `The offline game could not be created: ${errorMessage(error)}` };
  }
}

export function writeStoredOfflineGame(
  gameId: string,
  engine: Engine,
  pendingMove = "",
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now()
): StoredOfflineGameWriteResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }
  const current = readStoredOfflineGame(gameId, storage);
  if (!current.save) {
    return { save: null, error: current.error };
  }

  const save: StoredOfflineGame = {
    ...current.save,
    ...serializeOfflineGame(engine, pendingMove, now),
  };
  try {
    storage.setItem(offlineGameRecordKey(gameId), JSON.stringify(save));
    return { save, error: null };
  } catch (error) {
    return { save: null, error: `The offline game could not be saved: ${errorMessage(error)}` };
  }
}

/**
 * Creates the record when this id is new and overwrites it in place (keeping the original
 * `createdAt`) when it already exists - unlike `createStoredOfflineGame`, which refuses a duplicate
 * id, and `writeStoredOfflineGame`, which refuses a missing one. The hosted->offline mirror
 * (hosted/offline-mirror.ts) derives its id from the online game's id rather than minting one per
 * save, so the same call has to serve both the very first sync and every later one.
 *
 * Takes already-serialized engine data rather than an `Engine`: the hosted host hands its state out
 * as plain JSON (host.ts's `emitState`), and re-hydrating an Engine only to serialize it straight
 * back again would be pure waste. Any half-composed `pendingMove` on an existing record is dropped
 * along with the state it belonged to - the incoming data is a complete, committed game.
 */
export function upsertStoredOfflineGame(
  gameId: string,
  engineData: unknown,
  name: string,
  mirror: { of: string; seats?: number[] } | null = null,
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now()
): StoredOfflineGameWriteResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }
  if (!validOfflineGameId(gameId)) {
    return { save: null, error: "The offline game id is invalid." };
  }
  if (!Array.isArray((engineData as any)?.moveHistory)) {
    return { save: null, error: "That game state cannot be stored offline." };
  }

  const library = ensureOfflineGameIndex(storage);
  if (!library.index) {
    return { save: null, error: library.error };
  }

  const existing = readStoredOfflineGame(gameId, storage);
  const savedAt = new Date(now).toISOString();
  const save: StoredOfflineGame = {
    version: OFFLINE_GAME_SAVE_VERSION,
    savedAt,
    engineData: JSON.parse(JSON.stringify(engineData)),
    id: gameId,
    name: name.trim() || existing.save?.name || "Offline game",
    createdAt: existing.save?.createdAt ?? savedAt,
    ...(mirror ? { mirrorOf: mirror.of, mirrorSeats: mirror.seats ?? [] } : {}),
  };

  const listed = library.index.gameIds.includes(gameId);
  try {
    storage.setItem(offlineGameRecordKey(gameId), JSON.stringify(save));
    if (!listed) {
      const nextIndex: OfflineGameIndex = { ...library.index, gameIds: [gameId, ...library.index.gameIds] };
      storage.setItem(OFFLINE_GAME_LIBRARY_KEY, JSON.stringify(nextIndex));
    }
    return { save, error: library.error };
  } catch (error) {
    if (!listed) {
      try {
        storage.removeItem(offlineGameRecordKey(gameId));
      } catch (_rollbackError) {
        // The index was not updated, so an unlisted record is harmless even if rollback is blocked.
      }
    }
    return { save: null, error: `The offline game could not be saved: ${errorMessage(error)}` };
  }
}

export function deleteStoredOfflineGame(
  gameId: string,
  storage: Storage | null = browserOfflineStorage()
): OfflineGameDeleteResult {
  if (!storage) {
    return { deleted: false, error: "Local storage is unavailable in this browser." };
  }
  const library = ensureOfflineGameIndex(storage);
  if (!library.index) {
    return { deleted: false, error: library.error };
  }
  if (!library.index.gameIds.includes(gameId)) {
    return { deleted: false, error: "That offline game is not stored on this device." };
  }

  try {
    const nextIndex: OfflineGameIndex = {
      ...library.index,
      gameIds: library.index.gameIds.filter((id) => id !== gameId),
    };
    storage.setItem(OFFLINE_GAME_LIBRARY_KEY, JSON.stringify(nextIndex));
    storage.removeItem(offlineGameRecordKey(gameId));
    return { deleted: true, error: null };
  } catch (error) {
    return { deleted: false, error: `The offline game could not be deleted: ${errorMessage(error)}` };
  }
}

/**
 * Synchronously writes one small, atomic localStorage record. A finished Gaia game is currently
 * about 140 KB, comfortably below normal browser quotas; synchronous storage is intentional here
 * so closing the tab immediately after a move cannot race an asynchronous write.
 */
export function writeOfflineGame(
  engine: Engine,
  pendingMove = "",
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now()
): OfflineGameWriteResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }

  try {
    const save = serializeOfflineGame(engine, pendingMove, now);
    storage.setItem(OFFLINE_GAME_STORAGE_KEY, JSON.stringify(save));
    return { save, error: null };
  } catch (error) {
    return { save: null, error: `The offline game could not be saved: ${errorMessage(error)}` };
  }
}

export function clearOfflineGame(storage: Storage | null = browserOfflineStorage()): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.removeItem(OFFLINE_GAME_STORAGE_KEY);
    return true;
  } catch (_error) {
    return false;
  }
}

export function restoreOfflineGame(save: OfflineGameSave): RestoredOfflineGame {
  let engine = Engine.fromData(JSON.parse(JSON.stringify(save.engineData)));
  engine.generateAvailableCommandsIfNeeded();

  const pendingMove = save.pendingMove ?? "";
  if (!pendingMove) {
    return { engine, displayEngine: engine, pendingMove: "", warning: null };
  }

  try {
    const displayEngine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    displayEngine.move(pendingMove);
    displayEngine.generateAvailableCommandsIfNeeded();

    // A pending command should not normally finish a turn (finished turns are saved in engineData),
    // but adopting it is safer if a newer engine version now resolves that command immediately.
    if (displayEngine.newTurn) {
      engine = displayEngine;
      return {
        engine,
        displayEngine,
        pendingMove: "",
        warning: "A previously unfinished move was completed while restoring the game.",
      };
    }

    return { engine, displayEngine, pendingMove, warning: null };
  } catch (error) {
    return {
      engine,
      displayEngine: engine,
      pendingMove: "",
      warning: `The last unfinished move could not be restored and was discarded: ${errorMessage(error)}`,
    };
  }
}

/**
 * Imports both the versioned backup format and the raw engine JSON produced by the older in-game
 * Export dialog. Every import receives a new id, so restoring a backup can never overwrite the
 * source game already on this device.
 */
export function importOfflineGameBackup(
  raw: string,
  fallbackName = "Imported backup",
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now(),
  gameId = makeOfflineGameId(now)
): StoredOfflineGameWriteResult {
  if (!storage) {
    return { save: null, error: "Local storage is unavailable in this browser." };
  }
  if (!validOfflineGameId(gameId)) {
    return { save: null, error: "The offline game id is invalid." };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    return { save: null, error: "That backup is not valid JSON." };
  }

  let source: OfflineGameSave;
  let name = fallbackName;
  let createdAt = new Date(now).toISOString();
  if (parsed?.kind === OFFLINE_GAME_BACKUP_KIND) {
    if (parsed.version !== OFFLINE_GAME_BACKUP_VERSION || !isStoredOfflineGame(parsed.game)) {
      return { save: null, error: "That offline backup uses an unsupported format." };
    }
    source = parsed.game;
    name = parsed.game.name;
    createdAt = parsed.game.createdAt;
  } else if (isStoredOfflineGame(parsed)) {
    source = parsed;
    name = parsed.name;
    createdAt = parsed.createdAt;
  } else if (isOfflineGameSave(parsed)) {
    source = parsed;
  } else if (parsed && Array.isArray(parsed.moveHistory)) {
    source = {
      version: OFFLINE_GAME_SAVE_VERSION,
      savedAt: new Date(now).toISOString(),
      engineData: parsed,
    };
  } else {
    return { save: null, error: "That file does not contain a supported offline game backup." };
  }

  let restored: RestoredOfflineGame;
  try {
    restored = restoreOfflineGame(source);
  } catch (error) {
    return { save: null, error: `That backup could not be restored: ${errorMessage(error)}` };
  }

  const library = ensureOfflineGameIndex(storage);
  if (!library.index) {
    return { save: null, error: library.error };
  }
  if (library.index.gameIds.includes(gameId)) {
    return { save: null, error: "An offline game with that id already exists." };
  }

  const importedAt = new Date(now).toISOString();
  const save: StoredOfflineGame = {
    version: OFFLINE_GAME_SAVE_VERSION,
    id: gameId,
    name: name.trim() || "Imported backup",
    createdAt,
    savedAt: importedAt,
    engineData: JSON.parse(JSON.stringify(restored.engine)),
    ...(restored.pendingMove ? { pendingMove: restored.pendingMove } : {}),
  };

  try {
    storage.setItem(offlineGameRecordKey(gameId), JSON.stringify(save));
    const nextIndex: OfflineGameIndex = { ...library.index, gameIds: [gameId, ...library.index.gameIds] };
    storage.setItem(OFFLINE_GAME_LIBRARY_KEY, JSON.stringify(nextIndex));
    return { save, error: library.error };
  } catch (error) {
    try {
      storage.removeItem(offlineGameRecordKey(gameId));
    } catch (_rollbackError) {
      // The index was not updated, so an unlisted record is harmless even if rollback is blocked.
    }
    return { save: null, error: `The offline backup could not be imported: ${errorMessage(error)}` };
  }
}

export function announceOfflineGameSave(result: OfflineGameWriteResult): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(OFFLINE_GAME_SAVED_EVENT, {
      detail: {
        savedAt: result.save?.savedAt ?? null,
        error: result.error,
      },
    })
  );
}

/** Best-effort protection against automatic storage eviction; unsupported browsers simply ignore it. */
export async function requestPersistentOfflineStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return null;
  }
  try {
    return await navigator.storage.persist();
  } catch (_error) {
    return null;
  }
}
