import Engine, {
  AdvTechTilePos,
  Command,
  Faction,
  LogEntry,
  LogEntryChanges,
  Phase,
  PlayerEnum,
  Resource,
  TechTilePos,
} from "@gaia-project/engine";
import { factionLogColors, factionLogTextColors, lightFactionLogColors } from "../graphics/utils";
import { CommandObject, MovesSlice, ownTurn, parsedMove, ParsedMove } from "../logic/recent";
import { boosterNames } from "./boosters";
import { advancedTechTileNames, baseTechTileNames } from "./tech-tiles";

function replaceTech(data: Engine, pos: TechTilePos | AdvTechTilePos) {
  const tile = data.tiles.techs[pos].tile;
  return pos.startsWith("adv") ? advancedTechTileNames[tile] : baseTechTileNames[tile].name;
}

export function replaceMove(data: Engine, move: ParsedMove): ParsedMove {
  function addDetails(s: string, details: string): string {
    return `${s} (${details})`;
  }

  return {
    commands: move.commands,
    move: move.move.replace(/\btech [a-z0-9-]+|booster[0-9]+/g, (match) => {
      if (match.startsWith("booster")) {
        return addDetails(match, boosterNames[match].name);
      } else {
        const pos = match.substr("tech ".length) as TechTilePos | AdvTechTilePos;
        return addDetails(match, replaceTech(data, pos));
      }
    }),
  };
}

export function replaceChange(data: Engine, move: string): string {
  function addDetails(s: string, details: string): string {
    return `${s} (${details})`;
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
  return move;
}

type Change = { source: string; changes: string };

export type HistoryPhase = Phase | "moves-skipped";

export type HistoryEntry = {
  move?: string;
  phase?: HistoryPhase;
  changes: Change[];
  round: number;
  turn: number;
  color: string;
  textColor: string;
};

function makeChanges(data: Engine, entryChanges?: LogEntryChanges): Change[] {
  return entryChanges == null
    ? []
    : Object.entries(entryChanges).map(([source, changes]) => {
        const changeString =
          changes == null
            ? ""
            : Object.keys(changes)
                .map((key) => `${changes[key]}${key}`)
                .join(", ");

        return source === "undefined"
          ? { source: "", changes: changeString }
          : { source: replaceChange(data, source), changes: changeString };
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
  newPhase?: HistoryPhase,
  parsedMove?: ParsedMove,
  player?: PlayerEnum,
  changes?: LogEntryChanges
): HistoryEntry {
  let faction: Faction = null;
  let turnFaction: string = null;
  let own = false;
  let move = parsedMove?.move;
  if (parsedMove != null) {
    const cmd = parsedMove.commands[0];
    const command = cmd.command;
    if ((cmd.faction as string) == Command.Init) {
      // nothing
    } else if (command == Command.ChooseFaction) {
      faction = cmd.args[0] as Faction;
      turnFaction = faction;
    } else if (command == Command.Bid || command == Command.RotateSectors) {
      turnFaction = cmd.faction;
    } else {
      faction = cmd.faction;
      turnFaction = faction;
    }
    own = ownTurn(parsedMove);
  } else {
    if (player != null) {
      faction = data.players[player].faction;
      turnFaction = faction;
    }
    move = faction;
  }
  const color = faction == null ? "white" : own ? factionLogColors[faction] : lightFactionLogColors[faction];
  const textColor = own ? (faction != null ? factionLogTextColors[faction] : "black") : "var(--res-power)";
  if (own && turnFaction != null) {
    if (state.turnFactions.includes(turnFaction) || state.turn == 0) {
      state.turn++;
      state.turnFactions = [];
    }
    state.turnFactions.push(turnFaction);
  }
  const res: HistoryEntry = {
    round: state.round,
    turn: state.turn,
    changes: makeChanges(data, changes),
    color: color,
    textColor: textColor,
  };
  //to avoid confusing data in unit tests
  if (newPhase != undefined) {
    res.phase = newPhase;
  }
  if (move != undefined) {
    res.move = move;
  }

  return res;
}

export function isGaiaMove(commands: CommandObject[]): boolean {
  return commands.some((c) => c.command == Command.Spend && c.args[0].endsWith(Resource.GainTokenGaiaArea));
}

export function makeHistory(
  data: Engine,
  recent: MovesSlice,
  onlyRecent: boolean,
  currentMove?: string
): HistoryEntry[] {
  const advancedLog = data.advancedLog;

  let append = !onlyRecent || recent.index < 0;
  const ret = [];
  function addEntry(entry: HistoryEntry) {
    if (append) {
      ret.push(entry);
    }
  }

  const state: HistoryState = {
    round: 0,
    phase: Phase.BeginGame,
    turn: 0,
    turnFactions: [],
  };
  const newPhase = (newPhase: Phase, turn: number) => {
    state.phase = newPhase;
    state.turn = turn;
    state.turnFactions = [];
  };

  let advancedLogIndex = -1;
  let nextLogEntry: LogEntry = null;

  const bumpLog = () => {
    advancedLogIndex += 1;
    nextLogEntry = advancedLog[advancedLogIndex];
    if (advancedLogIndex == 0) {
      ret.push(makeEntry(data, state, recent.index > 0 && onlyRecent ? "moves-skipped" : Phase.SetupInit));
    } else if (nextLogEntry?.round) {
      state.round = nextLogEntry.round;
      newPhase(Phase.RoundStart, 0);
    } else if (nextLogEntry?.phase) {
      newPhase(nextLogEntry?.phase, state.turn);
    }
  };

  const newEntry = (move: ParsedMove = null, entry: LogEntry = nextLogEntry): HistoryEntry => {
    const newPhase = entry.round ? Phase.RoundStart : entry.phase;
    return makeEntry(data, state, newPhase, move, entry.player, entry.changes);
  };

  bumpLog();

  recent.allMoves.forEach((parsedMove, i) => {
    if (onlyRecent && i == recent.index) {
      append = true;
    }

    const commands = parsedMove.commands;
    if (state.phase == Phase.RoundGaia) {
      if (!isGaiaMove(commands)) {
        newPhase(Phase.RoundMove, state.turn + 1);
        addEntry(makeEntry(data, state, Phase.RoundMove));
      }
    }

    while (nextLogEntry && (nextLogEntry.move === undefined || nextLogEntry.move < i)) {
      if (nextLogEntry.player === undefined || !!nextLogEntry.changes) {
        addEntry(newEntry());
      }
      bumpLog();
    }
    const entry = newEntry(replaceMove(data, parsedMove), {} as LogEntry);
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
    addEntry(newEntry(replaceMove(data, parsedMove(currentMove))));
  }

  ret.reverse();
  return ret;
}
