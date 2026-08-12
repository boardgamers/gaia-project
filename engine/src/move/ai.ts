import seedrandom from "seedrandom";
import {
  AvailableBuilding,
  AvailableCommand,
  AvailableFreeAction,
  AvailableMoveShipData,
  AvailableShipAction,
  Offer,
  PossibleBid,
  ShipAction,
  TradingLocation,
} from "../available/types";
import Engine from "../engine";
import { Command, Player as PlayerEnum } from "../enums";
import { AvailableSetupOption } from "../setup";

/**
 * Deterministic PRNG for bot moves.
 *
 * Seeded from the game seed (extracted from the `init` move, so it survives
 * serialization) and the current position in the move history. Bot moves are
 * recorded in the move history like any other move, and regular moves do not
 * use this PRNG, so replaying a game produces the same bot choices.
 *
 * `salt` differentiates successive attempts when a random move turns out to be
 * a dead end.
 */
function rngOf(engine: Engine, salt = 0): () => number {
  const init = engine.moveHistory[0] ?? "";
  const seed = /^init \d+ (.+)$/.exec(init)?.[1] ?? "bot";
  return seedrandom(`${seed}:${engine.moveHistory.length}:${salt}`);
}

/**
 * Pick a random element of an array.
 */
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Commands that don't end the turn on their own (free actions / no-op) */
const freeCommands = [Command.Spend, Command.BurnPower, Command.EndTurn];

/**
 * Generate a random legal move for the given player ("dumb AF" bot for UI testing,
 * not a real AI).
 *
 * The returned move only uses commands & arguments advertised by the engine's
 * available commands, so it is always legal.
 */
export function moveAI(engine: Engine, player: PlayerEnum, salt = 0): string {
  const commands = engine
    .generateAvailableCommandsIfNeeded()
    .filter((cmd) => cmd.player === player && cmd.name !== Command.DeadEnd);

  const find = <C extends Command>(command: C) =>
    commands.find((cmd) => cmd.name === command) as AvailableCommand<C> | undefined;

  const rng = rngOf(engine, salt);
  const randomOffer = (offers: Offer[]) => pick(rng, offers).offer;
  const randomBuilding = (buildings: AvailableBuilding[]) => {
    const building = pick(rng, buildings);
    return `${building.building} ${building.coordinates}`;
  };

  // Main commands: playing one of them (plus the follow-ups it triggers) is
  // what ends the player's turn
  const mainCommands: [Command, (cmd: AvailableCommand) => string][] = [
    [
      Command.ChargePower,
      (cmd: AvailableCommand<Command.ChargePower>) => `${Command.ChargePower} ${randomOffer(cmd.data.offers)}`,
    ],
    [Command.Decline, (cmd: AvailableCommand<Command.Decline>) => `${Command.Decline} ${cmd.data.offers[0].offer}`],
    [
      Command.ChooseIncome,
      (cmd: AvailableCommand<Command.ChooseIncome>) => `${Command.ChooseIncome} ${pick(rng, cmd.data)}`,
    ],
    [
      Command.BrainStone,
      (cmd: AvailableCommand<Command.BrainStone>) => `${Command.BrainStone} ${pick(rng, cmd.data.choices).area}`,
    ],
    [Command.Setup, (cmd: AvailableCommand<Command.Setup>) => randomSetupOption(rng, cmd.data)],
    [Command.RotateSectors, () => Command.RotateSectors],
    [
      Command.ChooseFaction,
      (cmd: AvailableCommand<Command.ChooseFaction>) => `${Command.ChooseFaction} ${pick(rng, cmd.data)}`,
    ],
    [Command.Bid, (cmd: AvailableCommand<Command.Bid>) => randomBid(rng, cmd.data.bids)],
    [Command.Build, (cmd: AvailableCommand<Command.Build>) => `${Command.Build} ${randomBuilding(cmd.data.buildings)}`],
    [
      Command.PISwap,
      (cmd: AvailableCommand<Command.PISwap>) => `${Command.PISwap} ${randomBuilding(cmd.data.buildings)}`,
    ],
    [
      Command.PlaceLostPlanet,
      (cmd: AvailableCommand<Command.PlaceLostPlanet>) =>
        `${Command.PlaceLostPlanet} ${pick(rng, cmd.data.spaces).coordinates}`,
    ],
    [Command.MoveShip, (cmd: AvailableCommand<Command.MoveShip>) => randomShipMove(rng, cmd.data)],
    [
      Command.Special,
      (cmd: AvailableCommand<Command.Special>) => `${Command.Special} ${pick(rng, cmd.data.specialacts).income}`,
    ],
    [
      Command.Action,
      (cmd: AvailableCommand<Command.Action>) => `${Command.Action} ${pick(rng, cmd.data.poweracts).name}`,
    ],
    [
      Command.UpgradeResearch,
      (cmd: AvailableCommand<Command.UpgradeResearch>) =>
        `${Command.UpgradeResearch} ${pick(rng, cmd.data.tracks).field}`,
    ],
    [
      Command.ChooseTechTile,
      (cmd: AvailableCommand<Command.ChooseTechTile>) => `${Command.ChooseTechTile} ${pick(rng, cmd.data.tiles).pos}`,
    ],
    [
      Command.ChooseCoverTechTile,
      (cmd: AvailableCommand<Command.ChooseCoverTechTile>) =>
        `${Command.ChooseCoverTechTile} ${pick(rng, cmd.data.tiles).pos}`,
    ],
    [
      Command.FormFederation,
      (cmd: AvailableCommand<Command.FormFederation>) =>
        cmd.data.federations.length > 0
          ? `${Command.FormFederation} ${pick(rng, cmd.data.federations).hexes} ${pick(rng, cmd.data.tiles)}`
          : null,
    ],
    [
      Command.ChooseFederationTile,
      (cmd: AvailableCommand<Command.ChooseFederationTile>) =>
        `${Command.ChooseFederationTile} ${pick(rng, cmd.data.tiles)}`,
    ],
    [Command.Pass, (cmd: AvailableCommand<Command.Pass>) => `${Command.Pass} ${pick(rng, cmd.data.boosters)}`],
    [
      Command.ChooseRoundBooster,
      (cmd: AvailableCommand<Command.ChooseRoundBooster>) =>
        `${Command.ChooseRoundBooster} ${pick(rng, cmd.data.boosters)}`,
    ],
  ];

  for (const [command, handler] of mainCommands) {
    const cmd = find(command);
    if (cmd) {
      const move = handler(cmd);
      if (move) {
        return `${playerPrefix(engine, player)} ${move}`;
      }
    }
  }

  // Free commands: they don't end the turn on their own, add an endturn so the
  // move is complete
  for (const command of freeCommands) {
    const cmd = find(command);
    if (cmd) {
      return `${playerPrefix(engine, player)} ${freeCommandMove(rng, cmd)}. ${Command.EndTurn}`;
    }
  }

  return null;
}

