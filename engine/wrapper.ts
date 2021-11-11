import assert from "assert";
import crypto from "crypto";
import { set } from "lodash";
import Engine, { EngineOptions } from "./src/engine";
import { Round } from "./src/enums";
import { defaultAutoCharge } from "./src/player";

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

export function logLength(engine: Engine) {
  return engine.moveHistory.length;
}

export function logSlice(engine: Engine, options?: { player?: number; start?: number; end?: number }) {
  return {
    state: engine, // to remove later
    log: engine.moveHistory.slice(options?.start, options?.end),
    availableMoves: engine.availableCommands, // todo: if end !== undefined, get the available moves from back then?
  };
}

export function round(engine: Engine) {
  return engine.round;
}
