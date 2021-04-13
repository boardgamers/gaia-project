import Engine, { AdvTechTilePos, Faction, LogEntry, TechTilePos } from "@gaia-project/engine";
import { factionLogColors, factionLogTextColors, lightFactionLogColors } from "../graphics/utils";
import { ownTurn } from "../logic/recent";
import { boosterNames } from "./boosters";
import { advancedTechTileNames, baseTechTileNames } from "./tech-tiles";

function replaceTech(data: Engine, pos: TechTilePos | AdvTechTilePos) {
  const tile = data.tiles.techs[pos].tile;
  return pos.startsWith("adv") ? advancedTechTileNames[tile] : baseTechTileNames[tile].name;
}

export function replaceMove(data: Engine, move: string): string {
  function addDetails(s: string, details: string): string {
    return `${s} (${details})`;
  }

  return move.replace(/\btech [a-z0-9-]+|booster[0-9]+/g, (match) => {
    if (match.startsWith("booster")) {
      return addDetails(match, boosterNames[match].name);
    } else {
      const pos = match.substr("tech ".length) as TechTilePos | AdvTechTilePos;
      return addDetails(match, replaceTech(data, pos));
    }
  });
}

export function replaceChange(data: Engine, move: string): string[] {
  function addDetails(s: string, details: string): string[] {
    return [s, `(${details})`];
  }

  if (move.match(/\btech-[a-z0-9-]+|adv-[a-z]+|booster[0-9]+/g)) {
    if (move.startsWith("booster")) {
      return addDetails(move, boosterNames[move].name);
    } else if (move.startsWith("tech-")) {
      const pos = move.substr("tech-".length) as TechTilePos;
      return addDetails(move, replaceTech(data, pos));
    } else {
      return addDetails(move, replaceTech(data, move as AdvTechTilePos));
    }
  }
  return [move];
}

type Change = { source: string; changes: string };

export type HistoryEntry = {
  move?: string;
  entry: LogEntry;
  changes: Change[];
  round: number;
  turn: number;
  color: string;
  textColor: string;
};

function makeChanges(entry: LogEntry, data: Engine) {
  const changes: Change[] =
    entry.changes == null
      ? []
      : Object.entries(entry.changes).flatMap(([source, changes]) => {
          const changeString =
            changes == null
              ? ""
              : Object.keys(changes)
                  .map((key) => `${changes[key]}${key}`)
                  .join(", ");

          if (source === "undefined") {
            return [{ source: "&nbsp;", changes: changeString }];
          }

          return replaceChange(data, source).map((s, i) => ({ source: s, changes: i == 0 ? changeString : "&nbsp;" }));
        });
  return changes;
}

function makeEntry(
  move: string,
  entry: LogEntry,
  data: Engine,
  turnFactions: Faction[],
  turn: number,
  round: number
): HistoryEntry {
  let faction: Faction = null;
  let own = false;
  if (entry.player != null) {
    faction = data.players[entry.player].faction;
  } else if (move != null) {
    const command = move.split(" ", 3);
    faction = command[0] as Faction;
    own = ownTurn(move);
  }
  const color = faction == null ? "white" : own ? factionLogColors[faction] : lightFactionLogColors[faction];
  const textColor = faction == null || !own ? "var(--res-power)" : factionLogTextColors[faction];
  if (own && faction != null) {
    if (turnFactions.includes(faction)) {
      turn++;
      turnFactions = [];
    }
    turnFactions.push(faction);
  }
  return {
    move: move,
    round: round,
    turn: turn,
    entry: entry,
    changes: makeChanges(entry, data),
    color: color,
    textColor: textColor,
  };
}

export function makeHistory(data: Engine, offset: number, currentMove: string): HistoryEntry[] {
  const advancedLog = data.advancedLog;

  const ret = [];
  let round = 0;
  let turn = 1;
  let turnFactions: Faction[] = [];
  let advancedLogIndex = 0;
  let nextLogEntry = advancedLog[advancedLogIndex];

  const bumpLog = () => {
    advancedLogIndex += 1;
    nextLogEntry = advancedLog[advancedLogIndex];
    if (nextLogEntry?.round) {
      round = nextLogEntry.round;
      turn = 1;
      turnFactions = [];
    }
  };

  const newEntry = (move: string = null, entry: LogEntry = nextLogEntry): HistoryEntry =>
    makeEntry(move, entry, data, turnFactions, turn, round);

  function addEntry(entry: HistoryEntry) {
    if (advancedLogIndex > offset) {
      ret.push(entry);
    }
  }

  data.moveHistory.forEach((move, i) => {
    while (nextLogEntry && (nextLogEntry.move === undefined || nextLogEntry.move < i)) {
      if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
        addEntry(newEntry());
      }
      bumpLog();
    }
    const entry = newEntry(replaceMove(data, move), {} as LogEntry);
    if (nextLogEntry && nextLogEntry.move === i) {
      entry.entry = nextLogEntry;
      entry.changes = makeChanges(nextLogEntry, data);
      bumpLog();
    }
    addEntry(entry);
    while (nextLogEntry && nextLogEntry.move === undefined) {
      if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
        addEntry(newEntry());
      }
      bumpLog();
    }
  });

  if (nextLogEntry && currentMove) {
    addEntry(newEntry(replaceMove(data, currentMove)));
  }

  ret.reverse();
  return ret;
}
