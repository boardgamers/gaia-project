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

      player.loadEvents(Event.parse(["+k", "+o", "+c"], Command.ChooseIncome));
      player.removeEvent(new Event("+o"));

      expect(player.events[Operator.Income]).to.have.lengthOf(2);
      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(player.events[Operator.Income][0].rewards, [new Reward("k")])).to.be.true;
      // tslint:disable-next-line no-unused-expression
      expect(Reward.match(player.events[Operator.Income][1].rewards, [new Reward("1c")])).to.be.true;
    });

    it("should work on events that were activated", () => {
      const player = new Player();

      player.loadEvents(Event.parse(["+k", "=> 4c", "+c"], Command.ChooseIncome));
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

      player.loadEvents(Event.parse(["+t", "+k", "+c", "+o"], Command.ChooseIncome));
      const orderedEvents = Reward.toString(
        Reward.merge([].concat(...player.events[Operator.Income].map((event) => event.rewards))),
        true
      );

      expect(orderedEvents).to.be.equal("1c,1o,1k,1t");
    });
  });

  describe("canFullyChargeDuringIncomePhase", () => {
    const tests: {
      name: string;
      power: Power;
      brainstone: BrainstoneArea;
      events: Event[];
      expected: boolean;
    }[] = [
      {
        name: "no events - not fully charged",
        power: new Power(1),
        brainstone: null,
        events: [],
        expected: false,
      },
      {
        name: "no events - not fully charged (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area1,
        events: [],
        expected: false,
      },
      {
        name: "no events - fully charged",
        power: new Power(0, 0, 1),
        brainstone: null,
        events: [],
        expected: true,
      },
      {
        name: "no events - fully charged (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area3,
        events: [],
        expected: true,
      },
      {
        name: "no events - no tokens",
        power: new Power(),
        brainstone: null,
        events: [],
        expected: true,
      },
      {
        name: "events - will charge fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+3pw", "+1t"], Command.ChooseIncome),
        expected: true,
      },
      {
        name: "events - will charge fully (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area2,
        events: Event.parse(["+3pw", "+1t"], Command.ChooseIncome),
        expected: true,
      },
      {
        name: "events - will not charge fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+2pw", "+1t"], Command.ChooseIncome),
        expected: false,
      },
      {
        name: "events - will not charge fully (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area2,
        events: Event.parse(["+2pw", "+1t"], Command.ChooseIncome),
        expected: false,
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.data.power = test.power;
        player.data.brainstone = test.brainstone;
        player.loadEvents(test.events);

        expect(player.needIncomeSelection().canFullyChargeDuringIncomePhase).to.equal(test.expected);
      });
    }
  });
});
