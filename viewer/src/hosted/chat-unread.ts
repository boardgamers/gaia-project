// Unread tracking shared by the two chat panels (ChatNotesPanel.vue's per-game thread and
// LobbyChatPanel.vue's lobby room), kept here and pure for the same reason as chat-reads.ts: both
// panels need identical semantics, and neither should own the rules.
//
// The rules used to live in each panel as "the newest message is newer than the last time I opened
// this panel", which was wrong twice over - both of them visible to the owner as "writing in the
// chat lights up my own chat button":
//
//  1. It ignored WHO sent the message. `markRead()` only ran on open, so every message sent after
//     that - including your own, the one you just typed - counted as unread the moment you closed
//     the panel again.
//  2. It compared a server-issued `created_at` against a `Date.now()` read off this device, so a few
//     seconds of clock skew was enough to make an already-read thread look unread (or, the other
//     way, to swallow a genuinely new message).
//
// Tracking the highest message id seen instead fixes both: ids come from the same server as the
// messages themselves, and "did somebody ELSE send something after that id" is exactly the question
// the badge is asking. It also gives us a count rather than a yes/no, which is what the badge shows.

export interface UnreadChatMessage {
  id: number;
  user_id: string;
  created_at: string;
}

/** Counts above this are shown as "9+" - past a handful the exact number stops meaning anything and
 * the badge has to stay narrow enough to sit on a 3rem button. */
export const UNREAD_DISPLAY_MAX = 9;

/** Highest id in the thread, i.e. the read position "I have seen everything" corresponds to. Taken
 * as a max rather than "the last element" so it holds regardless of how a caller has ordered or
 * paged its list. */
export function newestMessageId(messages: UnreadChatMessage[]): number {
  return messages.reduce((highest, msg) => (msg.id > highest ? msg.id : highest), 0);
}

/** How many messages from OTHER people arrived after `lastSeenId`. My own messages are never
 * unread - I wrote them, and counting them is the bug this module exists to fix. */
export function unreadCount(messages: UnreadChatMessage[], lastSeenId: number, userId: string): number {
  return messages.filter((msg) => msg.id > lastSeenId && msg.user_id !== userId).length;
}

/** Badge text: the count, capped. */
export function formatUnreadCount(count: number): string {
  return count > UNREAD_DISPLAY_MAX ? `${UNREAD_DISPLAY_MAX}+` : String(count);
}

/** Spelled-out version for the button's own label and its accessible name. */
export function unreadSummary(count: number): string {
  return count === 1 ? "1 new message" : `${count} new messages`;
}

/**
 * Translates a pre-id-tracking receipt (a wall-clock "last read at" in ms) into the id it meant:
 * the newest message that already existed at that moment. Only used once per device, to carry the
 * old localStorage key over without re-flagging a whole thread as unread on the upgrade.
 */
export function lastSeenIdFromReadTime(messages: UnreadChatMessage[], readAtMs: number): number {
  if (!readAtMs || Number.isNaN(readAtMs)) {
    return 0;
  }
  return messages.reduce((highest, msg) => {
    const sentAt = new Date(msg.created_at).getTime();
    return !Number.isNaN(sentAt) && sentAt <= readAtMs && msg.id > highest ? msg.id : highest;
  }, 0);
}

/**
 * The stored read position for this thread, falling back to `legacyTimeKey`'s old timestamp receipt
 * when this device has never stored an id (see `lastSeenIdFromReadTime`). Read-only - `saveLastSeenId`
 * is what writes, and it writes the id key only, so the legacy key simply goes stale and stops
 * mattering.
 */
export function loadLastSeenId(idKey: string, legacyTimeKey: string, messages: UnreadChatMessage[]): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const storedId = window.localStorage.getItem(idKey);
  if (storedId !== null) {
    const parsed = Number(storedId);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const legacy = window.localStorage.getItem(legacyTimeKey);
  return legacy === null ? 0 : lastSeenIdFromReadTime(messages, Number(legacy));
}

/** Records a read position, never rewinding it - an out-of-order call (a stale panel closing after
 * a newer one already reported) must not resurrect a badge that was legitimately cleared. */
export function saveLastSeenId(idKey: string, id: number): void {
  if (typeof window === "undefined" || !id) {
    return;
  }
  const stored = Number(window.localStorage.getItem(idKey) ?? 0);
  const next = Number.isNaN(stored) ? id : Math.max(stored, id);
  window.localStorage.setItem(idKey, String(next));
}
