import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { BoardAction, Command, Expansion, Federation, Player as PlayerEnum, SpaceshipFederation } from "../enums";
import { claimableSpaceshipFederations } from "../spaceships";
import { federationRewards } from "../tiles/federations";

export function moveChooseFederationTile(
  engine: Engine,
  command: AvailableCommand<Command.ChooseFederationTile>,
  player: PlayerEnum,
  federation: Federation
) {
  const { tiles, rescore } = command.data;

  assert(tiles.indexOf(federation) !== -1, `Federation ${federation} is not availabe`);

  if (rescore) {
    engine.player(player).gainRewards(federationRewards(federation), BoardAction.Qic2);
  } else {
    engine.player(player).gainFederationToken(federation);
    engine.tiles.federations[federation] -= 1;
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
  const claimableFederations = claimableSpaceshipFederations(pl.data.explorationShips, engine.tiles.spaceshipFederations);
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
  }
}
