import { expect } from "chai";
import "mocha";
import {
  Booster,
  Building,
  Expansion,
  Faction,
  FinalTile,
  Operator,
  Planet,
  Player as PlayerEnum,
  Resource,
  SpaceshipFederation,
} from "./enums";
import Event from "./events";
import { GaiaHex } from "./gaia-hex";
import { classifySectorId, LostFleetSectorType } from "./lost-fleet-map";
import SpaceMap from "./map";
import Player from "./player";
import Reward from "./reward";
import { boosterEvents } from "./tiles/boosters";

describe("Player", () => {
  describe("canBuild", () => {
    it("should take addedCost into account", () => {
      const player = new Player(Expansion.None, PlayerEnum.Player1);

      player.faction = Faction.Terrans;
      player.loadFaction(null);

      const { cost } = player.canBuild(null, null, Planet.Terra, Building.Mine, false, false, {
        addedCost: [new Reward(1, Resource.Qic)],
      });

      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(Reward.parse("2c,o,q"), cost)).to.be.true;
    });

    it("should grant a 6 VP bonus (encoded as -6vp cost) when building a mine on a Protoplanet", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);

      player.faction = Faction.Terrans;
      player.loadFaction(null);
      player.data.ores = 20; // enough to afford the 3 terraform steps on top of the base mine cost

      const { cost } = player.canBuild(null, null, Planet.Protoplanet, Building.Mine, false, false);

      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(Reward.parse("2c,10o,-6vp"), cost)).to.be.true;
    });

    it("should reject building a mine on an Asteroid without an available Gaiaformer", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);

      player.faction = Faction.Terrans;
      player.loadFaction(null);
      player.data.gaiaformers = 0; // every faction starts with 1 via GaiaProject research level 1

      expect(player.canBuild(null, null, Planet.Asteroid, Building.Mine, false, false)).to.equal(null);
    });

    it("should waive the mine build cost on an Asteroid when a Gaiaformer is available", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);

      player.faction = Faction.Terrans;
      player.loadFaction(null);

      const { cost } = player.canBuild(null, null, Planet.Asteroid, Building.Mine, false, false);

      // tslint:disable-next-line no-unused-expression
      expect(Reward.match([], cost)).to.be.true;
    });

    it("should charge Darkanians a flat 1 terraforming step regardless of the target planet's color", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);

      player.faction = Faction.Darkanians;
      player.loadFaction(null);
      player.data.ores = 20; // enough to afford the terraform step on top of the base mine cost

      const { cost } = player.canBuild(null, null, Planet.Terra, Building.Mine, false, false);

      // base mine cost (2c,o) + 1 terraforming step (3o, no discount)
      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(Reward.parse("2c,4o"), cost)).to.be.true;
    });

    it("should charge Space Giants a flat 2 terraforming steps regardless of the target planet's color", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);

      player.faction = Faction.SpaceGiants;
      player.loadFaction(null);
      player.data.ores = 20; // enough to afford both terraform steps on top of the base mine cost

      const { cost } = player.canBuild(null, null, Planet.Terra, Building.Mine, false, false);

      // base mine cost (2c,o) + 2 terraforming steps (6o, no discount)
      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(Reward.parse("2c,7o"), cost)).to.be.true;
    });

    it("should charge a 2 QIC surcharge (instead of the standard 1) for Darkanians/Space Giants building a mine on a Gaia planet", () => {
      for (const faction of [Faction.Darkanians, Faction.SpaceGiants]) {
        const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);

        player.faction = faction;
        player.loadFaction(null);
        player.data.qics = 20; // enough to afford the 2 QIC surcharge

        const { cost } = player.canBuild(null, null, Planet.Gaia, Building.Mine, false, false);

        // tslint:disable-next-line no-unused-expression
        expect(Reward.match(Reward.parse("2c,o,2q"), cost)).to.be.true;
      }
    });

    it("should still only charge the standard 1 QIC for other factions building a mine on a Gaia planet", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);

      player.faction = Faction.Terrans;
      player.loadFaction(null);

      const { cost } = player.canBuild(null, null, Planet.Gaia, Building.Mine, false, false);

      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(Reward.parse("2c,o,q"), cost)).to.be.true;
    });

    [Faction.Moweyds, Faction.SpaceGiants].forEach((faction) => {
      it(`should not grant the +6 VP Protoplanet bonus when ${faction} builds on its home Protoplanet`, () => {
        const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
        const map = new SpaceMap(2, `home-protoplanet-${faction}`);
        const hex = new GaiaHex(0, 0, { sector: "s1", planet: Planet.Protoplanet });

        player.faction = faction;
        player.loadFaction(null);
        player.data.ores = 20;

        const { cost } = player.canBuild(map, hex, Planet.Protoplanet, Building.Mine, false, false);

        expect(cost.some((reward) => reward.type === Resource.VictoryPoint && reward.count === -6)).to.be.false;
      });
    });
  });

  describe("build", () => {
    it("should permanently consume a Gaiaformer when colonizing an Asteroid, while still granting normal mine income", () => {
      const map = new SpaceMap(2, "test-seed");
      const hex = Array.from(map.grid.values()).find((h) => h.data.planet !== Planet.Empty && !h.data.building);
      hex.data.planet = Planet.Asteroid;

      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);

      const { cost } = player.canBuild(map, hex, Planet.Asteroid, Building.Mine, false, false);
      player.build(Building.Mine, hex, cost, map);

      expect(player.data.gaiaformersUsedForAsteroid).to.equal(1);
      // tslint:disable-next-line no-unused-expression
      expect(player.data.hasResource(new Reward(1, Resource.GaiaFormer))).to.be.false;
      expect(player.data.buildings[Building.Mine]).to.equal(1);
    });

    it("should grant Darkanians 2 credits and 1 knowledge only for the first colonization in each Space/Deep Space sector", () => {
      const map = new SpaceMap(2, "darkanians-sector-reward", false, "standard", true);
      const colonizableHexes = [...map.grid.values()].filter((hex) => hex.data.planet !== Planet.Empty && !hex.data.building);
      const spaceGroups = new Map<string, GaiaHex[]>();
      const deepSpaceGroups = new Map<string, GaiaHex[]>();

      for (const hex of colonizableHexes) {
        const sectorType = classifySectorId(hex.data.sector);

        if (sectorType === LostFleetSectorType.Space) {
          spaceGroups.set(hex.data.sector, (spaceGroups.get(hex.data.sector) ?? []).concat(hex));
        } else if (sectorType === LostFleetSectorType.DeepSpace) {
          const sectorId = hex.data.sector.split("_")[0];
          deepSpaceGroups.set(sectorId, (deepSpaceGroups.get(sectorId) ?? []).concat(hex));
        }
      }

      const sameSpaceSectorGroups = [...spaceGroups.values()].filter((group) => group.length >= 2);
      const prePiSector = sameSpaceSectorGroups[0];
      const rewardedSpaceSector = sameSpaceSectorGroups.find((group) => group[0].data.sector !== prePiSector[0].data.sector);
      const deepSpaceSector = [...deepSpaceGroups.values()].find((group) => group.length >= 2);
      const interspaceHex = colonizableHexes.find(
        (hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.Interspace
      );

      expect(prePiSector, "need a Space sector with at least 2 colonizable hexes").to.not.equal(undefined);
      expect(rewardedSpaceSector, "need a second Space sector with at least 2 colonizable hexes").to.not.equal(undefined);
      expect(deepSpaceSector, "need a Deep Space tile with at least 2 colonizable hexes").to.not.equal(undefined);
      expect(interspaceHex, "need a colonizable Interspace hex").to.not.equal(undefined);

      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Darkanians;
      player.loadFaction(null);

      const baselineCredits = player.data.credits;
      const baselineKnowledge = player.data.knowledge;

      player.build(Building.Mine, prePiSector[0], [], map);
      expect(player.data.credits).to.equal(baselineCredits);
      expect(player.data.knowledge).to.equal(baselineKnowledge);

      player.data.buildings[Building.PlanetaryInstitute] = 1;

      player.build(Building.Mine, prePiSector[1], [], map);
      expect(player.data.credits).to.equal(baselineCredits);
      expect(player.data.knowledge).to.equal(baselineKnowledge);

      player.build(Building.Mine, rewardedSpaceSector[0], [], map);
      expect(player.data.credits).to.equal(baselineCredits + 2);
      expect(player.data.knowledge).to.equal(baselineKnowledge + 1);

      player.build(Building.Mine, rewardedSpaceSector[1], [], map);
      expect(player.data.credits).to.equal(baselineCredits + 2);
      expect(player.data.knowledge).to.equal(baselineKnowledge + 1);

      player.build(Building.Mine, interspaceHex, [], map);
      expect(player.data.credits).to.equal(baselineCredits + 2);
      expect(player.data.knowledge).to.equal(baselineKnowledge + 1);

      player.build(Building.Mine, deepSpaceSector[0], [], map);
      expect(player.data.credits).to.equal(baselineCredits + 4);
      expect(player.data.knowledge).to.equal(baselineKnowledge + 2);

      player.build(Building.Mine, deepSpaceSector[1], [], map);
      expect(player.data.credits).to.equal(baselineCredits + 4);
      expect(player.data.knowledge).to.equal(baselineKnowledge + 2);
    });
  });

  describe("finalCount", () => {
    it("should count colonized Asteroids for the Lost Fleet asteroid final scoring", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;

      player.data.occupied.push(
        new GaiaHex(0, 0, { sector: "s1", planet: Planet.Asteroid, player: PlayerEnum.Player1, building: Building.Mine }),
        new GaiaHex(1, -1, {
          sector: "s2",
          planet: Planet.Asteroid,
          player: PlayerEnum.Player1,
          building: Building.TradingStation,
        }),
        new GaiaHex(2, -2, { sector: "s3", planet: Planet.Protoplanet, player: PlayerEnum.Player1, building: Building.Mine })
      );

      expect(player.finalCount(FinalTile.Asteroid)).to.equal(2);
    });

    it("should count unique Deep Space tiles, not individual hexes, for the Lost Fleet deep-space final scoring", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;

      player.data.occupied.push(
        new GaiaHex(0, 0, {
          sector: "DS11_0",
          planet: Planet.Protoplanet,
          player: PlayerEnum.Player1,
          building: Building.Mine,
        }),
        new GaiaHex(1, -1, {
          sector: "DS11_1",
          planet: Planet.Asteroid,
          player: PlayerEnum.Player1,
          building: Building.TradingStation,
        }),
        new GaiaHex(2, -2, {
          sector: "DS12_0",
          planet: Planet.Transdim,
          player: PlayerEnum.Player1,
          building: Building.Academy1,
        })
      );

      expect(player.finalCount(FinalTile.DeepSpaceSector)).to.equal(2);
    });

    it("should score the longest range from the Planetary Institute to either Academy for the Lost Fleet distance final scoring", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;

      player.data.occupied.push(
        new GaiaHex(0, 0, {
          sector: "s1",
          planet: Planet.Terra,
          player: PlayerEnum.Player1,
          building: Building.PlanetaryInstitute,
        }),
        new GaiaHex(2, 0, {
          sector: "s2",
          planet: Planet.Ice,
          player: PlayerEnum.Player1,
          building: Building.Academy1,
        }),
        new GaiaHex(4, 0, {
          sector: "s3",
          planet: Planet.Oxide,
          player: PlayerEnum.Player1,
          building: Building.Academy2,
        })
      );

      expect(player.finalCount(FinalTile.PlanetaryInstituteAcademyDistance)).to.equal(4);
    });

    it("should score 0 for the Lost Fleet distance final scoring if the Planetary Institute or both Academies are missing", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;

      player.data.occupied.push(
        new GaiaHex(0, 0, { sector: "s1", planet: Planet.Terra, player: PlayerEnum.Player1, building: Building.Academy1 })
      );

      expect(player.finalCount(FinalTile.PlanetaryInstituteAcademyDistance)).to.equal(0);
    });
  });

  describe("gainSpaceshipFederationToken", () => {
    it("should grant 8 VP and 8 credits for the Credit token", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);
      const beforeVp = player.data.victoryPoints;
      const beforeCredits = player.data.credits;

      player.gainSpaceshipFederationToken(SpaceshipFederation.Credit);

      expect(player.data.victoryPoints).to.equal(beforeVp + 8);
      expect(player.data.credits).to.equal(beforeCredits + 8);
    });

    it("should grant 4 VP and 4 knowledge for the Knowledge token", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);
      const beforeVp = player.data.victoryPoints;
      const beforeKnowledge = player.data.knowledge;

      player.gainSpaceshipFederationToken(SpaceshipFederation.Knowledge);

      expect(player.data.victoryPoints).to.equal(beforeVp + 4);
      expect(player.data.knowledge).to.equal(beforeKnowledge + 4);
    });

    it("should grant 4 VP, 2 ore, and 1 QIC for the OreQic token", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);
      const beforeVp = player.data.victoryPoints;
      const beforeOres = player.data.ores;
      const beforeQic = player.data.qics;

      player.gainSpaceshipFederationToken(SpaceshipFederation.OreQic);

      expect(player.data.victoryPoints).to.equal(beforeVp + 4);
      expect(player.data.ores).to.equal(beforeOres + 2);
      expect(player.data.qics).to.equal(beforeQic + 1);
    });

    it("should grant 12 VP for the Vp token", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);
      const beforeVp = player.data.victoryPoints;

      player.gainSpaceshipFederationToken(SpaceshipFederation.Vp);

      expect(player.data.victoryPoints).to.equal(beforeVp + 12);
    });

    it("should grant 7 VP and 2 power tokens placed directly into Area III for the PowerTokens token", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);
      const beforeVp = player.data.victoryPoints;
      const beforeArea3 = player.data.power.area3;

      player.gainSpaceshipFederationToken(SpaceshipFederation.PowerTokens);

      expect(player.data.victoryPoints).to.equal(beforeVp + 7);
      expect(player.data.power.area3).to.equal(beforeArea3 + 2);
    });

    it("should grant a Tech tile pick (TechTile reward) for the Tech token", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);

      let gained = 0;
      player.data.on(`gain-${Resource.TechTile}`, (count: number) => {
        gained += count;
      });

      player.gainSpaceshipFederationToken(SpaceshipFederation.Tech);

      expect(gained).to.equal(1);
    });

    it("should not grant any plain reward for the Range/Terraform tokens (a bonus build action is wired separately)", () => {
      for (const federation of [SpaceshipFederation.Range, SpaceshipFederation.Terraform]) {
        const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
        player.faction = Faction.Terrans;
        player.loadFaction(null);
        const beforeVp = player.data.victoryPoints;
        const beforeCredits = player.data.credits;
        const beforeOres = player.data.ores;
        const beforeQic = player.data.qics;
        const beforeKnowledge = player.data.knowledge;

        player.gainSpaceshipFederationToken(federation);

        expect(player.data.victoryPoints).to.equal(beforeVp);
        expect(player.data.credits).to.equal(beforeCredits);
        expect(player.data.ores).to.equal(beforeOres);
        expect(player.data.qics).to.equal(beforeQic);
        expect(player.data.knowledge).to.equal(beforeKnowledge);
      }
    });
  });

  describe("removeEvent", () => {
    it("should work", () => {
      const player = new Player();

      player.loadEvents(Event.parse(["+k", "+o", "+c"], null));
      player.removeEvent(new Event("+o"));

      expect(player.events[Operator.Income]).to.have.lengthOf(2);
      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(player.events[Operator.Income][0].rewards, [new Reward("k")])).to.be.true;
      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(player.events[Operator.Income][1].rewards, [new Reward("1c")])).to.be.true;
    });

    it("should work on events that were activated", () => {
      const player = new Player();

      player.loadEvents(Event.parse(["+k", "=> 4c", "+c"], null));
      player.events[Operator.Activate][0].activated = true;
      player.removeEvent(new Event("=> 4c"));

      expect(player.events[Operator.Activate]).to.have.lengthOf(0);
    });
  });

  describe("canOccupy", () => {
    it("should allow lantids to occupy an hex used by another faction", () => {
      const player = new Player();

      player.faction = Faction.Lantids;
      player.loadFaction(null);
      const hex = new GaiaHex(0, 0, {
        sector: "s1",
        planet: Planet.Lost,
        player: PlayerEnum.Player2,
        building: Building.Mine,
      });

      // tslint:disable-next-line no-unused-expression
      expect(player.canOccupy(hex)).to.be.true;
    });
  });

  describe("order Events", () => {
    it("should order based on type order", () => {
      const player = new Player();

      player.loadEvents(Event.parse(["+t", "+k", "+c", "+o"], null));
      const orderedEvents = Reward.toString(
        Reward.merge([].concat(...player.events[Operator.Income].map((event) => event.rewards))),
        true
      );

      expect(orderedEvents).to.be.equal("c,o,k,t");
    });
  });

  describe("whenTheLostPlanetIsPlaced", () => {
    it("does nothing if there are no cached federations", () => {
      const player = new Player();
      expect(() => player.notifyOfNewPlanet(new GaiaHex())).to.not.throw();
    });

    it("does nothing if the cached federations are not overlapping the lost planet", () => {
      const player = new Player();
      player.federationCache = {
        availableSatellites: 25,
        custom: false,
        federations: [
          {
            hexes: [],
            planets: 0,
            satellites: 5,
          },
        ],
      };
      player.notifyOfNewPlanet(new GaiaHex());
      expect(player.federationCache).to.not.equal(null);
      expect(player.federationCache.availableSatellites).to.equal(25);
    });

    it("does clears the cache if a federation has a collision", () => {
      const player = new Player();
      const lostPlanet = new GaiaHex();
      player.federationCache = {
        availableSatellites: 25,
        custom: false,
        federations: [
          {
            hexes: [lostPlanet],
            planets: 0,
            satellites: 5,
          },
        ],
      };
      player.notifyOfNewPlanet(lostPlanet);
      expect(player.federationCache).to.equal(null);
    });
  });

  describe("actionsWithoutTile", () => {
    it("excludes Booster-granted special actions (already shown on the booster's own tile)", () => {
      const player = new Player(Expansion.None, PlayerEnum.Player1);
      player.faction = Faction.Terrans;
      player.loadFaction(null);
      player.loadEvents(boosterEvents(Booster.Booster4));

      expect(player.actions.map((a) => a.rewards)).to.include("step");
      expect(player.actionsWithoutTile.map((a) => a.rewards)).to.not.include("step");
    });

    it("keeps faction-innate special actions with no tile of their own (e.g. Space Giants')", () => {
      const player = new Player(Expansion.LostFleet, PlayerEnum.Player1);
      player.faction = Faction.SpaceGiants;
      player.loadFaction(null);

      expect(player.actions.map((a) => a.rewards)).to.include("2step");
      expect(player.actionsWithoutTile.map((a) => a.rewards)).to.include("2step");
    });
  });
});
