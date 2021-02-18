import { Condition, Event, Operator, Reward, Resource } from "@gaia-project/engine";

const conditionsCount = {
  [Condition.Mine]: "mine",
  [Condition.TradingStation]: "trading station",
  [Condition.ResearchLab]: "research lab",
  [Condition.PlanetaryInstituteOrAcademy]: "planetary institute or academy",
  [Condition.Federation]: "federation",
  [Condition.Gaia]: "gaia planet colonized",
  [Condition.PlanetType]: "type of planet colonized",
  [Condition.Sector]: "occupied sector",
  [Condition.Structure]: "colonized planet",
  [Condition.StructureFed]: "colonized planet in a federation",
  [Condition.Satellite]: "satellite or space station",
  [Condition.HighestResearchLevel]: "level of your highest research track",
  [Condition.AdvanceResearch]: "level reached in any research track"
};

const conditionsTrigger = {
  [Condition.Mine]: "building a mine",
  [Condition.TradingStation]: "building a trading station",
  [Condition.ResearchLab]: "building a research lab",
  [Condition.PlanetaryInstituteOrAcademy]: "building a planetary institute or academy",
  [Condition.Federation]: "forming a federation",
  [Condition.MineOnGaia]: "building a mine on a gaia planet",
  [Condition.AdvanceResearch]: "advancing a level in research",
  [Condition.TerraformStep]: "terraforming a planet one step"
};

const operators = {
  [Operator.Pass]: "After passing,",
  [Operator.Activate]: "Once per round, as a special action,",
  [Operator.Income]: "During the income phase,",
  [Operator.Once]: "Immediately ",
  [Operator.Trigger]: "When ",
  [Operator.Special]: "Planetary institutes and academies have a power value of 4, when building federations and charging power."
};

function rewardDesc (rewards: Reward[]) {
  return rewards.map(reward => {
    switch (reward.type) {
      case Resource.TechTile: return `gain ${reward.count} tech tile${reward.count > 1 ? 's' : ''}`;
      case Resource.TemporaryStep: return `gain ${reward.count} temporary step${reward.count > 1 ? 's' : ''}`;
      case Resource.TemporaryRange: return `gain ${reward.count} temporary range`;
      case Resource.RescoreFederation: return `gain the rewards from one of your federation tokens`;
      // case Resource.Range: return `gain ${reward.count} range for the duration of the round`;
      case Resource.Turn: return `play an extra ${reward.count} turn${reward.count > 1 ? 's' : ''} at once`;
      default: return "gain " + reward.toString();
    }
  }).join(", ");
}

export function eventDesc (event: Event) {
  const operatorString = operators[event.operator];
  const conditionString = event.operator === Operator.Trigger ? conditionsTrigger[event.condition] + "," : (conditionsCount[event.condition] && "for each " + conditionsCount[event.condition] + ",");
  const rewardString = event.rewards.length === 0 ? '' : rewardDesc(event.rewards);

  return [operatorString, conditionString, rewardString].filter(x => !!x).join(" ");
}
