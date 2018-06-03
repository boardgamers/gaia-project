import { Resource } from "./enums";
import * as assert from "assert";

export default class Reward {
  count: number;
  type: Resource;

  constructor(reward: string) {
    const regex = /^([0-9]*)?(.*)$/

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
    return source.split(",").map(rew => new Reward(rew));
  }
}