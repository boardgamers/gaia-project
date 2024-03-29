import assert from "assert";
import { EventEmitter } from "eventemitter3";
import { Grid, Hex } from "hexagrid";
import { countBy, difference, merge, sum, uniq, uniqWith, zipWith } from "lodash";
import spanningTree from "./algorithms/spanning-tree";
import { ChooseTechTile } from "./available/types";
import { stdBuildingValue } from "./buildings";
import { terraformingCost } from "./cost";
import {
  Booster,
  Building,
  Command,
  Condition,
  Expansion,
  Faction,
  Federation,
  FinalTile,
  isShip,
  Operator,
  Phase,
  Planet,
  Player as PlayerEnum,
  PowerArea,
  ResearchField,
  Resource,
  Resource as ResourceEnum,
  Ship,
  TechTile,
  TechTilePos,
} from "./enums";
import Event, { EventSource } from "./events";
import { factionBoard, FactionBoard, FactionBoardRaw } from "./faction-boards";
import { FactionBoardVariant } from "./faction-boards/types";
import { factionPlanet } from "./factions";
import { federationCost, FederationInfo, isOutclassedBy, parseFederationLocation } from "./federation";
import { GaiaHex } from "./gaia-hex";
import { IncomeSelection } from "./income";
import SpaceMap from "./map";
import { terraformingStepsRequired } from "./planets";
import PlayerData from "./player-data";
import { keyNeeded, lastTile, researchEvents } from "./research-tracks";
import Reward from "./reward";
import { boosterEvents } from "./tiles/boosters";
import { federationRewards, isGreen } from "./tiles/federations";
import { finalScorings } from "./tiles/scoring";
import { isAdvanced, techTileEvents } from "./tiles/techs";
import { isVersionOrLater } from "./utils";

// 25 satellites total
// The 2 used on the final scoring board and 1 used in the player order can be replaced by other markers
export const MAX_SATELLITES = 25;

interface FederationCache {
  federations: FederationInfo[];
  availableSatellites: number;
  /** Do we allow custom federations even if there are no possible federations detected by the algorithm? */
  custom: boolean;
}

export type AutoCharge = "ask" | "decline-cost" | 1 | 2 | 3 | 4 | 5;

export const defaultAutoCharge = 1;
export const defaultAutoChargeTargetSpendablePower = 0;

export class Settings {
  constructor(
    public autoChargePower: AutoCharge = defaultAutoCharge,
    public autoChargeTargetSpendablePower: number = defaultAutoChargeTargetSpendablePower,
    public autoIncome: boolean = false,
    public autoBrainstone: boolean = false,
    public itarsAutoChargeToArea3: boolean = false
  ) {}
}

export enum BuildWarning {
  stepBoosterNotUsed = "step-booster-not-used",
  rangeBoosterNotUsed = "range-booster-not-used",
  stepActionPartiallyWasted = "step-action-partially-wasted",
  expensiveTerraforming = "expensive-terraforming",
  gaiaFormingWithChargedTokens = "gaia-forming-with-charged-tokens",
  federationWithChargedTokens = "federation-with-charged-tokens",
  lantidsDeadlock = "lantids-deadlock",
  lantidsBuildWithoutPi = "lantids-build-without-PI",
  geodensBuildWithoutPi = "geodens-build-without-PI",
  expensiveTradingStation = "expensive-trade-station",
  gaiaFormerWouldExtendRange = "gaia-former-would-extend-range",
  gaiaFormerLastRound = "gaia-former-last-round",
  buildingWillBePartOfFederation = "building-will-be-part-of-federation",
  ambasFederationWithoutPi = "ambas-federation-without-PI",
  ambasSwapIntoFederation = "ambas-swap-into-federation",
}

export type BuildCheck = { cost: Reward[]; steps: number; warnings: BuildWarning[] };

export default class Player extends EventEmitter {
  faction: Faction = null;
  variant: {
    board: FactionBoardRaw;
    version: number;
  } = null;
  board: FactionBoard = null;
  data: PlayerData = new PlayerData();
  settings: Settings = new Settings();
  events: { [key in Operator]: Event[] } = {
    [Operator.Once]: [],
    [Operator.Income]: [],
    [Operator.Trigger]: [],
    [Operator.Activate]: [],
    [Operator.Pass]: [],
    [Operator.FourPowerBuildings]: [],
  };
  // To avoid recalculating federations every time
  federationCache: FederationCache;
  // Did we decline the last offer?
  declined = false;
  // OPTIONAL
  name?: string;
  /** Is the player dropped (i.e. no move) */
  dropped?: boolean;

  constructor(expansion: Expansion = Expansion.None, public player: PlayerEnum = PlayerEnum.Player1) {
    super();
    this.data.on("advance-research", (track, dest) => this.onResearchAdvanced(track, dest, expansion));
  }

  get income() {
    return Reward.toString(this.incomeRewards, true);
  }

  get incomeRewards() {
    return Reward.merge([].concat(...this.events[Operator.Income].map((event) => event.rewards)));
  }

  resourceIncome(resource: ResourceEnum): number {
    return this.incomeRewards.find((r) => r.type === resource)?.count ?? 0;
  }

  get actions() {
    return this.events[Operator.Activate].map((event) => event.action());
  }

  progress(finalTile: FinalTile) {
    return this.eventConditionCount(finalScorings[finalTile].condition);
  }

  get fedValue() {
    return this.eventConditionCount(Condition.StructureFedValue);
  }

  get structureValue() {
    return this.eventConditionCount(Condition.StructureValue);
  }

  get ownedPlanetsCount() {
    return countBy(this.ownedPlanets, "data.planet");
  }

