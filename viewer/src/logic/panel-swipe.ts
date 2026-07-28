import Vue from "vue";
import { Component } from "vue-property-decorator";

/**
 * The horizontal two-face drawer shared by the compact booster/federation pool (Pool.vue, which
 * swipes between its tiles and the chess board) and the research board panel (ResearchPanel.vue,
 * which swipes between the research art and the renju board).
 *
 * This started life inside Pool.vue and was lifted here unchanged when the second drawer arrived.
 * Everything about the gesture's feel lives here: a small dead zone before a drag is recognised, a
 * horizontal-vs-vertical intent test that releases the pointer for a vertical scroll, both faces
 * following the finger, a commit rule combining distance and flick speed, a short settle transition,
 * and the one synthetic click a browser fires after a touch release being swallowed so a drawer
 * gesture can never also press whatever sits under the finger. That last part matters most for the
 * research panel, whose faces are live Gaia move buttons.
 *
 * A component mixes this in and supplies its own two face names plus how a completed swipe is
 * committed (locally, or through a shared per-game backend).
 */

export const PANEL_SWIPE_EVENT = "lf::panel-swipe";

// Below this the pointer is still treated as a tap, so ordinary presses on either face are unaffected.
const DRAG_THRESHOLD = 5;
// A drag counts as horizontal once it out-paces its own vertical component. Slightly under 1 so a
// finger that starts a little diagonally - which is what a real thumb swipe across a phone does -
// still opens the drawer instead of doing nothing.
const HORIZONTAL_BIAS = 0.9;
// ...and an ambiguous start is NOT thrown away: the gesture stays undecided, still watching, until
// either the horizontal test above passes or the finger has travelled this far vertically while
// out-pacing its horizontal component, at which point the pointer is handed back for page scroll.
// (Deciding on the very first sample past the dead zone used to kill any swipe that began with a
// few pixels of vertical wobble.)
const VERTICAL_RELEASE = 14;
const SETTLE_MS = 180;

// Commit distance: a fraction of the panel's own width, clamped so neither a narrow sidebar nor a
// wide research board asks for an awkward amount of travel. Owner request - "a SMALL swipe should
// change state" - so this is deliberately about a fingertip's worth of movement (14-24px) rather
// than a proportion of the drawer anyone would call a drag. The dead zone above still protects taps:
// a press has to move 5px before it is a drag at all, and horizontally at that.
const COMMIT_FRACTION = 0.06;
const COMMIT_MIN = 14;
const COMMIT_MAX = 24;
// A flick commits on speed alone, which is how a drawer is normally thrown open: short, fast, and
// nowhere near even that distance. Measured over a trailing window rather than the whole drag so a
// slow drag that ends with a flick still counts (and vice versa).
const FLICK_VELOCITY = 0.2; // px per ms
const FLICK_MIN_TRAVEL = 8;
const VELOCITY_WINDOW_MS = 120;
// Under this span the samples are too close together to measure a speed from, so distance decides.
const VELOCITY_MIN_SPAN_MS = 8;

/**
 * Pointer events are stamped on the same clock as performance.now(); fall back only when an event
 * carries no usable stamp at all. A stamp of 0 is taken at face value on purpose - mixing the two
 * clocks would produce a nonsense span, and a gesture whose events all read 0 simply measures as
 * unmeasurably fast, which leaves the distance rule to decide it.
 */
function panelSwipeTime(event: PointerEvent): number {
  return typeof event.timeStamp === "number" && Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
}

@Component
export default class PanelSwipe extends Vue {
  panelSwipeActive = false;
  panelSwipeSettling = false;
  panelSwipeOffset = 0;

  private panelSwipeStart: { pointerId: number; x: number; y: number; width: number; element: HTMLElement } | null =
    null;
  private panelSwipeDirection: -1 | 0 | 1 = 0;
  private panelSwipeOriginFace = "";
  private panelSwipeCompletes = false;
  private panelSwipeSettleTimer: number | null = null;
  private panelSwipeSamples: Array<{ t: number; x: number }> = [];
  private suppressPanelClick = false;
  private suppressPanelClickTimer: number | null = null;

  // ---- host contract ------------------------------------------------------
  // Overridden by the component mixing this in. `panelFaces[0]` is the face that parks to the LEFT
  // when hidden, `panelFaces[1]` the one that parks to the right.

  get panelFaces(): [string, string] {
    return ["", ""];
  }

  get panelVisibleFace(): string {
    return this.panelFaces[0];
  }

  /** True while a shared write is in flight, so a second gesture cannot race it. */
  get panelSwipeLocked(): boolean {
    return false;
  }

  /** Descendants whose own press must never start a drawer drag (the page dots, overlays, ...). */
  get panelSwipeIgnoreSelector(): string {
    return "button";
  }

  /** Called on press, before any drag is recognised - used to mount the far face lazily. */
  panelSwipePrepare(): void {
    // no-op by default
  }

