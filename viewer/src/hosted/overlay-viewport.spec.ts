import { expect } from "chai";
import { KEYBOARD_MIN_SHRINK_PX, overlayViewportPin } from "./overlay-viewport";

describe("overlayViewportPin", () => {
  const atRest = { scale: 1, offsetTop: 0, height: 800, innerHeight: 800 };

  it("does not pin at rest - the layout viewport already covers the screen", () => {
    expect(overlayViewportPin(atRest)).to.equal(null);
  });

  it("pins to the visible area when an on-screen keyboard shrinks the visual viewport", () => {
    expect(overlayViewportPin({ ...atRest, height: 420, offsetTop: 30 })).to.deep.equal({ top: 30, height: 420 });
  });

  // The regression this whole helper exists for: the overlay used to follow every visualViewport
  // event, so an ordinary iOS scroll (address bar sliding away) or an elastic overscroll at the end
  // of the thread re-pinned it to a stale, shifted rectangle - leaving a live strip of the game
  // board, sticky move bar included, exposed next to a chat that looked full-screen.
  it("ignores an address-bar-sized height change", () => {
    expect(overlayViewportPin({ ...atRest, height: 800 - (KEYBOARD_MIN_SHRINK_PX - 1) })).to.equal(null);
  });

  it("ignores elastic overscroll, which shifts the offset without shrinking the height", () => {
    expect(overlayViewportPin({ ...atRest, offsetTop: 60 })).to.equal(null);
  });

  it("does not pin while pinch-zoomed - the visual viewport is inside the layout viewport there", () => {
    expect(overlayViewportPin({ scale: 2.5, offsetTop: 120, height: 320, innerHeight: 800 })).to.equal(null);
  });

  it("still pins through the scale residue iOS leaves after a pinch is released", () => {
    expect(overlayViewportPin({ scale: 1.0000000002, offsetTop: 30, height: 420, innerHeight: 800 })).to.deep.equal({
      top: 30,
      height: 420,
    });
  });

  it("does not pin when the layout viewport shrinks with the keyboard (Android Chrome's default)", () => {
    expect(overlayViewportPin({ scale: 1, offsetTop: 0, height: 420, innerHeight: 420 })).to.equal(null);
  });

  it("does not pin on a viewport it cannot measure", () => {
    expect(overlayViewportPin({ ...atRest, height: 0 })).to.equal(null);
    expect(overlayViewportPin({ ...atRest, innerHeight: 0 })).to.equal(null);
  });
});
