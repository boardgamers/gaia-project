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
  const OPEN_PREF_KEY = "game-nav-panel-open";

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

  async function openPanel(games: any[]) {
    const wrapper = mount(GameNavPanel as any, {
      propsData: { client: makeClient(games), session },
    });
    await Vue.nextTick();
    await Vue.nextTick();
    (wrapper.vm as any).open = true;
    await Vue.nextTick();
    return wrapper;
  }

  it("sorts my active games with my-turn first, filters out other players' games and open/finished games", async () => {
    const games = [
      game({ id: "not-mine", players: [{ seat: 0, user_id: "someone-else" }] }),
      game({ id: "open-game", status: "open" }),
      game({ id: "finished-game", status: "finished" }),
      game({ id: "waiting", current_seat: 1 }),
      game({ id: "my-turn", current_seat: 0 }),
    ];
    const wrapper = await openPanel(games);
    const vm = wrapper.vm as any;
    expect(vm.myActiveGames.map((g: any) => g.id)).to.deep.equal(["my-turn", "waiting"]);
  });

  it("emits select-game and closes the panel when an active-game row is clicked, without navigating", async () => {
    const games = [game({ id: "my-turn", current_seat: 0 })];
    const wrapper = await openPanel(games);
    const row = wrapper.find("a.game-nav__row");
    expect(row.exists()).to.equal(true);
    await row.trigger("click");
    expect(wrapper.emitted("select-game")).to.deep.equal([["my-turn"]]);
    expect((wrapper.vm as any).open).to.equal(false);
  });

  it("does not intercept clicks on open-lobby rows - they keep their real ?preview= navigation", async () => {
    const games = [game({ id: "open-game", status: "open", players: [] })];
    const wrapper = await openPanel(games);
    (wrapper.vm as any).tab = "open";
    await Vue.nextTick();
    const row = wrapper.find("a.game-nav__row");
    expect(row.attributes("href")).to.equal("?preview=open-game");
    await row.trigger("click");
    expect(wrapper.emitted("select-game")).to.equal(undefined);
  });

  it("removes the realtime channel on destroy", async () => {
    const client = makeClient([]);
    const wrapper = mount(GameNavPanel as any, { propsData: { client, session } });
    await Vue.nextTick();
    wrapper.destroy();
    expect(client.removedChannel).to.not.equal(null);
  });

  it("defaults to open with no floating toggle on desktop, closed with a toggle on mobile", async () => {
    const restoreDesktop = mockDesktopViewport(true);
    const desktopWrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
    await Vue.nextTick();
    expect((desktopWrapper.vm as any).open).to.equal(true);
    expect(desktopWrapper.find("button.game-nav__toggle").exists()).to.equal(false);
    desktopWrapper.destroy();
    restoreDesktop();

    const restoreMobile = mockDesktopViewport(false);
    const mobileWrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
    await Vue.nextTick();
    expect((mobileWrapper.vm as any).open).to.equal(false);
    expect(mobileWrapper.find("button.game-nav__toggle").exists()).to.equal(true);
    mobileWrapper.destroy();
    restoreMobile();
  });

  it("persists the closed preference on desktop and honors it on the next mount, but never applies it on mobile", async () => {
    const restoreDesktop = mockDesktopViewport(true);
    const wrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
    await Vue.nextTick();
    (wrapper.vm as any).setOpen(false);
    await Vue.nextTick();
    expect(window.localStorage.getItem(OPEN_PREF_KEY)).to.equal("0");
    wrapper.destroy();

    const reopened = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
    await Vue.nextTick();
    expect((reopened.vm as any).open).to.equal(false);
    reopened.destroy();
    restoreDesktop();

    const restoreMobile = mockDesktopViewport(false);
    const mobileWrapper = mount(GameNavPanel as any, { propsData: { client: makeClient([]), session } });
    await Vue.nextTick();
    expect((mobileWrapper.vm as any).open).to.equal(false);
    mobileWrapper.destroy();
    restoreMobile();
  });

  it("keeps the desktop panel open after selecting a game, but closes it on mobile", async () => {
    const games = [game({ id: "my-turn", current_seat: 0 })];

    const restoreDesktop = mockDesktopViewport(true);
    const desktopWrapper = mount(GameNavPanel as any, { propsData: { client: makeClient(games), session } });
    await Vue.nextTick();
    await Vue.nextTick();
    await desktopWrapper.find("a.game-nav__row").trigger("click");
    expect((desktopWrapper.vm as any).open).to.equal(true);
    desktopWrapper.destroy();
    restoreDesktop();

    const restoreMobile = mockDesktopViewport(false);
    const mobileWrapper = mount(GameNavPanel as any, { propsData: { client: makeClient(games), session } });
    await Vue.nextTick();
    await Vue.nextTick();
    (mobileWrapper.vm as any).open = true;
    await Vue.nextTick();
    await mobileWrapper.find("a.game-nav__row").trigger("click");
    expect((mobileWrapper.vm as any).open).to.equal(false);
    mobileWrapper.destroy();
    restoreMobile();
  });
});
