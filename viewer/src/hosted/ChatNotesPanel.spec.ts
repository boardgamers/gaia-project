import { expect } from "chai";
import { mount } from "@vue/test-utils";
import ChatNotesPanel from "./ChatNotesPanel.vue";

function mockDesktopViewport(matches: boolean) {
  const previous = window.matchMedia;
  (window as any).matchMedia = (query: string) => ({
    media: query,
    matches,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
  return () => {
    (window as any).matchMedia = previous;
  };
}

describe("ChatNotesPanel", () => {
  function makeClient(
    opts: { messages?: any[]; nickname?: string; noteBody?: string; muted?: boolean; reads?: any[] } = {}
  ) {
    const messages = opts.messages ?? [];
    const inserted: any[] = [];
    const upserts: any[] = [];
    const rpcCalls: { name: string; args: any }[] = [];
    let muted = opts.muted ?? false;
    // Captures the Realtime handlers so a test can deliver an INSERT the way the server would.
    const handlers: Record<string, (payload: any) => void> = {};
    const channel = {
      on: (_event: string, filter: { table: string }, cb: (payload: any) => void) => {
        handlers[filter.table] = cb;
        return channel;
      },
      subscribe: () => channel,
    };
    return {
      handlers,
      inserted,
      upserts,
      rpcCalls,
      rpc: async (name: string, args: any) => {
        rpcCalls.push({ name, args });
        return { data: null, error: null };
      },
      get muted() {
        return muted;
      },
      from: (table: string) => {
        if (table === "game_chat_mutes") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: muted ? { game_id: "game-1" } : null, error: null }),
                }),
              }),
            }),
            insert: async () => {
              muted = true;
              return { data: null, error: null };
            },
            delete: () => ({
              eq: () => ({
                eq: async () => {
                  muted = false;
                  return { data: null, error: null };
                },
              }),
            }),
          };
        }
        if (table === "game_chat_messages") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: messages, error: null }),
                }),
              }),
            }),
            insert: async (row: any) => {
              inserted.push(row);
              return { data: null, error: null };
            },
          };
        }
        if (table === "game_chat_reads") {
          return {
            select: () => ({
              eq: async () => ({ data: opts.reads ?? [], error: null }),
            }),
          };
        }
        if (table === "game_notes") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: opts.noteBody !== undefined ? { body: opts.noteBody } : null,
                    error: null,
                  }),
                }),
              }),
            }),
            upsert: async (row: any) => {
              upserts.push(row);
              return { data: null, error: null };
            },
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { nickname: opts.nickname ?? "" }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      channel: () => channel,
      removeChannel: () => undefined,
    };
  }

  afterEach(() => {
    window.localStorage.clear();
  });

  it("starts closed with a floating toggle button", async () => {
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__panel").exists()).to.equal(false);
    expect(wrapper.find(".chat-notes__toggle").exists()).to.equal(true);
  });

  it("opens the chat panel and lists loaded messages", async () => {
    const client = makeClient({
      messages: [
        {
          id: 1,
          game_id: "game-1",
          user_id: "user-2",
          author_name: "Luke",
          body: "hey",
          created_at: new Date().toISOString(),
        },
      ],
    });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__panel").exists()).to.equal(true);
    expect(wrapper.find(".chat-notes__title").text()).to.equal("Chat");
    expect(wrapper.text()).to.include("Luke");
    expect(wrapper.text()).to.include("hey");
  });

  it("shows a send-time and an offline status dot per message by default", async () => {
    const client = makeClient({
      messages: [
        {
          id: 1,
          game_id: "game-1",
          user_id: "user-2",
          author_name: "Luke",
          body: "hey",
          created_at: new Date().toISOString(),
        },
      ],
    });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__time").exists()).to.equal(true);
    expect(wrapper.find(".chat-notes__presence--offline").exists()).to.equal(true);
  });

  it("shows an online status dot when presenceState has an entry for that sender", async () => {
    const client = makeClient({
      messages: [
        {
          id: 1,
          game_id: "game-1",
          user_id: "user-2",
          author_name: "Luke",
          body: "hey",
          created_at: new Date().toISOString(),
        },
      ],
    });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    (wrapper.vm as any).presenceState = { "user-2": [{ context: { type: "lobby" }, focused: true }] };
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__presence--online").exists()).to.equal(true);
  });

  it("sends a message via game_chat_messages.insert with the caller's nickname", async () => {
    const client = makeClient({ nickname: "Luke" });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await wrapper.find(".chat-notes__composer textarea").setValue("gg");
    await wrapper.find(".chat-notes__composer").trigger("submit");
    await Vue_nextTick(wrapper);
    expect(client.inserted).to.deep.equal([{ game_id: "game-1", user_id: "user-1", author_name: "Luke", body: "gg" }]);
  });

  it("shows the unread badge for a new message that arrived while the panel is closed", async () => {
    const client = makeClient();
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    (wrapper.vm as any).messages.push({
      id: 2,
      game_id: "game-1",
      user_id: "user-2",
      author_name: "Luke",
      body: "hi",
      created_at: new Date().toISOString(),
    });
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__badge").exists()).to.equal(true);
  });

  it("counts the unread messages on the badge instead of showing a bare dot", async () => {
    const client = makeClient();
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    for (const id of [2, 3, 4]) {
      (wrapper.vm as any).messages.push({
        id,
        game_id: "game-1",
        user_id: "user-2",
        author_name: "Luke",
        body: "hi",
        created_at: new Date().toISOString(),
      });
    }
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__badge").text()).to.equal("3");
    expect(wrapper.find(".chat-notes__toggle").attributes("aria-label")).to.equal("Open chat, 3 new messages");
  });

  // The owner's report: writing in the chat lit up your own chat button. `markRead` only ran on
  // OPEN, and unread was "the newest message is newer than that mark" with no regard to who sent
  // it - so your own message, sent after opening, counted as unread the moment you closed again.
  it("never flags my own message as unread, whether I close the panel after it or not", async () => {
    const client = makeClient({ nickname: "Me" });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await wrapper.find(".chat-notes__composer textarea").setValue("gg");
    await wrapper.find(".chat-notes__composer").trigger("submit");
    await Vue_nextTick(wrapper);
    // The insert comes back over Realtime like any other message.
    client.handlers.game_chat_messages({
      new: { id: 5, game_id: "game-1", user_id: "user-1", author_name: "Me", body: "gg", created_at: "" },
    });
    await Vue_nextTick(wrapper);

    (wrapper.vm as any).closePanel();
    await Vue_nextTick(wrapper);
    expect((wrapper.vm as any).open).to.equal(false);
    expect((wrapper.vm as any).unreadCount).to.equal(0);
    expect(wrapper.find(".chat-notes__badge").exists()).to.equal(false);

    // ...and somebody else's reply still does light it up.
    client.handlers.game_chat_messages({
      new: { id: 6, game_id: "game-1", user_id: "user-2", author_name: "Luke", body: "hi", created_at: "" },
    });
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__badge").text()).to.equal("1");
  });

  it("clears the badge for messages that were on screen when the panel closed", async () => {
    const client = makeClient();
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    client.handlers.game_chat_messages({
      new: { id: 9, game_id: "game-1", user_id: "user-2", author_name: "Luke", body: "hi", created_at: "" },
    });
    await Vue_nextTick(wrapper);

    (wrapper.vm as any).closePanel();
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__badge").exists()).to.equal(false);
    // Persisted, so a reload doesn't resurrect it.
    expect(window.localStorage.getItem("chat-last-seen-id-game-1")).to.equal("9");
  });

  it("carries a pre-upgrade timestamp receipt over instead of re-flagging the whole thread", async () => {
    window.localStorage.setItem("chat-last-read-game-1", String(Date.parse("2026-08-04T10:00:30Z")));
    const client = makeClient({
      messages: [
        {
          id: 1,
          game_id: "game-1",
          user_id: "user-2",
          author_name: "Luke",
          body: "old",
          created_at: "2026-08-04T10:00:00Z",
        },
        {
          id: 2,
          game_id: "game-1",
          user_id: "user-2",
          author_name: "Luke",
          body: "new",
          created_at: "2026-08-04T10:01:00Z",
        },
      ],
    });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await Vue_nextTick(wrapper);
    await Vue_nextTick(wrapper);
    // Only the message that arrived after the old receipt is unread - not both.
    expect((wrapper.vm as any).unreadCount).to.equal(1);
  });

  it("defaults to unmuted and shows the receiving-notifications label", async () => {
    const client = makeClient();
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(wrapper.text()).to.include("Receiving push notifications");
  });

  it("loads an existing mute and lets the user unmute", async () => {
    const client = makeClient({ muted: true });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(wrapper.text()).to.include("Muted");

    await wrapper.find(".chat-notes__mute-toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(client.muted).to.equal(false);
    expect(wrapper.text()).to.include("Receiving push notifications");
  });

  it("mutes on click and persists it via game_chat_mutes.insert", async () => {
    const client = makeClient();
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    // Two ticks so mounted()'s async loadMuted() settles its initial (unmuted) read before we click -
    // otherwise it can resolve after the click and clobber the optimistic mute back to false.
    await Vue_nextTick(wrapper);
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await wrapper.find(".chat-notes__mute-toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(client.muted).to.equal(true);
    expect(wrapper.text()).to.include("Muted");
  });

  async function Vue_nextTick(wrapper: any) {
    await wrapper.vm.$nextTick();
  }

  it("shows a read check under the last message each other reader has reached", async () => {
    const client = makeClient({
      messages: [
        {
          id: 1,
          game_id: "game-1",
          user_id: "user-1",
          author_name: "Me",
          body: "one",
          created_at: "2026-08-04T10:00:00Z",
        },
        {
          id: 2,
          game_id: "game-1",
          user_id: "user-1",
          author_name: "Me",
          body: "two",
          created_at: "2026-08-04T10:01:00Z",
        },
      ],
      reads: [
        {
          user_id: "user-2",
          reader_name: "Luke Skywalker",
          last_read_message_id: 1,
          last_read_at: "2026-08-04T10:00:30Z",
        },
        { user_id: "user-3", reader_name: "Leia", last_read_message_id: 2, last_read_at: "2026-08-04T10:02:00Z" },
        // My own receipt is never shown back to me.
        { user_id: "user-1", reader_name: "Me", last_read_message_id: 2, last_read_at: "2026-08-04T10:02:00Z" },
      ],
    });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);

    const rows = wrapper.findAll(".chat-notes__readers");
    expect(rows.length).to.equal(2);
    expect(rows.at(0).text()).to.include("LS");
    expect(rows.at(0).text()).to.not.include("LE");
    // The newest message spells the names out; older ones stay initials-only.
    expect(rows.at(1).text()).to.include("Read by Leia");
    expect(rows.at(0).text()).to.not.include("Read by");
  });

  it("reports my own read position through mark_game_chat_read when the panel opens", async () => {
    const client = makeClient({
      nickname: "Luke",
      messages: [
        {
          id: 7,
          game_id: "game-1",
          user_id: "user-2",
          author_name: "Leia",
          body: "hi",
          created_at: "2026-08-04T10:00:00Z",
        },
      ],
    });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await Vue_nextTick(wrapper);
    expect(client.rpcCalls.length).to.equal(0);

    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(client.rpcCalls).to.deep.equal([
      { name: "mark_game_chat_read", args: { p_game_id: "game-1", p_message_id: 7, p_reader_name: "Luke" } },
    ]);

    // Re-opening without a newer message must not re-report.
    (wrapper.vm as any).closePanel();
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(client.rpcCalls.length).to.equal(1);
  });

  // Desktop defaults to CLOSED (see the component doc comment): docked, this panel reserved 360px
  // of the window that the board should have. It has no floating toggle on desktop either - it is
  // opened from HostedBar.vue's settings menu.
  it("defaults to closed with no floating toggle on desktop, closed with a toggle on mobile", async () => {
    const restoreDesktop = mockDesktopViewport(true);
    const desktopWrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(desktopWrapper);
    expect((desktopWrapper.vm as any).open).to.equal(false);
    expect(desktopWrapper.find(".chat-notes__panel").exists()).to.equal(false);
    expect(desktopWrapper.find(".chat-notes__toggle").exists()).to.equal(false);
    desktopWrapper.destroy();
    restoreDesktop();

    const restoreMobile = mockDesktopViewport(false);
    const mobileWrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(mobileWrapper);
    expect((mobileWrapper.vm as any).open).to.equal(false);
    expect(mobileWrapper.find(".chat-notes__toggle").exists()).to.equal(true);
    mobileWrapper.destroy();
    restoreMobile();
  });

  // The message list is a real scroll container (it hugs the bottom via an auto margin on its first
  // child; it used to be bottom-ALIGNED with `justify-content: flex-end`, which silently made a
  // thread longer than the box unscrollable). That means an incoming message now genuinely moves the
  // view, so it must only do so when the reader is already on the newest message.
  async function openWithScrollState(client: any, scroll: { scrollTop: number; scrollHeight: number }) {
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    const list = { clientHeight: 400, ...scroll };
    (wrapper.vm as any).$refs.messageList = list;
    return { wrapper, list };
  }

  it("follows an incoming message only when the reader is already at the newest one", async () => {
    const client = makeClient();
    // Scrolled up reading history: 2000px of thread, parked near the top.
    const { wrapper, list } = await openWithScrollState(client, { scrollTop: 100, scrollHeight: 2000 });
    client.handlers.game_chat_messages({
      new: { id: 7, game_id: "game-1", user_id: "someone-else", author_name: "P", body: "hi", created_at: "" },
    });
    await Vue_nextTick(wrapper);
    expect(list.scrollTop).to.equal(100);
    wrapper.destroy();
  });

  it("does follow when the reader is at the bottom, or when the message is their own", async () => {
    const client = makeClient();
    const atBottom = await openWithScrollState(client, { scrollTop: 1600, scrollHeight: 2000 });
    client.handlers.game_chat_messages({
      new: { id: 7, game_id: "game-1", user_id: "someone-else", author_name: "P", body: "hi", created_at: "" },
    });
    await Vue_nextTick(atBottom.wrapper);
    expect(atBottom.list.scrollTop).to.equal(2000);
    atBottom.wrapper.destroy();

    // Sending from a scrolled-up position still jumps to your own message.
    const ownClient = makeClient();
    const own = await openWithScrollState(ownClient, { scrollTop: 100, scrollHeight: 2000 });
    ownClient.handlers.game_chat_messages({
      new: { id: 8, game_id: "game-1", user_id: "user-1", author_name: "Me", body: "mine", created_at: "" },
    });
    await Vue_nextTick(own.wrapper);
    expect(own.list.scrollTop).to.equal(2000);
    own.wrapper.destroy();
  });

  // The mobile panel is a popup hanging above the floating toggle, not a full-screen overlay: the
  // toggle has to stay visible so one tap minimizes the chat again (owner request). The arithmetic
  // itself is chat-popup.ts's; this checks the component actually applies it, including when an
  // on-screen keyboard eats the bottom of the visible area.
  it("sizes the mobile panel as a popup above the toggle, and lifts both clear of the keyboard", async () => {
    const restoreMobile = mockDesktopViewport(false);
    const listeners: Record<string, () => void> = {};
    const fakeVisualViewport = {
      scale: 1,
      offsetTop: 0,
      height: window.innerHeight,
      addEventListener: (type: string, cb: () => void) => {
        listeners[type] = cb;
      },
      removeEventListener: (type: string) => {
        delete listeners[type];
      },
    };
    const previousVv = (window as any).visualViewport;
    (window as any).visualViewport = fakeVisualViewport;

    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    const panelStyle = () => (wrapper.vm as any).panelStyle;
    const toggleStyle = () => (wrapper.vm as any).toggleStyle;
    // 24px toggle offset + a 48px toggle + a 10px gap, and a max height that leaves the toggle AND
    // a strip of the game visible - i.e. it does not fill the screen.
    expect(panelStyle().bottom).to.equal("82px");
    expect(panelStyle().maxHeight).to.equal(`${window.innerHeight - 82 - 64}px`);
    expect(toggleStyle().bottom).to.equal("24px");

    // An ordinary scroll on iOS (address bar sliding away, elastic overscroll at the end of the
    // thread) moves the visual viewport around without a keyboard being up - nothing should move.
    fakeVisualViewport.offsetTop = 60;
    fakeVisualViewport.height = window.innerHeight - 90;
    listeners.scroll();
    await Vue_nextTick(wrapper);
    expect(panelStyle().bottom).to.equal("82px");
    expect(toggleStyle().bottom).to.equal("24px");

    // The on-screen keyboard opening: the visible area shrinks and shifts, so 368px of the layout
    // viewport's bottom is hidden and both surfaces have to rise by exactly that.
    fakeVisualViewport.height = 380;
    fakeVisualViewport.offsetTop = 20;
    listeners.resize();
    await Vue_nextTick(wrapper);
    const keyboardInset = window.innerHeight - 400;
    expect(panelStyle().bottom).to.equal(`${82 + keyboardInset}px`);
    expect(panelStyle().maxHeight).to.equal(`${380 - 82 - 64}px`);
    expect(toggleStyle().bottom).to.equal(`${24 + keyboardInset}px`);

    // ...and back down once it closes.
    fakeVisualViewport.height = window.innerHeight;
    fakeVisualViewport.offsetTop = 0;
    listeners.resize();
    await Vue_nextTick(wrapper);
    expect(panelStyle().bottom).to.equal("82px");
    expect(toggleStyle().bottom).to.equal("24px");

    // Desktop is a docked full-height strip - no popup geometry there at all.
    (wrapper.vm as any).isDesktop = true;
    await Vue_nextTick(wrapper);
    expect(panelStyle()).to.deep.equal({});

    wrapper.destroy();
    (window as any).visualViewport = previousVv;
    restoreMobile();
  });

  // Without this, a swipe starting on the popup's header / notifications strip / composer - none of
  // which is a scroll container - chains out to the document and scrolls the game behind the popup
  // instead of the thread (owner report, reproduced in a real browser).
  it("locks the page while the mobile popup is open, and releases it on close and on teardown", async () => {
    const restoreMobile = mockDesktopViewport(false);
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(false);

    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(true);

    (wrapper.vm as any).closePanel();
    await Vue_nextTick(wrapper);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(false);

    // Destroyed while still open must not strand the page locked - an in-app game switch does
    // exactly that.
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(true);
    wrapper.destroy();
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(false);
    restoreMobile();
  });

  it("never locks the page for the desktop dock, which sits beside a page that should still scroll", async () => {
    const restoreDesktop = mockDesktopViewport(true);
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    (wrapper.vm as any).toggleOpen();
    await Vue_nextTick(wrapper);
    expect((wrapper.vm as any).open).to.equal(true);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(false);
    wrapper.destroy();
    restoreDesktop();
  });

  it("persists the opened preference on desktop and honors it on the next mount, but never applies it on mobile", async () => {
    const restoreDesktop = mockDesktopViewport(true);
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    (wrapper.vm as any).toggleOpen();
    await Vue_nextTick(wrapper);
    expect((wrapper.vm as any).open).to.equal(true);
    expect(window.localStorage.getItem("chat-notes-panel-open-v2")).to.equal("1");
    wrapper.destroy();

    const reopened = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(reopened);
    expect((reopened.vm as any).open).to.equal(true);
    reopened.destroy();
    restoreDesktop();

    const restoreMobile = mockDesktopViewport(false);
    const mobileWrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(mobileWrapper);
    expect((mobileWrapper.vm as any).open).to.equal(false);
    mobileWrapper.destroy();
    restoreMobile();
  });
});
