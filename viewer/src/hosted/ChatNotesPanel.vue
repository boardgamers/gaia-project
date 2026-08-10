<template>
  <div class="chat-notes gaia-viewer-game">
    <button
      v-if="!isDesktop"
      type="button"
      class="chat-notes__toggle"
      :class="{ 'chat-notes__toggle--unread': hasUnread, 'chat-notes__toggle--open': open }"
      :style="toggleStyle"
      @click="toggleOpen()"
      :aria-label="toggleLabel"
    >
      <span class="chat-notes__toggle-icon" aria-hidden="true">{{ open ? "×" : "💬" }}</span>
      <!-- Unread turns the circle into a pill that says how many and by whom: a 0.6rem dot was easy
           to miss entirely on a busy board (owner report). `--unread` also pulses it, and the count
           lives in `__badge` so it stays legible over the icon. -->
      <template v-if="hasUnread">
        <span class="chat-notes__badge">{{ unreadBadge }}</span>
        <span class="chat-notes__toggle-text">new</span>
      </template>
    </button>

    <div v-if="open" class="chat-notes__panel" :style="panelStyle">
      <div class="chat-notes__header">
        <!-- Notes moved out to the Lost Fleet sidebar's sticky sheet (LostFleetNotes.vue) - this panel
             is chat-only now, so a plain title stands in for the old Chat/Notes tab switcher. -->
        <div class="chat-notes__title">Chat</div>
        <button type="button" class="chat-notes__close" @click="closePanel" aria-label="Minimize chat">&times;</button>
      </div>

      <div class="chat-notes__chat">
        <div class="chat-notes__chat-toolbar">
          <button type="button" class="chat-notes__mute-toggle" @click="toggleMute">
            {{ muted ? "🔕 Muted - not receiving push notifications" : "🔔 Receiving push notifications" }}
          </button>
        </div>
        <div class="chat-notes__messages" ref="messageList">
          <p v-if="messages.length === 0" class="chat-notes__empty text-muted">No messages yet - say hello.</p>
          <template v-for="msg in messages">
            <div
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
            <!-- Read check: everyone whose read position lands on this message, i.e. this is as far
                 as they have got in the thread (see chat-reads.ts). -->
            <div
              v-if="readersFor(msg.id).length > 0"
              :key="`readers-${msg.id}`"
              class="chat-notes__readers"
              :title="readSummaryFor(msg.id)"
              :aria-label="readSummaryFor(msg.id)"
            >
              <span v-if="msg.id === lastMessageId" class="chat-notes__read-summary">{{ readSummaryFor(msg.id) }}</span>
              <span v-for="reader in readersFor(msg.id)" :key="reader.userId" class="chat-notes__reader">
                {{ reader.initials }}
              </span>
            </div>
          </template>
        </div>
        <form class="chat-notes__composer" @submit.prevent="sendMessage">
          <textarea
            v-model="draft"
            rows="2"
            placeholder="Message this game's chat..."
            @keydown.enter.exact.prevent="sendMessage"
          ></textarea>
          <button type="submit" :disabled="!draft.trim()">Send</button>
        </form>
      </div>
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
  loadGameChatReads,
  markGameChatRead,
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

interface ChatMessage {
  id: number;
  game_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

// `-v2` for the same reason as GameNavPanel.vue's own key: the default flipped to closed, and a
// stored "1" from the default-open era would otherwise keep re-docking the panel.
const OPEN_PREF_KEY = "chat-notes-panel-open-v2";

// Desktop-only preference, mirroring GameNavPanel.vue's own (see its doc comment) - now defaulting
// to CLOSED so the game keeps the full window width, and still one click away in HostedBar.vue's
// settings menu. Mobile never reads or writes this, it always starts closed behind the floating
// bubble.
function loadOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(OPEN_PREF_KEY);
  return stored === "1";
}

function saveOpenPreference(open: boolean): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OPEN_PREF_KEY, open ? "1" : "0");
  }
}

