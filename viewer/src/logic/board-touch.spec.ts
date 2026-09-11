import { installBoardTouch } from "./board-touch";

describe("board swipes", () => {
  function touch(root: Element, type: string, x = 0, y = 0) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: [{ clientX: x, clientY: y }] });
    root.dispatchEvent(event);
    return event;
  }

  it("dismisses a tooltip once per swipe without cancelling native scrolling", () => {
    const root = document.createElement("div");
    const dismiss = vi.fn();
    const listen = vi.spyOn(root, "addEventListener");
    const remove = installBoardTouch(root, dismiss);
    expect(listen.mock.calls.every((call) => (call[2] as AddEventListenerOptions).passive)).toBe(true);
    touch(root, "touchstart", 20, 50);
    expect(touch(root, "touchmove", 20, 55).defaultPrevented).toBe(false);
    expect(dismiss).not.toHaveBeenCalled();
    expect(touch(root, "touchmove", 20, 80).defaultPrevented).toBe(false);
    touch(root, "touchmove", 20, 100);
    expect(dismiss).toHaveBeenCalledTimes(1);
    remove();
    touch(root, "touchstart");
    touch(root, "touchmove", 0, 100);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("leaves tap tooltips alone and resets after a cancelled gesture", () => {
    const root = document.createElement("div");
    const dismiss = vi.fn();
    const remove = installBoardTouch(root, dismiss);
    touch(root, "touchstart");
    touch(root, "touchend");
    touch(root, "touchmove", 0, 100);
    touch(root, "touchstart");
    touch(root, "touchcancel");
    touch(root, "touchmove", 0, 100);
    expect(dismiss).not.toHaveBeenCalled();
    remove();
  });
});