  toJSON() {
    const json = {
      player: this.player,
      faction: this.faction,
      data: this.data,
      settings: this.settings,
      events: this.events,
      name: this.name,
      dropped: this.dropped,
      variant: this.variant && {
        board: this.variant.board,
        version: this.variant.version,
      },
      factionLoaded: !!this.board,
    } as any;

    if (this.federationCache) {
      json.federationCache = {
        availableSatellites: this.federationCache.availableSatellites,
        federations: this.federationCache.federations.map((fedInfo) => ({
          ...fedInfo,
          hexes: fedInfo.hexes.map((h) => h.toString()),
        })),
      };
    }

    return json;
  }

  /**
   * @param board LEGACY Only useful for old games, now loaded directly from data.variant
   */
  static fromData(data: any, map: SpaceMap, board: FactionBoardVariant | null, expansions: Expansion, version: string) {
    const player = new Player(expansions, data.player);

    player.faction = data.faction;

    if (data.variant || data.factionVariant) {
      // Legacy
      if (data.factionVariant) {
        player.variant = {
          board: data.factionVariant,
          version: data.factionVariantVersion,
        };
      } else {
        // Not Legacy
        player.variant = data.variant;
      }
      board = player.variant;
    }

    if (data.faction && (data.factionLoaded || !isVersionOrLater(version, "4.8.4"))) {
      player.loadFaction(board, expansions, true);
    }

    for (const kind of Object.keys(data.events)) {
      player.events[kind] = data.events[kind].map((ev) => new Event(ev));
    }

    player.name = data.name;
    player.dropped = data.dropped;

    if (data.federationCache) {
      player.federationCache = data.federationCache;
      for (const fed of player.federationCache.federations) {
        fed.hexes = ((fed.hexes as any) as string[]).map((hex) => map.getS(hex));
      }
    }

    player.loadPlayerData(data.data);
    player.settings = data.settings ?? player.settings;
    // Legacy value
    if ((player.settings.autoChargePower as AutoCharge | 0) === 0) {
      player.settings.autoChargePower = "decline-cost";
    }

    return player;
  }

  loadPlayerData(data: any) {
    if (data) {
      merge(this.data, data);
    }
  }

  get planet(): Planet {
    return factionPlanet(this.faction);
  }

  payCosts(costs: Reward[], source: EventSource) {
    for (const cost of costs) {
      this.data.gainReward(this.factionReward(cost, source, false), true, source);
    }
  }

  gainRewards(rewards: Reward[], source: EventSource) {
    this.data.gainRewards(
      rewards.map((rew) => this.factionReward(rew, source, true)),
      false,
      source
    );
  }

  maxPayRange(cost: Reward[]): number {
    const costs = Reward.merge(cost);

    for (let max = 0; ; max += 1) {
      for (const rew of costs) {
        if (!this.data.hasResource(new Reward(rew.count * (max + 1), rew.type))) {
          return max;
        }
      }
    }
  }

  hasActiveBooster(type: Resource): boolean {
    return this.events[Operator.Activate].some((e) => !e.activated && e.rewards.some((r) => r.type === type));
  }

  canBuild(
    map: SpaceMap,
    hex: GaiaHex | null,
    targetPlanet: Planet | null,
    building: Building,
    lastRound: boolean,
    replay: boolean,
    {
      isolated,
      addedCost,
      existingBuilding,
    }: { isolated?: boolean; addedCost?: Reward[]; existingBuilding?: Building } = {}
  ): BuildCheck | null {
    if (this.data.buildings[building] >= this.maxBuildings(building)) {
      // Too many buildings of the same kind
      return null;
    }

    if (!addedCost) {
      addedCost = [];
    }

    if (!this.data.canPay(addedCost)) {
      return null;
    }

    const buildActionUsed = this.data.temporaryStep > 0 || this.data.temporaryRange > 0;

    const warnings: BuildWarning[] = [];
    if (
      addedCost.some((c) => c.type === Resource.Qic && c.count > 0) &&
      this.hasActiveBooster(Resource.TemporaryRange) &&
      !buildActionUsed
    ) {
      warnings.push(BuildWarning.rangeBoosterNotUsed);
    }

    let steps = 0;

    // gaiaforming discount
    if (building === Building.GaiaFormer) {
      addedCost.push(new Reward(-this.data.gaiaFormingDiscount(), Resource.MoveTokenToGaiaArea));
    } else if (building === Building.Mine || building === Building.Colony) {
      // habitability costs
      if (targetPlanet === Planet.Gaia) {
        if (this.data.temporaryStep > 0 && !replay) {
          // not allowed - see https://github.com/boardgamers/gaia-project/issues/76
          // OR (for booster) there's no reason to activate the booster and not use it
          return null;
        }

        if (!existingBuilding) {
          // different cost for Gleens
          addedCost.push(this.gaiaFormingCost());
        } else {
          // Already a gaia-former on the planet, so no need to pay a Q.I.C.
        }
      } else {
        // Get the number of terraforming steps to pay discounting terraforming track
        steps = terraformingStepsRequired(factionPlanet(this.faction), targetPlanet);
        const reward = terraformingCost(this.data, steps, replay);

        if (reward === null) {
          return null;
        }

        if (steps > 0 && this.hasActiveBooster(Resource.TemporaryStep) && !buildActionUsed) {
          warnings.push(BuildWarning.stepBoosterNotUsed);
        }
        if (reward.count > 0 && this.data.terraformCostDiscount < 2) {
          warnings.push(BuildWarning.expensiveTerraforming);
        }
        if (this.data.temporaryStep > steps) {
          warnings.push(BuildWarning.stepActionPartiallyWasted);
        }
        addedCost.push(reward);
      }
    }

    const cost = Reward.merge(this.board.cost(building, isolated), addedCost);
    const creditCost = (r: Reward[]) => r.filter((r) => r.type === Resource.Credit)[0].count;
    if (
      building === Building.TradingStation &&
      creditCost(cost) === creditCost(this.board.buildings[Building.TradingStation].isolatedCost)
    ) {
      warnings.push(BuildWarning.expensiveTradingStation);
    }

    const toGaia = cost.find((r) => r.type === Resource.MoveTokenToGaiaArea);
    if (toGaia?.count > this.data.power.area1) {
      warnings.push(BuildWarning.gaiaFormingWithChargedTokens);
    }
    if (building === Building.GaiaFormer && lastRound) {
      warnings.push(BuildWarning.gaiaFormerLastRound);
    }
    if (hex && this.faction !== Faction.Ivits) {
      for (const h of map.withinDistance(hex, 1)) {
        if (h.belongsToFederationOf(this.player)) {
          warnings.push(BuildWarning.buildingWillBePartOfFederation);
          break;
        }
      }
    }

    return !this.data.canPay(cost)
      ? null
      : {
          cost,
          steps,
          warnings,
        };
  }

