import assert from "assert";
import { ChargeDecision, ChargeRequest, decideChargeRequest } from "../auto-charge";
import { AvailableCommand, AvailableFreeActionData } from "../available/types";
import Engine from "../engine";
import { Command, Faction, PowerArea, Resource } from "../enums";

/** Automatically generate moves based on player settings */
export function autoMove(engine: Engine, partialMove?: string, options?: { autoPass?: boolean }): boolean {
  if (engine.playerToMove === undefined) {
    return false;
  }

  const toMove = engine.playerToMove;
  const factionOrPlayer = engine.player(toMove).faction ?? `p${toMove + 1}`;

  let _copy: Engine;
  const copy = () => _copy || (_copy = Engine.fromData(JSON.parse(JSON.stringify(engine))));
  // copy() could be used instead, but engine is an optimisation for when we don't need to create a copy
  // if it doesn't already exist
  const copyOrThis = () => _copy || engine;

  const functions = [
    [
      Command.ChooseFaction,
      (cmd: AvailableCommand) => autoChooseFaction(copyOrThis(), cmd as AvailableCommand<Command.ChooseFaction>),
    ],
    [
      Command.ChargePower,
      (cmd: AvailableCommand) => autoChargePower(copyOrThis(), cmd as AvailableCommand<Command.ChargePower>),
    ],
    [Command.ChooseIncome, () => autoIncome(copyOrThis())],
    [
      Command.BrainStone,
      (cmd: AvailableCommand) => autoBrainstone(copyOrThis(), cmd as AvailableCommand<Command.BrainStone>),
    ],
    ...(options?.autoPass ? [[undefined, () => autoPass(copyOrThis())] as const] : []),
  ] as const;

  if (partialMove) {
    copy().move(partialMove);

    // Recursion end condition
    if (copy().newTurn) {
      engine.move(partialMove, false);
      return true;
    }
  }

  for (const [command, handler] of functions) {
    let movePart: string | false;
    if (command) {
      const availableCommand = copyOrThis().findAvailableCommand(toMove, command);

      if (!availableCommand) {
        continue;
      }

      movePart = handler(availableCommand);
    } else {
      movePart = (handler as () => string)();
    }

    if (!movePart) {
      continue;
    }

    const newMove = partialMove ? `${partialMove}. ${movePart}` : `${factionOrPlayer} ${movePart}`;

    return engine.autoMove(newMove, options);
  }

  return false;
}

/** Automatically choose faction when there's only one faction available */
function autoChooseFaction(engine: Engine, cmd: AvailableCommand<Command.ChooseFaction>): string | false {
  if (engine.availableCommands.length > 1) {
    // There can be a bid command too
    return false;
  }

  const factions: Faction[] = cmd.data;

  if (factions.length === 1) {
    return `${Command.ChooseFaction} ${factions[0]}`;
  }

  return false;
}

/**
 * Automatically leech when there's no cost
 */
export function autoChargePower(engine: Engine, cmd: AvailableCommand<Command.ChargePower>): string | false {
  const offers = cmd.data.offers;
  const pl = engine.player(engine.playerToMove);
  const playerHasPassed = engine.passedPlayers.includes(pl.player);
  const request = new ChargeRequest(pl, offers, engine.isLastRound, playerHasPassed, pl.incomeSelection());

  const chargeDecision = decideChargeRequest(request);
  switch (chargeDecision) {
    case ChargeDecision.Yes: {
      const offer = request.maxAllowedOffer;
      assert(offer, `could not find max offer: ${JSON.stringify([offers, pl.settings])}`);
      return `${Command.ChargePower} ${offer.offer}`;
    }
    case ChargeDecision.No:
      return `${Command.Decline} ${offers[0].offer}`;
    case ChargeDecision.Ask:
      return false;
    case ChargeDecision.Undecided:
      assert(false, `Could not decide how to charge power: ${request}`);
  }
}

/**
 * Automatically decide on income if autoIncome is enabled
 */
function autoIncome(engine: Engine): string | false {
  const pl = engine.player(engine.playerToMove);

  if (pl.settings.autoIncome) {
    const events = pl.incomeSelection().autoplayEvents();
    const relevantReward = events[0]?.rewards.find(
      (rew) => rew.type === Resource.ChargePower || rew.type === Resource.GainToken
    );

    if (!relevantReward) {
      // should never happen, as autoIncome is only called if income command is possible
      return false;
    }

    // Returns only the first event. As there maybe brainstone commands between events for example
    return `${Command.ChooseIncome} ${relevantReward}`;
  }
  return false;
}

/**
 * Automatically decide on brainstone if autoBrainstone is enabled
 */
function autoBrainstone(engine: Engine, cmd: AvailableCommand<Command.BrainStone>): string | false {
  const pl = engine.player(engine.playerToMove);

  if (pl.settings.autoBrainstone) {
    if (cmd.data.choices.some((c) => c.warning)) {
      return false;
    }
    const choices = cmd.data.choices.map((c) => c.area);

    if (choices.some((choice) => choice === PowerArea.Gaia || choice === "discard")) {
      return false;
    }

    const dest = choices.includes(PowerArea.Area3) ? PowerArea.Area3 : PowerArea.Area2;
    return `${Command.BrainStone} ${dest}`;
  }
  return false;
}

/** Return move a dropped player would make */
function autoPass(engine: Engine): string | undefined {
  const toMove = engine.playerToMove;

  assert(toMove !== undefined, "Can't execute a move when no player can move");

  const pl = engine.player(toMove);

  if (engine.availableCommands.some((cmd) => cmd.name === Command.Decline)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, Command.Decline);
    return `${Command.Decline} ${cmd.data.offers[0].offer}`;
  } else if (engine.availableCommands.some((cmd) => cmd.name === Command.Pass)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, Command.Pass);
    const boosters = cmd.data.boosters;

    if (boosters.length > 0) {
      return `${Command.Pass} ${boosters[0]}`;
    } else {
      return `${Command.Pass}`;
    }
  } else if (engine.availableCommands.some((cmd) => cmd.name === Command.ChooseIncome)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, Command.ChooseIncome);
    return `${Command.ChooseIncome} ${cmd.data}`;
  } else if (engine.availableCommands.some((cmd) => cmd.name === Command.BrainStone)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, Command.BrainStone);
    return `${Command.BrainStone} ${cmd.data.choices[0].area}`;
  } else if (
    engine.availableCommands.some(
      (cmd) =>
        cmd.name === Command.Spend &&
        (cmd.data as AvailableFreeActionData).acts[0].cost.includes(Resource.GainTokenGaiaArea)
    )
  ) {
    // Terrans spending power in gaia phase to create resources
    return `${Command.Spend} ${pl.data.power.gaia}${Resource.GainTokenGaiaArea} for ${pl.data.power.gaia}${Resource.Credit}`;
  } else {
    assert(
      false,
      "Can't automove for player " +
        (engine.playerToMove + 1) +
        ", available command: " +
        engine.availableCommands[0].name
    );
  }
}
