import Engine, { Condition, GaiaHex, Player, PlayerEnum } from "@gaia-project/engine";
import { sum } from "../logic/lodash-utils";
import { leechPlanets, upgradableBuildingsOfOtherPlayers } from "../logic/utils";
import { MapModeType } from "./actions";

/** Delegates to the engine's own Condition.Sector (rather than re-uniquing hex.data.sector here) so
 * this stays in sync with its Lost Fleet rules - a Deep Space Sector never counts as a sector here
 * (owner ruling), which a second from-scratch implementation had silently drifted away from. */
export function sectors(player: Player): number {
  return player.eventConditionCount(Condition.Sector);
}

export function leechNetwork(engine: Engine, player: PlayerEnum): number {
  const map = engine.map;
  const hexes: GaiaHex[] = Array.from(map.grid.values());

  return sum(
    hexes.map((hex) => {
      const b = upgradableBuildingsOfOtherPlayers(engine, hex, player);
      if (b > 0 && leechPlanets(map, player, hex).length > 0) {
        return b;
      }
      return 0;
    })
  );
}

export const mapModeTypeOptions = [
  { value: MapModeType.default, text: "Default" },
  { value: MapModeType.sectors, text: "Sectors" },
  { value: MapModeType.federations, text: "Federations" },
  { value: MapModeType.leech, text: "Leech Network" },
];
