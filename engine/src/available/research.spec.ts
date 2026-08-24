import { expect } from "chai";
import "mocha";
import Engine from "../engine";
import {
  AdvTechTile,
  AdvTechTilePos,
  Faction,
  Federation,
  Player as PlayerEnum,
  ScoringBoardExtensionSide,
  TechTile,
  TechTilePos,
} from "../enums";
import { canTakeAdvancedTechTile } from "./research";

function createLostFleetEngine(side: ScoringBoardExtensionSide) {
  const engine = new Engine(["init 3 randomSeed"], { lostFleet: true });
  engine.scoringExtensionSide = side;
  engine.tiles.techs[AdvTechTilePos.ScoringExtension] = { tile: AdvTechTile.AdvTech1, count: 1 };

  const pl = engine.player(PlayerEnum.Player1);
  pl.faction = Faction.Terrans;
  pl.loadFaction(null, engine.expansions);
  pl.data.victoryPoints = 10;
  pl.data.tiles.federations.push({ tile: Federation.Fed1, green: true });
  pl.data.tiles.techs.push({ tile: TechTile.Tech1, pos: TechTilePos.Terraforming, enabled: true });

  return engine;
}

describe("canTakeAdvancedTechTile", () => {
  describe("the Scoring Board Extension slot (§E6)", () => {
    it("should refuse the VP side below 25 VP, regardless of research level", () => {
      const engine = createLostFleetEngine(ScoringBoardExtensionSide.VictoryPoints);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.victoryPoints = 24;
      pl.data.research.terra = 5;

      expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.ScoringExtension)).to.be.false;
    });

    it("should allow the VP side at 25+ VP, even at research level 0", () => {
      const engine = createLostFleetEngine(ScoringBoardExtensionSide.VictoryPoints);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.victoryPoints = 25;

      expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.ScoringExtension)).to.be.true;
    });

    it("should refuse the ships side below 3 explored ships", () => {
      const engine = createLostFleetEngine(ScoringBoardExtensionSide.ExploredShips);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.explorationShips = { ship1: 1, ship2: 2 } as any;

      expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.ScoringExtension)).to.be.false;
    });

    it("should allow the ships side once 3 ships are explored", () => {
      const engine = createLostFleetEngine(ScoringBoardExtensionSide.ExploredShips);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.explorationShips = { ship1: 1, ship2: 2, ship3: 3 } as any;

      expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.ScoringExtension)).to.be.true;
    });

    it("should still require an unflipped Federation token even when the VP/ships condition is met", () => {
      const engine = createLostFleetEngine(ScoringBoardExtensionSide.VictoryPoints);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.victoryPoints = 30;
      pl.data.tiles.federations = [{ tile: Federation.Fed1, green: false }];

      expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.ScoringExtension)).to.be.false;
    });

    it("should still require an owned Standard Tech tile to cover", () => {
      const engine = createLostFleetEngine(ScoringBoardExtensionSide.VictoryPoints);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.victoryPoints = 30;
      pl.data.tiles.techs = [];

      expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.ScoringExtension)).to.be.false;
    });

    it("should still require the tile to be in stock", () => {
      const engine = createLostFleetEngine(ScoringBoardExtensionSide.VictoryPoints);
      const pl = engine.player(PlayerEnum.Player1);
      pl.data.victoryPoints = 30;
      engine.tiles.techs[AdvTechTilePos.ScoringExtension].count = 0;

      expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.ScoringExtension)).to.be.false;
    });
  });

  it("should leave the normal research-level gate untouched for the other Advanced Tech tiles", () => {
    const engine = createLostFleetEngine(ScoringBoardExtensionSide.VictoryPoints);
    const pl = engine.player(PlayerEnum.Player1);
    pl.data.victoryPoints = 30;
    engine.tiles.techs[AdvTechTilePos.Terraforming] = { tile: AdvTechTile.AdvTech4, count: 1 };

    // 30 VP doesn't help: this tile still needs research level 4/5 in Terraforming.
    pl.data.research.terra = 3;
    expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.Terraforming)).to.be.false;

    pl.data.research.terra = 4;
    expect(canTakeAdvancedTechTile(engine, pl.data, AdvTechTilePos.Terraforming)).to.be.true;
  });
});
