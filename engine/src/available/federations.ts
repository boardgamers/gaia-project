import { uniq } from "lodash";
import { claimableSpaceshipFederations } from "../spaceships";
import { qicForDistance, terraformingCost } from "../cost";
import Engine from "../engine";
import { Building, Command, Faction, Federation, Planet, Player, Resource, SpaceshipFederation } from "../enums";
import { FederationInfo } from "../federation";
import { terraformingStepsRequired } from "../planets";
import PlayerObject, { BuildWarning } from "../player";
import Reward from "../reward";
import { AvailableBuilding, AvailableCommand, AvailableFederationChoice } from "./types";

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
  const pl = engine.player(player);
  const playerTiles: AvailableFederationChoice[] = uniq([
    ...pl.data.tiles.federations.map((fed) => fed.tile),
    ...pl.data.spaceshipFederations.map((fed) => fed.tile),
  ]);

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

/**
 * Range/Terraform Federation tokens each grant a one-time bonus Build a Mine action without paying
 * the mine's normal build cost (board cost). Transdim (needs Command.GaiaFormTransdim) and Asteroid
 * (needs a consumed Gaiaformer, which doesn't compose with a blanket cost waiver) are excluded, same
 * as the non-Eclipse branch of possibleSpaceshipBuildMine. Gaia planets still cost their normal
 * gaiaFormingCost() QIC for both tokens, since that's a habitability cost, not the build cost.
 * Range additionally waives range QIC entirely (limitless range) but still charges full terraforming
 * ore with no discount; Terraform charges normal range QIC but discounts up to 3 terraforming steps.
 */
export function possibleFederationTokenBuildMine(
  engine: Engine,
  player: Player,
  data: { federation: SpaceshipFederation }
): AvailableCommand<Command.Build>[] {
  const pl = engine.player(player);
  const buildings: AvailableBuilding[] = [];

  if (pl.data.buildings[Building.Mine] >= pl.maxBuildings(Building.Mine)) {
    return [];
  }

  for (const hex of engine.map.toJSON()) {
    if (hex.data.planet === Planet.Transdim || hex.data.planet === Planet.Asteroid || !pl.canOccupy(hex)) {
      continue;
    }

    const rewards: Reward[] = [];
    let steps = 0;

    if (hex.data.planet === Planet.Gaia) {
      rewards.push(pl.gaiaFormingCost());
    } else {
      const planet = hex.occupied() ? pl.planet : hex.data.planet;
      steps = terraformingStepsRequired(pl.faction, planet);
      const discountedSteps = data.federation === SpaceshipFederation.Terraform ? Math.max(steps - 3, 0) : steps;
      const oreCost = terraformingCost(pl.data, discountedSteps, engine.replay);
      if (oreCost === null) {
        continue;
      }
      if (oreCost.count > 0) {
        rewards.push(oreCost);
      }
    }

    let qicWarning: BuildWarning | undefined;
    if (data.federation === SpaceshipFederation.Terraform) {
      const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay);
      if (qicNeeded === null) {
        continue;
      }
      if (qicNeeded.amount > 0) {
        rewards.push(new Reward(qicNeeded.amount, Resource.Qic));
      }
      qicWarning = qicNeeded.warning;
    }

    const mergedRewards = Reward.merge(rewards);
    if (!pl.data.canPay(mergedRewards)) {
      continue;
    }

    buildings.push({
      building: Building.Mine,
      coordinates: hex.toString(),
      cost: Reward.toString(mergedRewards),
      steps,
      warnings: qicWarning ? [qicWarning] : null,
    });
  }

  if (buildings.length === 0) {
    return [];
  }

  return [{ name: Command.Build, player, data: { buildings } }];
}
