// Decides whether the mobile full-screen chat overlay (ChatNotesPanel.vue) should be pinned to
// `window.visualViewport` instead of just being `position: fixed; inset: 0`. Extracted as a pure
// function for the same reason as logic/zoom-compensation.ts (the sticky move bar's own
// counter-transform): "is the visual viewport meaningfully different from the layout viewport right
// now?" is exactly the question every naive visualViewport listener gets wrong, and getting it wrong
// detaches a supposedly full-screen overlay from the screen.
//
// The overlay is fixed to the LAYOUT viewport by default, which already contains the visual viewport
// whole - pinch-zoom, address-bar collapse, elastic overscroll and ordinary scrolling all leave the
// visible area inside it, so no pin is needed and applying one only introduces a gap the board (and
// its move buttons) shows through. The single case the layout viewport can't cover is an on-screen
// keyboard that shrinks the visual viewport WITHOUT resizing the layout viewport - iOS Safari's
// behavior - where an un-pinned overlay puts its composer behind the keyboard and lets the browser
// scroll the page to chase it. Android Chrome resizes the layout viewport instead (its default
// `interactive-widget=resizes-content`), so the shrink never shows up here and no pin is applied.

export type OverlayViewportInput = {
  /** `visualViewport.scale`. */
  scale: number;
  /** `visualViewport.offsetTop`. */
  offsetTop: number;
  /** `visualViewport.height`. */
  height: number;
  /** `window.innerHeight` (the layout-viewport height `position: fixed` anchors to). */
  innerHeight: number;
};

/** The inline `top`/`height` (CSS px) to force on the overlay, or null for "leave it fixed to the
 * layout viewport". */
export type OverlayViewportPin = { top: number; height: number } | null;

/** Same tolerance, and the same reason for it being a tolerance rather than `=== 1`, as
 * logic/zoom-compensation.ts's ZOOM_EPSILON: iOS leaves a tiny scale residue after a pinch. */
export const OVERLAY_ZOOM_EPSILON = 0.01;

/**
 * How much shorter than the layout viewport the visual viewport must be before we call it "an
 * on-screen keyboard is up". Deliberately far above the noise floor: a browser toolbar sliding in or
 * out is ~50-100px and resolves on its own, elastic overscroll moves `offsetTop` without shrinking
 * `height` at all, whereas every phone keyboard is well over 200px tall. Treating that noise as a
 * keyboard is what used to leave the overlay pinned to a stale, too-short rectangle with a live strip
 * of the game board exposed beside it.
 */
export const KEYBOARD_MIN_SHRINK_PX = 150;

export function overlayViewportPin(input: OverlayViewportInput): OverlayViewportPin {
  const { scale, offsetTop, height, innerHeight } = input;

  if (!height || !innerHeight) {
    return null;
  }

  // Pinch-zoomed: the visual viewport is a window INTO the layout viewport, so staying fixed to the
  // layout viewport covers it by definition. Pinning here would also need the horizontal offset and
  // an inverse scale to stay right (see zoom-compensation.ts) - not worth it for a case that is
  // already covered.
  if (Math.abs(scale - 1) > OVERLAY_ZOOM_EPSILON) {
    return null;
  }

  if (innerHeight - height < KEYBOARD_MIN_SHRINK_PX) {
    return null;
  }

  return { top: offsetTop, height };
}
