import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import {
  ArtifactToken,
  Command,
  Condition,
  Planet,
  Player as PlayerEnum,
  ResearchField,
  Resource,
  Spaceship,
} from "../enums";
import Event from "../events";
import Player from "../player";
import Reward from "../reward";
import { artifactTokenRewards } from "../tiles/artifacts";

export function moveExamineArtifact(
  engine: Engine,
  command: AvailableCommand<Command.ExamineArtifact>,
  player: PlayerEnum
) {
  const pl = engine.player(player);

  pl.payCosts(Reward.parse(command.data.cost), Spaceship.Twilight);
  pl.gainRewards([new Reward(1, Resource.GainArtifact)], Spaceship.Twilight);
}

export function moveChooseArtifactToken(
  engine: Engine,
  command: AvailableCommand<Command.ChooseArtifactToken>,
  player: PlayerEnum,
  token: ArtifactToken
) {
  assert(command.data.tokens.includes(token), `Artifact token ${token} is not available`);

  engine.tiles.artifacts.splice(engine.tiles.artifacts.indexOf(token), 1);

  applyArtifactToken(engine, player, token);
}

function applyArtifactToken(engine: Engine, player: PlayerEnum, token: ArtifactToken) {
  const pl = engine.player(player);

  pl.data.artifacts.push(token);

  const rewardSpec = artifactTokenRewards[token];
  if (rewardSpec) {
    pl.loadEvents(Event.parse([rewardSpec], Spaceship.Twilight));
  }

  switch (token) {
    case ArtifactToken.Asteroid:
      applyArtifactPlanetType(pl, Planet.Asteroid);
      break;
    case ArtifactToken.Protoplanet:
      applyArtifactPlanetType(pl, Planet.Protoplanet);
      break;
    case ArtifactToken.ResearchLevel:
      // VERIFY: see tiles/artifacts.ts - which Research Area this token uses was never confirmed by the
      // rules text (owner's comment was cut off mid-sentence); ResearchField.Science is a flagged best guess.
      pl.gainRewards(
        [new Reward(3 * pl.data.research[ResearchField.Science], Resource.VictoryPoint)],
        Spaceship.Twilight
      );
      break;
    case ArtifactToken.ResearchTracks:
      pl.gainRewards(
        [new Reward(3 * Object.values(pl.data.research).filter((level) => level >= 3).length, Resource.VictoryPoint)],
        Spaceship.Twilight
      );
      break;
    case ArtifactToken.GaiaProject:
      pl.gainRewards(
        [new Reward(3 * pl.data.research[ResearchField.GaiaProject], Resource.VictoryPoint)],
        Spaceship.Twilight
      );
      break;
    case ArtifactToken.PlanetTypes:
      pl.gainRewards(
        [new Reward(3 + pl.eventConditionCount(Condition.PlanetType), Resource.VictoryPoint)],
        Spaceship.Twilight
      );
      break;
    case ArtifactToken.DeepSpace:
      pl.gainRewards(
        [new Reward(3 * pl.eventConditionCount(Condition.DeepSpaceSector), Resource.VictoryPoint)],
        Spaceship.Twilight
      );
      break;
  }
}

// The Asteroid/Protoplanet artifacts count as building a mine and colonizing that planet type
// (RULES_CLARIFICATIONS.md §G6) - including, for the rest of the game, the Lost Fleet round
// scoring tile that rewards the first mine on a new planet type (§G4 "planet3"), same as a real
// build would via player.ts's build()/Condition.NewPlanetType trigger.
function applyArtifactPlanetType(pl: Player, planet: Planet) {
  const alreadyColonized =
    pl.ownedPlanets.some((hex) => hex.data.planet === planet) || pl.data.artifactPlanetTypes.includes(planet);

  pl.gainRewards([new Reward(7, Resource.VictoryPoint)], Spaceship.Twilight);
  pl.data.artifactPlanetTypes.push(planet);

  if (!alreadyColonized) {
    pl.receiveTriggerIncome(Condition.NewPlanetType);
  }
}
