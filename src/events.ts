import { Condition, Operator, Resource } from "./enums";
import * as assert from "assert";

const TECH1 = "~ > o,q"
const TECH2 = "pt > k"
const TECH3 = "~ S ~"
const TECH4 = "~ > 7vp"
const TECH5 = "~ + o,pw"
const TECH6 = "~ + k,c"
const TECH7 = "mg >> 3vp"
const TECH8 = "~ + 4c"
const TECH9 = "~ => 4pw"
const techs = [TECH1, TECH2, TECH3, TECH4, TECH5, TECH6, TECH7, TECH8, TECH9]

const ATECH1 = "fed | 3vp"
const ATECH2 = "a >> 2vp"
const ATECH3 = "~ => q,5c"
const ATECH4 = "m > 2vp"
const ATECH5 = "lab | 3vp"
const ATECH6 = "s > o"
const ATECH7 = "pt | vp"
const ATECH8 = "g > 2vp"
const ATECH9 = "ts > 4vp"
const ATECH10 = "s > 2vp"
const ATECH11 = "~ => 3o"
const ATECH12 = "fed > 5vp"
const ATECH13 = "~ => 3k"
const ATECH14 = "m >> 3vp"
const ATECH15 = "ts >> 3vp"
const advancedTechs = [ATECH1, ATECH2, ATECH3, ATECH4, ATECH5, ATECH6, ATECH7, ATECH8, ATECH9, ATECH10, ATECH11, ATECH12, ATECH13, ATECH14, ATECH15]

const BOOSTER1 = ["~ + k", "~ + o"]
const BOOSTER2 = ["~ + o", "~ + 2t"]
const BOOSTER3 = ["~ + q", "~ + 2c"]
const BOOSTER4 = ["~ + 2c", "~ => d"]
const BOOSTER5 = ["~ + 2pw", "~ => 3r"]
const BOOSTER6 = ["~ + o", "m | vp"]
const BOOSTER7 = ["~ + o", "ts | 2vp"]
const BOOSTER8 = ["~ + k", "lab | 3vp"]
const BOOSTER9 = ["~ + 4pw", "piac | 4vp"]
const BOOSTER10 = ["~ + 4c", "g | vp"]
const boosters = [BOOSTER1, BOOSTER2, BOOSTER3, BOOSTER4, BOOSTER5, BOOSTER6, BOOSTER7, BOOSTER8, BOOSTER9, BOOSTER10]

// check 5, 6, 7 in box
const SCORING1 = "d >> 2vp"
const SCORING2 = "a >> 2vp"
const SCORING3 = "m >> 2vp"
const SCORING4 = "fed >> 5vp"
const SCORING5 = "ts >> 4vp"
const SCORING6 = "d >> 3vp"
const SCORING7 = "piac >> 5vp"
const scorings = [SCORING1, SCORING2, SCORING3, SCORING4, SCORING5, SCORING5, SCORING6, SCORING6, SCORING7, SCORING7]

export class Reward {
  count: number;
  type: Resource;

  constructor(reward: string) {
    const regex = /^([1-9][0-9]*)?(~|o|c|k|q|pw|t|vp|d|r)$/

    assert(regex.test(reward), "Cannot construct reward from " + reward);

    const [_, count, type] = regex.exec(reward);
    this.count = +count || 1;
    this.type = type as Resource;
  }

  toString() {
    return `${this.count || 1}${this.type}`;
  }
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
    this.rewards = preReward.split(",").map(reward => new Reward(reward));
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