import { expect } from "chai";
import Engine from "./engine";
import { Spaceship, SpaceshipFederation, SpaceshipTechTile } from "./enums";
import { shipsInPlay, spaceshipBoards } from "./spaceships";

describe("Lost Fleet spaceship setup", () => {
  it("should not assign any tech tiles or federation tokens without the Lost Fleet expansion", () => {
    const engine = new Engine(["init 4 randomSeed"], {});
    expect(engine.tiles.spaceshipTechs).to.deep.equal({});
    expect(engine.tiles.spaceshipFederations).to.deep.equal({});
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
  }

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
});
