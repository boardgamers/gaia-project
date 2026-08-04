import { SupabaseClient } from "./supabase-client";

// Chat read receipts ("read checks", 2026-08-04): who has read the thread so far, and how far each
// person got. Shared by both chats - the per-game one (ChatNotesPanel.vue, `game_chat_reads`) and
// the global lobby one (LobbyChatPanel.vue, `lobby_chat_reads`) - since the only real difference is
// the game_id scoping; see 20260804202928_chat_read_receipts.sql for the schema and the two
// security-definer RPCs that are the sole write path.

/** One reader's position in a thread: the newest message id they have seen. */
export interface ChatReadReceipt {
  user_id: string;
  reader_name: string;
  last_read_message_id: number;
  last_read_at: string;
}

/** A receipt resolved for display against a concrete message. */
export interface ChatReader {
  userId: string;
  name: string;
  initials: string;
  readAt: string;
}

/** Up to two letters, from the first two words of a name ("Luke Skywalker" -> "LS", "luke" -> "LU").
 * Falls back to "?" for an empty/whitespace-only name so a chip is never blank. */
export function readerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Buckets receipts under the message each reader stopped at, Messenger-style: `result[messageId]`
 * is everyone whose read position lands on that message.
 *
 * A receipt is attached to the newest *loaded* message with an id at or below its
 * `last_read_message_id`, rather than requiring an exact id match. That matters because a panel only
 * ever holds a window of the thread (LobbyChatPanel pages 200 at a time, ChatNotesPanel caps at 500)
 * and because a reader's exact message may not be in this client's list at all yet: without the
 * fallback, a reader who is fully caught up would silently vanish from the UI whenever their exact
 * message scrolled out of the window. Receipts older than the whole loaded window have no message to
 * attach to and are dropped.
 *
 * `selfUserId` is excluded - "you have read this" is noise on your own screen.
 */
export function readersByMessage(
  receipts: ChatReadReceipt[],
  messageIds: number[],
  selfUserId: string
): Record<number, ChatReader[]> {
  const ascending = [...messageIds].sort((a, b) => a - b);
  const grouped: Record<number, ChatReader[]> = {};
  for (const receipt of receipts) {
    if (!receipt || receipt.user_id === selfUserId) {
      continue;
    }
    let anchor: number | null = null;
    for (const id of ascending) {
      if (id <= receipt.last_read_message_id) {
        anchor = id;
      } else {
        break;
      }
    }
    if (anchor === null) {
      continue;
    }
    const name = receipt.reader_name?.trim() || "Player";
    if (!grouped[anchor]) {
      grouped[anchor] = [];
    }
    grouped[anchor].push({
      userId: receipt.user_id,
      name,
      initials: readerInitials(name),
      readAt: receipt.last_read_at,
    });
  }
  for (const readers of Object.values(grouped)) {
    readers.sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

/** Loads every receipt for a per-game chat thread. */
export async function loadGameChatReads(client: SupabaseClient, gameId: string): Promise<ChatReadReceipt[]> {
  const { data, error } = await (client as any).from("game_chat_reads").select("*").eq("game_id", gameId);
  return error || !data ? [] : (data as ChatReadReceipt[]);
}

/** Loads every receipt for the global lobby chat. */
export async function loadLobbyChatReads(client: SupabaseClient): Promise<ChatReadReceipt[]> {
  const { data, error } = await (client as any).from("lobby_chat_reads").select("*");
  return error || !data ? [] : (data as ChatReadReceipt[]);
}

/** Records "I have read up to `messageId`" for a per-game chat. The RPC never moves a receipt
 * backwards, so calling this with a stale id from a second device is harmless. */
export async function markGameChatRead(
  client: SupabaseClient,
  gameId: string,
  messageId: number,
  readerName: string
): Promise<void> {
  await (client as any).rpc("mark_game_chat_read", {
    p_game_id: gameId,
    p_message_id: messageId,
    p_reader_name: readerName,
  });
}

/** Records "I have read up to `messageId`" for the global lobby chat. */
export async function markLobbyChatRead(client: SupabaseClient, messageId: number, readerName: string): Promise<void> {
  await (client as any).rpc("mark_lobby_chat_read", { p_message_id: messageId, p_reader_name: readerName });
}

/** Applies a realtime INSERT/UPDATE payload to a receipt list, replacing that reader's row. Returns
 * a new array (Vue 2 reactivity: assign it, don't mutate in place). */
export function applyReceipt(receipts: ChatReadReceipt[], incoming: ChatReadReceipt): ChatReadReceipt[] {
  const rest = receipts.filter((r) => r.user_id !== incoming.user_id);
  return [...rest, incoming];
}

/** "Read by Luke and Leia" style summary of everyone who has reached the thread's newest message -
 * the one-line answer to "who has read the thread so far". Empty string if nobody else has. */
export function readSummary(readers: ChatReader[]): string {
  if (readers.length === 0) {
    return "";
  }
  const names = readers.map((r) => r.name);
  if (names.length === 1) {
    return `Read by ${names[0]}`;
  }
  return `Read by ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
