import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import CreateGame from "./CreateGame.vue";
import SetupPreview from "./SetupPreview.vue";

Vue.use(BootstrapVue);

describe("CreateGame", () => {
  const session = { user: { id: "user-me", email: "kim.pham.nguyen2@gmail.com" } } as any;
  function makeClient(nickname = "") {
    return {
      rpc: async () => ({ data: null, error: null }),
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { nickname }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };
  }

  it("offers 2/3/4 player-count buttons instead of a dropdown, and has no name field", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const buttons = wrapper.findAll("button").filter((b) => ["2", "3", "4"].includes(b.text()));
    expect(buttons.length).to.equal(3);
    expect(wrapper.find("select").exists()).to.equal(false);
    expect(wrapper.find('input[placeholder="Friday fleet night"]').exists()).to.equal(false);
    expect(wrapper.find('input[type="email"]').exists()).to.equal(false);
  });

  it("defaults to open lobby, explaining that seats stay open for anyone to join", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.include("You take seat 1 immediately");
    expect(wrapper.text()).to.include("stay open in the lobby for anyone to join");
  });

  it("uses separate accessible controls for selecting and explaining each faction-selection mode", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const cards = wrapper.findAll(".create-game-variant");
    expect(cards.length).to.be.greaterThan(1);
    expect(wrapper.find('.create-game-variant[role="button"]').exists()).to.equal(false);
    expect(cards.at(0).find("button button").exists()).to.equal(false);

    const select = cards.at(1).find(".create-game-variant__select");
    expect(select.attributes("aria-pressed")).to.equal("false");
    await select.trigger("click");
    await Vue.nextTick();
    expect(select.attributes("aria-pressed")).to.equal("true");
    expect(cards.at(1).find(".create-game-info-dot").attributes("aria-label")).to.match(/^About /);
  });

  it("offers a direct-invite picker of other players, sorted by nickname", async () => {
    const client = makeClient();
    (client as any).rpc = async (name: string) => {
      if (name === "list_invitable_players") {
        return {
          // list_invitable_players already orders by nickname server-side (migration
          // 0027_list_invitable_players.sql); the mock returns them pre-sorted the same way.
          data: [
            // Supabase returns the database column name verbatim.
            // eslint-disable-next-line @typescript-eslint/camelcase
            { user_id: "user-amy", nickname: "Amy" },
            // eslint-disable-next-line @typescript-eslint/camelcase
            { user_id: "user-zed", nickname: "Zed" },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const wrapper = mount(CreateGame, {
      propsData: { client, session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();
    await Vue.nextTick();

    const directButton = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Direct invite")
      .at(0);
    await directButton.trigger("click");
    await Vue.nextTick();

    const rows = wrapper.findAll(".create-game-invite-row");
    expect(rows.wrappers.map((row) => row.text())).to.deep.equal(["Amy", "Zed"]);
  });

  it("keeps Create disabled until the setup preview reports a valid setup", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const createButton = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Create game")
      .at(0);
    expect((createButton.element as HTMLButtonElement).disabled).to.equal(true);

    await wrapper
      .findComponent(SetupPreview as any)
      .vm.$emit("update", { seed: "s", rotateMove: "p2 rotate", valid: true });
    await Vue.nextTick();

    expect((createButton.element as HTMLButtonElement).disabled).to.equal(false);
  });

  it("shows the same create form for a non-admin too", async () => {
    const otherSession = { user: { id: "user-other", email: "someone-else@example.com" } } as any;
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(), session: otherSession },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.not.include("Only the admin can create new games.");
    expect(wrapper.find("form").exists()).to.equal(true);
  });

  it("uses the player's saved nickname as the host seat name instead of their Google name/email", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient("Star Fox"), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();
    await Vue.nextTick();
    await Vue.nextTick();

    expect((wrapper.vm as any).myDisplayName).to.equal("Star Fox");
  });

  it("falls back to a generic 'Host' label, never the account email, before the nickname loads", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { client: makeClient(""), session },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();

    expect((wrapper.vm as any).myDisplayName).to.equal("Host");
  });

  it("reuses the setup preview and faction options offline without test, lobby, or invite controls", async () => {
    const wrapper = mount(CreateGame, {
      propsData: { offline: true },
      stubs: { SetupPreview: true },
    });
    await Vue.nextTick();

    expect(wrapper.text()).to.include("New offline game");
    expect(wrapper.text()).to.include("Every seat plays on this device");
    expect(wrapper.text()).to.include("Setup Preview");
    expect(wrapper.text()).to.include("Silent Auction");
    expect(wrapper.text()).to.include("Ban phase");
    expect(wrapper.text()).to.not.include("Test game");
    expect(wrapper.text()).to.not.include("Open lobby");
    expect(wrapper.text()).to.not.include("Direct invite");
    expect((wrapper.vm as any).form.auctionVariant).to.equal("silent");
    expect((wrapper.vm as any).form.banPhase).to.equal(true);
    expect(wrapper.find('a[href="?offline=1"]').exists()).to.equal(true);
  });

  describe("Preference Split Auction", () => {
    async function mounted() {
      const wrapper = mount(CreateGame, {
        propsData: { client: makeClient(), session },
        stubs: { SetupPreview: true },
      });
      await Vue.nextTick();
      await Vue.nextTick();
      return wrapper;
    }

    it("is listed and selectable at every player count", async () => {
      const wrapper = await mounted();
      const vm = wrapper.vm as any;

      expect(wrapper.text()).to.include("Preference Split Auction");
      for (const count of [2, 3, 4]) {
        vm.setPlayerCount(count);
        await Vue.nextTick();
        expect(vm.blockedVariants["preference-split"]).to.equal("");
      }
      expect(vm.unavailableVariantNote).to.equal("");
    });

    it("states the budget the player count fixes, and offers no way to change it", async () => {
      const wrapper = await mounted();
      const vm = wrapper.vm as any;

      // The budget note only appears once the variant is picked (the variant card's own summary
      // mentions bid points regardless, so match on the concrete number).
      expect(wrapper.text()).to.not.match(/\d+ bid points/);

      vm.setPlayerCount(4);
      vm.form.auctionVariant = "preference-split";
      await Vue.nextTick();

      expect(vm.auctionBudget).to.equal(80);
      expect(wrapper.text()).to.include("80 bid points");
      // It is derived, not entered - there is no input for it at all.
      expect(wrapper.find("#create-game-auction-budget").exists()).to.equal(false);

      vm.setPlayerCount(3);
      await Vue.nextTick();
      expect(vm.auctionBudget).to.equal(60);
      expect(wrapper.text()).to.include("60 bid points");

      vm.setPlayerCount(2);
      await Vue.nextTick();
      expect(vm.auctionBudget).to.equal(40);
    });

    it("keeps the variant selected across a player-count change", async () => {
      const wrapper = await mounted();
      const vm = wrapper.vm as any;
      vm.setPlayerCount(4);
      vm.form.auctionVariant = "preference-split";
      await Vue.nextTick();

      vm.setPlayerCount(3);
      await Vue.nextTick();

      expect(vm.form.auctionVariant).to.equal("preference-split");
    });
  });
});