  maxBuildings(building: Building) {
    switch (building) {
      case Building.GaiaFormer:
        return this.data.gaiaformers - this.data.gaiaformersInGaia;
      case Building.TradeShip:
        return this.data.tradeShips;
      default:
        return this.board.buildings[building].income.length;
    }
  }

  get ownedPlanets(): GaiaHex[] {
    return this.data.occupied.filter((hex) => hex.data.planet !== Planet.Empty && hex.isMainOccupier(this.player));
  }

  loadFaction(board: FactionBoardVariant | null, expansions: Expansion, skipIncome = false) {
    this.variant = {
      board: board?.board,
      version: board?.version,
    };

    this.loadBoard(factionBoard(this.faction, this.variant.board), expansions, skipIncome);
  }

  loadBoard(board: FactionBoard, expansions: Expansion, skipIncome = false, subscribeListeners = true) {
    this.board = board;

    if (!skipIncome) {
      this.gainRewards(this.data.initialPowerRewards(this.board), Phase.BeginGame);
      this.loadTechs(expansions);
      this.loadEvents(this.board.income);
    }

    // Load faction specific code changes
    if (subscribeListeners) {
      for (const eventName of Object.keys(this.board.handlers)) {
        for (const emitter of [this, this.data]) {
          emitter.on(eventName, (...args) => this.board.handlers[eventName](this, ...args));
        }
      }
    }
  }

  loadTechs(expansions: Expansion) {
    const fields = ResearchField.values(expansions);

    for (const field of fields) {
      this.loadEvents(researchEvents(field, this.data.research[field], expansions));
    }
  }

  loadEvents(events: Event[]) {
    for (const event of events) {
      this.loadEvent(event);
    }
  }

  loadEvent(event: Event) {
    // Make sure to not have several of the same event, otherwise with event.activated
    // it is a mess
    this.events[event.operator].push(event.clone());

    if (event.operator === Operator.Once) {
      this.gainRewards(this.eventConditionRewards(event), event.source);
    }
  }

  removeEvents(events: Event[]) {
    for (const event of events) {
      this.removeEvent(event);
    }
  }

  removeEvent(event: Event) {
    // First try same source & same definition
    let index = this.events[event.operator].findIndex((ev) => ev.spec === event.spec && ev.source === event.source);

    // Then try just same definition
    if (index === -1) {
      index = this.events[event.operator].findIndex((ev) => ev.spec === event.spec);
    }

    if (index !== -1) {
      this.events[event.operator].splice(index, 1);
    } else {
      // Commented car still happening for some reason (e g advance research track nav from 3 to 4 regarding q event)
      // assert(index !== -1, "Impossible to remove event " + event.spec);
    }
  }

  removeRoundBoosterEvents(type?: Operator.Income) {
    const events = boosterEvents(this.data.tiles.booster).filter(
      (ev) => (type && ev.operator === Operator.Income) || (!type && ev.operator !== Operator.Income)
    );

    for (const event of events) {
      this.removeEvent(event);
    }
  }

  activateEvent(spec: string) {
    for (const event of this.events[Operator.Activate]) {
      if (event.spec === spec && !event.activated) {
        this.gainRewards(event.rewards, event.source);
        event.activated = true;
        return;
      }
    }
  }

  /**
   * This is managing Income phase to solve +t and +pw ordering
   * It's assuming that each reward belongs to a different event, which has only that reward
   * In case of multiple matches pick the first
   *
   * @param rewards
   */
  receiveIncomeEvent(rewards: Reward[]) {
    for (const rew of rewards) {
      const event = this.events[Operator.Income].find(
        (ev) => !ev.activated && ev.rewards.some((rew2) => Reward.match([rew], [rew2]))
      );

      assert(event);

      this.gainRewards(event.rewards, event.source);
      event.activated = true;
    }
  }

  /**
   * Second parameter is necessary in case someone advances research mutliple times in one go, we don't
   * want to remove multiple green federations for one track
   */
  onResearchAdvanced(field: ResearchField, dest: number, expansion: Expansion) {
    const events = researchEvents(field, dest, expansion);
    this.loadEvents(events);
    const oldEvents = researchEvents(field, dest - 1, expansion);
    this.removeEvents(oldEvents);

    if (dest === lastTile(field)) {
      this.data.removeGreenFederation();
    }

    this.receiveTriggerIncome(Condition.AdvanceResearch);
  }

