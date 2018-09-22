import {Condition, Event, Operator, Reward, Resource} from "@gaia-project/engine";

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
}

const conditionsTrigger = {
  [Condition.Mine]: "building a mine",
  [Condition.TradingStation]: "building a trading station",
  [Condition.ResearchLab]: "building a research lab",
  [Condition.PlanetaryInstituteOrAcademy]: "building a planetary institute or academy",
  [Condition.Federation]: "forming a federation",
  [Condition.MineOnGaia]: "building a mine on a gaia planet",
  [Condition.AdvanceResearch]: "advancing a level in research",
  [Condition.TerraformStep]: "terraforming a planet one step"
}

const operators = {
  [Operator.Pass]: "After passing,",
  [Operator.Activate]: "Once per round, as a special action,",
  [Operator.Income]: "During the income phase,",
  [Operator.Once]: "Immediately ",
  [Operator.Trigger]: "When ",
  [Operator.Special]: "Planetary institutes and academies have a power value of 4, when building federations and charging power."
}

function rewardDesc(rewards: Reward[]) {
  return rewards.map(reward => {
    switch (reward.type) {
      case Resource.TechTile: return `${reward.count} tech tile${reward.count > 1 ? 's' : ''}`;
      case Resource.TemporaryStep: return `${reward.count} temporary step${reward.count > 1 ? 's' : ''}`;
      case Resource.TemporaryRange: return `${reward.count} temporary range`;
      case Resource.RescoreFederation: return `the rewards from one of your federation tokens`;
      default: return reward.toString();
    }
  }).join(", ");
}

export function eventDesc(event: Event) {
  const operatorString = operators[event.operator];
  const conditionString = event.operator === Operator.Trigger ? conditionsTrigger[event.condition] + "," : (conditionsCount[event.condition] && "for each " + conditionsCount[event.condition] + ",");
  const rewardString = event.rewards.length === 0 ? '' : "gain " + rewardDesc(event.rewards);

  return [operatorString, conditionString, rewardString].filter(x => !!x).join(" ");
}