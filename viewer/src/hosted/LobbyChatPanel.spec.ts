import { expect } from "chai";
import { mount } from "@vue/test-utils";
import LobbyChatPanel from "./LobbyChatPanel.vue";

describe("LobbyChatPanel", () => {
  function makeMessage(overrides: Partial<any> = {}) {
    return {
      id: 1,
      user_id: "user-2",
      author_name: "Luke",
      body: "hey",
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function makeClient(opts: { messages?: any[]; nickname?: string; olderBatch?: any[] } = {}) {
    const messages = opts.messages ?? [];
    const inserted: any[] = [];
    const channel = {
      on: () => channel,
      subscribe: () => channel,
      presenceState: () => ({}),
    };
    return {
      inserted,
      from: (table: string) => {
        if (table === "lobby_chat_messages") {
          return {
            select: () => ({
              order: () => ({
                limit: async () => ({ data: messages, error: null }),
              }),
              // loadOlder chains .lt().order().limit()
              lt: () => ({
                order: () => ({
                  limit: async () => ({ data: opts.olderBatch ?? [], error: null }),
                }),
              }),
            }),
            insert: async (row: any) => {
              inserted.push(row);
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

  it("starts closed with a floating toggle button", async () => {
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client: makeClient(), userId: "user-1" },
    });
    await tick(wrapper);
    expect(wrapper.find(".lobby-chat__panel").exists()).to.equal(false);
    expect(wrapper.find(".lobby-chat__toggle").exists()).to.equal(true);
  });

  it("opens and lists loaded messages with author, time, and offline status by default", async () => {
    const client = makeClient({ messages: [makeMessage()] });
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    expect(wrapper.find(".lobby-chat__panel").exists()).to.equal(true);
    expect(wrapper.text()).to.include("Luke");
    expect(wrapper.text()).to.include("hey");
    expect(wrapper.find(".lobby-chat__presence--offline").exists()).to.equal(true);
  });

  it("marks the current user's own messages distinctly from others'", async () => {
    const client = makeClient({
      messages: [
        makeMessage({ id: 1, user_id: "user-1", body: "mine" }),
        makeMessage({ id: 2, user_id: "user-2", body: "theirs" }),
      ],
    });
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    const own = wrapper.findAll(".lobby-chat__message--own");
    expect(own.length).to.equal(1);
    expect(own.at(0).text()).to.include("mine");
  });

  it("sends a message via lobby_chat_messages.insert with no game_id", async () => {
    const client = makeClient({ nickname: "Luke" });
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await wrapper.find(".lobby-chat__composer textarea").setValue("gg");
    await wrapper.find(".lobby-chat__composer").trigger("submit");
    await tick(wrapper);
    expect(client.inserted).to.deep.equal([{ user_id: "user-1", author_name: "Luke", body: "gg" }]);
  });

  it("shows a Load older button only when a full page was loaded", async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => makeMessage({ id: i + 1 }));
    const client = makeClient({ messages: fullPage });
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    expect(wrapper.find(".lobby-chat__load-older").exists()).to.equal(true);
  });

  it("prepends older messages when loadOlder runs", async () => {
    const recent = [makeMessage({ id: 5, created_at: "2026-07-11T12:00:00Z", body: "recent" })];
    const older = [makeMessage({ id: 1, created_at: "2026-07-10T12:00:00Z", body: "older" })];
    const client = makeClient({ messages: recent, olderBatch: older });
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    await (wrapper.vm as any).loadOlder();
    await tick(wrapper);
    const bodies = (wrapper.vm as any).messages.map((m: any) => m.body);
    expect(bodies).to.deep.equal(["older", "recent"]);
  });

  it("shows the unread badge for a new message that arrived while closed", async () => {
    const client = makeClient();
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    (wrapper.vm as any).messages.push(makeMessage({ id: 2 }));
    await tick(wrapper);
    expect(wrapper.find(".lobby-chat__badge").exists()).to.equal(true);
  });
});
