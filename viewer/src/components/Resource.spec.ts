import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import Resource from "./Resource.vue";

// Costs in logs and deficits in simulation use the same signed resource counts as player boards
// and the mobile resource bar. The minus sign must remain visible independently of color.
describe("Resource", () => {
  // Knowledge and QIC read the store for their icon variant, so every case gets one.
  const count = (kind: string, value: number) => {
    const { container } = render(Resource, { props: { kind, count: value }, store: makeStore() });
    return container.querySelector("text");
  };

  it("renders an ordinary count without the overdrawn class", () => {
    const text = count("c", 7);
    expect(text.textContent.trim()).to.equal("7");
    expect(text.classList.contains("overdrawn")).to.equal(false);
  });

  it("marks a negative count as overdrawn, keeping the minus sign", () => {
    const text = count("c", -7);
    expect(text.textContent.trim()).to.equal("-7");
    expect(text.classList.contains("overdrawn")).to.equal(true);
  });

  it("treats zero as ordinary, not overdrawn", () => {
    expect(count("o", 0).classList.contains("overdrawn")).to.equal(false);
  });

  it("marks every overdrawable resource kind, not just credits", () => {
    for (const kind of ["c", "o", "k", "q"]) {
      expect(count(kind, -2).classList.contains("overdrawn"), kind).to.equal(true);
    }
  });
});
