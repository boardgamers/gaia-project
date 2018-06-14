import { Faction, Operator, ResearchField, Planet, Building } from "./enums";
import PlayerData from "./player-data";
import Event from "./events";
import { factionBoard, FactionBoard } from "./faction-boards";
import * as _ from "lodash";
import factions from "./factions";
import Reward from "./reward";

export default class Player {
  faction: Faction = null;
  board: FactionBoard = null;
  data: PlayerData = new PlayerData();
  events: {
    [key in Operator]: Event[]
  } = {
    [Operator.Once]: [],
    [Operator.Income]: [],
    [Operator.Trigger]: [],
    [Operator.Activate]: [],
    [Operator.Pass]: [],
    [Operator.Special]: []
  };

  constructor() {
    this.data.on("upgrade-knowledge", track => this.onKnowledgeUpgraded(track));
  }

  toJSON() {
    return {
      faction: this.faction,
      data: this.data
    }
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

  onKnowledgeUpgraded(track: ResearchField) {
    // Todo: get corresponding income
  }

  build(building: Building, cost: Reward[]) {
    this.data.payCosts(cost);

    switch (building) {
      case Building.Mine: {
        // Add income of the building to the list of events
        this.loadEvent(this.board.mines.income[this.data.mines]);
        this.data.mines += 1;
        return;
      }
    }
  }

  receiveIncome() {
    for (const event of this.events[Operator.Income]) {
      this.data.gainRewards(event.rewards);
    }
  }
}