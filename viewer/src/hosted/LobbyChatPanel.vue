<template>
  <div class="lobby-chat gaia-viewer-game">
    <button
      type="button"
      class="lobby-chat__toggle"
      :class="{ 'lobby-chat__toggle--unread': hasUnread, 'lobby-chat__toggle--open': open }"
      :style="toggleStyle"
      @click="togglePanel"
      :aria-label="toggleLabel"
    >
      <span class="lobby-chat__toggle-icon" aria-hidden="true">{{ open ? "×" : "💬" }}</span>
      <!-- Count-and-label pill rather than a bare dot - see ChatNotesPanel.vue's identical toggle. -->
      <template v-if="hasUnread">
        <span class="lobby-chat__badge">{{ unreadBadge }}</span>
        <span class="lobby-chat__toggle-text">new</span>
      </template>
    </button>

    <div v-if="open" class="lobby-chat__panel" :style="panelStyle">
      <div class="lobby-chat__header">
        <strong class="lobby-chat__title">Lobby Chat</strong>
        <button type="button" class="lobby-chat__close" @click="closePanel" aria-label="Minimize lobby chat">
          &times;
        </button>
      </div>

      <div class="lobby-chat__messages" ref="messageList" @scroll="onScroll">
        <button v-if="hasMore" type="button" class="lobby-chat__load-older" :disabled="loadingOlder" @click="loadOlder">
          {{ loadingOlder ? "Loading..." : "Load older messages" }}
        </button>
        <p v-if="!hasMore && messages.length === 0" class="lobby-chat__empty text-muted">
          No messages yet - say hello.
        </p>
        <template v-for="msg in messages">
          <div
            :key="msg.id"
            class="lobby-chat__message"
            :class="{ 'lobby-chat__message--own': msg.user_id === userId }"
          >
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
          <!-- Read check: everyone whose read position lands on this message (see chat-reads.ts). -->
          <div
            v-if="readersFor(msg.id).length > 0"
            :key="`readers-${msg.id}`"
            class="lobby-chat__readers"
            :title="readSummaryFor(msg.id)"
            :aria-label="readSummaryFor(msg.id)"
          >
            <span v-if="msg.id === lastMessageId" class="lobby-chat__read-summary">{{ readSummaryFor(msg.id) }}</span>
            <span v-for="reader in readersFor(msg.id)" :key="reader.userId" class="lobby-chat__reader">
              {{ reader.initials }}
            </span>
          </div>
        </template>
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
import { isOnline as isUserOnline, PresenceState } from "./presence";
import { formatChatTime } from "./chat-time";
import {
  applyReceipt,
  ChatReader,
  ChatReadReceipt,
  loadLobbyChatReads,
  markLobbyChatRead,
  readSummary,
  readersByMessage,
} from "./chat-reads";
import { isDesktopViewport, watchDesktopViewport } from "./viewport";
import { OverlayViewportPin } from "./overlay-viewport";
import { chatPopupGeometry, watchOverlayViewport } from "./chat-popup";
import {
  formatUnreadCount,
  loadLastSeenId,
  newestMessageId,
  saveLastSeenId,
  unreadCount,
  unreadSummary,
} from "./chat-unread";

