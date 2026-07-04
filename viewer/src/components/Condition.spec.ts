import { render } from "@testing-library/vue";
import { expect } from "chai";
import Condition from "./Condition.vue";

describe("Condition", () => {
  it("renders the Deep Space condition as 3 hexes, not the base-game 7-hex Sector icon with a 'DS' label", () => {
    const { container } = render(Condition, { props: { condition: "ds" } });

    const deepSpace = container.querySelector(".deep-space-sector");
    expect(deepSpace, "expected the 3-hex Deep Space icon").to.not.equal(null);
    expect(deepSpace.querySelectorAll("polygon").length).to.equal(3);
    expect(container.textContent).to.not.contain("DS");

    // White, matching the base-game Sector icon's own coloring in this same tile/condition
    // iconography (round scoring, adv tech tiles, ...) - only the map itself keeps the dark navy
    // fill used for realism there.
    expect(deepSpace.classList.contains("deep-space-sector--white")).to.equal(true);
  });

  it("renders the tech tile condition (T F Mars's QIC 'VP per tech tile' action) as the white/blue tech icon, not raw text", () => {
    const { container } = render(Condition, { props: { condition: "tt" } });

    expect(container.querySelector("image"), "expected the tech tile Resource icon (an <image>)").to.not.equal(null);
    expect(container.textContent).to.not.contain("tt");
  });
});
