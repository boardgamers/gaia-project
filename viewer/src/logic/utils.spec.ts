import Engine from "@gaia-project/engine";
import { expect } from "chai";
import { gameSeed, researchBoardHeight, rotate } from "./utils";

describe("Utils", () => {
  describe("gameSeed", () => {
    it("reads the seed from moveHistory[0], not the fragile map.seed", () => {
      const engine = new Engine(["init 2 my-cool-seed"], { lostFleet: true });

      expect(gameSeed(engine)).to.equal("my-cool-seed");
    });

    it("survives a full serialize/deserialize round-trip (map.seed does not)", () => {
      const engine = new Engine(["init 2 my-cool-seed"], { lostFleet: true });
      const restored = Engine.fromData(JSON.parse(JSON.stringify(engine)));

      expect(restored.map.seed).to.equal(undefined); // documents the bug this works around
      expect(gameSeed(restored)).to.equal("my-cool-seed");
    });

    it("returns undefined for an engine with no move history", () => {
      const engine = new Engine();

      expect(gameSeed(engine)).to.equal(undefined);
    });
  });

  describe("researchBoardHeight", () => {
    it("is a fixed 440 for the base game, regardless of its own final scoring tiles", () => {
      const engine = new Engine(["init 2 my-cool-seed"]);

      expect(engine.tiles.scorings.final.length).to.be.greaterThan(0);
      expect(researchBoardHeight(engine)).to.equal(440);
    });

    it("grows just enough to fit Lost Fleet's tight top-aligned scoring column", () => {
      const engine = new Engine(["init 2 my-cool-seed"], { lostFleet: true });

      expect(engine.tiles.scorings.final).to.have.length(2);
      // The scoring column is a tight top-aligned stack (not stretched to fill the board or pinned
      // to the action row): round tiles R6-R1 then the two finals directly below, ending at ~437,
      // so the board grows just past the base 440 to fit them (448 with the bottom margin).
      expect(researchBoardHeight(engine)).to.equal(448);
    });
  });

  describe("rotate", () => {
    const tests: {
      name: string;
      give: string[];
      want: string[];
    }[] = [
      {
        name: "sorted",
        give: ["s", "1", "2"],
        want: ["s", "1", "2"],
      },
      {
        name: "not sorted",
        give: ["1", "s", "2", "3"],
        want: ["s", "2", "3", "1"],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        expect(rotate(test.give, "s")).to.deep.equal(test.want);
      });
    }
  });
});
