import axios from 'axios';
import Engine from './index';
import crypto from "crypto";
import { EngineOptions } from './src/engine';
import { Round } from './src/enums';
import assert from "assert";

export async function init (nbPlayers: number, expansions: string[], options: EngineOptions & {balancedGeneration: boolean}, seed?: string): Promise<Engine> {
  if (!seed) {
    seed = crypto.randomBytes(8).toString('base64');
  }

  let numberSeed: number;
  // If the seed is a number, use it directly, otherwise use a number generated from its hash
  if ('' + parseInt(seed, 10) === seed) {
    numberSeed = parseInt(seed, 10);
  } else {
    const md5sum = crypto.createHash("md5");
    md5sum.update(seed);
    numberSeed = ('' + parseInt(seed, 10)) === seed ? parseInt(seed, 10) : parseInt(md5sum.digest("hex").slice(-10), 16);
  }

  if (expansions.includes("spaceships")) {
    options.spaceShips = true;
  }

  if (options.balancedGeneration) {
    delete options.balancedGeneration;

    const resp = await axios.post('http://gaia-project.hol.es', {seed: numberSeed, player: nbPlayers}).then(r => r.data);

    options.map = {sectors: resp.map};

    // We use different standards for sides A & B of sectors than the online generator
    if (nbPlayers === 2) {
      options.map.sectors.forEach(val => val.sector = val.sector.replace(/A/, 'B'));
    } else {
      options.map.sectors.forEach(val => val.sector = val.sector.replace(/B/, 'A'));
    }
  }

  const engine = new Engine([`init ${nbPlayers} ${seed}`], options);
  engine.generateAvailableCommandsIfNeeded();

  return engine;
}

export function setPlayerMetaData(engine: Engine, player: number, metaData: {name: string}) {
  engine.players[player].name = metaData.name;

  return engine;
}

export async function move(engine: Engine, move: string, player: number) {
  if (!move) {
    // Don't save
    (engine as any).noSave = true;
    return engine;
  }

  if (!(engine instanceof Engine)) {
    engine = Engine.fromData(engine);
  }

  const round = engine.round;
  engine.move(move);
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

function automove(engine: Engine) {
  let modified: boolean;
  do {
    modified = false;
    let oldRound = engine.round;

    while (!cancelled(engine) && !ended(engine) && engine.player(engine.playerToMove).dropped) {
      engine.autoPass();

      afterMove(engine, oldRound);
      modified = true;
      oldRound = engine.round;
    }

    oldRound = engine.round;

    while (engine.autoChargePower()) {
      afterMove(engine, oldRound);
      modified = true;
      oldRound = engine.round;
    }
  } while (modified);
}

export function ended (engine: Engine) {
  return engine.ended;
}

export function cancelled (engine: Engine) {
  return engine.ended && engine.round < Round.LastRound;
}

export function scores (engine: Engine) {
  return engine.players.map(pl => pl.data.victoryPoints);
}

export function factions (engine: Engine) {
  return engine.players.map(pl => pl.faction);
}

export async function replay (engine: Engine) {
  const oldPlayers = engine.players;

  engine = new Engine(engine.moveHistory, engine.options);

  assert(engine.newTurn, "Last move of the game is incomplete");

  for (let i = 0; i < oldPlayers.length && i < engine.players.length; i++) {
    engine.players[i].name = oldPlayers[i].name;
    engine.players[i].dropped = oldPlayers[i].dropped;
  }

  engine.generateAvailableCommandsIfNeeded();

  automove(engine);

  delete (engine as any).messages;

  return engine;
}

export async function dropPlayer (engine: Engine, player: number) {
  engine = engine instanceof Engine ? engine : Engine.fromData(engine);

  engine.players[player].dropped = true;

  if (engine.round <= 0) {
    engine.ended = true;
  } else {
    automove(engine);
  }

  return engine;
}

export function currentPlayer (engine: Engine) {
  return engine.playerToMove;
}

export function toSave (engine: Engine) {
  if (!engine.newTurn || (engine as any).noSave) {
    return undefined;
  }
  return engine;
}

export function messages (engine: Engine) {
  const messages = (engine as any).messages || [];
  delete (engine as any).messages;

  return {
    messages,
    data: engine
  };
}

export function logLength (engine: Engine) {
  return engine.moveHistory.length;
}

export function logSlice (engine: Engine, options?: {player?: number; start?: number; end?: number}) {
  return {state: engine};
}

export function round(engine: Engine) {
  return engine.round;
}
