import { expect } from "chai";
import { attachZoomCompensation, RESUME_SETTLE_MS, zoomCompensationTransform } from "./zoom-compensation";

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

  // The owner-reported "sticky menu floats in the middle after minimizing and reopening the app":
  // a browser resuming from the background reports a visual viewport that is far shorter than the
  // zoom factor can account for. Believing it lifted a `bottom: 0` bar hundreds of pixels up the
  // page, where it hung over the board with page content visible below it.
  it("rejects a viewport whose height can't be explained by the zoom (stale/mid-resume metrics)", () => {
    // A barely-zoomed page cannot have a visual viewport 267px shorter than the layout viewport.
    expect(zoomCompensationTransform(input({ scale: 1.02, offsetTop: 0, height: 533 }))).to.equal("");
    // Same shape with a keyboard-sized shrink.
    expect(zoomCompensationTransform(input({ scale: 1.05, offsetTop: 0, height: 460 }))).to.equal("");
  });

  it("still compensates a real zoom, where height * scale reconstructs the layout viewport", () => {
    // 400 * 2 = 800 = innerHeight, so this reading is internally consistent.
    expect(zoomCompensationTransform(input({ scale: 2, offsetTop: 0, height: 400 }))).to.equal(
      "translate(0px, -400px) scale(0.5)"
    );
  });

  it("ignores metrics that aren't measurable at all", () => {
    expect(zoomCompensationTransform(input({ scale: 2, height: 0 }))).to.equal("");
    expect(zoomCompensationTransform(input({ scale: 2, innerHeight: 0 }))).to.equal("");
    expect(zoomCompensationTransform(input({ scale: 0, height: 400 }))).to.equal("");
  });

  // Belt and braces behind the consistency check above: re-anchoring from the layout viewport's
  // bottom edge to the visual viewport's can only move the bar up, and never further than the gap
  // between the two heights. Anything outside that range is not a zoom offset.
  it("clamps the offset to the geometry a zoom can actually produce", () => {
    // offsetTop overshoots the bottom of the layout viewport: y would be +100, which would push the
    // bar off the bottom edge. Clamped to 0, i.e. no vertical move at all.
    expect(zoomCompensationTransform(input({ scale: 2, offsetLeft: 5, offsetTop: 500, height: 400 }))).to.equal(
      "translate(5px, 0px) scale(0.5)"
    );
    // A negative offsetLeft (never legitimate) doesn't drag the bar off the left edge.
    expect(zoomCompensationTransform(input({ scale: 2, offsetLeft: -30, offsetTop: 0, height: 400 }))).to.equal(
      "translate(0px, -400px) scale(0.5)"
    );
  });
});

// ---------------------------------------------------------------------------------------------
// The lifetime half. Every incarnation of the float bug has been a transform that was right when it
// was written and wrong afterwards, with nothing to correct it - so these are the tests that matter
// for the reported symptom, more than the arithmetic above.
// ---------------------------------------------------------------------------------------------

type FakeViewport = {
  scale: number;
  offsetLeft: number;
  offsetTop: number;
  height: number;
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
  fire(type: string): void;
};

