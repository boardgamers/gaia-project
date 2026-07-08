import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import OpenGamePreview from "./OpenGamePreview.vue";

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: "g-preview",
    player_count: 2,
    seed: "lost-fleet-space-map",
    options: { lostFleet: true },
    setup_move: null,
    players: [
      { seat: 0, user_id: null, invited_email: "open-seat-1@example.com", display_name: "" },
      { seat: 1, user_id: null, invited_email: "open-seat-2@example.com", display_name: "" },
    ],
    ...overrides,
  };
}

describe("OpenGamePreview", () => {
  it("does not rebuild the setup preview for seat-only lobby updates", async () => {
    const wrapper = mount(OpenGamePreview, {
      propsData: {
        game: makeGame(),
      },
    });
    await Vue.nextTick();
    await Vue.nextTick();

    const vm = wrapper.vm as any;
    let receiveDataCommits = 0;
    const originalCommit = vm.nestedStore.commit.bind(vm.nestedStore);
    vm.nestedStore.commit = (type: string, payload: unknown) => {
      if (type === "receiveData") {
        receiveDataCommits += 1;
      }
      return originalCommit(type, payload);
    };

    await wrapper.setProps({
      game: makeGame({
        players: [
          { seat: 0, user_id: "user-1", invited_email: "user-1@example.com", display_name: "Player 1" },
          { seat: 1, user_id: null, invited_email: "open-seat-2@example.com", display_name: "" },
        ],
      }),
    });
    await Vue.nextTick();

    expect(receiveDataCommits).to.equal(0);

    await wrapper.setProps({
      game: makeGame({ seed: "lost-fleet-space-map-2" }),
    });
    await Vue.nextTick();

    expect(receiveDataCommits).to.equal(1);
  });
});
