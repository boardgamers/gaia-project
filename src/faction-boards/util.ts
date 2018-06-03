import { FactionBoard } from "./types";
import Reward, {parseRewards} from "../reward";
import * as _ from "lodash";
import Event from "../events";

interface Input {
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
  academies?: {
    cost?: string,
    income?: string[]
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

const defaultBoard: Input = {
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
  academies: {
    cost: "6c,6o",
    income: ["+2k","=>q"]
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

export function boardify(input: Input): FactionBoard {
  const {
    mines, tradingStations, researchLabs, academies, planetaryInstitute, income, power
  } = _.merge({}, defaultBoard, input);

  return {
    mines: {
      cost: parseRewards(mines.cost),
      income: mines.income.map(ev => new Event(ev))
    },
    tradingStations: {
      cost: parseRewards(tradingStations.cost),
      isolatedCost: parseRewards(tradingStations.cost),
      income: tradingStations.income.map(ev => new Event(ev))
    },
    researchLabs: {
      cost: parseRewards(mines.cost),
      income: researchLabs.income.map(ev => new Event(ev))
    },
    academies: {
      cost: parseRewards(mines.cost),
      income: academies.income.map(ev => new Event(ev))
    },
    planetaryInstitute: {
      cost: parseRewards(planetaryInstitute.cost),
      income: new Event(input.planetaryInstitute.income)
    },
    income: income.map(ev => new Event(ev)),
    power: {
      bowl1: power.bowl1,
      bowl2: power.bowl2
    }
  };
}

export function getEvents(board: FactionBoard) : Event[] {
  return board.income.concat(board.mines.income, board.tradingStations.income, board.planetaryInstitute.income, board.researchLabs.income, board.academies.income);
}