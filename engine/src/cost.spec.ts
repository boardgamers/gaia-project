import { expect } from "chai";
import { BuildWarning, PlayerEnum } from "../index";
import { qicForDistance, QicNeeded, terraformingCost } from "./cost";
import { Building, Resource } from "./enums";
import SpaceMap from "./map";
import Player from "./player";
import PlayerData from "./player-data";
import Reward from "./reward";

describe("cost", () => {
  describe("QIC needed", () => {
    const tests: {
      name: string;
      give: { location: string; range: number; temporaryRange: number };
      want: QicNeeded;
    }[] = [
      {
        name: "in distance",
        give: { location: "6A1", range: 1, temporaryRange: 0 },
        want: { distance: 1, amount: 0, warning: null },
      },
      {
        name: "need 2 q, gaia former would save 1",
        give: { location: "5A2", range: 1, temporaryRange: 0 },
        want: { distance: 5, amount: 2, warning: BuildWarning.gaiaFormerWouldExtendRange },
      },
      {
        name: "need 1 q with temp range",
        give: { location: "7B5", range: 1, temporaryRange: 3 },
        want: { distance: 6, amount: 1, warning: null },
      },
      {
        name: "temp range partially needed",
        give: { location: "6B3", range: 1, temporaryRange: 3 },
        want: { distance: 2, amount: 0, warning: null },
      },
      {
        name: "temp range not needed",
        give: { location: "6A1", range: 1, temporaryRange: 3 },
        want: null,
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const m = new SpaceMap();

        m.load(
          JSON.parse(`
            {
      "sectors": [
        {
          "sector": "6B",
          "rotation": 0,
          "center": {
            "q": 0,
            "r": 0,
            "s": 0
          }
        },
        {
          "sector": "3",
          "rotation": 0,
          "center": {
            "q": 5,
            "r": -2,
            "s": -3
          }
        },
        {
          "sector": "1",
          "rotation": 0,
          "center": {
            "q": 2,
            "r": 3,
            "s": -5
          }
        },
        {
          "sector": "4",
          "rotation": 0,
          "center": {
            "q": -3,
            "r": 5,
            "s": -2
          }
        },
        {
          "sector": "5B",
          "rotation": 1,
          "center": {
            "q": -5,
            "r": 2,
            "s": 3
          }
        },
        {
          "sector": "7B",
          "rotation": 3,
          "center": {
            "q": -2,
            "r": -3,
            "s": 5
          }
        },
        {
          "sector": "2",
          "rotation": 4,
          "center": {
            "q": 3,
            "r": -5,
            "s": 2
          }
        }
      ],
      "mirror": false
    }
        `)
        );

        const home = m.getS("6B1");
        home.data.player = PlayerEnum.Player1;
        home.data.building = Building.Mine;
        const gf = m.getS("6A5");
        gf.data.player = PlayerEnum.Player1;
        gf.data.building = Building.GaiaFormer;

        const g = test.give;
        const p = {
          data: { range: g.range, temporaryRange: g.temporaryRange, occupied: [home, gf] },
          player: PlayerEnum.Player1,
        } as Player;

        const qic = qicForDistance(m, m.getS(g.location), p, false);
        expect(qic).to.deep.equal(test.want);
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
        const cost = terraformingCost(p, g.steps, false);
        expect(cost).to.deep.equal(test.want.cost);
      });
    }
  });
});