  build(building: Building, hex: GaiaHex, cost: Reward[], map: SpaceMap, stepsReq?: number) {
    this.payCosts(cost, Command.Build);
    const wasOccupied = this.data.occupied.includes(hex);
    const isNewLostPlanet = hex.data.planet === Planet.Lost && !hex.occupied();

    // excluding Gaiaformers as occupied
    if (building !== Building.GaiaFormer && building !== Building.CustomsPost && !isShip(building)) {
      if (!wasOccupied) {
        this.data.occupied.push(hex);
        // Clear federation cache on new building
        this.federationCache = null;
      }

      if (this.federationCache) {
        assert(wasOccupied, "logic error");

        if (this.buildingValue(hex, { federation: true }) === this.buildingValue(hex, { federation: true, building })) {
          // No need to clear federation cache, when the building value remains the same
        } else if (!hex.belongsToFederationOf(this.player)) {
          this.federationCache = null;
        } else if (this.faction === Faction.Ivits) {
          // Ivits can build a federation with existing federation buildings
          this.federationCache = null;
        }
      }
    }

    // The mine of the lost planet doesn't grant any extra income
    if (isNewLostPlanet) {
      this.data.lostPlanet += 1;
    } else {
      // Add income of the building to the list of events
      this.data.buildings[building] += 1; // NEEDS TO BE BEFORE REWARDS, so gleens can get qic from tech if they build academy 2
    }

    // remove upgraded building and the associated event
    const upgradedBuilding = hex.buildingOf(this.player);
    if (upgradedBuilding && building !== Building.CustomsPost) {
      this.data.buildings[upgradedBuilding] -= 1;
      this.removeEvents(this.board.buildings[upgradedBuilding].income[this.data.buildings[upgradedBuilding]]);
    }

    // NEEDS TO BE AFTER REMOVAL, so the tech ts > 4vp counts the correct number of ts after being upgraded from a lab
    if (!isNewLostPlanet) {
      this.loadEvents(this.board.buildings[building].income[this.data.buildings[building] - 1]);
    }

    // If the planet is already occupied by someone else
    // Lantids
    const isAdditionalMine = !upgradedBuilding && hex.occupied();

    if (isShip(building)) {
      this.placeShip(building, hex);
    } else if (building === Building.CustomsPost) {
      hex.data.customPosts = hex.customPosts.concat(this.player);
    } else {
      if (isAdditionalMine) {
        hex.data.additionalMine = this.player;
        if (this.data.hasPlanetaryInstitute()) {
          this.gainRewards([new Reward("2k")], Faction.Lantids);
        }
      } else {
        hex.data.building = building;
        hex.data.player = this.player;
      }
      this.addBuildingToNearbyFederation(building, hex, map);
    }

    // get triggered income for new building
    this.receiveBuildingTriggerIncome(building, hex.data.planet, isAdditionalMine);

    // get triggerd terffaorming step income for new building
    if (stepsReq) {
      this.receiveTerraformingStepTriggerIncome(stepsReq);
    }

    // Faction-specific code on building
    this.emit(`build-${building}`, hex);
  }

  addBuildingToNearbyFederation(building: Building, hex: GaiaHex, map: SpaceMap): GaiaHex[] {
    const added = [];
    if (building !== Building.GaiaFormer && !hex.belongsToFederationOf(this.player)) {
      const group: GaiaHex[] = this.buildingGroup(hex, map);
      const hasFederation = map.grid.neighbours(hex).some((hx) => hx.belongsToFederationOf(this.player));

      if (hasFederation) {
        for (const h of group) {
          if (h.addToFederationOf(this.player)) {
            added.push(h);
          }
        }
      }
    }
    return added;
  }

  placeShip(ship: Building, hex: GaiaHex) {
    this.data.ships.push({ type: ship, location: hex.toString(), moved: true, player: this.player });
  }

  findUnmovedShip(ship: Building, location: string): Ship | null {
    return this.data.ships.find((s) => s.location === location && s.type === ship && !s.moved);
  }

  removeShip(ship: Ship, destroyed: boolean) {
    const l = this.data.ships;
    l.splice(l.indexOf(ship), 1);
    if (destroyed) {
      this.data.destroyedShips[ship.type]++;
      this.data.buildings[ship.type]--;
    } else {
      this.data.deployedShips[ship.type]++;
    }
  }

  resetTemporaryVariables() {
    // reset temporary benefits
    this.data.temporaryRange = 0;
    this.data.temporaryStep = 0;
  }

  pass() {
    this.receivePassIncome();
    // remove the remaing reward of the round booster events
    this.removeRoundBoosterEvents();
    this.data.tiles.booster = undefined;
  }

  getRoundBooster(roundBooster: Booster) {
    // add the booster to the the player
    this.data.tiles.booster = roundBooster;
    this.loadEvents(boosterEvents(roundBooster));
  }

  gainTechTile(chooseTechTile: ChooseTechTile) {
    const advanced = isAdvanced(chooseTechTile.pos);
    if (advanced) {
      this.data.removeGreenFederation();
    }
    this.data.tiles.techs.push({ ...chooseTechTile, enabled: true });
    this.loadEvents(techTileEvents(chooseTechTile));

    // resets federationCache if Special PA->4pw
    if (chooseTechTile.tile === TechTile.Tech3) {
      this.federationCache = null;
    }
  }

  coverTechTile(pos: TechTilePos) {
    const tile = this.data.tiles.techs.find((tech) => tech.pos === pos);
    tile.enabled = false;

    const events = techTileEvents(tile);
    this.removeEvents(events);

    if (events.some((event) => event.operator === Operator.FourPowerBuildings)) {
      this.federationCache = null;
    }
  }

  incomeSelection(additionalEvents?: Event[]): IncomeSelection {
    return IncomeSelection.create(this.data, this.settings, this.events[Operator.Income], additionalEvents);
  }