/** Per-game chat (visible to every approved user, players and spectators alike) - a floating toggle
 * that opens a collapsible side panel on desktop or a popup above the toggle on mobile (see the
 * scoped media queries below), matching the owner's brief. Private per-game notes used to live here too, as
 * a second tab, but moved to the Lost Fleet sidebar's sticky sheet (LostFleetNotes.vue); this panel
 * is chat-only now.
 *
 * Desktop and mobile are genuinely different UIs, not just a CSS reflow (see GameNavPanel.vue's
 * doc comment for the same split on the opposite edge): on desktop this panel is docked and
 * defaults closed, toggled from HostedBar.vue's settings menu (`toggleOpen`, called externally via
 * the mounted instance); on mobile there is no settings entry at all, only the floating bubble
 * toggle below, and it always starts closed. `isDesktop` re-evaluates on every breakpoint
 * crossing via `watchDesktopViewport`.
 *
 * On mobile it is a POPUP, not a full-screen overlay (owner request): full page width, but anchored
 * above the floating toggle and only as tall as the space above it, so the toggle stays visible and
 * one tap minimizes the chat. `chat-popup.ts` owns that arithmetic - the toggle's own offset is
 * measured off the live sticky bar, and an on-screen keyboard has to lift both surfaces.
 *
 * It stays modal in the "nothing behind it responds" sense even so: hosted.ts mirrors `open` onto
 * `#app.chat-notes-open`, and frontend.scss drops pointer events for the whole page except this
 * component's own subtree while that class is set on a narrow viewport. Anything added here that
 * must stay tappable therefore has to live inside `.chat-notes` - the toggle included, which is
 * exactly what makes tap-to-minimize work. */
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
      messages: [] as ChatMessage[],
      draft: "",
      authorName: "Player",
      muted: false,
      // Highest message id I have already had on screen. Unread is derived from this and the
      // sender, NOT from a wall clock - see chat-unread.ts for the two bugs that fixes (chiefly:
      // my own outgoing message used to light up my own unread badge).
      lastSeenId: 0,
      // Read checks: one receipt per reader, holding how far they have got in this thread. Loaded
      // once and then kept live off the same Realtime channel as the messages themselves.
      readReceipts: [] as ChatReadReceipt[],
      // Highest message id already reported as read by me, so re-opening the panel or every
      // incoming message doesn't fire a redundant RPC. (The RPC is idempotent and never rewinds a
      // receipt, so this is purely about not chattering.)
      reportedReadId: 0,
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
      viewportUnwatch: null as (() => void) | null,
      // Mobile only: how much of the layout viewport an on-screen keyboard is currently covering,
      // as `overlayViewportPin` reports it. Null the rest of the time, which is the point - only
      // iOS Safari's keyboard shrinks the visual viewport without resizing the layout viewport one
      // `position: fixed` anchors to; an ordinary scroll, an address-bar collapse, an elastic
      // overscroll or a pinch-zoom must all be ignored, and treating them as a keyboard is what
      // used to detach this panel from the screen. `overlayViewportPin` owns that decision;
      // `watchOverlayViewport` keeps it current on both `resize` (keyboard open/close) and `scroll`
      // (the browser chasing a focused input) events.
      viewportPin: null as OverlayViewportPin,
      viewportPinUnwatch: null as (() => void) | null,
    };
  },
  computed: {
    /** Popup geometry (mobile only - desktop is a docked full-height strip, styled purely in CSS).
     * See chat-popup.ts: the panel hangs above the toggle rather than filling the screen, so the
     * toggle stays visible and tappable to minimize it again. */
    panelStyle(): Record<string, string> {
      if (this.isDesktop) {
        return {};
      }
      const geometry = chatPopupGeometry({
        toggleBottom: this.toggleBottomOffset,
        pin: this.viewportPin,
        innerHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      });
      return { bottom: `${geometry.bottom}px`, maxHeight: `${geometry.maxHeight}px` };
    },
    toggleStyle(): Record<string, string> {
      const geometry = chatPopupGeometry({
        toggleBottom: this.toggleBottomOffset,
        pin: this.isDesktop ? null : this.viewportPin,
        innerHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      });
      // Lifted clear of the keyboard too, so "tap the bubble to minimize" survives having the
      // composer focused.
      return { bottom: `${this.toggleBottomOffset + geometry.keyboardInset}px` };
    },
    unreadCount(): number {
      // An open panel is by definition being read; `markSeen` keeps `lastSeenId` current while it
      // is, so this is belt-and-braces against a render between an arrival and that call.
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
        return "Minimize chat";
      }
      return this.hasUnread ? `Open chat, ${unreadSummary(this.unreadCount)}` : "Open chat";
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
    await this.loadMessages();
    // After the messages, not before: a device upgrading from the old timestamp receipt needs the
    // thread in hand to translate it into an id (see chat-unread.ts).
    this.lastSeenId = loadLastSeenId(this.lastSeenKey(), this.legacyLastReadKey(), this.messages);
    await this.loadMuted();
    // Deliberately not awaited: read checks are decoration on top of the thread, and blocking the
    // rest of mounted() on them would delay the panel's own layout setup below (the sticky-bar and
    // visual-viewport watchers) behind another round trip.
    loadGameChatReads(this.client, this.gameId).then((receipts) => {
      this.readReceipts = receipts;
    });
    this.subscribeChat();
    // Desktop can mount already-open (the stored preference), in which case the thread is on screen
    // right now and the others should see that straight away - and it has to be scrolled to the
    // newest message explicitly. That used to happen by accident: the list was bottom-ALIGNED, so
    // the newest message showed whatever `scrollTop` said. It is a real scroll container now.
    if (this.open) {
      this.markSeen();
      this.reportRead();
      this.$nextTick(() => this.scrollToBottom());
    }
    this.startStickyBarWatch();
    if (!this.isDesktop) {
      this.startViewportWatch();
    }
    this.viewportUnwatch = watchDesktopViewport((isDesktop) => {
      this.isDesktop = isDesktop;
      this.open = isDesktop && loadOpenPreference();
      if (isDesktop) {
        this.stopViewportWatch();
      } else {
        this.startViewportWatch();
      }
    });
  },
  beforeDestroy() {
    if (this.viewportUnwatch) {
      this.viewportUnwatch();
      this.viewportUnwatch = null;
    }
    this.stopViewportWatch();
    this.stickyBarObserver?.disconnect();
    if (this.stickyBarPoll) {
      clearInterval(this.stickyBarPoll);
    }
    if (this.channel) {
      this.client.removeChannel(this.channel);
    }
  },
  methods: {
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
    lastSeenKey(): string {
      return `chat-last-seen-id-${this.gameId}`;
    },
    /** The pre-id key this device may still be carrying - a wall-clock ms receipt. Read once on
     * mount and then left to go stale (see chat-unread.ts). */
    legacyLastReadKey(): string {
      return `chat-last-read-${this.gameId}`;
    },
    /** Everything currently in the thread is on screen (or was, when the panel closed) - so nothing
     * in it is unread any more. Called on open, on close, and on every arrival while open. */
    markSeen() {
      const newest = newestMessageId(this.messages);
      if (newest > this.lastSeenId) {
        this.lastSeenId = newest;
      }
      saveLastSeenId(this.lastSeenKey(), newest);
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
            // Measured BEFORE the push, while the DOM still shows the pre-arrival thread. Now that
            // the list genuinely scrolls, following every arrival unconditionally would yank
            // somebody reading older messages back down; only follow when they were already at the
            // newest one, or when the arrival is their own message.
            const follow = this.isAtBottom() || payload.new.user_id === this.userId;
            this.messages.push(payload.new);
            // Arriving while the panel is open means I'm looking at it - clear it locally and
            // report it read, so the sender sees the check without either of us touching anything.
            if (this.open) {
              this.markSeen();
              this.reportRead();
            }
            if (follow) {
              this.$nextTick(() => this.scrollToBottom());
            }
          }
        )
        // Second binding on the same channel rather than a second channel: read receipts are
        // scoped to exactly the same game as the messages and change at the same kind of rate.
        // INSERT (first read ever) and UPDATE (read position moving forward) both matter.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "game_chat_reads", filter: `game_id=eq.${this.gameId}` },
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
    /** Records how far I have read, for everyone else's read checks. Fire-and-forget: a failed
     * receipt must never disturb reading or sending messages. */
    reportRead() {
      const lastId = this.lastMessageId;
      if (!lastId || lastId <= this.reportedReadId) {
        return;
      }
      this.reportedReadId = lastId;
      markGameChatRead(this.client, this.gameId, lastId, this.authorName).catch(() => undefined);
    },
    scrollToBottom() {
      const el = this.$refs.messageList as HTMLElement | undefined;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    },
    /** Is the thread already parked on its newest message? A few pixels of slack, because a
     * fractional layout height means an at-the-bottom list rarely reports an exact 0. Answers
     * "true" when there is nothing to measure yet (no list rendered, or a thread too short to
     * scroll), which is the harmless direction: following an arrival is only wrong when it takes
     * the reader away from something. */
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
        this.openPanel();
      }
    },
    openPanel() {
      this.setOpen(true);
      this.markSeen();
      this.reportRead();
      this.$nextTick(() => this.scrollToBottom());
    },
    closePanel() {
      // Also on the way OUT, not just on the way in: whatever was in the thread when you closed it
      // was on screen, your own just-sent message included. Marking only on open is what left your
      // own message counting as unread the moment you closed the panel.
      this.markSeen();
      this.setOpen(false);
    },
  },
});
</script>

