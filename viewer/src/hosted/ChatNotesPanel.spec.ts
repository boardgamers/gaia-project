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
  function makeClient(opts: { messages?: any[]; nickname?: string; noteBody?: string; muted?: boolean } = {}) {
    const messages = opts.messages ?? [];
    const inserted: any[] = [];
    const upserts: any[] = [];
    let muted = opts.muted ?? false;
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return {
      inserted,
      upserts,
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