  canGaiaTerrans(): boolean {
    return this.data.gaiaPowerTokens() > 0 && this.faction === Faction.Terrans && this.data.hasPlanetaryInstitute();
  }

  canGaiaItars(): boolean {
    return this.data.gaiaPowerTokens() >= 4 && this.faction === Faction.Itars && this.data.hasPlanetaryInstitute();
  }

  canUpgradeResearch(field: ResearchField): boolean {
    // already on top
    if (this.data.research[field] === lastTile(field)) {
      return false;
    }

    // end of the track reached
    const destTile = this.data.research[field] + 1;

    // To go from 4 to 5, we need to flip a federation and nobody inside
    if (keyNeeded(field, destTile) && !this.data.hasGreenFederation()) {
      return false;
    }

    if (this.faction === Faction.BalTaks && !this.data.hasPlanetaryInstitute() && field === ResearchField.Navigation) {
      return false;
    }

    return true;
  }

  receiveIncome(events: Event[]) {
    for (const event of events) {
      if (!event.activated) {
        // Taklons + brainstone need to not activate the event until the reward is gained...
        // This is UGLY. Maybe a better handling of placing ships in income phase would avoid this hack
        if (!event.rewards.some((rew) => rew.type === Resource.ChargePower)) {
          event.activated = true; // before next line, in case it trigger events (like placing ship)
        }
        this.gainRewards(event.rewards, event.source);
        event.activated = true;
      } else {
        // console.log("activated", event.spec);
      }
    }
    // Clean up in a separate phase in case there is an interruption in the first phase
    for (const event of events) {
      event.activated = false;
    }
  }

  passIncomeEvents(): Event[] {
    // this is for pass tile income (e.g. round boosters, adv tiles)
    return this.events[Operator.Pass].map(
      (event) => new Event(this.eventConditionRewards(event).join(","), event.source)
    );
  }

  eventConditionRewards(event: Event): Reward[] {
    const times = this.eventConditionCount(event.condition);
    return event.rewards.map((reward) => new Reward(reward.count * times, reward.type));
  }

  receivePassIncome() {
    for (const e of this.passIncomeEvents()) {
      this.gainRewards(e.rewards, e.source);
    }
  }

  receiveBuildingTriggerIncome(building: Building, planet: Planet, isAdditionalMine: boolean) {
    // this is for roundboosters, techtiles and adv tile
    for (const event of this.events[Operator.Trigger]) {
      // only new mine trigger event for Lantids in other's planet
      if (
        Condition.matchesBuilding(event.condition, building, planet) &&
        (!isAdditionalMine || event.condition === Condition.Mine)
      ) {
        this.gainRewards(event.rewards, event.source);
      }
    }
  }

  receiveTriggerIncome(condition: Condition) {
    for (const event of this.events[Operator.Trigger]) {
      if (event.condition === condition) {
        this.gainRewards(event.rewards, event.source);
      }
    }
  }

  receiveTerraformingStepTriggerIncome(stepsReq: number) {
    for (const event of this.events[Operator.Trigger]) {
      if (event.condition === Condition.TerraformStep) {
        this.gainRewards(
          event.rewards.map((rw) => new Reward(rw.count * stepsReq, rw.type)),
          event.source
        );
      }
    }
  }

  finalCount(tile: FinalTile): number {
    return this.eventConditionCount(finalScorings[tile].condition);
  }

  gaiaPhaseEnd() {
    if (this.data.brainstone === PowerArea.Gaia) {
      this.data.brainstone = PowerArea.Area1;
      this.gainRewards([new Reward(1, Resource.Brainstone)], Phase.RoundGaia);
    }

    const gaia = this.data.power.gaia;
    if (gaia > 0) {
      this.gainRewards([new Reward(gaia, Resource.MoveTokenFromGaiaAreaToArea1)], Phase.RoundGaia);
    }

    if (this.data.gaiaformersInGaia > 0) {
      this.gainRewards(
        [new Reward(this.data.gaiaformersInGaia, Resource.MoveGaiaFormerFromGaiaAreaToArea1)],
        Phase.RoundGaia
      );
    }
  }

  buildingValue(
    hex?: GaiaHex,
    options?: {
      federation?: boolean;
      building?: Building;
      hasPlanetaryInstitute?: boolean;
      hasSpecialOperator?: boolean;
    }
  ) {
    const building = options?.building ?? hex.buildingOf(this.player);
    const forFederation = options?.federation ?? false;

    if (forFederation) {
      switch (building) {
        case Building.SpaceStation:
          return 1;
        case Building.CustomsPost:
          return 0;
      }
    }

    let baseValue = stdBuildingValue(building);

    // Space stations and gaia-formers can't get leech when someone makes a structure nearby
    if (baseValue === 0) {
      return 0;
    }

    const hasSpecialOperator = options?.hasSpecialOperator ?? this.events[Operator.FourPowerBuildings].length > 0;
    if (baseValue === 3 && hasSpecialOperator) {
      baseValue = 4;
    }

    const hasPlanetaryInstitute = options?.hasPlanetaryInstitute ?? this.data.hasPlanetaryInstitute();
    const addedBescods =
      this.faction === Faction.Bescods && hasPlanetaryInstitute && hex?.data?.planet === Planet.Titanium ? 1 : 0;

    return baseValue + addedBescods;
  }

  maxLeech(extraPowerToken?: boolean): number {
    return this.data.maxLeech(this.data.leechPossible, extraPowerToken).value;
  }

  canLeech(): boolean {
    if (!this.data.leechPossible) {
      return false;
    }

    /* Taklons can always charge power, just to gain the PI power token */
    if (this.faction === Faction.Taklons && this.data.hasPlanetaryInstitute()) {
      return true;
    }

    return !!this.data.chargePower(1, false);
  }

