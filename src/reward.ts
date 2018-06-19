import { Resource } from "./enums";
import * as assert from "assert";
import * as _ from "lodash";

export default class Reward {
  count: number;
  type: Resource;

  constructor(reward: string = "~") {
    const regex = /^(-?[0-9]*)?(.*)$/

    const [_, count, type] = regex.exec(reward);

    if (type === Resource.None || !Object.values(Resource).includes(type)) {
      this.count = 0;
      this.type = Resource.None
    } else {
      this.count = (count !== undefined && count.length > 0) ? +count : 1;
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

    const ret: Reward[] = [];

    for (const key of Object.keys(grouped)) {
      const reward = new Reward();

      reward.type = key as Resource;
      reward.count = grouped[key].reduce((val, rew) => val+rew.count, 0);

      ret.push(reward);
    }

    return ret;
  }
}