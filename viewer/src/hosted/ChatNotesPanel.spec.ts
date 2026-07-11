import { expect } from "chai";
import { mount } from "@vue/test-utils";
import ChatNotesPanel from "./ChatNotesPanel.vue";

describe("ChatNotesPanel", () => {
  function makeClient(opts: { messages?: any[]; nickname?: string; noteBody?: string } = {}) {
    const messages = opts.messages ?? [];
    const inserted: any[] = [];
    const upserts: any[] = [];
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return {
      inserted,
      upserts,
      from: (table: string) => {
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
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await Vue_nextTick(wrapper);
    expect(wrapper.find(".chat-notes__panel").exists()).to.equal(true);
    expect(wrapper.find(".chat-notes__tab--active").text()).to.equal("Chat");
    expect(wrapper.text()).to.include("Luke");
    expect(wrapper.text()).to.include("hey");
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

  it("loads existing notes and switching to the Notes tab shows them", async () => {
    const client = makeClient({ noteBody: "remember to build a mine" });
    const wrapper = mount(ChatNotesPanel as any, {
      propsData: { client, gameId: "game-1", userId: "user-1" },
    });
    await Vue_nextTick(wrapper);
    await wrapper.find(".chat-notes__toggle").trigger("click");
    await wrapper.findAll(".chat-notes__tab").at(1).trigger("click");
    await Vue_nextTick(wrapper);
    expect((wrapper.find(".chat-notes__notes-textarea").element as HTMLTextAreaElement).value).to.equal(
      "remember to build a mine"
    );
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

  async function Vue_nextTick(wrapper: any) {
    await wrapper.vm.$nextTick();
  }
});
