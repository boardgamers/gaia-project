import Engine, {
  AdvTechTilePos,
  Command,
  Faction,
  LogEntry,
  LogEntryChanges,
  Phase,
  PlayerEnum,
  TechTilePos,
} from "@gaia-project/engine";
import { factionLogColors, factionLogTextColors, lightFactionLogColors } from "../graphics/utils";
import { ownTurn, parseCommands } from "../logic/recent";
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
  phase?: Phase;
  changes: Change[];
  round: number;
  turn: number;
  color: string;
  textColor: string;
};

function makeChanges(data: Engine, entryChanges?: LogEntryChanges) {
  return entryChanges == null
    ? []
    : Object.entries(entryChanges).flatMap(([source, changes]) => {
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
}

type HistoryState = {
  round: number;
  phase: Phase;
  turn: number;
  turnFactions: string[];
};

function makeEntry(
  data: Engine,
  state: HistoryState,
  newPhase?: Phase,
  move?: string,
  player?: PlayerEnum,
  changes?: LogEntryChanges
): HistoryEntry {
  let faction: Faction = null;
  let turnFaction: string = null;
  let own = false;
  if (move != null) {
    const command = move.split(" ", 3);
    if (command[1] == Command.ChooseFaction) {
      faction = command[2] as Faction;
      turnFaction = command[0];
    } else if (command[1] == Command.Bid) {
      turnFaction = command[0];
    } else {
      faction = command[0] as Faction;
      turnFaction = faction;
    }
    own = ownTurn(move);
  } else {
    if (player != null) {
      faction = data.players[player].faction;
      turnFaction = faction;
    }
    move = faction;
  }
  const color = faction == null ? "white" : own ? factionLogColors[faction] : lightFactionLogColors[faction];
  const textColor = faction == null || !own ? "var(--res-power)" : factionLogTextColors[faction];
  if (own && turnFaction != null) {
    if (state.turnFactions.includes(turnFaction)) {
      state.turn++;
      state.turnFactions = [];
    }
    state.turnFactions.push(turnFaction);
  }
  return {
    move: move,
    phase: newPhase,
    round: state.round,
    turn: state.turn,
    changes: makeChanges(data, changes),
    color: color,
    textColor: textColor,
  };
}

export function makeHistory(data: Engine, offset: number, currentMove: string): HistoryEntry[] {
  const advancedLog = data.advancedLog;

  const ret = [];
  const state: HistoryState = {
    round: 0,
    phase: Phase.BeginGame,
    turn: 0,
    turnFactions: [],
  };
  let advancedLogIndex = 0;
  let nextLogEntry = advancedLog[advancedLogIndex];

  const newPhase = (newPhase: Phase, newTurn: number) => {
    state.phase = newPhase;
    state.turn = newTurn;
    state.turnFactions = [];
  };

  const bumpLog = () => {
    advancedLogIndex += 1;
    nextLogEntry = advancedLog[advancedLogIndex];
    if (nextLogEntry?.round) {
      state.round = nextLogEntry.round;
      newPhase(Phase.RoundStart, 0);
    } else if (nextLogEntry?.phase) {
      newPhase(nextLogEntry?.phase, 0);
    }
  };

  const newEntry = (move: string = null, entry: LogEntry = nextLogEntry): HistoryEntry => {
    const newPhase = entry.round ? Phase.RoundStart : entry.phase;
    return makeEntry(data, state, newPhase, move, entry.player, entry.changes);
  };

  function addEntry(entry: HistoryEntry) {
    if (advancedLogIndex > offset) {
      ret.push(entry);
    }
  }

  data.moveHistory.forEach((move, i) => {
    if (state.phase == Phase.RoundGaia) {
      const commands = parseCommands(move);
      if (commands.some((c) => c.command != Command.Spend)) {
        newPhase(Phase.RoundMove, 1);
        addEntry(makeEntry(data, state, Phase.RoundMove));
        bumpLog();
      }
    }

    while (nextLogEntry && (nextLogEntry.move === undefined || nextLogEntry.move < i)) {
      if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
        addEntry(newEntry());
      }
      bumpLog();
    }
    const entry = newEntry(replaceMove(data, move), {} as LogEntry);
    if (nextLogEntry && nextLogEntry.move === i) {
      entry.changes = makeChanges(data, nextLogEntry.changes);
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
