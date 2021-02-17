import { expect } from "chai";
import "mocha";
import Player from "./player";
import { BrainstoneArea, Building, Command, Faction, Operator, Planet, Player as PlayerEnum, Resource } from "./enums";
import Reward from "./reward";
import Event from "./events";
import { GaiaHex } from "./gaia-hex";
import { Power } from "./player-data";

describe("Player", () => {
  describe("canBuild", () => {
    it("should take addedCost into account", () => {
      const player = new Player(PlayerEnum.Player1);

      player.loadFaction(Faction.Terrans);

      const { cost } = player.canBuild(Planet.Terra, Building.Mine, { addedCost: [new Reward(1, Resource.Qic)] });

      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(Reward.parse("2c,o,q"), cost)).to.be.true;
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

      player.loadFaction(Faction.Lantids);
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

      expect(orderedEvents).to.be.equal("1c,1o,1k,1t");
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
