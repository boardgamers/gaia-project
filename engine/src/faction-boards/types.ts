import { get, set } from "lodash";
import { FactionVariant } from "../engine";
import { Building, Command, Expansion, Faction, Operator, Phase, PowerArea } from "../enums";
import Event from "../events";
import Player from "../player";
import Reward from "../reward";
import { merge } from "../utils";

export const GAIA_FORMER_COST = 6;

export interface FactionBoardRaw {
  income?: string[];
  buildings?: {
    [building in Building]?: {
      cost?: string;
      isolatedCost?: string;
      income?: string[][];
    };
  };
  power?: {
    area1?: number;
    area2?: number;
  };
  brainstone?: PowerArea;
  handlers?: { [event: string]: (player: Player, ...args: any[]) => any };
}

export type FactionBoardVariant = { board: FactionBoardRaw; version?: number };
export type FactionBoardVariants = {
  faction: Faction;
  standard: FactionBoardRaw;
  variants?: (FactionBoardVariant & { type: FactionVariant; players?: number; version: number })[];
};

const defaultBoard: FactionBoardRaw = {
  buildings: {
    [Building.Mine]: {
      cost: "2c,o",
      income: [["+o"], ["+o"], [], ["+o"], ["+o"], ["+o"], ["+o"], ["+o"]],
    },
    [Building.TradingStation]: {
      cost: "3c,2o",
      isolatedCost: "6c,2o",
      income: [["+3c"], ["+4c"], ["+4c"], ["+5c"]],
    },
    [Building.ResearchLab]: {
      cost: "5c,3o",
      income: [
        ["+k", "tech"],
        ["+k", "tech"],
        ["+k", "tech"],
      ],
    },
    [Building.Academy1]: {
      cost: "6c,6o",
      income: [["+2k", "tech"]],
    },
    [Building.Academy2]: {
      cost: "6c,6o",
      income: [["=>q", "tech"]],
    },
    [Building.PlanetaryInstitute]: {
      cost: "6c,4o",
      income: [["+4pw", "+t"]],
    },

    [Building.GaiaFormer]: {
      cost: `${GAIA_FORMER_COST}t->tg`,
      income: [[], [], []],
    },
    [Building.SpaceStation]: {
      cost: "~",
      income: [[], [], [], [], [], []],
    },

    //frontiers
    [Building.Colony]: {
      cost: "~",
      income: [
        ["+3c", "+3pw", "+3vp", "2vp"],
        ["+3c", "+3pw", "+4vp", "2vp"],
        ["+3c", "+3pw", "+5vp", "2vp"],
      ],
    },
    [Building.CustomsPost]: {
      cost: "2c",
      income: [["+2c"], ["+2c"], ["+2c"], ["+2c"], ["+2c"]],
    },

    [Building.ColonyShip]: {
      cost: "4c,3o",
      income: [[], [], []],
    },
    [Building.ConstructionShip]: {
      cost: "3c,2o",
      income: [[], [], []],
    },
    [Building.ResearchShip]: {
      cost: "3c,2o",
      income: [[], [], []],
    },
    [Building.TradeShip]: {
      cost: "5c,1o",
      income: [[], [], []],
    },

    [Building.Scout]: {
      cost: "1c,1o",
      income: [[], [], []],
    },
    [Building.Frigate]: {
      cost: "3c,2o",
      income: [[], [], []],
    },
    [Building.BattleShip]: {
      cost: "5c,5o",
      income: [[], [], []],
    },
  },
  income: ["3k,4o,15c,q", "+o,k"],
  power: {
    area1: 2,
    area2: 4,
  },
  brainstone: null,
  handlers: {},
};

export class FactionBoard {
  buildings: {
    [building in Building]: {
      cost: Reward[];
      isolatedCost?: Reward[];
      income: Event[][];
    };
  };
  income: Event[];
  power: {
    area1: number;
    area2: number;
  };
  brainstone: PowerArea;
  handlers?: { [event: string]: (player: Player, ...args: any[]) => any };

  constructor(input: FactionBoardVariants, variant?: FactionBoardRaw) {
    Object.assign(this, merge({}, defaultBoard, input.standard, variant ?? {}));

    const buildings = Building.values(Expansion.All);
    const toRewards = [`${Building.TradingStation}.isolatedCost`].concat(buildings.map((bld) => `${bld}.cost`));
    const toIncome = buildings.map((bld) => `${bld}.income`);

    for (const toRew of toRewards) {
      set(this.buildings, toRew, Reward.parse(get(this.buildings, toRew)));
    }
    this.income = Event.parse(this.income as any, null);
    for (const event of this.income) {
      event.source = event.operator === Operator.Once ? Phase.BeginGame : Command.ChooseIncome;
    }
    for (const toInc of toIncome) {
      set(
        this.buildings,
        toInc,
        get(this.buildings, toInc).map((events) => Event.parse(events, Command.ChooseIncome))
      );
    }
  }

  cost(building: Building, isolated: boolean): Reward[] {
    if (building === Building.TradingStation && isolated) {
      return this.buildings[building].isolatedCost;
    }

    return this.buildings[building].cost;
  }
}