<style lang="scss" scoped>
// A 0.6rem dot in the corner of the bubble was too easy to miss on a busy board (owner report), so
// unread now changes the button itself: it grows from a circle into a pill carrying the count and
// the word "new", flips to the danger colour, and pulses. Shared with LobbyChatPanel.vue's own
// toggle, which mirrors these rules under its own class names.
@keyframes chat-unread-pulse {
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

.chat-notes__toggle {
  position: fixed;
  right: 1rem;
  // `bottom` is set inline (see `toggleStyle`) - dynamically measured off the live sticky bar
  // element so it always clears it regardless of that bar's current height, plus whatever an
  // on-screen keyboard is currently covering.
  z-index: 1040;
  min-width: 3rem;
  height: 3rem;
  padding: 0;
  // Half the height, so it stays a perfect circle with no content and rounds into a pill with it.
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

  &--unread {
    padding: 0 0.85rem 0 0.7rem;
    background: var(--ui-danger-solid);
    color: #fff;
    animation: chat-unread-pulse 1.9s ease-out infinite;
  }

  // Open: the bubble is the minimize control, and says so.
  &--open {
    background: var(--ui-surface);
    color: var(--ui-text);
    border: 1px solid var(--ui-border);
    font-size: 1.6rem;
  }
}

.chat-notes__toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chat-notes__toggle-text {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

// The count itself, not the old bare dot - "3" says something a dot cannot.
.chat-notes__badge {
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

  // Mobile is a POPUP, not a full-screen overlay and not a squeezed 360px dock (owner request):
  // full page width, but hanging above the floating toggle and only as tall as the space above it,
  // so the toggle stays visible and one tap minimizes it. `top`/`bottom`/`max-height` come from
  // chat-popup.ts as inline styles - the toggle's own offset is measured off the live sticky bar
  // and an on-screen keyboard shifts both - leaving only the popup's LOOK here. Height is
  // content-driven up to that max, so a two-message thread is a small card rather than a tall
  // empty box.
  @media (max-width: 767px) {
    left: 0;
    right: 0;
    top: auto;
    width: auto;
    min-height: 11rem;
    border: 1px solid var(--ui-border);
    border-radius: 1rem;
    // Deliberately heavier than the docked panel's: the board is visible above and below it now, so
    // the popup has to read as a surface floating over the game rather than part of it.
    box-shadow: 0 10px 34px var(--ui-shadow), 0 2px 8px var(--ui-shadow);
    // Keeps the header/composer corners inside the rounded frame.
    overflow: hidden;
  }
}

.chat-notes__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--ui-border);
}

