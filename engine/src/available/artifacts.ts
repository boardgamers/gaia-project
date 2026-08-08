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

export function possibleArtifactTokens(
  engine: Engine,
  player: Player
): AvailableCommand<Command.ChooseArtifactToken>[] {
  const pl = engine.player(player);
  const tokens = engine.tiles.artifacts as ArtifactToken[];

  // §G6, owner ruling 2026-07-03: the Federation-shaped Artifact is still choosable with no
  // owned Federation token to rescore; it just has no effect. Flagged so a future UI can warn
  // before commit, matching Twilight's Q.I.C. action (available/spaceship-actions.ts).
  const ownsAnyFederationToken = pl.data.tiles.federations.length > 0 || pl.data.spaceshipFederations.length > 0;
  const noEffectTokens =
    !ownsAnyFederationToken && tokens.includes(ArtifactToken.Federation) ? [ArtifactToken.Federation] : undefined;

  return [{ name: Command.ChooseArtifactToken, player, data: { tokens, noEffectTokens } }];
}
