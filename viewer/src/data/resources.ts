import Engine, { Phase, Player, Resource, Reward } from "@gaia-project/engine";
import assert from "assert";
import { colorCodes } from "../logic/color-codes";

export type ResourceName = {
  label: string;
  plural: string;
  shortcut: string;
  color: string;
};

export const resourceData: { [key in Resource]?: ResourceName } = {
  [Resource.Credit]: {
    label: "Credit",
    plural: "Credits",
    shortcut: "c",
    color: "--res-credit",
  },
  [Resource.Ore]: {
    label: "Ore",
    plural: "Ores",
    shortcut: "o",
    color: "--res-ore",
  },
  [Resource.Knowledge]: {
    label: "Knowledge",
    plural: "Knowledge",
    shortcut: "k",
    color: "--res-knowledge",
  },
  [Resource.Qic]: {
    label: "QIC",
    plural: "QICs",
    shortcut: "q",
    color: "--res-qic",
  },
  [Resource.ChargePower]: {
    label: "Power Charge",
    plural: "Power Charges",
    shortcut: "p",
    color: "--res-power",
  },
  [Resource.PayPower]: {
    label: "Spent Power",
    plural: "Spent Power",
    shortcut: "p",
    color: "--lost",
  },
  [Resource.GainToken]: {
    label: "Gained Token",
    plural: "Gained Tokens",
    shortcut: "g",
    color: "--recent",
  },
  [Resource.BurnToken]: {
    label: "Burned Token",
    plural: "Burned Tokens",
    shortcut: "b",
    color: "--current-round",
  },
  [Resource.TokenArea3]: colorCodes.gaia.add({
    label: "Token in area 3 to gaia",
    plural: "Tokens in area 3 to gaia",
  }),
  [Resource.TechTile]: {
    label: "Tech tile",
    plural: "Tech tiles",
    shortcut: "t",
    color: "--tech-tile",
  },
  [Resource.GainTokenGaiaArea]: colorCodes.gaia.add({
    label: "Token in gaia area",
    plural: "Tokens in gaia area",
  }),
  [Resource.GaiaFormer]: colorCodes.gaia.add({
    label: "Gaia Former",
    plural: "Gaia Formers",
  }),
  [Resource.TemporaryStep]: colorCodes.terraformingStep.add({
    label: "Terraforming Step",
    plural: "Terraforming Steps",
  }),
  [Resource.VictoryPoint]: {
    label: "Victory Point",
    plural: "Victory Points",
    shortcut: "v",
    color: "--res-vp",
  },
  [Resource.RescoreFederation]: colorCodes.federation.add({
    label: "Re-score Federation",
    plural: "Re-score Federation",
  }),
  [Resource.BowlToken]: {
    label: "Token in Area 2",
    plural: "Token in Area 2",
    shortcut: "t",
    color: "--res-power",
  },
  [Resource.SpaceStation]: colorCodes.spaceStation.add({
    label: "Space Station",
    plural: "Space Station",
  }),
  [Resource.TemporaryRange]: colorCodes.range.add({
    label: "Temporary <u>R</u>ange",
    plural: "Temporary <u>R</u>ange",
  }),
  [Resource.UpgradeLowest]: {
    label: "Upgrade the lowest technology",
    plural: "Upgrade the lowest technology",
    shortcut: "u",
    color: "--titanium",
  },
  [Resource.PISwap]: {
    label: "Swap the Planetary institute with a mine",
    plural: "Swap the Planetary institute with a mine",
    shortcut: "w",
    color: "--swamp",
  },
  [Resource.DowngradeLab]: {
    label: "Downgrade Research Lab",
    plural: "Downgrade Research Lab",
    shortcut: "d",
    color: "--titanium",
  },
  [Resource.TradeShip]: colorCodes.tradeShip.add({
    label: "Trade Ship",
    plural: "Trade Ships",
  }),
};

export function playerHasReceivedAllIncome(engine: Engine, player: Player) {
  return !(
    engine.phase == Phase.RoundStart ||
    (engine.phase == Phase.RoundIncome &&
      (engine.playerToMove == player.player || engine.tempTurnOrder.includes(player.player)))
  );
}

export function showIncome(engine: Engine, player: Player): boolean {
  return !engine.isLastRound || !playerHasReceivedAllIncome(engine, player);
}

export function translateResources(rewards: Reward[], countForSingle: boolean): string {
  return rewards
    .map((r) => {
      const d = resourceData[r.type];
      assert(d, "no resource name for " + r.type);
      return `${r.count == 1 && !countForSingle ? "" : r.count} ${r.count == 1 ? d.label : d.plural}`;
    })
    .join(" and ");
}

export function translateAbbreviatedResources(rewards: Reward[]): string {
  return rewards
    .map((r) => {
      const d = resourceData[r.type];
      assert(d, "no resource name for " + r.type);
      return `${r.count == 1 ? "" : r.count}${d.shortcut.toUpperCase()}`;
    })
    .join(",");
}
