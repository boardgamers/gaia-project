/**
 * Mirroring a docked side panel's `open` state onto the page (hosted.ts's `#app.chat-notes-open` /
 * `#app.game-nav-open` width reservations, and HostedBar's show/hide labels).
 *
 * This exists because a bare `$watch("open", ...)` only ever fires on a CHANGE, and both panels
 * (ChatNotesPanel.vue, GameNavPanel.vue) restore their desktop open state from localStorage in
 * `data()` - so a panel that mounts ALREADY open never reported it, and nothing ever reserved its
 * width. What the owner saw: the board rendered at full window width under a docked panel, and had
 * to be fixed by closing and re-opening the panel by hand. It hit every fresh load with a panel
 * remembered open, and again on every in-app game switch, which re-mounts the chat panel per game
 * (mountGameInstance) while the stored preference stays open.
 *
 * So: register the watcher AND apply the current value once, in one call that cannot be
 * half-written. `apply` must therefore be idempotent - it is called with the same value more than
 * once (mount, then any later change back to it).
 */
export interface DockablePanel {
  open: boolean;
  $watch(expression: string, callback: (open: boolean) => void): () => void;
}

/** Returns the watcher's own unsubscribe, for the per-game cleanup lists in hosted.ts. */
export function syncPanelOpen(panel: DockablePanel, apply: (open: boolean) => void): () => void {
  const unwatch = panel.$watch("open", apply);
  apply(panel.open);
  return unwatch;
}
