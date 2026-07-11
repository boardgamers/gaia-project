import { expect } from "chai";
import { mount } from "@vue/test-utils";
import ChatNotesPanel, { loadChatOpenPreference, saveChatOpenPreference } from "./ChatNotesPanel.vue";

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

  async function tick(wrapper: any) {
    await wrapper.vm.$nextTick();
  }

  it("defaults open on a desktop-width viewport (jsdom's own default) with no stored preference", async () => {
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    expect((wrapper.vm as any).open).to.equal(true);
    expect(wrapper.find(".chat-notes__panel").exists()).to.equal(true);
  });

  it("a saved closed preference is honored on mount", async () => {
    saveChatOpenPreference(false);
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    expect((wrapper.vm as any).open).to.equal(false);
    expect(wrapper.find(".chat-notes__panel").exists()).to.equal(false);
  });

  it("closing the panel persists the preference for the next mount", async () => {
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client: makeClient(), gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".chat-notes__close").trigger("click");
    expect((wrapper.vm as any).open).to.equal(false);
    expect(loadChatOpenPreference()).to.equal(false);
  });

  it("opens to the chat tab by default and lists loaded messages", async () => {
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
    await tick(wrapper);
    await tick(wrapper);
    expect(wrapper.find(".chat-notes__tab--active").text()).to.equal("Chat");
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
    await tick(wrapper);
    await tick(wrapper);
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
    await tick(wrapper);
    (wrapper.vm as any).presenceState = { "user-2": [{ context: { type: "lobby" }, focused: true }] };
    await tick(wrapper);
    expect(wrapper.find(".chat-notes__presence--online").exists()).to.equal(true);
  });

  it("sends a message via game_chat_messages.insert with the caller's nickname", async () => {
    const client = makeClient({ nickname: "Luke" });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".chat-notes__composer textarea").setValue("gg");
    await wrapper.find(".chat-notes__composer").trigger("submit");
    await tick(wrapper);
    expect(client.inserted).to.deep.equal([{ game_id: "game-1", user_id: "user-1", author_name: "Luke", body: "gg" }]);
  });

  it("loads existing notes and switching to the Notes tab shows them", async () => {
    const client = makeClient({ noteBody: "remember to build a mine" });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.findAll(".chat-notes__tab").at(1).trigger("click");
    await tick(wrapper);
    expect((wrapper.find(".chat-notes__notes-textarea").element as HTMLTextAreaElement).value).to.equal(
      "remember to build a mine"
    );
  });

  it("defaults to unmuted and shows the receiving-notifications label", async () => {
    const client = makeClient();
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    await tick(wrapper);
    expect(wrapper.text()).to.include("Receiving push notifications");
  });

  it("loads an existing mute and lets the user unmute", async () => {
    const client = makeClient({ muted: true });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    await tick(wrapper);
    await tick(wrapper);
    expect(wrapper.text()).to.include("Muted");

    await wrapper.find(".chat-notes__mute-toggle").trigger("click");
    await tick(wrapper);
    expect(client.muted).to.equal(false);
    expect(wrapper.text()).to.include("Receiving push notifications");
  });

  it("mutes on click and persists it via game_chat_mutes.insert", async () => {
    const client = makeClient();
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".chat-notes__mute-toggle").trigger("click");
    await tick(wrapper);
    expect(client.muted).to.equal(true);
    expect(wrapper.text()).to.include("Muted");
  });
});
