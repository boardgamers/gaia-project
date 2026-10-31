import { ViewerEmitter } from "@boardgamers/protocol/viewer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountGameChat } from "./game-chat";
import { catalogs } from "./localization";
import frenchCatalog from "./localization/fr.json";

describe("game chat icon", () => {
  let emitter: ViewerEmitter;
  let dispose: () => void;
  let host: HTMLElement;
  let button: HTMLButtonElement;
  const message = {
    _id: "6ae5d8400000000000000001",
    type: "text" as const,
    author: "Nevlas",
    text: "Hello",
    createdAt: "2026-10-31T12:00:00Z",
  };
  const next = { ...message, _id: "6ae5d87c0000000000000001", createdAt: "2026-10-31T12:01:00Z" };
  const badge = () => button.querySelector<HTMLElement>(".game-chat-unread")!;

  beforeEach(() => {
    catalogs.fr = frenchCatalog;
    vi.stubGlobal("innerWidth", 1280);
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      }
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      }
    );
    document.body.innerHTML =
      '<div id="host"><div class="game-chat-button-host--fallback"></div><div id="move-title"><span class="game-chat-button-host--desktop"></span></div></div>';
    host = document.querySelector("#host")!;
    emitter = new ViewerEmitter();
    dispose = mountGameChat(emitter, host);
    emitter.emit("preferences", { platformChat: true });
    emitter.emit("chat:state", { canSend: true });
    button = host.querySelector(".game-chat-button")!;
  });

  afterEach(() => {
    dispose();
    emitter.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("opens the native chat even with no unread messages, without an embedded panel or floating shortcut", () => {
    const open = vi.fn();
    emitter.on("chat:open", open);
    expect(button.hidden).toBe(false);
    expect(badge().hidden).toBe(true);
    button.click();
    expect(open).toHaveBeenCalledOnce();
    expect(document.querySelector(".bgs-game-chat, .chat-shortcut, .game-chat-dialog")).toBeNull();
  });

  it("keeps translated accessible labels when moving between header slots", async () => {
    emitter.emit("preferences", { platformChat: true, locale: "fr" });
    expect(button.title).toBe("Discussion");
    expect(button.getAttribute("translate")).toBe("no");
    expect(button.querySelector("svg")).not.toBeNull();
    host.append(document.createElement("span"));
    await Promise.resolve();
    expect(button.title).toBe("Discussion");
    emitter.emit("preferences", { platformChat: true, locale: "en" });
    expect(button.title).toBe("Chat");
  });

  it("shows only a badge for unread messages and lets the host acknowledge native-chat reads", () => {
    const read = vi.fn();
    emitter.on("chat:read", read);
    emitter.emit("chat:state", {
      canSend: true,
      readState: { userId: "local", lastReadAt: Date.parse(message.createdAt) },
    });
    emitter.emit("chat:messages", [message, next]);
    expect(badge().hidden).toBe(false);
    expect(badge().textContent).toBe("1");
    expect(button.getAttribute("aria-label")).toBe("Open Chat · 1 unread");
    button.click();
    expect(read).not.toHaveBeenCalled();
    expect(badge().hidden).toBe(false);
    emitter.emit("chat:state", {
      canSend: true,
      readState: { userId: "local", lastReadAt: Date.parse(next.createdAt) },
    });
    expect(badge().hidden).toBe(true);
    expect(button.hidden).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Open Chat");
  });

  it("does not treat replacement history as new and clears deleted unread messages", () => {
    emitter.emit("chat:messages", [message]);
    expect(badge().hidden).toBe(true);
    emitter.emit("chat:appended", [next]);
    expect(badge().textContent).toBe("1");
    expect(badge().hidden).toBe(false);
    emitter.emit("chat:messages", [message, next]);
    expect(badge().textContent).toBe("1");
    emitter.emit("chat:deleted", [next._id]);
    expect(badge().hidden).toBe(true);
    expect(button.hidden).toBe(false);
  });

  it("keeps chat accessible when notifications are suppressed, but hides it in standalone analyses", () => {
    emitter.emit("chat:appended", [message]);
    emitter.emit("preferences", { platformChat: true, chatNotifications: false });
    expect(badge().hidden).toBe(true);
    expect(button.hidden).toBe(false);
    emitter.emit("preferences", { platformChat: true, chatNotifications: true });
    expect(badge().hidden).toBe(false);
    emitter.emit("preferences", { platformChat: true, analysis: true });
    expect(button.hidden).toBe(true);
    emitter.emit("preferences", { platformChat: true, analysis: false });
    expect(button.hidden).toBe(false);
  });

  it("moves one icon between desktop, mobile and fallback headers when controls remount", async () => {
    const desktop = host.querySelector(".game-chat-button-host--desktop")!;
    const mobile = document.createElement("div");
    mobile.className = "mobile-sticky-actions mobile-sticky-actions--collapsed";
    mobile.innerHTML = '<span class="game-chat-button-host--mobile"></span>';
    host.append(mobile);
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    expect(mobile.contains(button)).toBe(true);
    vi.stubGlobal("innerWidth", 1280);
    window.dispatchEvent(new Event("resize"));
    expect(desktop.contains(button)).toBe(true);
    vi.stubGlobal("innerWidth", 390);
    window.dispatchEvent(new Event("resize"));
    mobile.remove();
    await Promise.resolve();
    expect(desktop.contains(button)).toBe(true);
    desktop.remove();
    await Promise.resolve();
    expect(host.querySelector(".game-chat-button-host--fallback")!.contains(button)).toBe(true);
    expect(host.querySelectorAll(".game-chat-button")).toHaveLength(1);
  });

  it("opens a local dialog on hosts without system chat and removes it when system chat becomes available", () => {
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
      const element = createElement(tag, options);
      if (tag === "dialog")
        Object.assign(element, {
          showModal(this: HTMLDialogElement) {
            this.open = true;
          },
          close(this: HTMLDialogElement) {
            this.open = false;
            this.dispatchEvent(new Event("close"));
          },
        });
      return element;
    });
    emitter.emit("preferences", { platformChat: false });
    emitter.emit("chat:messages", [message]);
    expect(document.querySelector(".bgs-game-chat")).toBeNull();
    button.click();
    const dialog = document.querySelector<HTMLDialogElement>(".game-chat-dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("Hello");
    expect(dialog.querySelector("input")).not.toBeNull();
    (dialog.querySelector(".game-chat-close") as HTMLButtonElement).click();
    expect(dialog.open).toBe(false);
    emitter.emit("preferences", { platformChat: true });
    expect(document.querySelector(".game-chat-dialog, .bgs-game-chat")).toBeNull();
  });

  it("removes the button and its listeners on disposal", async () => {
    dispose();
    host.append(document.createElement("span"));
    emitter.emit("chat:appended", [message]);
    window.dispatchEvent(new Event("resize"));
    await Promise.resolve();
    expect(document.querySelector(".game-chat-button, .game-chat-dialog")).toBeNull();
  });
});
