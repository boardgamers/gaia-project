import Engine, { Command, GaiaHex, LogEntry, PlayerEnum } from "@gaia-project/engine";
import { findLast, findLastIndex } from "lodash";

export function movesToHexes(data: Engine, moves: string[]): GaiaHex[] {
  return moves.flatMap((move) => {
    const args = data.parseMove(move).args;
    const number = args.indexOf("build");
    if (number >= 0) {
      const coord = args[number + 2].replace(".", "");
      const hex = data.map.getS(coord);
      return [hex];
    }
    return [];
  });
}

function ownTurn(move: string): boolean {
  if (move == null) {
    return false;
  }
  const outOfTurn = [Command.ChargePower, Command.BrainStone, Command.ChooseIncome, Command.Decline];
  return !outOfTurn.some((command) => move.includes(command));
}

export function recentMoves(player: PlayerEnum, logEntries: LogEntry[], moveHistory: string[]) {
  let last = logEntries.length;
  let lastMove = moveHistory.length;
  while (last > 0 && logEntries[last - 1].player === player) {
    const move = logEntries[last - 1].move;
    if (move) {
      lastMove = move;
    }
    last--;
  }

  const firstMove = findLast(
    logEntries.slice(0, last),
    (logItem) => logItem.player === player && ownTurn(moveHistory[logItem.move])
  )?.move;
  return firstMove ? moveHistory.slice(firstMove + 1, lastMove) : [];
}

export function roundMoves(logEntries: LogEntry[], moveHistory: string[]) {
  const roundEntryIndex = findLastIndex(logEntries, (logItem) => "round" in logItem);
  const moveIndex = logEntries.slice(roundEntryIndex + 1).find((logItem) => !!logItem.move)?.move;
  return moveIndex ? moveHistory.slice(moveIndex) : [];
}
