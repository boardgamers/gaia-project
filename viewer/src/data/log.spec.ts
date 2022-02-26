import Engine, { AdvTechTile, AdvTechTilePos, TechTile, TechTilePos } from "@gaia-project/engine";
import { Player } from "@gaia-project/engine/src/enums";
import { expect } from "chai";
import { parsedMove, recentMoves } from "../logic/recent";
import { runJsonTests } from "../logic/test-utils";
import { makeHistory, replaceChange, replaceMove } from "./log";

describe("Advanced log details", () => {
  const data = new Engine();
  data.tiles.techs[TechTilePos.Terraforming] = { tile: TechTile.Tech1, count: 1 };
  data.tiles.techs[AdvTechTilePos.GaiaProject] = { tile: AdvTechTile.AdvTech4, count: 1 };

  describe("moves", () => {
    it("federation tile", () => {
      expect(replaceMove(data, parsedMove("ivits spend 4pw for 1q. action qic2. fedtile fed4.")).move).to.equal(
        "ivits spend 4pw for 1q. action qic2. fedtile fed4 (7vp,2o)."
      );
      expect(replaceMove(data, parsedMove("taklons federation 1A4,9A9,9B4,9C fed4.")).move).to.equal(
        "taklons federation 1A4,9A9,9B4,9C fed4 (7vp,2o)."
      );
    });
    it("booster should be replaced", () => {
      expect(replaceMove(data, parsedMove("gleens pass booster7")).move).to.equal(
        "gleens pass booster7 (1o, 2 VP / ts)"
      );
    });
    it("tech should be replaced (twice)", () => {
      expect(replaceMove(data, parsedMove("baltaks build lab 4B1. tech terra. tech terra")).move).to.equal(
        "baltaks build lab 4B1. tech terra (o,q). tech terra (o,q)"
      );
    });
    it("advanced tech should be replaced", () => {
      expect(replaceMove(data, parsedMove("baltaks build lab 4B1. tech adv-gaia. cover terra")).move).to.equal(
        "baltaks build lab 4B1. tech adv-gaia (2 VP / mine). cover terra (o,q)"
      );
    });
  });

  describe("changes", () => {
    it("booster should be replaced", () => {
      expect(replaceChange(data, "booster7")).to.equal("booster7 (1o, 2 VP / ts)");
    });
    it("tech should be replaced", () => {
      expect(replaceChange(data, "tech-terra")).to.equal("tech-terra (o,q)");
    });
    it("advanced tech should be replaced", () => {
      expect(replaceChange(data, "adv-gaia")).to.equal("adv-gaia (2 VP / mine)");
    });
  });

  describe("history", () => {
    runJsonTests({
      baseDir: "src/data/logTests",
      subTests: () => ["all", "recent"],
      replay: false,
      createActualOutput: (data, scope) => {
        const history = makeHistory(
          data,
          recentMoves(Player.Player1, data.advancedLog, data.moveHistory),
          scope === "recent",
          undefined,
          true
        );
        if (scope === "all") {
          //remove rows, it's just too much to handle
          for (const e of history) {
            delete e.rows;
          }
        }
        return history;
      },
    });
  });
});
