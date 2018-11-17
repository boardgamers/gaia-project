import Reward from "./reward";
import { GaiaHex } from "./gaia-hex";
import { ResearchField, Building, Booster, TechTile, AdvTechTile, Federation, Resource, BrainstoneArea, TechTilePos, AdvTechTilePos, Command, Expansion } from "./enums";
import { EventEmitter } from "eventemitter3";
import { EventSource } from './events';
import * as fromPairs from "lodash.frompairs";
import * as cloneDeep from 'lodash.clonedeep';

const MAX_ORE = 15;
const MAX_CREDIT = 30;
const MAX_KNOWLEDGE = 15;
const MAX_SHIP = 3;
const MAX_TRADE_TOKENS = 15;

export default class PlayerData extends EventEmitter {
  victoryPoints: number = 10;
  credits: number = 0;
  ores: number = 0;
  qics: number = 0;
  knowledge: number = 0;
  get ships() {
    return this.shipLocations.length;
  }
  tradeTokens = 0;
  power: {
    area1: number,
    area2: number,
    area3: number,
    gaia: number
  } = {
    area1: 0,
    area2: 0,
    area3: 0,
    gaia: 0
  };
  brainstone: BrainstoneArea = null;

  buildings: {
    [key in Building]: number
  } = fromPairs(Object.values(Building).map(bld => [bld, 0])) as any;

  satellites: number = 0;
  research: {
    [key in ResearchField]: number
  } = {
    terra: 0, nav: 0, int: 0, gaia: 0, eco: 0, sci: 0, trade: 0, ship: 0
  };
  range: number = 1;
  shipRange: number = 0;
  movingShips: number = 1;
  /** Total number of gaiaformers gained (including those on the board & the gaia area) */
  gaiaformers: number = 0;
  /** number of gaiaformers gained that are in gaia area */
  gaiaformersInGaia: number = 0;
  terraformCostDiscount: number = 0;

  tiles: {
    booster: Booster;
    techs: Array<{ tile: TechTile | AdvTechTile, pos: TechTilePos | AdvTechTilePos, enabled: boolean}>
    federations: Array<{tile: Federation, green: boolean}>
  } = {
    booster: null,
    techs: [],
    federations: []
  };

  /** Number of federations built (used for ivits) */
  federationCount: number = 0;

  /** Coordinates occupied by buildings */
  occupied: GaiaHex[] = [];
  shipLocations: string[] = [];
  leechPossible: number;
  tokenModifier: number = 1;
  lostPlanet: number = 0;
  advancedShips: number = 0;
  // When placing ships. Not internal (because of income command on site)
  shipsToPlace: number = 0;

  // Internal variables, not meant to be in toJSON():
  followBrainStoneHeuristics = true;
  brainstoneDest: BrainstoneArea | "discard";
  temporaryRange: number = 0;
  temporaryShipRange: number = 0; // unused for now, using temporaryRange instead
  temporaryStep: number = 0;
  qicUsedToBoostShip: number = 0;
  movableShips: number = 0;
  movableShipLocations: string[] = [];
  turns = 0;
  // when picking rewards
  toPick: {rewards: Reward[], count: number, source: EventSource} = undefined;

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
      shipLocations: this.shipLocations,
      shipRange: this.shipRange,
      shipsToPlace: this.shipsToPlace,
      movingShips: this.movingShips
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
    if (!forced && this.brainstone && rewards.some(rew => rew.type === Resource.ChargePower)) {
      // We need to do something about the brainstone
      const [cloneHeuristic, cloneNoHeuristic] = [this.clone(), this.clone()];
      cloneHeuristic.followBrainStoneHeuristics = true;
      cloneNoHeuristic.followBrainStoneHeuristics = false;

      cloneHeuristic.gainRewards(rewards, true);
      cloneNoHeuristic.gainRewards(rewards, true);

      if (cloneHeuristic.brainstone !== cloneNoHeuristic.brainstone) {
        // The brainstone can end up in two different places.
        if (this.brainstoneDest === undefined) {
          // Interrupt by asking player where to put the brainstone
          this.emit('brainstone', [cloneHeuristic.brainstone, cloneNoHeuristic.brainstone]);
        }

        this.followBrainStoneHeuristics = this.brainstoneDest === cloneHeuristic.brainstone;

        delete this.brainstoneDest;
      }
    }