describe("attachZoomCompensation", () => {
  let element: HTMLElement;
  let vv: FakeViewport;
  let frames: Array<() => void>;
  let previousViewport: any;
  let previousRaf: any;
  let previousCancelRaf: any;
  let previousInnerHeight: number;

  /** Runs whatever the watchdog scheduled, one frame at a time. */
  function runFrames(count = 1) {
    for (let i = 0; i < count; i++) {
      const due = frames;
      frames = [];
      due.forEach((cb) => cb());
    }
  }

  function setVisibility(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
    frames = [];

    const listeners: Record<string, Array<() => void>> = {};
    vv = {
      scale: 1,
      offsetLeft: 0,
      offsetTop: 0,
      height: INNER_HEIGHT,
      addEventListener(type, cb) {
        listeners[type] = [...(listeners[type] || []), cb];
      },
      removeEventListener(type, cb) {
        listeners[type] = (listeners[type] || []).filter((l) => l !== cb);
      },
      fire(type) {
        (listeners[type] || []).forEach((cb) => cb());
      },
    };

    previousViewport = (window as any).visualViewport;
    previousRaf = window.requestAnimationFrame;
    previousCancelRaf = window.cancelAnimationFrame;
    previousInnerHeight = window.innerHeight;
    (window as any).visualViewport = vv;
    (window as any).innerHeight = INNER_HEIGHT;
    (window as any).requestAnimationFrame = (cb: () => void) => frames.push(cb);
    (window as any).cancelAnimationFrame = () => undefined;
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  afterEach(() => {
    element.remove();
    (window as any).visualViewport = previousViewport;
    (window as any).requestAnimationFrame = previousRaf;
    (window as any).cancelAnimationFrame = previousCancelRaf;
    (window as any).innerHeight = previousInnerHeight;
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("leaves an unzoomed bar untransformed, and schedules nothing to watch", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });
    expect(element.style.transform).to.equal("");
    // No watchdog while there is nothing to heal - the common case must cost nothing per frame.
    expect(frames).to.have.length(0);
  });

  it("compensates on a real pinch-zoom and keeps watching while one is applied", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });

    vv.scale = 2;
    vv.height = 400;
    vv.offsetTop = 0;
    vv.fire("resize");
    expect(element.style.transform).to.equal("translate(0px, -400px) scale(0.5)");
    expect(frames).to.have.length(1);
  });

  // The heart of the fix. A bar left transformed when the app went to the background has to put
  // itself right on the way back, WITHOUT the browser firing a visualViewport event - because in
  // the settled unzoomed state it fires none, which is why the old code sat there floating until a
  // hard refresh.
  it("un-floats itself on the next frame once the zoom is gone, with no viewport event", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });
    vv.scale = 2;
    vv.height = 400;
    vv.fire("resize");
    expect(element.style.transform).to.not.equal("");

    // The page is back at 1:1 but nothing tells us so.
    vv.scale = 1;
    vv.height = INNER_HEIGHT;
    runFrames();
    expect(element.style.transform).to.equal("");
    // ...and once healed the watchdog stands down again.
    runFrames();
    expect(frames).to.have.length(0);
  });

  it("clears the transform the moment the app is foregrounded, before re-deriving anything", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });
    vv.scale = 2;
    vv.height = 400;
    vv.fire("resize");
    expect(element.style.transform).to.not.equal("");

    setVisibility("hidden");
    setVisibility("visible");
    // Not "next frame" - immediately, so the common case (nobody is zoomed) is right on the first
    // painted frame after the app comes back.
    expect(element.style.transform).to.equal("");
  });

  // Caught in a real browser against the actual app: the controller used to compare against a
  // remembered copy of what it last wrote, so a transform that got onto the bar any OTHER way was
  // invisible to it and "clear it" silently did nothing - against precisely the stale value that
  // needs clearing. The element's own inline style has to be the state.
  it("clears a transform it did not write itself", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });
    expect(element.style.transform).to.equal("");

    element.style.transform = "translate(0px, -267px) scale(0.98)";
    setVisibility("hidden");
    setVisibility("visible");
    expect(element.style.transform).to.equal("");
  });

  it("watches a transform it did not write itself, and heals it on the next frame", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });

    element.style.transform = "translate(0px, -267px) scale(0.98)";
    // An ordinary viewport event is enough to notice it - the page is not zoomed, so it goes.
    vv.fire("scroll");
    expect(element.style.transform).to.equal("");
  });

  it("does not write a transform derived from a backgrounded page's viewport", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });
    setVisibility("hidden");

    // Exactly the shape of a mid-resume reading: shrunk viewport, near-1 scale.
    vv.scale = 1.02;
    vv.height = 533;
    vv.fire("resize");
    runFrames(3);
    expect(element.style.transform).to.equal("");
  });

  // A resume can report the viewport in stages, with the settled values arriving several frames
  // later and no event to announce them - so they have to be gone and fetched.
  it("keeps re-deriving for a settle window after a resume, then stops", () => {
    attachZoomCompensation({ element, isStickyMobile: () => true });
    setVisibility("hidden");
    setVisibility("visible");

    // Mid-animation garbage first: rejected as inconsistent, so nothing is written...
    vv.scale = 1.02;
    vv.height = 533;
    runFrames(2);
    expect(element.style.transform).to.equal("");

    // ...and the real, still-zoomed state that arrives afterwards is picked up without an event.
    vv.scale = 2;
    vv.height = 400;
    runFrames();
    expect(element.style.transform).to.equal("translate(0px, -400px) scale(0.5)");
  });

  it("stops the settle-window watchdog once the window expires", () => {
    const realNow = Date.now;
    try {
      attachZoomCompensation({ element, isStickyMobile: () => true });
      setVisibility("visible");
      expect(frames).to.have.length(1);

      Date.now = () => realNow() + RESUME_SETTLE_MS + 1;
      runFrames();
      expect(frames).to.have.length(0);
    } finally {
      Date.now = realNow;
    }
  });

  it("never transforms a bar that isn't in the fixed mobile layout", () => {
    let sticky = false;
    const handle = attachZoomCompensation({ element, isStickyMobile: () => sticky });
    vv.scale = 2;
    vv.height = 400;
    vv.fire("resize");
    expect(element.style.transform).to.equal("");

    sticky = true;
    handle.update();
    expect(element.style.transform).to.equal("translate(0px, -400px) scale(0.5)");
  });

  it("drops every listener and un-transforms the element on destroy", () => {
    const handle = attachZoomCompensation({ element, isStickyMobile: () => true });
    vv.scale = 2;
    vv.height = 400;
    vv.fire("resize");
    expect(element.style.transform).to.not.equal("");

    handle.destroy();
    expect(element.style.transform).to.equal("");

    vv.fire("resize");
    window.dispatchEvent(new Event("resize"));
    runFrames(3);
    expect(element.style.transform).to.equal("");
  });

  it("is a safe no-op where visualViewport does not exist", () => {
    delete (window as any).visualViewport;
    const handle = attachZoomCompensation({ element, isStickyMobile: () => true });
    handle.update();
    handle.destroy();
    expect(element.style.transform).to.equal("");
  });
});
