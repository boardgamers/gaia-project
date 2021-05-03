import { BoardAction, FreeAction } from "@gaia-project/engine";

export const boardActionNames: { [key in BoardAction]: { name: string; color: string; shortcut: string } } = {
  [BoardAction.Power1]: { name: "3 knowledge", color: "--recent", shortcut: "n" },
  [BoardAction.Power2]: { name: "2 steps", color: "--current-round", shortcut: "e" },
  [BoardAction.Power3]: { name: "2 ore", color: "--res-ore", shortcut: "o" },
  [BoardAction.Power4]: { name: "7 credits", color: "--res-credit", shortcut: "c" },
  [BoardAction.Power5]: { name: "2 knowledge", color: "--res-knowledge", shortcut: "k" },
  [BoardAction.Power6]: { name: "1 step", color: "--dig", shortcut: "s" },
  [BoardAction.Power7]: { name: "2 tokens", color: "--res-power", shortcut: "g" },
  [BoardAction.Qic1]: { name: "Tech tile", color: "--tech-tile", shortcut: "t" },
  [BoardAction.Qic2]: { name: "Re-score federation", color: "--federation", shortcut: "f" },
  [BoardAction.Qic3]: { name: "VP for planet types", color: "--res-vp", shortcut: "v" },
};

export const freeActionShortcuts: { [key in FreeAction]: string } = {
  [FreeAction.PowerToQic]: "q",
  [FreeAction.PowerToKnowledge]: "k",
  [FreeAction.PowerToOre]: "o",
  [FreeAction.PowerToCredit]: "c",
  [FreeAction.QicToOre]: "r",
  [FreeAction.OreToToken]: "g",
  [FreeAction.KnowledgeToCredit]: "n",
  [FreeAction.OreToCredit]: "d",

  //HadschHallas
  [FreeAction.CreditToQic]: "i",
  [FreeAction.CreditToOre]: "e",
  [FreeAction.CreditToKnowledge]: "w",

  //Terrans
  [FreeAction.GaiaTokenToQic]: "q",
  [FreeAction.GaiaTokenToKnowledge]: "k",
  [FreeAction.GaiaTokenToOre]: "o",
  [FreeAction.GaiaTokenToCredit]: "c",

  //Itars
  [FreeAction.GaiaTokenToTech]: "t",

  //Nevlas
  [FreeAction.PowerToGaiaForKnowledge]: "w",
  [FreeAction.PowerToOreAndCredit]: "i",
  [FreeAction.PowerTo2Credit]: "c", // replaces normal PowerToCredit, thus same shortcut
  [FreeAction.PowerTo2Ore]: "e",

  //Baltaks
  [FreeAction.GaiaFormerToQic]: "i",

  //Taklons
  [FreeAction.PowerTo3Credit]: "t",
};
