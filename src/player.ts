import { Faction, Operator, ResearchField, Planet, Building, Resource, Booster, Condition } from './enums';
import PlayerData from './player-data';
import Event from './events';
import { factionBoard, FactionBoard } from './faction-boards';
import * as _ from 'lodash';
import factions from './factions';
import Reward from './reward';
import { CubeCoordinates } from 'hexagrid';
import researchTracks from './research-tracks';
import { terraformingStepsRequired } from './planets';
import boosts from './tiles/boosters';
import { stdBuildingValue } from './buildings';

const TERRAFORMING_COST = 3;

export default class Player {
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

  constructor() {
    this.data.on('advance-research', track => this.onResearchAdvanced(track));
  }

  toJSON() {
    return {
      faction: this.faction,
      data: this.data,
      income: Reward.toString(Reward.merge([].concat(...this.events[Operator.Income].map(event => event.rewards))), true)
    };
  }

  static fromData(data: any) {
    const player = new Player();

    if (data.faction) {
      player.loadFaction(data.faction);
    }

    if (data.data) {
      _.merge(player.data, data.data);
    }

    return player;
  }

  get planet(): Planet {
    return factions.planet(this.faction);
  }

  canBuild(targetPlanet: Planet, building: Building, {isolated, addedCost, existingBuilding}: {isolated?: boolean, addedCost?: Reward[], existingBuilding?: Building}) : Reward[] {
    if (this.data[building] >= (building === Building.GaiaFormer ? this.data.gaiaformers : this.board.maxBuildings(building))) {
      // Too many buildings of the same kind
      return undefined;
    }

    if (!addedCost) {
      addedCost = [];
    }

    if (!this.data.canPay(addedCost)) {
      return undefined;
    }
    
    //gaiaforming discount
    if (building === Building.GaiaFormer){
      const gaiaformingDiscount =  this.data.gaiaformers > 1  ? this.data.gaiaformers : 0;
      addedCost.push(new Reward(-gaiaformingDiscount, Resource.GainToken));
    } else if (building === Building.Mine){
      //habitability costs
      if (targetPlanet === Planet.Gaia) {
        if (!existingBuilding) {
          addedCost.push(new Reward("1q"));
        } else {
          // Already a gaia-former on the planet, so no need to pay a Q.I.C.
        }
      } else { // Get the number of terraforming steps to pay discounting terraforming track
        const steps = terraformingStepsRequired(factions[this.faction].planet, targetPlanet); 
        addedCost.push(new Reward((TERRAFORMING_COST - this.data.terraformSteps)*steps, Resource.Ore));
      }
    };

    const cost = Reward.merge([].concat(this.board.cost(targetPlanet, building, isolated), addedCost));
    return this.data.canPay(cost) ? cost : undefined;
  }

  loadFaction(faction: Faction) {
    this.faction = faction;
    this.board = factionBoard(faction);

    this.loadEvents(this.board.income);

    this.data.power.bowl1 = this.board.power.bowl1;
    this.data.power.bowl2 = this.board.power.bowl2;
  }

  loadEvents(events: Event[]) {
    for (const event of events) {
      this.loadEvent(event);
    }
  }

  loadEvent(event: Event) {
    this.events[event.operator].push(event);

    if (event.operator === Operator.Once) {
      this.data.gainRewards(event.rewards);
    }
  }

  removeEvents(events: Event[]) {
    for (const event of events) {
      this.removeEvent(event);
    }  
  }

  removeEvent(event: Event) {
    let findEvent = this.events[event.operator].findIndex(
      ev => ev.toJSON === event.toJSON
    );
    this.events[event.operator].slice(findEvent, 1);
  }
  
  onResearchAdvanced(field: ResearchField) {
    const events = Event.parse(researchTracks[field][this.data.research[field]]);
    this.loadEvents(events);
    
    this.receiveAdvanceResearchTriggerIncome();
  }

