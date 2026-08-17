import assert from "assert";
import { EventEmitter } from "eventemitter3";
import { cloneDeep, fromPairs } from "lodash";
import { TRADE_COST } from "./available/ships";
import { BrainstoneActionData, BrainstoneWarning, ChooseTechTile } from "./available/types";
import {
  ArtifactToken,
  Booster,
  Building,
  Command,
  Expansion,
  Federation,
  Planet,
  PowerArea,
  ResearchField,
  Resource,
  Ship,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
  TinkeringTile,
} from "./enums";
import { EventSource } from "./events";
import { FactionBoard } from "./faction-boards";
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

export function powerLogString(power: Power, brainstoneArea: PowerArea): string {
  const areaString = (area: PowerArea, tokens: number): string => {
    return tokens.toString() + (area === brainstoneArea ? ",B" : "");
  };
  const result: string[] = [
    areaString(PowerArea.Area1, power.area1),
    areaString(PowerArea.Area2, power.area2),
    areaString(PowerArea.Area3, power.area3),
    areaString(PowerArea.Gaia, power.gaia),
  ];
  return result.join("/");
}

export type MoveTokens = Power & { brainstone: number };

export type BrainstoneDest = PowerArea | "discard";
export type MaxLeech = { value: number; victoryPoints: number; charge: number };
export type ResearchProgress = {
  [key in ResearchField]: number;
};
export default class PlayerData extends EventEmitter {
  victoryPoints = 10;
  bid = 0;
  credits = 0;
  ores = 0;
  qics = 0;
  knowledge = 0;
  power: Power = new Power();
  brainstone: PowerArea = null;

  buildings: {
    [key in Building]: number;
  } = fromPairs(Building.values(Expansion.All).map((bld) => [bld, 0])) as any;

  destroyedShips: {
    [key in Building]: number;
  } = fromPairs(Building.ships().map((bld) => [bld, 0])) as any;

  deployedShips: {
    [key in Building]: number;
  } = fromPairs(Building.ships().map((bld) => [bld, 0])) as any;

  satellites = 0;
  research: ResearchProgress = {
    terra: 0,
    nav: 0,
    int: 0,
    gaia: 0,
    eco: 0,
    sci: 0,
    dip: 0,
  };
  range = 1;
  shipRange = 2;
  /** Total number of gaiaformers gained (including those on the board & the gaia area) */
  gaiaformers = 0;
  /** number of gaiaformers gained that are in gaia area */
  gaiaformersInGaia = 0;
  /** number of gaiaformers permanently consumed to colonize an asteroid (Lost Fleet) */
  gaiaformersUsedForAsteroid = 0;
  /**
   * Of the current gaiaformersInGaia total, how much got there by spending an already-owned
   * Gaiaformer on something other than actually starting a Gaia project (e.g. Baltaks' "GaiaFormer
   * -> Q.I.C." free action costing "1gf" - see gainReward's Resource.GaiaFormer case). Tracked
   * purely so the §G3 "former" booster's pass bonus can add it back: the owner-confirmed ruling
   * (RULES_CLARIFICATIONS.md G3) counts Gaiaformers "on Faction board or deployed" and excludes
   * only ones used to colonize an asteroid, NOT ones spent this way. Deliberately does NOT affect
   * availability/canPay - reset in lockstep with gaiaformersInGaia in Player.gaiaPhaseEnd(), so it
   * never drifts, and left otherwise unused so it can't change replay behavior of existing games.
   */
  gaiaformersUsedForOther = 0;
  terraformCostDiscount = 0;
  tradeBonus = 0;
  tradeDiscount = 0;
  tradeShips = 0;

  tiles: {
    booster: Booster;
    techs: Array<ChooseTechTile & { enabled: boolean }>;
    federations: Array<{ tile: Federation; green: boolean }>;
  } = {
    booster: null,
    techs: [],
    federations: [],
  };

  /** Number of federations built (used for ivits) */
  federationCount = 0;
  /** Lost Fleet Federation tokens claimed from explored spaceship boards */
  spaceshipFederations: Array<{ tile: SpaceshipFederation; green: boolean }> = [];
  /** Lost Fleet spaceship exploration slot occupied by this player's shuttle, if any, per ship */
  explorationShips: {
    [key in Spaceship]?: number;
  } = {};
  /** Lost Fleet: the 3 base-game planet colors that cost this player 3 terraform steps */
  lostFleetCost3Planets: Planet[] = [];
  /** Lost Fleet Tinkeroids: the current round's chosen Tinkering tile, if any */
  currentTinkeringTile: TinkeringTile = null;
  /** Lost Fleet Tinkeroids: tiles already used and removed from play */
  usedTinkeringTiles: TinkeringTile[] = [];
  /** Lost Fleet Moweyds: number of Power Rings placed so far */
  powerRingsPlaced = 0;

