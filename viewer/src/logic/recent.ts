import Engine, {
  BoardAction,
  Command,
  Faction,
  GaiaHex,
  LogEntry,
  PlayerEnum,
  ResearchField,
  Spaceship,
} from "@gaia-project/engine";
import { findLast, findLastIndex } from "./lodash-utils";

export type CommandObject = { faction: Faction; command: Command; args: string[] };

export type ParsedMove = { move: string; commands: CommandObject[] };

export type MovesSlice = { index: number; moves: ParsedMove[]; allMoves: ParsedMove[] };

export function parseCommands(move: string): CommandObject[] {
  move = move.trim();
  const factionIndex = move.indexOf(" ");
  const faction = move.substring(0, factionIndex) as Faction;

  return move
    .slice(factionIndex)
    .split(".")
    .flatMap((c) => {
      const split = c.split("(")[0].trim().split(" ");

      if (split[0].length == 0) {
        return [];
      }

      return [
        {
          faction: faction,
          command: split[0] as Command,
          args: split.slice(1),
        },
      ];
    });
}

export function buildingMovesByHex(data: Engine, moves: CommandObject[]): Map<GaiaHex, CommandObject> {
  const result = new Map<GaiaHex, CommandObject>();
  for (const command of moves) {
    if (command.command === Command.Build && command.args[1]) {
      result.set(data.map.getS(command.args[1].replace(".", "")), command);
    }
  }
  return result;
}

export function movesToHexes(data: Engine, moves: CommandObject[]): GaiaHex[] {
  return Array.from(buildingMovesByHex(data, moves).keys());
}

/** A move's last argument can keep the "." that separates it from the next command, e.g. "build m 3A4.". */
function cleanArg(arg: string | undefined): string {
  return (arg ?? "").replace(/\.+$/, "");
}

/** Which argument of a command names the hex it happened on. */
const hexArg: Partial<Record<Command, number>> = {
  [Command.Build]: 1,
  [Command.GaiaFormTransdim]: 0,
  [Command.PlaceLostPlanet]: 0,
  [Command.PlacePowerRing]: 0,
};

/**
 * Every hex a move put something on: a building or gaiaformer, instant gaiaforming, the Lost Planet,
 * a Power Ring, and all the members of a newly formed federation (whose own argument is one
 * comma-separated list of coordinates).
 */
export function hexMovesByHex(data: Engine, moves: CommandObject[]): Map<GaiaHex, CommandObject> {
  const result = new Map<GaiaHex, CommandObject>();
  const add = (coordinate: string, command: CommandObject) => {
    // map.parse() asserts on anything that isn't a coordinate. This runs while rendering an
    // arbitrary recorded move history, where a throw would blank the whole map (see PROGRESS #66),
    // so an unrecognized argument just goes unmarked.
    try {
      const hex = data.map.getS(cleanArg(coordinate));
      if (hex) {
        result.set(hex, command);
      }
    } catch {
      // not a hex - nothing to mark
    }
  };
  for (const command of moves) {
    const index = hexArg[command.command];
    if (index !== undefined && command.args[index]) {
      add(command.args[index], command);
    } else if (command.command === Command.FormFederation && command.args[0]) {
      for (const coordinate of cleanArg(command.args[0]).split(",")) {
        add(coordinate, command);
      }
    }
  }
  return result;
}

/** How a hex-marking move reads in that hex's tooltip. */
export function hexMoveLabel(command: CommandObject): string {
  switch (command.command as Command) {
    case Command.Build:
      return `build ${cleanArg(command.args[0])}`;
    case Command.GaiaFormTransdim:
      return "gaiaform";
    case Command.PlaceLostPlanet:
      return "place the Lost Planet";
    case Command.PlacePowerRing:
      return "place a Power Ring";
    case Command.FormFederation:
      return "form a federation";
    default:
      return cleanArg(command.command as string);
  }
}

/**
 * One command's first (or `index`-th) argument, grouped by the faction that played it - for every
 * mark that belongs to a specific player's own piece: their research token, their special action,
 * their exploration shuttle, their artifact.
 */
export function commandArgsByFaction<T extends string>(
  moves: CommandObject[],
  command: Command,
  index = 0
): Map<Faction, Set<T>> {
  const result = new Map<Faction, Set<T>>();
  for (const move of moves) {
    if (move.command === command && move.args[index]) {
      if (!result.has(move.faction)) {
        result.set(move.faction, new Set());
      }
      result.get(move.faction).add(cleanArg(move.args[index]) as T);
    }
  }
  return result;
}

/** One command and the argument of it that names a tile. */
export type TileArg = { command: Command; index?: number };

/**
 * The mirror of `commandArgsByFaction`: which factions claimed each tile. Tiles show up twice - once
 * in the shared pool (research board, sidebar, ship board) where nobody owns them, and once on the
 * board of whoever took one - so a pool copy asks "did anyone?" and a player's copy "did they?".
 */
export function factionsByCommandArg(moves: CommandObject[], slots: TileArg[]): Map<string, Set<Faction>> {
  const result = new Map<string, Set<Faction>>();
  for (const move of moves) {
    for (const slot of slots) {
      const value = move.command === slot.command ? cleanArg(move.args[slot.index ?? 0]) : "";
      if (value) {
        if (!result.has(value)) {
          result.set(value, new Set());
        }
        result.get(value).add(move.faction);
      }
    }
  }
  return result;
}

