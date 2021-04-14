import Engine, { Command, Faction, GaiaHex, LogEntry, PlayerEnum, ResearchField } from "@gaia-project/engine";
import { findLast, findLastIndex } from "lodash";

export type CommandObject = { faction: Faction; command: Command; args: string[] };

export function parseCommands(move: string): CommandObject[] {
  move = move.trim();
  const factionIndex = move.indexOf(" ");
  const faction = move.substring(0, factionIndex) as Faction;

  return move
    .slice(factionIndex)
    .split(".")
    .filter((c) => c.length > 0)
    .map((c) => {
      const split = c.trim().split(" ");

      return {
        faction: faction,
        command: split[0] as Command,
        args: split.slice(1),
      };
    });
}

export function movesToHexes(data: Engine, moves: CommandObject[]): GaiaHex[] {
  return moves.flatMap((c) => {
    if (c.command == Command.Build) {
      const coord = c.args[1].replace(".", "");
      const hex = data.map.getS(coord);
      return [hex];
    }
    return [];
  });
}

export function ownTurn(move: string): boolean {
  if (move == null) {
    return false;
  }
  const outOfTurn = [Command.ChargePower, Command.BrainStone, Command.ChooseIncome, Command.Decline];
  return !outOfTurn.some((command) => move.includes(command));
}

export type RecentMoves = { index: number; moves: string[] };

export function recentMoves(player: PlayerEnum, logEntries: LogEntry[], moveHistory: string[]): RecentMoves {
  let last = logEntries.length;
  let lastMove = moveHistory.length;
  while (last > 0 && logEntries[last - 1].player === player) {
    const move = logEntries[last - 1].move;
    if (move) {
      lastMove = move;
    }
    last--;
  }

  const firstEntry = findLast(
    logEntries.slice(0, last),
    (logItem) => logItem.player === player && logItem.move && ownTurn(moveHistory[logItem.move])
  ) as LogEntry | undefined;
  const firstMove = firstEntry?.move;
  return firstMove
    ? { index: logEntries.indexOf(firstEntry), moves: moveHistory.slice(firstMove, lastMove) }
    : { index: 0, moves: [] };
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
