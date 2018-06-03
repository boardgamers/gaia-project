import { Faction, Operator, ResearchField } from "./enums";
import PlayerData from "./player-data";
import Event from "./events";
import { factionBoard, FactionBoard } from "./faction-boards";

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