/**
 * Which "Since your last turn" recap lines this device has already shown the player
 * (OpponentMovesNotice.vue). Extend THIS module, not the notice component, for anything
 * seen/unseen-shaped - the same split chat-unread.ts and chat-reads.ts already use.
 *
 * The recap used to be all-or-nothing: one dismissal signature per own-turn cycle, so dismissing it
 * hid every opponent move until this seat played again - including moves that arrived AFTER the
 * dismissal, which were then never recapped at all. What is remembered here instead is how far
 * through the move history the player has read, so re-opening the same game shows nothing at all
 * while a genuinely new opponent turn still gets its own line.
 *
 * localStorage only, per game + seat, exactly like analysis.ts's own storage: a read receipt is a
 * "this browser has shown me that" fact, not game state, and the database has no business holding
 * it. The trade-off is that it does not follow the player between devices.
 */

/** How far a seat has read the recap. */
export type SeenRecap = {
  /** The `moveHistory` index of the last recap line the player dismissed. */
  through: number;
  /** The move string that sat at `through` when it was dismissed. Move indices are only meaningful
   * against the history they were taken from, and a history CAN be rewritten under a live client -
   * a game reset (see CLAUDE.md's `Amber Drift` rollback) rewinds `moves` for everyone - so the mark
   * carries the move it refers to and is discarded outright when the two stop matching. Showing a
   * recap twice is a nuisance; hiding a move that was never read is a lost turn. */
  move: string;
};

/** Every seat this device has a mark for, keyed by seat index (a self-contained/hot-seat game plays
 * more than one seat from the same browser, and each reads its own recap). */
export type SeenRecaps = Record<string, SeenRecap>;

// Same convention as analysis.ts's storageKey(): a hosted game's `?game=<id>` and a self-contained
// game's full launch query string both already uniquely identify "this game".
function gameKey(): string {
  return typeof window !== "undefined" ? window.location.search : "";
}

function seenStorageKey(): string {
  return `opponent-moves-notice-seen:${gameKey()}`;
}

/** The key the all-or-nothing dismissal used before this module existed - read once, to adopt a
 * recap the player had already dismissed under that build (see `legacyDismissalSignature`). */
function legacyStorageKey(): string {
  return `opponent-moves-notice-dismissed:${gameKey()}`;
}

/** The signature that build stored: the seat plus the `moveHistory` index of its own last turn. */
export function legacyDismissalSignature(seat: number | undefined, ownTurnIndex: number): string {
  return `${seat ?? "none"}:${ownTurnIndex}`;
}

export function loadSeenRecaps(): SeenRecaps {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(seenStorageKey()) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as SeenRecaps) : {};
  } catch {
    // Storage can throw (private browsing), and a hand-edited or half-written value can fail to
    // parse. Either way the honest answer is "nothing has been read yet".
    return {};
  }
}

/** Persists one seat's mark, leaving any other seat's alone (read-modify-write rather than
 * overwriting the record, since a hot-seat game's seats are updated independently). */
export function storeSeenRecap(seat: number, recap: SeenRecap): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const recaps = loadSeenRecaps();
    recaps[String(seat)] = recap;
    window.localStorage.setItem(seenStorageKey(), JSON.stringify(recaps));
  } catch {
    // Losing persistence here means a dismissal might not survive a reload, not a functional break.
  }
}

export function loadLegacyDismissal(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.localStorage.getItem(legacyStorageKey()) ?? "";
  } catch {
    return "";
  }
}

export function clearLegacyDismissal(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(legacyStorageKey());
  } catch {
    // See storeSeenRecap - a failed write is not worth surfacing.
  }
}

/**
 * The recap lines the player has not read yet: everything after `seen.through`, or all of them when
 * there is no usable mark. `moveHistory` is what the mark is validated against - see `SeenRecap.move`
 * for why a mark that no longer matches the history is dropped rather than trusted.
 */
export function unseenRecapLines<T extends { index: number }>(
  lines: T[],
  seen: SeenRecap | null | undefined,
  moveHistory: string[]
): T[] {
  if (!seen || moveHistory[seen.through] !== seen.move) {
    return lines;
  }
  return lines.filter((line) => line.index > seen.through);
}
