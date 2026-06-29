import Engine from "../engine";
import { ArtifactToken, Command, Player, Spaceship } from "../enums";
import Reward from "../reward";
import { AvailableCommand } from "./types";

const EXAMINE_ARTIFACT_COST = "6t";

export function possibleExamineArtifact(engine: Engine, player: Player): AvailableCommand<Command.ExamineArtifact>[] {
  const pl = engine.player(player);

  if (!pl.data.hasExplored(Spaceship.Twilight)) {
    return [];
  }
  if (engine.tiles.artifacts.length === 0) {
    return [];
  }
  if (!pl.data.canPay(Reward.parse(EXAMINE_ARTIFACT_COST))) {
    return [];
  }

  return [{ name: Command.ExamineArtifact, player, data: { cost: EXAMINE_ARTIFACT_COST } }];
}

export function possibleArtifactTokens(engine: Engine, player: Player): AvailableCommand<Command.ChooseArtifactToken>[] {
  return [{ name: Command.ChooseArtifactToken, player, data: { tokens: engine.tiles.artifacts as ArtifactToken[] } }];
}
