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
 * Deliberately one-directional: the online game is authoritative. Moves played locally in the
 * copy are NOT pushed back to the online game, and are replaced the next time this browser syncs
 * a newer online state - `OfflineLobby.vue` says so on the row itself. (Going the other way is
 * already a separate, explicit, one-shot flow: hosted/import-offline-game.ts's "Move online".)
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
  /** True when there was deliberately nothing to write (setting off, or state already stored). */
  skipped: boolean;
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

/**
 * Cheap "nothing changed since the last sync" test, so an ordinary state re-emit (a resync after a
 * backgrounded tab wakes up, an invalid-move re-render, the re-lock emit right after load) doesn't
 * rewrite ~140 KB of localStorage for nothing. A committed history only ever grows, and its last
 * line is the turn that was just added, so comparing length + last line + name is enough to tell a
 * genuine new turn from a repeat of the state already on disk.
 */
function alreadyStored(stored: StoredOfflineGame | null, moveHistory: string[], name: string): boolean {
  if (!stored || stored.name !== name) {
    return false;
  }
  const storedHistory: string[] = Array.isArray(stored.engineData?.moveHistory) ? stored.engineData.moveHistory : [];
  return (
    storedHistory.length === moveHistory.length &&
    storedHistory[storedHistory.length - 1] === moveHistory[moveHistory.length - 1]
  );
}

/**
 * Writes one committed hosted state into this game's offline copy. A no-op unless the setting is on
 * for `hostedGameId`, so hosted.ts can call it unconditionally on every committed state.
 */
export function syncOfflineMirror(
  hostedGameId: string,
  gameName: string,
  engineData: unknown,
  storage: Storage | null = browserOfflineStorage(),
  now = Date.now()
): OfflineMirrorSyncResult {
  if (!storage || !isOfflineMirrorEnabled(hostedGameId, storage)) {
    return { save: null, error: null, skipped: true };
  }
  const moveHistory = (engineData as any)?.moveHistory;
  if (!Array.isArray(moveHistory)) {
    return { save: null, error: "That game state cannot be stored offline.", skipped: false };
  }

  const offlineGameId = mirrorOfflineGameId(hostedGameId);
  const name = gameName.trim() || "Online game";
  const existing = readStoredOfflineGame(offlineGameId, storage);
  if (alreadyStored(existing.save, moveHistory, name)) {
    return { save: existing.save, error: null, skipped: true };
  }

  const result = upsertStoredOfflineGame(offlineGameId, engineData, name, hostedGameId, storage, now);
  return { save: result.save, error: result.error, skipped: false };
}
