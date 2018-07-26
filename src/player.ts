import { Faction, Operator, ResearchField, Planet, Building, Resource, Booster, Condition, Federation, FinalTile, TechTile, AdvTechTile, BrainstoneArea, TechTilePos, AdvTechTilePos} from './enums';
import PlayerData from './player-data';
import Event from './events';
import { factionBoard, FactionBoard } from './faction-boards';
import * as _ from 'lodash';
import factions from './factions';
import Reward from './reward';
import { CubeCoordinates, Hex, Grid } from 'hexagrid';
import researchTracks, {lastTile, keyNeeded} from './research-tracks';
import { terraformingStepsRequired } from './planets';
import boosts from './tiles/boosters';
import { Player as PlayerEnum } from './enums';
import { stdBuildingValue } from './buildings';
import SpaceMap from './map';
import { GaiaHex } from './gaia-hex';
import spanningTree from './algorithms/spanning-tree';
import { FederationInfo, isOutclassedBy } from './federation';
import federationTiles, { isGreen } from "./tiles/federations";
import { EventEmitter } from "eventemitter3";
import { finalScorings } from './tiles/scoring';
import techs from './tiles/techs';
import * as assert from "assert";

const TERRAFORMING_COST = 3;
// 25 satellites - 2 used on the final scoring board
const MAX_SATELLITES = 23;

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
    [Operator.Special]: []
  };
  // Did we decline the last offer?
  declined = false;
  // OPTIONAL
  name?: string;
  auth?: string;

  constructor(public player: PlayerEnum = PlayerEnum.Player1) {
    super();
    this.data.on('advance-research', track => this.onResearchAdvanced(track));
  }

  toJSON() {
    return {
      player: this.player,
      faction: this.faction,
      data: this.data,
      income: Reward.toString(Reward.merge([].concat(...this.events[Operator.Income].map(event => event.rewards))), true),
      progress:  Object.assign({}, ...Object.values(FinalTile).map( track => ({ [track]: this.eventConditionCount(finalScorings[track])}))),
      actions: this.events[Operator.Activate].map(event => ({rewards: event.spec.replace('=>', '').trim(), enabled: !event.activated})),
      events: this.events,
      name: this.name,
      auth: this.auth,
      ownedPlanets:  _.uniq(this.data.occupied.filter(hex => hex.data.planet !== Planet.Empty && hex.colonizedBy(this.player)).map(hex => hex.data.planet))
    };
  }

  static fromData(data: any) {
    const player = new Player(data.player);

    if (data.faction) {
      player.loadFaction(data.faction, true);
    }

    if (data.data) {
      _.merge(player.data, data.data);
    }

    for (const kind of Object.keys(data.events)) {
      player.events[kind] = data.events[kind].map(ev => new Event(ev));
    }

    player.name = data.name;
    player.auth = data.auth;

    return player;
  }

  get planet(): Planet {
    return factions.planet(this.faction);
  }

  payCosts(costs: Reward[]) {
    for (const cost of costs) {
      this.data.payCost(cost);
    }
  }

  gainRewards(rewards: Reward[]) {
    this.data.gainRewards(rewards.map(rew => this.factionReward(rew)));
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

  canBuild(targetPlanet: Planet, building: Building, {isolated, addedCost, existingBuilding}: {isolated?: boolean, addedCost?: Reward[], existingBuilding?: Building}): {cost?: Reward[], possible: boolean, steps?: number} {
    if (this.data.buildings[building] >= this.maxBuildings(building)) {
      // Too many buildings of the same kind
      return {possible: false};
    }

    if (!addedCost) {
      addedCost = [];
    }

    if (!this.canPay(addedCost)) {
      return {possible: false};
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
      } else { // Get the number of terraforming steps to pay discounting terraforming track
        steps = Math.max(terraformingStepsRequired(factions[this.faction].planet, targetPlanet) - this.data.temporaryStep, 0);
        addedCost.push(new Reward((TERRAFORMING_COST - this.data.terraformCostDiscount) * steps, Resource.Ore));
      }
    }

    const cost = Reward.merge(this.board.cost(targetPlanet, building, isolated), addedCost);

    if (!this.canPay(cost)) {
      return {possible: false};
    }
    return {
      possible: true,
      cost,
      steps
    };
  }

  maxBuildings(building: Building) {
    return building === Building.GaiaFormer ? (this.data.gaiaformers - this.data.gaiaformersInGaia) : this.board.buildings[building].income.length;
  }

  loadFaction(faction: Faction, skipIncome = false) {
    this.faction = faction;
    this.board = factionBoard(faction);

    if (!skipIncome) {
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

  loadEvents(events: Event[]) {
    for (const event of events) {
      this.loadEvent(event);
    }
  }

  loadEvent(event: Event) {
    this.events[event.operator].push(event);

    if (event.operator === Operator.Once) {
      const times = this.eventConditionCount(event.condition);
      this.gainRewards(event.rewards.map(reward => new Reward(reward.count * times, reward.type)));
    }
  }

  removeEvents(events: Event[]) {
    for (const event of events) {
      this.removeEvent(event);
    }
  }

  removeEvent(event: Event) {
    this.events[event.operator].some((ev, i) => {
      if (ev.spec === event.spec) {
        this.events[event.operator].splice(i, 1);
        return true;
      }
    });
  }

  removeRoundBoosterEvents( type?: Operator.Income) {

    for (const event of Event.parse( boosts[this.data.tiles.booster])
    .filter( ev => (type && ev.operator === Operator.Income ) || ( !type && ev.operator !== Operator.Income ))) {
      this.removeEvent(event);
    }
  }



  activateEvent(spec: string) {
    for (const event of this.events[Operator.Activate]) {
      if (event.spec === spec && !event.activated) {
        this.gainRewards(event.rewards);
        event.activated = true;
        return;
      }
    }
  }

  receiveIncomeEvent(rewards: Reward[]) {
    // this is managing Income phase to solve +t and +pw ordering
    // it's assuming that each reward belongs to a different event, which has only that reward
    // in case of multiple matchings pick the first
    for ( const rew of rewards) {
      const event =  this.events[Operator.Income].find(ev => !ev.activated && ev.rewards.some(rew2 => Reward.match([rew], [rew2])));

      assert(event);

      this.gainRewards(event.rewards);
      event.activated = true;
    }
  }


  onResearchAdvanced(field: ResearchField) {
    const events = Event.parse(researchTracks[field][this.data.research[field]]);
    this.loadEvents(events);
    const oldEvents = Event.parse(researchTracks[field][this.data.research[field] - 1]);
    this.removeEvents(oldEvents);

    if (this.data.research[field] === lastTile(field)) {
      this.data.removeGreenFederation();
    }

    this.receiveAdvanceResearchTriggerIncome();
  }

  build(building: Building, hex: GaiaHex, cost: Reward[], map: SpaceMap, stepsReq?: number) {
    this.payCosts(cost);
    // excluding Gaiaformers as occupied
    if (building !== Building.GaiaFormer) {
      this.data.occupied = _.uniqWith([].concat(this.data.occupied, hex), _.isEqual);
    }

    // The mine of the lost planet doesn't grant any extra income
    if (hex.data.planet !== Planet.Lost) {
      // Add income of the building to the list of events
      this.data.buildings[building] += 1; // NEEDS TO BE BEFORE REWARDS, so gleens can get qic from tech if they build academy 2
      this.loadEvents(this.board.buildings[building].income[this.data.buildings[building] - 1]);
    } else {
      this.data.lostPlanet += 1;
    }

    // remove upgraded building and the associated event
    const upgradedBuilding = hex.buildingOf(this.player);
    if (upgradedBuilding) {
      this.data.buildings[upgradedBuilding] -= 1;
      this.removeEvents(this.board.buildings[upgradedBuilding].income[this.data.buildings[upgradedBuilding]]);
    }

    // If the planet is already occupied by someone else
    if (!upgradedBuilding && hex.occupied()) {
      // Lantids
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
      const group: GaiaHex[] = this.buildingGroup(hex);
      const hasFederation = group.some(hx => hx.belongsToFederationOf(this.player));

      if (hasFederation) {
        for (const h of group) {
          h.addToFederationOf(this.player);
        }
      }
    }

    // get triggered income for new building
    this.receiveBuildingTriggerIncome(building, hex.data.planet);
    // get triggerd terffaorming step income for new building
    if (stepsReq) {
      this.receiveTerraformingStepTriggerIncome(stepsReq);
    }

    // Faction-specific code on building
    this.emit(`build-${building}`, hex);
  }

  // Not to confuse with the end of a round
  endTurn() {
    // reset temporary benefits
    this.data.temporaryRange = 0;
    this.data.temporaryStep = 0;
  }

  pass(lastRound = false) {
    this.receivePassIncome();
    // remove the remaing reward of the round booster events
    this.removeRoundBoosterEvents();
    this.data.tiles.booster =  undefined;

    if (lastRound) {
      this.data.finalResourceHandling();
    }
  }

  getRoundBooster(roundBooster: Booster) {
    // add the booster to the the player
    this.data.tiles.booster =  roundBooster;
    this.loadEvents(Event.parse( boosts[roundBooster]));
  }

  gainTechTile(tile: TechTile | AdvTechTile, pos: TechTilePos | AdvTechTilePos) {
    if (Object.values(AdvTechTilePos).includes(pos)) {
      this.data.removeGreenFederation();
    }
    this.data.tiles.techs.push({tile, pos, enabled: Object.values(TechTilePos).includes(pos)});
    this.loadEvents(Event.parse(techs[tile]));
  }

  coverTechTile(pos: TechTilePos) {
    const tile = this.data.tiles.techs.find(tech => tech.pos === pos);
    tile.enabled = false;
    this.removeEvents(Event.parse(techs[tile.tile]));
  }

  needIncomeSelection(): { events?: Event[], needed: boolean, descs: Reward[]} {
    // we need to check if rewards contains Resource.GainToken and Resource.GainPower
    // player has to select the order
    const allEvents = this.events[Operator.Income].filter( ev => !ev.activated);

    const gainTokens = allEvents.filter(ev => ev.rewards.some(rw => rw.type === Resource.GainToken));
    const chargePowers = allEvents.filter(ev => ev.rewards.some(rw => rw.type === Resource.ChargePower));

    return {
      events: gainTokens.concat(chargePowers),
      needed: gainTokens.length > 0 && chargePowers.length > 0,
      descs: [
        ... gainTokens.map(ev => ev.rewards.find(rw => rw.type === Resource.GainToken)),
        ... chargePowers.map(ev => ev.rewards.find(rw => rw.type === Resource.ChargePower))
      ]
    };
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
      if ( !event.activated ) {
        this.gainRewards(event.rewards);
      } else {
        // clean up event
        event.activated = false;
      }
    }
  }

  receivePassIncome() {
    // this is for pass tile income (e.g. rounboosters, adv tiles)
    for (const event of this.events[Operator.Pass]) {
      const times = this.eventConditionCount(event.condition);
      this.gainRewards(event.rewards.map(reward => new Reward(reward.count * times, reward.type)));
    }
  }

  receiveBuildingTriggerIncome(building: Building, planet: Planet) {
    // this is for roundboosters, techtiles and adv tile
    for (const event of this.events[Operator.Trigger]) {
      if (Condition.matchesBuilding(event.condition, building, planet)) {
        this.gainRewards(event.rewards);
      }
    }
  }

  receiveAdvanceResearchTriggerIncome() {
    for (const event of this.events[Operator.Trigger]) {
      if (event.condition === Condition.AdvanceResearch) {
        this.gainRewards(event.rewards);
      }
    }
  }

  receiveTerraformingStepTriggerIncome(stepsReq: number) {
    for (const event of this.events[Operator.Trigger]) {
      if (event.condition === Condition.TerraformStep) {
        this.gainRewards(event.rewards.map( rw => new Reward(rw.count * stepsReq, rw.type)));
      }
    }
  }

  receiveNewFederationTriggerIncome() {
    for (const event of this.events[Operator.Trigger]) {
      if (event.condition === Condition.Federation) {
        this.gainRewards(event.rewards);
      }
    }
  }

  finalCount(tile: FinalTile): number {
    switch (tile) {
      case FinalTile.Structure : return this.eventConditionCount(finalScorings[FinalTile.Structure]);
      case FinalTile.StructureFed : return this.eventConditionCount(finalScorings[FinalTile.StructureFed]);
      case FinalTile.PlanetType : return this.eventConditionCount(finalScorings[FinalTile.PlanetType]);
      case FinalTile.Gaia : return this.eventConditionCount(finalScorings[FinalTile.Gaia]);
      case FinalTile.Sector : return this.eventConditionCount(finalScorings[FinalTile.Sector]);
      case FinalTile.Satellite : return this.eventConditionCount(finalScorings[FinalTile.Satellite]);
     }
  }

  gaiaPhase() {
    /* Move gaia power tokens to regular power areas */
    this.emit('gaiaPhase-beforeTokenMove');

    this.data.power.area1 += this.data.power.gaia;
    if (this.data.brainstone === BrainstoneArea.Gaia ) {
      this.data.brainstone = BrainstoneArea.Area1;
    }

    this.data.power.gaia = 0;
    this.data.gaiaformersInGaia = 0;
  }

  buildingValue(building: Building, planet: Planet, forFederation = false) {
    if (forFederation && building === Building.SpaceStation) {
      return 1;
    }

    let baseValue =  stdBuildingValue(building);

    // Space stations and gaia-formers can't get leech when someone makes a structure nearby
    if (baseValue === 0) {
      return 0;
    }

    if (baseValue === 3 && this.events[Operator.Special].length > 0) {
      baseValue = 4;
    }

    const addedBescods = this.faction === Faction.Bescods && this.data.buildings[Building.PlanetaryInstitute] === 1  && planet === Planet.Titanium ? 1 : 0;

    return baseValue + addedBescods;
  }

  maxLeech(possibleLeech: number) {
    // considers real chargeable power and victory points
    return Math.min(possibleLeech, this.data.chargePower(possibleLeech, false), this.data.victoryPoints + 1);
  }

  gainFederationToken(federation: Federation) {
    this.data.tiles.federations.push({
      tile: federation,
      green: isGreen(federation)
    });

    this.gainRewards(Reward.parse(federationTiles[federation]));
    this.receiveNewFederationTriggerIncome();
  }

  factionReward(reward: Reward): Reward {
    // this is for Gleens getting ore instead of qics until Academy2
    if (this.faction === Faction.Gleens && this.data.buildings[Building.Academy2] === 0 && reward.type === Resource.Qic) {
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
      case Condition.None: return 1;
      case Condition.Mine: return this.data.buildings[Building.Mine];
      case Condition.TradingStation: return this.data.buildings[Building.TradingStation];
      case Condition.ResearchLab: return this.data.buildings[Building.ResearchLab];
      case Condition.PlanetaryInstituteOrAcademy: return this.data.buildings[Building.Academy1] + this.data.buildings[Building.Academy2] + this.data.buildings[Building.PlanetaryInstitute];
      case Condition.Federation: return this.data.tiles.federations.length;
      case Condition.Gaia: return this.data.occupied.filter(hex => hex.data.planet === Planet.Gaia && hex.colonizedBy(this.player)).length;
      case Condition.PlanetType: return _.uniq(this.data.occupied.filter(hex => hex.data.planet !== Planet.Empty && hex.colonizedBy(this.player)).map(hex => hex.data.planet)).length;
      case Condition.Sector: return _.uniq(this.data.occupied.filter(hex => hex.colonizedBy(this.player)).map(hex => hex.data.sector)).length;
      case Condition.Structure: return this.data.occupied.filter(hex => hex.colonizedBy(this.player)).length;
      case Condition.StructureFed: return this.data.occupied.filter(hex => hex.colonizedBy(this.player) && hex.belongsToFederationOf(this.player)).length;
      case Condition.Satellite: return this.data.satellites + this.data.buildings[Building.SpaceStation];
    }

    return 0;
  }

  availableFederations(map: SpaceMap): FederationInfo[] {
    const excluded = map.excludedHexesForBuildingFederation(this.player, this.faction);

    const hexes = this.data.occupied.map(coord => map.grid.get(coord)).filter(hex => !excluded.has(hex));
    const hexesWithBuildings = new Set(hexes);
    const values = hexes.map(node => this.buildingValue(node.data.building, node.data.planet, true));

    let combinations = this.possibleCombinationsForFederations(_.zipWith(hexes, values, (val1, val2) => ({hex: val1, value: val2})));
    const maxSatellites = this.maxSatellites;

    // Ivits can only expand their first federation
    if (this.faction === Faction.Ivits && this.data.federationCount > 0) {
      combinations = combinations.filter(combination => combination.some(hex => hex.belongsToFederationOf(this.player)));
    }

    // We now have several combinations of buildings that can form federations
    // We need to see if they can be connected
    const federations: GaiaHex[][] = [];
    const buildingGroups = this.buildingGroups();

    for (const combination of combinations) {
      const destGroups = _.uniq(combination.map(building => buildingGroups.get(building)));
      const buildingsInDestGroups: Set<GaiaHex> = new Set([].concat(...destGroups));
      // Create a new grid. The following are removed:
      // - hexes in a federation or nearby a federation
      // - hexes belonging to a building group not part of combination, or adjacent to them
      //
      // Because of this second constraint, we do avoid some valid possibilites.
      // However, those possibilites are explored in another combination
      const otherExcluded: Set<GaiaHex> = new Set([].concat(...this.data.occupied.map(hex => buildingsInDestGroups.has(hex) ? [] : [hex, ...map.grid.neighbours(hex)])));
      const allHexes = [...map.grid.values()].filter(hex => !excluded.has(hex) && !otherExcluded.has(hex));
      const workingGrid = new Grid(...allHexes.map(hex => new Hex(hex.q, hex.r)));
      const convertedDestGroups = destGroups.map(destGroup => destGroup.map(hex => workingGrid.get(hex)));
      const tree = spanningTree(convertedDestGroups, workingGrid, maxSatellites, "heuristic");
      if (tree) {
        // Convert from regular hex to gaia hex of grid
        federations.push(tree.map(hex => map.grid.get(hex)));
      }
    }

    const fedsWithInfo: FederationInfo[] = federations.map(federation => this.federationInfo(federation));

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

    return _.difference(fedsWithInfo, toRemove);
  }

  get maxSatellites() {
    // Lost planet consumes one satellite
    const maxNumber = MAX_SATELLITES - this.data.satellites - this.data.lostPlanet;

    if (this.faction === Faction.Ivits) {
      return Math.min(this.data.qics, maxNumber);
    } else {
      return Math.min(this.data.discardablePowerTokens(), maxNumber);
    }
  }

  federationInfo(federation: GaiaHex[]): FederationInfo {
    const nSatellites = federation.filter(hex => hex.data.planet === Planet.Empty).length;
    const nPlanets = federation.filter(hex => hex.colonizedBy(this.player)).length;

    return {
      hexes: federation,
      satellites: nSatellites,
      planets: nPlanets
    };
  }

  formFederation(info: FederationInfo, token: Federation) {
    let newSatellites = 0;
    for (const hex of info.hexes) {
      hex.addToFederationOf(this.player);
      if (hex.buildingOf(this.player) === undefined) {
        newSatellites += 1;
      }
    }
    this.payCosts([new Reward(newSatellites, this.faction === Faction.Ivits ? Resource.Qic : Resource.GainToken)]);
    this.data.satellites += newSatellites;
    this.gainFederationToken(token);
    this.data.federationCount += 1;
  }

  checkAndGetFederationInfo(location: string, map: SpaceMap): FederationInfo {
    const coords = location.split(',').map(loc => CubeCoordinates.parse(loc));

    for (const coord of coords) {
      assert(map.grid.get(coord), `Coord ${coord.q}x${coord.r} is not part of the map`);
    }

    assert (coords.length <= 30, "The federation is too big, it is impossible to build with only 23 satellites");

    let hexes: GaiaHex[] = _.uniq(coords.map(coord => map.grid.get(coord)));

    assert (hexes.length === coords.length, "There are repeating coordinates in the given federation");

    // Extend to nearby buidlings
    hexes = this.addAdjacentBuildings(hexes);

    // Check if no forbidden square
    const excluded = map.excludedHexesForBuildingFederation(this.player, this.faction);
    for (const hex of hexes) {
      assert (!excluded.has(hex), `${hex.toString()} can't be part of a new federation`);
    }

    // Check if all the buildings are in one group
    assert(map.grid.groups(hexes).length === 1, 'The hexes of the federation must be adjacent');

    // Get the power value of the buildings
    const powerValue = _.sum(hexes.map(hex => this.buildingValue(hex.buildingOf(this.player), hex.data.planet, true)));
    assert(powerValue >= this.federationCost, "Your buildings need to have a total value of at least " + this.federationCost);

    const info = this.federationInfo(hexes);

    // Check if outclassed by available federations
    const available = this.availableFederations(map);
    const outclasser = available.find(fed => isOutclassedBy(info, fed));

    assert(!outclasser, "Federation is outclassed by other federation at " + _.get(outclasser, "hexes", []).join(','));

    assert (this.faction !== Faction.Ivits || this.data.federationCount === 0 || hexes.some(hex => hex.belongsToFederationOf(this.player)), "Ivits must extend their first federation");

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

  possibleCombinationsForFederations(nodes: Array<{hex: GaiaHex, value: number}>, toReach = this.federationCost): GaiaHex[][] {
    const ret: GaiaHex[][] = [];

    for (let i = 0; i < nodes.length; i ++) {
      if (nodes[i].value === 0) {
        continue;
      }

      if (nodes[i].value >= toReach) {
        ret.push([nodes[i].hex]);
        continue;
      }

      for (const possibility of this.possibleCombinationsForFederations(nodes.slice(i + 1), toReach - nodes[i].value)) {
        possibility.push(nodes[i].hex);
        ret.push(possibility);
      }
    }

    return ret;
  }

  buildingGroups(): Map<GaiaHex, GaiaHex[]> {
    const groups: Map<GaiaHex, GaiaHex[]> = new Map();

    for (const hexWithbuilding of this.data.occupied) {
      if (groups.has(hexWithbuilding)) {
        continue;
      }
      const group = this.buildingGroup(hexWithbuilding);
      for (const hex of group) {
        groups.set(hex, group);
      }
    }

    return groups;
  }

  buildingGroup(hex: GaiaHex): GaiaHex[] {
    const ret = [];

    const addHex = hx => {
      ret.push(hx);
      for (const building of this.data.occupied) {
        if (CubeCoordinates.distance(hx, building) === 1 && !ret.includes(building)) {
          addHex(building);
        }
      }
    };

    addHex(hex);
    return ret;
  }

  addAdjacentBuildings(hexes: GaiaHex[], buildingGroups = this.buildingGroups()): GaiaHex[] {
    return _.uniq([].concat(...hexes.map(hex => this.buildingGroup(hex))));
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
