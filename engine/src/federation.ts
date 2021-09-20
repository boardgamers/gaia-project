import { difference } from "lodash";
import { GaiaHex } from "./gaia-hex";

export interface FederationInfo {
  hexes: GaiaHex[];
  planets: number;
  satellites: number;
  newSatellites: number;
  powerValue: number;
}

/**
 * Check if a federation possibility can be discarded by comparing it to another
 *
 * Federation can be discarded if it has one less colonized planet & one less satellite than another
 *
 * It can also be discarded if it is contained in the other, i.e. hexes can be removed and it still forms
 * a valid federation
 *
 * @param fed The federation to possibly discard
 * @param comparison The comparison point
 */
export function isOutclassedBy(fed: FederationInfo, comparison: FederationInfo) {
  // We don't use more satellites, we win!
  if (fed.satellites <= comparison.satellites) {
    return false;
  }

  // We use less planets, we win!
  if (fed.planets < comparison.planets) {
    return false;
  }

  // We check if the federations share the same planets.
  // If so, and fed has more satellites, then fed is invalid
  // because it can be built with less satellites
  const fedPlanets = fed.hexes.filter((hex) => hex.hasPlanet());
  const compPlanets = comparison.hexes.filter((hex) => hex.hasPlanet());

  // Comp buildings included in fed buildings, & one more planet & one more satellite
  if (
    fed.planets > comparison.planets &&
    fed.satellites > comparison.satellites &&
    difference(compPlanets, fedPlanets).length === 0
  ) {
    return true;
  }

  if (fedPlanets.length === compPlanets.length && difference(fedPlanets, compPlanets).length === 0) {
    if (fed.satellites > comparison.satellites) {
      // We use more satellites and the same planets, so we lose
      return true;
    }
  }

  // Not outclassed
  return false;
}
