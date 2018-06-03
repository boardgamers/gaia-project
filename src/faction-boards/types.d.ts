import Reward from "../reward";
import Event from "../events";

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
  power: {
    bowl1: number,
    bowl2: number
  };
}