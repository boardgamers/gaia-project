import { expect } from "chai";
import "mocha";
import { AdvTechTile, Building, Expansion, Faction, Planet, Player as PlayerEnum } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { classifySectorId, LostFleetSectorType } from "../lost-fleet-map";
import SpaceMap from "../map";
import Player from "../player";
import { techTileEventWithSource } from "./techs";

function newPlayer(faction = Faction.Terrans): Player {
  const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
  player.faction = faction;
  player.loadFaction(null);
  return player;
}

/** Colonizable hexes of a Lost Fleet Deep Space Sector tile, grouped by physical tile (3 hexes each). */
function deepSpaceSectorGroups(map: SpaceMap): GaiaHex[][] {
  const colonizableHexes = [...map.grid.values()].filter(
    (hex) => hex.data.planet !== Planet.Empty && !hex.data.building
  );
  const groups = new Map<string, GaiaHex[]>();

  for (const hex of colonizableHexes) {
    if (classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace) {
      const sectorId = hex.data.sector.split("_")[0];
      groups.set(sectorId, (groups.get(sectorId) ?? []).concat(hex));
    }
  }

  return [...groups.values()];
}

describe("Lost Fleet Advanced Tech tiles (RULES_CLARIFICATIONS.md §G2)", () => {
  it("asteroidpass: grants 2 VP per colonized Asteroid, on pass", () => {
    const map = new SpaceMap(2, "lost-fleet-techs-asteroidpass");
    const hexes = [...map.grid.values()].filter((hex) => hex.data.planet !== Planet.Empty && !hex.data.building);
    hexes[0].data.planet = Planet.Asteroid;
    hexes[1].data.planet = Planet.Asteroid;

    const player = newPlayer();
    player.build(Building.Mine, hexes[0], [], map);
    player.build(Building.Mine, hexes[1], [], map);

    player.loadEvents(techTileEventWithSource(AdvTechTile.AsteroidPass, AdvTechTile.AsteroidPass));

    const beforeVp = player.data.victoryPoints;
    player.receivePassIncome();

    expect(player.data.victoryPoints).to.equal(beforeVp + 4);
  });

  it("big: immediately grants 6 VP per Academy/Planetary Institute built (max 3 buildings)", () => {
    const map = new SpaceMap(2, "lost-fleet-techs-big");
    const hexes = [...map.grid.values()].filter((hex) => hex.data.planet !== Planet.Empty && !hex.data.building);

    const player = newPlayer();
    // Reward fires immediately when the tile is loaded, so colonize first.
    player.build(Building.PlanetaryInstitute, hexes[0], [], map);
    player.build(Building.Academy1, hexes[1], [], map);
    player.build(Building.Academy2, hexes[2], [], map);

    const beforeVp = player.data.victoryPoints;
    player.loadEvents(techTileEventWithSource(AdvTechTile.Big, AdvTechTile.Big));

    expect(player.data.victoryPoints).to.equal(beforeVp + 18);
  });

  it("deep: immediately grants 4 VP per distinct colonized Deep Space sector, deduped per physical tile", () => {
    const map = new SpaceMap(2, "lost-fleet-techs-deep", false, "standard", true);
    const groups = deepSpaceSectorGroups(map);
    const sectorA = groups.find((g) => g.length >= 2);
    const sectorB = groups.find((g) => g !== sectorA);

    expect(sectorA, "need a Deep Space sector with at least 2 colonizable hexes").to.not.equal(undefined);
    expect(sectorB, "need a second, distinct Deep Space sector").to.not.equal(undefined);

    const player = newPlayer();
    player.build(Building.Mine, sectorA[0], [], map);
    player.build(Building.Mine, sectorA[1], [], map); // same sector again: must not double-count
    player.build(Building.Mine, sectorB[0], [], map);

    const beforeVp = player.data.victoryPoints;
    player.loadEvents(techTileEventWithSource(AdvTechTile.Deep, AdvTechTile.Deep));

    // 4 VP * 2 distinct sectors colonized (3 hexes total, but only 2 sectors).
    expect(player.data.victoryPoints).to.equal(beforeVp + 8);
  });

  it("deeppass: grants 2 VP per distinct colonized Deep Space sector, on pass", () => {
    const map = new SpaceMap(2, "lost-fleet-techs-deeppass", false, "standard", true);
    const groups = deepSpaceSectorGroups(map);
    const sectorA = groups[0];
    const sectorB = groups.find((g) => g !== sectorA);

    expect(sectorA, "need a Deep Space sector").to.not.equal(undefined);
    expect(sectorB, "need a second, distinct Deep Space sector").to.not.equal(undefined);

    const player = newPlayer();
    player.build(Building.Mine, sectorA[0], [], map);
    player.build(Building.Mine, sectorB[0], [], map);

    player.loadEvents(techTileEventWithSource(AdvTechTile.DeepPass, AdvTechTile.DeepPass));

    const beforeVp = player.data.victoryPoints;
    player.receivePassIncome();

    expect(player.data.victoryPoints).to.equal(beforeVp + 4);
  });

  it("terra: grants 2 VP per terraforming step, scaling with multi-step colonizations", () => {
    const player = newPlayer();
    player.loadEvents(techTileEventWithSource(AdvTechTile.Terra, AdvTechTile.Terra));

    const beforeVp = player.data.victoryPoints;
    player.receiveTerraformingStepTriggerIncome(3); // e.g. colonizing a Protoplanet (3 steps)

    expect(player.data.victoryPoints).to.equal(beforeVp + 6);
  });
});
