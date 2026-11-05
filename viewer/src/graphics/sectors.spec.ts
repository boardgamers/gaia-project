import Engine, { Building, GaiaHex, Planet, PlayerEnum } from "@gaia-project/engine";
import { expect } from "chai";
import { isColonizedSector } from "./sectors";

function cell(sector: string, q = 0, r = 0): GaiaHex {
  return new GaiaHex(q, r, { sector, planet: Planet.Empty });
}

describe("physical sector map highlights", () => {
  it("preserves whole ordinary IDs (including alternate faces) instead of grouping by a prefix", () => {
    const engine = new Engine(["init 2 visual-sectors", "p1 faction firaks", "p2 faction lantids"]);
    const player = engine.players[0];
    for (const id of ["1", "10", "5B", "s1", "s10", "s5B"]) {
      const mine = cell(id);
      mine.data.planet = Planet.Titanium;
      mine.data.player = player.player;
      mine.data.building = Building.Mine;
      player.data.occupied = [mine];
      for (const otherId of ["1", "10", "5B", "s1", "s10", "s5B"]) {
        expect(isColonizedSector(cell(otherId), player), `${id} vs ${otherId}`).to.equal(id === otherId);
      }
    }
  });

  it("groups all three DS cells regardless of which contains a colony, but never groups IS", () => {
    const engine = new Engine(["init 2 visual-sectors", "p1 faction firaks", "p2 faction lantids"]);
    const player = engine.players[0];
    const deep = [0, 1, 2].map((index) => cell(`DS11_${index}`));
    for (const mine of deep) {
      mine.data.planet = Planet.Asteroid;
      mine.data.player = player.player;
      mine.data.building = Building.Mine;
      player.data.occupied = [mine];
      expect(deep.every((hex) => isColonizedSector(hex, player))).to.equal(true);
      expect(isColonizedSector(cell("DS12_0"), player)).to.equal(false);
    }
    const interspace = cell("IS1");
    interspace.data.planet = Planet.Terra;
    interspace.data.player = player.player;
    interspace.data.building = Building.Mine;
    player.data.occupied = [interspace];
    expect(isColonizedSector(interspace, player)).to.equal(false);
    expect(isColonizedSector(cell("IS2"), player)).to.equal(false);
  });

  it("includes a selected Lantids shared mine, but not a station or Gaiaformer", () => {
    const engine = new Engine(["init 2 visual-sectors", "p1 faction firaks", "p2 faction lantids"]);
    const [owner, lantids] = engine.players;
    const shared = cell("DS11_0");
    Object.assign(shared.data, {
      planet: Planet.Titanium,
      building: Building.Mine,
      player: owner.player,
      additionalMine: lantids.player,
    });
    owner.data.occupied = [shared];
    lantids.data.occupied = [shared];
    expect(isColonizedSector(cell("DS11_2"), lantids)).to.equal(true);
    delete shared.data.additionalMine;
    expect(isColonizedSector(cell("DS11_2"), lantids)).to.equal(false);
    for (const building of [Building.GaiaFormer, Building.SpaceStation]) {
      shared.data.building = building;
      expect(isColonizedSector(cell("DS11_2"), owner)).to.equal(false);
    }
    expect(shared.data.player).to.equal(PlayerEnum.Player1);
  });
});
