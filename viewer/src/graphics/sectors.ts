import { GaiaHex, Player } from "@gaia-project/engine";
import { lostFleetSectorKey } from "@gaia-project/engine/src/lost-fleet-map";

/** Visual map mode, NOT Condition.Sector scoring: include physical Deep Space tiles as well as
 * regular sectors. Interspace has no sector key. colonizedBy includes Lantids' shared mines but
 * excludes Gaiaformers and Space Stations. Keep ordinary sector IDs (including variants) intact. */
export function isColonizedSector(hex: GaiaHex, player: Player): boolean {
  const sector = lostFleetSectorKey(hex);
  return (
    sector !== undefined &&
    player.data.occupied.some((other) => other.colonizedBy(player.player) && lostFleetSectorKey(other) === sector)
  );
}
