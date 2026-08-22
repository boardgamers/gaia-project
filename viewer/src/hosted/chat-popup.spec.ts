import { expect } from "chai";
import {
  CHAT_POPUP_GAP,
  CHAT_POPUP_MIN_HEIGHT,
  CHAT_POPUP_TOP_CLEARANCE,
  CHAT_TOGGLE_HEIGHT,
  PAGE_SCROLL_LOCK_CLASS,
  chatPopupGeometry,
  setKeyboardOpenClass,
  setPageScrollLock,
  watchOverlayViewport,
} from "./chat-popup";

describe("chat-popup", () => {
  describe("chatPopupGeometry", () => {
    it("hangs the popup directly above the toggle, leaving the toggle tappable", () => {
      const geometry = chatPopupGeometry({ toggleBottom: 24, pin: null, innerHeight: 800 });
      expect(geometry.bottom).to.equal(24 + CHAT_TOGGLE_HEIGHT + CHAT_POPUP_GAP);
      expect(geometry.keyboardInset).to.equal(0);
    });

    it("takes the space above the toggle, minus a strip of page kept visible at the top", () => {
      const geometry = chatPopupGeometry({ toggleBottom: 24, pin: null, innerHeight: 800 });
      expect(geometry.maxHeight).to.equal(800 - 24 - CHAT_TOGGLE_HEIGHT - CHAT_POPUP_GAP - CHAT_POPUP_TOP_CLEARANCE);
      // ...which is a popup, not a full-screen overlay by another name.
      expect(geometry.bottom + geometry.maxHeight).to.be.lessThan(800);
    });

    it("can fill down to the reserved bottom area when the toggle does not need to stay visible", () => {
      const geometry = chatPopupGeometry({
        toggleBottom: 96,
        pin: null,
        innerHeight: 800,
        keepToggleVisible: false,
      });
      expect(geometry.bottom).to.equal(96);
      expect(geometry.maxHeight).to.equal(800 - 96 - CHAT_POPUP_TOP_CLEARANCE);
    });

    it("follows the toggle up when the sticky move bar grows underneath it", () => {
      const short = chatPopupGeometry({ toggleBottom: 24, pin: null, innerHeight: 800 });
      const tall = chatPopupGeometry({ toggleBottom: 120, pin: null, innerHeight: 800 });
      expect(tall.bottom - short.bottom).to.equal(96);
      // The popup gives up exactly the height the bar took, rather than growing off the top.
      expect(short.maxHeight - tall.maxHeight).to.equal(96);
    });

    // An on-screen keyboard shrinks the visual viewport without moving the layout viewport that
    // `position: fixed` anchors to (iOS Safari), so both surfaces have to be lifted by hand -
    // otherwise the composer and the minimize button end up behind the keyboard.
    it("lifts the popup and the toggle clear of an on-screen keyboard, and shrinks to fit", () => {
      const geometry = chatPopupGeometry({ toggleBottom: 24, pin: { top: 0, height: 420 }, innerHeight: 800 });
      expect(geometry.keyboardInset).to.equal(380);
      expect(geometry.bottom).to.equal(380 + 24 + CHAT_TOGGLE_HEIGHT + CHAT_POPUP_GAP);
      expect(geometry.maxHeight).to.equal(420 - 24 - CHAT_TOGGLE_HEIGHT - CHAT_POPUP_GAP - CHAT_POPUP_TOP_CLEARANCE);
    });

    it("accounts for the page having been scrolled to chase the focused composer", () => {
      // `offsetTop: 40` means the visible band starts 40px down the layout viewport, so only
      // 800 - (40 + 420) = 340px of it is hidden below.
      const geometry = chatPopupGeometry({ toggleBottom: 24, pin: { top: 40, height: 420 }, innerHeight: 800 });
      expect(geometry.keyboardInset).to.equal(340);
    });

    it("never collapses below a readable height", () => {
      const geometry = chatPopupGeometry({ toggleBottom: 24, pin: { top: 0, height: 180 }, innerHeight: 800 });
      expect(geometry.maxHeight).to.equal(CHAT_POPUP_MIN_HEIGHT);
    });
  });

  describe("watchOverlayViewport", () => {
    it("reports the current pin immediately and on every viewport change, and unsubscribes cleanly", () => {
      const listeners: Record<string, () => void> = {};
      const fakeVisualViewport = {
        scale: 1,
        offsetTop: 0,
        height: window.innerHeight,
        addEventListener: (type: string, cb: () => void) => {
          listeners[type] = cb;
        },
        removeEventListener: (type: string) => {
          delete listeners[type];
        },
      };
      const previous = (window as any).visualViewport;
      (window as any).visualViewport = fakeVisualViewport;

      const seen: any[] = [];
      const unwatch = watchOverlayViewport((pin) => seen.push(pin));
      // No keyboard: no pin, and that is reported straight away rather than left undefined.
      expect(seen).to.deep.equal([null]);

      fakeVisualViewport.height = window.innerHeight - 400;
      listeners.resize();
      expect(seen[1]).to.deep.equal({ top: 0, height: window.innerHeight - 400 });

      unwatch();
      expect(Object.keys(listeners)).to.deep.equal([]);
      (window as any).visualViewport = previous;
    });

    it("is a no-op where visualViewport does not exist", () => {
      const previous = (window as any).visualViewport;
      delete (window as any).visualViewport;
      const unwatch = watchOverlayViewport(() => expect.fail("must not report a pin"));
      unwatch();
      (window as any).visualViewport = previous;
    });
  });

  // A gesture that starts on the popup's header, notifications strip or composer has no scroll
  // container of its own, so it chains out to the document and scrolls the game behind the popup
  // (owner report, reproduced in a real browser). Taking the document's scrollability away for as
  // long as the popup is up is what stops it; the message list is its own scroll container and
  // keeps working.
  describe("setPageScrollLock", () => {
    afterEach(() => {
      setPageScrollLock(false);
    });

    it("marks the page root while locked and clears it on release", () => {
      expect(document.documentElement.classList.contains(PAGE_SCROLL_LOCK_CLASS)).to.equal(false);
      setPageScrollLock(true);
      expect(document.documentElement.classList.contains(PAGE_SCROLL_LOCK_CLASS)).to.equal(true);
      setPageScrollLock(false);
      expect(document.documentElement.classList.contains(PAGE_SCROLL_LOCK_CLASS)).to.equal(false);
    });

    it("is idempotent in both directions", () => {
      setPageScrollLock(true);
      setPageScrollLock(true);
      expect(document.documentElement.classList.contains(PAGE_SCROLL_LOCK_CLASS)).to.equal(true);
      setPageScrollLock(false);
      setPageScrollLock(false);
      expect(document.documentElement.classList.contains(PAGE_SCROLL_LOCK_CLASS)).to.equal(false);
    });

    it("puts the scroll offset back for a browser that drops it while the root cannot scroll", () => {
      const calls: number[] = [];
      const previousScrollTo = window.scrollTo;
      Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
      (window as any).scrollTo = (_x: number, y: number) => calls.push(y);

      setPageScrollLock(true);
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      setPageScrollLock(false);
      expect(calls).to.deep.equal([640]);

      (window as any).scrollTo = previousScrollTo;
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    });
  });

  describe("watchOverlayViewport edge case", () => {
    it("stays a no-op where visualViewport does not exist", () => {
      const previous = (window as any).visualViewport;
      delete (window as any).visualViewport;
      const unwatch = watchOverlayViewport(() => expect.fail("must not report a pin"));
      unwatch();
      (window as any).visualViewport = previous;
    });
  });

  describe("setKeyboardOpenClass", () => {
    afterEach(() => {
      setKeyboardOpenClass(false);
    });

    it("marks the page root while the chat keyboard is open", () => {
      expect(document.documentElement.classList.contains("chat-popup-keyboard-open")).to.equal(false);
      setKeyboardOpenClass(true);
      expect(document.documentElement.classList.contains("chat-popup-keyboard-open")).to.equal(true);
      setKeyboardOpenClass(false);
      expect(document.documentElement.classList.contains("chat-popup-keyboard-open")).to.equal(false);
    });
  });
});