.chat-notes__title {
  flex: 1;
  font-weight: 700;
  padding: 0.28rem 0.5rem;
}

// Shown on every viewport now. It used to be desktop-only, with a mobile-only back arrow standing
// in for it, because mobile was a full-screen overlay you "went back" from; a popup is minimized,
// not navigated away from, so one control does for both.
.chat-notes__close {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.2rem 0.5rem;
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
  // Keeps a flick that reaches either end of the thread from chaining out into the page behind the
  // overlay - both because scrolling the board under an open chat is the same "interacting with
  // what's behind it" the panel is there to prevent, and because the elastic overscroll it produces
  // is what makes `window.visualViewport` twitch (see overlay-viewport.ts).
  overscroll-behavior: contain;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  // Messenger-style: a handful of messages hug the bottom of the box instead of sitting stranded at
  // the top of a mostly-empty scroll area. This MUST be an auto margin on the first child, not
  // `justify-content: flex-end` (which is what it used to be): content pushed out of a scroll
  // container's START edge by alignment is not part of its scrollable overflow, so with a thread
  // longer than the box `scrollHeight` stayed equal to `clientHeight`, the list could not be
  // scrolled at all, and every older message was stranded above the top edge with no way to reach
  // it. An auto margin gets the identical look and resolves to 0 the moment the content is taller
  // than the box, leaving an ordinary scrollable overflow.
  > *:first-child {
    margin-top: auto;
  }
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

// Read checks: a right-aligned row of reader initials under the last message each person has read,
// plus a spelled-out "Read by ..." line on the newest message (initials alone are cryptic, and a
// tooltip is useless on a phone). Deliberately tiny and low-contrast - it must never compete with
// the messages themselves.
.chat-notes__readers {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin-top: -0.2rem;
}

.chat-notes__read-summary {
  font-size: 0.65rem;
  opacity: 0.6;
  margin-right: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.chat-notes__reader {
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

.chat-notes__composer {
  display: flex;
  gap: 0.4rem;
  padding: 0.5rem;
  border-top: 1px solid var(--ui-border);

  textarea {
    flex: 1;
    resize: none;
    // Same scroll-chaining containment as the message list above - a long draft scrolls inside the
    // box, never on into the board behind the overlay.
    overscroll-behavior: contain;
    min-height: 3.6rem;
    max-height: 8rem;
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
