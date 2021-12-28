import { range } from "lodash";
import {
  boardActions,
  ConversionPool,
  FreeAction,
  freeActionConversions,
  freeActions,
  freeActionsItars,
  freeActionsTerrans,
} from "../actions";
import Engine, { BoardActions } from "../engine";
import { BoardAction, Building, Command, Expansion, Operator, Player, Resource } from "../enums";
import PlayerObject from "../player";
import { resourceLimits } from "../player-data";
import Reward from "../reward";
import { possibleTechTiles } from "./research";
import { AvailableBoardActionData, AvailableCommand, AvailableFreeAction, Offer } from "./types";

export function conversionToFreeAction(act: AvailableFreeAction): FreeAction | null {
  const entry = Object.entries(freeActionConversions).find(([k, v]) => v.cost === act.cost && v.income === act.income);
  // a new engine might add a conversion that the viewer doesn't know about yet
  return entry !== null ? Number(entry[0]) : null;
}

export function possibleSpecialActions(engine: Engine, player: Player) {
  const commands = [];
  const specialacts = [];
  const pl = engine.player(player);

  for (const event of pl.events[Operator.Activate]) {
    if (!event.activated) {
      if (
        event.rewards[0].type === Resource.DowngradeLab &&
        (pl.data.buildings[Building.ResearchLab] === 0 ||
          pl.data.buildings[Building.TradingStation] >= pl.maxBuildings(Building.TradingStation))
      ) {
        continue;
      }
      if (event.rewards[0].type === Resource.PISwap && pl.data.buildings[Building.Mine] === 0) {
        continue;
      }
      // If the action decreases rewards, the player must have them
      if (!pl.data.canPay(Reward.negative(event.rewards.filter((rw) => rw.count < 0)))) {
        continue;
      }
      specialacts.push({
        income: event.action().rewards, // Reward.toString(event.rewards),
        spec: event.spec,
      });
    }
  }

  if (specialacts.length > 0) {
    commands.push({
      name: Command.Special,
      player,
      data: { specialacts },
    });
  }

  return commands;
}

export function possibleBoardActions(actions: BoardActions, p: PlayerObject, replay: boolean): AvailableCommand[] {
  const commands: AvailableCommand[] = [];

  // not allowed if everything is lost - see https://github.com/boardgamers/gaia-project/issues/76
  const canGain = (reward: Reward) => {
    const type = reward.type;

    if (!(type in resourceLimits)) {
      return true;
    }

    return p.data.getResources(type) < resourceLimits[type];
  };

  let poweracts = BoardAction.values(Expansion.All).filter(
    (pwract) =>
      actions[pwract] === null &&
      p.data.canPay(Reward.parse(boardActions[pwract].cost)) &&
      boardActions[pwract].income.some((income) => Reward.parse(income).some((reward) => replay || canGain(reward)))
  );

  // Prevent using the rescore action if no federation token
  if (p.data.tiles.federations.length === 0) {
    poweracts = poweracts.filter((act) => act !== BoardAction.Qic2);
  }

  if (poweracts.length > 0) {
    const data = {
      poweracts: poweracts.map((act) => ({
        name: act,
        cost: boardActions[act].cost,
        income: boardActions[act].income,
      })),
    } as AvailableBoardActionData;

    commands.push({
      name: Command.Action,
      player: p.player,
      data: data,
    });
  }

  return commands;
}

export function possibleFreeActions(pl: PlayerObject): AvailableCommand<Command.Spend | Command.BurnPower>[] {
  // free action - spend
  const commands: AvailableCommand<Command.Spend | Command.BurnPower>[] = [];

  const pool = new ConversionPool(freeActions, pl);
  pl.emit("freeActionChoice", pool);

  const spendCommand = transformToSpendCommand(pool, pl);
  if (spendCommand) {
    commands.push(spendCommand);
  }

  // free action - burn
  if (pl.data.burnablePower() > 0) {
    commands.push({
      name: Command.BurnPower,
      player: pl.player,
      data: range(1, pl.data.burnablePower() + 1),
    });
  }

  return commands;
}

export function freeActionData(availableFreeActions: FreeAction[], player: PlayerObject): AvailableFreeAction[] {
  const acts: AvailableFreeAction[] = [];
  for (const freeAction of availableFreeActions) {
    const conversion = freeActionConversions[freeAction];
    const maxPay = player.maxPayRange(Reward.parse(conversion.cost));
    if (maxPay > 0) {
      acts.push({
        cost: conversion.cost,
        income: conversion.income,
        range: maxPay > 1 ? range(1, maxPay + 1) : undefined,
      });
    }
  }
  return acts;
}

export function transformToSpendCommand(
  actions: ConversionPool,
  player: PlayerObject
): AvailableCommand<Command.Spend> {
  if (actions.actions.length > 0) {
    return {
      name: Command.Spend,
      player: player.player,
      data: {
        acts: actions.actions,
      },
    };
  }
  return null;
}

export function possibleGaiaFreeActions(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  if (pl.canGaiaTerrans()) {
    commands.push(transformToSpendCommand(new ConversionPool(freeActionsTerrans, pl), pl));
  } else if (pl.canGaiaItars()) {
    if (possibleTechTiles(engine, player).length > 0) {
      commands.push(transformToSpendCommand(new ConversionPool(freeActionsItars, pl), pl));
    }

    commands.push({
      name: Command.Decline,
      player,
      data: { offers: [new Offer(Resource.TechTile, new Reward(4, Resource.GainTokenGaiaArea).toString())] },
    });
  }
  return commands;
}
