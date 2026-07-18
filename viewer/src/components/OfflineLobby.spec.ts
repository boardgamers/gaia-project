import Engine, { AuctionVariant } from "@gaia-project/engine";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import { mount } from "@vue/test-utils";
import Vue from "vue";
import { createStoredOfflineGame } from "../offline-game";
import OfflineLobby from "./OfflineLobby.vue";

Vue.use(BootstrapVue);

describe("OfflineLobby", () => {
  const ids = ["offline-lobby-one", "offline-lobby-two"];
  let storage: Storage;

  class MemoryStorage implements Storage {
    private values = new Map<string, string>();
    get length() {
      return this.values.size;
    }
    clear() {
      this.values.clear();
    }
    getItem(key: string) {
      return this.values.get(key) ?? null;
    }
    key(index: number) {
      return Array.from(this.values.keys())[index] ?? null;
    }
    removeItem(key: string) {
      this.values.delete(key);
    }
    setItem(key: string, value: string) {
      this.values.set(key, value);
    }
  }

  beforeEach(() => {
    storage = new MemoryStorage();
    const one = new Engine(["init 2 offline-lobby-one"], {
      lostFleet: true,
      auction: AuctionVariant.Silent,
      banPhase: true,
    });
    const two = new Engine(["init 3 offline-lobby-two"], { lostFleet: true });
    createStoredOfflineGame(one, "Copper Nova", storage, Date.UTC(2026, 6, 17, 10), ids[0]);
    createStoredOfflineGame(two, "Lunar Signal", storage, Date.UTC(2026, 6, 17, 11), ids[1]);
  });

  it("lists every local game with an offline link and no multiplayer controls", async () => {
    const wrapper = mount(OfflineLobby, { propsData: { storage } });
    await Vue.nextTick();

    expect(wrapper.text()).to.include("Copper Nova");
    expect(wrapper.text()).to.include("Lunar Signal");
    expect(wrapper.text()).to.include("Silent Auction");
    expect(wrapper.text()).to.include("Ban Phase");
    expect(wrapper.find('a[href="?offline=1&game=offline-lobby-one"]').exists()).to.equal(true);
    expect(wrapper.find('a[href="?offline=1&game=offline-lobby-two"]').exists()).to.equal(true);
    expect(wrapper.text()).to.not.include("Open lobby");
    expect(wrapper.text()).to.not.include("Direct invite");

    wrapper.destroy();
  });
});
