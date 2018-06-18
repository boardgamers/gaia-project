import Reward from "./reward";
import { Resource } from "..";
import { ResearchField, Building } from "./enums";
import { EventEmitter } from "eventemitter3";
import { CubeCoordinates } from "hexagrid";

const MAX_ORE = 15;
const MAX_CREDIT = 30;
const MAX_KNOWLEDGE = 15;

export default class PlayerData extends EventEmitter {
  victoryPoints: number = 10;
  credits: number = 0;
  ores: number = 0;
  qics: number = 0;
  knowledge: number = 0;
  power: {
    bowl1: number,
    bowl2: number,
    bowl3: number,
    gaia: number
  } = {
    bowl1: 0,
    bowl2: 0,
    bowl3: 0,
    gaia: 0
  };
  [Building.Mine]: number = 0;
  [Building.TradingStation]: number = 0;
  [Building.PlanetaryInstitute]: number = 0;
  [Building.ResearchLab]: number = 0;
  [Building.Academy1]: number = 0;
  [Building.Academy2]: number = 0; 
  [Building.GaiaFormer]: number = 0; 
  research: {
    [key in ResearchField]: number
  } = {
    terra: 0, nav: 0,int: 0, gaia: 0, eco: 0, sci: 0
  };
  range: number = 1;
  gaiaformers: number = 0;
  // Coordinates occupied by buildings
  occupied: CubeCoordinates[] = [];

  toJSON(): Object {
    const ret = {
      victoryPoints: this.victoryPoints,
      credits: this.credits,
      ores: this.ores,
      qics: this.qics,
      knowledge: this.knowledge,
      power: this.power,
      research: this.research,
      range: this.range,
      gaiaformers: this.gaiaformers,
      occupied: this.occupied
    }

    for (const building of Object.values(Building)) {
      ret[building] = this[building];
    }

    return ret;
  }

  payCosts(costs: Reward[]) {
    for (let cost of costs) {
      this.payCost(cost);
    }
  }

  payCost(cost: Reward) {
    this.gainReward(cost, true);
  }

  gainRewards(rewards: Reward[]) {
    for (let reward of rewards) {
      this.gainReward(reward);
    }
  }

  gainReward(reward: Reward, pay = false) {
    if (reward.isEmpty()) {
      return;
    }
    let { count, type: resource } = reward;

    if (pay) {
      count = -count;
    }
    
    if (resource.startsWith("up-")) {
      this.upgradeResearch(resource.slice("up-".length) as ResearchField, count);
      return;
    }
    
    switch(resource) {
      case Resource.Ore: this.ores = Math.min(MAX_ORE, this.ores + count); return;
      case Resource.Credit: this.credits = Math.min(MAX_CREDIT, this.credits + count); return;
      case Resource.Knowledge: this.knowledge = Math.min(MAX_KNOWLEDGE, this.knowledge + count); return;
      case Resource.VictoryPoint: this.victoryPoints += count; return;
      case Resource.Qic: this.qics += count; return;
      case Resource.GainToken: this.power.bowl1 += count; return;
      case Resource.ChargePower: this.chargePower(count); return;
      case Resource.RangeExtension: this.range += count; return;
      case Resource.GaiaFormer: this.gaiaformers +=count; return;
      default: break; // Not implemented
    }
  }

  canPay(reward: Reward[]): boolean {
    const rewards = Reward.merge(reward);

    for (const reward of rewards) {
      if (!this.hasResource(reward)) {
        return false;
      }
    }
    return true;
  }

  hasResource(reward: Reward) {
    switch (reward.type) {
      case Resource.Ore: return this.ores >= reward.count;
      case Resource.Credit: return this.credits >= reward.count;
      case Resource.Knowledge: return this.knowledge >= reward.count;
      case Resource.VictoryPoint: return this.victoryPoints >= reward.count;
      case Resource.Qic: return this.qics >= reward.count;
      case Resource.None: return true;
      case Resource.SpendPower: return this.power.bowl1 + this.power.bowl2 + this.power.bowl3 >= reward.count;
    }

    return false;
  }

  /**
   * Move power tokens from a bowl to an upper one, depending on the amount
   * of power chaged
   * 
   * @param power Power charged
   */
  chargePower(power: number) {
    const bowl1ToUp = Math.min(power, this.power.bowl1);

    this.power.bowl1 -= bowl1ToUp;
    this.power.bowl2 += bowl1ToUp;
    power -= bowl1ToUp;

    if (power <= 0) {
      return;
    }

    const bowl2ToUp = Math.min(power, this.power.bowl2);

    this.power.bowl2 -= bowl2ToUp;
    this.power.bowl3 += bowl2ToUp;
  }

  upgradeResearch(which: ResearchField, count: number) {
    while (count-- > 0) {
      this.research[which] += 1;
      this.emit("upgrade-knowledge", which);
    }
  }
}
