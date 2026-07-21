<template>
  <div class="chat-notes gaia-viewer-game">
    <button
      v-if="!isDesktop"
      type="button"
      class="chat-notes__toggle"
      :class="{ 'chat-notes__toggle--unread': hasUnread }"
      :style="{ bottom: toggleBottomOffset + 'px' }"
      @click="openPanel(tab)"
      :aria-label="open ? 'Close chat and notes' : 'Open chat and notes'"
    >
      <span aria-hidden="true">&#128172;</span>
      <span v-if="hasUnread" class="chat-notes__badge"></span>
    </button>

    <div v-if="open" class="chat-notes__panel">
      <div class="chat-notes__header">
        <button type="button" class="chat-notes__back" @click="closePanel" aria-label="Back to game">&larr;</button>
        <div class="chat-notes__tabs">
          <button
            type="button"
            class="chat-notes__tab"
            :class="{ 'chat-notes__tab--active': tab === 'chat' }"
            @click="switchTab('chat')"
          >
            Chat
          </button>
          <button
            type="button"
            class="chat-notes__tab"
            :class="{ 'chat-notes__tab--active': tab === 'notes' }"
            @click="switchTab('notes')"
          >
            Notes
          </button>
        </div>
        <button type="button" class="chat-notes__close" @click="closePanel" aria-label="Close">&times;</button>
      </div>

      <div v-if="tab === 'chat'" class="chat-notes__chat">
        <div class="chat-notes__chat-toolbar">
          <button type="button" class="chat-notes__mute-toggle" @click="toggleMute">
            {{ muted ? "🔕 Muted - not receiving push notifications" : "🔔 Receiving push notifications" }}
          </button>
        </div>
        <div class="chat-notes__messages" ref="messageList">
          <p v-if="messages.length === 0" class="chat-notes__empty text-muted">No messages yet - say hello.</p>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="chat-notes__message"
            :class="{ 'chat-notes__message--own': msg.user_id === userId }"
          >
            <span class="chat-notes__meta">
              <span
                class="chat-notes__presence"
                :class="`chat-notes__presence--${isOnline(msg.user_id) ? 'online' : 'offline'}`"
              ></span>
              <span class="chat-notes__author">{{ msg.author_name }}</span>
              <span class="chat-notes__time">{{ formatTime(msg.created_at) }}</span>
            </span>
            <span class="chat-notes__body">{{ msg.body }}</span>
          </div>
        </div>
        <form class="chat-notes__composer" @submit.prevent="sendMessage">
          <textarea
            v-model="draft"
            rows="1"
            placeholder="Message this game's chat..."
            @keydown.enter.exact.prevent="sendMessage"
          ></textarea>
          <button type="submit" :disabled="!draft.trim()">Send</button>
        </form>
      </div>

      <div v-else class="chat-notes__notes">
        <textarea
          v-model="notesBody"
          class="chat-notes__notes-textarea"
          placeholder="Private notes for this game - only you can see these."
          @input="scheduleSaveNotes"
        ></textarea>
        <span class="chat-notes__notes-status text-muted small">{{ notesStatus }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { fetchMyNickname } from "./profile";
import { isOnline as isUserOnline, PresenceState } from "./presence";
import { formatChatTime } from "./chat-time";
import { isDesktopViewport, watchDesktopViewport } from "./viewport";

interface ChatMessage {
  id: number;
  game_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

type Tab = "chat" | "notes";

const NOTES_SAVE_DEBOUNCE_MS = 1500;

const OPEN_PREF_KEY = "chat-notes-panel-open";

// Desktop-only preference, mirroring GameNavPanel.vue's own (see its doc comment) - mobile never
// reads or writes this, it always starts closed behind the floating bubble.
function loadOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const stored = window.localStorage.getItem(OPEN_PREF_KEY);
  return stored === null ? true : stored === "1";
}

function saveOpenPreference(open: boolean): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OPEN_PREF_KEY, open ? "1" : "0");
  }
}

/** Per-game chat (visible to every approved user, players and spectators alike) plus private,
 * per-user notes - a floating toggle that opens a collapsible side panel on desktop or a
 * full-screen overlay on mobile (see the scoped media queries below), matching the owner's brief.
 *
 * Desktop and mobile are genuinely different UIs, not just a CSS reflow (see GameNavPanel.vue's
 * doc comment for the same split on the opposite edge): on desktop this panel is docked and
 * defaults open, toggled from HostedBar.vue's settings menu (`toggleOpen`, called externally via
 * the mounted instance); on mobile there is no settings entry at all, only the floating bubble
 * toggle below, and it always starts closed. `isDesktop` re-evaluates on every breakpoint
 * crossing via `watchDesktopViewport`. */
