import { render } from "@testing-library/vue";
import { expect } from "chai";
import Resource from "./Resource.vue";

describe("Resource", () => {
  it("renders the range ('r') icon as a single compact hex, not the old wide 2-hex+arrow layout", () => {
    const { container } = render(Resource, { props: { kind: "r", count: 1 } });

    expect(container.querySelectorAll("image").length).to.equal(1);
    expect(container.querySelector("text").textContent.trim()).to.equal("1");
  });

  it("shows a '+' before the count only when the plus prop is set (reward context, not a raw total)", () => {
    const { container } = render(Resource, { props: { kind: "r", count: 1, plus: true } });

    expect(container.querySelector("text").textContent.trim()).to.equal("+1");
  });
});