  build(upgradedBuilding, building: Building, planet: Planet, cost: Reward[], location: CubeCoordinates) {
    this.data.payCosts(cost);
    //excluding Gaiaformers as occupied 
    if ( building !== Building.GaiaFormer ) {
      this.data.occupied = _.uniqWith([].concat(this.data.occupied, location), _.isEqual)
    }

    // Add income of the building to the list of events
    this.loadEvent(this.board[building].income[this.data[building]]);
    this.data[building] += 1;

    // remove upgraded building and the associated event
    if(upgradedBuilding) {
      this.data[upgradedBuilding] -= 1;
      this.removeEvent(this.board[upgradedBuilding].income[this.data[upgradedBuilding]]);
    }

    // get triggered income for new building
    this.receiveBuildingTriggerIncome(building, planet);
  }

  pass() {
    this.receivePassIncome();
    // remove the old booster  
    this.removeEvents( Event.parse( boosts[this.data.roundBooster]));
    this.data.roundBooster =  undefined;
  }

  getRoundBooster(roundBooster: Booster){  
    // add the booster to the the player
    this.data.roundBooster =  roundBooster;
    this.loadEvents( Event.parse( boosts[roundBooster]));
  }

  receiveIncome() {
    for (const event of this.events[Operator.Income]) {
      this.data.gainRewards(event.rewards);
    }
  }

  receivePassIncome() {
    // this is for pass tile income (e.g. rounboosters, adv tiles)
    for (const event of this.events[Operator.Pass]) {
      const times = this.eventConditionCount(event.condition);
      this.data.gainRewards(event.rewards.map(reward => new Reward(reward.count * times, reward.type)));
    }
  }

  receiveBuildingTriggerIncome(building: Building, planet: Planet) {
    // this is for roundboosters, techtiles and adv tile
    for (const event of this.events[Operator.Trigger]) {
      if (Condition.matchesBuilding(event.condition, building, planet)) {
        this.data.gainRewards(event.rewards)
      };
    }
  }

  receiveAdvanceResearchTriggerIncome() {
    for (const event of this.events[Operator.Trigger]) {
      if (event.condition === Condition.AdvanceResearch) {
        this.data.gainRewards(event.rewards)
      };
    }
  }

  gaiaPhase() {
    /* Move gaia power tokens to regular power bowls */
    // Terrans move directly to power bowl 2
    if (this.faction === Faction.Terrans) {
      this.data.power.bowl2 += this.data.power.gaia;
    } else {
      this.data.power.bowl1 += this.data.power.gaia;
    }
    this.data.power.gaia = 0;
  }

  buildingValue(building: Building, planet: Planet){
    const baseValue =  stdBuildingValue(building);

    if (baseValue === 0) {
      return 0;
    }
    
    const addedBescods = this.faction === Faction.Bescods && this.data[Building.PlanetaryInstitute] === 1  && planet === Planet.Titanium ? 1 : 0;
    //TODO value if TECH3
    return baseValue + addedBescods;
  }

  maxLeech(possibleLeech: number){ 
    // considers real chargeable power and victory points
    return Math.min(possibleLeech, this.data.power.bowl1 * 2 + this.data.power.bowl2, this.data.victoryPoints + 1);
  }

  eventConditionCount(condition: Condition) {
    switch (condition) {
      case Condition.None: return 1;
      case Condition.Mine: return this.data[Building.Mine];
      case Condition.TradingStation: return this.data[Building.TradingStation];
      case Condition.ResearchLab: return this.data[Building.ResearchLab];
      case Condition.PlanetaryInstituteOrAcademy: return this.data[Building.Academy1] + this.data[Building.Academy2] + this.data[Building.PlanetaryInstitute];
      case Condition.Federation: return this.data.federations.length;
      // TODO when federations branch is merged, use hexes of data.occupied to determine
      case Condition.Gaia: case Condition.PlanetType: case Condition.Sector: return 0;
    }

    return 0;
  }
}