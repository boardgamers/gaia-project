import * as _ from 'lodash';
import { Grid, Hex } from "hexagrid";

export default function spanningTree(dests: Hex[], grid: Grid, params?: {neighbours?: (q: number, r: number) => Hex[]}): Hex[] {
  const neighbours = _.get(params, 'neighbours', grid.neighbours.bind(grid));

  // todo: bulk of the algorithm
  
  return [];
}