interface LobbyChatMessage {
  id: number;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

const PAGE_SIZE = 200;
const LAST_SEEN_KEY = "lobby-chat-last-seen-id";
/** The pre-id receipt (a wall-clock ms stamp) some devices still carry - read once, then left to go
 * stale. See chat-unread.ts. */
const LEGACY_LAST_READ_KEY = "lobby-chat-last-read";

/** Distance from the bottom of the viewport to the floating toggle, matching `.lobby-chat__toggle`'s
 * own `bottom`. Unlike the per-game panel there is no sticky move bar to clear here, so it is a
 * constant rather than a live measurement - but the popup above it still needs the number. */
const TOGGLE_BOTTOM = 24;

/** A single global, all-history "Lobby Chat" room (unlike ChatNotesPanel's per-game chat) - same
 * floating-toggle / desktop-dock / mobile-popup shell for UI consistency, mounted once on the
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
      isDesktop: isDesktopViewport(),
      messages: [] as LobbyChatMessage[],
      draft: "",
      authorName: "Player",
      // Highest message id already on screen - see ChatNotesPanel.vue's twin and chat-unread.ts for
      // why unread is tracked by id and sender rather than by a wall clock.
      lastSeenId: 0,
      // Mobile only, and null unless an on-screen keyboard is actually up - see ChatNotesPanel.vue's
      // identical pair and overlay-viewport.ts.
      viewportPin: null as OverlayViewportPin,
      viewportPinUnwatch: null as (() => void) | null,
      desktopUnwatch: null as (() => void) | null,
      hasMore: true,
      loadingOlder: false,
      // Read checks - see ChatNotesPanel.vue's identical pair and chat-reads.ts for the shared
      // logic behind them.
      readReceipts: [] as ChatReadReceipt[],
      reportedReadId: 0,
      // Set directly from outside (hosted.ts) rather than tracked here - see that file's comment
      // for why this shares Lobby.vue's own presence tracking instead of opening a second Realtime
      // Presence channel on the same topic.
      presenceState: {} as PresenceState,
      channel: null as any,
    };
  },
  computed: {
    /** Popup geometry on mobile, nothing on desktop (a docked full-height strip there). See
     * chat-popup.ts and ChatNotesPanel.vue's twin. */
    panelStyle(): Record<string, string> {
      if (this.isDesktop) {
        return {};
      }
      const geometry = chatPopupGeometry({
        toggleBottom: TOGGLE_BOTTOM,
        pin: this.viewportPin,
        innerHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      });
      return { bottom: `${geometry.bottom}px`, maxHeight: `${geometry.maxHeight}px` };
    },
    toggleStyle(): Record<string, string> {
      const geometry = chatPopupGeometry({
        toggleBottom: TOGGLE_BOTTOM,
        pin: this.isDesktop ? null : this.viewportPin,
        innerHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      });
      return { bottom: `${TOGGLE_BOTTOM + geometry.keyboardInset}px` };
    },
    unreadCount(): number {
      return this.open ? 0 : unreadCount(this.messages, this.lastSeenId, this.userId);
    },
    hasUnread(): boolean {
      return this.unreadCount > 0;
    },
    unreadBadge(): string {
      return formatUnreadCount(this.unreadCount);
    },
    toggleLabel(): string {
      if (this.open) {
        return "Minimize lobby chat";
      }
      return this.hasUnread ? `Open lobby chat, ${unreadSummary(this.unreadCount)}` : "Open lobby chat";
    },
    lastMessageId(): number {
      const last = this.messages[this.messages.length - 1];
      return last ? last.id : 0;
    },
    readers(): Record<number, ChatReader[]> {
      return readersByMessage(
        this.readReceipts,
        this.messages.map((m) => m.id),
        this.userId
      );
    },
  },
  async mounted() {
    this.authorName = (await fetchMyNickname(this.client, this.userId)) || "Player";
    await this.loadInitialMessages();
    // After the messages, so a device still carrying the old timestamp receipt can translate it
    // into an id instead of re-flagging the whole room as unread (see chat-unread.ts).
    this.lastSeenId = loadLastSeenId(LAST_SEEN_KEY, LEGACY_LAST_READ_KEY, this.messages);
    // Covers the panel being opened while that load was still in flight: `openPanel`'s own
    // scroll-to-bottom ran against an empty list, and the list is a real scroll container now, so
    // without this the thread would open parked on its oldest message.
    if (this.open) {
      this.$nextTick(() => this.scrollToBottom());
    }
    // Not awaited, for the same reason as ChatNotesPanel's own receipts load.
    loadLobbyChatReads(this.client).then((receipts) => {
      this.readReceipts = receipts;
    });
    this.subscribeChat();
    if (!this.isDesktop) {
      this.startViewportWatch();
    }
    this.desktopUnwatch = watchDesktopViewport((isDesktop) => {
      this.isDesktop = isDesktop;
      if (isDesktop) {
        this.stopViewportWatch();
      } else {
        this.startViewportWatch();
      }
    });
  },
  beforeDestroy() {
    if (this.desktopUnwatch) {
      this.desktopUnwatch();
      this.desktopUnwatch = null;
    }
    this.stopViewportWatch();
    if (this.channel) {
      this.client.removeChannel(this.channel);
    }
  },
  methods: {
    isOnline(userId: string): boolean {
      return isUserOnline(this.presenceState, userId);
    },
    formatTime: formatChatTime,
    startViewportWatch() {
      if (this.viewportPinUnwatch) {
        return;
      }
      this.viewportPinUnwatch = watchOverlayViewport((pin) => {
        this.viewportPin = pin;
      });
    },
    stopViewportWatch() {
      if (this.viewportPinUnwatch) {
        this.viewportPinUnwatch();
        this.viewportPinUnwatch = null;
      }
      this.viewportPin = null;
    },
    /** Everything in the room is on screen (or was, when the popup closed) - so none of it is
     * unread. Called on open, on close, and on every arrival while open. */
    markSeen() {
      const newest = newestMessageId(this.messages);
      if (newest > this.lastSeenId) {
        this.lastSeenId = newest;
      }
      saveLastSeenId(LAST_SEEN_KEY, newest);
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
            // Measured before the push, and only followed when the reader is already on the newest
            // message (or sent this one) - see ChatNotesPanel.vue's identical handler. Matters more
            // here than there: this thread pages older messages in as you scroll up.
            const follow = this.isAtBottom() || payload.new.user_id === this.userId;
            this.messages.push(payload.new);
            if (this.open) {
              this.markSeen();
              this.reportRead();
            }
            if (follow) {
              this.$nextTick(() => this.scrollToBottom());
            }
          }
        )
        // Same channel, second binding - read receipts for this same room (see ChatNotesPanel.vue).
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "lobby_chat_reads" },
          (payload: { new: ChatReadReceipt }) => {
            if (payload.new && payload.new.user_id) {
              this.readReceipts = applyReceipt(this.readReceipts, payload.new);
            }
          }
        )
        .subscribe();
    },
    readersFor(messageId: number): ChatReader[] {
      return this.readers[messageId] || [];
    },
    readSummaryFor(messageId: number): string {
      return readSummary(this.readersFor(messageId));
    },
    /** Records how far I have read, for everyone else's read checks. Fire-and-forget. */
    reportRead() {
      const lastId = this.lastMessageId;
      if (!lastId || lastId <= this.reportedReadId) {
        return;
      }
      this.reportedReadId = lastId;
      markLobbyChatRead(this.client, lastId, this.authorName).catch(() => undefined);
    },
    scrollToBottom() {
      const el = this.$refs.messageList as HTMLElement | undefined;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    },
    /** Already parked on the newest message? Same slack and same "true when unmeasurable" default
     * as ChatNotesPanel.vue's own. */
    isAtBottom(): boolean {
      const el = this.$refs.messageList as HTMLElement | undefined;
      if (!el) {
        return true;
      }
      return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
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
      this.markSeen();
      this.reportRead();
      this.$nextTick(() => this.scrollToBottom());
    },
    closePanel() {
      // Also on the way out - see ChatNotesPanel.vue's twin: marking only on open is what left your
      // own just-sent message counting as unread the moment you closed the panel.
      this.markSeen();
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
// Unread pill + pulse, mirroring ChatNotesPanel.vue's own (see the comment there for why the old
// 0.6rem dot had to go).
@keyframes lobby-unread-pulse {
  0% {
    box-shadow: 0 2px 10px var(--ui-shadow), 0 0 0 0 rgba(180, 35, 50, 0.55);
  }
  70% {
    box-shadow: 0 2px 10px var(--ui-shadow), 0 0 0 0.75rem rgba(180, 35, 50, 0);
  }
  100% {
    box-shadow: 0 2px 10px var(--ui-shadow), 0 0 0 0 rgba(180, 35, 50, 0);
  }
}

.lobby-chat__toggle {
  position: fixed;
  right: 1rem;
  // `bottom` is set inline (see `toggleStyle`) so an on-screen keyboard can lift it; it resolves to
  // TOGGLE_BOTTOM the rest of the time, which this literal has to match.
  bottom: 1.5rem;
  z-index: 1040;
  min-width: 3rem;
  height: 3rem;
  padding: 0;
  border-radius: 1.5rem;
  border: 0;
  background: var(--ui-primary);
  color: var(--ui-primary-text);
  font-size: 1.35rem;
  line-height: 1;
  box-shadow: 0 2px 10px var(--ui-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: bottom 0.15s ease-out, background-color 0.15s ease-out, padding 0.15s ease-out;

  // Right side, matching ChatNotesPanel's per-game chat toggle (owner request) - no conflict since
  // this one only ever appears on the lobby screen, never alongside the per-game one.

  &--unread {
    padding: 0 0.85rem 0 0.7rem;
    background: var(--ui-danger-solid);
    color: #fff;
    animation: lobby-unread-pulse 1.9s ease-out infinite;
  }

  &--open {
    background: var(--ui-surface);
    color: var(--ui-text);
    border: 1px solid var(--ui-border);
    font-size: 1.6rem;
  }
}

.lobby-chat__toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lobby-chat__toggle-text {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.lobby-chat__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.28rem;
  border-radius: 0.7rem;
  background: #fff;
  color: var(--ui-danger-solid);
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1;
}

.lobby-chat__panel {
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

  // Popup on mobile, same shell as ChatNotesPanel.vue's (see the comment there): full width, above
  // the toggle, only as tall as the space above it, with `bottom`/`max-height` coming in inline
  // from chat-popup.ts.
  @media (max-width: 767px) {
    left: 0;
    right: 0;
    top: auto;
    width: auto;
    min-height: 11rem;
    border: 1px solid var(--ui-border);
    border-radius: 1rem;
    box-shadow: 0 10px 34px var(--ui-shadow), 0 2px 8px var(--ui-shadow);
    overflow: hidden;
  }
}

.lobby-chat__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--ui-border);
}