    for (const reward of rewards) {
      this.gainReward(reward, false, source);
    }
  }

  // Not to be called by Player. use gainRewards instead.
  private gainReward(reward: Reward, pay = false, source?: EventSource) {
    if (reward.isEmpty()) {
      return;
    }
    let { count } = reward;
    const resource = reward.type;

    if (pay) {
      count = -count;
    }

    if (resource.startsWith("up-") && resource !== Resource.UpgradeLowest) {
      this.advanceResearch(resource.slice("up-".length) as ResearchField, count);
      return;
    }

    switch (resource) {
      case Resource.Ore: this.ores = Math.min(MAX_ORE, this.ores + count); break;
      case Resource.Credit: this.credits = Math.min(MAX_CREDIT, this.credits + count); break;
      case Resource.Knowledge: this.knowledge = Math.min(MAX_KNOWLEDGE, this.knowledge + count); break;
      case Resource.SpaceShip: console.log("original ship count", count); count = Math.min(count, MAX_SHIP + this.advancedShips - this.ships); break;
      case Resource.VictoryPoint: this.victoryPoints += count; break;
      case Resource.Qic: this.qics += count; break;
      case Resource.GainToken: count > 0 ?  this.power.area1 += count : this.discardPower(-count); break;
      case Resource.GainTokenGaiaArea: count > 0 ? this.chargeGaiaPower(count) :  this.discardGaiaPower(-count); break;
      case Resource.MoveTokenToGaiaArea: this.movePowerToGaia(-count); break;
      case Resource.ChargePower: count > 0 ? this.chargePower(count) : this.spendPower(-count); break;
      case Resource.Range: this.range += count; break;
      case Resource.TemporaryRange: this.temporaryRange += count; break;
      case Resource.SpaceShipRange: this.shipRange += 1; break;
      case Resource.SpaceShipMove: this.movingShips += 1; break;
      case Resource.GaiaFormer: count > 0 ? this.gaiaformers += count : this.gaiaformersInGaia -= count; break;
      case Resource.TerraformCostDiscount: this.terraformCostDiscount += count; break;
      case Resource.TemporaryStep: this.temporaryStep += count; break;
      case Resource.TokenArea3: if (count < 0) { this.power.area3 += count; this.power.gaia -= count; } break;
      case Resource.AdvancedSpaceShip: this.advancedShips += count; break;
      case Resource.Turn: this.turns += count; break;

      default: break; // Not implemented
    }

    if (count > 0) {
      this.emit(`gain-${reward.type}`, count, source);
    } else if (count < 0) {
      this.emit(`pay-${reward.type}`, -count, source);
    }
  }

  availableTradeTokens() {
    return MAX_TRADE_TOKENS - this.tradeTokens;
  }

  hasResource(reward: Reward) {
    switch (reward.type) {
      case Resource.Ore: return this.ores >= reward.count;
      case Resource.Credit: return this.credits >= reward.count;
      case Resource.Knowledge: return this.knowledge >= reward.count;
      case Resource.VictoryPoint: return this.victoryPoints >= reward.count;
      case Resource.Qic: return this.qics >= reward.count;
      case Resource.None: return true;
      case Resource.MoveTokenToGaiaArea:
      case Resource.GainToken: return this.discardablePowerTokens() >= reward.count;
      case Resource.GainTokenGaiaArea: return this.gaiaPowerTokens() >= reward.count;
      case Resource.ChargePower: return this.spendablePowerTokens() >= reward.count;
      case Resource.TokenArea3: return this.power.area3 >= reward.count;
      case Resource.GaiaFormer: return this.gaiaformers - this.gaiaformersInGaia - this.buildings[Building.GaiaFormer]  >= reward.count;
    }

    return false;
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

  leechablePowerTokens(): number {
    const base = this.power.area1 * 2 + this.power.area2;

    if (this.brainstone === BrainstoneArea.Area1) {
      return base + 2;
    } else if (this.brainstone === BrainstoneArea.Area2) {
      return base + 1;
    }

    return base;
  }

  gaiaPowerTokens(): number {
    return this.power.gaia + (this.brainstone === BrainstoneArea.Gaia ? 1 : 0);
  }

  /**
   * Move power tokens from a power area to an upper one, depending on the amount
   * of power chaged
   *
   * @param power Power charged
   */
  chargePower(power: number, apply: boolean = true): number {
    let brainstoneUsage = 0;
    let brainstonePos = this.brainstone;

    // needed to avoid wrong usage of  the brainstone
    if (power === 0) { return 0; }

    if (brainstonePos === BrainstoneArea.Area1) {
      if (this.followBrainStoneHeuristics || this.power.area1 < power) {
        brainstoneUsage += 1;
        power -= 1;
        brainstonePos = BrainstoneArea.Area2;
      }
    }

    const area1ToUp = Math.min(power, this.power.area1);
    power -= area1ToUp;

    if (brainstonePos === BrainstoneArea.Area2 && power > 0) {
      if (this.followBrainStoneHeuristics || (this.power.area2 + area1ToUp) < power) {
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
      this.brainstone = BrainstoneArea.Area1;
      power = Math.max(power - 3, 0);
    }
    this.power.area3 -= Math.ceil( power / this.tokenModifier );
    this.power.area1 += Math.ceil( power / this.tokenModifier );
  }

  tokensBelowArea(area: BrainstoneArea) {
    let power = 0;
    switch (area) {
      case BrainstoneArea.Area3: power += this.power.area3;
      case BrainstoneArea.Area2: power += this.power.area2;
      case BrainstoneArea.Area1: power += this.power.area1;
    }
    return power;
  }

  discardPower(power: number) {
    if (this.brainstone && this.brainstone !== BrainstoneArea.Gaia) {
      if (this.discardablePowerTokens() === power) {
        this.brainstone = null;
        power -= 1;
      } else if (this.tokensBelowArea(this.brainstone) < power) {
        if (this.brainstoneDest === undefined) {
          this.emit("brainstone", [this.brainstone, 'discard']);
        }

        if (this.brainstoneDest === 'discard') {
          this.brainstone = null;
          power -= 1;
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
  }

  movePowerToGaia(power: number) {
    if (this.brainstone && this.brainstone !== BrainstoneArea.Gaia) {
      if (this.discardablePowerTokens() === power) {
        this.brainstone = BrainstoneArea.Gaia;
        power -= 1;
      } else {
        if (this.brainstoneDest === undefined) {
          this.emit("brainstone", [this.brainstone, BrainstoneArea.Gaia]);
        }

        if (this.brainstoneDest === BrainstoneArea.Gaia) {
          this.brainstone = BrainstoneArea.Gaia;
          power -= 1;
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
    this.power.gaia += area1ToGaia + area2ToGaia + area3ToGaia;
  }

  chargeGaiaPower(power: number) {
    this.power.gaia += power;
  }

  discardGaiaPower(power: number) {
    this.power.gaia -= power;
    this.emit('discardGaia', power);
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
    this.emit('burn', power);
  }

  advanceResearch(which: ResearchField, count: number) {
    while (count-- > 0) {
      this.research[which] += 1;
      this.emit("advance-research", which);
    }
  }

  brainstoneInPlay() {
    return this.brainstone && this.brainstone !== BrainstoneArea.Gaia;
  }

  brainstoneValue() {
    return this.brainstone === BrainstoneArea.Area3 ? 3 : 0;
  }

  hasGreenFederation() {
    return this.tiles.federations.some(fed => fed.green);
  }

  gaiaFormingDiscount() {
    return this.gaiaformers > 1  ?  this.gaiaformers : 0;
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
  }

  gainFinalVictoryPoints() {
    // Gain 4 points for research at level 3, 8 points for research at level 4
    // and 12 points for research at level 12
    for (const research of ResearchField.values(Expansion.All)) {
      this.gainReward(new Reward(Math.max(this.research[research] - 2, 0) * 4, Resource.VictoryPoint), false, research);
    }

    // Gain 1 point for any 3 of ore, credits & knowledge.
    this.finalResourceHandling();

    const resources = this.ores + this.credits + this.knowledge;
    this.gainReward(new Reward(Math.max(Math.floor(resources / 3)), Resource.VictoryPoint), false, Command.Spend);
  }

  removeGreenFederation() {
    this.tiles.federations.some(fed => {
      if (fed.green) {
        fed.green = false;
        return true;
      }
    });
  }
}