  /** Hexes occupied by buildings with value (not gaia formers), refs match the map hexes with a simple equality test */
  occupied: GaiaHex[] = [];
  ships: Ship[] = [];
  leechPossible: number;
  tokenModifier = 1;
  lostPlanet = 0;
  /** Virtual planet types granted by Asteroid/Protoplanet-themed Artifact tokens, no hex placed */
  artifactPlanetTypes: Planet[] = [];
  /** Lost Fleet Twilight: Artifact tokens claimed via Choose Artifact, kept for display under the player board */
  artifacts: ArtifactToken[] = [];

  // Internal variables, not meant to be in toJSON():
  brainstoneDest: BrainstoneDest;
  temporaryRange = 0;
  temporaryStep = 0;
  canUpgradeResearch = true;
  turns = 0;
  /**
   * Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §3.4) - true only on a disposable sandbox
   * clone, never on a real game's player data. It lifts affordability (`hasResource` below) so an
   * unaffordable move can still be played and the debt shown, and it turns on `spendPower`'s power
   * top-up. It deliberately does NOT lift the MAX_ORE/MAX_CREDIT/MAX_KNOWLEDGE gain clamps: analysis
   * mode used to inject a fake wallet that those clamps ate, but a seat now keeps its real numbers,
   * and a real player's gains cap exactly the same way - so clamping is the faithful behaviour.
   * Deliberately absent from toJSON() (like the other internal variables above), so it can never
   * round-trip through a serialize/deserialize into a real game - the viewer re-applies it to a fresh
   * clone on every replay step instead of relying on it surviving.
   */
  analysis = false;
  /**
   * How much power the analysis sandbox has assumed this seat charged (ANALYSIS_MODE_PLAN.md §12).
   * Power is the one overdrawable resource that cannot go negative - bowls hold tokens, not a balance
   * - so instead of driving area 3 below zero, `spendPower` charges the shortfall up first and adds
   *   it here, giving the UI one honest number for "this line only works if you also charge N power".
   *
   * Non-serialized for the same reason as `analysis` above, and recomputed from scratch on every
   * replay, so it always describes exactly the line currently on screen.
   */
  analysisAssumedPower = 0;
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
      gaiaformersUsedForAsteroid: this.gaiaformersUsedForAsteroid,
      gaiaformersUsedForOther: this.gaiaformersUsedForOther,
      terraformCostDiscount: this.terraformCostDiscount,
      tiles: this.tiles,
      satellites: this.satellites,
      brainstone: this.brainstone,
      leechPossible: this.leechPossible,
      tokenModifier: this.tokenModifier,
      buildings: this.buildings,
      destroyedShips: this.destroyedShips,
      deployedShips: this.deployedShips,
      federationCount: this.federationCount,
      spaceshipFederations: this.spaceshipFederations,
      explorationShips: this.explorationShips,
      lostFleetCost3Planets: this.lostFleetCost3Planets,
      currentTinkeringTile: this.currentTinkeringTile,
      usedTinkeringTiles: this.usedTinkeringTiles,
      powerRingsPlaced: this.powerRingsPlaced,
      lostPlanet: this.lostPlanet,
      artifactPlanetTypes: this.artifactPlanetTypes,
      artifacts: this.artifacts,
      ships: this.ships,
      shipRange: this.shipRange,
      tradeBonus: this.tradeBonus,
      tradeDiscount: this.tradeDiscount,
      tradeShips: this.tradeShips,
      temporaryRange: this.temporaryRange,
      temporaryStep: this.temporaryStep,
    };

    return ret;
  }

  initialPowerRewards(board: FactionBoard): Reward[] {
    const rewards = [
      new Reward(board.power.area1 + board.power.area2, Resource.GainToken),
      new Reward(board.power.area2, Resource.ChargePower),
    ];
    if (board.brainstone !== null) {
      assert(board.brainstone === PowerArea.Area1, "other initial areas for brainstone are not supported");
      rewards.push(new Reward(1, Resource.Brainstone));
    }
    return rewards;
  }

  /**
   * Creates a copy of the current player data, except its event emitter is not linked to anything
   */
  clone(): PlayerData {
    return Object.assign(new PlayerData(), cloneDeep(this.toJSON()));
  }

  private emitBrainstoneEvent(choices: BrainstoneDest[], area1Warning?: BrainstoneWarning) {
    const d: BrainstoneActionData = {
      choices: choices.map((a) => ({
        area: a,
        warning: a === PowerArea.Area1 ? area1Warning : undefined,
      })),
    };
    this.emit("brainstone", d);
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
          this.emitBrainstoneEvent([cloneHeuristic.brainstone, cloneNoHeuristic.brainstone]);
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

  gainReward(reward: Reward, pay = false, source?: EventSource, followBrainStoneHeuristics = true) {
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
      case Resource.GainTokenArea3:
        this.power.area3 += count;
        break;
      case Resource.Brainstone:
        this.brainstone = PowerArea.Area1; //initial brainstone gain or gaia to area1
        break;
      case Resource.GainTokenGaiaArea:
        count > 0 ? this.chargeGaiaPower(count) : this.discardGaiaPower(-count);
        break;
      case Resource.MoveTokenToGaiaArea:
        this.movePowerToGaia(-count);
        break;
      case Resource.MoveTokenFromGaiaAreaToArea1:
        this.movePowerFromGaia(count);
        break;
      case Resource.ChargePower:
        count > 0 ? this.chargePower(count, true, followBrainStoneHeuristics) : this.spendPower(-count);
        break;
      case Resource.BurnToken:
        this.burnPower(count);
        break;
      case Resource.Range:
        this.range += count;
        break;
      case Resource.ShipRange:
        this.shipRange += count;
        break;
      case Resource.TemporaryRange:
        this.temporaryRange += count;
        break;
      case Resource.TradeBonus:
        this.tradeBonus += count;
        break;
      case Resource.TradeDiscount:
        this.tradeDiscount += count;
        break;
      case Resource.TradeShip:
        this.tradeShips += count;
        break;
      case Resource.GaiaFormer:
        if (count > 0) {
          this.gaiaformers += count;
        } else {
          // Spending an already-owned Gaiaformer (e.g. Baltaks' "1gf" free-action cost) reuses
          // gaiaformersInGaia for availability bookkeeping (unchanged from before, to avoid
          // altering canPay/replay behavior) - gaiaformersUsedForOther mirrors the same delta so
          // the §G3 booster's scoring can add it back. See the gaiaformersUsedForOther comment.
          this.gaiaformersInGaia -= count;
          this.gaiaformersUsedForOther -= count;
        }
        break;
      case Resource.MoveGaiaFormerFromGaiaAreaToArea1:
        this.gaiaformersInGaia -= count;
        break;
      case Resource.TerraformCostDiscount:
        this.terraformCostDiscount += count;
        break;
      case Resource.TemporaryStep:
        this.temporaryStep += count;
        break;
      case Resource.MoveTokenFromArea3ToGaia:
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

  /**
   * The spendable resources the viewer's analysis mode (ANALYSIS_MODE_PLAN.md §12) lets a player
   * overdraw: the four wallet resources plus power. Everything else `getResources` answers for stays
   * genuinely gated even in analysis mode, because those are physical components or board positions
   * rather than a stock you can be in debt on - a Gaiaformer you do not own, or a power token that is
   * not in the Gaia area, cannot be conjured by assuming you overspent.
   *
   * Power is in this list, but it is the one that cannot simply go negative (bowls hold tokens, not a
   * balance). `spendPower` tops the shortfall up instead and records it - see its own comment.
   */
  private static readonly ANALYSIS_OVERDRAWABLE: Resource[] = [
    Resource.Credit,
    Resource.Ore,
    Resource.Knowledge,
    Resource.Qic,
    Resource.ChargePower,
  ];

  hasResource(reward: Reward): boolean {
    const type = reward.type;
    if (type === Resource.None) {
      return true;
    }
    // Analysis mode (§12): affordability is what the engine enforces at command-GENERATION time, so
    // lifting it here is the whole mechanism behind "let me build it anyway and show me the debt".
    // Deliberately not a resource top-up: the seat keeps its real numbers and simply goes negative,
    // which is what the player board then displays.
    if (this.analysis && PlayerData.ANALYSIS_OVERDRAWABLE.includes(type)) {
      return true;
    }
    return this.getResources(type) >= reward.count;
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
      case Resource.MoveTokenFromArea3ToGaia:
        return this.power.area3;
      case Resource.GaiaFormer:
        return (
          this.gaiaformers -
          this.gaiaformersInGaia -
          this.buildings[Building.GaiaFormer] -
          this.gaiaformersUsedForAsteroid
        );
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

  hasExplored(ship: Spaceship): boolean {
    return this.explorationShips[ship] !== undefined;
  }

  exploredShipsCount(): number {
    return Object.keys(this.explorationShips).length;
  }

  discardablePowerTokens(): number {
    return this.power.area1 + this.power.area2 + this.power.area3 + (this.brainstoneInPlay() ? 1 : 0);
  }

  spendablePowerTokens(): number {
    return Math.floor(this.power.area3 * this.tokenModifier) + this.brainstoneValue();
  }

  gaiaPowerTokens(): number {
    return this.power.gaia + (this.brainstone === PowerArea.Gaia ? 1 : 0);
  }

  maxLeech(leechPossible: number, extraPowerToken?: boolean): MaxLeech {
    // considers real chargeable power and victory points
    const charge = this.chargePower(leechPossible, false) + (extraPowerToken ? 2 : 0);
    const victoryPoints = this.victoryPoints + 1;
    const value = Math.min(leechPossible, charge, victoryPoints);
    return { value, victoryPoints, charge };
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

    if (brainstonePos === PowerArea.Area1) {
      if (followBrainStoneHeuristics || this.power.area1 < power) {
        brainstoneUsage += 1;
        power -= 1;
        brainstonePos = PowerArea.Area2;
      }
    }

    const area1ToUp = Math.min(power, this.power.area1);
    power -= area1ToUp;

    if (brainstonePos === PowerArea.Area2 && power > 0) {
      if (followBrainStoneHeuristics || this.power.area2 + area1ToUp < power) {
        brainstoneUsage += 1;
        power -= 1;
        brainstonePos = PowerArea.Area3;
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

  /**
   * Analysis mode's power top-up (§12). `hasResource` lets this seat commit to a power cost it cannot
   * really pay, but `spendPower` below moves tokens area3 -> area1 with no floor, so an unpayable
   * cost would leave a NEGATIVE bowl - a state the board renders as nonsense and every later charge
   * then compounds. Instead: charge the shortfall up first, one step at a time through the engine's
   * own `chargePower`, and only fabricate tokens when there are genuinely none left below to lift.
   * Either way the total lands in `analysisAssumedPower`, so the assumption is shown, not hidden.
   */
  private assumePowerForAnalysis(power: number) {
    // Bounded by construction (every charge moves a token up exactly one bowl), but capped anyway so
    // an unforeseen faction/token combination can never spin here.
    for (let i = 0; i < 100 && this.spendablePowerTokens() < power; i++) {
      if (this.power.area1 + this.power.area2 === 0) {
        break;
      }
      this.chargePower(1, true, false);
      this.analysisAssumedPower += 1;
    }
    const shortfall = power - this.spendablePowerTokens();
    if (shortfall > 0) {
      const tokens = Math.ceil(shortfall / this.tokenModifier);
      this.power.area3 += tokens;
      this.analysisAssumedPower += shortfall;
    }
  }

  spendPower(power: number) {
    if (this.analysis) {
      this.assumePowerForAnalysis(power);
    }
    if (this.brainstone === PowerArea.Area3) {
      let useBrainStone = true;
      const warning: BrainstoneWarning = power < 3 ? BrainstoneWarning.brainstoneChargesWasted : undefined;
      // Choose whether to spend the brainstone power or not
      const needBrainstone = this.power.area3 < power;

      let choices: BrainstoneDest[] = [];

      if (needBrainstone) {
        if (warning) {
          // choice is for warning only
          choices = [PowerArea.Area1];
        } else {
          // simply use it
          useBrainStone = true;
        }
      } else {
        if (warning) {
          // simply not use it
          useBrainStone = false;
        } else {
          // ask
          choices = [PowerArea.Area1, PowerArea.Area3];
        }
      }

      if (choices.length > 0) {
        if (this.brainstoneDest === undefined) {
          // Interrupt by asking player where to put the brainstone
          this.emitBrainstoneEvent(choices, warning);
        }

        useBrainStone = this.brainstoneDest === PowerArea.Area1;
        delete this.brainstoneDest;
      }

      if (useBrainStone) {
        this.brainstone = PowerArea.Area1;
        power = Math.max(power - 3, 0);
      }
    }
    this.power.area3 -= Math.ceil(power / this.tokenModifier);
    this.power.area1 += Math.ceil(power / this.tokenModifier);
  }

  tokensBelowArea(area: PowerArea) {
    let power = 0;
    switch (area) {
      case PowerArea.Area3:
        power += this.power.area3;
      // eslint-disable-next-line no-fallthrough
      case PowerArea.Area2:
        power += this.power.area2;
      // eslint-disable-next-line no-fallthrough
      case PowerArea.Area1:
        power += this.power.area1;
    }
    return power;
  }

  discardPower(power: number) {
    this.moveTokens(power, null);
  }

  movePowerToGaia(power: number) {
    this.moveTokens(power, PowerArea.Gaia);
  }

  movePowerFromGaia(power: number) {
    this.power.gaia -= power;
    this.power.area1 += power;
    this.emit("discardGaia", power);
  }

  private moveTokens(power: number, targetArea: PowerArea.Gaia | null) {
    const brainstoneEvent = targetArea ?? "discard";

    let movedBrainstone = 0;
    if (this.brainstone && this.brainstone !== PowerArea.Gaia) {
      if (this.discardablePowerTokens() === power) {
        this.brainstone = targetArea;
        power -= 1;
        movedBrainstone = 1;
      } else if (targetArea || this.tokensBelowArea(this.brainstone) < power) {
        // don't offer to discard unless necessary
        if (this.brainstoneDest === undefined) {
          this.emitBrainstoneEvent([this.brainstone, brainstoneEvent]);
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
    if (targetArea === PowerArea.Gaia) {
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
  }

  burnablePower() {
    return Math.floor((this.power.area2 + (this.brainstone === PowerArea.Area2 ? 1 : 0)) / 2);
  }

  burnPower(power: number) {
    if (this.brainstone === PowerArea.Area2 && power > 0) {
      this.brainstone = PowerArea.Area3;
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
    return this.brainstone && this.brainstone !== PowerArea.Gaia;
  }

  brainstoneValue() {
    return this.brainstone === PowerArea.Area3 ? 3 : 0;
  }

  hasGreenFederation() {
    return this.tiles.federations.some((fed) => fed.green) || this.spaceshipFederations.some((fed) => fed.green);
  }

  gaiaFormingDiscount() {
    return this.gaiaformers > 1 ? this.gaiaformers : 0;
  }

  tradeCost(): Reward {
    return new Reward(TRADE_COST - this.tradeDiscount, Resource.ChargePower);
  }

  /**
   * Convert all resources into knowledge / ore / credits,
   * to have the maximum victory points
   */
  finalResourceHandling(): Reward[] {
    const ret: Reward[] = [];
    const gain = (...rewards: Reward[]) => {
      this.gainRewards(rewards, true, Command.Spend);
      ret.push(...rewards);
    };

    const burnablePower = this.burnablePower();
    if (burnablePower) {
      gain(new Reward(burnablePower, Resource.BurnToken));
    }

    // Convert power into credits
    // Taklons & Nevlas have different power rules, so this is why we use that roundabout way
    const creditGain = this.spendablePowerTokens();
    if (creditGain > 0) {
      gain(new Reward(-creditGain / this.tokenModifier, Resource.ChargePower), new Reward(creditGain, Resource.Credit));
    }

    const qics = this.qics;
    if (qics > 0) {
      // Convert qics into ore
      gain(new Reward(-qics, Resource.Qic), new Reward(qics, Resource.Ore));
    }

    // Gain 1 point for any 3 of ore, credits & knowledge.
    const resources = this.ores + this.credits + this.knowledge;
    if (resources > 0) {
      gain(new Reward(Math.max(Math.floor(resources / 3)), Resource.VictoryPoint));
    }
    return ret;
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
    if (
      this.tiles.federations.some((fed) => {
        if (fed.green) {
          fed.green = false;
          return true;
        }
      })
    ) {
      return;
    }

    this.spaceshipFederations.some((fed) => {
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

/**
 * Range used for build-distance checks: `data.range` (bumped by Reward.Range events, e.g.
 * Navigation track) plus +1 while the Lost Fleet Range spaceship tech tile is claimed and not
 * covered by an Advanced Tech tile (`tiles.techs[].enabled` already tracks covering for the base
 * game's own standard/advanced tech mechanic - reused here rather than duplicated). A standalone
 * function rather than a PlayerData method so callers can pass any range/tiles-shaped object
 * (e.g. lightweight test fixtures), not only a fully-constructed PlayerData instance.
 */
export function effectiveRange(data: Pick<PlayerData, "range" | "tiles">): number {
  const hasRangeTech = (data.tiles?.techs ?? []).some((t) => t.tile === SpaceshipTechTile.Range && t.enabled);
  return data.range + (hasRangeTech ? 1 : 0);
}
