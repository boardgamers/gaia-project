// Decides - and then owns the lifetime of - the counter-transform that keeps both mobile sticky
// footer states (#move-buttons on-turn, PremoveBar off-turn) at a constant on-screen size and
// position while the game board is pinch-zoomed.
//
// This file is where the long-running "the fixed bar floats mid-screen" bug keeps being fought, so
// it carries the whole mechanism rather than just the arithmetic: the pure decision below, AND the
// listener/lifetime wiring (`attachZoomCompensation`). Both bars used to wire their own listeners
// from `mounted()`, which is how they drifted apart once already (PremoveBar was left on an exact
// `scale === 1` check after Commands moved to a tolerance).
//
// The governing rule, learned the hard way: **a transform written from a viewport snapshot must
// never outlive the snapshot.** Every incarnation of this bug has been a transform that was correct
// when it was written and wrong afterwards, with nothing to come along and correct it - because in
// the by-far-most-common state (no zoom) the browser fires no visualViewport events at all, so a
// wrong value simply sits there until a hard refresh. Hence three layers, in order of how much they
// are relied on:
//
//   1. Never write a transform from metrics that cannot all be true at once (`zoomCompensationTransform`).
//   2. Re-check every frame for as long as a transform IS applied (`attachZoomCompensation`), so any
//      wrong value that does get written survives at most one frame past the metrics settling.
//   3. Clear outright, then re-derive over the next few frames, whenever the app resumes - the
//      reported case being "minimize the app on mobile and open it again".

export type ZoomCompensationInput = {
  /** Is the bar currently in its `position: fixed` mobile-sticky layout? Only then does it need
   * compensating - on wider viewports it renders in-flow and any transform would be wrong. */
  isStickyMobile: boolean;
  /** `visualViewport.scale`. */
  scale: number;
  /** `visualViewport.offsetLeft`. */
  offsetLeft: number;
  /** `visualViewport.offsetTop`. */
  offsetTop: number;
  /** `visualViewport.height`. */
  height: number;
  /** `window.innerHeight` (the unchanging layout-viewport height fixed positioning anchors to). */
  innerHeight: number;
};

// How far `visualViewport.scale` may drift from 1 and still count as "not pinch-zoomed". This MUST
// be a tolerance, not an exact `=== 1`: after a pinch-zoom is released, the browser does not
// reliably settle `scale` back to exactly 1 (iOS leaves a tiny residue like 1.0000000002). With an
// exact check, the first accidental pinch makes the code think the page is zoomed forever, so every
// later scroll re-applies the address-bar/overscroll offset below and the "fixed" bar floats
// mid-screen until a full reload. Deliberately loose (1%): a deliberate zoom is always well beyond
// this, while the release residue and plain floating-point noise are far below it.
export const ZOOM_EPSILON = 0.01;

/**
 * How far the visual viewport's height, scaled back up to layout pixels, may disagree with the
 * layout viewport before the whole reading is treated as untrustworthy.
 *
 * Pinch-zoom is the only thing this file compensates for, and under pinch-zoom alone
 * `visualViewport.height * scale` reconstructs `window.innerHeight`: the visual viewport is a window
 * onto the layout viewport, shrunk by exactly the zoom factor. When that identity does not hold,
 * something OTHER than zoom is shrinking the visible area - an on-screen keyboard, or (the reported
 * case) a browser mid-resume that is still reporting the viewport it had before the app was
 * backgrounded - and the vertical offset derived from it is not a zoom offset at all. Believing it
 * anyway is precisely what lifts a `bottom: 0` bar hundreds of pixels up the page and leaves it
 * hanging over the board.
 *
 * Bailing out costs nothing worse than the bar scaling with the map for that moment, which is the
 * correct direction to fail in: an unpolished bar beats a floating one.
 */
export const VIEWPORT_CONSISTENCY_TOLERANCE = 0.25;

/** Floor for the tolerance above on short viewports, so it never gets tighter than ordinary browser
 * chrome transitions (~50-100px of address bar sliding in or out). */
export const VIEWPORT_CONSISTENCY_MIN_PX = 150;

