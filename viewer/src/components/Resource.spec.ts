import { render } from "@testing-library/vue";
import { expect } from "chai";
import Resource from "./Resource.vue";

describe("Resource", () => {
  it("renders the range ('r') icon as the 2-hex + arrow layout (reverted from a single-hex '+1' badge)", () => {
    const { container } = render(Resource, { props: { kind: "r", count: 1 } });

    // 2 flat-hex icons + 1 range-arrow icon
    expect(container.querySelectorAll("image").length).to.equal(3);
    expect(container.querySelector("text").textContent.trim()).to.equal("1");
  });

  it("does not prefix the range count with '+', regardless of the plus prop", () => {
    const { container } = render(Resource, { props: { kind: "r", count: 1, plus: true } });

    expect(container.querySelector("text").textContent.trim()).to.equal("1");
  });
});
