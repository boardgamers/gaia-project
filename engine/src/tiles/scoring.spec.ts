import { expect } from "chai";
import "mocha";
import { Building, Expansion, Faction, Planet, Player as PlayerEnum, ScoringTile } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { classifySectorId, LostFleetSectorType } from "../lost-fleet-map";
import SpaceMap from "../map";
import Player from "../player";
import { roundScoringEvents } from "./scoring";

function newPlayer(faction = Faction.Terrans): Player {
  const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
  player.faction = faction;
  player.loadFaction(null);
  return player;
}

function colonizableHexes(map: SpaceMap): GaiaHex[] {
  return [...map.grid.values()].filter((hex) => hex.data.planet !== Planet.Empty && !hex.data.building);
}

describe("Lost Fleet round scoring tiles (RULES_CLARIFICATIONS.md §G4)", () => {
  it("lflab4: gains 4 VP every time a Research Lab is built", () => {
    const map = new SpaceMap(2, "lf-scoring-lab4");
    const hexes = colonizableHexes(map);
    const player = newPlayer();
    player.loadEvents(roundScoringEvents(ScoringTile.LfLab4, 1));

    const beforeVp = player.data.victoryPoints;
    player.build(Building.ResearchLab, hexes[0], [], map);

    expect(player.data.victoryPoints).to.equal(beforeVp + 4);
  });

  it("lfsector3: gains 3 VP the first time a mine is built in a new Space/Deep Space sector, not on repeats in the same sector", () => {
    const map = new SpaceMap(2, "lf-scoring-sector3", false, "standard", true);
    const hexes = colonizableHexes(map);

    // find a physical Deep Space tile with >= 2 colonizable hexes (same sector, per lostFleetSectorKey)
    const groups = new Map<string, GaiaHex[]>();
    for (const hex of hexes) {
      if (classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace) {
        const id = hex.data.sector.split("_")[0];
        groups.set(id, (groups.get(id) ?? []).concat(hex));
      }
    }
    const sameSectorHexes = [...groups.values()].find((g) => g.length >= 2);
    expect(sameSectorHexes, "need a Deep Space sector with 2 colonizable hexes").to.not.equal(undefined);

    const otherSectorHex = hexes.find(
      (h) => classifySectorId(h.data.sector) === LostFleetSectorType.Space && h.data.planet !== Planet.Empty
    );
    expect(otherSectorHex, "need a Space-sector hex").to.not.equal(undefined);

    const player = newPlayer();
    player.loadEvents(roundScoringEvents(ScoringTile.LfSector3, 1));

    const beforeVp = player.data.victoryPoints;
    player.build(Building.Mine, sameSectorHexes![0], [], map);
    expect(player.data.victoryPoints, "first mine in a new sector").to.equal(beforeVp + 3);

    player.build(Building.Mine, sameSectorHexes![1], [], map);
    expect(player.data.victoryPoints, "second mine in the SAME sector must not re-trigger").to.equal(beforeVp + 3);

    player.build(Building.Mine, otherSectorHex!, [], map);
    expect(player.data.victoryPoints, "mine in a distinct sector triggers again").to.equal(beforeVp + 6);
  });

  it("lfsector3: never triggers for a mine on an Interspace tile", () => {
    const map = new SpaceMap(2, "lf-scoring-sector3-interspace", false, "standard", true);
    const interspaceHex = [...map.grid.values()].find(
      (hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.Interspace && hex.hasPlanet() && !hex.data.building
    );
    expect(interspaceHex, "need a planet-bearing Interspace hex").to.not.equal(undefined);

    const player = newPlayer();
    player.loadEvents(roundScoringEvents(ScoringTile.LfSector3, 1));

    const beforeVp = player.data.victoryPoints;
    player.build(Building.Mine, interspaceHex!, [], map);

    expect(player.data.victoryPoints).to.equal(beforeVp);
  });

  it("lfplanet3: gains 3 VP the first time a mine is built on a new planet type, not on repeats of the same type", () => {
    const map = new SpaceMap(2, "lf-scoring-planet3");
    const hexes = colonizableHexes(map);
    const seenTypes = new Set<Planet>();
    const distinctTypeHexes: GaiaHex[] = [];
    for (const hex of hexes) {
      if (!seenTypes.has(hex.data.planet)) {
        seenTypes.add(hex.data.planet);
        distinctTypeHexes.push(hex);
      }
    }
    const sameTypeHex = hexes.find((h) => h.data.planet === distinctTypeHexes[0].data.planet && h !== distinctTypeHexes[0]);
    expect(distinctTypeHexes.length, "need at least 2 distinct planet types on the board").to.be.greaterThan(1);
    expect(sameTypeHex, "need a second hex of the first type").to.not.equal(undefined);

    const player = newPlayer();
    player.loadEvents(roundScoringEvents(ScoringTile.LfPlanet3, 1));

    const beforeVp = player.data.victoryPoints;
    player.build(Building.Mine, distinctTypeHexes[0], [], map);
    expect(player.data.victoryPoints, "first mine of a new planet type").to.equal(beforeVp + 3);

    player.build(Building.Mine, sameTypeHex!, [], map);
    expect(player.data.victoryPoints, "second mine of the SAME planet type must not re-trigger").to.equal(beforeVp + 3);

    player.build(Building.Mine, distinctTypeHexes[1], [], map);
    expect(player.data.victoryPoints, "mine of a distinct planet type triggers again").to.equal(beforeVp + 6);
  });

  it("ScoringTile.values() only includes the 3 Lost Fleet tiles under the Lost Fleet expansion", () => {
    expect(ScoringTile.values(Expansion.None)).to.not.include.members([
      ScoringTile.LfLab4,
      ScoringTile.LfSector3,
      ScoringTile.LfPlanet3,
    ]);
    expect(ScoringTile.values(Expansion.LostFleet)).to.include.members([
      ScoringTile.LfLab4,
      ScoringTile.LfSector3,
      ScoringTile.LfPlanet3,
    ]);
    // the 10 base tiles are unaffected either way
    expect(ScoringTile.values(Expansion.None)).to.have.length(10);
    expect(ScoringTile.values(Expansion.LostFleet)).to.have.length(13);
  });
});