  /** Called when a swipe passes the commit threshold. */
  panelSwipeCommit(face: string): void {
    void face;
  }

  // ---- gesture ------------------------------------------------------------

  onPanelPointerDown(event: PointerEvent) {
    const target = event.target;
    if (
      this.panelSwipeLocked ||
      event.isPrimary === false ||
      event.button > 0 ||
      (target instanceof Element && target.closest(this.panelSwipeIgnoreSelector))
    ) {
      this.panelSwipeStart = null;
      return;
    }
    this.clearPanelSettle();
    this.panelSwipePrepare();
    const element = event.currentTarget as HTMLElement;
    const width = element.clientWidth || element.getBoundingClientRect().width || 160;
    this.panelSwipeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width,
      element,
    };
    this.panelSwipeOriginFace = this.panelVisibleFace;
    this.panelSwipeDirection = 0;
    this.panelSwipeOffset = 0;
    this.panelSwipeActive = false;
    this.panelSwipeSamples = [{ t: panelSwipeTime(event), x: event.clientX }];
    // NOTE: the pointer is deliberately NOT captured here, only once a drag is actually recognised
    // (onPanelPointerMove). Capturing on press retargets every later mouse event - pointerup and the
    // click the browser derives from it - to this panel element, so a plain mouse click on a face
    // never reached the thing under the cursor. Buttons escaped that because they bail out above via
    // panelSwipeIgnoreSelector; the renju board's intersections, which are plain SVG rects with a
    // click handler, did not, leaving that face unplayable with a mouse. A drag still needs capture,
    // just not before there is a drag.
  }

  onPanelPointerMove(event: PointerEvent) {
    const start = this.panelSwipeStart;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    // Without capture held (it is only taken once a drag is recognised) a release outside the panel
    // never reaches onPanelPointerUp, so a press that wandered off and let go would otherwise leave
    // a stale start behind and start a phantom drag on the way back in.
    if (event.pointerType === "mouse" && event.buttons === 0) {
      this.panelSwipeStart = null;
      this.resetPanelSwipe();
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    this.recordPanelSwipeSample(event);
    if (this.panelSwipeDirection === 0) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < DRAG_THRESHOLD || absX < absY * HORIZONTAL_BIAS) {
        // Not a horizontal drag (yet). Only give the pointer back once the finger has clearly
        // committed to scrolling the page; anything else stays undecided so a swipe that started
        // slightly off-axis can still resolve into one a few pixels later.
        if (absY >= VERTICAL_RELEASE && absY > absX) {
          this.releasePanelPointer(start);
          this.panelSwipeStart = null;
        }
        return;
      }
      this.panelSwipeDirection = dx < 0 ? -1 : 1;
      this.panelSwipeActive = true;
      // Now that this really is a drag, take the pointer so the rest of it keeps arriving even if
      // the finger/cursor leaves the panel.
      if (typeof start.element.setPointerCapture === "function") {
        start.element.setPointerCapture(start.pointerId);
      }
      this.$root.$emit(PANEL_SWIPE_EVENT);
    }

    this.applyPanelSwipeOffset(dx, start.width);
    event.preventDefault();
  }

  onPanelPointerUp(event: PointerEvent) {
    const start = this.panelSwipeStart;
    this.panelSwipeStart = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    this.releasePanelPointer(start);
    if (!this.panelSwipeActive || this.panelSwipeDirection === 0) {
      this.resetPanelSwipe();
      return;
    }

    // The browser synthesizes a click immediately after a touch pointerup. Consume that one click so
    // a drawer gesture cannot also press whatever sits under the finger on either face.
    this.suppressSyntheticPanelClick();
    this.recordPanelSwipeSample(event);
    // The release carries the finger's true final position, which can sit past the last move event.
    this.applyPanelSwipeOffset(event.clientX - start.x, start.width);
    const threshold = Math.min(COMMIT_MAX, Math.max(COMMIT_MIN, start.width * COMMIT_FRACTION));
    const travelled = Math.abs(this.panelSwipeOffset);
    // Signed along the drag's own direction, so a finger that flicks back the way it came reads as
    // negative and cancels the swipe however far it had already dragged.
    const speed = this.panelSwipeVelocity() * this.panelSwipeDirection;
    const flickedOpen = speed >= FLICK_VELOCITY && travelled >= FLICK_MIN_TRAVEL;
    const flickedBack = speed <= -FLICK_VELOCITY;
    this.settlePanelSwipe(!flickedBack && (flickedOpen || travelled >= threshold));
  }

  cancelPanelSwipe() {
    const start = this.panelSwipeStart;
    this.panelSwipeStart = null;
    if (start) {
      this.releasePanelPointer(start);
    }
    if (this.panelSwipeActive) {
      this.suppressSyntheticPanelClick();
      this.settlePanelSwipe(false);
    } else {
      this.resetPanelSwipe();
    }
  }

  onPanelClickCapture(event: MouseEvent) {
    if (!this.suppressPanelClick) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.suppressPanelClick = false;
    if (this.suppressPanelClickTimer !== null) {
      window.clearTimeout(this.suppressPanelClickTimer);
      this.suppressPanelClickTimer = null;
    }
  }

  /** The inline transform for one face, mid-drag, mid-settle, or at rest. */
  panelFaceTransform(face: string): string {
    if (this.panelSwipeActive) {
      const base = face === this.panelSwipeOriginFace ? 0 : -this.panelSwipeDirection * 100;
      return `translate3d(calc(${base}% + ${this.panelSwipeOffset}px), 0, 0)`;
    }
    if (this.panelSwipeSettling && this.panelSwipeDirection !== 0) {
      const origin = face === this.panelSwipeOriginFace;
      const target = this.panelSwipeCompletes
        ? origin
          ? this.panelSwipeDirection * 100
          : 0
        : origin
        ? 0
        : -this.panelSwipeDirection * 100;
      return `translate3d(${target}%, 0, 0)`;
    }
    if (face === this.panelVisibleFace) {
      return "translate3d(0, 0, 0)";
    }
    return face === this.panelFaces[0] ? "translate3d(-100%, 0, 0)" : "translate3d(100%, 0, 0)";
  }

  /** Both faces follow the finger, clamped to the drag's own direction and the panel's own width. */
  private applyPanelSwipeOffset(dx: number, width: number) {
    const directional = this.panelSwipeDirection < 0 ? Math.min(0, dx) : Math.max(0, dx);
    this.panelSwipeOffset = Math.max(-width, Math.min(width, directional));
  }

  private recordPanelSwipeSample(event: PointerEvent) {
    const t = panelSwipeTime(event);
    this.panelSwipeSamples.push({ t, x: event.clientX });
    // Only the trailing window is ever read, plus the one sample just before it so a window holding
    // a single point still has something to measure against.
    let oldestInWindow = this.panelSwipeSamples.length - 1;
    while (oldestInWindow > 0 && t - this.panelSwipeSamples[oldestInWindow - 1].t <= VELOCITY_WINDOW_MS) {
      oldestInWindow--;
    }
    if (oldestInWindow > 1) {
      this.panelSwipeSamples.splice(0, oldestInWindow - 1);
    }
  }

  /** Horizontal pointer speed over the trailing window, in px/ms; 0 when it cannot be measured. */
  private panelSwipeVelocity(): number {
    const samples = this.panelSwipeSamples;
    const last = samples[samples.length - 1];
    if (!last) {
      return 0;
    }
    const windowStart = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS) ?? last;
    // A window too short to time (one coalesced burst of moves, or a synchronous test) falls back to
    // everything retained rather than reporting a wild speed from a near-zero span.
    const first = last.t - windowStart.t >= VELOCITY_MIN_SPAN_MS ? windowStart : samples[0];
    const span = last.t - first.t;
    return span >= VELOCITY_MIN_SPAN_MS ? (last.x - first.x) / span : 0;
  }

  private settlePanelSwipe(completes: boolean) {
    this.panelSwipeActive = false;
    this.panelSwipeSettling = true;
    this.panelSwipeCompletes = completes;
    if (completes) {
      const [first, second] = this.panelFaces;
      this.panelSwipeCommit(this.panelSwipeOriginFace === first ? second : first);
    }
    this.panelSwipeSettleTimer = window.setTimeout(() => {
      this.panelSwipeSettleTimer = null;
      this.resetPanelSwipe();
    }, SETTLE_MS);
  }

  private resetPanelSwipe() {
    this.panelSwipeSamples = [];
    this.panelSwipeActive = false;
    this.panelSwipeSettling = false;
    this.panelSwipeCompletes = false;
    this.panelSwipeOffset = 0;
    this.panelSwipeDirection = 0;
  }

  private clearPanelSettle() {
    if (this.panelSwipeSettleTimer !== null) {
      window.clearTimeout(this.panelSwipeSettleTimer);
      this.panelSwipeSettleTimer = null;
    }
    this.resetPanelSwipe();
  }

  private releasePanelPointer(start: { pointerId: number; element: HTMLElement }) {
    if (
      typeof start.element.releasePointerCapture === "function" &&
      (!start.element.hasPointerCapture || start.element.hasPointerCapture(start.pointerId))
    ) {
      start.element.releasePointerCapture(start.pointerId);
    }
  }

  private suppressSyntheticPanelClick() {
    this.suppressPanelClick = true;
    if (this.suppressPanelClickTimer !== null) {
      window.clearTimeout(this.suppressPanelClickTimer);
    }
    this.suppressPanelClickTimer = window.setTimeout(() => {
      this.suppressPanelClick = false;
      this.suppressPanelClickTimer = null;
    }, 0);
  }

  beforeDestroy() {
    if (this.suppressPanelClickTimer !== null) {
      window.clearTimeout(this.suppressPanelClickTimer);
    }
    if (this.panelSwipeSettleTimer !== null) {
      window.clearTimeout(this.panelSwipeSettleTimer);
    }
  }
}
