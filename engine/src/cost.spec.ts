import { expect } from "chai";
import { qicForDistance, terraformingCost } from "./cost";
import { Resource } from "./enums";
import PlayerData from "./player-data";
import Reward from "./reward";

describe("cost", () => {
  describe("QIC needed", () => {
    const tests: {
      name: string;
      give: { distance: number; range: number; temporaryRange: number };
      want: { qic: number | null };
    }[] = [
      {
        name: "in distance",
        give: { distance: 1, range: 1, temporaryRange: 0 },
        want: { qic: 0 },
      },
      {
        name: "need 2 q",
        give: { distance: 5, range: 1, temporaryRange: 0 },
        want: { qic: 2 },
      },
      {
        name: "need 1 q with temp range",
        give: { distance: 6, range: 1, temporaryRange: 3 },
        want: { qic: 1 },
      },
      {
        name: "temp range partially needed",
        give: { distance: 2, range: 1, temporaryRange: 3 },
        want: { qic: 0 },
      },
      {
        name: "temp range not needed",
        give: { distance: 1, range: 1, temporaryRange: 3 },
        want: { qic: null },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const g = test.give;
        const p = { range: g.range, temporaryRange: g.temporaryRange } as PlayerData;
        const qic = qicForDistance(g.distance, p);
        expect(qic).to.equal(test.want.qic);
      });
    }
  });

  describe("terraforming cost", () => {
    const tests: {
      name: string;
      give: { steps: number; discount: number; temporaryStep: number };
      want: { cost: Reward | null };
    }[] = [
      {
        name: "no cost",
        give: { steps: 0, discount: 0, temporaryStep: 0 },
        want: { cost: new Reward(0, Resource.Ore) },
      },
      {
        name: "2 steps",
        give: { steps: 2, discount: 0, temporaryStep: 0 },
        want: { cost: new Reward(6, Resource.Ore) },
      },
      {
        name: "2 steps with discount",
        give: { steps: 2, discount: 1, temporaryStep: 0 },
        want: { cost: new Reward(4, Resource.Ore) },
      },
      {
        name: "2 steps with discount and temporary step",
        give: { steps: 2, discount: 1, temporaryStep: 1 },
        want: { cost: new Reward(2, Resource.Ore) },
      },
      {
        name: "temporary step partially wasted",
        give: { steps: 1, discount: 1, temporaryStep: 2 },
        want: { cost: new Reward(0, Resource.Ore) },
      },
      {
        name: "temporary step fully wasted",
        give: { steps: 0, discount: 1, temporaryStep: 1 },
        want: { cost: null },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const g = test.give;
        const p = { temporaryStep: g.temporaryStep, terraformCostDiscount: g.discount } as PlayerData;
        const cost = terraformingCost(p, g.steps);
        expect(cost).to.deep.equal(test.want.cost);
      });
    }
  });
});