  gainFederationToken(federation: Federation) {
    this.data.tiles.federations.push({
      tile: federation,
      green: isGreen(federation),
    });

    this.gainRewards(federationRewards(federation), Command.FormFederation);
    this.receiveTriggerIncome(Condition.Federation);
  }

  factionReward(reward: Reward, source: EventSource, gleensQic: boolean): Reward {
    if (this.faction === Faction.Terrans && reward.type === Resource.GainTokenGaiaArea) {
      return new Reward(-reward.count, Resource.MoveTokenFromGaiaAreaToArea1);
    }
    // this is for Gleens getting ore instead of qics until Academy2
    if (
      gleensQic &&
      source !== Phase.BeginGame &&
      this.faction === Faction.Gleens &&
      this.data.buildings[Building.Academy2] === 0 &&
      reward.type === Resource.Qic
    ) {
      return new Reward(reward.count, Resource.Ore);
    }
    return reward;
  }

  /**
   * Additional cost to pay to transform a gaia planet into an habitable planet
   */
  gaiaFormingCost(): Reward {
    if (this.faction === Faction.Gleens) {
      return new Reward(1, Resource.Ore);
    }
    return new Reward(1, Resource.Qic);
  }

  eventConditionCount(condition: Condition): number {
    switch (condition) {
      case Condition.None:
        return 1;
      case Condition.Mine:
        return this.data.buildings[Building.Mine] + this.data.lostPlanet;
      case Condition.TradingStation:
        return this.data.buildings[Building.TradingStation];
      case Condition.ResearchLab:
        return this.data.buildings[Building.ResearchLab];
      case Condition.BigBuilding:
        return (
          this.data.buildings[Building.Academy1] +
          this.data.buildings[Building.Academy2] +
          this.data.buildings[Building.PlanetaryInstitute] +
          this.data.buildings[Building.Colony]
        );
      case Condition.Federation:
        return this.data.tiles.federations.length;
      case Condition.Gaia:
        return this.ownedPlanets.filter((hex) => hex.data.planet === Planet.Gaia).length;
      case Condition.PlanetType:
        return uniq(this.ownedPlanets.map((hex) => hex.data.planet)).length;
      case Condition.Sector:
        return uniq(this.data.occupied.filter((hex) => hex.colonizedBy(this.player)).map((hex) => hex.data.sector))
          .length;
      case Condition.Structure:
        return this.data.occupied.filter((hex) => hex.colonizedBy(this.player)).length;
      case Condition.StructureFed:
        return this.data.occupied.filter(
          (hex) => hex.colonizedBy(this.player) && hex.belongsToFederationOf(this.player)
        ).length;
      case Condition.Satellite:
        return this.data.satellites + this.data.buildings[Building.SpaceStation];
      case Condition.StructureValue:
        return sum(this.data.occupied.map((hex) => this.buildingValue(hex, { federation: true })));
      case Condition.StructureFedValue:
        return sum(
          this.data.occupied.map((hex) =>
            hex.belongsToFederationOf(this.player) ? this.buildingValue(hex, { federation: true }) : 0
          )
        );
      case Condition.AdvanceResearch:
        return sum(Object.values(this.data.research));
      case Condition.HighestResearchLevel:
        return Math.max(...Object.values(this.data.research));
    }

    return 0;
  }

  notifyOfNewPlanet(hexOfPlanet: GaiaHex) {
    if (this.federationCache) {
      if (this.federationCache.federations.some((fed) => fed.hexes.some((hex) => hex === hexOfPlanet))) {
        this.federationCache = null;
      }
    }
  }

