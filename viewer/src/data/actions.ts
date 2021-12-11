import { BoardAction, FreeAction, Planet, PlayerEnum, PowerArea, Resource } from "@gaia-project/engine";

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

export type FastConversionButton = Resource.Qic | Resource.Knowledge | Resource.Ore | Resource.Credit | PowerArea;

export type FastConversionEvent = {
  button: FastConversionButton;
};

export type FastConversion = FastConversionEvent & {
  priority?: number;
  filter?: (Player) => boolean;
};

export enum MapModeType {
  default = "default",
  federations = "federations",
  sectors = "sectors",
  leech = "leech",
  planetType = "planetType",
}

export type MapMode = {
  type: MapModeType;
  player?: PlayerEnum;
  planet?: Planet;
};

export const freeActionShortcuts: { [key in FreeAction]: { shortcut: string; fast: FastConversion } } = {
  [FreeAction.PowerToQic]: { shortcut: "q", fast: { button: Resource.Qic } },
  [FreeAction.PowerToKnowledge]: { shortcut: "k", fast: { button: Resource.Knowledge } },
  [FreeAction.PowerToOre]: { shortcut: "o", fast: { button: Resource.Ore } },
  [FreeAction.PowerToCredit]: { shortcut: "c", fast: { button: Resource.Credit } },
  [FreeAction.QicToOre]: { shortcut: "r", fast: { button: Resource.Ore, priority: 10 } },
  [FreeAction.OreToToken]: { shortcut: "g", fast: { button: PowerArea.Area1 } },
  [FreeAction.KnowledgeToCredit]: { shortcut: "n", fast: { button: Resource.Credit, priority: 11 } },
  [FreeAction.OreToCredit]: { shortcut: "d", fast: { button: Resource.Credit, priority: 10 } },

  //HadschHallas
  [FreeAction.CreditToQic]: { shortcut: "i", fast: { button: Resource.Qic, priority: 1 } },
  [FreeAction.CreditToOre]: { shortcut: "e", fast: { button: Resource.Ore, priority: 1 } },
  [FreeAction.CreditToKnowledge]: { shortcut: "w", fast: { button: Resource.Knowledge, priority: 1 } },

  //Terrans
  [FreeAction.GaiaTokenToQic]: { shortcut: "q", fast: { button: Resource.Qic } },
  [FreeAction.GaiaTokenToKnowledge]: { shortcut: "k", fast: { button: Resource.Knowledge } },
  [FreeAction.GaiaTokenToOre]: { shortcut: "o", fast: { button: Resource.Ore } },
  [FreeAction.GaiaTokenToCredit]: { shortcut: "c", fast: { button: Resource.Credit } },

  //Itars
  [FreeAction.GaiaTokenToTech]: { shortcut: "t", fast: { button: PowerArea.Gaia } },

  //Nevlas
  [FreeAction.PowerToGaiaForKnowledge]: { shortcut: "w", fast: { button: PowerArea.Gaia } },
  [FreeAction.PowerToOreAndCredit]: { shortcut: "i", fast: { button: Resource.Ore, priority: 1 } },
  // replaces normal PowerToCredit, thus same shortcut
  [FreeAction.PowerTo2Credit]: { shortcut: "c", fast: { button: Resource.Credit, priority: -1 } },
  // replaces normal PowerToCredit, thus same shortcut
  [FreeAction.PowerTo2Ore]: { shortcut: "o", fast: { button: Resource.Ore, priority: -1 } },

  //Baltaks
  [FreeAction.GaiaFormerToQic]: { shortcut: "i", fast: { button: PowerArea.Gaia } },

  //Taklons
  [FreeAction.PowerTo3Credit]: {
    shortcut: "t",
    fast: {
      button: Resource.Credit,
      priority: -1,
      filter: (player) => player.data.brainstone == PowerArea.Area3,
    },
  },
};
