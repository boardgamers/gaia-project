import { EventEmitter } from "eventemitter3";
import { cloneDeep, fromPairs } from "lodash";
import {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  BrainstoneArea,
  Building,
  Command,
  Expansion,
  Federation,
  ResearchField,
  Resource,
  TechTile,
  TechTilePos,
} from "./enums";
import { EventSource } from "./events";
import { GaiaHex } from "./gaia-hex";
import Reward from "./reward";

const MAX_ORE = 15;
const MAX_CREDIT = 30;
const MAX_KNOWLEDGE = 15;

export const resourceLimits = {
  [Resource.Ore]: MAX_ORE,
  [Resource.Credit]: MAX_CREDIT,
  [Resource.Knowledge]: MAX_KNOWLEDGE,
};

export class Power {
  constructor(public area1: number = 0, public area2: number = 0, public area3: number = 0, public gaia: number = 0) {}
}

export type MoveTokens = Power & { brainstone: number };

export default class PlayerData extends EventEmitter {
  victoryPoints = 10;
  bid = 0;
  credits = 0;
  ores = 0;
  qics = 0;
  knowledge = 0;
  power: Power = new Power();
  brainstone: BrainstoneArea = null;

  buildings: {
    [key in Building]: number;
  } = fromPairs(Object.values(Building).map((bld) => [bld, 0])) as any;

  satellites = 0;
  research: {
    [key in ResearchField]: number;
  } = {
    terra: 0,
    nav: 0,
    int: 0,
    gaia: 0,
    eco: 0,
    sci: 0,
  };
  range = 1;
  /** Total number of gaiaformers gained (including those on the board & the gaia area) */
  gaiaformers = 0;
  /** number of gaiaformers gained that are in gaia area */
  gaiaformersInGaia = 0;
  terraformCostDiscount = 0;

  tiles: {
    booster: Booster;
    techs: Array<{ tile: TechTile | AdvTechTile; pos: TechTilePos | AdvTechTilePos; enabled: boolean }>;
    federations: Array<{ tile: Federation; green: boolean }>;
  } = {
    booster: null,
    techs: [],
    federations: [],
  };

  /** Number of federations built (used for ivits) */
  federationCount = 0;

  /** Hexes occupied by buildings with value (not gaia formers), refs match the map hexes with a simple equality test */
  occupied: GaiaHex[] = [];
  leechPossible: number;
  tokenModifier = 1;
  lostPlanet = 0;

  // Internal variables, not meant to be in toJSON():
  brainstoneDest: BrainstoneArea | "discard";
  temporaryRange = 0;
  temporaryStep = 0;
  canUpgradeResearch = true;
  turns = 0;
  // when picking rewards
  toPick: { rewards: Reward[]; count: number; source: EventSource } = undefined;

  toJSON(): Record<string, any> {
    const ret = {
      victoryPoints: this.victoryPoints,
      bid: this.bid,
      credits: this.credits,
      ores: this.ores,
      qics: this.qics,
      knowledge: this.knowledge,
      power: this.power,
      research: this.research,
      range: this.range,
      gaiaformers: this.gaiaformers,
      gaiaformersInGaia: this.gaiaformersInGaia,
      terraformCostDiscount: this.terraformCostDiscount,
      tiles: this.tiles,
      satellites: this.satellites,
      brainstone: this.brainstone,
      leechPossible: this.leechPossible,
      tokenModifier: this.tokenModifier,
      buildings: this.buildings,
      federationCount: this.federationCount,
      lostPlanet: this.lostPlanet,
    };

    return ret;
  }

  /**
   * Creates a copy of the current player data, except its event emitter is not linked to anything
   */
  clone(): PlayerData {
    return Object.assign(new PlayerData(), cloneDeep(this.toJSON()));
  }

  payCost(cost: Reward, source: EventSource) {
    this.gainReward(cost, true, source);
  }

