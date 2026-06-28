import { uniq } from "lodash";
import { claimableSpaceshipFederations } from "../spaceships";
import Engine from "../engine";
import { Building, Command, Faction, Federation, Player } from "../enums";
import { FederationInfo } from "../federation";
import PlayerObject, { BuildWarning } from "../player";
import { AvailableCommand, AvailableFederationChoice } from "./types";

function federationWarnings(p: PlayerObject, fed: FederationInfo): BuildWarning[] {
  const ret: BuildWarning[] = [];
  if (p.faction !== Faction.Ivits && fed.newSatellites > p.data.power.area1) {
    ret.push(BuildWarning.federationWithChargedTokens);
  }
  if (p.faction === Faction.Ambas && !fed.hexes.some((h) => h.buildingOf(p.player) === Building.PlanetaryInstitute)) {
    ret.push(BuildWarning.ambasFederationWithoutPi);
  }
  return ret;
}

export function possibleFederations(engine: Engine, player: Player): AvailableCommand<Command.FormFederation>[] {
  const commands = Array<AvailableCommand<Command.FormFederation>>();
  const possiblePoolTiles: Federation[] = Object.keys(engine.tiles.federations)
    .filter((key) => engine.tiles.federations[key] > 0)
    .map((f) => f as Federation);
  const p = engine.player(player);
  const claimableFederations = claimableSpaceshipFederations(p.data.explorationShips, engine.tiles.spaceshipFederations);
  const possibleTiles: AvailableFederationChoice[] = [
    ...possiblePoolTiles,
    ...claimableFederations.map((entry) => entry.federation),
  ];

  if (possibleTiles.length > 0) {
    if (engine.options.noFedCheck || engine.replay) {
      commands.push({
        name: Command.FormFederation,
        player,
        data: {
          tiles: possibleTiles,
          federations: [],
          claimableFederations,
        },
      });
    } else {
      const possibleFeds = p.availableFederations(engine.map, engine.options.flexibleFederations);

      if (possibleFeds.length > 0 || p.federationCache.custom) {
        commands.push({
          name: Command.FormFederation,
          player,
          data: {
            tiles: possibleTiles,
            federations: possibleFeds.map((fed) => ({
              ...fed,
              hexes: fed.hexes
                .map((hex) => hex.toString())
                .sort()
                .join(","),
              warnings: federationWarnings(p, fed),
            })),
            claimableFederations,
          },
        });
      }
    }
  }

  return commands;
}

export function possibleFederationTiles(engine: Engine, player: Player, from: "pool" | "player") {
  const commands: AvailableCommand<Command.ChooseFederationTile>[] = [];

  const possibleTiles: Federation[] = Object.keys(engine.tiles.federations)
    .filter((key) => engine.tiles.federations[key] > 0)
    .map((f) => f as Federation);
  const playerTiles = uniq(engine.player(player).data.tiles.federations.map((fed) => fed.tile));

  commands.push({
    name: Command.ChooseFederationTile,
    player,
    data: {
      tiles: from === "player" ? playerTiles : possibleTiles,
      // Tiles that are rescored just add the rewards, but don't take the token
      rescore: from === "player",
    },
  });

  return commands;
}