/**
 * Generate a random command to append to the ongoing turn, without a player
 * prefix. Used to complete a turn once a move has already been started.
 */
export function appendCommand(engine: Engine, player: PlayerEnum, salt = 0): string {
  const commands = engine
    .generateAvailableCommandsIfNeeded()
    .filter((cmd) => cmd.player === player && cmd.name !== Command.DeadEnd);

  const rng = rngOf(engine, salt);
  const find = <C extends Command>(command: C) =>
    commands.find((cmd) => cmd.name === command) as AvailableCommand<C> | undefined;

  // Follow-up decisions triggered by the previous command(s) of the turn
  const techTile = find(Command.ChooseTechTile);
  if (techTile) {
    return `${Command.ChooseTechTile} ${pick(rng, techTile.data.tiles).pos}`;
  }

  const coverTechTile = find(Command.ChooseCoverTechTile);
  if (coverTechTile) {
    return `${Command.ChooseCoverTechTile} ${pick(rng, coverTechTile.data.tiles).pos}`;
  }

  const upgradeResearch = find(Command.UpgradeResearch);
  if (upgradeResearch) {
    return `${Command.UpgradeResearch} ${pick(rng, upgradeResearch.data.tracks).field}`;
  }

  const federationTile = find(Command.ChooseFederationTile);
  if (federationTile) {
    return `${Command.ChooseFederationTile} ${pick(rng, federationTile.data.tiles)}`;
  }

  const build = find(Command.Build);
  if (build) {
    const building = pick(rng, build.data.buildings);
    return `${Command.Build} ${building.building} ${building.coordinates}`;
  }

  const lostPlanet = find(Command.PlaceLostPlanet);
  if (lostPlanet) {
    return `${Command.PlaceLostPlanet} ${pick(rng, lostPlanet.data.spaces).coordinates}`;
  }

  const brainstone = find(Command.BrainStone);
  if (brainstone) {
    return `${Command.BrainStone} ${pick(rng, brainstone.data.choices).area}`;
  }

  // Free commands (spend / burn), to be able to afford the follow-ups above
  for (const command of [Command.Spend, Command.BurnPower] as const) {
    const cmd = find(command);
    if (cmd) {
      return freeCommandMove(rng, cmd);
    }
  }

  if (find(Command.EndTurn)) {
    return Command.EndTurn;
  }

  return null;
}

function playerPrefix(engine: Engine, player: PlayerEnum): string {
  return engine.player(player)?.faction ?? `p${player + 1}`;
}

function randomSetupOption(rng: () => number, cmd: AvailableSetupOption): string {
  return `${Command.Setup} ${cmd.type} ${cmd.position} to ${pick(rng, cmd.options)}`;
}

function randomBid(rng: () => number, bids: PossibleBid[]): string {
  const bid = pick(rng, bids);
  return `${Command.Bid} ${bid.faction} ${pick(rng, bid.bid)}`;
}

function randomFreeAction(rng: () => number, acts: AvailableFreeAction[]): string {
  const act = pick(
    rng,
    acts.filter((a) => !a.hide)
  );
  return `${act.cost} for ${act.income}`;
}

function randomShipMove(rng: () => number, data: AvailableMoveShipData[]): string {
  const ship = pick(rng, data);
  const target = pick(rng, ship.targets);
  const action = randomShipAction(rng, target.actions);

  return `${Command.MoveShip} ${ship.ship} ${ship.source} ${target.location.coordinates}${action}`;
}

function randomShipAction(rng: () => number, actions: AvailableShipAction[]): string {
  const choices = (actions ?? []).filter((action) => action.type !== ShipAction.Nothing && action.locations.length > 0);

  if (choices.length === 0) {
    return "";
  }

  const action = pick(rng, choices);
  const location = pick(rng, action.locations);

  // `cost` contains the satellite cost for trading locations near other players'
  // structures, it is not part of the command
  const tradeCost = (location as TradingLocation).tradeCost;
  const cost = tradeCost ? ` ${tradeCost}` : "";

  return ` ${action.type} ${location.coordinates}${cost}`;
}

function freeCommandMove(rng: () => number, cmd: AvailableCommand): string {
  switch (cmd.name) {
    case Command.Spend:
      return `${Command.Spend} ${randomFreeAction(rng, (cmd as AvailableCommand<Command.Spend>).data.acts)}`;
    case Command.BurnPower:
      return `${Command.BurnPower} ${pick(rng, (cmd as AvailableCommand<Command.BurnPower>).data)}`;
    default:
      return Command.EndTurn;
  }
}
