import { Condition, Operator, Resource } from "./enums";
import * as assert from "assert";

const TECH1 = "~ > 1:o,1:q"
const TECH2 = "pt > 1:k"
const TECH3 = "~ S 1:~"
const TECH4 = "~ > 7:vp"
const TECH5 = "~ + 1:o,1:pw"
const TECH6 = "~ + 1:k,1:c"
const TECH7 = "mg >> 3:vp"
const TECH8 = "~ + 4:c"
const TECH9 = "~ => 4:pw"
const techs = [TECH1, TECH2, TECH3, TECH4, TECH5, TECH6, TECH7, TECH8, TECH9]

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
const advancedTechs = [ATECH1, ATECH2, ATECH3, ATECH4, ATECH5, ATECH6, ATECH7, ATECH8, ATECH9, ATECH10, ATECH11, ATECH12, ATECH13, ATECH14, ATECH15]

const BOOSTER1 = ["~ + 1:k", "~ + 1:o"]
const BOOSTER2 = ["~ + 1:o", "~ + 2:t"]
const BOOSTER3 = ["~ + 1:q", "~ + 2:c"]
const BOOSTER4 = ["~ + 2:c", "~ => 1:d"]
const BOOSTER5 = ["~ + 2:pw", "~ => 3:r"]
const BOOSTER6 = ["~ + 1:o", "m | 1:vp"]
const BOOSTER7 = ["~ + 1:o", "ts | 2:vp"]
const BOOSTER8 = ["~ + 1:k", "lab | 3:vp"]
const BOOSTER9 = ["~ + 4:pw", "piac | 4:vp"]
const BOOSTER10 = ["~ + 4:c", "g | 1:vp"]
const boosters = [BOOSTER1, BOOSTER2, BOOSTER3, BOOSTER4, BOOSTER5, BOOSTER6, BOOSTER7, BOOSTER8, BOOSTER9, BOOSTER10]

// check 5, 6, 7 in box
const SCORING1 = "d >> 2:vp"
const SCORING2 = "a >> 2:vp"
const SCORING3 = "m >> 2:vp"
const SCORING4 = "fed >> 5:vp"
const SCORING5 = "ts >> 4:vp"
const SCORING6 = "d >> 3:vp"
const SCORING7 = "piac >> 5:vp"
const scorings = [SCORING1, SCORING2, SCORING3, SCORING4, SCORING5, SCORING5, SCORING6, SCORING6, SCORING7, SCORING7]

export interface Reward {
  count: number;
  type: Resource
}

export class Event {
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

type Tech = Event

export class Booster {
  first: Event;
  second: Event

  constructor([income, pass] : string[]) {
    this.first = new Event(income)
    this.second = new Event(pass)
    assert(this.first.operator === Operator.Income)
    assert(this.second.operator === Operator.Income || this.second.operator === Operator.Activate || this.second.operator === Operator.Pass)
  }
}

export class Scoring {
  trigger: Event

  constructor(trigger : string) {
    this.trigger = new Event(trigger)
    assert(this.trigger.operator === Operator.Trigger)
  }
}