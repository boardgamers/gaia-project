import Engine, { GaiaHex, Player, PlayerEnum } from "@gaia-project/engine";
import { sum, uniq } from "lodash";
import { leechPlanets, upgradableBuildingsOfOtherPlayers } from "../logic/utils";
import { MapModeType } from "./actions";

export function sectors(player: Player): number {
  return uniq(player.data.occupied.filter((hex) => hex.colonizedBy(player.player)).map((hex) => hex.data.sector))
    .length;
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
