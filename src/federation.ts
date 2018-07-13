import { CubeCoordinates } from "hexagrid";
import * as _ from "lodash";

export interface FederationInfo {
  hexes: CubeCoordinates[];
  planets: number;
  satellites: number;
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
  if (fed.planets > comparison.planets && fed.satellites > comparison.satellites) {
    return true;
  }

  if (fed.hexes.length <= comparison.hexes.length) {
    return false;
  }

  return _.differenceWith(comparison.hexes, fed.hexes, (h1, h2) => h1.q === h2.q && h1.r === h2.r).length === 0;
}
