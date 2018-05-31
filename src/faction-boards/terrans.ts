import Reward from "../reward";
import {FactionBoard} from "./types";
import { boardify } from "./util";

export default boardify({
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
    income: "+4pw,1t"
  },
  income: ["3k,4o,15c,q,up-gaia", "+o,k"]
});