  availableFederations(map: SpaceMap, flexible: boolean): FederationInfo[] {
    const maxSatellites = this.maxSatellites;
    let custom = false;

    if (this.federationCache) {
      if (maxSatellites <= this.federationCache.availableSatellites) {
        return this.federationCache.federations.filter((fed) => fed.newSatellites <= maxSatellites);
      } else {
        // Only try federations with building combinations not in federationCache.federations
      }
    }

    const excluded = map.excludedHexesForBuildingFederation(this.player, this.faction);

    const hexes = this.data.occupied.filter((hex) => !excluded.has(hex));

    const buildingGroups = this.buildingGroups(hexes, map);
    const buildingGroupsList = uniq([...buildingGroups.values()]);
    const values = buildingGroupsList.map((buildings) =>
      sum(buildings.map((node) => this.buildingValue(node, { federation: true })))
    );

    let combinations = this.possibleCombinationsForFederations(
      zipWith(buildingGroupsList, values, (val1, val2) => ({ hexes: val1, value: val2 }))
    );

    // Ivits can only expand their first federation
    if (this.faction === Faction.Ivits && this.data.federationCount > 0) {
      combinations = combinations.filter((combination) =>
        combination.some((hexList) => hexList[0].belongsToFederationOf(this.player))
      );
    }

    // We now have several combinations of buildings that can form federations
    // We need to see if they can be connected
    const federations: GaiaHex[][] = [];
    const occupiedSet = new Set(this.data.occupied);

    for (const combination of combinations) {
      const destGroups = combination;
      const buildingsInDestGroups: Set<GaiaHex> = new Set([].concat(...destGroups));
      // Create a new grid. The following are removed:
      // - hexes in a federation or nearby a federation
      // - hexes belonging to a building group not part of combination, or adjacent to them (only in flexible mode)
      //
      // Because of this second constraint, we do avoid some valid possibilites.
      // However, those possibilites are explored in another combination
      const flexibleExcluded: Set<GaiaHex> = new Set(
        [].concat(
          ...this.data.occupied.map((hex) => (buildingsInDestGroups.has(hex) ? [] : [hex, ...map.grid.neighbours(hex)]))
        )
      );
      const allHexes = [...map.grid.values()].filter(
        (hex) => !excluded.has(hex) && (!flexible || !flexibleExcluded.has(hex))
      );
      const workingGrid = new Grid<Hex<{ cost: number }>>(
        ...allHexes.map(
          (hex) =>
            new Hex(hex.q, hex.r, { cost: occupiedSet.has(hex) || hex.belongsToFederationOf(this.player) ? 0 : 1 })
        )
      );
      const convertedDestGroups = destGroups.map((destGroup) => destGroup.map((hex) => workingGrid.get(hex)));
      let tree = spanningTree(convertedDestGroups, workingGrid, maxSatellites, "heuristic", (hex) => hex.data.cost);

      if ("path" in tree && !flexible && flexibleExcluded.size > 0) {
        // In non flexible mode, we still try to suggest federations without extra planets, as long
        // as they don't add additional satellites
        const allHexes = [...map.grid.values()].filter((hex) => !excluded.has(hex) && !flexibleExcluded.has(hex));
        const workingGrid = new Grid<Hex<{ cost: number }>>(
          ...allHexes.map(
            (hex) =>
              new Hex(hex.q, hex.r, { cost: occupiedSet.has(hex) || hex.belongsToFederationOf(this.player) ? 0 : 1 })
          )
        );
        const convertedDestGroups = destGroups.map((destGroup) => destGroup.map((hex) => workingGrid.get(hex)));
        const treeWithoutOtherPlanets = spanningTree(
          convertedDestGroups,
          workingGrid,
          maxSatellites,
          "heuristic",
          (hex) => hex.data.cost
        );

        if ("path" in treeWithoutOtherPlanets && treeWithoutOtherPlanets.cost <= tree.cost) {
          tree = treeWithoutOtherPlanets;
        }
      }

      if ("path" in tree) {
        // Convert from regular hex to gaia hex of grid
        federations.push(
          this.addAdjacentBuildings(
            tree.path.map((hex) => map.grid.get(hex)),
            map
          )
        );
      } else if (
        tree.minCost <= maxSatellites &&
        ((maxSatellites >= 7 && combination.length >= 4) || this.faction === Faction.Ivits)
      ) {
        // In some cases the heuristic goes wrong, so we still offer the player the possibility to manually
        // specify the federation
        custom = true;
      }
    }

    const uniqFederations = uniqWith(federations, (fed1, fed2) => {
      const fed1coords = fed1
        .map((x) => x.toString())
        .sort()
        .join(",");
      const fed2coords = fed2
        .map((x) => x.toString())
        .sort()
        .join(",");

      return fed1coords === fed2coords;
    });

    const fedsWithInfo: FederationInfo[] = uniqFederations.map((federation) => this.federationInfo(federation));

    // Remove federations with one more planet & one more satellite
    // Also remove federations containing another
    const toRemove: FederationInfo[] = [];
    for (const fed of fedsWithInfo) {
      for (const comparison of fedsWithInfo) {
        if (comparison !== fed && isOutclassedBy(fed, comparison)) {
          toRemove.push(fed);
          break;
        }
      }
    }

    const feds = difference(fedsWithInfo, toRemove);

    this.federationCache = {
      availableSatellites: maxSatellites,
      federations: feds,
      custom: custom && feds.length === 0,
    };

    return feds;
  }

  get maxSatellites() {
    const maxNumber = MAX_SATELLITES - this.data.satellites;

    if (this.faction === Faction.Ivits) {
      return Math.min(this.data.qics, maxNumber);
    } else {
      return Math.min(this.data.discardablePowerTokens(), maxNumber);
    }
  }

  federationInfo(hexes: GaiaHex[]): FederationInfo {
    // Be careful of Ivits & space stations for nSatellites!
    const satellites = hexes.filter((hex) => !hex.occupyingPlayers()?.includes(this.player));
    const nPlanets = hexes.filter((hex) => hex.colonizedBy(this.player)).length;

    // Get the power value of the buildings
    const powerValue = sum(hexes.map((hex) => this.buildingValue(hex, { federation: true })));

    const newSatellites = satellites.filter((sat) => !sat.belongsToFederationOf(this.player)).length;
    return {
      hexes: hexes,
      satellites: satellites.length,
      newSatellites: newSatellites,
      planets: nPlanets,
      powerValue: powerValue,
    };
  }

  formFederation(hexes: GaiaHex[], token: Federation) {
    let newSatellites = 0;
    for (const hex of hexes) {
      // Second test is for ivits
      if (hex.buildingOf(this.player) === undefined && !hex.belongsToFederationOf(this.player)) {
        newSatellites += 1;
      }
      hex.addToFederationOf(this.player);
    }
    this.payCosts(
      [new Reward(newSatellites, this.faction === Faction.Ivits ? Resource.Qic : Resource.GainToken)],
      Command.FormFederation
    );
    this.data.satellites += newSatellites;
    this.gainFederationToken(token);
    this.data.federationCount += 1;
    this.federationCache = null;
  }

