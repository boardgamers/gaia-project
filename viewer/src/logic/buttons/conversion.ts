import {
  AvailableFreeAction,
  AvailableFreeActionData,
  BoardAction,
  Command,
  conversionToFreeAction,
  Faction,
  Phase,
  Player,
  PowerArea,
  Resource,
  Reward,
} from "@gaia-project/engine";
import { max, minBy, range, sortBy } from "lodash";
import { ButtonData } from "../../data";
import { FastConversion, FastConversionEvent, freeActionShortcuts } from "../../data/actions";
import { translateResources } from "../../data/resources";
import { richTextArrow } from "../../graphics/utils";
import { AvailableConversions, FastConversionTooltips } from "./types";
import { autoClickButton, confirmationButton, symbolButton } from "./utils";
import { resourceWasteWarning, rewardWarnings } from "./warnings";

function conversionLabel(cost: Reward[], income: Reward[]) {
  const to = translateResources(income, true).replace("4 Victory Points", "3 VP + 1 VP / Planet Type");
  const from = translateResources(cost, true).replace("1 Gaia Former", "Move 1 gaia former to gaia area");
  return `${from} ⇒ ${to}`;
}

function resourceSymbol(type: Resource) {
  switch (type) {
    case Resource.ChargePower:
      return Resource.PayPower;
    case Resource.TokenArea3:
      return Resource.BowlToken;
    default:
      return type;
  }
}

function newConversion(cost: Reward[], income: Reward[], player?: Player): { from: Reward[]; to: Reward[] } {
  return {
    from: cost.map((r) => {
      return new Reward(
        r.type == Resource.ChargePower
          ? Math.ceil(r.count / (player != null ? player?.data?.tokenModifier : 1))
          : r.count,
        resourceSymbol(r.type)
      );
    }),
    to: income.map((r) => new Reward(r.count, r.type)),
  };
}

export function conversionButton(
  cost: Reward[],
  income: Reward[],
  player: Player | null,
  shortcut: string,
  skipShortcut: string[],
  command: string,
  boardAction?: BoardAction,
  times?: number[]
): ButtonData {
  const conversion = newConversion(cost, income, player);
  const button = symbolButton(
    {
      label: conversionLabel(cost, income),
      resourceLabel: [{ rewards: conversion.from }, richTextArrow, { rewards: conversion.to }],
      shortcuts: shortcut != null ? [shortcut] : [],
      command,
      warning: player ? resourceWasteWarning(rewardWarnings(player, income)) : null,
      times,
      boardAction,
    },
    skipShortcut
  );
  button.longLabel = button.label;
  button.label = "<u></u>"; //don't show command
  return button;
}

export function spendCommand(act: AvailableFreeAction) {
  return `${Command.Spend} ${act.cost} for ${act.income}`;
}

function fastConversionPossible(action: AvailableFreeAction, conversion: FastConversion, player: Player): boolean {
  return !action.hide && (!conversion.filter || conversion.filter(player));
}

function freeActionPriority(a: AvailableFreeAction) {
  return freeActionShortcuts[conversionToFreeAction(a)].fast.priority ?? 0;
}

export function freeActionButton(
  data: AvailableFreeActionData,
  player: Player
): { buttons: ButtonData[]; tooltips: FastConversionTooltips } {
  function newButton(act: AvailableFreeAction) {
    return conversionButton(
      Reward.parse(act.cost),
      Reward.parse(act.income),
      player,
      freeActionShortcuts[conversionToFreeAction(act)]?.shortcut,
      [],
      spendCommand(act),
      null,
      act.range
    );
  }

  const buttons = data.acts.filter((a) => !a.hide).map((act) => newButton(act));

  const fast: AvailableFreeAction[] = data.acts
    .filter((a) => !a.hide)
    .flatMap((act) => {
      const action = conversionToFreeAction(act);
      if (action != null) {
        const shortcut = freeActionShortcuts[action];
        if (fastConversionPossible(act, shortcut.fast, player)) {
          return act;
        }
      }
      return [];
    });

  const tooltips: FastConversionTooltips = {};
  for (const a of sortBy(fast, (a) => freeActionPriority(a))) {
    const button = freeActionShortcuts[conversionToFreeAction(a)].fast.button;
    const last = tooltips[button];
    const tooltip = newButton(a).tooltip;
    tooltips[button] = last ? last + ", " + tooltip : tooltip;
  }

  return { tooltips, buttons };
}

export function burnButton(player: Player, availableRange?: number[]) {
  return conversionButton(
    [new Reward(2, Resource.BowlToken)],
    [
      new Reward(1, player.faction == Faction.Itars ? Resource.GainTokenGaiaArea : Resource.BurnToken),
      new Reward(1, Resource.ChargePower),
    ],
    player,
    "b",
    [],
    `${Command.BurnPower} 1`,
    null,
    availableRange?.length > 1 ? range(1, max(availableRange) + 1) : undefined
  );
}

const fastBurnButton = PowerArea.Area3;

export function fastConversionClick(
  event: FastConversionEvent,
  conversions: AvailableConversions,
  player: Player
): string | null {
  if (event.button == fastBurnButton && conversions.burn) {
    return `${Command.BurnPower} 1`;
  }

  const possible: AvailableFreeAction[] = conversions.free.acts.filter((a) => {
    const c = freeActionShortcuts[conversionToFreeAction(a)]?.fast;
    return c.button == event.button && fastConversionPossible(a, c, player);
  });
  if (possible.length > 0) {
    const action: AvailableFreeAction = minBy(possible, (a) => freeActionPriority(a));
    return spendCommand(action);
  }
  return null;
}

export function freeAndBurnButton(
  conversions: AvailableConversions,
  player: Player,
  phase: Phase
): { button: ButtonData; tooltips: FastConversionTooltips } {
  const labels = [];
  const buttons: ButtonData[] = [];
  let tooltips: FastConversionTooltips = {};
  if (conversions.free) {
    labels.push("Free action");
    const b = freeActionButton(conversions.free, player);
    if (phase === Phase.RoundGaia) {
      for (const cb of b.buttons) {
        if (!cb.resourceLabel.some((c) => typeof c == "object" && c[0].type === Resource.TechTile)) {
          cb.buttons = confirmationButton("Confirm Free Action");
        }
      }
    }
    buttons.push(...b.buttons);
    tooltips = b.tooltips;
  }
  if (conversions.burn) {
    labels.push("Burn power");
    buttons.push(burnButton(player, conversions.burn));
    tooltips[fastBurnButton] = "Burn power";
  }

  return {
    button: autoClickButton({
      label: labels.join(" / "),
      shortcuts: ["a"],
      buttons: sortBy(buttons, (b) => b.resourceLabel[0].rewards[0].type),
    }),
    tooltips,
  };
}
