import { expect } from "chai";
import { PowerArea } from "./enums";
import Event from "./events";
import Player from "./player";
import { Power } from "./player-data";

describe("IncomeSelection", () => {
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
