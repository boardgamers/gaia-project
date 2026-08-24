import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import {
  BoardAction,
  Command,
  Expansion,
  Federation,
  Player as PlayerEnum,
  SpaceshipFederation,
  SubPhase,
} from "../enums";
import Reward from "../reward";
import { claimableSpaceshipFederations } from "../spaceships";
import { federationRewards } from "../tiles/federations";
import { spaceshipFederationRewards } from "../tiles/spaceship-federations";
import assert from "../utils/assert";

export function moveChooseFederationTile(
  engine: Engine,
  command: AvailableCommand<Command.ChooseFederationTile>,
  player: PlayerEnum,
  federation: Federation | SpaceshipFederation
) {
  const { tiles, rescore } = command.data;

  assert(tiles.indexOf(federation) !== -1, `Federation ${federation} is not availabe`);

  if (rescore) {
    if (Object.values(SpaceshipFederation).includes(federation as SpaceshipFederation)) {
      rescoreSpaceshipFederationToken(engine, player, federation as SpaceshipFederation);
    } else {
      engine.player(player).gainRewards(federationRewards(federation as Federation), BoardAction.Qic2);
    }
  } else {
    engine.player(player).gainFederationToken(federation as Federation);
    engine.tiles.federations[federation as Federation] -= 1;
  }
}

/**
 * Re-triggers a ship-claimed Federation token's gold-side effect. Per §C1/§G6, re-scoring
 * applies uniformly to all 8 tokens, including Range/Terraform's bonus Build a Mine and
 * Tech's free tile pick - there's no "only once" carve-out for rescoring itself.
 */
function rescoreSpaceshipFederationToken(engine: Engine, player: PlayerEnum, federation: SpaceshipFederation) {
  const pl = engine.player(player);
  const rewardSpec = spaceshipFederationRewards[federation];
  if (rewardSpec) {
    pl.gainRewards(Reward.parse(rewardSpec), BoardAction.Qic2);
  }
  if (federation === SpaceshipFederation.PowerTokens) {
    pl.data.power.area3 += 2;
  }
  if (federation === SpaceshipFederation.Range || federation === SpaceshipFederation.Terraform) {
    engine.processNextMove(SubPhase.FederationTokenBuildMine, { federation }, false);
  }
}

export function moveFormFederation(
  engine: Engine,
  command: AvailableCommand<Command.FormFederation>,
  player: PlayerEnum,
  hexes: string,
  tile: Federation | SpaceshipFederation
) {
  const pl = engine.player(player);
  const claimableFederations = claimableSpaceshipFederations(
    pl.data.explorationShips,
    engine.tiles.spaceshipFederations
  );
  const claimedShip = claimableFederations.find((entry) => entry.federation === tile);
  const poolFederation = Federation.values(Expansion.All).find((entry) => entry === tile);

  assert(poolFederation !== undefined || claimedShip !== undefined, `Impossible to form federation with token ${tile}`);

  const fedInfo = pl.checkAndGetFederationInfo(hexes, engine.map, engine.options.flexibleFederations, engine.replay);

  assert(fedInfo, `Impossible to form federation at ${hexes}`);
  assert(command.data.tiles.includes(tile), `Impossible to form federation ${tile}`);

  if (poolFederation !== undefined) {
    pl.formFederation(fedInfo.hexes, poolFederation);
    engine.tiles.federations[poolFederation] -= 1;
  } else {
    pl.completeFederation(fedInfo.hexes);
    pl.gainSpaceshipFederationToken(claimedShip.federation);
    delete engine.tiles.spaceshipFederations[claimedShip.ship];

    if (
      claimedShip.federation === SpaceshipFederation.Range ||
      claimedShip.federation === SpaceshipFederation.Terraform
    ) {
      engine.processNextMove(SubPhase.FederationTokenBuildMine, { federation: claimedShip.federation }, false);
    }
  }
}
