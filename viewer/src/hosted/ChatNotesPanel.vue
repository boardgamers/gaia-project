<template>
  <div class="chat-notes gaia-viewer-game">
    <button
      type="button"
      class="chat-notes__toggle"
      :class="{ 'chat-notes__toggle--unread': hasUnread }"
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
            <span class="chat-notes__author">{{ msg.author_name }}</span>
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

/** Per-game chat (visible to every approved user, players and spectators alike) plus private,
 * per-user notes - a floating toggle that opens a collapsible side panel on desktop or a
 * full-screen overlay on mobile (see the scoped media queries below), matching the owner's brief. */
export default Vue.extend({
  name: "ChatNotesPanel",
  props: {
    client: { type: Object, required: true },
    gameId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  data() {
    return {
      open: false,
      tab: "chat" as Tab,
      messages: [] as ChatMessage[],
      draft: "",
      authorName: "Player",
      notesBody: "",
      notesStatus: "",
      muted: false,
      unreadSince: 0,
      channel: null as any,
      notesSaveTimer: null as ReturnType<typeof setTimeout> | null,
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
  },
  beforeDestroy() {
    if (this.channel) {
      this.client.removeChannel(this.channel);
    }
    if (this.notesSaveTimer) {
      clearTimeout(this.notesSaveTimer);
    }
  },
  methods: {
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
    openPanel(tab: Tab) {
      this.open = true;
      this.switchTab(tab);
    },
    closePanel() {
      this.open = false;
    },
    // Called from HostedBar's own top-bar button on mobile (see hosted.ts, which wires the two
    // separately-mounted components together directly) - this component's own floating toggle is
    // desktop-only (see the `.chat-notes__toggle` media query below).
    togglePanel() {
      if (this.open) {
        this.closePanel();
      } else {
        this.openPanel(this.tab);
      }
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
  bottom: 1.5rem;
  z-index: 1040;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 0;
  background: #2f6fed;
  color: #fff;
  font-size: 1.35rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;

  // Desktop only - overlapped the mobile sticky action/premove bar at the bottom (see
  // Commands.vue/PremoveBar.vue) no matter how far up it was nudged, since that bar's own height
  // varies. On mobile the toggle instead lives in HostedBar's top-bar icon row, alongside the
  // push-notification bell and settings gear (see HostedBar.vue + hosted.ts, which wires the two
  // separately-mounted components together).
  @media (max-width: 767px) {
    display: none;
  }
}

.chat-notes__badge {
  position: absolute;
  top: 0.15rem;
  right: 0.15rem;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #dc3545;
  border: 2px solid #fff;
}

.chat-notes__panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  max-width: 100vw;
  background: var(--bs-body-bg, #fff);
  border-left: 1px solid rgba(0, 0, 0, 0.15);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.25);
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
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
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
    background: rgba(47, 111, 237, 0.15);
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
}

.chat-notes__empty {
  margin: auto;
}

.chat-notes__message {
  max-width: 85%;
  padding: 0.35rem 0.55rem;
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.06);

  &--own {
    align-self: flex-end;
    background: rgba(47, 111, 237, 0.18);
  }
}

.chat-notes__author {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  opacity: 0.7;
}

.chat-notes__body {
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-notes__composer {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.12);

  textarea {
    flex: 1;
    resize: none;
    min-height: 2.2rem;
    max-height: 6rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(0, 0, 0, 0.2);
    padding: 0.35rem 0.5rem;
  }

  button {
    border: 0;
    border-radius: 0.4rem;
    padding: 0 0.9rem;
    background: #2f6fed;
    color: #fff;
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
  border: 1px solid rgba(0, 0, 0, 0.2);
  padding: 0.5rem;
}

.chat-notes__notes-status {
  align-self: flex-end;
}
</style>