.lobby-chat__title {
  flex: 1;
}

// One control on every viewport now - a popup is minimized, not navigated back out of, so the
// mobile-only back arrow that used to stand in for this went away with the full-screen overlay.
.lobby-chat__close {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.2rem 0.5rem;
}

.lobby-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  // Keeps a flick that reaches either end of the thread inside the panel instead of scrolling the
  // lobby behind it - same reasoning as ChatNotesPanel.vue's own list.
  overscroll-behavior: contain;

  // Messenger-style: content hugs the BOTTOM of the scroll area, so a handful of messages sit near
  // the composer instead of stranded at the top of a mostly-empty box. This used to be
  // `justify-content: flex-end` with a comment claiming it "still scrolls correctly once content
  // overflows" - it does not, measurably: alignment cannot push content into a scroll container's
  // scrollable overflow, so a thread longer than the box had `scrollHeight === clientHeight`, would
  // not scroll at all, and hid every older message (and this panel's own "Load older messages"
  // button, its first child) above an unreachable top edge. An auto margin looks identical and
  // resolves to 0 as soon as the content is taller than the box. See ChatNotesPanel.vue.
  > *:first-child {
    margin-top: auto;
  }
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
  max-width: 85%;
  padding: 0.3rem 0.5rem;
  border-radius: 0.6rem;
  background: var(--ui-chat-message);

  // Own messages get indented to the right + a distinct color, matching ChatNotesPanel's own
  // per-game chat convention, so it's obvious at a glance which messages are yours.
  &--own {
    align-self: flex-end;
    background: var(--ui-chat-own);
  }
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

// Read checks - mirrors ChatNotesPanel.vue's own reader chips (see the comment there).
.lobby-chat__readers {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin-top: -0.25rem;
}

.lobby-chat__read-summary {
  font-size: 0.65rem;
  opacity: 0.6;
  margin-right: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.lobby-chat__reader {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  background: var(--ui-chat-own);
  border: 1px solid var(--ui-border);
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 1;
  opacity: 0.85;
}

.lobby-chat__composer {
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
</style>
