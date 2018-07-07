import { Resource } from "./enums";
import * as assert from "assert";
import * as _ from "lodash";

export default class Reward {
  count: number;
  type: Resource;

  constructor(countOrRewardString: number | string, type?: Resource) {
    let count = countOrRewardString;
    if (arguments.length === 1) {
      const regex = /^(-?[0-9]*)?(.*)$/

      let _;
      [_, count, type] = regex.exec(count as string) as any;
    }
    
    if (type === Resource.None || !Object.values(Resource).includes(type)) {
      this.count = 0;
      this.type = Resource.None
    } else {
      this.count = typeof count === "number" ? count : ((count !== undefined && count.length > 0) ? +count : 1); 
      this.type = type as Resource;
    }
  }

  toString() {
    if (this.isEmpty()) {
      return '~';
    }
    return `${this.count}${this.type}`;
  }

  toJSON() {
    return this.toString();
  }

  isEmpty() {
    return this.count === 0 || this.type === Resource.None;
  }

  static parse(source: string): Reward[] {
    assert (typeof source === "string", `Reward.parse: ${source} is not a string`);
    
    return source.split(",").map(rew => new Reward(rew));
  }

  /**
   * Given an array of rewards, merge rewards that give the same 
   * kind of resource, and return a new array of rewards
   * 
   * @param rewards 
   */
  static merge(rewards: Reward[]): Reward[] {
    const grouped = _.groupBy(rewards, "type");

    return Object.keys(grouped).map(key => new Reward(grouped[key].reduce((val, rew) => val+rew.count, 0), key as Resource)).filter(rew => !rew.isEmpty());
  }

  static toString(rewards: Reward[], sorted = true) {
    if(sorted) {
      rewards.sort((rew1, rew2) => rew1.type < rew2.type ? -1: 1);
    }
    if (rewards.length === 0) {
      return "~";
    }

    return rewards.map(rew => rew.toString()).join(",");
  }

  static match(rewards1: Reward[], rewards2: Reward[]): boolean {
    return Reward.toString(rewards1, true) === Reward.toString(rewards2, true);
  }
}