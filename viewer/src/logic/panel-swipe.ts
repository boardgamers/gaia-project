import Vue from "vue";
import { Component } from "vue-property-decorator";

/**
 * The horizontal two-face drawer shared by the compact booster/federation pool (Pool.vue, which
 * swipes between its tiles and the chess board) and the research board panel (ResearchPanel.vue,
 * which swipes between the research art and the renju board).
 *
 * This started life inside Pool.vue and was lifted here unchanged when the second drawer arrived.
 * Everything about the gesture's feel lives here: a 7px dead zone before a drag is recognised, a
 * horizontal-vs-vertical intent test that releases the pointer for a vertical scroll, both faces
 * following the finger, a commit threshold proportional to the panel's own width, a short settle
 * transition, and the one synthetic click a browser fires after a touch release being swallowed so
 * a drawer gesture can never also press whatever sits under the finger. That last part matters most
 * for the research panel, whose faces are live Gaia move buttons.
 *
 * A component mixes this in and supplies its own two face names plus how a completed swipe is
 * committed (locally, or through a shared per-game backend).
 */

export const PANEL_SWIPE_EVENT = "lf::panel-swipe";

// Below this the pointer is still treated as a tap, so ordinary presses on either face are unaffected.
const DRAG_THRESHOLD = 7;
// A drag only counts as horizontal when it clearly out-paces its own vertical component; otherwise
// the pointer is released so the page can scroll normally.
const HORIZONTAL_BIAS = 1.15;
const SETTLE_MS = 180;

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
    if (this.panelSwipeDirection === 0) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) {
        return;
      }
      if (Math.abs(dx) <= Math.abs(dy) * HORIZONTAL_BIAS) {
        this.releasePanelPointer(start);
        this.panelSwipeStart = null;
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

    const directionalOffset = this.panelSwipeDirection < 0 ? Math.min(0, dx) : Math.max(0, dx);
    this.panelSwipeOffset = Math.max(-start.width, Math.min(start.width, directionalOffset));
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
    const threshold = Math.min(64, Math.max(36, start.width * 0.22));
    this.settlePanelSwipe(Math.abs(this.panelSwipeOffset) >= threshold);
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
