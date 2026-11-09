import { ArtifactToken, Command, Expansion, Spaceship } from "@gaia-project/engine";
import { artifactTokenSpec } from "@gaia-project/engine/src/tiles/artifacts";
import { spaceshipColors, spaceshipNames } from "../../data/spaceships";
import type { ChartSource } from "./charts";
import type { SimpleSourceFactory } from "./simple-charts";
import { ChartSummary, commandCounterArg0EqualsSource, ExtractLog } from "./simple-charts";

/** Command counts, not resource/VP totals or inferred physical planet ownership. */
export function lostFleetSourceFactories(expansion: Expansion): SimpleSourceFactory<ChartSource<string>>[] {
  if (!(expansion & Expansion.LostFleet)) {
    return [];
  }
  return [
    {
      name: "Exploration",
      playerSummaryLineChartTitle: "Exploration of all players",
      summary: ChartSummary.total,
      // Moweyds' setup access to T F Mars is assigned directly by the engine,
      // not an Explore command. Count actual explorations, not starting access.
      extractLog: commandCounterArg0EqualsSource(Command.Explore),
      sources: Spaceship.values(expansion).map((ship) => ({
        type: ship,
        label: spaceshipNames[ship],
        description: "Exploration actions (excluding starting access)",
        color: spaceshipColors[ship],
        weight: 1,
      })),
    },
    {
      name: "Artifacts",
      playerSummaryLineChartTitle: "Artifacts of all players",
      summary: ChartSummary.total,
      // Acquisition is the choice, not ExamineArtifact nor subsequent income.
      extractLog: commandCounterArg0EqualsSource(Command.ChooseArtifactToken),
      sources: ArtifactToken.values(expansion).map((token) => ({
        type: token,
        label: artifactTokenSpec[token],
        color: "--lost",
        weight: 1,
      })),
    },
    {
      name: "Lost Fleet activities",
      playerSummaryLineChartTitle: "Lost Fleet activities of all players",
      summary: ChartSummary.total,
      extractLog: ExtractLog.filterPlayer(({ cmd, source }) => (cmd.command === source.type ? 1 : 0)),
      sources: [
        { type: Command.ExamineArtifact, label: "Artifact examinations" },
        // Choosing a tile is not activating its special action.
        { type: Command.ChooseTinkeringTile, label: "Tinkering tile selections" },
        { type: Command.PlacePowerRing, label: "Power rings placed" },
      ].map((source) => ({ ...source, color: "--lost", weight: 1 })),
    },
  ];
}
