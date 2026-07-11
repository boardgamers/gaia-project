<template>
  <div class="chat-notes gaia-viewer-game">
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
 * per-user notes - a docked side panel on desktop or a full-screen overlay on mobile (see the
 * scoped media queries below). Owner request: on by default, toggled off/on from the settings
 * menu (a persisted global preference, `loadChatOpenPreference`/`saveChatOpenPreference` below) -
 * no floating toggle button of its own anymore (hosted.ts's HostedBar settings dropdown drives
 * `open` from outside, same cross-instance pattern as GameNavPanel.vue's own settings toggle). The
 * in-panel back/close buttons still work too, for a quick dismiss without opening settings. */
export default Vue.extend({
  name: "ChatNotesPanel",
  props: {
    client: { type: Object, required: true },
    gameId: { type: String, required: true },
    userId: { type: String, required: true },
  },
  data() {
    return {
      open: loadChatOpenPreference(),
      tab: "chat" as Tab,
      messages: [] as ChatMessage[],
      draft: "",
      authorName: "Player",
      notesBody: "",
      notesStatus: "",
      muted: false,
      // Set directly from outside (hosted.ts, via emitter.store.watch) rather than tracked here -
      // this game already tracks its own presence (hosted.ts's own `trackPresence(..., {type:
      // "game", gameId}, ...)` call feeds the shared Vuex store's `state.presence`), so reading
      // that directly avoids opening yet another Realtime Presence channel (see LobbyChatPanel's
      // own history of exactly that bug, PROGRESS.md).
      presenceState: {} as PresenceState,
      channel: null as any,
      notesSaveTimer: null as ReturnType<typeof setTimeout> | null,
    };
  },
  async mounted() {
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
    isOnline(userId: string): boolean {
      return isUserOnline(this.presenceState, userId);
    },
    formatTime: formatChatTime,
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
    closePanel() {
      this.open = false;
      saveChatOpenPreference(false);
    },
    switchTab(tab: Tab) {
      this.tab = tab;
      if (tab === "chat") {
        this.$nextTick(() => this.scrollToBottom());
      }
    },
  },
});

const CHAT_OPEN_KEY = "gp-fight-club-chat-open";

/** On by default on desktop (owner request); mobile still defaults closed - a fixed 360px-wide
 * panel doesn't work on a phone-width viewport, and this one becomes a full-screen overlay there
 * (see the scoped `@media (max-width: 767px)` below), which would otherwise cover the board the
 * instant a phone user opened the app. */
function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth >= 768;
}

export function loadChatOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(CHAT_OPEN_KEY);
  return stored === null ? isDesktopViewport() : stored === "true";
}

export function saveChatOpenPreference(open: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CHAT_OPEN_KEY, open ? "true" : "false");
}
</script>

<style lang="scss" scoped>

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

// Was borderless/transparent with muted text - read as a passive status label rather than
// something pressable. Same treatment as HostedBar.vue's push-notification bell (`.hosted-bar__
// push-toggle`): a visible border, real background, and hover/press feedback so it's unambiguously
// a button in both the muted and unmuted state.
.chat-notes__mute-toggle {
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 999px;
  background: var(--bs-body-bg, #fff);
  color: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);

  &:hover {
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.25);
  }

  &:active {
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  }
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
  background: rgba(0, 0, 0, 0.06);

  &--own {
    align-self: flex-end;
    background: rgba(47, 111, 237, 0.18);
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
