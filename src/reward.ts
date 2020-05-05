import { Resource } from "./enums";
import assert from "assert";
import { groupBy } from "lodash";

const resources = new Set(Object.values(Resource));

export default class Reward {
  count: number;
  type: Resource;

  constructor(countOrRewardString: number | string, type?: Resource) {
    let count = countOrRewardString;
    if (arguments.length === 1) {
      const str = count as string;

      if (str.indexOf("+") > 0) {
        const regex =  /^(.*)\+([0-9]*)$/;

        let _unused;
        [_unused, type, count] = regex.exec(str) as any;
      } else {
        const regex =  /^(-?[0-9]*)?(.*)$/;
        let _unused;
        [_unused, count, type] = regex.exec(str) as any;
      }
    }

    if (type === Resource.None || !resources.has(type)) {
      this.count = 0;
      this.type = Resource.None;
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
    assert (typeof source === "string", `Reward.parse: ${source}'s type is not string, but ${typeof source}`);

    return source.split(",").map(rew => new Reward(rew));
  }

  /**
   * Given an array of rewards, merge rewards that give the same
   * kind of resource, and return a new array of rewards
   *
   * @param rewards
   */
  static merge(...rewards: Reward[][]): Reward[] {
    const grouped = groupBy([].concat(...rewards), "type");

    return Object.keys(grouped).map(key => new Reward(grouped[key].reduce((val, rew) => val + rew.count, 0), key as Resource)).filter(rew => !rew.isEmpty());
  }

  static negative(rewards: Reward[]): Reward[] {
    return rewards.map(reward => new Reward(-reward.count, reward.type));
  }

  static toString(rewards: Reward[], sorted = true) {
    // const sortOrder = ['c', 'o', 'k', 'q', 'pw'];
    const sortOrder = ['pw', 'q', 'k', 'o', 'c'];
    if (sorted) {
      rewards.sort((rew1, rew2) => ( sortOrder.findIndex( so => so === rew2.type ) - sortOrder.findIndex(so => so === rew1.type)));
    }
    if (rewards.length === 0) {
      return "~";
    }

    return rewards.map(rew => rew.toString()).join(",");
  }

  static match(rewards1: Reward[], rewards2: Reward[]): boolean {
    return Reward.toString(rewards1, true) === Reward.toString(rewards2, true);
  }

  static includes(container: Reward[], contained: Reward[]): boolean {
    const indexed: {[res in Resource]?: number} = {};
    for (const reward of container) {
      indexed[reward.type] = (indexed[reward.type] || 0) + reward.count;
    }

    for (const reward of contained) {
      indexed[reward.type] = (indexed[reward.type] || 0) - reward.count;
      if (indexed[reward.type] < 0) {
        return false;
      }
    }

    return true;
  }
}
