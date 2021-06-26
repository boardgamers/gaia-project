import { Resource } from "@gaia-project/engine";

export type ResourceName = {
  type: Resource;
  label: string;
  plural: string;
  shortcut: string;
};

export const resourceNames: ResourceName[] = [
  {
    type: Resource.Credit,
    label: "Credit",
    plural: "Credits",
    shortcut: "c",
  },
  {
    type: Resource.Ore,
    label: "Ore",
    plural: "Ores",
    shortcut: "o",
  },
  {
    type: Resource.Knowledge,
    label: "Knowledge",
    plural: "Knowledge",
    shortcut: "k",
  },
  {
    type: Resource.Qic,
    label: "QIC",
    plural: "QICs",
    shortcut: "q",
  },
  {
    type: Resource.ChargePower,
    label: "Power Charge",
    plural: "Power Charges",
    shortcut: "p",
  },
  {
    type: Resource.PayPower,
    label: "Spent Power",
    plural: "Spent Power",
    shortcut: "p",
  },
  {
    type: Resource.GainToken,
    label: "Gained Token",
    plural: "Gained Tokens",
    shortcut: "g",
  },
  {
    type: Resource.BurnToken,
    label: "Burned Token",
    plural: "Burned Tokens",
    shortcut: "b",
  },
  {
    type: Resource.TokenArea3,
    label: "Token in area 3 to gaia",
    plural: "Tokens in area 3 to gaia",
    shortcut: "g",
  },
  {
    type: Resource.TechTile,
    label: "Tech tile",
    plural: "Tech tiles",
    shortcut: "t",
  },
  {
    type: Resource.GainTokenGaiaArea,
    label: "Token in gaia area",
    plural: "Tokens in gaia area",
    shortcut: "g",
  },
  {
    type: Resource.GaiaFormer,
    label: "Gaia Former to gaia",
    plural: "Gaia Formers to gaia",
    shortcut: "g",
  },
  {
    type: Resource.TemporaryStep,
    label: "Terraforming Step",
    plural: "Terraforming Steps",
    shortcut: "t",
  },
  {
    type: Resource.VictoryPoint,
    label: "Victory Point",
    plural: "Victory Points",
    shortcut: "v",
  },
  {
    type: Resource.RescoreFederation,
    label: "Re-score Federation",
    plural: "Re-score Federation",
    shortcut: "f",
  },
  {
    type: Resource.BowlToken,
    label: "Token in Area 2",
    plural: "Token in Area 2",
    shortcut: "t",
  },
  {
    type: Resource.SpaceStation,
    label: "Space Station",
    plural: "Space Station",
    shortcut: "s",
  },
  {
    type: Resource.TemporaryRange,
    label: "Temporary <u>R</u>ange",
    plural: "Temporary <u>R</u>ange",
    shortcut: "r",
  },
  {
    type: Resource.UpgradeLowest,
    label: "Upgrade the lowest technology",
    plural: "Upgrade the lowest technology",
    shortcut: "u",
  },
  {
    type: Resource.PISwap,
    label: "Swap the Planetary institute with a mine",
    plural: "Swap the Planetary institute with a mine",
    shortcut: "s",
  },
  {
    type: Resource.DowngradeLab,
    label: "Downgrade Research Lab",
    plural: "Downgrade Research Lab",
    shortcut: "d",
  },
  {
    type: Resource.SpyTech,
    label: "Spy tech tile",
    plural: "Spy tech tile",
    shortcut: "y",
  },
];