/**
 * Returns the CSS `transform` value to set on the sticky bar - an empty string means "no transform"
 * (i.e. let it be genuinely viewport-fixed). Returns a real `translate(...) scale(...)` only while
 * the page is actually pinch-zoomed AND that produces a non-identity offset.
 */
export function zoomCompensationTransform(input: ZoomCompensationInput): string {
  const { isStickyMobile, scale, offsetLeft, offsetTop, height, innerHeight } = input;

  // Not the fixed mobile layout -> nothing to compensate.
  if (!isStickyMobile) {
    return "";
  }

  // Nonsense or not-yet-measured metrics (a detached document, a browser that has not laid out
  // yet). Dividing the bar's position out of these is how it ends up somewhere arbitrary.
  if (!(scale > 0) || !(height > 0) || !(innerHeight > 0)) {
    return "";
  }

  // Not (meaningfully) zoomed. `offsetTop`/`height` still shift transiently here from iOS address-bar
  // hide/show on an ordinary scroll and from elastic overscroll at the page extremes; applying the
  // offset then is exactly what detaches the bar and floats it. The tolerance (vs `=== 1`) is what
  // keeps a post-pinch scale residue from being mistaken for a live zoom.
  if (Math.abs(scale - 1) < ZOOM_EPSILON) {
    return "";
  }

  // Zoomed - but do the three numbers actually describe a zoom? See VIEWPORT_CONSISTENCY_TOLERANCE.
  const slack = Math.max(VIEWPORT_CONSISTENCY_MIN_PX, innerHeight * VIEWPORT_CONSISTENCY_TOLERANCE);
  if (Math.abs(height * scale - innerHeight) > slack) {
    return "";
  }

  // The visual viewport is contained in the layout viewport, so re-anchoring the bar from the
  // latter's bottom edge to the former's can only ever move it UP, and never further up than the
  // difference in their heights. Clamping to that geometric range means even a reading that slips
  // past the check above cannot throw the bar an arbitrary distance across the page.
  const x = Math.max(0, offsetLeft);
  const y = clamp(offsetTop + height - innerHeight, Math.min(0, height - innerHeight), 0);

  // A non-"none" transform makes the bar a containing block for its own `position: fixed` menus
  // (e.g. the auto-leech Popper dropdown), so skip the no-op identity case entirely rather than
  // setting "translate(0px, 0px) scale(1)".
  if (x === 0 && y === 0) {
    return "";
  }

  return `translate(${x}px, ${y}px) scale(${1 / scale})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How long after an app resume (or any other event that invalidates the viewport wholesale) the
 * transform keeps being re-derived every frame.
 *
 * Coming back from the app switcher, a mobile browser reports its viewport in stages - mid-animation
 * values first, settled ones a few frames later - and it does NOT reliably fire a visualViewport
 * event once it has settled. So the settled value has to be gone and fetched rather than waited for.
 * Long enough to outlast the resume animation on a slow device, short enough to be over before the
 * user has finished looking at the screen.
 */
export const RESUME_SETTLE_MS = 800;

export type ZoomCompensationOptions = {
  /** The bar's root element - the one carrying `position: fixed` and `transform-origin: left bottom`. */
  element: HTMLElement;
  /** Read live (not captured once): is the bar in its fixed mobile-sticky layout right now? */
  isStickyMobile: () => boolean;
};

export type ZoomCompensationHandle = {
  /** Re-derive now. For callers that know the bar changed in a way no viewport event reports -
   * the bar first becoming sticky, a ResizeObserver firing. */
  update(): void;
  /** Drop every listener, stop the watchdog and leave the element untransformed. */
  destroy(): void;
};

/**
 * Keeps `element`'s counter-transform correct for as long as the handle lives, and - the part that
 * matters - keeps it correct without depending on the browser to tell us when something changed.
 *
 * A no-op (but safe to call) where there is no `window.visualViewport`: desktop Firefox, jsdom, SSR.
 */
export function attachZoomCompensation({ element, isStickyMobile }: ZoomCompensationOptions): ZoomCompensationHandle {
  const win = typeof window !== "undefined" ? window : undefined;
  const vv = win?.visualViewport;
  if (!win || !vv || !element) {
    return { update: () => undefined, destroy: () => undefined };
  }

  let destroyed = false;
  let stopWatchdog: (() => void) | null = null;
  /** Timestamp until which every frame is re-derived regardless of whether a transform is applied. */
  let settleUntil = 0;

  /** The element's own inline style is the state, deliberately - NOT a remembered copy of what this
   * module last wrote. Trusting a remembered copy means a transform that got onto the bar any other
   * way (a re-render, a previous instance of this component, a browser restoring inline styles on
   * resume) is invisible to every check below, and "clear it" quietly becomes a no-op against
   * exactly the stale value that needs clearing. Reading an inline style forces no layout. */
  const current = () => element.style.transform;

  const write = (value: string) => {
    if (current() !== value) {
      element.style.transform = value;
    }
  };

  const update = () => {
    if (destroyed) {
      return;
    }
    // A backgrounded page's viewport metrics describe a viewport nobody is looking at, and are the
    // ones most likely to be mid-flight. Writing one now is how a wrong transform gets carried
    // across the background/foreground boundary in the first place; `resume` re-derives instead.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    write(
      zoomCompensationTransform({
        isStickyMobile: isStickyMobile(),
        scale: vv.scale || 1,
        offsetLeft: vv.offsetLeft,
        offsetTop: vv.offsetTop,
        height: vv.height,
        innerHeight: win.innerHeight,
      })
    );
    armWatchdog();
  };

  // Runs only while the bar is actually carrying a transform (or during a post-resume settle
  // window), which is the rare case; the common no-zoom state costs nothing per frame. Note the
  // browser suspends animation frames for a hidden page and resumes them on foreground, so a bar
  // left transformed at the moment the app was minimized re-derives itself the instant it is on
  // screen again, with no event needed - and, because the condition is read off the element rather
  // than off a remembered value, that holds for a transform this module did not write either.
  // A function declaration (hoisted) because `update` above re-arms the watchdog.
  function armWatchdog() {
    if (destroyed || stopWatchdog !== null) {
      return;
    }
    if (current() === "" && Date.now() >= settleUntil) {
      return;
    }
    stopWatchdog = scheduleFrame(win, () => {
      stopWatchdog = null;
      update();
    });
  }

  // Everything that invalidates the reading wholesale rather than reporting a change to it. Clearing
  // first is deliberate: in the overwhelmingly common case (nobody is pinch-zoomed) that alone puts
  // the bar back exactly where CSS pins it, without waiting on the browser to admit anything. The
  // settle window then re-derives a genuine zoom over the following frames.
  const resume = () => {
    if (destroyed) {
      return;
    }
    write("");
    settleUntil = Date.now() + RESUME_SETTLE_MS;
    armWatchdog();
  };

  const onVisibilityChange = () => {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      resume();
    }
  };

  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  // `resize`/`orientationchange` are the layout viewport changing under a bar anchored to it;
  // `pageshow` covers a back-forward-cache restore (which runs no component lifecycle at all) and
  // `focus` covers browsers that hand a resumed tab focus without a visibility transition.
  win.addEventListener("resize", resume);
  win.addEventListener("orientationchange", resume);
  win.addEventListener("pageshow", resume);
  win.addEventListener("focus", resume);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  update();

  return {
    update,
    destroy() {
      destroyed = true;
      stopWatchdog?.();
      stopWatchdog = null;
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      win.removeEventListener("resize", resume);
      win.removeEventListener("orientationchange", resume);
      win.removeEventListener("pageshow", resume);
      win.removeEventListener("focus", resume);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      element.style.transform = "";
    },
  };
}

/** requestAnimationFrame where it exists, a timer where it doesn't (jsdom), returning a canceller
 * rather than an id so the caller never has to know which one it got. */
function scheduleFrame(win: Window, callback: () => void): () => void {
  if (typeof win.requestAnimationFrame === "function") {
    const id = win.requestAnimationFrame(() => callback());
    return () => win.cancelAnimationFrame(id);
  }
  const id = win.setTimeout(callback, 16);
  return () => win.clearTimeout(id);
}
