import Engine, { AdvTechTile, AdvTechTilePos, TechTile, TechTilePos } from "@gaia-project/engine";
import { Player, Spaceship, SpaceshipTechTile } from "@gaia-project/engine/src/enums";
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

    it("a claimed Lost Fleet ship tech tile should be replaced, even though its pool entry is already deleted", () => {
      // Regression test: engine.tiles.spaceshipTechs[pos] is deleted the instant its single copy
      // is claimed (move/research.ts), unlike a base-board tech position's pool entry, which
      // survives forever. replaceTech previously only ever looked in tiles.techs (the base-board
      // pool) and threw for any move history containing an already-claimed ship tech tile - every
      // Lost Fleet game where a player claimed one, once "Extended Log" was enabled, since the log
      // always redescribes moves against the CURRENT state, not a per-move snapshot.
      const shipEngine = new Engine(["init 2 lf-log-repro", "p1 faction terrans", "p2 faction hadsch-hallas"], {
        lostFleet: true,
      });
      shipEngine.players[0].data.tiles.techs.push({
        tile: SpaceshipTechTile.Resource,
        pos: Spaceship.Rebellion,
        enabled: true,
      });
      expect(shipEngine.tiles.spaceshipTechs[Spaceship.Rebellion]).to.equal(undefined);

      expect(() => replaceMove(shipEngine, parsedMove("terrans tech rebellion."))).to.not.throw();
      expect(replaceMove(shipEngine, parsedMove("terrans tech rebellion.")).move).to.equal(
        "terrans tech rebellion (1 ore, 3 knowledge)."
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
