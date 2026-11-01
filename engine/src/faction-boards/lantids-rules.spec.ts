import { expect } from "chai";
import { possibleBuildings } from "../available/buildings";
import { possibleFederationTokenBuildMine, possibleSpaceshipTechTileBuildMine } from "../available/federations";
import { qicForDistance } from "../cost";
import Engine from "../engine";
import {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  Building,
  Condition,
  Faction,
  FinalTile,
  Phase,
  Planet,
  Player as PlayerEnum,
  ScoringTile,
  SpaceshipFederation,
} from "../enums";
import { moveBuild } from "../move/buildings";
import { leechPossible } from "../move/phase";
import Reward from "../reward";
import { roundScoringEvents } from "../tiles/scoring";
import { techTileEventWithSource } from "../tiles/techs";

function position(nbPlayers = 4) {
  const engine = new Engine([`init ${nbPlayers} lantids-rules-audit`], { lostFleet: true });
  engine.players.forEach((player, i) => {
    player.faction = [Faction.Lantids, Faction.Geodens, Faction.Xenos, Faction.Darkanians][i];
    player.loadFaction(null, engine.expansions, false, nbPlayers);
    player.data.credits = 25;
    player.data.ores = 15;
    player.data.qics = 10;
    player.data.range = 99;
  });
  engine.phase = Phase.RoundMove;
  const player = engine.players[0];
  const host = engine.players[1];
  const target = engine.map.getS("DS11_0");
  const share = (location: string, planet: Planet) => {
    const hex = engine.map.getS(location);
    hex.data.planet = planet;
    host.build(Building.Mine, hex, [], engine.map, 0, false);
    player.build(Building.Mine, hex, [], engine.map);
    return hex;
  };
  const home = [...engine.map.grid.values()].find((h) => h.data.planet === Planet.Terra);
  player.build(Building.Mine, home, [], engine.map);
  return { engine, player, host, target, share };
}

