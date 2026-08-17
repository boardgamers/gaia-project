import { expect } from "chai";
import {
  clearLegacyDismissal,
  legacyDismissalSignature,
  loadLegacyDismissal,
  loadSeenRecaps,
  storeSeenRecap,
  unseenRecapLines,
} from "./turn-recap-seen";

const lines = [
  { index: 4, move: "xenos up nav." },
  { index: 5, move: "geodens action power4." },
  { index: 6, move: "nevlas pass booster3." },
];
const moveHistory = [
  "init 4 recap-test",
  "terrans build m 1A1.",
  "xenos build m 2A2.",
  "terrans up sci.",
  "xenos up nav.",
  "geodens action power4.",
  "nevlas pass booster3.",
];

describe("turn-recap-seen", () => {
  beforeEach(() => window.localStorage.clear());

  describe("unseenRecapLines", () => {
    it("shows everything when nothing has been read", () => {
      expect(unseenRecapLines(lines, null, moveHistory)).to.deep.equal(lines);
    });

    it("drops the lines already read and keeps the ones that arrived after", () => {
      const seen = { through: 5, move: "geodens action power4." };

      expect(unseenRecapLines(lines, seen, moveHistory)).to.deep.equal([lines[2]]);
    });

    it("shows nothing once the whole window has been read", () => {
      const seen = { through: 6, move: "nevlas pass booster3." };

      expect(unseenRecapLines(lines, seen, moveHistory)).to.deep.equal([]);
    });

    it("ignores a mark whose move no longer matches that position", () => {
      // A rolled-back game rewrites move indices under a live client - a stale mark must never
      // silently swallow moves the player has not read.
      const seen = { through: 5, move: "geodens build ts 3B1." };

      expect(unseenRecapLines(lines, seen, moveHistory)).to.deep.equal(lines);
    });

    it("ignores a mark pointing past the end of the history", () => {
      const seen = { through: 12, move: "nevlas pass booster3." };

      expect(unseenRecapLines(lines, seen, moveHistory)).to.deep.equal(lines);
    });
  });

  describe("storage", () => {
    it("round-trips one seat's mark", () => {
      storeSeenRecap(2, { through: 6, move: "nevlas pass booster3." });

      expect(loadSeenRecaps()).to.deep.equal({ "2": { through: 6, move: "nevlas pass booster3." } });
    });

    it("keeps every seat's mark separate", () => {
      storeSeenRecap(0, { through: 4, move: "xenos up nav." });
      storeSeenRecap(2, { through: 6, move: "nevlas pass booster3." });

      expect(loadSeenRecaps()).to.deep.equal({
        "0": { through: 4, move: "xenos up nav." },
        "2": { through: 6, move: "nevlas pass booster3." },
      });
    });

    it("reads nothing rather than throwing on a corrupt value", () => {
      window.localStorage.setItem(`opponent-moves-notice-seen:${window.location.search}`, "{not json");

      expect(loadSeenRecaps()).to.deep.equal({});
    });

    it("reads and clears the previous build's dismissal signature", () => {
      window.localStorage.setItem(`opponent-moves-notice-dismissed:${window.location.search}`, "0:3");

      expect(loadLegacyDismissal()).to.equal(legacyDismissalSignature(0, 3));

      clearLegacyDismissal();

      expect(loadLegacyDismissal()).to.equal("");
    });
  });
});
