<template>
  <div class="lobby-chat gaia-viewer-game">
    <button
      type="button"
      class="lobby-chat__toggle"
      :class="{ 'lobby-chat__toggle--unread': hasUnread }"
      @click="togglePanel"
      :aria-label="open ? 'Close lobby chat' : 'Open lobby chat'"
    >
      <span aria-hidden="true">&#128172;</span>
      <span v-if="hasUnread" class="lobby-chat__badge"></span>
    </button>

    <div v-if="open" class="lobby-chat__panel">
      <div class="lobby-chat__header">
        <button type="button" class="lobby-chat__back" @click="closePanel" aria-label="Back to lobby">&larr;</button>
        <strong class="lobby-chat__title">Lobby Chat</strong>
        <button type="button" class="lobby-chat__close" @click="closePanel" aria-label="Close">&times;</button>
      </div>

      <div class="lobby-chat__messages" ref="messageList" @scroll="onScroll">
        <button v-if="hasMore" type="button" class="lobby-chat__load-older" :disabled="loadingOlder" @click="loadOlder">
          {{ loadingOlder ? "Loading..." : "Load older messages" }}
        </button>
        <p v-if="!hasMore && messages.length === 0" class="lobby-chat__empty text-muted">
          No messages yet - say hello.
        </p>
        <div v-for="msg in messages" :key="msg.id" class="lobby-chat__message">
          <span class="lobby-chat__meta">
            <span
              class="lobby-chat__presence"
              :class="`lobby-chat__presence--${isOnline(msg.user_id) ? 'online' : 'offline'}`"
            ></span>
            <span class="lobby-chat__author">{{ msg.author_name }}</span>
            <span class="lobby-chat__time">{{ formatTime(msg.created_at) }}</span>
          </span>
          <span class="lobby-chat__body">{{ msg.body }}</span>
        </div>
      </div>

      <form class="lobby-chat__composer" @submit.prevent="sendMessage">
        <textarea
          v-model="draft"
          rows="1"
          placeholder="Message the lobby..."
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>
        <button type="submit" :disabled="!draft.trim()">Send</button>
      </form>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { fetchMyNickname } from "./profile";
import { isOnline as isUserOnline, PresenceState, subscribePresence } from "./presence";

