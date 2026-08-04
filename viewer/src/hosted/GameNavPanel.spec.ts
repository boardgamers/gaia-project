import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import GameNavPanel from "./GameNavPanel.vue";

Vue.use(BootstrapVue);

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

describe("GameNavPanel", () => {
  const session = { user: { id: "user-me", email: "me@example.com" } } as any;
  const OPEN_PREF_KEY = "game-nav-panel-open-v2";

  afterEach(() => {
    window.localStorage.removeItem(OPEN_PREF_KEY);
  });

  function makeClient(games: any[]) {
    let removedChannel: any = null;
    const channel = {
      on: () => channel,
      subscribe: () => channel,
    };
    return {
      from: (table: string) => {
        if (table === "games") {
          return {
            select: () => ({
              order: async () => ({ data: games, error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      channel: () => channel,
      removeChannel: (value: any) => {
        removedChannel = value;
      },
      get removedChannel() {
        return removedChannel;
      },
    } as any;
  }

  function game(overrides: Record<string, unknown>) {
    return {
      id: "game-1",
      name: "Test game",
      status: "active",
      player_count: 2,
      current_round: 1,
      current_seat: 0,
      created_at: "2026-07-01T00:00:00Z",
      latest_move_committed_at: "2026-07-01T00:00:00Z",
      players: [
        { seat: 0, user_id: "user-me" },
        { seat: 1, user_id: "user-other" },
      ],
      ...overrides,
    };
  }

  // GameNavPanel is desktop-only (renders nothing at all on mobile - see the component doc
  // comment) - every test that needs the panel's actual content mounted has to mock desktop. It is
  // also closed by default now, so the stored preference is what puts the content in the DOM;
  // `open: false` is for the tests that assert the default itself.
  async function mountDesktop(games: any[], { open = true }: { open?: boolean } = {}) {
    const restore = mockDesktopViewport(true);
    if (open) {
      window.localStorage.setItem(OPEN_PREF_KEY, "1");
    }
    const wrapper = mount(GameNavPanel as any, {
      propsData: { client: makeClient(games), session },
    });
    await Vue.nextTick();
    await Vue.nextTick();
    return { wrapper, restore };
  }

  it("renders nothing at all on mobile, not even a toggle", async () => {
    const wrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
    await Vue.nextTick();
    await Vue.nextTick();
    expect(wrapper.html()).to.equal("");
    wrapper.destroy();
  });

  it("sorts my active games with my-turn first, filters out other players' games and open/finished games", async () => {
    const games = [
      game({ id: "not-mine", players: [{ seat: 0, user_id: "someone-else" }] }),
      game({ id: "open-game", status: "open" }),
      game({ id: "finished-game", status: "finished" }),
      game({ id: "waiting", current_seat: 1 }),
      game({ id: "my-turn", current_seat: 0 }),
    ];
    const { wrapper, restore } = await mountDesktop(games);
    const vm = wrapper.vm as any;
    expect(vm.myActiveGames.map((g: any) => g.id)).to.deep.equal(["my-turn", "waiting"]);
    wrapper.destroy();
    restore();
  });

  it("renders each row through the shared GameBar.vue (name, round, and player avatars all present)", async () => {
    const games = [
      game({
        id: "my-turn",
        current_seat: 0,
        players: [
          { seat: 0, user_id: "user-me", faction: "terrans", score: 12 },
          { seat: 1, user_id: "user-other", faction: "xenos", score: 9 },
        ],
      }),
    ];
    const { wrapper, restore } = await mountDesktop(games);
    expect(wrapper.find(".game-bar__title").text()).to.include("Test game");
    expect(wrapper.find(".game-bar__round").text()).to.equal("R1");
    expect(wrapper.findAll(".game-bar__avatar")).to.have.lengthOf(2);
    wrapper.destroy();
    restore();
  });

  it("emits select-game when an active-game row is clicked, without navigating, and stays open", async () => {
    const games = [game({ id: "my-turn", current_seat: 0 })];
    const { wrapper, restore } = await mountDesktop(games);
    const row = wrapper.find("a.game-bar__link");
    expect(row.exists()).to.equal(true);
    await row.trigger("click");
    expect(wrapper.emitted("select-game")).to.deep.equal([["my-turn"]]);
    // Docked desktop panel doesn't cover the board, so selecting a game leaves it open (unlike
    // the mobile full-screen overlay this used to also be).
    expect((wrapper.vm as any).open).to.equal(true);
    wrapper.destroy();
    restore();
  });

  it("does not intercept clicks on open-lobby rows - they keep their real ?preview= navigation", async () => {
    const games = [game({ id: "open-game", status: "open", players: [] })];
    const { wrapper, restore } = await mountDesktop(games);
    (wrapper.vm as any).tab = "open";
    await Vue.nextTick();
    const row = wrapper.find("a.game-bar__link");
    expect(row.attributes("href")).to.equal("?preview=open-game");
    await row.trigger("click");
    expect(wrapper.emitted("select-game")).to.equal(undefined);
    wrapper.destroy();
    restore();
  });

  it("removes the realtime channel on destroy", async () => {
    const { wrapper, restore } = await mountDesktop([]);
    const client = (wrapper.vm as any).client;
    wrapper.destroy();
    expect(client.removedChannel).to.not.equal(null);
    restore();
  });

  // Defaults to CLOSED so an in-game desktop window is all board (see the component doc comment) -
  // the 420px docked panel is one settings-menu click away instead.
  it("defaults to closed on desktop, renders nothing (no open state to check) on mobile", async () => {
    const { wrapper: desktopWrapper, restore: restoreDesktop } = await mountDesktop([], { open: false });
    expect((desktopWrapper.vm as any).open).to.equal(false);
    expect(desktopWrapper.find(".game-nav__panel").exists()).to.equal(false);
    desktopWrapper.destroy();
    restoreDesktop();

    const mobileWrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
    await Vue.nextTick();
    expect(mobileWrapper.html()).to.equal("");
    mobileWrapper.destroy();
  });

  it("persists the opened preference on desktop and honors it on the next mount", async () => {
    const { wrapper, restore } = await mountDesktop([], { open: false });
    (wrapper.vm as any).setOpen(true);
    await Vue.nextTick();
    expect(window.localStorage.getItem(OPEN_PREF_KEY)).to.equal("1");
    wrapper.destroy();

    const { wrapper: reopened } = await mountDesktop([], { open: false });
    expect((reopened.vm as any).open).to.equal(true);
    reopened.destroy();
    restore();
  });
});