  checkAndGetFederationInfo(location: string, map: SpaceMap, flexible: boolean, replay: boolean): FederationInfo {
    const hexes = this.hexesForFederationLocation(location, map);

    // Check if no forbidden square
    const excluded = map.excludedHexesForBuildingFederation(this.player, this.faction);
    for (const hex of hexes) {
      assert(!excluded.has(hex), `${hex.toString()} can't be part of a new federation`);
    }

    // Check if all the buildings are in one group
    assert(map.grid.groups(hexes).length === 1, "The hexes of the federation must be adjacent");

    const info = this.federationInfo(hexes);
    assert(
      info.powerValue >= this.federationCost,
      "Your buildings need to have a total value of at least " + this.federationCost
    );

    if (replay) {
      return info;
    }

    assert(info.newSatellites <= this.maxSatellites, "Federation requires too many satellites");

    // Check if outclassed by available federations
    const available = this.availableFederations(map, flexible);
    const outclasser = available.find((fed) => isOutclassedBy(info, fed));

    assert(!outclasser, "Federation is outclassed by other federation at " + (outclasser?.hexes ?? []).join(","));

    // Check if federation can be built with fewer satellites
    if (!flexible) {
      const allHexes = [...map.grid.values()].filter((hex) => !excluded.has(hex));

      const occupiedSet = new Set(this.data.occupied);
      const workingGrid = new Grid<Hex<{ cost: number }>>(
        ...allHexes.map(
          (hex) =>
            new Hex(hex.q, hex.r, {
              cost: occupiedSet.has(hex) || hex.belongsToFederationOf(this.player) ? 0 : 1,
            })
        )
      );
      const allGroups = [
        ...this.buildingGroups(
          hexes.filter(
            (hx) => hx.belongsToFederationOf(this.player) || this.buildingValue(hx, { federation: true }) > 0
          ),
          map
        ).values(),
      ];
      const groups: GaiaHex[][] = uniq(allGroups);
      const convertedDestGroups = groups.map((destGroup) => destGroup.map((hex) => workingGrid.get(hex)));

      const tree = spanningTree(convertedDestGroups, workingGrid, info.satellites, "heuristic", (hex) => hex.data.cost);

      if ("path" in tree) {
        const path = tree.path.map((hex) => map.grid.get(hex));
        const smallFederation = this.addAdjacentBuildings(path, map);
        const info2 = this.federationInfo(smallFederation);
        assert(
          info2.satellites >= info.satellites,
          "The federation can be built with fewer satellites, for example: " + path.join(",")
        );
      }
    }

    assert(
      this.faction !== Faction.Ivits ||
        this.data.federationCount === 0 ||
        hexes.some((hex) => hex.belongsToFederationOf(this.player)),
      "Ivits must extend their first federation"
    );

    return info;
  }

  hexesForFederationLocation(location: string, map: SpaceMap): GaiaHex[] {
    const hexes = parseFederationLocation(location, map);

    if (this.faction !== Faction.Ivits) {
      const max = MAX_SATELLITES + this.federationCost;
      assert(hexes.length <= max, `The federation is too big, it is impossible to build with only ${max} satellites`);
    }

    // Extend to nearby buildings
    return this.addAdjacentBuildings(hexes, map);
  }

  get federationCost(): number {
    return federationCost(this.faction, this.data.hasPlanetaryInstitute(), this.data.federationCount);
  }

  possibleCombinationsForFederations(
    nodes: Array<{ hexes: GaiaHex[]; value: number }>,
    toReach = this.federationCost
  ): GaiaHex[][][] {
    const ret: GaiaHex[][][] = [];

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].value === 0) {
        continue;
      }

      if (nodes[i].value >= toReach) {
        ret.push([nodes[i].hexes]);
        continue;
      }

      for (const possibility of this.possibleCombinationsForFederations(nodes.slice(i + 1), toReach - nodes[i].value)) {
        possibility.push(nodes[i].hexes);
        ret.push(possibility);
      }
    }

    return ret;
  }

  buildingGroups(hexes = this.data.occupied, map: SpaceMap): Map<GaiaHex, GaiaHex[]> {
    const groups: Map<GaiaHex, GaiaHex[]> = new Map();

    for (const hexWithbuilding of hexes) {
      if (groups.has(hexWithbuilding)) {
        continue;
      }
      const group = this.buildingGroup(hexWithbuilding, map);
      for (const hex of group) {
        groups.set(hex, group);
      }
    }

    return groups;
  }

  buildingGroup(hex: GaiaHex, map: SpaceMap): GaiaHex[] {
    const ret = [];

    const addHex = (hx: GaiaHex) => {
      ret.push(hx);
      for (const hx2 of map.grid.neighbours(hx)) {
        if (!ret.includes(hx2)) {
          if ((hx2.belongsToFederationOf(this.player) || this.buildingValue(hx2, { federation: true })) > 0) {
            addHex(hx2);
          } else if (
            this.faction === Faction.Ivits &&
            hx2.belongsToFederationOf(this.player) &&
            hx.belongsToFederationOf(this.player)
          ) {
            // For ivits, if two hexes belong to a federation they are in
            // the same building group, e.g. even satellites can belong to
            // a building group
            addHex(hx2);
          }
        }
      }
    };

    addHex(hex);
    return ret;
  }

  addAdjacentBuildings(hexes: GaiaHex[], map: SpaceMap): GaiaHex[] {
    return uniq([].concat(...hexes.map((hex) => this.buildingGroup(hex, map))));
  }

  /**
   * Check if player can build there, regardless of cost
   * @param hex
   */
  canOccupy(hex: GaiaHex) {
    if (hex.colonizedBy(this.player)) {
      return false;
    }
    if (!hex.hasPlanet()) {
      return false;
    }
    if (hex.data.player !== undefined) {
      // If it's already occupied by another player and we aren't lantids
      if (this.faction !== Faction.Lantids) {
        return false;
      }
      // If the player that occupies the planet didn't colonize it yet,
      // for example if there is a gaia former there, lantids can't place
      // their additional mine
      if (!hex.colonizedBy(hex.data.player)) {
        return false;
      }
    }
    return true;
  }
}
