import { Resource } from "@gaia-project/engine";

export type ResourceName = {
  type: Resource;
  label: string;
  plural: string;
};

export const resourceNames: ResourceName[] = [
  {
    type: Resource.Credit,
    label: "Credit",
    plural: "Credits",
  },
  {
    type: Resource.Ore,
    label: "Ore",
    plural: "Ores",
  },
  {
    type: Resource.Knowledge,
    label: "Knowledge",
    plural: "Knowledge",
  },
  {
    type: Resource.Qic,
    label: "QIC",
    plural: "QICs",
  },
  {
    type: Resource.ChargePower,
    label: "Power Charge",
    plural: "Power Charges",
  },
  {
    type: Resource.PayPower,
    label: "Spent Power",
    plural: "Spent Power",
  },
  {
    type: Resource.GainToken,
    label: "Gained Token",
    plural: "Gained Tokens",
  },
  {
    type: Resource.BurnToken,
    label: "Burned Token",
    plural: "Burned Tokens",
  },
  {
    type: Resource.TokenArea3,
    label: "Token in area 3 to gaia",
    plural: "Tokens in area 3 to gaia",
  },
  {
    type: Resource.TechTile,
    label: "Tech tile",
    plural: "Tech tiles",
  },
  {
    type: Resource.GainTokenGaiaArea,
    label: "Token in gaia area",
    plural: "Tokens in gaia area",
  },
  {
    type: Resource.GaiaFormer,
    label: "Gaia Former to gaia",
    plural: "Gaia Formers to gaia",
  },
  {
    type: Resource.TemporaryStep,
    label: "Terraforming Step",
    plural: "Terraforming Steps",
  },
  {
    type: Resource.VictoryPoint,
    label: "Victory Point",
    plural: "Victory Points",
  },
  {
    type: Resource.RescoreFederation,
    label: "Re-score federation",
    plural: "Re-score federation",
  },
  {
    type: Resource.BowlToken,
    label: "Token in area 2",
    plural: "Token in area 2",
  },
];
