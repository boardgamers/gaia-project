import { mount } from "@vue/test-utils";
import { expect } from "chai";
import PremoveHistoryButton from "./PremoveHistoryButton.vue";

describe("PremoveHistoryButton", () => {
  for (const status of ["stopped", "completed", "queued"]) {
    it(`${status === "stopped" ? "reviews directly" : "keeps history"} for ${status} runs`, async () => {
      const show = vi.fn();
      const review = vi.fn();
      const view = mount(PremoveHistoryButton, {
        propsData: { plan: { moves: [], runs: [{ id: "run", status, steps: [] }] } },
        mocks: { $bvModal: { show } },
      });
      view.vm.$root.$on("review-stopped-premoves", review);
      await view.find("button").trigger("click");
      expect(review.mock.calls.length).to.equal(status === "stopped" ? 1 : 0);
      expect(show.mock.calls).to.deep.equal(status === "stopped" ? [] : [["premove-history"]]);
      view.destroy();
    });
  }
});
