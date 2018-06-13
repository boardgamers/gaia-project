import { Faction, Operator, ResearchField, Planet } from "./enums";
import PlayerData from "./player-data";
import Event from "./events";
import { factionBoard, FactionBoard } from "./faction-boards";
import * as _ from "lodash";
import factions from "./factions";

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
  }

  loadEvents(events: Event[]) {
    for (const event of events) {
      this.events[event.operator].push(event);

      if (event.operator === Operator.Once) {
        this.data.gainRewards(event.rewards);
      }
    }
  }

  onKnowledgeUpgraded(track: ResearchField) {
    // Todo: get corresponding income
  }
}