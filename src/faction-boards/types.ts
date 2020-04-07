import Reward from "../reward";
import { get, set } from "lodash";
import Event from "../events";
import { Building, Planet, BrainstoneArea, Faction, Command } from "../enums";
import Player from "../player";
import { merge } from "../utils";

export interface FactionBoardRaw {
  faction?: Faction;
  income?: string[];
  buildings?: {
    [building in Building]?: {
      cost?: string,
      isolatedCost?: string,
      income?: string[][]
    }
  };
  power?: {
    area1?: number,
    area2?: number
  };
  brainstone?: BrainstoneArea;
  handlers?: {[event: string]: (player: Player, ...args: any[]) => any};
}

const defaultBoard: FactionBoardRaw = {
  buildings: {
    [Building.Mine]: {
      cost: "2c,o",
      income: [["+o"], ["+o"], [], ["+o"], ["+o"], ["+o"], ["+o"], ["+o"]]
    },
    [Building.TradingStation]: {
      cost: "3c,2o",
      isolatedCost: "6c,2o",
      income: [["+3c"], ["+4c"], ["+4c"], ["+5c"]]
    },
    [Building.ResearchLab]: {
      cost: "5c,3o",
      income: [["+k", "tech"], ["+k", "tech"], ["+k", "tech"]]
    },
    [Building.Academy1]: {
      cost: "6c,6o",
      income: [["+2k", "tech"]]
    },
    [Building.Academy2]: {
      cost: "6c,6o",
      income: [["=>q", "tech"]]
    },
    [Building.PlanetaryInstitute]: {
      cost: "6c,4o",
      income: [["+4pw", "+t"]]
    },
    [Building.GaiaFormer]: {
      cost: "6t->tg",
      income: [[], [], []]
    },
    [Building.SpaceStation]: {
      cost: "~",
      income: [[], [], [], [], [], []]
    }
  },
  income: ["3k,4o,15c,q", "+o,k"],
  power: {
    area1: 2,
    area2: 4
  },
  brainstone: null,
  handlers: {}
};

export class FactionBoard {
  buildings: {
    [building in Building]: {
      cost: Reward[],
      isolatedCost?: Reward[],
      income: Event[][],
    }
  };
  income: Event[];
  power: {
    area1: number,
    area2: number
  };
  brainstone: BrainstoneArea;
  handlers?: {[event: string]: (player: Player, ...args: any[]) => any};

  constructor(input: FactionBoardRaw) {
    Object.assign(this, merge({}, defaultBoard, input));

    const buildings = Object.values(Building);
    const toRewards = [`${Building.TradingStation}.isolatedCost`].concat(buildings.map(bld => `${bld}.cost`));
    const toIncome = buildings.map(bld => `${bld}.income`);

    for (const toRew of toRewards) {
      set(this.buildings, toRew, Reward.parse(get(this.buildings, toRew)));
    }
    this.income = Event.parse(this.income as any, Command.ChooseIncome);
    for (const toInc of toIncome) {
      set(this.buildings, toInc, get(this.buildings, toInc).map(events => Event.parse(events, Command.ChooseIncome)));
    }
  }

  cost(targetPlanet: Planet, building: Building, isolated = true): Reward[] {

    if (building === Building.TradingStation && isolated) {
      return this.buildings[building].isolatedCost;
    }

    return this.buildings[building].cost;
  }
}
