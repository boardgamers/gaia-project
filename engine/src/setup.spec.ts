import { expect } from "chai";
import Engine from "./engine";
import {
  AdvTechTilePos,
  ArtifactToken,
  ScoringBoardExtensionSide,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
} from "./enums";
import { artifactSlotCount, shipsInPlay, spaceshipBoards } from "./spaceships";

describe("Lost Fleet spaceship setup", () => {
  it("should not assign any tech tiles or federation tokens without the Lost Fleet expansion", () => {
    const engine = new Engine(["init 4 randomSeed"], {});
    expect(engine.tiles.spaceshipTechs).to.deep.equal({});
    expect(engine.tiles.spaceshipFederations).to.deep.equal({});
  });

  it("should not seed any Artifact tokens without the Lost Fleet expansion", () => {
    const engine = new Engine(["init 4 randomSeed"], {});
    expect(engine.tiles.artifacts).to.deep.equal([]);
  });

  for (const nbPlayers of [2, 3, 4]) {
    it(`should seed Standard Tech tiles onto exactly the ships with a tech slot in play (${nbPlayers}p)`, () => {
      const engine = new Engine([`init ${nbPlayers} randomSeed`], { lostFleet: true });
      const ships = shipsInPlay(engine.expansions, nbPlayers).filter(
        (ship) => spaceshipBoards[ship].hasStandardTechSlot
      );

      expect(Object.keys(engine.tiles.spaceshipTechs)).to.have.length(ships.length);
      for (const ship of ships) {
        expect(engine.tiles.spaceshipTechs[ship].tile).to.be.oneOf(SpaceshipTechTile.values(engine.expansions));
        expect(engine.tiles.spaceshipTechs[ship].count).to.equal(nbPlayers);
      }
      // every assigned tile is distinct
      const assigned = ships.map((ship) => engine.tiles.spaceshipTechs[ship].tile);
      expect(new Set(assigned).size).to.equal(assigned.length);
    });

    it(`should seed Federation tokens onto exactly the ships in play (${nbPlayers}p)`, () => {
      const engine = new Engine([`init ${nbPlayers} randomSeed`], { lostFleet: true });
      const ships = shipsInPlay(engine.expansions, nbPlayers);

      expect(Object.keys(engine.tiles.spaceshipFederations)).to.have.length(ships.length);
      for (const ship of ships) {
        expect(engine.tiles.spaceshipFederations[ship]).to.be.oneOf(SpaceshipFederation.values(engine.expansions));
      }
      const assigned = ships.map((ship) => engine.tiles.spaceshipFederations[ship]);
      expect(new Set(assigned).size).to.equal(assigned.length);
    });

    it(`should seed one distinct Artifact token per player onto Twilight (${nbPlayers}p)`, () => {
      const engine = new Engine([`init ${nbPlayers} randomSeed`], { lostFleet: true });

      expect(engine.tiles.artifacts).to.have.length(artifactSlotCount(Spaceship.Twilight, nbPlayers));
      for (const token of engine.tiles.artifacts) {
        expect(token).to.be.oneOf(ArtifactToken.values(engine.expansions));
      }
      expect(new Set(engine.tiles.artifacts).size).to.equal(engine.tiles.artifacts.length);
    });
  }

  it("should be deterministic for a given seed (Artifact tokens)", () => {
    const a = new Engine(["init 4 myseed"], { lostFleet: true });
    const b = new Engine(["init 4 myseed"], { lostFleet: true });
    expect(a.tiles.artifacts).to.deep.equal(b.tiles.artifacts);
  });

  it("should exclude Rebellion from both seedings in 2-player games", () => {
    const engine = new Engine(["init 2 randomSeed"], { lostFleet: true });
    expect(engine.tiles.spaceshipTechs[Spaceship.Rebellion]).to.be.undefined;
    expect(engine.tiles.spaceshipFederations[Spaceship.Rebellion]).to.be.undefined;
  });

  it("should use all 3 Standard Tech tiles in 3+ player games, none left over", () => {
    const engine = new Engine(["init 4 randomSeed"], { lostFleet: true });
    const assigned = Object.values(engine.tiles.spaceshipTechs);
    expect(assigned).to.have.length(3);
    expect(new Set(assigned).size).to.equal(3);
  });

  it("should be deterministic for a given seed", () => {
    const a = new Engine(["init 4 myseed"], { lostFleet: true });
    const b = new Engine(["init 4 myseed"], { lostFleet: true });
    expect(a.tiles.spaceshipTechs).to.deep.equal(b.tiles.spaceshipTechs);
    expect(a.tiles.spaceshipFederations).to.deep.equal(b.tiles.spaceshipFederations);
  });

  describe("Scoring Board Extension (§E6)", () => {
    it("should place exactly one randomly-drawn Advanced Tech tile on the extension slot", () => {
      const engine = new Engine(["init 3 randomSeed"], { lostFleet: true });
      expect(engine.tiles.techs[AdvTechTilePos.ScoringExtension]).to.not.be.undefined;
      expect(engine.tiles.techs[AdvTechTilePos.ScoringExtension].count).to.equal(1);
    });

    it("should not set up the extension slot without the Lost Fleet expansion", () => {
      const engine = new Engine(["init 3 randomSeed"], {});
      expect(engine.scoringExtensionSide).to.be.undefined;
      expect(engine.tiles.techs[AdvTechTilePos.ScoringExtension]).to.be.undefined;
    });

    it("should always force the 25-VP side in 2-player games", () => {
      for (const seed of ["lf-ext-2p-0", "lf-ext-2p-1", "lf-ext-2p-2"]) {
        const engine = new Engine([`init 2 ${seed}`], { lostFleet: true });
        expect(engine.scoringExtensionSide).to.equal(ScoringBoardExtensionSide.VictoryPoints);
      }
    });

    it("should randomize the side 50/50 in 3-player games", () => {
      const vp = new Engine(["init 3 lf-ext-3p-1"], { lostFleet: true });
      expect(vp.scoringExtensionSide).to.equal(ScoringBoardExtensionSide.VictoryPoints);

      const ships = new Engine(["init 3 lf-ext-3p-0"], { lostFleet: true });
      expect(ships.scoringExtensionSide).to.equal(ScoringBoardExtensionSide.ExploredShips);
    });

    it("should randomize the side 50/50 in 4-player games", () => {
      const vp = new Engine(["init 4 lf-ext-4p-0"], { lostFleet: true });
      expect(vp.scoringExtensionSide).to.equal(ScoringBoardExtensionSide.VictoryPoints);

      const ships = new Engine(["init 4 lf-ext-4p-2"], { lostFleet: true });
      expect(ships.scoringExtensionSide).to.equal(ScoringBoardExtensionSide.ExploredShips);
    });

    it("should be deterministic for a given seed", () => {
      const a = new Engine(["init 4 myseed"], { lostFleet: true });
      const b = new Engine(["init 4 myseed"], { lostFleet: true });
      expect(a.scoringExtensionSide).to.equal(b.scoringExtensionSide);
    });
  });
});