interface LobbyChatMessage {
  id: number;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

const PAGE_SIZE = 200;
const LAST_READ_KEY = "lobby-chat-last-read";

/** A single global, all-history "Lobby Chat" room (unlike ChatNotesPanel's per-game chat) - same
 * floating-toggle / desktop-dock / mobile-overlay shell for UI consistency, mounted once on the
 * lobby screen only (see hosted.ts). Shows each message's author, send time, and live online
 * status (reusing the same presence system the lobby's own game-bar dots use). */
export default Vue.extend({
  name: "LobbyChatPanel",
  props: {
    client: { type: Object, required: true },
    userId: { type: String, required: true },
  },
  data() {
    return {
      open: false,
      messages: [] as LobbyChatMessage[],
      draft: "",
      authorName: "Player",
      unreadSince: 0,
      hasMore: true,
      loadingOlder: false,
      presenceState: {} as PresenceState,
      channel: null as any,
      stopPresence: null as (() => void) | null,
    };
  },
  computed: {
    hasUnread(): boolean {
      if (this.open) {
        return false;
      }
      const last = this.messages[this.messages.length - 1];
      return !!last && new Date(last.created_at).getTime() > this.unreadSince;
    },
  },
  async mounted() {
    this.unreadSince = this.loadLastRead();
    this.authorName = (await fetchMyNickname(this.client, this.userId)) || "Player";
    await this.loadInitialMessages();
    this.subscribeChat();
    this.stopPresence = subscribePresence(this.client, (state) => {
      this.presenceState = state;
    });
  },
  beforeDestroy() {
    if (this.channel) {
      this.client.removeChannel(this.channel);
    }
    if (this.stopPresence) {
      this.stopPresence();
    }
  },
  methods: {
    isOnline(userId: string): boolean {
      return isUserOnline(this.presenceState, userId);
    },
    formatTime(iso: string): string {
      const date = new Date(iso);
      const now = new Date();
      const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return sameDay ? time : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
    },
    loadLastRead(): number {
      if (typeof window === "undefined") {
        return 0;
      }
      const stored = window.localStorage.getItem(LAST_READ_KEY);
      return stored ? Number(stored) : 0;
    },
    markRead() {
      const now = Date.now();
      this.unreadSince = now;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_READ_KEY, String(now));
      }
    },
    async loadInitialMessages() {
      const { data, error } = await (this.client as any)
        .from("lobby_chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (!error && data) {
        this.messages = [...data].reverse();
        this.hasMore = data.length === PAGE_SIZE;
      }
    },
    async loadOlder() {
      if (this.messages.length === 0 || this.loadingOlder) {
        return;
      }
      this.loadingOlder = true;
      const el = this.$refs.messageList as HTMLElement | undefined;
      const previousScrollHeight = el?.scrollHeight ?? 0;
      const previousScrollTop = el?.scrollTop ?? 0;
      const oldest = this.messages[0];
      const { data, error } = await (this.client as any)
        .from("lobby_chat_messages")
        .select("*")
        .lt("created_at", oldest.created_at)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (!error && data) {
        this.messages = [...[...data].reverse(), ...this.messages];
        this.hasMore = data.length === PAGE_SIZE;
        this.$nextTick(() => {
          if (el) {
            el.scrollTop = el.scrollHeight - previousScrollHeight + previousScrollTop;
          }
        });
      }
      this.loadingOlder = false;
    },
    onScroll() {
      const el = this.$refs.messageList as HTMLElement | undefined;
      if (el && el.scrollTop < 40 && this.hasMore && !this.loadingOlder) {
        this.loadOlder();
      }
    },
    subscribeChat() {
      this.channel = (this.client as any)
        .channel("lobby-chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "lobby_chat_messages" },
          (payload: { new: LobbyChatMessage }) => {
            this.messages.push(payload.new);
            if (this.open) {
              this.markRead();
            }
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
      const { error } = await (this.client as any).from("lobby_chat_messages").insert({
        user_id: this.userId,
        author_name: this.authorName,
        body,
      });
      if (error) {
        window.alert(`Could not send message: ${error.message}`);
      }
    },
    openPanel() {
      this.open = true;
      this.markRead();
      this.$nextTick(() => this.scrollToBottom());
    },
    closePanel() {
      this.open = false;
    },
    togglePanel() {
      if (this.open) {
        this.closePanel();
      } else {
        this.openPanel();
      }
    },
  },
});
</script>

<style lang="scss" scoped>
// Mirrors ChatNotesPanel.vue's shell (floating toggle, desktop dock / mobile full overlay) for UI
// consistency - kept as a separate component rather than a shared base since the per-game panel's
// tabs/notes concepts don't apply here at all.
.lobby-chat__toggle {
  position: fixed;
  left: 1rem;
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

  // Left side, unlike ChatNotesPanel's right-side toggle - this only ever appears on the lobby
  // screen (no per-game sticky action bar to clash with there), but keeping it on the opposite
  // side from the per-game chat toggle avoids any visual confusion between the two.
}

.lobby-chat__badge {
  position: absolute;
  top: 0.15rem;
  right: 0.15rem;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #dc3545;
  border: 2px solid #fff;
}

.lobby-chat__panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 360px;
  max-width: 100vw;
  background: var(--bs-body-bg, #fff);
  border-right: 1px solid rgba(0, 0, 0, 0.15);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.25);
  z-index: 1050;
  display: flex;
  flex-direction: column;

  @media (max-width: 767px) {
    right: 0;
    width: 100vw;
    border-right: none;
  }
}

.lobby-chat__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.lobby-chat__title {
  flex: 1;
}

.lobby-chat__back {
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

.lobby-chat__close {
  border: 0;
  background: transparent;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.2rem 0.4rem;

  @media (max-width: 767px) {
    display: none;
  }
}

.lobby-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.lobby-chat__load-older {
  align-self: center;
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
}

.lobby-chat__empty {
  margin: auto;
}

.lobby-chat__message {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.lobby-chat__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  opacity: 0.7;
}

.lobby-chat__presence {
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

.lobby-chat__author {
  font-weight: 700;
}

.lobby-chat__time {
  opacity: 0.8;
}

.lobby-chat__body {
  white-space: pre-wrap;
  word-break: break-word;
}

.lobby-chat__composer {
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
</style>
