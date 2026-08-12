import { expect } from "chai";
import { DockablePanel, syncPanelOpen } from "./panel-dock";

/** The relevant half of a mounted Vue panel: an `open` field plus Vue 2's `$watch`. */
function fakePanel(open: boolean): DockablePanel & { setOpen(next: boolean): void } {
  const watchers: ((open: boolean) => void)[] = [];
  return {
    open,
    $watch(expression: string, callback: (open: boolean) => void) {
      expect(expression).to.equal("open");
      watchers.push(callback);
      return () => {
        const index = watchers.indexOf(callback);
        if (index !== -1) {
          watchers.splice(index, 1);
        }
      };
    },
    setOpen(next: boolean) {
      this.open = next;
      for (const watcher of [...watchers]) {
        watcher(next);
      }
    },
  };
}

describe("panel-dock", () => {
  describe("syncPanelOpen", () => {
    // The regression this module exists for: a panel restored from localStorage is already open at
    // mount, and a plain $watch would not report it until the user toggled it - leaving the game
    // laid out at full width underneath a docked panel.
    it("applies the panel's current state immediately", () => {
      const seen: boolean[] = [];
      syncPanelOpen(fakePanel(true), (open) => seen.push(open));
      expect(seen).to.eql([true]);
    });

    it("applies a closed panel immediately too, so a stale reservation is cleared", () => {
      const seen: boolean[] = [];
      syncPanelOpen(fakePanel(false), (open) => seen.push(open));
      expect(seen).to.eql([false]);
    });

    it("keeps applying later changes", () => {
      const seen: boolean[] = [];
      const panel = fakePanel(false);
      syncPanelOpen(panel, (open) => seen.push(open));
      panel.setOpen(true);
      panel.setOpen(false);
      expect(seen).to.eql([false, true, false]);
    });

    it("stops applying once unwatched", () => {
      const seen: boolean[] = [];
      const panel = fakePanel(false);
      const unwatch = syncPanelOpen(panel, (open) => seen.push(open));
      unwatch();
      panel.setOpen(true);
      expect(seen).to.eql([false]);
    });
  });
});
