import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { BoardAction, Command, Federation, Player as PlayerEnum } from "../enums";
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
  federation: Federation
) {
  const pl = engine.player(player);

  const fedInfo = pl.checkAndGetFederationInfo(hexes, engine.map, engine.options.flexibleFederations, engine.replay);

  assert(fedInfo, `Impossible to form federation at ${hexes}`);
  assert(command.data.tiles.includes(federation), `Impossible to form federation ${federation}`);

  pl.formFederation(fedInfo.hexes, federation);
  engine.tiles.federations[federation] -= 1;
}
