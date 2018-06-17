import Reward from "../reward";
import * as _ from "lodash";
import Event from "../events";

export interface FactionBoardRaw {
  mines?: {
    cost?: string,
    income?: string[]
  };
  tradingStations?: {
    cost?: string,
    isolatedCost?: string,
    income?: string[]
  };
  researchLabs?: {
    cost?: string,
    income?: string[]
  };
  academy1?: {
    cost?: string,
    income?: string
  };
  academy2?: {
    cost?: string,
    income?: string
  };
  planetaryInstitute?: {
    cost?: string,
    income?: string
  };
  income?: string[];
  power?: {
    bowl1?: number,
    bowl2?: number
  };
}

const defaultBoard: FactionBoardRaw = {
  mines: {
    cost: "2c,o",
    income: ["+o","+o","~","+o","+o","+o","+o","+o"]
  },
  tradingStations: {
    cost: "3c,2o",
    isolatedCost: "6c,2o",
    income: ["+3c","+4c","+4c","+5c"],
  },
  researchLabs: {
    cost: "5c,3o",
    income: ["+k","+k","+k"]
  },
  academy1: {
    cost: "6c,6o",
    income: "+2k"
  },
  academy2: {
    cost: "6c,6o",
    income: "=>q"
  },
  planetaryInstitute: {
    cost: "6c,4o",
    income: "+4pw,t"
  },
  income: ["3k,4o,15c,q", "+o,k"],
  power: {
    bowl1: 4,
    bowl2: 4
  }
};

export class FactionBoard {
  mines: {
    cost: Reward[],
    income: Event[]
  };
  tradingStations: {
    cost: Reward[],
    isolatedCost: Reward[],
    income: Event[]
  };
  researchLabs: {
    cost: Reward[],
    income: Event[]
  };
  academy1: {
    cost: Reward[],
    income: Event
  };
  academy2: {
    cost: Reward[],
    income: Event
  };
  planetaryInstitute: {
    cost: Reward[];
    income: Event;
  };
  income: Event[];
  power: {
    bowl1: number,
    bowl2: number
  };

  constructor(input: FactionBoardRaw) {
    Object.assign(this, _.merge({}, defaultBoard, input));

    const buildings = ["mines", "tradingStations", "researchLabs", "academy1", "academy2", "planetaryInstitute"];
    const toRewards = ["tradingStations.isolatedCost"].concat(buildings.map(bld => `${bld}.cost`));
    const toIncome = ["income"].concat(buildings.map(bld => `${bld}.income`));

    for (const toRew of toRewards) {
      _.set(this, toRew, Reward.parse(_.get(this, toRew)));
    }
    for (const toInc of toIncome) {
      _.set(this, toInc, Event.parse(_.get(this, toInc)));
    }
  }
}