  gainRewards(rewards: Reward[], forced = false, source?: EventSource) {
    let followBrainStoneHeuristics = true;

    if (!forced && this.brainstone && rewards.some((rew) => rew.type === Resource.ChargePower)) {
      // We need to do something about the brainstone
      const [cloneHeuristic, cloneNoHeuristic] = [this.clone(), this.clone()];

      for (const reward of rewards) {
        cloneHeuristic.gainReward(reward, false, null, true);
      }
      for (const reward of rewards) {
        cloneNoHeuristic.gainReward(reward, false, null, false);
      }

      if (cloneHeuristic.brainstone !== cloneNoHeuristic.brainstone) {
        // The brainstone can end up in two different places.
        if (this.brainstoneDest === undefined) {
          // Interrupt by asking player where to put the brainstone
          this.emit("brainstone", [cloneHeuristic.brainstone, cloneNoHeuristic.brainstone]);
        }

        // if the player chose the same destination as the heuristic,
        // we have to activate the heuristic for the following gainReward
        followBrainStoneHeuristics = this.brainstoneDest === cloneHeuristic.brainstone;

        delete this.brainstoneDest;
      }
    }

    for (const reward of rewards) {
      this.gainReward(reward, false, source, followBrainStoneHeuristics);
    }
  }

  // Not to be called by Player. use gainRewards instead.
  private gainReward(reward: Reward, pay = false, source?: EventSource, followBrainStoneHeuristics = true) {
    if (reward.isEmpty()) {
      return;
    }
    let { count } = reward;
    const resource = reward.type;

    if (pay) {
      count = -count;
    }

    if (resource.startsWith("up-") && resource !== Resource.UpgradeLowest) {
      const field = resource.slice("up-".length) as ResearchField;
      this.canUpgradeResearch = true;
      this.emit("beforeResearchUpgrade", field);
      if (this.canUpgradeResearch) {
        this.advanceResearch(resource.slice("up-".length) as ResearchField, count);
      }
      return;
    }

    switch (resource) {
      case Resource.Ore:
        this.ores = Math.min(MAX_ORE, this.ores + count);
        break;
      case Resource.Credit:
        this.credits = Math.min(MAX_CREDIT, this.credits + count);
        break;
      case Resource.Knowledge:
        this.knowledge = Math.min(MAX_KNOWLEDGE, this.knowledge + count);
        break;
      case Resource.VictoryPoint:
        this.victoryPoints += count;
        break;
      case Resource.Qic:
        this.qics += count;
        break;
      case Resource.GainToken:
        count > 0 ? (this.power.area1 += count) : this.discardPower(-count);
        break;
      case Resource.GainTokenGaiaArea:
        count > 0 ? this.chargeGaiaPower(count) : this.discardGaiaPower(-count);
        break;
      case Resource.MoveTokenToGaiaArea:
        this.movePowerToGaia(-count);
        break;
      case Resource.ChargePower:
        count > 0 ? this.chargePower(count, true, followBrainStoneHeuristics) : this.spendPower(-count);
        break;
      case Resource.Range:
        this.range += count;
        break;
      case Resource.TemporaryRange:
        this.temporaryRange += count;
        break;
      case Resource.GaiaFormer:
        count > 0 ? (this.gaiaformers += count) : (this.gaiaformersInGaia -= count);
        break;
      case Resource.TerraformCostDiscount:
        this.terraformCostDiscount += count;
        break;
      case Resource.TemporaryStep:
        this.temporaryStep += count;
        break;
      case Resource.TokenArea3:
        if (count < 0) {
          this.power.area3 += count;
          this.power.gaia -= count;
        }
        break;
      case Resource.Turn:
        this.turns += count;
        break;

      default:
        break; // Not implemented
    }

    if (count > 0) {
      this.emit(`gain-${reward.type}`, count, source);
    } else if (count < 0) {
      this.emit(`pay-${reward.type}`, -count, source);
    }
  }

  hasResource(reward: Reward): boolean {
    const type = reward.type;
    return type === Resource.None || this.getResources(type) >= reward.count;
  }

  getResources(type: Resource): number {
    switch (type) {
      case Resource.Ore:
        return this.ores;
      case Resource.Credit:
        return this.credits;
      case Resource.Knowledge:
        return this.knowledge;
      case Resource.VictoryPoint:
        return this.victoryPoints;
      case Resource.Qic:
        return this.qics;
      case Resource.MoveTokenToGaiaArea:
      case Resource.GainToken:
        return this.discardablePowerTokens();
      case Resource.GainTokenGaiaArea:
        return this.gaiaPowerTokens();
      case Resource.ChargePower:
        return this.spendablePowerTokens();
      case Resource.TokenArea3:
        return this.power.area3;
      case Resource.GaiaFormer:
        return this.gaiaformers - this.gaiaformersInGaia - this.buildings[Building.GaiaFormer];
    }

    return 0;
  }

