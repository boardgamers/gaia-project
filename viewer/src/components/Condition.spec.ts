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
  });
});
