import { possibleLeech } from "./available/leech";
import type { AvailableCommand } from "./available/types";
import type Engine from "./engine";
import { Command, Phase, Player as Seat } from "./enums";
import assert from "./utils/assert";

export interface PendingCharge {
  id: number;
  player: Seat;
  source: { player: Seat; coordinates: string };
  amount: number;
}

export function hasConcurrentCharges(engine: Engine): boolean {
  return engine.options.concurrentCharges === true && [Phase.RoundMove, Phase.RoundLeech].includes(engine.phase);
}

export function chargeFor(engine: Engine, seat: Seat): PendingCharge | undefined {
  return engine.pendingCharges.find((charge) => charge.player === seat);
}

export function waitingForCharges(engine: Engine, seat: Seat): boolean {
  return engine.pendingCharges.some((charge) => engine.chargeWaits[seat]?.includes(charge.id));
}

export function chargesToWaitFor(engine: Engine, seat: Seat): number[] {
  const own = chargeFor(engine, seat);
  // A charge can wait only for earlier offers. Waiting never introduces a cycle.
  return engine.pendingCharges
    .filter((charge) => charge.player !== seat && (own ? charge.id < own.id : seat === engine.currentPlayer))
    .map((charge) => charge.id);
}

export function canTakeTurn(engine: Engine, seat: Seat): boolean {
  return (
    seat !== undefined && seat === engine.currentPlayer && !chargeFor(engine, seat) && !waitingForCharges(engine, seat)
  );
}

export function chargeDecisionSeats(engine: Engine): Seat[] {
  const seats = [...new Set(engine.pendingCharges.map((charge) => charge.player))];
  if (canTakeTurn(engine, engine.currentPlayer)) seats.push(engine.currentPlayer);
  return [...new Set(seats)].filter((seat) => !waitingForCharges(engine, seat));
}

export function refreshPendingCharges(engine: Engine) {
  for (const player of engine.players) {
    let charge = chargeFor(engine, player.player);
    player.data.leechPossible = charge?.amount ?? 0;
    while (charge && !player.canLeech()) {
      engine.pendingCharges.splice(engine.pendingCharges.indexOf(charge), 1);
      charge = chargeFor(engine, player.player);
      player.data.leechPossible = charge?.amount ?? 0;
    }
  }
  for (const seat of Object.keys(engine.chargeWaits)) {
    if (!waitingForCharges(engine, Number(seat))) delete engine.chargeWaits[seat];
  }
}

export function pendingChargeCommands(engine: Engine): AvailableCommand[] {
  const commands: AvailableCommand[] = [];
  for (const seat of [...new Set(engine.pendingCharges.map((charge) => charge.player)), engine.currentPlayer]) {
    if (seat === undefined) continue;
    if (commands.some((command) => command.player === seat)) continue;
    if (waitingForCharges(engine, seat)) {
      commands.push({ name: Command.ResumeCharges, player: seat });
      continue;
    }
    const charge = chargeFor(engine, seat);
    if (charge) {
      commands.push(
        ...possibleLeech(engine, seat).map((command) => ({
          ...command,
          data: { ...command.data, requestId: charge.id, source: charge.source },
        }))
      );
    }
    if (chargesToWaitFor(engine, seat).length) commands.push({ name: Command.WaitForCharges, player: seat });
  }
  return commands;
}

export function changeChargeWait(engine: Engine, seat: Seat, command: Command) {
  if (command === Command.ResumeCharges) {
    assert(waitingForCharges(engine, seat), "You are not waiting for charges");
    delete engine.chargeWaits[seat];
  } else {
    const ids = chargesToWaitFor(engine, seat);
    assert(ids.length > 0 && !waitingForCharges(engine, seat), "No earlier charge decisions to wait for");
    engine.chargeWaits[seat] = ids;
  }
}