export default Vue.extend({
  name: "ChatNotesPanel",
  props: {
    client: { type: Object, required: true },
    gameId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  data() {
    const isDesktop = isDesktopViewport();
    return {
      isDesktop,
      open: isDesktop && loadOpenPreference(),
      tab: "chat" as Tab,
      messages: [] as ChatMessage[],
      draft: "",
      authorName: "Player",
      notesBody: "",
      notesStatus: "",
      muted: false,
      unreadSince: 0,
      // Set directly from outside (hosted.ts, via emitter.store.watch) rather than tracked here -
      // this game already tracks its own presence (hosted.ts's own `trackPresence(..., {type:
      // "game", gameId}, ...)` call feeds the shared Vuex store's `state.presence`), so reading
      // that directly avoids opening yet another Realtime Presence channel (see LobbyChatPanel's
      // own history of exactly that bug, PROGRESS.md).
      presenceState: {} as PresenceState,
      // Dynamic clearance for the floating toggle above the mobile sticky action/premove bar
      // (Commands.vue/PremoveBar.vue) - its height varies (content, auto-leech dropdown open,
      // etc.), so a fixed offset previously either overlapped it or left an ugly fixed gap on
      // desktop where no such bar exists at all. Measured directly off the live DOM element
      // instead of guessing, since ChatNotesPanel is a separate Vue root and can't receive
      // Commands.vue's own `sticky-bar-height` event (that only reaches Game.vue's tree).
      toggleBottomOffset: 24,
      stickyBarObserver: null as ResizeObserver | null,
      stickyBarPoll: null as ReturnType<typeof setInterval> | null,
      channel: null as any,
      notesSaveTimer: null as ReturnType<typeof setTimeout> | null,
      viewportUnwatch: null as (() => void) | null,
    };
  },
  computed: {
    hasUnread(): boolean {
      if (this.open && this.tab === "chat") {
        return false;
      }
      const last = this.messages[this.messages.length - 1];
      return !!last && new Date(last.created_at).getTime() > this.unreadSince;
    },
  },
  async mounted() {
    this.unreadSince = this.loadLastRead();
    this.authorName = (await fetchMyNickname(this.client, this.userId)) || "Player";
    await this.loadMessages();
    await this.loadNotes();
    await this.loadMuted();
    this.subscribeChat();
    this.startStickyBarWatch();
    this.viewportUnwatch = watchDesktopViewport((isDesktop) => {
      this.isDesktop = isDesktop;
      this.open = isDesktop && loadOpenPreference();
    });
  },
  beforeDestroy() {
    if (this.viewportUnwatch) {
      this.viewportUnwatch();
      this.viewportUnwatch = null;
    }
    this.stickyBarObserver?.disconnect();
    if (this.stickyBarPoll) {
      clearInterval(this.stickyBarPoll);
    }
    if (this.channel) {
      this.client.removeChannel(this.channel);
    }
    if (this.notesSaveTimer) {
      clearTimeout(this.notesSaveTimer);
    }
  },
  methods: {
    isOnline(userId: string): boolean {
      return isUserOnline(this.presenceState, userId);
    },
    formatTime: formatChatTime,
    // Finds whichever mobile sticky bar (if any) is currently rendered - Commands.vue's on-turn
    // bar or PremoveBar.vue's off-turn one - and keeps `toggleBottomOffset` a fixed gap above its
    // real, live height. A ResizeObserver catches height changes (e.g. the auto-leech dropdown
    // opening) once an element is found; a coarse poll re-runs the query itself, since the bar can
    // mount/unmount entirely outside this component's own tree at arbitrary times (turn changes,
    // round start) with nothing here to react to otherwise.
    startStickyBarWatch() {
      if (typeof document === "undefined" || typeof ResizeObserver === "undefined") {
        return;
      }
      const STICKY_BAR_SELECTOR = "#move-buttons.mobile-sticky-actions, .premove-bar--sticky-mobile";
      let observedEl: Element | null = null;
      this.stickyBarObserver = new ResizeObserver(() => this.updateStickyOffset(STICKY_BAR_SELECTOR));
      const recheck = () => {
        const el = document.querySelector(STICKY_BAR_SELECTOR);
        if (el !== observedEl) {
          if (observedEl) {
            this.stickyBarObserver!.unobserve(observedEl);
          }
          observedEl = el;
          if (el) {
            this.stickyBarObserver!.observe(el);
          }
        }
        this.updateStickyOffset(STICKY_BAR_SELECTOR);
      };
      recheck();
      this.stickyBarPoll = setInterval(recheck, 500);
    },
    updateStickyOffset(selector: string) {
      const el = document.querySelector(selector) as HTMLElement | null;
      const barHeight = el ? el.getBoundingClientRect().height : 0;
      this.toggleBottomOffset = barHeight > 0 ? barHeight + 12 : 24;
    },
    lastReadKey(): string {
      return `chat-last-read-${this.gameId}`;
    },
    loadLastRead(): number {
      if (typeof window === "undefined") {
        return 0;
      }
      const stored = window.localStorage.getItem(this.lastReadKey());
      return stored ? Number(stored) : 0;
    },
    markRead() {
      const now = Date.now();
      this.unreadSince = now;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(this.lastReadKey(), String(now));
      }
    },
    async loadMessages() {
      const { data, error } = await (this.client as any)
        .from("game_chat_messages")
        .select("*")
        .eq("game_id", this.gameId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (!error && data) {
        this.messages = data;
      }
    },
    subscribeChat() {
      this.channel = (this.client as any)
        .channel(`game-chat-${this.gameId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "game_chat_messages", filter: `game_id=eq.${this.gameId}` },
          (payload: { new: ChatMessage }) => {
            this.messages.push(payload.new);
            this.$nextTick(() => this.scrollToBottom());
          }
        )
        .subscribe();
    },
    scrollToBottom() {
      const el = this.$refs.messageList as HTMLElement | undefined;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    },
    async sendMessage() {
      const body = this.draft.trim();
      if (!body) {
        return;
      }
      this.draft = "";
      const { error } = await (this.client as any).from("game_chat_messages").insert({
        game_id: this.gameId,
        user_id: this.userId,
        author_name: this.authorName,
        body,
      });
      if (error) {
        window.alert(`Could not send message: ${error.message}`);
      }
    },
    async loadNotes() {
      const { data } = await (this.client as any)
        .from("game_notes")
        .select("body")
        .eq("game_id", this.gameId)
        .eq("user_id", this.userId)
        .maybeSingle();
      this.notesBody = data?.body ?? "";
    },
    scheduleSaveNotes() {
      this.notesStatus = "Saving...";
      if (this.notesSaveTimer) {
        clearTimeout(this.notesSaveTimer);
      }
      this.notesSaveTimer = setTimeout(() => this.saveNotes(), NOTES_SAVE_DEBOUNCE_MS);
    },
    async saveNotes() {
      const { error } = await (this.client as any).from("game_notes").upsert({
        game_id: this.gameId,
        user_id: this.userId,
        body: this.notesBody,
        updated_at: new Date().toISOString(),
      });
      this.notesStatus = error ? "Could not save" : "Saved";
    },
    async loadMuted() {
      // A row's mere existence means "muted" (see 0034_game_chat_mutes.sql) - default is unmuted,
      // i.e. no row, since a brand new game/user pair has never muted anything.
      const { data } = await (this.client as any)
        .from("game_chat_mutes")
        .select("game_id")
        .eq("game_id", this.gameId)
        .eq("user_id", this.userId)
        .maybeSingle();
      this.muted = !!data;
    },
    async toggleMute() {
      const next = !this.muted;
      this.muted = next; // optimistic - this is a low-stakes preference, not worth a loading state
      const { error } = next
        ? await (this.client as any).from("game_chat_mutes").insert({ game_id: this.gameId, user_id: this.userId })
        : await (this.client as any)
            .from("game_chat_mutes")
            .delete()
            .eq("game_id", this.gameId)
            .eq("user_id", this.userId);
      if (error) {
        this.muted = !next;
        window.alert(`Could not update mute setting: ${error.message}`);
      }
    },
    setOpen(open: boolean) {
      this.open = open;
      if (this.isDesktop) {
        saveOpenPreference(open);
      }
    },
    toggleOpen() {
      if (this.open) {
        this.closePanel();
      } else {
        this.openPanel(this.tab);
      }
    },
    openPanel(tab: Tab) {
      this.setOpen(true);
      this.switchTab(tab);
    },
    closePanel() {
      this.setOpen(false);
    },
    switchTab(tab: Tab) {
      this.tab = tab;
      if (tab === "chat") {
        this.markRead();
        this.$nextTick(() => this.scrollToBottom());
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.chat-notes__toggle {
  position: fixed;
  right: 1rem;
  // `bottom` is set inline (see `toggleBottomOffset`) - dynamically measured off the live sticky
  // bar element so it always clears it regardless of that bar's current height, on every viewport.
  z-index: 1040;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 0;
  background: var(--ui-primary);
  color: var(--ui-primary-text);
  font-size: 1.35rem;
  box-shadow: 0 2px 10px var(--ui-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: bottom 0.15s ease-out;
}

.chat-notes__badge {
  position: absolute;
  top: 0.15rem;
  right: 0.15rem;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--ui-danger);
  border: 2px solid var(--ui-surface);
}

.chat-notes__panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  max-width: 100vw;
  background: var(--ui-surface);
  border-left: 1px solid var(--ui-border);
  box-shadow: -4px 0 16px var(--ui-shadow);
  z-index: 1050;
  display: flex;
  flex-direction: column;

  // Full-screen overlay instead of a squeezed docked strip - a fixed 360px panel doesn't work on a
  // phone-width viewport (owner's explicit choice over a bottom sheet, to avoid gesture conflicts
  // with the map's own pinch/pan/scroll handling).
  @media (max-width: 767px) {
    left: 0;
    width: 100vw;
    border-left: none;
  }
}

.chat-notes__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--ui-border);
}

.chat-notes__back {
  display: none;
  border: 0;
  background: transparent;
  font-size: 1.3rem;
  line-height: 1;
  padding: 0.2rem 0.4rem;

  @media (max-width: 767px) {
    display: inline-flex;
  }
}

.chat-notes__tabs {
  display: flex;
  gap: 0.35rem;
  flex: 1;
}

.chat-notes__tab {
  flex: 1;
  border: 0;
  border-radius: 999px;
  padding: 0.28rem 0.5rem;
  background: transparent;
  font-weight: 600;
  color: inherit;
  opacity: 0.6;

  &--active {
    background: var(--ui-accent-soft);
    opacity: 1;
  }
}

.chat-notes__close {
  border: 0;
  background: transparent;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.2rem 0.4rem;

  // The back arrow covers this role on mobile - no need for both.
  @media (max-width: 767px) {
    display: none;
  }
}

.chat-notes__chat {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chat-notes__chat-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 0.3rem 0.6rem 0;
}

.chat-notes__mute-toggle {
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.65;
  font-size: 0.72rem;
  padding: 0.15rem 0.3rem;
}

.chat-notes__messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  // Messenger-style: a handful of messages hug the bottom of the box instead of sitting stranded
  // at the top of a mostly-empty scroll area.
  justify-content: flex-end;
}

.chat-notes__empty {
  margin: auto;
}

.chat-notes__message {
  max-width: 85%;
  padding: 0.35rem 0.55rem;
  border-radius: 0.6rem;
  background: var(--ui-chat-message);

  &--own {
    align-self: flex-end;
    background: var(--ui-chat-own);
  }
}

.chat-notes__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  opacity: 0.7;
}

.chat-notes__presence {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;

  &--online {
    background: #28a745;
  }

  &--offline {
    background: #adb5bd;
  }
}

.chat-notes__author {
  font-weight: 700;
}

.chat-notes__time {
  opacity: 0.8;
}

.chat-notes__body {
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-notes__composer {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem;
  border-top: 1px solid var(--ui-border);

  textarea {
    flex: 1;
    resize: none;
    min-height: 2.2rem;
    max-height: 6rem;
    border-radius: 0.4rem;
    border: 1px solid var(--ui-border-strong);
    background: var(--ui-input-bg);
    color: var(--ui-text);
    padding: 0.35rem 0.5rem;
  }

  button {
    border: 0;
    border-radius: 0.4rem;
    padding: 0 0.9rem;
    background: var(--ui-primary);
    color: var(--ui-primary-text);
    font-weight: 600;

    &:disabled {
      opacity: 0.5;
    }
  }
}

.chat-notes__notes {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.6rem;
  gap: 0.35rem;
}

.chat-notes__notes-textarea {
  flex: 1;
  resize: none;
  border-radius: 0.4rem;
  border: 1px solid var(--ui-border-strong);
  background: var(--ui-input-bg);
  color: var(--ui-text);
  padding: 0.5rem;
}

.chat-notes__notes-status {
  align-self: flex-end;
}
</style>