  canPay(reward: Reward[]): boolean {
    const rewards = Reward.merge(reward);

    for (const rew of rewards) {
      if (!this.hasResource(rew)) {
        return false;
      }
    }
    return true;
  }

  hasPlanetaryInstitute(): boolean {
    return this.buildings[Building.PlanetaryInstitute] > 0;
  }

  discardablePowerTokens(): number {
    return this.power.area1 + this.power.area2 + this.power.area3 + (this.brainstoneInPlay() ? 1 : 0);
  }

  spendablePowerTokens(): number {
    return Math.floor(this.power.area3 * this.tokenModifier) + this.brainstoneValue();
  }

  gaiaPowerTokens(): number {
    return this.power.gaia + (this.brainstone === BrainstoneArea.Gaia ? 1 : 0);
  }

  /**
   * Move power tokens from a power area to an upper one, depending on the amount
   * of power charged
   *
   * @param power Power charged
   */
  chargePower(power: number, apply = true, followBrainStoneHeuristics = true): number {
    let brainstoneUsage = 0;
    let brainstonePos = this.brainstone;

    // needed to avoid wrong usage of  the brainstone
    if (power === 0) {
      return 0;
    }

    if (brainstonePos === BrainstoneArea.Area1) {
      if (followBrainStoneHeuristics || this.power.area1 < power) {
        brainstoneUsage += 1;
        power -= 1;
        brainstonePos = BrainstoneArea.Area2;
      }
    }

    const area1ToUp = Math.min(power, this.power.area1);
    power -= area1ToUp;

    if (brainstonePos === BrainstoneArea.Area2 && power > 0) {
      if (followBrainStoneHeuristics || this.power.area2 + area1ToUp < power) {
        brainstoneUsage += 1;
        power -= 1;
        brainstonePos = BrainstoneArea.Area3;
      }
    }

    const area2ToUp = Math.min(power, this.power.area2 + area1ToUp);

    if (apply) {
      this.power.area1 -= area1ToUp;
      this.power.area2 += area1ToUp - area2ToUp;
      this.power.area3 += area2ToUp;
      this.brainstone = brainstonePos;
    }

    // returns real charged power
    return area1ToUp + area2ToUp + brainstoneUsage;
  }

  spendPower(power: number) {
    if (this.brainstone === BrainstoneArea.Area3 && (power >= 3 || this.power.area3 < power)) {
      let useBrainStone = true;
      // Choose whether to spend the brainstone power or not
      if (this.power.area3 >= power) {
        if (this.brainstoneDest === undefined) {
          // Interrupt by asking player where to put the brainstone
          this.emit("brainstone", [BrainstoneArea.Area3, BrainstoneArea.Area1]);
        }

        if (this.brainstoneDest === BrainstoneArea.Area3) {
          useBrainStone = false;
        }

        delete this.brainstoneDest;
      }

      if (useBrainStone) {
        this.brainstone = BrainstoneArea.Area1;
        power = Math.max(power - 3, 0);
      }
    }
    this.power.area3 -= Math.ceil(power / this.tokenModifier);
    this.power.area1 += Math.ceil(power / this.tokenModifier);
  }

  tokensBelowArea(area: BrainstoneArea) {
    let power = 0;
    switch (area) {
      case BrainstoneArea.Area3:
        power += this.power.area3;
      case BrainstoneArea.Area2:
        power += this.power.area2;
      case BrainstoneArea.Area1:
        power += this.power.area1;
    }
    return power;
  }

  discardPower(power: number) {
    this.moveTokens(power, null);
  }

  movePowerToGaia(power: number) {
    this.moveTokens(power, BrainstoneArea.Gaia);
  }

