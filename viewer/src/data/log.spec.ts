import Engine, { AdvTechTile, AdvTechTilePos, TechTile, TechTilePos } from "@gaia-project/engine";
import { Player } from "@gaia-project/engine/src/enums";
import { expect } from "chai";
import { parsedMove, recentMoves } from "../logic/recent";
import { runJsonTests } from "../logic/utils";
import { LogScope, makeHistory, replaceChange, replaceMove } from "./log";

describe("Advanced log details", () => {
  const data = new Engine();
  data.tiles.techs[TechTilePos.Terraforming] = { tile: TechTile.Tech1, count: 1 };
  data.tiles.techs[AdvTechTilePos.GaiaProject] = { tile: AdvTechTile.AdvTech4, count: 1 };

  describe("moves", () => {
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
      expect(replaceMove(data, parsedMove("baltaks build lab 4B1. tech adv-gaia")).move).to.equal(
        "baltaks build lab 4B1. tech adv-gaia (2 VP / mine)"
      );
    });
  });

  describe("changes", () => {
    it("tech should be replaced", () => {
      expect(replaceChange(data, "tech-terra")).to.deep.equal("tech-terra (o,q)");
    });
    it("advanced tech should be replaced", () => {
      expect(replaceChange(data, "adv-gaia")).to.deep.equal("adv-gaia (2 VP / mine)");
    });
  });

  describe("history", () => {
    runJsonTests({
      baseDir: "src/data/logTests",
      subTests: () => ["all", "recent"],
      createActualOutput: (data, scope) =>
        makeHistory(data, recentMoves(Player.Player1, data.advancedLog, data.moveHistory), scope as LogScope),
    });
  });
});
