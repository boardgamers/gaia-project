// Decides the counter-transform that keeps the mobile sticky action bar (#move-buttons, which is
// `position: fixed` in the narrow layout) at a constant on-screen size and position while the game
// board is pinch-zoomed. Extracted from Commands.vue as a pure function purely so the "is the page
// actually zoomed?" gate can be unit-tested - it is the exact spot a long-standing "the fixed bar
// floats mid-screen on scroll" bug kept coming back through (see the spec).

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

  // Not (meaningfully) zoomed. `offsetTop`/`height` still shift transiently here from iOS address-bar
  // hide/show on an ordinary scroll and from elastic overscroll at the page extremes; applying the
  // offset then is exactly what detaches the bar and floats it. The tolerance (vs `=== 1`) is what
  // keeps a post-pinch scale residue from being mistaken for a live zoom.
  if (Math.abs(scale - 1) < ZOOM_EPSILON) {
    return "";
  }

  const x = offsetLeft;
  const y = offsetTop + height - innerHeight;

  // A non-"none" transform makes the bar a containing block for its own `position: fixed` menus
  // (e.g. the auto-leech Popper dropdown), so skip the no-op identity case entirely rather than
  // setting "translate(0px, 0px) scale(1)".
  if (x === 0 && y === 0) {
    return "";
  }

  return `translate(${x}px, ${y}px) scale(${1 / scale})`;
}
