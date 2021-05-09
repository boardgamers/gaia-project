import { AvailableFreeAction, freeActionData } from "./available-command";
import {
  BoardAction, ConversionTable,
  FreeAction,
  freeActions, freeActionsBaltaks,
  freeActionsHadschHallas, freeActionsItars,
  freeActionsNevlas, freeActionsNevlasPI, freeActionsTaklons,
  freeActionsTerrans
} from "./enums";
import Event from "./events";
import Player from "./player";
import Reward from "./reward";

// QIC to extend range is already included in the distance calculation

export class ConversionPool {
  public actions: AvailableFreeAction[] = [];

  constructor(table: ConversionTable, player: Player) {
    this.push(table, player);
  }

  push(table: ConversionTable, player: Player) {
    this.actions.push(...freeActionData(Object.keys(table).map((k) => Number(k)) as FreeAction[], player));
  }
}

export const freeActionConversions: ConversionTable = Object.assign(
  {},
  freeActions,
  freeActionsHadschHallas,
  freeActionsTerrans,
  freeActionsItars,
  freeActionsNevlas,
  freeActionsNevlasPI,
  freeActionsBaltaks,
  freeActionsTaklons
);

export const boardActions: { [key in BoardAction]: { cost: Reward[]; income: Event[] } } = (Object.fromEntries(
  Object.entries({
    [BoardAction.Power1]: { cost: "7pw", income: ["3k"] },
    [BoardAction.Power2]: { cost: "5pw", income: ["2step"] },
    [BoardAction.Power3]: { cost: "4pw", income: ["2o"] },
    [BoardAction.Power4]: { cost: "4pw", income: ["7c"] },
    [BoardAction.Power5]: { cost: "4pw", income: ["2k"] },
    [BoardAction.Power6]: { cost: "3pw", income: ["1step"] },
    [BoardAction.Power7]: { cost: "3pw", income: ["2t"] },
    [BoardAction.Qic1]: { cost: "4q", income: ["tech"] },
    [BoardAction.Qic2]: { cost: "3q", income: [">fed"] },
    [BoardAction.Qic3]: { cost: "2q", income: ["3vp", "pt > vp"] },
  }).map(([b, { cost, income }]) => [
    b as BoardAction,
    { cost: Reward.parse(cost), income: Event.parse(income, b as BoardAction) },
  ])
) as any) as { [key in BoardAction]: { cost: Reward[]; income: Event[] } };
