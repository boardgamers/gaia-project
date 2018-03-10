import { Condition, Operator, Resource } from "./enums";

const TECH1 = "~ > 1:o,1:q"
const TECH2 = "pt > 1:k"
const TECH3 = "~ S 1:~"
const TECH4 = "~ > 7:vp"
const TECH5 = "~ + 1:o,1:pw"
const TECH6 = "~ + 1:k,1:c"
const TECH7 = "mg >> 3:vp"
const TECH8 = "~ + 4:c"
const TECH9 = "~ => 4:pw"

const ATECH1 = "fed | 3:vp"
const ATECH2 = "a >> 2:vp"
const ATECH3 = "~ => 1:q,5:c"
const ATECH4 = "m > 2:vp"
const ATECH5 = "lab | 3:vp"
const ATECH6 = "s > 1:o"
const ATECH7 = "pt | 1:vp"
const ATECH8 = "g > 2:vp"
const ATECH9 = "ts > 4:vp"
const ATECH10 = "s > 2:vp"
const ATECH11 = "~ => 3:o"
const ATECH12 = "fed > 5:vp"
const ATECH13 = "~ => 3:k"
const ATECH14 = "m >> 3:vp"
const ATECH15 = "ts >> 3:vp"

interface Reward {
  count: number;
  type: Resource
}
//definition = definition.split(",").map(str => str.split("") as Planet[]);
export class Tech {
  //advance: boolean
  spec: string
  condition : Condition
  operator : Operator
  rewards: Reward[]

  constructor(spec : string) {
    this.spec = spec;
    const [cond, op, preReward] = spec.split(" ");
    this.condition = cond as Condition;
    this.operator = op as Operator;
    this.rewards = preReward.split(",").map(str => str.split(":")).map(([count, type]) => ({count: +count,type: type as Resource}));
  }
}



