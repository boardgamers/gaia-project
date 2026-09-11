import { EventEmitter } from "events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountGameChat } from "./game-chat";

describe("chat beside the mobile action bar", () => {
  let emitter: EventEmitter;
  let panel: HTMLElement;
  let list: HTMLElement;
  let shortcut: HTMLButtonElement;

  function rect(top: number, height: number): DOMRect {
    return { top, bottom: top + height, left: 0, right: 390, width: 390, height } as DOMRect;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
      }
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
      }
    );
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    document.body.innerHTML =
      '<div id="host"><div class="chat-host"></div><div class="mobile-sticky-actions-spacer"></div></div>';
    const host = document.querySelector("#host")!;
    vi.spyOn(host.querySelector(".mobile-sticky-actions-spacer")!, "getBoundingClientRect").mockReturnValue(
      rect(900, 180)
    );
    emitter = new EventEmitter();
    mountGameChat(emitter, host);
    panel = host.querySelector(".bgs-game-chat")!;
    list = host.querySelector(".chat-messages")!;
    shortcut = host.querySelector(".chat-shortcut")!;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("keeps a message unread while the action bar covers it", () => {
    const read = vi.fn();
    emitter.on("chat:read", read);
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(rect(650, 130));
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(680, 60));
    emitter.emit("chat:appended", [{ _id: "000000000000000000000001", author: "Nevlas", text: "Hello" }]);
    const row = list.firstElementChild!;
    const rowBounds = vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(690, 40));
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(600);

    expect(read).not.toHaveBeenCalled();
    expect(shortcut.hidden).toBe(false);
    expect(shortcut.textContent).toContain("1 unread");

    vi.mocked(panel.getBoundingClientRect).mockReturnValue(rect(350, 130));
    vi.mocked(list.getBoundingClientRect).mockReturnValue(rect(380, 60));
    rowBounds.mockReturnValue(rect(390, 40));
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(600);

    expect(read).toHaveBeenCalledExactlyOnceWith({ messageId: "000000000000000000000001" });
    expect(shortcut.hidden).toBe(true);
    expect(shortcut.textContent).toBe("Chat");
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(600);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("moves the same unread shortcut into the action bar and restores it off turn", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(rect(900, 130));
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(930, 60));
    emitter.emit("chat:appended", [{ _id: "000000000000000000000001", author: "Nevlas", text: "Hello" }]);
    const bar = document.createElement("div");
    bar.className = "mobile-sticky-actions";
    bar.innerHTML = '<span class="chat-shortcut-host"></span>';
    document.querySelector("#host")!.prepend(bar);
    await Promise.resolve();

    expect(bar.contains(shortcut)).toBe(true);
    expect(shortcut.textContent).toBe("Chat · 1");
    expect(shortcut.getAttribute("aria-label")).toBe("Open Chat · 1 unread");
    expect(shortcut.hidden).toBe(false);

    vi.stubGlobal("innerWidth", 1280);
    window.dispatchEvent(new Event("resize"));
    expect(bar.contains(shortcut)).toBe(false);
    expect(shortcut.textContent).toBe("Chat · 1 unread");

    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    expect(bar.contains(shortcut)).toBe(true);
    bar.remove();
    await Promise.resolve();
    expect(shortcut.parentElement!.className).toBe("chat-host");
    expect(shortcut.textContent).toBe("Chat · 1 unread");
    expect(document.querySelectorAll(".chat-shortcut")).toHaveLength(1);
  });
});
