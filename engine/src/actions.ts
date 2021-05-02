import { AvailableFreeAction, freeActionData } from "./available-command";
import { BoardAction } from "./enums";
import Player from "./player";

// QIC to extend range is already included in the distance calculation

export enum FreeAction {
  PowerToQic,
  PowerToKnowledge,
  PowerToOre,
  PowerToCredit,
  QicToOre,
  OreToToken,
  KnowledgeToCredit,
  OreToCredit,

  //HadschHallas
  CreditToQic,
  CreditToOre,
  CreditToKnowledge,

  //Terrans
  GaiaTokenToQic,
  GaiaTokenToKnowledge,
  GaiaTokenToOre,
  GaiaTokenToCredit,

  //Itars
  GaiaTokenToTech,

  //Nevlas
  PowerToGaiaForKnowledge,
  PowerToOreAndCredit,
  PowerToDoubleCredit,
  PowerTo2Ore,

  //Baltaks
  GaiaFormerToQic,

  //Taklons
  PowerToTripleCredit,
}

export type ResourceConversion = { cost: string; income: string };
export type ConversionTable = { [key in FreeAction]?: ResourceConversion };

export class ConversionPool {
  public actions: AvailableFreeAction[] = [];

  constructor(table: ConversionTable, player: Player) {
    this.push(table, player);
  }

  push(table: ConversionTable, player: Player) {
    this.actions.push(...freeActionData(Object.keys(table).map((k) => Number(k)) as FreeAction[], player));
  }
}

export const freeActions: ConversionTable = {
  [FreeAction.PowerToQic]: { cost: "4pw", income: "1q" },
  [FreeAction.PowerToOre]: { cost: "3pw", income: "1o" },
  [FreeAction.QicToOre]: { cost: "1q", income: "1o" },
  [FreeAction.PowerToKnowledge]: { cost: "4pw", income: "1k" },
  [FreeAction.PowerToCredit]: { cost: "1pw", income: "1c" },
  [FreeAction.KnowledgeToCredit]: { cost: "1k", income: "1c" },
  [FreeAction.OreToCredit]: { cost: "1o", income: "1c" },
  [FreeAction.OreToToken]: { cost: "1o", income: "1t" },
};

export const freeActionsHadschHallas: ConversionTable = {
  [FreeAction.CreditToQic]: { cost: "4c", income: "1q" },
  [FreeAction.CreditToOre]: { cost: "3c", income: "1o" },
  [FreeAction.CreditToKnowledge]: { cost: "4c", income: "1k" },
};

export const freeActionsTerrans: ConversionTable = {
  [FreeAction.GaiaTokenToQic]: { cost: "4tg", income: "1q" },
  [FreeAction.GaiaTokenToOre]: { cost: "3tg", income: "1o" },
  [FreeAction.GaiaTokenToKnowledge]: { cost: "4tg", income: "1k" },
  [FreeAction.GaiaTokenToCredit]: { cost: "1tg", income: "1c" },
};

export const freeActionsItars: ConversionTable = { [FreeAction.GaiaTokenToTech]: { cost: "4tg", income: "tech" } };

export const freeActionsNevlas: ConversionTable = {
  [FreeAction.PowerToGaiaForKnowledge]: { cost: "1t-a3", income: "1k" },
};

export const freeActionsNevlasPI: ConversionTable = {
  [FreeAction.PowerToDoubleCredit]: { cost: "2pw", income: "2c" }, // this is for convenience
  [FreeAction.PowerToOreAndCredit]: { cost: "4pw", income: "1o,1c" },
  [FreeAction.PowerTo2Ore]: { cost: "6pw", income: "2o" },
};

export const freeActionsBaltaks: ConversionTable = { [FreeAction.GaiaFormerToQic]: { cost: "1gf", income: "1q" } };

// this is for convenience
export const freeActionsTaklons: ConversionTable = { [FreeAction.PowerToTripleCredit]: { cost: "3pw", income: "3c" } };

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

export const boardActions = {
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
};
