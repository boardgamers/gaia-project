import Reward from "../reward";

export interface FactionBoard {
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
  academies: {
    cost: Reward[],
    income: Event[]
  };
  planetaryInstitute: {
    cost: Reward[];
    income: Event;
  };
  income: Event[];
}