  private moveTokens(power: number, targetArea: BrainstoneArea.Gaia | null) {
    const brainstoneEvent = targetArea ?? "discard";

    let movedBrainstone = 0;
    if (this.brainstone && this.brainstone !== BrainstoneArea.Gaia) {
      if (this.discardablePowerTokens() === power) {
        this.brainstone = targetArea;
        power -= 1;
        movedBrainstone = 1;
      } else if (targetArea || this.tokensBelowArea(this.brainstone) < power) {
        // don't offer to discard unless necessary
        if (this.brainstoneDest === undefined) {
          this.emit("brainstone", [this.brainstone, brainstoneEvent]);
        }

        if (this.brainstoneDest === brainstoneEvent) {
          this.brainstone = targetArea;
          power -= 1;
          movedBrainstone = 1;
        }

        delete this.brainstoneDest;
      }
    }

    const area1ToGaia = Math.min(power, this.power.area1);
    const area2ToGaia = Math.min(power - area1ToGaia, this.power.area2);
    const area3ToGaia = Math.min(power - area1ToGaia - area2ToGaia, this.power.area3);

    this.power.area1 -= area1ToGaia;
    this.power.area2 -= area2ToGaia;
    this.power.area3 -= area3ToGaia;
    if (targetArea === BrainstoneArea.Gaia) {
      this.power.gaia += area1ToGaia + area2ToGaia + area3ToGaia;
    }

    const event: MoveTokens = {
      area1: area1ToGaia,
      area2: area2ToGaia,
      area3: area3ToGaia,
      gaia: 0,
      brainstone: movedBrainstone,
    };
    this.emit("move-tokens", event);
  }

  chargeGaiaPower(power: number) {
    this.power.gaia += power;
  }

  discardGaiaPower(power: number) {
    this.power.gaia -= power;
    this.emit("discardGaia", power);
  }

  burnablePower() {
    return Math.floor((this.power.area2 + (this.brainstone === BrainstoneArea.Area2 ? 1 : 0)) / 2);
  }

  burnPower(power: number) {
    if (this.brainstone === BrainstoneArea.Area2 && power > 0) {
      this.brainstone = BrainstoneArea.Area3;
      power -= 1;
      this.power.area2 -= 1;
    }
    this.power.area2 -= 2 * power;
    this.power.area3 += power;
    this.emit("burn", power);
  }

  advanceResearch(which: ResearchField, count: number) {
    while (count-- > 0) {
      this.research[which] += 1;
      this.emit("advance-research", which, this.research[which]);
    }
  }

  brainstoneInPlay() {
    return this.brainstone && this.brainstone !== BrainstoneArea.Gaia;
  }

  brainstoneValue() {
    return this.brainstone === BrainstoneArea.Area3 ? 3 : 0;
  }

  hasGreenFederation() {
    return this.tiles.federations.some((fed) => fed.green);
  }

  gaiaFormingDiscount() {
    return this.gaiaformers > 1 ? this.gaiaformers : 0;
  }

  /**
   * Convert all resources into knowledge / ore / credits,
   * to have the maximum victory points
   */
  finalResourceHandling() {
    this.burnPower(this.burnablePower());

    // Convert power into credits
    // Taklons & Nevlas have different power rules, so this is why we use that roundabout way
    const spentPower = this.spendablePowerTokens();
    this.spendPower(spentPower);
    this.credits += spentPower;

    // Convert qics into ore
    this.ores += this.qics;
    this.qics = 0;

    // Gain 1 point for any 3 of ore, credits & knowledge.
    const resources = this.ores + this.credits + this.knowledge;
    this.gainReward(new Reward(Math.max(Math.floor(resources / 3)), Resource.VictoryPoint), false, Command.Spend);
  }

  gainResearchVictoryPoints() {
    // Gain 4 points for research at level 3, 8 points for research at level 4
    // and 12 points for research at level 12
    for (const research of ResearchField.values(Expansion.All)) {
      this.gainReward(new Reward(Math.max(this.research[research] - 2, 0) * 4, Resource.VictoryPoint), false, research);
    }
  }

  removeGreenFederation() {
    // console.log("removing green federation...");
    this.tiles.federations.some((fed) => {
      if (fed.green) {
        fed.green = false;
        return true;
      }
    });
  }

  isNewPlanetType(hex: GaiaHex): boolean {
    for (const hex2 of this.occupied) {
      if (hex !== hex2 && hex2.data.planet === hex.data.planet) {
        return false;
      }
    }
    return true;
  }
}
