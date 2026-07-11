/** Shared "time a chat message was sent" formatter for ChatNotesPanel.vue and LobbyChatPanel.vue -
 * bare time if sent today, "Jul 11, 3:42 PM" style otherwise. */
export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
