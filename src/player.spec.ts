import {expect} from "chai";
import 'mocha';
import Player from "./player";
import { Faction, Planet, Building, Resource, Player as PlayerEnum } from "./enums";
import Reward from "./reward";

describe("Player", () => {
  describe("canBuild", () => {
    it("should take addedCost into account", () => {
      const player = new Player(PlayerEnum.Player1);

      player.loadFaction(Faction.Terrans);

      const cost = player.canBuild(Planet.Terra, Building.Mine, {addedCost: [new Reward(1, Resource.Qic)]});

      expect(Reward.match(Reward.parse("2c,o,q"), cost)).to.be.true;
    });
  });
});