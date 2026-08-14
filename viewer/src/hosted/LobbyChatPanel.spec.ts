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

  function makeClient(opts: { messages?: any[]; nickname?: string; olderBatch?: any[]; reads?: any[] } = {}) {
    const messages = opts.messages ?? [];
    const inserted: any[] = [];
    const rpcCalls: { name: string; args: any }[] = [];
    // Captures the Realtime handlers so a test can deliver an INSERT the way the server would.
    const handlers: Record<string, (payload: any) => void> = {};
    const channel = {
      on: (_event: string, filter: { table: string }, cb: (payload: any) => void) => {
        handlers[filter.table] = cb;
        return channel;
      },
      subscribe: () => channel,
      presenceState: () => ({}),
    };
    return {
      handlers,
      inserted,
      rpcCalls,
      rpc: async (name: string, args: any) => {
        rpcCalls.push({ name, args });
        return { data: null, error: null };
      },
      from: (table: string) => {
        if (table === "lobby_chat_reads") {
          return {
            select: async () => ({ data: opts.reads ?? [], error: null }),
          };
        }
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

  it("shows read checks for other readers and reports my own position on open", async () => {
    const client = makeClient({
      nickname: "Luke",
      messages: [makeMessage({ id: 4, user_id: "user-1", body: "mine" })],
      reads: [
        {
          user_id: "user-2",
          reader_name: "Leia Organa",
          last_read_message_id: 4,
          last_read_at: "2026-08-04T10:00:00Z",
        },
      ],
    });
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    await tick(wrapper);
    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);

    expect(wrapper.find(".lobby-chat__readers").text()).to.include("Read by Leia Organa");
    expect(wrapper.find(".lobby-chat__reader").text()).to.equal("LO");
    expect(client.rpcCalls).to.deep.equal([
      { name: "mark_lobby_chat_read", args: { p_message_id: 4, p_reader_name: "Luke" } },
    ]);
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
    expect(wrapper.find(".lobby-chat__badge").text()).to.equal("1");
  });

  // Same owner-reported bug as ChatNotesPanel's (see its spec): unread used to be a wall-clock
  // comparison that ignored the sender, so your own message lit your own button.
  it("never flags my own message as unread, and clears anything on screen when the popup closes", async () => {
    const client = makeClient({ nickname: "Me" });
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client, userId: "user-1" },
    });
    await tick(wrapper);
    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    client.handlers.lobby_chat_messages({ new: makeMessage({ id: 5, user_id: "user-1", author_name: "Me" }) });
    await tick(wrapper);

    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    expect((wrapper.vm as any).open).to.equal(false);
    expect(wrapper.find(".lobby-chat__badge").exists()).to.equal(false);
    expect(window.localStorage.getItem("lobby-chat-last-seen-id")).to.equal("5");

    // Somebody else's reply still lights it up.
    client.handlers.lobby_chat_messages({ new: makeMessage({ id: 6 }) });
    await tick(wrapper);
    expect(wrapper.find(".lobby-chat__badge").text()).to.equal("1");
  });

  it("locks the page while the mobile popup is open so a swipe on it can't scroll the lobby behind", async () => {
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client: makeClient(), userId: "user-1" },
    });
    await tick(wrapper);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(false);

    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(true);

    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(false);

    // ...and a teardown while open must not strand it.
    await wrapper.find(".lobby-chat__toggle").trigger("click");
    await tick(wrapper);
    wrapper.destroy();
    expect(document.documentElement.classList.contains("chat-popup-open")).to.equal(false);
  });

  it("keeps the mobile popup at a fixed available height above the toggle", async () => {
    const wrapper = mount(LobbyChatPanel as any, {
      propsData: { client: makeClient(), userId: "user-1" },
    });
    await tick(wrapper);
    // 24px toggle offset + a 48px toggle + a 10px gap (see chat-popup.ts).
    expect((wrapper.vm as any).panelStyle.bottom).to.equal("82px");
    expect((wrapper.vm as any).panelStyle.maxHeight).to.equal(`${window.innerHeight - 82 - 64}px`);
    expect((wrapper.vm as any).panelStyle.height).to.equal((wrapper.vm as any).panelStyle.maxHeight);

    // Desktop keeps the docked full-height strip - no popup geometry there.
    (wrapper.vm as any).isDesktop = true;
    await tick(wrapper);
    expect((wrapper.vm as any).panelStyle).to.deep.equal({});
  });
});
