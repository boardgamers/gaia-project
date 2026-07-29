import Engine, { AuctionVariant } from "@gaia-project/engine";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import { mount } from "@vue/test-utils";
import Vue from "vue";
import { createStoredOfflineGame, listOfflineGames, offlineGameListRow } from "../offline-game";
import {
  isOfflineMirrorEnabled,
  mirrorOfflineGameId,
  setOfflineMirrorEnabled,
  syncOfflineMirror,
} from "../hosted/offline-mirror";
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

  it("offers a link to move each game to the online lobby while online", async () => {
    const wrapper = mount(OfflineLobby, { propsData: { storage } });
    await Vue.nextTick();

    expect(wrapper.find(`a[href="?importOffline=${ids[0]}"]`).exists()).to.equal(true);
    expect(wrapper.find(`a[href="?importOffline=${ids[1]}"]`).exists()).to.equal(true);

    wrapper.destroy();
  });

  it("marks a copy of an online game, keeps it out of the move-online flow, and stops its sync on delete", async () => {
    const online = new Engine(["init 2 mirrored-online-game"], { lostFleet: true });
    setOfflineMirrorEnabled("hosted-game-1", true, storage);
    syncOfflineMirror("hosted-game-1", "Mirrored Nova", JSON.parse(JSON.stringify(online)), [0], storage);

    const wrapper = mount(OfflineLobby, { propsData: { storage } });
    await Vue.nextTick();

    const mirrorId = mirrorOfflineGameId("hosted-game-1");
    expect(wrapper.text()).to.include("Mirrored Nova");
    expect(wrapper.text()).to.include("Online copy");
    // It is already online - importing it would fork a second copy of the same hosted game.
    expect(wrapper.find(`a[href="?importOffline=${mirrorId}"]`).exists()).to.equal(false);
    expect(wrapper.find(`a[href="?importOffline=${ids[0]}"]`).exists()).to.equal(true);

    const mirrorRow = listOfflineGames(storage)
      .games.map(offlineGameListRow)
      .find((row) => row.id === mirrorId);
    const previousConfirm = window.confirm;
    (window as any).confirm = () => true;
    try {
      (wrapper.vm as any).deleteGame(mirrorRow);
    } finally {
      (window as any).confirm = previousConfirm;
    }
    await Vue.nextTick();

    expect(listOfflineGames(storage).games.map((game) => game.id)).to.not.include(mirrorId);
    // Otherwise the online game's still-on setting would recreate the row on its next move.
    expect(isOfflineMirrorEnabled("hosted-game-1", storage)).to.equal(false);

    wrapper.destroy();
  });

  it("offers file backups in the lobby and restores an older raw engine export", async () => {
    const wrapper = mount(OfflineLobby, { propsData: { storage } });
    await Vue.nextTick();

    expect(wrapper.text()).to.include("Import backup");
    expect(wrapper.findAll("button").filter((button) => button.text() === "Download backup").length).to.equal(2);

    const restored = new Engine(["init 2 restored-from-file"], { lostFleet: true });
    (wrapper.vm as any).importBackupContents(JSON.stringify(restored), "Restored fleet");
    await Vue.nextTick();

    expect(listOfflineGames(storage).games.map((game) => game.name)).to.include("Restored fleet");
    expect(wrapper.text()).to.include("Imported “Restored fleet”.");

    wrapper.destroy();
  });
});
