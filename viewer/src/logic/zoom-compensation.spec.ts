import { expect } from "chai";
import { zoomCompensationTransform } from "./zoom-compensation";

// A phone-ish layout viewport. `innerHeight` is the fixed layout-viewport height fixed positioning
// anchors to; `height`/offsets are the live visual-viewport values that shift with zoom/scroll.
const INNER_HEIGHT = 800;

function input(overrides: Partial<Parameters<typeof zoomCompensationTransform>[0]> = {}) {
  return {
    isStickyMobile: true,
    scale: 1,
    offsetLeft: 0,
    offsetTop: 0,
    height: INNER_HEIGHT,
    innerHeight: INNER_HEIGHT,
    ...overrides,
  };
}

describe("zoomCompensationTransform", () => {
  it("applies no transform when the bar isn't in the fixed mobile layout", () => {
    expect(zoomCompensationTransform(input({ isStickyMobile: false, scale: 2, offsetTop: 100 }))).to.equal("");
  });

  it("applies no transform at exactly scale 1 (genuinely not zoomed)", () => {
    expect(zoomCompensationTransform(input({ scale: 1, offsetTop: 120, height: 680 }))).to.equal("");
  });

  // The core regression: after a pinch-zoom is released, visualViewport.scale settles just off 1
  // (e.g. 1.0000000002 on iOS). An exact `=== 1` check treated that as "still zoomed" and applied
  // the address-bar/overscroll offset on every subsequent scroll, floating the fixed bar mid-screen
  // until a full reload. The tolerance must treat this as not-zoomed.
  it("treats a tiny post-pinch scale residue as not zoomed (no float on later scrolls)", () => {
    // scroll shifted the visual viewport (address bar), but the page is effectively at 1:1.
    expect(zoomCompensationTransform(input({ scale: 1.0000000002, offsetTop: 90, height: 710 }))).to.equal("");
    expect(zoomCompensationTransform(input({ scale: 0.9999999403, offsetTop: 90, height: 710 }))).to.equal("");
  });

  it("compensates a genuine pinch-zoom with a pan offset", () => {
    const t = zoomCompensationTransform(input({ scale: 2, offsetLeft: 10, offsetTop: 40, height: 420 }));
    // x = offsetLeft = 10; y = offsetTop + height - innerHeight = 40 + 420 - 800 = -340; scale -> 1/2
    expect(t).to.equal("translate(10px, -340px) scale(0.5)");
  });

  it("applies no transform for a zoom with no net offset (avoids a needless containing block)", () => {
    // scale != 1 but the visual viewport is still anchored at the layout origin (x = 0, y = 0).
    expect(zoomCompensationTransform(input({ scale: 2, offsetLeft: 0, offsetTop: 0, height: INNER_HEIGHT }))).to.equal(
      ""
    );
  });
});
