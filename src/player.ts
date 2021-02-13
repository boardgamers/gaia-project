import {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  BrainstoneArea,
  Building,
  Command,
  Condition,
  Faction,
  Federation,
  FinalTile,
  Operator,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Resource,
  TechTile,
  TechTilePos,
} from "./enums";
import PlayerData from "./player-data";
import Event, { EventSource, TechPos } from "./events";
import { factionBoard, FactionBoard } from "./faction-boards";
import { countBy, difference, merge, sum, uniq, uniqWith, zipWith } from "lodash";
import factions from "./factions";
import Reward from "./reward";
import { Grid, Hex } from "hexagrid";
import researchTracks, { keyNeeded, lastTile } from "./research-tracks";
import { terraformingStepsRequired } from "./planets";
import boosts from "./tiles/boosters";
import { stdBuildingValue } from "./buildings";
import SpaceMap from "./map";
import { GaiaHex } from "./gaia-hex";
import spanningTree from "./algorithms/spanning-tree";
import { FederationInfo, isOutclassedBy } from "./federation";
import federationTiles, { isGreen } from "./tiles/federations";
import { EventEmitter } from "eventemitter3";
import { finalScorings } from "./tiles/scoring";
import techs, { isAdvanced } from "./tiles/techs";
import assert from "assert";

const TERRAFORMING_COST = 3;
// 25 satellites total
// The 2 used on the final scoring board and 1 used in the player order can be replaced by other markers
const MAX_SATELLITES = 25;

interface FederationCache {
  federations: FederationInfo[];
  availableSatellites: number;
  /** Do we allow custom federations even if there are no possible federations detected by the algorithm? */
  custom: boolean;
}

class IncomeSelection {
  constructor(
    private readonly gainTokens: Event[],
    private readonly chargePowers: Event[],
    private readonly data: PlayerData
  ) {}

  get events(): Event[] {
    return this.gainTokens.concat(this.chargePowers);
  }

  get needed(): boolean {
    return this.gainTokens.length > 0 && this.chargePowers.length > 0;
  }

  get descs(): Reward[] {
    return [
      ...this.gainTokens.map((ev) => ev.rewards.find((rw) => rw.type === Resource.GainToken)),
      ...this.chargePowers.map((ev) => ev.rewards.find((rw) => rw.type === Resource.ChargePower)),
    ];
  }

  get canFullyChargeDuringIncomePhase(): boolean {
    //there's no event emitter in the clone
    const d = this.data.clone();
    for (const gainToken of this.gainTokens) {
      d.gainRewards(gainToken.rewards, true, null);
    }
    for (const chargePower of this.chargePowers) {
      d.gainRewards(chargePower.rewards, true, null);
    }
    if (d.brainstone != null && d.brainstone != BrainstoneArea.Area3) {
      return false;
    }
    return d.power.area1 === 0 && d.power.area2 === 0;
  }
}

export default class Player extends EventEmitter {
  faction: Faction = null;
  board: FactionBoard = null;
  data: PlayerData = new PlayerData();
  events: { [key in Operator]: Event[] } = {
    [Operator.Once]: [],
    [Operator.Income]: [],
    [Operator.Trigger]: [],
    [Operator.Activate]: [],
    [Operator.Pass]: [],
    [Operator.Special]: [],
  };
  // To avoid recalculating federations every time
  federationCache: FederationCache;
  // Did we decline the last offer?
  declined = false;
  // OPTIONAL
  name?: string;
  /** Is the player dropped (i.e. no move) */
  dropped?: boolean;

  constructor(public player: PlayerEnum = PlayerEnum.Player1) {
    super();
    this.data.on("advance-research", (track, dest) => this.onResearchAdvanced(track, dest));
  }

  get income() {
    return Reward.toString(
      Reward.merge([].concat(...this.events[Operator.Income].map((event) => event.rewards))),
      true
    );
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
      events: this.events,
      name: this.name,
      dropped: this.dropped,
    } as any;

    if (this.federationCache) {
      json.federationCache = {
        availableSatellites: this.federationCache.availableSatellites,
        federations: this.federationCache.federations.map((fedInfo) => ({
          planets: fedInfo.planets,
          satellites: fedInfo.satellites,
          hexes: fedInfo.hexes.map((h) => h.toString()),
        })),
      };
    }

