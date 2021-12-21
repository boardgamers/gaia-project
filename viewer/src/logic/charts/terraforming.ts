import { Planet } from "@gaia-project/engine";
import { planetsWithSteps } from "../../data/factions";
import { planetColorVar } from "../../graphics/colors";
import { ChartSource } from "./charts";
import { planetCounter, SimpleSourceFactory } from "./simple-charts";

export enum TerraformingSteps {
  Step0 = "Home world",
  Step1 = "1 step",
  Step2 = "2 steps",
  Step3 = "3 steps",
  GaiaFormer = "Gaia Former",
  Gaia = "Gaia Planet (settled directly)",
  Lantids = "Lantids guest mine",
  LostMine = "Lost Planet",
}

function getTerraformingSteps(steps: TerraformingSteps): number {
  switch (steps) {
    case TerraformingSteps.Step1:
      return 1;
    case TerraformingSteps.Step2:
      return 2;
    case TerraformingSteps.Step3:
      return 3;
    default:
      return 0;
  }
}

export function planetsForSteps(type: TerraformingSteps, planet: Planet): Planet[] {
  switch (type) {
    case TerraformingSteps.Gaia:
      return [Planet.Gaia];
    case TerraformingSteps.GaiaFormer:
      return [Planet.Transdim];
    case TerraformingSteps.Lantids:
      return [Planet.Empty];
    case TerraformingSteps.LostMine:
      return [Planet.Lost];
    case TerraformingSteps.Step0:
      return [planet];
    default:
      return planetsWithSteps(planet, getTerraformingSteps(type));
  }
}

export const terraformingStepsSourceFactory: SimpleSourceFactory<ChartSource<TerraformingSteps>> = {
  name: "Terraforming Steps",
  showWeightedTotal: true,
  playerSummaryLineChartTitle: "Terraforming Steps of all players (Gaia planets and gaia formers excluded)",
  extractLog: planetCounter(
    (source) => source.type == TerraformingSteps.Lantids,
    (source) => source.type == TerraformingSteps.LostMine,
    (p, type, player) => planetsForSteps(type, player.planet).includes(p)
  ),
  sources: Object.values(TerraformingSteps).map((steps) => ({
    type: steps,
    label: steps,
    color: (player) => planetColorVar(planetsForSteps(steps, player.planet)[0], true),
    weight: getTerraformingSteps(steps),
  })),
};
