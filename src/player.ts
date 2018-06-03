import { Faction, Operator } from "./enums";
import { FactionBoard } from "./faction-boards/types";
import PlayerData from "./player-data";
import Event from "./events";
import factionBoards from "./faction-boards";
import { getEvents } from "./faction-boards/util";

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

  toJSON() {
    return {
      faction: this.faction,
      data: this.data
    }
  }

  loadFaction(faction: Faction) {
    this.faction = faction;
    this.board = factionBoards[faction];

    const events = getEvents(this.board);

    for (const event of events) {
      
      this.events[event.operator].push(event);

      if (event.operator === Operator.Once) {
        this.data.gainRewards(event.rewards);
      }
    }
  }
}