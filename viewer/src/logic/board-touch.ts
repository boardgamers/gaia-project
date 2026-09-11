// Tooltips must not sit over a board while a finger is scrolling it.
export function installBoardTouch(root: Element, dismiss: () => void): () => void {
  let start: { x: number; y: number } | undefined;
  const onStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    start = touch ? { x: touch.clientX, y: touch.clientY } : undefined;
  };
  const onMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (start && touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8) {
      start = undefined;
      dismiss();
    }
  };
  const onEnd = () => {
    start = undefined;
  };
  const options = { capture: true, passive: true };
  root.addEventListener("touchstart", onStart, options);
  root.addEventListener("touchmove", onMove, options);
  root.addEventListener("touchend", onEnd, options);
  root.addEventListener("touchcancel", onEnd, options);
  return () => {
    root.removeEventListener("touchstart", onStart, true);
    root.removeEventListener("touchmove", onMove, true);
    root.removeEventListener("touchend", onEnd, true);
    root.removeEventListener("touchcancel", onEnd, true);
  };
}
