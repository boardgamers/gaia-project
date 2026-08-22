// Geometry for the mobile chat popup shared by ChatNotesPanel.vue and LobbyChatPanel.vue.
//
// Both panels used to be a full-screen `position: fixed; inset: 0` overlay on a phone. The owner
// asked for a popup instead: full page width, but anchored ABOVE the floating chat button and only
// as tall as the space above it, so the button itself stays visible and one tap minimizes the chat
// again. That turns a purely-CSS layout into a measured one - the button's own bottom offset is
// dynamic (it clears the sticky move/premove bar, whose height changes), and an on-screen keyboard
// can eat the bottom of the visible area - so the arithmetic lives here, pure and tested, instead of
// twice over in two components.
//
// The keyboard case is what `overlay-viewport.ts` already answers: it reports a pin ONLY when the
// visual viewport is genuinely shorter than the layout viewport (iOS Safari's keyboard), and null
// for pinch-zoom, address-bar collapse and elastic overscroll, all of which a `position: fixed`
// element already survives. We reuse that verdict rather than re-deriving it: a pin means "the
// bottom `keyboardInset` px of the layout viewport are not visible", so both the button and the
// popup have to be lifted by that much.

import { overlayViewportPin, OverlayViewportPin } from "./overlay-viewport";

/** The floating toggle's height in CSS px - `3rem` at the default root font size, and the popup has
 * to sit clear of it. Kept in sync with `.chat-notes__toggle` / `.lobby-chat__toggle`'s own height. */
export const CHAT_TOGGLE_HEIGHT = 48;

/** Breathing room between the top of the toggle and the bottom of the popup, so the two read as two
 * separate surfaces rather than one welded strip. */
export const CHAT_POPUP_GAP = 10;

/** Page deliberately left visible above the popup. Without it a popup that uses "everything above
 * the button" is a full-screen overlay again in all but name; with it the game (and its top bar)
 * stays in view, which is the whole point of the popup. */
export const CHAT_POPUP_TOP_CLEARANCE = 64;

/** Floor for the popup, for the pathological cases - a very short viewport, or a keyboard tall
 * enough that the honest answer would be a few pixels. Better to overlap the button slightly than
 * to render a chat nobody can read. */
export const CHAT_POPUP_MIN_HEIGHT = 180;

export interface ChatPopupInput {
  /** The toggle's own distance from the bottom of the LAYOUT viewport (px). */
  toggleBottom: number;
  /** `window.visualViewport`'s verdict from `overlayViewportPin`, or null when no keyboard is up. */
  pin: OverlayViewportPin;
  /** `window.innerHeight` - the layout viewport `position: fixed` anchors to. */
  innerHeight: number;
  /** Default true: keep the popup above the floating toggle so the toggle stays visible. Set false
   * for a normal chat window that should use all available room down to the reserved bottom area. */
  keepToggleVisible?: boolean;
}

export interface ChatPopupGeometry {
  /** Inline `bottom` for the popup (px from the layout viewport's bottom edge). */
  bottom: number;
  /** Inline `max-height` for the popup (px). */
  maxHeight: number;
  /** How much the on-screen keyboard covers, so the toggle can be lifted by the same amount and
   * stay tappable while the composer has focus. 0 whenever no keyboard is up. */
  keyboardInset: number;
}

export function chatPopupGeometry(input: ChatPopupInput): ChatPopupGeometry {
  const { toggleBottom, pin, innerHeight, keepToggleVisible = true } = input;
  const keyboardInset = pin ? Math.max(0, Math.round(innerHeight - (pin.top + pin.height))) : 0;
  // What the user can actually see right now: the visual viewport under a keyboard, the layout
  // viewport otherwise (see overlay-viewport.ts for why those are the only two cases).
  const visibleHeight = pin ? pin.height : innerHeight;
  const toggleClearance = keepToggleVisible ? CHAT_TOGGLE_HEIGHT + CHAT_POPUP_GAP : 0;
  const clearance = toggleBottom + toggleClearance;
  return {
    bottom: Math.round(keyboardInset + clearance),
    maxHeight: Math.max(CHAT_POPUP_MIN_HEIGHT, Math.round(visibleHeight - clearance - CHAT_POPUP_TOP_CLEARANCE)),
    keyboardInset,
  };
}

/**
 * Subscribes to `window.visualViewport` and reports `overlayViewportPin`'s verdict on every change,
 * immediately included. Returns an unsubscribe. Both `resize` (the keyboard opening/closing) and
 * `scroll` (the browser scrolling the page to chase a focused input) matter, which is the detail a
 * hand-rolled listener in each component kept getting subtly different.
 */
/** Class the page root carries while a chat popup is up. frontend.scss turns it into an
 * `overflow: hidden` on `html`/`body` at mobile widths - see `setPageScrollLock`. */
export const PAGE_SCROLL_LOCK_CLASS = "chat-popup-open";

/** Class the page root carries while a mobile chat composer has forced the on-screen keyboard up.
 * frontend.scss hides the game's own sticky action/premove footer under it; the keyboard already
 * owns that space, and leaving the game controls visible there squeezes the chat window upward. */
export const PAGE_KEYBOARD_OPEN_CLASS = "chat-popup-keyboard-open";

/** `window.scrollY` at the moment of locking, so a browser that resets the offset when the root
 * stops scrolling can be put back. Module-level rather than per-component because only one chat
 * popup can ever be open at a time (the per-game panel and the lobby panel live on different
 * screens). */
let lockedScrollY: number | null = null;

/**
 * Locks or releases document scrolling for as long as a chat popup is open.
 *
 * A touch that starts on the popup but NOT on its message list - the header, the notifications
 * strip, the composer - has no scroll container of its own to move, so the gesture chains outward
 * and scrolls the game behind the popup instead. That was invisible while the mobile chat was a
 * full-screen overlay (the page moved, but nothing of it was on screen to see); with a popup, the
 * board is right there and visibly slides under it, which is what the owner reported.
 *
 * `overscroll-behavior` cannot fix this: the panel has no scrollable overflow of its own, so it is
 * never part of the scroll chain to begin with (verified in a real browser - adding it to the panel
 * changed nothing). Nor can `touch-action: none` on the panel, since touch-action intersects down
 * the ancestor chain and would take the message list's own scrolling with it. Removing the thing
 * being chained TO is what works: the list still scrolls, because it is a real scroll container and
 * already contains its own overscroll.
 */
export function setPageScrollLock(locked: boolean): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (locked) {
    if (lockedScrollY === null && typeof window !== "undefined") {
      lockedScrollY = window.scrollY;
    }
    root.classList.add(PAGE_SCROLL_LOCK_CLASS);
    return;
  }
  root.classList.remove(PAGE_SCROLL_LOCK_CLASS);
  const restoreTo = lockedScrollY;
  lockedScrollY = null;
  // Only when it actually moved - jsdom has no layout, and calling scrollTo there is pure noise.
  if (restoreTo !== null && typeof window !== "undefined" && window.scrollY !== restoreTo) {
    window.scrollTo(0, restoreTo);
  }
}

export function setKeyboardOpenClass(open: boolean): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle(PAGE_KEYBOARD_OPEN_CLASS, open);
}

export function watchOverlayViewport(onPin: (pin: OverlayViewportPin) => void): () => void {
  const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
  if (!vv) {
    return () => undefined;
  }
  const update = () => {
    onPin(
      overlayViewportPin({
        scale: vv.scale || 1,
        offsetTop: vv.offsetTop,
        height: vv.height,
        innerHeight: window.innerHeight,
      })
    );
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  update();
  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
  };
}
