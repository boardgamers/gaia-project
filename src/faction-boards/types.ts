import Reward from "../reward";
import * as _ from "lodash";
import Event from "../events";
import { Building, Planet } from "../enums";

export interface FactionBoardRaw {
  [Building.Mine]?: {
    cost?: string,
    costGaia?: string;
    income?: string[]
  };
  [Building.TradingStation]?: {
    cost?: string,
    isolatedCost?: string,
    income?: string[]
  };
  [Building.ResearchLab]?: {
    cost?: string,
    income?: string[]
  };
  [Building.Academy1]?: {
    cost?: string,
    income?: string[]
  };
  [Building.Academy2]?: {
    cost?: string,
    income?: string[]
  };
  [Building.PlanetaryInstitute]?: {
    cost?: string,
    income?: string[]
  };
  [Building.GaiaFormer]?: {
    cost?: string,
    income?: string[]
  };
  income?: string[];
  power?: {
    bowl1?: number,
    bowl2?: number
  };

}

const defaultBoard: FactionBoardRaw = {
  [Building.Mine]: {
    cost: "2c,o",
    costGaia: "2c,o,q",
    income: ["+o","+o","~","+o","+o","+o","+o","+o"]
  },
  [Building.TradingStation]: {
    cost: "3c,2o",
    isolatedCost: "6c,2o",
    income: ["+3c","+4c","+4c","+5c"],
  },
  [Building.ResearchLab]: {
    cost: "5c,3o",
    income: ["+k","+k","+k"]
  },
  [Building.Academy1]: {
    cost: "6c,6o",
    income: ["+2k"]
  },
  [Building.Academy2]: {
    cost: "6c,6o",
    income: ["=>q"]
  },
  [Building.PlanetaryInstitute]: {
    cost: "6c,4o",
    income: ["+4pw,t"]
  },
  [Building.GaiaFormer]: {
    cost: "6spw",
    income: ["~","~","~"]
  },
  income: ["3k,4o,15c,q", "+o,k"],
  power: {
    bowl1: 4,
    bowl2: 4
  }
};

export class FactionBoard {
  [Building.Mine]: {
    cost: Reward[],
    costGaia: Reward[],
    income: Event[]
  };
  [Building.TradingStation]: {
    cost: Reward[],
    isolatedCost: Reward[],
    income: Event[]
  };
  [Building.ResearchLab]: {
    cost: Reward[],
    income: Event[]
  };
  [Building.Academy1]: {
    cost: Reward[],
    income: Event[]
  };
  [Building.Academy2]: {
    cost: Reward[],
    income: Event[]
  };
  [Building.PlanetaryInstitute]: {
    cost: Reward[];
    income: Event[];
  };
  [Building.GaiaFormer]: {
    cost: Reward[];
    income: Event[];
  };
  income: Event[];
  power: {
    bowl1: number,
    bowl2: number
  };

  constructor(input: FactionBoardRaw) {
    Object.assign(this, _.merge({}, defaultBoard, input));

    const buildings = Object.values(Building);
    const toRewards = [`${Building.TradingStation}.isolatedCost`].concat(buildings.map(bld => `${bld}.cost`));
    const toIncome = ["income"].concat(buildings.map(bld => `${bld}.income`));

    for (const toRew of toRewards) {
      _.set(this, toRew, Reward.parse(_.get(this, toRew)));
    }
    for (const toInc of toIncome) {
      _.set(this, toInc, Event.parse(_.get(this, toInc)));
    }
  }

  maxBuildings(building: Building): number {
    //TODO limit gaiaformers by tech level
    return building === Building.GaiaFormer ? 3 : this[building].income.length;
  }

  cost( targetPlanet: Planet, building: Building, isolated = true): Reward[] {
    if (building === Building.Mine && targetPlanet === Planet.Gaia) {
      return this[building].costGaia;
    }
    if (building === Building.TradingStation && isolated) {
      return this[building].isolatedCost;
    }
    //TODO add terraforming costs
    return this[building].cost;
  }
}