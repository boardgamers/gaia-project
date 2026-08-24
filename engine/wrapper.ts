import crypto from "crypto";
import { set } from "lodash";
import Engine, { EngineOptions } from "./src/engine";
import { Phase, Round } from "./src/enums";
import {
  defaultAutoCharge,
  defaultAutoChargeMaxPassedRoundLeech,
  defaultAutoChargeTargetSpendablePower,
} from "./src/player";
import assert from "./src/utils/assert";

export async function init(
  nbPlayers: number,
  expansions: string[],
  options: EngineOptions,
  seed?: string,
  creator?: number
): Promise<Engine> {
  if (!seed) {
    seed = crypto.randomBytes(8).toString("base64");
  }
  if (creator && creator >= 0) {
    options.creator = creator;
  }

  if (expansions.includes("frontiers")) {
    options.frontiers = true;
  }

  if (expansions.includes("lost-fleet")) {
    options.lostFleet = true;
  }

  const engine = new Engine([`init ${nbPlayers} ${seed}`], options);
  engine.generateAvailableCommandsIfNeeded();

  automove(engine);

  return engine;
}

export function setPlayerMetaData(engine: Engine, player: number, metaData: { name: string }) {
  engine.players[player].name = metaData.name;

  return engine;
}

export function setPlayerSettings(
  engine: Engine,
  player: number,
  settings: {
    autoCharge?: string;
    autoChargeTargetSpendablePower?: string;
    autoChargeMaxPassedRoundLeech?: string;
    autoIncome?: boolean;
    autoBrainstone?: boolean;
    itarsAutoChargeToArea3?: boolean;
  }
) {
  if ("autoCharge" in settings) {
    set(
      engine.players[player],
      "settings.autoChargePower",
      isNaN(settings.autoCharge as any) ? settings.autoCharge : Number(settings.autoCharge)
    );
  }
  if ("autoChargeTargetSpendablePower" in settings) {
    set(
      engine.players[player],
      "settings.autoChargeTargetSpendablePower",
      Number(settings.autoChargeTargetSpendablePower)
    );
  }
  if ("autoChargeMaxPassedRoundLeech" in settings) {
    set(
      engine.players[player],
      "settings.autoChargeMaxPassedRoundLeech",
      Number(settings.autoChargeMaxPassedRoundLeech)
    );
  }
  if ("autoIncome" in settings) {
    set(engine.players[player], "settings.autoIncome", settings.autoIncome);
  }
  if ("autoBrainstone" in settings) {
    set(engine.players[player], "settings.autoBrainstone", settings.autoBrainstone);
  }
  if ("itarsAutoChargeToArea3" in settings) {
    set(engine.players[player], "settings.itarsAutoChargeToArea3", settings.itarsAutoChargeToArea3);
  }

  return engine;
}

export function playerSettings(engine: Engine, player: number) {
  return {
    autoCharge: String(engine.players[player].settings?.autoChargePower ?? defaultAutoCharge),
    autoChargeTargetSpendablePower: String(
      engine.players[player].settings?.autoChargeTargetSpendablePower ?? defaultAutoChargeTargetSpendablePower
    ),
    autoChargeMaxPassedRoundLeech: String(
      engine.players[player].settings?.autoChargeMaxPassedRoundLeech ?? defaultAutoChargeMaxPassedRoundLeech
    ),
    autoIncome: !!engine.players[player].settings?.autoIncome,
    autoBrainstone: !!engine.players[player].settings?.autoBrainstone,
    itarsAutoChargeToArea3: !!engine.players[player].settings?.itarsAutoChargeToArea3,
  };
}

export function move(engine: Engine, move: string, player: number) {
  if (!move) {
    // Don't save
    (engine as any).noSave = true;
    return engine;
  }

  if (!(engine instanceof Engine)) {
    engine = Engine.fromData(engine);
  }

  const round = engine.round;
  const backup = JSON.stringify(engine);

  engine.move(move);

  if (!engine.newTurn) {
    // Try to complete the move for the player, e.g. if the player does not have auto brainstone
    // but does have auto charge

    const copy = Engine.fromData(JSON.parse(backup));

    if (copy.autoMove(move)) {
      engine = copy;
    }
  }

  engine.generateAvailableCommandsIfNeeded();

  if (engine.newTurn) {
    afterMove(engine, round);

    automove(engine);
  }

  return engine;
}

function afterMove(engine: Engine, oldRound: number) {
  if (engine.round > oldRound && engine.round > 0) {
    (engine as any).messages = [...((engine as any).messages || []), `Round ${engine.round}`];
  }
}

export function automove(engine: Engine) {
  let modified: boolean;
  do {
    modified = false;
    let oldRound = engine.round;

    while (!cancelled(engine) && !ended(engine) && engine.player(engine.playerToMove).dropped) {
      assert(engine.autoMove(undefined, { autoPass: true }), "Autopass not working");

      afterMove(engine, oldRound);
      modified = true;
      oldRound = engine.round;
    }

    oldRound = engine.round;

    while (engine.autoMove()) {
      afterMove(engine, oldRound);
      modified = true;
      oldRound = engine.round;
    }
  } while (modified);
}