    return json;
  }

  static fromData(data: any, map: SpaceMap, expansions: number) {
    const player = new Player(data.player);

    if (data.faction) {
      player.loadFaction(data.faction, expansions, true);
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

    return player;
  }

  loadPlayerData(data: any) {
    if (data) {
      merge(this.data, data);
    }
  }

  get planet(): Planet {
    return factions.planet(this.faction);
  }

  payCosts(costs: Reward[], source: EventSource) {
    for (const cost of costs) {
      this.data.payCost(cost, source);
    }
  }

  gainRewards(rewards: Reward[], source: EventSource, toPick = 0) {
    if (toPick) {
      this.data.toPick = { count: toPick, rewards: [...rewards], source };
      this.emit("pick-rewards");
    } else {
      this.data.gainRewards(
        rewards.map((rew) => this.factionReward(rew)),
        false,
        source
      );
    }
  }

  canPay(reward: Reward[]): boolean {
    const rewards = Reward.merge(reward);

    for (const rew of rewards) {
      if (!this.data.hasResource(rew)) {
        return false;
      }
    }
    return true;
  }

  maxPayRange(reward: Reward[]): number {
    const rewards = Reward.merge(reward);

    for (let max = 0; ; max += 1) {
      for (const rew of rewards) {
        if (!this.data.hasResource(new Reward(rew.count * (max + 1), rew.type))) {
          return max;
        }
      }
    }
  }

  canBuild(
    targetPlanet: Planet,
    building: Building,
    {
      isolated,
      addedCost,
      existingBuilding,
    }: { isolated?: boolean; addedCost?: Reward[]; existingBuilding?: Building } = {}
  ): { cost?: Reward[]; possible: boolean; steps?: number } {
    if (this.data.buildings[building] >= this.maxBuildings(building)) {
      // Too many buildings of the same kind
      return { possible: false };
    }

    if (!addedCost) {
      addedCost = [];
    }

    if (!this.canPay(addedCost)) {
      return { possible: false };
    }

    let steps = 0;

    // gaiaforming discount
    if (building === Building.GaiaFormer) {
      addedCost.push(new Reward(-this.data.gaiaFormingDiscount(), Resource.MoveTokenToGaiaArea));
    } else if (building === Building.Mine) {
      // habitability costs
      if (targetPlanet === Planet.Gaia) {
        if (!existingBuilding) {
          // different cost for Gleens
          addedCost.push(this.gaiaFormingCost());
        } else {
          // Already a gaia-former on the planet, so no need to pay a Q.I.C.
        }
      } else {
        // Get the number of terraforming steps to pay discounting terraforming track
        steps = terraformingStepsRequired(factions[this.faction].planet, targetPlanet);
        addedCost.push(
          new Reward(
            (TERRAFORMING_COST - this.data.terraformCostDiscount) * Math.max(steps - this.data.temporaryStep, 0),
            Resource.Ore
          )
        );
      }
    }

    const cost = Reward.merge(this.board.cost(targetPlanet, building, isolated), addedCost);

    if (!this.canPay(cost)) {
      return { possible: false };
    }
    return {
      possible: true,
      cost,
      steps,
    };
  }

  maxBuildings(building: Building) {
    return building === Building.GaiaFormer
      ? this.data.gaiaformers - this.data.gaiaformersInGaia
      : this.board.buildings[building].income.length;
  }

  get ownedPlanets(): GaiaHex[] {
    return this.data.occupied.filter((hex) => hex.data.planet !== Planet.Empty && hex.isMainOccupier(this.player));
  }

  loadFaction(faction: Faction, expansions: number, skipIncome = false) {
    this.faction = faction;
    this.board = factionBoard(faction);

    if (!skipIncome) {
      this.loadTechs(expansions);
      this.loadEvents(this.board.income);
    }

    this.data.power.area1 = this.board.power.area1;
    this.data.power.area2 = this.board.power.area2;
    this.data.brainstone = this.board.brainstone;

    // Load faction specific code changes
    for (const eventName of Object.keys(this.board.handlers)) {
      for (const emitter of [this, this.data]) {
        emitter.on(eventName, (...args) => this.board.handlers[eventName](this, ...args));
      }
    }
  }

  loadTechs(expansions: number) {
    const fields = ResearchField.values(expansions);

    for (const field of fields) {
      this.loadEvents(Event.parse(researchTracks[field][this.data.research[field]], field));
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
      const times = this.eventConditionCount(event.condition);
      this.gainRewards(
        event.rewards.map((reward) => new Reward(reward.count * times, reward.type)),
        event.source,
        event.toPick
      );
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
    let eventList = Event.parse(boosts[this.data.tiles.booster], this.data.tiles.booster);
    eventList = eventList.filter(
      (ev) => (type && ev.operator === Operator.Income) || (!type && ev.operator !== Operator.Income)
    );

    for (const event of eventList) {
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

  receiveIncomeEvent(rewards: Reward[]) {
    // this is managing Income phase to solve +t and +pw ordering
    // it's assuming that each reward belongs to a different event, which has only that reward
    // in case of multiple matchings pick the first
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
  onResearchAdvanced(field: ResearchField, dest: number) {
    const events = Event.parse(researchTracks[field][dest], field);
    this.loadEvents(events);
    const oldEvents = Event.parse(researchTracks[field][dest - 1], field);
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
    if (building !== Building.GaiaFormer) {
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
    if (!isNewLostPlanet) {
      // Add income of the building to the list of events
      this.data.buildings[building] += 1; // NEEDS TO BE BEFORE REWARDS, so gleens can get qic from tech if they build academy 2
    } else {
      this.data.lostPlanet += 1;
    }

    // remove upgraded building and the associated event
    const upgradedBuilding = hex.buildingOf(this.player);
    if (upgradedBuilding) {
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

    if (isAdditionalMine) {
      hex.data.additionalMine = this.player;
      if (this.data.hasPlanetaryInstitute()) {
        this.data.gainRewards([new Reward("2k")]);
      }
    } else {
      hex.data.building = building;
      hex.data.player = this.player;
    }

    // Add to nearby federation
    if (building !== Building.GaiaFormer && !hex.belongsToFederationOf(this.player)) {
      const group: GaiaHex[] = this.buildingGroup(hex, map);
      const hasFederation = map.grid.neighbours(hex).some((hx) => hx.belongsToFederationOf(this.player));

      if (hasFederation) {
        for (const h of group) {
          h.addToFederationOf(this.player);
        }
      }
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
    this.loadEvents(Event.parse(boosts[roundBooster], roundBooster));
  }

  gainTechTile(tile: TechTile | AdvTechTile, pos: TechTilePos | AdvTechTilePos) {
    const advanced = isAdvanced(pos);
    if (advanced) {
      this.data.removeGreenFederation();
    }
    this.data.tiles.techs.push({ tile, pos, enabled: true });
    this.loadEvents(Event.parse(techs[tile], !advanced ? (`tech-${pos}` as TechPos) : (pos as AdvTechTilePos)));

    // resets federationCache if Special PA->4pw
    if (tile === TechTile.Tech3) {
      this.federationCache = null;
    }
  }

  coverTechTile(pos: TechTilePos) {
    const tile = this.data.tiles.techs.find((tech) => tech.pos === pos);
    tile.enabled = false;
    this.removeEvents(Event.parse(techs[tile.tile], `tech-${pos}` as TechPos));
  }

  needIncomeSelection(): IncomeSelection {
    // we need to check if rewards contains Resource.GainToken and Resource.GainPower
    // player has to select the order
    const allEvents = this.events[Operator.Income].filter((ev) => !ev.activated);

    const gainTokens = allEvents.filter((ev) => ev.rewards.some((rw) => rw.type === Resource.GainToken));
    const chargePowers = allEvents.filter((ev) => ev.rewards.some((rw) => rw.type === Resource.ChargePower));

    return new IncomeSelection(gainTokens, chargePowers, this.data);
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

  receiveIncome() {
    for (const event of this.events[Operator.Income]) {
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
    for (const event of this.events[Operator.Income]) {
      event.activated = false;
    }
  }

  receivePassIncome() {
    // this is for pass tile income (e.g. round boosters, adv tiles)
    for (const event of this.events[Operator.Pass]) {
      const times = this.eventConditionCount(event.condition);
      this.gainRewards(
        event.rewards.map((reward) => new Reward(reward.count * times, reward.type)),
        event.source
      );
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
        this.gainRewards(event.rewards, event.source, event.toPick);
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

  gaiaPhase() {
    /* Move gaia power tokens to regular power areas */
    this.emit("gaiaPhase-beforeTokenMove");

    this.data.power.area1 += this.data.power.gaia;
    if (this.data.brainstone === BrainstoneArea.Gaia) {
      this.data.brainstone = BrainstoneArea.Area1;
    }

    this.data.power.gaia = 0;
    this.data.gaiaformersInGaia = 0;
  }

  buildingValue(hex: GaiaHex, options?: { federation?: boolean; building?: Building }) {
    const building = options?.building ?? hex.buildingOf(this.player);
    const forFederation = options?.federation ?? false;

    if (forFederation && building === Building.SpaceStation) {
      return 1;
    }

    let baseValue = stdBuildingValue(building);

    // Space stations and gaia-formers can't get leech when someone makes a structure nearby
    if (baseValue === 0) {
      return 0;
    }

    if (baseValue === 3 && this.events[Operator.Special].length > 0) {
      baseValue = 4;
    }

    const addedBescods =
      this.faction === Faction.Bescods &&
      this.data.buildings[Building.PlanetaryInstitute] === 1 &&
      hex.data.planet === Planet.Titanium
        ? 1
        : 0;

    return baseValue + addedBescods;
  }

  maxLeech(extraPowerToken?: boolean) {
    // considers real chargeable power and victory points
    return Math.min(
      this.data.leechPossible,
      this.data.chargePower(this.data.leechPossible, false) + (extraPowerToken ? 2 : 0),
      this.data.victoryPoints + 1
    );
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

    this.gainRewards(Reward.parse(federationTiles[federation]), Command.FormFederation);
    this.receiveTriggerIncome(Condition.Federation);
  }

  factionReward(reward: Reward): Reward {
    // this is for Gleens getting ore instead of qics until Academy2
    if (
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
      case Condition.PlanetaryInstituteOrAcademy:
        return (
          this.data.buildings[Building.Academy1] +
          this.data.buildings[Building.Academy2] +
          this.data.buildings[Building.PlanetaryInstitute]
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

  availableFederations(map: SpaceMap, flexible: boolean): FederationInfo[] {
    const maxSatellites = this.maxSatellites;
    let custom = false;

    if (this.federationCache) {
      if (maxSatellites <= this.federationCache.availableSatellites) {
        return this.federationCache.federations.filter((fed) => fed.satellites <= maxSatellites);
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

    // The current algorithm is not all-knowing, so in some cases we allow player to generate their own federation
    if (values.length >= 6 && maxSatellites >= 8) {
      const sorted = [...values].sort().slice(0, 6);

      if (sum(sorted) <= this.federationCost && sum(values) >= this.federationCost) {
        custom = true;
      }
    }

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
        ...allHexes.map((hex) => new Hex(hex.q, hex.r, { cost: occupiedSet.has(hex) ? 0 : 1 }))
      );
      const convertedDestGroups = destGroups.map((destGroup) => destGroup.map((hex) => workingGrid.get(hex)));
      let tree = spanningTree(convertedDestGroups, workingGrid, maxSatellites, "heuristic", (hex) => hex.data.cost);

      if (tree && !flexible && flexibleExcluded.size > 0) {
        // In non flexible mode, we still try to suggest federations without extra planets, as long
        // as they don't add additional satellites
        const allHexes = [...map.grid.values()].filter((hex) => !excluded.has(hex) && !flexibleExcluded.has(hex));
        const workingGrid = new Grid<Hex<{ cost: number }>>(
          ...allHexes.map((hex) => new Hex(hex.q, hex.r, { cost: occupiedSet.has(hex) ? 0 : 1 }))
        );
        const convertedDestGroups = destGroups.map((destGroup) => destGroup.map((hex) => workingGrid.get(hex)));
        const treeWithoutOtherPlanets = spanningTree(
          convertedDestGroups,
          workingGrid,
          maxSatellites,
          "heuristic",
          (hex) => hex.data.cost
        );

        if (treeWithoutOtherPlanets && treeWithoutOtherPlanets.cost <= tree.cost) {
          tree = treeWithoutOtherPlanets;
        }
      }

      if (tree) {
        // Convert from regular hex to gaia hex of grid
        federations.push(
          this.addAdjacentBuildings(
            tree.path.map((hex) => map.grid.get(hex)),
            map
          )
        );
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

    const feds = difference(fedsWithInfo, toRemove).filter((fed) => fed.satellites <= maxSatellites);

    this.federationCache = {
      availableSatellites: maxSatellites,
      federations: feds,
      custom,
    };

    return feds;
  }

  get maxSatellites() {
    // Lost planet consumes one satellite
    const maxNumber = MAX_SATELLITES - this.data.satellites;

    if (this.faction === Faction.Ivits) {
      // for Ivits the federationCache is requesting the already payed satellites
      // so the requested QICs have to include them
      return Math.min(this.data.qics + this.data.satellites, maxNumber);
    } else {
      return Math.min(this.data.discardablePowerTokens(), maxNumber);
    }
  }

  federationInfo(federation: GaiaHex[]): FederationInfo {
    // Be careful of Ivits & space stations for nSatellites!
    const satellites = federation.filter((hex) => !hex.occupyingPlayers()?.includes(this.player));
    const nPlanets = federation.filter((hex) => hex.colonizedBy(this.player)).length;

    return {
      hexes: federation,
      satellites: satellites.length,
      planets: nPlanets,
    };
  }

  formFederation(info: FederationInfo, token: Federation) {
    let newSatellites = 0;
    for (const hex of info.hexes) {
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

  checkAndGetFederationInfo(location: string, map: SpaceMap, flexible: boolean): FederationInfo {
    const coords = location.split(",").map((loc) => map.parse(loc));

    for (const coord of coords) {
      assert(map.grid.get(coord), `Coord ${coord.q}x${coord.r} is not part of the map`);
    }

    assert(coords.length <= 30, "The federation is too big, it is impossible to build with only 23 satellites");

    let hexes: GaiaHex[] = uniq(coords.map((coord) => map.grid.get(coord)));

    assert(hexes.length === coords.length, "There are repeating coordinates in the given federation");

    // Extend to nearby buidlings
    hexes = this.addAdjacentBuildings(hexes, map);

    // Check if no forbidden square
    const excluded = map.excludedHexesForBuildingFederation(this.player, this.faction);
    for (const hex of hexes) {
      assert(!excluded.has(hex), `${hex.toString()} can't be part of a new federation`);
    }

    // Check if all the buildings are in one group
    assert(map.grid.groups(hexes).length === 1, "The hexes of the federation must be adjacent");

    // Get the power value of the buildings
    const powerValue = sum(hexes.map((hex) => this.buildingValue(hex, { federation: true })));
    assert(
      powerValue >= this.federationCost,
      "Your buildings need to have a total value of at least " + this.federationCost
    );

    const info = this.federationInfo(hexes);

    // Check if outclassed by available federations
    const available = this.availableFederations(map, flexible);
    const outclasser = available.find((fed) => isOutclassedBy(info, fed));

    assert(!outclasser, "Federation is outclassed by other federation at " + (outclasser?.hexes ?? []).join(","));

    // Check if federation can be built with less satellites
    if (!flexible) {
      const allHexes = [...map.grid.values()].filter((hex) => !excluded.has(hex));

      const occupiedSet = new Set(this.data.occupied);
      const workingGrid = new Grid<Hex<{ cost: number }>>(
        ...allHexes.map((hex) => new Hex(hex.q, hex.r, { cost: occupiedSet.has(hex) ? 0 : 1 }))
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

      if (tree) {
        const smallFederation = this.addAdjacentBuildings(
          tree.path.map((hex) => map.grid.get(hex)),
          map
        );
        const info2 = this.federationInfo(smallFederation);
        assert(
          info2.satellites >= info.satellites,
          "The federation can be built with less satellites, for example: " + tree.path.join(",")
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

  get federationCost(): number {
    if (this.faction === Faction.Xenos && this.data.hasPlanetaryInstitute()) {
      return 6;
    }
    if (this.faction === Faction.Ivits) {
      return 7 * (1 + this.data.federationCount);
    }
    return 7;
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

    const addHex = (hx) => {
      ret.push(hx);
      for (const hx2 of map.grid.neighbours(hx)) {
        if (
          !ret.includes(hx2) &&
          (hx2.belongsToFederationOf(this.player) || this.buildingValue(hx2, { federation: true })) > 0
        ) {
          addHex(hx2);
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
