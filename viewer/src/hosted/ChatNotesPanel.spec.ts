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
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return {
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

  it("pins the mobile panel to window.visualViewport so the keyboard can't expose the board underneath", async () => {
    const restoreMobile = mockDesktopViewport(false);
    const listeners: Record<string, () => void> = {};
    const fakeVisualViewport = {
      offsetTop: 0,
      height: 640,
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
    expect(wrapper.find(".chat-notes__panel").attributes("style")).to.include("height: 640px");

    // Simulate the on-screen keyboard opening: the visible area shrinks and shifts.
    fakeVisualViewport.height = 380;
    fakeVisualViewport.offsetTop = 20;
    listeners.resize();
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__panel").attributes("style")).to.include("height: 380px");
    expect(wrapper.find(".chat-notes__panel").attributes("style")).to.include("top: 20px");

    wrapper.destroy();
    (window as any).visualViewport = previousVv;
    restoreMobile();
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
