import { Grid, Hex } from "hexagrid";

/**
 * Memoized topology information for a grid: neighbours and walking distances.
 *
 * `Grid.neighbours` recomputes string keys and does 6 map lookups on every call, and
 * `Grid.distance` runs a full A* per hex pair. Both show up as major hotspots when
 * computing federations (thousands of shortest-path searches over the same grid).
 *
 * This helper assumes the grid is not mutated after the topology is created, which
 * holds for the map grid and for the throwaway working grids used by the federation
 * algorithms.
 */
export interface GridIndex<HexType extends Hex<any>> {
  /** index -> hex */
  hexList: HexType[];
  /** hex -> index */
  indexOf: Map<HexType, number>;
  /** index -> indices of its neighbours, in `Grid.neighbours` order */
  neighbourIndices: number[][];
}

export class GridTopology<HexType extends Hex<any>> {
  private adjacency: Map<HexType, HexType[]> = new Map();
  private distances: Map<HexType, Map<HexType, number>> = new Map();
  private _index: GridIndex<HexType>;

  constructor(private grid: Grid<HexType>) {}

  /** Integer-indexed view of the grid, for algorithms that want to avoid Map/Set lookups in hot loops */
  index(): GridIndex<HexType> {
    if (this._index === undefined) {
      const hexList = [...this.grid.values()];
      const indexOf = new Map(hexList.map((hex, i) => [hex, i] as [HexType, number]));
      const neighbourIndices = hexList.map((hex) => this.neighbours(hex).map((neighbour) => indexOf.get(neighbour)));
      this._index = { hexList, indexOf, neighbourIndices };
    }
    return this._index;
  }

  neighbours(hex: HexType): HexType[] {
    let ret = this.adjacency.get(hex);
    if (ret === undefined) {
      ret = this.grid.neighbours(hex);
      this.adjacency.set(hex, ret);
    }
    return ret;
  }

  /**
   * Walking distance between two hexes of the grid, i.e. the number of steps needed
   * to reach `to` from `from` while staying within the grid. -1 if unreachable.
   *
   * Same semantics as `Grid.distance`, but memoized (one BFS per source hex instead
   * of one A* per pair).
   */
  distance(from: HexType, to: HexType): number {
    let dists = this.distances.get(from);
    if (dists === undefined) {
      dists = this.bfs(from);
      this.distances.set(from, dists);
    }
    return dists.get(to) ?? -1;
  }

  private bfs(from: HexType): Map<HexType, number> {
    const dist: Map<HexType, number> = new Map([[from, 0]]);
    let frontier: HexType[] = [from];
    let d = 0;

    while (frontier.length > 0) {
      const next: HexType[] = [];
      d += 1;
      for (const hex of frontier) {
        for (const neighbour of this.neighbours(hex)) {
          if (!dist.has(neighbour)) {
            dist.set(neighbour, d);
            next.push(neighbour);
          }
        }
      }
      frontier = next;
    }

    return dist;
  }
}

const cache = new WeakMap<Grid<any>, GridTopology<any>>();

/** Get (or create) the memoized topology of a grid. The grid must not be mutated afterwards. */
export function topologyOf<HexType extends Hex<any>>(grid: Grid<HexType>): GridTopology<HexType> {
  let topology = cache.get(grid) as GridTopology<HexType>;
  if (topology === undefined) {
    topology = new GridTopology(grid);
    cache.set(grid, topology);
  }
  return topology;
}
