import { expect } from "chai";
import { Faction, PowerArea } from "./enums";
import Event from "./events";
import Player from "./player";
import { Power } from "./player-data";

describe("IncomeSelection", () => {
  describe("automatic income without trade-offs", () => {
    for (const charge of [3, 4]) {
      it(`takes the token first with ${charge} charges, even without auto-income enabled`, () => {
        const player = new Player();
        player.data.power = new Power(0, 1, 0, 6);
        player.loadEvents(Event.parse([`+${charge}pw`, "+1t"], null));

        const selection = player.incomeSelection();
        expect(player.settings.autoIncome).to.equal(false);
        expect(selection.canAutoplay).to.equal(true);
        player.receiveIncome(selection.autoplayEvents());
        expect(player.data.power).to.deep.equal(new Power(0, 0, 2, 6));
      });
    }

    it("charges first when that preserves every charge and gives more immediately spendable power", () => {
      const player = new Player();
      player.data.power = new Power(1);
      player.loadEvents(Event.parse(["+1t", "+2pw"], null));
      const selection = player.incomeSelection();
      expect(selection.canAutoplay).to.equal(true);
      player.receiveIncome(selection.autoplayEvents());
      expect(player.data.power).to.deep.equal(new Power(1, 0, 1));
    });

    it("keeps the choice between extra spendable power and avoiding wasted charge", () => {
      const player = new Player();
      player.loadEvents(Event.parse(["+2t", "+2t", "+2pw", "+3pw"], null));
      // 0/3/1 uses all five charges; 2/0/2 wastes one but gives two spendable power.
      expect(player.incomeSelection().canAutoplay).to.equal(false);
    });

    it("resolves identical outcomes even with mixed resource income and partially charged bowls", () => {
      const player = new Player();
      player.faction = Faction.Itars;
      player.data.power = new Power(2);
      player.loadEvents(Event.parse(["+o,k,t", "+1pw"], null));
      const selection = player.incomeSelection();
      expect(selection.canAutoplay).to.equal(true);
      player.receiveIncome(selection.autoplayEvents());
      expect(player.data.power).to.deep.equal(new Power(2, 1));
      expect(player.data.ores).to.equal(1);
      expect(player.data.knowledge).to.equal(1);
    });

    it("preserves Itars' choice to keep tokens in bowl II for burning", () => {
      const player = new Player();
      player.faction = Faction.Itars;
      player.data.power = new Power(0, 2);
      player.loadEvents(Event.parse(["+t", "+1pw"], null));
      expect(player.incomeSelection().canAutoplay).to.equal(false);

      player.faction = Faction.Tinkeroids;
      const selection = player.incomeSelection();
      expect(selection.canAutoplay).to.equal(true);
      player.receiveIncome(selection.autoplayEvents());
      expect(player.data.power).to.deep.equal(new Power(1, 1, 1));
    });

    it("considers interleaving income sources for Itars even when fully charging is possible", () => {
      const player = new Player();
      player.faction = Faction.Itars;
      player.loadEvents(Event.parse(["+t", "+t", "+1pw", "+3pw"], null));
      // t, 3pw, t, 1pw leaves 0/1/1 instead of 0/0/2.
      expect(player.incomeSelection().canAutoplay).to.equal(false);

      player.settings.autoIncome = true;
      expect(player.incomeSelection().canAutoplay).to.equal(true);
    });

    it("preserves manual Brainstone choices", () => {
      const player = new Player();
      player.data.brainstone = PowerArea.Area1;
      player.loadEvents(Event.parse(["+1t", "+4pw"], null));
      expect(player.incomeSelection().canAutoplay).to.equal(false);
    });
  });

  describe("remainingChargesAfterIncome", () => {
    const tests: {
      name: string;
      power: Power;
      brainstone: PowerArea;
      events: Event[];
      expected: number;
    }[] = [
      {
        name: "no events - not fully charged",
        power: new Power(1),
        brainstone: null,
        events: [],
        expected: 2,
      },
      {
        name: "no events - not fully charged (brainstone)",
        power: new Power(),
        brainstone: PowerArea.Area1,
        events: [],
        expected: 2,
      },
      {
        name: "no events - fully charged",
        power: new Power(0, 0, 1),
        brainstone: null,
        events: [],
        expected: 0,
      },
      {
        name: "no events - fully charged (brainstone)",
        power: new Power(),
        brainstone: PowerArea.Area3,
        events: [],
        expected: 0,
      },
      {
        name: "no events - no tokens",
        power: new Power(),
        brainstone: null,
        events: [],
        expected: 0,
      },
      {
        name: "events - will charge fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+3pw", "+1t"], null),
        expected: 0,
      },
      {
        name: "events - will charge more than fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+4pw", "+1t"], null),
        expected: -1,
      },
      {
        name: "events - will charge fully (brainstone)",
        power: new Power(),
        brainstone: PowerArea.Area2,
        events: Event.parse(["+3pw", "+1t"], null),
        expected: 0,
      },
      {
        name: "events - will not charge fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+2pw", "+1t"], null),
        expected: 1,
      },
      {
        name: "only consider pw rewards",
        power: new Power(2, 4, 0),
        brainstone: null,
        events: Event.parse(["+3c,1o,3pw", "4pw"], null),
        expected: 1,
      },
      {
        name: "events - will not charge fully (brainstone)",
        power: new Power(),
        brainstone: PowerArea.Area2,
        events: Event.parse(["+2pw", "+1t"], null),
        expected: 1,
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.data.power = test.power;
        player.data.brainstone = test.brainstone;
        player.loadEvents(test.events);

        expect(player.incomeSelection().remainingChargesAfterIncome).to.equal(test.expected);
      });
    }
  });

  describe("autoplayEvents", () => {
    const tests: {
      name: string;
      give: { power: Power; events: Event[] };
      want: { events: Event[] };
    }[] = [
      {
        name: "charge first",
        give: { power: new Power(1), events: Event.parse(["+1t", "+2pw"], null) },
        want: { events: Event.parse(["+2pw", "+1t"], null) },
      },
      {
        name: "income first",
        give: { power: new Power(), events: Event.parse(["+1t", "+2pw"], null) },
        want: { events: Event.parse(["+1t", "+2pw"], null) },
      },
      {
        name: "income first - but still waste",
        give: { power: new Power(), events: Event.parse(["+1t", "+3pw"], null) },
        want: { events: Event.parse(["+1t", "+3pw"], null) },
      },
      {
        name: "income, charge, income",
        give: { power: new Power(), events: Event.parse(["+1t", "+2t", "+2pw"], null) },
        want: { events: Event.parse(["+1t", "+2pw", "+2t"], null) },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.settings.autoIncome = true;
        player.data.power = test.give.power;
        player.loadEvents(test.give.events);

        expect(player.incomeSelection().autoplayEvents()).to.deep.equal(test.want.events);
      });
    }
  });
});
