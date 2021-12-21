import Engine, { GaiaHex, Phase, PlayerEnum, SpaceMap } from "@gaia-project/engine";
import { upgradedBuildings } from "@gaia-project/engine/src/buildings";
import { LEECHING_DISTANCE } from "@gaia-project/engine/src/engine";

export function phaseBeforeSetupBuilding(data: Engine): boolean {
  return (
    data.phase === Phase.SetupInit ||
    data.phase === Phase.SetupBoard ||
    data.phase === Phase.SetupFaction ||
    data.phase === Phase.SetupAuction
  );
}

export const deltaCounter: (initial: number) => (val: number) => number = (initial: number) => {
  let last = initial;

  return (val: number) => {
    const ret = val - last;
    last = val;
    return ret;
  };
};

export function radiusTranslate(radius: number, index: number, positions: number) {
  const deg = 360 / positions;
  const x = radius * Math.sin(((-180 + index * deg) * Math.PI) / 180);
  const y = radius * Math.cos(((-180 + index * deg) * Math.PI) / 180);
  return `translate(${x}, ${y})`;
}

export function leechPlanets(map: SpaceMap, player: PlayerEnum, hex: GaiaHex): GaiaHex[] {
  return Array.from(map.grid.values()).filter(
    (h) => h.colonizedBy(player) && map.distance(h, hex) <= LEECHING_DISTANCE
  );
}

export function upgradableBuildingsOfOtherPlayers(engine: Engine, hex: GaiaHex, player: PlayerEnum): number {
  const p = hex.data.player;
  return p != null && p != player && upgradedBuildings(hex.buildingOf(p), engine.player(p).faction).length > 0 ? 1 : 0;
}
