import Engine from "@gaia-project/engine";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import { mount } from "@vue/test-utils";
import Vue from "vue";
import { createStoredOfflineGame, readStoredOfflineGame } from "../offline-game";
import ImportOfflineGame from "./ImportOfflineGame.vue";
import { mirrorOfflineGameId, setOfflineMirrorEnabled, syncOfflineMirror } from "./offline-mirror";

Vue.use(BootstrapVue);

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

describe("ImportOfflineGame", () => {
  const session = { user: { id: "user-me", email: "kim@example.com" } } as any;

  function makeClient(rpc: (name: string, params?: any) => Promise<{ data: any; error: any }>) {
    return {
      rpc,
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    };
  }

  function seedStorage(): MemoryStorage {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 2 randomSeed", "p1 faction terrans", "p2 faction nevlas"], {});
    engine.generateAvailableCommandsIfNeeded();
    createStoredOfflineGame(engine, "Copper Nova", storage, Date.UTC(2026, 6, 18, 10), "offline-1");
    return storage;
  }

  it("shows an error instead of a form when the offline game isn't stored on this device", async () => {
    const storage = new MemoryStorage();
    const client = makeClient(async () => ({ data: [], error: null }));
    const wrapper = mount(ImportOfflineGame, {
      propsData: { client, session, offlineGameId: "missing", storage },
    });
    await Vue.nextTick();

    expect(wrapper.text()).to.include("could not be loaded on this device");
    expect(wrapper.find("select").exists()).to.equal(false);
  });

  it("refuses to move an automatic copy of a game that is already online", async () => {
    const storage = new MemoryStorage();
    const engine = new Engine(["init 2 randomSeed", "p1 faction terrans"], {});
    engine.generateAvailableCommandsIfNeeded();
    setOfflineMirrorEnabled("hosted-game-1", true, storage);
    syncOfflineMirror("hosted-game-1", "Mirrored Nova", JSON.parse(JSON.stringify(engine)), storage);

    const client = makeClient(async () => ({ data: [], error: null }));
    const wrapper = mount(ImportOfflineGame, {
      propsData: { client, session, offlineGameId: mirrorOfflineGameId("hosted-game-1"), storage },
    });
    await Vue.nextTick();

    expect(wrapper.text()).to.include("already in the online lobby");
    expect(wrapper.find("select").exists()).to.equal(false);
    expect((wrapper.vm as any).canImport).to.equal(false);
  });

  it("defaults every seat to the signed-in player and enables the move button", async () => {
    const storage = seedStorage();
    const client = makeClient(async () => ({ data: [], error: null }));
    const wrapper = mount(ImportOfflineGame, {
      propsData: { client, session, offlineGameId: "offline-1", storage },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.findAll("select")).to.have.length(2);
    expect((wrapper.vm as any).seatAssignments).to.deep.equal(["user-me", "user-me"]);
    expect(wrapper.find("button.btn-primary").attributes("disabled")).to.equal(undefined);
  });

  it("disables the move button unless at least one seat is assigned to the signed-in player", async () => {
    const storage = seedStorage();
    const client = makeClient(async () => ({ data: [], error: null }));
    const wrapper = mount(ImportOfflineGame, {
      propsData: { client, session, offlineGameId: "offline-1", storage },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    await wrapper.setData({ seatAssignments: ["someone-else", "someone-else"] });
    expect(wrapper.find("button.btn-primary").attributes("disabled")).to.equal("disabled");
  });

  it("submits the derived import params and surfaces a server error without deleting the local save", async () => {
    const storage = seedStorage();
    const rpcCalls: { name: string; params: any }[] = [];
    const client = makeClient(async (name: string, params?: any) => {
      rpcCalls.push({ name, params });
      if (name === "import_offline_game") {
        return { data: null, error: { message: "boom" } };
      }
      return { data: [], error: null };
    });
    const wrapper = mount(ImportOfflineGame, {
      propsData: { client, session, offlineGameId: "offline-1", storage },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    await (wrapper.vm as any).importGame();
    await Vue.nextTick();

    expect(wrapper.text()).to.include("Could not move this game online: boom");
    const importCall = rpcCalls.find((c) => c.name === "import_offline_game");
    expect(importCall?.params.p_seed).to.equal("randomSeed");
    expect(importCall?.params.p_invites).to.deep.equal([
      { user_id: "user-me", seat: 0, display_name: "Me" },
      { user_id: "user-me", seat: 1, display_name: "Me" },
    ]);
    // A failed import must never remove the only copy of the game from this device.
    expect(readStoredOfflineGame("offline-1", storage).save).to.not.equal(null);
  });
});
