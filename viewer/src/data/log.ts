import Engine, {
  AdvTechTilePos,
  Command,
  Faction,
  federations,
  LogEntry,
  LogEntryChanges,
  Phase,
  Player,
  PlayerEnum,
  Resource,
  TechTilePos,
} from "@gaia-project/engine";
import { factionLogColors, factionLogTextColors, lightFactionLogColors, ResourceText } from "../graphics/utils";
import { BuildingCounter } from "../logic/charts/buildings";
import { ResearchCounter } from "../logic/charts/research";
import { newResourceSimulator } from "../logic/charts/resource-counter";
import { ExtractLogArg, processLogEntry } from "../logic/charts/simple-charts";
import { logPlayerTables, playerTableRow } from "../logic/info-table";
import { CommandObject, MovesSlice, ownTurn, parsedMove, ParsedMove } from "../logic/recent";
import { boosterData } from "./boosters";
import { advancedTechTileData, baseTechTileData } from "./tech-tiles";

type LogCounter = {
  consumeChanges: (a: ExtractLogArg<any>) => void;
  newRows: () => ResourceText[][];
  faction: Faction;
};

function replaceTech(data: Engine, pos: TechTilePos | AdvTechTilePos) {
  const tile = data.tiles.techs[pos].tile;
  return pos.startsWith("adv") ? advancedTechTileData[tile].name : baseTechTileData[tile].name;
}

export function replaceMove(data: Engine, move: ParsedMove): ParsedMove {
  function addDetails(s: string, details: string): string {
    return `${s} (${details})`;
  }

  return {
    commands: move.commands,
    move: move.move.replace(/\b(tech|cover) [a-z0-9-]+|fed[0-9]+|booster[0-9]+/g, (match) => {
      if (match.startsWith("booster")) {
        return addDetails(match, boosterData[match].name);
      } else if (match.startsWith("fed")) {
        return addDetails(match, federations[match]);
      } else if (match.startsWith("cover")) {
        const pos = match.substr("cover ".length) as TechTilePos;
        return addDetails(match, replaceTech(data, pos));
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
      return addDetails(move, boosterData[move].name);
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
  moveIndex?: number;
  phase?: HistoryPhase;
  changes: Change[];
  round: number;
  turn: number;
  color: string;
  textColor: string;
  rows?: ResourceText[][];
  faction?: Faction;
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
  changes?: LogEntryChanges,
  moveIndex?: number
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
    } else if (command == Command.Bid || command == Command.RotateSectors || command == Command.Setup) {
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
    faction: faction,
    ...(moveIndex != null && { moveIndex }),
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

function newPlayerLogCounter(engine: Engine, p: Player): LogCounter {
  const tables = logPlayerTables(engine);

  const resourceSimulator = newResourceSimulator(p);
  const playerData = resourceSimulator.playerData;
  const buildings = new BuildingCounter(playerData);
  const research = new ResearchCounter(p, playerData);

  return {
    faction: p.faction,
    consumeChanges: (a) => {
      resourceSimulator.simulateResources(a);
      if (a.cmd?.faction == p.faction) {
        research.processCommand(a.cmd);
        buildings.playerCommand(a.cmd, engine);
      }
    },
    newRows: () => {
      const player = { data: playerData } as Player;
      return tables
        .map((table) => playerTableRow(table, player, false))
        .map((row) => Array.from(Object.values(row)).map((cells) => cells[0].label));
    },
  };
}

function updateCounters(move: ParsedMove | null, entry: LogEntry, logCounters: LogCounter[], data: Engine) {
  for (const logCounter of logCounters) {
    processLogEntry(entry, move?.commands, (cmd, log, allCommands, cmdIndex) => {
      logCounter.consumeChanges({
        cmd,
        allCommands,
        cmdIndex,
        source: null,
        data,
        log,
      });
      return 0;
    });
  }
}

function addExtendedRow(
  move: ParsedMove | null,
  entry: LogEntry,
  historyEntry: HistoryEntry,
  logCounters: LogCounter[],
  engine: Engine
) {
  if (logCounters.length == 0) {
    return;
  }

  updateCounters(move, entry, logCounters, engine);
  if (historyEntry.faction) {
    const logCounter = logCounters.find((c) => c.faction === historyEntry.faction);

    historyEntry.rows = logCounter.newRows();
  }
}

export function makeHistory(
  data: Engine,
  recent: MovesSlice,
  onlyRecent: boolean,
  currentMove: string,
  extendedLog: boolean
): HistoryEntry[] {
  const logCounters: LogCounter[] = [];

  if (extendedLog) {
    for (const player of data.players) {
      if (player.faction) {
        logCounters.push(newPlayerLogCounter(data, player));
      }
    }
  }

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

  const bumpLog: () => LogEntry = () => {
    advancedLogIndex += 1;
    const entry = advancedLog[advancedLogIndex];
    if (advancedLogIndex == 0) {
      ret.push(makeEntry(data, state, recent.index > 0 && onlyRecent ? "moves-skipped" : Phase.SetupInit));
    } else if (entry?.round) {
      state.round = entry.round;
      newPhase(Phase.RoundStart, 0);
    } else if (entry?.phase) {
      newPhase(entry?.phase, state.turn);
    }
    return entry;
  };

  const newHistoryEntry = (move: ParsedMove = null, entry: LogEntry = nextLogEntry): HistoryEntry => {
    const newPhase = entry.round ? Phase.RoundStart : entry.phase;
    return makeEntry(data, state, newPhase, move, entry.player, entry.changes, entry.move);
  };

  function addChangesEntry(logEntry: LogEntry): LogEntry {
    if (logEntry.player === undefined || !!logEntry.changes) {
      const entry = newHistoryEntry();
      addExtendedRow(null, logEntry, entry, logCounters, data);
      addEntry(entry);
    }
    return bumpLog();
  }

  nextLogEntry = bumpLog();

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
      nextLogEntry = addChangesEntry(nextLogEntry);
    }
    const entry = newHistoryEntry(replaceMove(data, parsedMove), { move: i } as LogEntry);
    if (nextLogEntry && nextLogEntry.move === i) {
      entry.changes = makeChanges(data, nextLogEntry.changes);
      addExtendedRow(parsedMove, nextLogEntry, entry, logCounters, data);
      nextLogEntry = bumpLog();
    }
    addEntry(entry);
    while (nextLogEntry && nextLogEntry.move === undefined) {
      nextLogEntry = addChangesEntry(nextLogEntry);
    }
  });

  if (nextLogEntry && currentMove) {
    addEntry(newHistoryEntry(replaceMove(data, parsedMove(currentMove))));
  }

  ret.reverse();
  return ret;
}
