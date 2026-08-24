import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import Resource from "./Resource.vue";

// Analysis mode (ANALYSIS_MODE_PLAN.md §12) is the only way a resource count goes below zero: the
// sandbox seat keeps its real numbers and may overspend them. Every surface that shows a count goes
// through this component - the player board and the mobile sticky resource bar both - so this one
// class is what makes an unaffordable line obvious from the board itself, which is why the panel no
// longer needs to print the same figures.
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