describe("Lantids shared-mine rules audit", () => {
  for (const reward of ["final", "booster", "advanced", "advanced-pass"]) {
    it(`counts distinct shared deep sectors for ${reward}, excluding Gaiaformers and stations`, () => {
      const { engine, player, share } = position();
      share("DS11_0", Planet.Protoplanet);
      share("DS11_1", Planet.Asteroid);
      share("DS12_0", Planet.Lost);
      const own = engine.map.getS("DS13_0");
      own.data.planet = Planet.Terra;
      player.build(Building.Mine, own, [], engine.map);
      const former = engine.map.getS("DS14_0");
      former.data.planet = Planet.Transdim;
      player.build(Building.GaiaFormer, former, [], engine.map);
      const station = engine.map.getS("DS15_0");
      station.data.planet = Planet.Empty;
      player.build(Building.SpaceStation, station, [], engine.map);
      expect(player.finalCount(FinalTile.DeepSpaceSector)).to.equal(3);
      expect(player.finalCount(FinalTile.PlanetType)).to.equal(1);
      expect(player.finalCount(FinalTile.Asteroid)).to.equal(0);
      const before = player.data.victoryPoints;
      if (reward === "booster") player.getRoundBooster(Booster.LostFleetDeep);
      if (reward === "advanced")
        player.loadEvents(techTileEventWithSource(AdvTechTile.Deep, AdvTechTilePos.Intelligence));
      if (reward === "advanced-pass")
        player.loadEvents(techTileEventWithSource(AdvTechTile.DeepPass, AdvTechTilePos.Intelligence));
      player.receivePassIncome();
      expect(player.data.victoryPoints - before).to.equal(reward === "final" ? 0 : reward === "advanced" ? 12 : 6);
    });
  }

  for (const planet of [Planet.Terra, Planet.Gaia, Planet.Asteroid, Planet.Protoplanet, Planet.Lost]) {
    it(`treats a shared ${planet} as a mine, with no planet cost or planet scoring`, () => {
      const { engine, player, host, target } = position();
      target.data.planet = planet;
      host.build(Building.PlanetaryInstitute, target, [], engine.map, 0, false);
      player.data.gaiaformers = 0;
      player.data.buildings[Building.PlanetaryInstitute] = 1;
      player.loadEvents(roundScoringEvents(ScoringTile.Score3, 1));
      player.loadEvents(roundScoringEvents(ScoringTile.Score6, 2));
      player.loadEvents(roundScoringEvents(ScoringTile.LfPlanet3, 3));
      const command = possibleBuildings(engine, player.player)[0];
      const offer = command.data.buildings.find((b) => b.coordinates === target.toString());
      expect(offer.cost).to.equal("2c,o");
      expect(offer.steps).to.equal(0);
      const vp = player.data.victoryPoints;
      const k = player.data.knowledge;
      moveBuild(engine, command, player.player, Building.Mine, target.toString());
      expect(player.data.victoryPoints - vp).to.equal(2);
      expect(player.data.knowledge - k).to.equal(2);
      expect(player.data.gaiaformersUsedForAsteroid).to.equal(0);
      expect(player.eventConditionCount(Condition.Mine)).to.equal(2);
      expect(player.finalCount(FinalTile.Structure)).to.equal(2);
      expect(player.finalCount(FinalTile.PlanetType)).to.equal(1);
      expect(player.finalCount(FinalTile.Gaia)).to.equal(0);
      expect(player.finalCount(FinalTile.Asteroid)).to.equal(0);
      expect(player.buildingValue(target, { federation: true })).to.equal(1);
      target.addToFederationOf(player.player);
      expect(player.finalCount(FinalTile.StructureFed)).to.equal(1);
      expect(qicForDistance(engine.map, target, player, false).distance).to.equal(0);
      expect(leechPossible(engine, target, (hex) => player.buildingValue(hex))).to.equal(1);
      expect(leechPossible(engine, target, (hex) => host.buildingValue(hex))).to.equal(3);
      expect(
        possibleBuildings(engine, player.player)[0].data.buildings.some((b) => b.coordinates === target.toString())
      ).to.equal(false);
    });
  }

  for (const action of [SpaceshipFederation.Range, SpaceshipFederation.Terraform, "tech"] as const) {
    for (const planet of [Planet.Gaia, Planet.Asteroid, Planet.Protoplanet, Planet.Lost]) {
      it(`${action}: a free shared mine on ${planet} needs no habitability payment and gives no protoplanet VP`, () => {
        const { engine, player, host, target } = position();
        target.data.planet = planet;
        host.build(Building.Mine, target, [], engine.map, 0, false);
        player.data.gaiaformers = 0;
        player.data.qics = 0;
        const command =
          action === "tech"
            ? possibleSpaceshipTechTileBuildMine(engine, player.player)[0]
            : possibleFederationTokenBuildMine(engine, player.player, { federation: action })[0];
        const offer = command.data.buildings.find((b) => b.coordinates === target.toString());
        expect(offer, "shared mine must be available without a Gaiaformer or Gaia QIC").not.to.equal(undefined);
        expect(Reward.parse(offer.cost).every((r) => r.count === 0)).to.equal(true);
        const vp = player.data.victoryPoints;
        moveBuild(engine, command, player.player, Building.Mine, target.toString());
        expect(player.data.victoryPoints).to.equal(vp);
        expect(player.data.gaiaformersUsedForAsteroid).to.equal(0);
      });
    }
  }

  it("does not share an unfinished Gaia project", () => {
    const { player, target } = position();
    target.data.planet = Planet.Gaia;
    target.data.player = PlayerEnum.Player2;
    target.data.building = Building.GaiaFormer;
    expect(player.canOccupy(target)).to.equal(false);
  });

  it("grants the solo/2p PI knowledge once for a shared Terra mine", () => {
    const { player, share } = position(2);
    player.data.buildings[Building.PlanetaryInstitute] = 1;
    const k = player.data.knowledge;
    share("DS11_0", Planet.Terra);
    expect(player.data.knowledge - k).to.equal(2);
  });
});
