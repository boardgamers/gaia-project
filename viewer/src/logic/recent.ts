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
import { findLast, findLastIndex } from "lodash";

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
  return [...buildingMovesByHex(data, moves).keys()];
}

/** A move's last argument can keep the "." that separates it from the next command, e.g. "build m 3A4.". */
function cleanArg(arg: string | undefined): string {
  return (arg ?? "").replace(/\.+$/, "");
}

/** Which research tracks each faction advanced - keyed like `researchClasses` so both can mark the same token. */
export function researchMovesByFaction(moves: CommandObject[]): Map<Faction, Set<ResearchField>> {
  const result = new Map<Faction, Set<ResearchField>>();
  for (const command of moves) {
    if (command.command === Command.UpgradeResearch && command.args[0]) {
      if (!result.has(command.faction)) {
        result.set(command.faction, new Set());
      }
      result.get(command.faction).add(cleanArg(command.args[0]) as ResearchField);
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

/** The recap window starts after the viewer's previous own turn and ignores leech/income replies. */
export function opponentMovesSinceLastTurn(recent: MovesSlice): ParsedMove[] {
  return recent.moves.slice(1).filter(ownTurn);
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
