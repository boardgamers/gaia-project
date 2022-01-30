import { Condition, Event, Expansion, Operator, Resource, Reward } from "@gaia-project/engine";
import { translateResources } from "./resources";

const conditionsCount: { [key in Condition]?: string } = {
  [Condition.Mine]: "mine",
  [Condition.TradingStation]: "trading station",
  [Condition.ResearchLab]: "research lab",
  [Condition.BigBuilding]: "planetary institute or academy",
  [Condition.Federation]: "federation",
  [Condition.Gaia]: "gaia planet colonized",
  [Condition.PlanetType]: "type of planet colonized",
  [Condition.Sector]: "occupied sector",
  [Condition.Structure]: "colonized planet",
  [Condition.StructureFed]: "colonized planet in a federation",
  [Condition.Satellite]: "satellite or space station",
  [Condition.HighestResearchLevel]: "level of your highest research track",
  [Condition.AdvanceResearch]: "level reached in any research track",
};

const conditionsTrigger: { [key in Condition]?: string } = {
  [Condition.Mine]: "building a mine",
  [Condition.TradingStation]: "building a trading station",
  [Condition.ResearchLab]: "building a research lab",
  [Condition.BigBuilding]: "building a planetary institute or academy",
  [Condition.Federation]: "forming a federation",
  [Condition.MineOnGaia]: "building a mine on a gaia planet",
  [Condition.AdvanceResearch]: "advancing a level in research",
  [Condition.TerraformStep]: "terraforming a planet one step",
  [Condition.Trade]: "trading (afterwards)",
};

const operators = {
  [Operator.Pass]: "After passing,",
  [Operator.Activate]: "Once per round, as a special action,",
  [Operator.Income]: "During the income phase,",
  [Operator.Once]: "Immediately ",
  [Operator.Trigger]: "When ",
  [Operator.FourPowerBuildings]:
    "Planetary institutes and academies have a power value of 4, when forming federations and charging power.",
};

function rewardDesc(rewards: Reward[], long: boolean) {
  return rewards
    .map((reward) => {
      switch (reward.type) {
        case Resource.TechTile:
          return `gain ${reward.count} tech tile${reward.count > 1 ? "s" : ""}`;
        case Resource.TerraformCostDiscount:
          return `gain ${reward.count} terraforming discount`;
        case Resource.TemporaryStep:
          return `gain ${reward.count} temporary step${reward.count > 1 ? "s" : ""}`;
        case Resource.Range:
          return `gain ${reward.count} range`;
        case Resource.TemporaryRange:
          return `gain ${reward.count} temporary range`;
        case Resource.RescoreFederation:
          return `gain the rewards from one of your federation tokens`;
        case Resource.Turn:
          return `play an extra ${reward.count} turn${reward.count > 1 ? "s" : ""} at once`;
        default:
          return "gain " + (long ? translateResources([reward], true) : reward.toString());
      }
    })
    .join(", ");
}

export function eventDesc(event: Event, expansion: Expansion, long = false): string {
  const op = event.operator;
  const operatorString =
    op == Operator.FourPowerBuildings && expansion == Expansion.Frontiers
      ? "Planetary institutes, academies, and colonies have a power value of 4, when forming federations and charging power."
      : operators[op];
  const colony = event.condition === Condition.BigBuilding && expansion == Expansion.Frontiers;
  const cond = colony
    ? "planetary institute, academy, or colony"
    : conditionsCount[event.condition as keyof typeof conditionsCount];
  const trigger = colony
    ? "building a planetary institute, academy, or colony"
    : conditionsTrigger[event.condition as keyof typeof conditionsTrigger];
  const conditionString = op === Operator.Trigger ? trigger + "," : cond && "for each " + cond + ",";
  const rewardString = event.rewards.length === 0 ? "" : rewardDesc(event.rewards, long);

  return [operatorString, conditionString, rewardString].filter((x) => !!x).join(" ");
}

export function eventDescForCounters(event: Event, expansions: Expansion, long: boolean): string {
  const reward = event.rewards[0];
  const value = reward.count;
  switch (reward.type) {
    case Resource.TerraformCostDiscount:
      return `Each terraforming step costs you ${value} ore`;
    case Resource.Range:
      return `Your basic range is ${value}`;
    case Resource.ShipRange:
      return `Your ship range is ${value}`;
    case Resource.MoveTokenToGaiaArea:
      return `To start a Gaia project, you must move ${value} power tokens to your Gaia area`;
    case Resource.TradeBonus:
      return `Your trade bonus level is ${value}`;
    case Resource.TradeDiscount:
      return `Trading costs ${value} power`;
  }

  return eventDesc(event, expansions, long);
}