export function ended(engine: Engine) {
  return engine.ended;
}

export function cancelled(engine: Engine) {
  return engine.ended && engine.round < Round.LastRound;
}

export function scores(engine: Engine) {
  return engine.players.map((pl) => pl.data.victoryPoints);
}

export function factions(engine: Engine) {
  return engine.players.map((pl) => pl.faction);
}

export async function replay(engine: Engine, { to = Infinity } = { to: Infinity }): Promise<Engine> {
  if (!(engine instanceof Engine)) {
    engine = Engine.fromData(engine);
  }

  engine = engine.replayedTo(to, false);

  automove(engine);

  delete (engine as any).messages;

  return engine;
}

export function moveAI(engine: Engine, player: number) {
  if (!(engine instanceof Engine)) {
    engine = Engine.fromData(engine);
  }

  if (engine.ended || engine.playerToMove !== player) {
    return engine;
  }

  const round = engine.round;

  if (engine.moveAI()) {
    afterMove(engine, round);
    engine.generateAvailableCommandsIfNeeded();
    // resolve forced / trivial decisions (free leech, income, ...) so the game
    // can advance to the next bot move
    automove(engine);
  }

  return engine;
}

export async function dropPlayer(engine: Engine, player: number) {
  engine = engine instanceof Engine ? engine : Engine.fromData(engine);

  engine.players[player].dropped = true;

  if (engine.round <= 0) {
    engine.ended = true;
  } else {
    automove(engine);
  }

  return engine;
}

export function currentPlayer(engine: Engine) {
  return engine.playerToMove;
}

export function toSave(engine: Engine) {
  if (!engine.newTurn || (engine as any).noSave) {
    return undefined;
  }
  return engine;
}

export function messages(engine: Engine) {
  const messages = (engine as any).messages || [];
  delete (engine as any).messages;

  return {
    messages,
    data: engine,
  };
}

/** `p3 silentBid ...` / `p3 preferenceBid ...` → seat index 2, or null for any other move. */
function sealedBidMovePlayer(move: string): number | null {
  const match = /^p(\d+)\s+(?:silentBid|preferenceBid)\b/.exec(move.trim());
  return match ? Number(match[1]) - 1 : null;
}

/**
 * Hide other seats' sealed bids while a silent / preference-split auction round is being
 * collected. The bid phases are sequential in-engine (one seat at a time), but nothing is
 * derived from a bid until the last one lands, so sequential-but-hidden is equivalent to a
 * simultaneous sealed round: the only thing other clients may learn is WHO has already bid
 * (the UI shows that roster anyway), never the values or preference order.
 *
 * Masking is phase-scoped (same pattern as take6's face-down cards): once the engine leaves
 * the bid phase the reveal has happened and the true moves/bids are public again - clients
 * simply re-fetch the log. While the phase is in progress, a masked bid move is served as
 * `pN silentBid` (well-formed command, no arguments), and the engine-level bid arrays keep
 * only the `player` field for foreign seats so the "already submitted" roster keeps working.
 */
export function stripSecret(engine: Engine, player?: number): Engine {
  // Plain-JSON copy: this runs on both live Engine instances and the saved plain data, and the
  // platform JSON-serializes whatever we return anyway.
  const data = JSON.parse(JSON.stringify(engine)) as Engine;

  if (data.phase !== Phase.SetupSilentBid && data.phase !== Phase.SetupPreferenceBid) {
    return data;
  }

  data.silentAuctionBids = (data.silentAuctionBids ?? []).map((bid) =>
    bid.player === player ? bid : ({ player: bid.player } as typeof bid)
  );
  data.preferenceSplitBids = (data.preferenceSplitBids ?? []).map((bid) =>
    bid.player === player ? bid : ({ player: bid.player } as typeof bid)
  );
  data.moveHistory = data.moveHistory.map((move) => {
    const bidder = sealedBidMovePlayer(move);
    if (bidder === null || bidder === player) {
      return move;
    }
    // Keep the seat + command so log rendering can still label the row, drop the arguments.
    return move.trim().split(/\s+/).slice(0, 2).join(" ");
  });

  return data;
}

export function logLength(engine: Engine) {
  return engine.moveHistory.length;
}

export function logSlice(engine: Engine, options?: { player?: number; start?: number; end?: number }) {
  const stripped = stripSecret(engine, options?.player);
  return {
    state: stripped, // to remove later
    log: stripped.moveHistory.slice(options?.start, options?.end),
    availableMoves: engine.availableCommands, // todo: if end !== undefined, get the available moves from back then?
  };
}

export function round(engine: Engine) {
  return engine.round;
}