/** The power / QIC actions taken on the research board. */
export function boardActionMoves(moves: CommandObject[]): Set<BoardAction> {
  const result = new Set<BoardAction>();
  for (const command of moves) {
    if (command.command === Command.Action && command.args[0]) {
      result.add(cleanArg(command.args[0]) as BoardAction);
    }
  }
  return result;
}

/** A spaceship action octagon is addressed by both its ship and its type, e.g. "twilight-power". */
export function spaceshipActionKey(ship: Spaceship | string, type: string): string {
  return `${ship}-${type}`;
}

/** The Lost Fleet spaceship-board actions taken, as `spaceshipActionKey` keys. */
export function spaceshipActionMoves(moves: CommandObject[]): Set<string> {
  const result = new Set<string>();
  for (const command of moves) {
    if (command.command === Command.SpaceshipAction && command.args[0] && command.args[1]) {
      result.add(spaceshipActionKey(cleanArg(command.args[0]), cleanArg(command.args[1])));
    }
  }
  return result;
}

const outOfTurn = [Command.ChargePower, Command.BrainStone, Command.ChooseIncome, Command.Decline];

export function ownTurn(move?: ParsedMove): boolean {
  return !!move && move.commands.some((c) => !outOfTurn.includes(c.command));
}

export function parsedMove(move: string): ParsedMove {
  return { move: move, commands: parseCommands(move) };
}

export function parseMoves(moveHistory: string[]): ParsedMove[] {
  return moveHistory.map((move) => parsedMove(move));
}

export function recentMoves(player: PlayerEnum, logEntries: LogEntry[], moveHistory: string[]): MovesSlice {
  let last = logEntries.length;
  let lastMove = moveHistory.length;
  while (last > 0 && logEntries[last - 1].player === player) {
    const move = logEntries[last - 1].move;
    if (move) {
      lastMove = move;
    }
    last--;
  }

  const moves = parseMoves(moveHistory);

  const firstEntry = findLast(
    logEntries.slice(0, last),
    (logItem) => logItem.player === player && logItem.move && ownTurn(moves[logItem.move])
  ) as LogEntry | undefined;
  const firstMove = firstEntry?.move;

  return firstMove != null
    ? { index: firstMove, moves: moves.slice(firstMove, lastMove), allMoves: moves }
    : { index: -1, moves: [], allMoves: moves };
}

/** A move together with its absolute position in `moveHistory` - the only stable identity a single
 * move has, since the same move string can legitimately be played twice. */
export type IndexedMove = { index: number; move: ParsedMove };

/**
 * The recap window (starts after the viewer's previous own turn, ignores leech/income replies), with
 * each move's absolute `moveHistory` index attached. `MovesSlice.moves` is already a slice starting
 * at `recent.index`, so the index is just the offset added back on.
 *
 * The indices are what lets a consumer remember which recap lines have been read:
 * "seen through move 14" survives a reload, whereas a position within the
 * window would silently mean something else as soon as the window moves.
 */
export function opponentTurnsSinceLastTurn(recent: MovesSlice): IndexedMove[] {
  return recent.moves
    .map((move, offset) => ({ index: recent.index + offset, move }))
    .slice(1)
    .filter((entry) => ownTurn(entry.move));
}

/** The recap window starts after the viewer's previous own turn and ignores leech/income replies. */
export function opponentMovesSinceLastTurn(recent: MovesSlice): ParsedMove[] {
  return opponentTurnsSinceLastTurn(recent).map((entry) => entry.move);
}

export function roundMoves(logEntries: LogEntry[], moveHistory: string[]) {
  const roundEntryIndex = findLastIndex(logEntries, (logItem) => "round" in logItem);
  const moveIndex = logEntries.slice(roundEntryIndex + 1).find((logItem) => !!logItem.move)?.move;
  return moveIndex ? moveHistory.slice(moveIndex) : [];
}

export function markBuilding(
  i: number,
  currentRound: number,
  buildings: number,
  builtForType: number,
  possibleBuildings: number
): boolean {
  const max = Math.max(Math.min(currentRound, possibleBuildings), buildings);

  return i >= max - builtForType && i < max;
}

export function researchClasses(
  recent: CommandObject[],
  round: CommandObject[]
): Map<Faction, Map<ResearchField, "recent" | "current-round">> {
  const classes = new Map<Faction, Map<ResearchField, "recent" | "current-round">>();
  for (const move of round) {
    if (move.command === Command.UpgradeResearch) {
      if (!classes.has(move.faction)) {
        classes.set(move.faction, new Map());
      }
      classes.get(move.faction).set(move.args[0] as ResearchField, "current-round");
    }
  }
  for (const move of recent) {
    if (move.command === Command.UpgradeResearch) {
      if (!classes.has(move.faction)) {
        classes.set(move.faction, new Map());
      }
      classes.get(move.faction).set(move.args[0] as ResearchField, "recent");
    }
  }
  return classes;
}
