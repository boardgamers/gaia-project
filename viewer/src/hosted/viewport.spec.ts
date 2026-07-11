import { expect } from "chai";
import { isDesktopViewport, watchDesktopViewport } from "./viewport";

describe("viewport desktop detection", () => {
  function mockMatchMedia(matches: boolean) {
    const listeners: Array<(event: { matches: boolean }) => void> = [];
    const previous = window.matchMedia;
    (window as any).matchMedia = (query: string) => ({
      media: query,
      matches,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        listeners.push(listener);
      },
      removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      },
      dispatchEvent: () => false,
    });
    return {
      fire(nextMatches: boolean) {
        for (const listener of [...listeners]) {
          listener({ matches: nextMatches });
        }
      },
      listenerCount: () => listeners.length,
      restore() {
        (window as any).matchMedia = previous;
      },
    };
  }

  it("reports desktop when the min-width: 768px query matches", () => {
    const media = mockMatchMedia(true);
    try {
      expect(isDesktopViewport()).to.equal(true);
    } finally {
      media.restore();
    }
  });

  it("reports mobile when the min-width: 768px query does not match", () => {
    const media = mockMatchMedia(false);
    try {
      expect(isDesktopViewport()).to.equal(false);
    } finally {
      media.restore();
    }
  });

  it("calls back only when the breakpoint is crossed, and stops after unsubscribing", () => {
    const media = mockMatchMedia(false);
    try {
      const seen: boolean[] = [];
      const unwatch = watchDesktopViewport((isDesktop) => seen.push(isDesktop));
      expect(media.listenerCount()).to.equal(1);

      media.fire(true);
      expect(seen).to.deep.equal([true]);

      unwatch();
      media.fire(false);
      expect(seen).to.deep.equal([true]);
    } finally {
      media.restore();
    }
  });
});
