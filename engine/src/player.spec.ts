import { expect } from "chai";
import "mocha";
import { Building, Expansion, Faction, Operator, Planet, Player as PlayerEnum, Resource } from "./enums";
import Event from "./events";
import { GaiaHex } from "./gaia-hex";
import SpaceMap from "./map";
import Player from "./player";
import Reward from "./reward";

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
});
