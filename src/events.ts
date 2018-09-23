import { Condition, Operator, Booster, TechTilePos, AdvTechTilePos, Command, ResearchField, BoardAction, Faction} from "./enums";
import Reward from "./reward";

function findCondition(spec: string): [Condition, string] {
  let conditionMatch = /^(.+?)(\b| )/.exec(spec);

  if (!conditionMatch) {
    conditionMatch = /^([^ ]*)$/.exec(spec);
  }

  const conditionString = conditionMatch[1];

  for (const cond of Object.values(Condition) as Condition[]) {
    if (conditionString === cond) {
      const remaining = spec.substr(conditionString.length).trimLeft();
      return [cond, remaining];
    }
  }

  return [Condition.None, spec];
}

function findOperator(spec: string): [Operator, string] {
  let operatorMatch = /^(.+?)(\b| )/.exec(spec);

  if (!operatorMatch) {
    operatorMatch = /^([^ ]*)$/.exec(spec);
  }

  const operatorString = operatorMatch[1];

  for (const op of Object.values(Operator) as Operator[]) {
    if (operatorString === op) {
      const remaining = spec.substr(operatorString.length).trimLeft();
      return [op, remaining];
    }
  }

  return [Operator.Once, spec];
}

export type RoundScoring = 'round1' | 'round2' | 'round3' | 'round4' | 'round5' | 'round6';
export type EventSource = Booster | TechTilePos | AdvTechTilePos | Command.ChargePower | Command.Spend | 'final1' | 'final2' | RoundScoring | ResearchField | BoardAction | Command.ChooseIncome | Command.Build | Command.ChooseFederationTile | Command.FormFederation | Command.UpgradeResearch | Faction;

export default class Event {
  spec: string;
  condition: Condition;
  operator: Operator;
  source: EventSource;
  rewards: Reward[];
  activated: boolean = false;

  constructor(spec: string | {spec: string, source: EventSource}, source?: EventSource) {
    if (typeof spec === "object") {
      this.spec = spec.spec;
      this.source = spec.source;
    } else {
      this.spec = spec;
      this.source = source;
    }

    if (this.spec.endsWith("!")) {
      this.spec = this.spec.slice(0, this.spec.length - 1);
      this.activated = true;
    }
    let remaining: string;

    if (this.spec.toLowerCase().trim() === Operator.Special.toLowerCase()) {
      this.condition = Condition.None;
      this.rewards = [];
      this.operator = Operator.Special;
    } else {
      [this.condition, remaining] = findCondition(this.spec);
      [this.operator, remaining] = findOperator(remaining);
      this.rewards = Reward.parse(remaining);
    }
  }

  toString() {
    return this.spec + (this.activated ? "!" : "");
  }

  toJSON() {
    return {spec: this.toString(), source: this.source};
  }

  clone() {
    return new Event(this.spec, this.source);
  }

  static parse(events: string[], source: EventSource): Event[] {
    return events.map(ev => new Event(ev, source));
  }
}
