import {Grid, Hex, CubeCoordinates} from "hexagrid";
import seedrandom from "seedrandom";
import shuffleSeed from "shuffle-seed";
import assert from 'assert';
import { keyBy } from 'lodash';
import Sector from "./sector";
import { Player, Planet, Faction } from "./enums";
import { GaiaHex } from "./gaia-hex";

// Data: from outer ring to inside ring, starting from top
const s1 = {name: "1", map: "eeemevoeedee,ereees,e".replace(/,/g, "")};
const s2 = {name: "2", map: "teedemeoeeev,eieese,e".replace(/,/g, "")};
const s3 = {name: "3", map: "meeteedreeee,eeieeg,e".replace(/,/g, "")};
const s4 = {name: "4", map: "teeereeeeiee,oeseve,e".replace(/,/g, "")};
const s5 = {name: "5A", map: "iemoeedveeee,eeeeeg,e".replace(/,/g, "")};
const s5b = {name: "5B", map: "iemoeeeveeee,eeeeeg,e".replace(/,/g, "")};
const s6 = {name: "6A", map: "emeedmeeeeee,ereges,e".replace(/,/g, "")};
const s6b = {name: "6B", map: "emeedmeeeeee,eregee,e".replace(/,/g, "")};
const s7 = {name: "7A", map: "eseeeeteeeme,oegege,e".replace(/,/g, "")};
const s7b = {name: "7B", map: "eeeeeeteeeme,gesege,e".replace(/,/g, "")};
const s8 = {name: "8", map: "remeeeemeeee,ieteve,e".replace(/,/g, "")};
const s9 = {name: "9", map: "emieeeeeseev,eegete,e".replace(/,/g, "")};
const s10 = {name: "10", map: "emmeeeeoreee,eegeed,e".replace(/,/g, "")};

const sectors = keyBy([s1, s2, s3, s4, s5, s5b, s6, s6b, s7, s7b, s8, s9, s10], "name");
// Due to legacy issues

const reverseSide = (side: string) => {
  return side[0] + side.slice(1, 12).split("").reverse().join("") + side[12] + side.slice(13, 18).split("").reverse().join("") + side[18];
};

const rSectors = keyBy([s1, s2, s3, s4, s5, s5b, s6, s6b, s7, s7b, s8, s9, s10].map(s => ({name: s.name, map: reverseSide(s.map)})), "name");

const smallCenters = ["5x-2", "2x3", "3x-5", "0x0", "-3x5", "-2x-3", "-5x2"].map(coord => CubeCoordinates.parse(coord));
const bigCenters = ["5x-2", "2x3", "-1x8", "3x-5", "0x0", "-3x5", "-6x10", "-2x-3", "-5x2", "-8x7"].map(coord => CubeCoordinates.parse(coord));

export interface SectorInMapConfiguration {
  sector: string;
  rotation: number;
  center?: CubeCoordinates;
}

export interface MapConfiguration {
  sectors?: SectorInMapConfiguration[];
  // Are sector tiles mirrored?
  mirror?: boolean;
}

const smallConfiguration = {
  sectors: [s1, s2, s3, s4, s5b, s6b, s7b],
  nbSectors: 7,
  centers: [{q: 0, r: 0, s: 0}]
};

const bigConfiguration = {
  sectors: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10],
  nbSectors: 10,
  centers: [{q: 0, r: 0, s: 0}]
};

// Centers of the small configuration
for (let i = 0; i < 6; i++) {
  const hex = new Hex(5, -2);
  hex.rotateRight(i);

  smallConfiguration.centers.push(hex.toJSON());
  bigConfiguration.centers.push(hex.toJSON());
}

// Big configuration: add 3 more
for (let i = -1; i <= 1; i++) {
  const hex = new Hex(-6, 10);
  hex.rotateRight(i, {q: -3, r: 5, s: -2});
  bigConfiguration.centers.push(hex);
}

export default class SpaceMap {
  rng: seedrandom.prng;
  nbPlayers: number;
  seed: string;
  /**
   * Simple array listing sectors and how they are placed. Allows to reconstruct the map with little data
   */
  placement?: MapConfiguration;
  grid: Grid<GaiaHex>; // hexagrid
  distanceCache: {[coord: string]: {[coord: string]: number}} = {};

  constructor(nbPlayers ?: number, seed ?: string, mirror?: boolean) {
    if (nbPlayers === undefined) {
      return;
    }

    this.nbPlayers = nbPlayers;
    this.rng = seedrandom(seed);
    this.seed = seed;

    // Keep tests valid even under new map generation rules
    const germanRules = !["Gianluigi-Buffon", "randomSeed", "12", "9876", "yellow-paint-8951", "green-jeans-8458", "Fastgame01"].includes(seed);
    do {
      this.generate(mirror);
    } while (!this.isValid(germanRules));
  }

  load(conf: MapConfiguration) {
    const centers = conf.sectors.length === 7 ? smallCenters : bigCenters;

    // Legacy map generation, to keep old tests valid
    const oldGen = ["Gianluigi-Buffon", "randomSeed", "12", "9876", "yellow-paint-8951", "green-jeans-8458", "Fastgame01", "zadbd", "bosco-marcuzzo3", "Alex-Del-Pieroooooo", "SGAMBATA", "djfjjv4k", "randomSeed2", "randomseed", "polite-food-8474", "green-jeans-8458", "waiting-fabs-1", "curious-stay-2150", "Three", "GaiaRocks", "SalmurOnTheBoard"].includes(this.seed);

    const [hexagon, ...hexagons] = conf.sectors.map((val: SectorInMapConfiguration, i) => {
      const def = ((conf.mirror || oldGen) ? rSectors : sectors)[val.sector].map;
      const center = val.center || centers[i];

      return Sector.create(def, val.sector, center).rotateRight(val.rotation, center);
    });

    this.grid = hexagon.merge(...hexagons);
    this.placement = conf;
  }

  /**
   *  Check if the map is correct (no two HOME planets of the same color side by side - following german rules)
   */
  isValid(germanRules: boolean = true): boolean {
    for (const hex of this.grid.values()) {
      for (const nb of this.grid.neighbours(hex)) {
        if (germanRules) {
          // German rules only forbid HOME planets from being next to each other, so gaia / transdim planets are ok
          if (hex.data.planet !== Planet.Transdim && hex.data.planet !== Planet.Empty && hex.data.planet !== Planet.Gaia && hex.data.planet === nb.data.planet) {
            return false;
          }
        } else {
          // English rules are kept for backwards compatibility as most of the tests are based on them
          // English rules do not allow transdim/gaia planets next to each other, German rules do
          if (hex.data.sector !== nb.data.sector && hex.data.planet !== Planet.Empty && hex.data.planet === nb.data.planet) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Generate the map
   */
  generate(mirror = false) {
    const definitions = this.chooseSides();
    const centers = this.configuration().centers;

    this.placement = {sectors: definitions.map((side, i) => ({sector: side.name, rotation: Math.floor(this.rng() * 6), center: centers[i]})), mirror};
    this.load(this.placement);
  }

  rotateSector(center: string, times: number) {
    const coords = CubeCoordinates.parse(center);

    assert(this.configuration().centers.some(pt => pt.q === coords.q && pt.r === coords.r), `${center} is not the center of a sector`);

    // Easy way to get coordinates of hexes in a sector
    const sectorHexes = Hex.hexagon(2, {center: coords});

    for (const hex of sectorHexes) {
      this.grid.get(hex).rotateRight(times, coords);
    }
  }

  chooseSides(): Array<{map: string, name: string}> {
    const definitions = this.configuration().sectors;
    // Random sort of the chosen sectors, sliced
    return shuffleSeed.shuffle(definitions, this.rng()).slice(0, this.configuration().nbSectors);
  }

  toJSON() {
    return Array.from(this.grid.values());
  }

  static fromData(data: any) {
    const map = new SpaceMap();

    map.grid = new Grid(...data.map(hex => new GaiaHex(hex.q, hex.r, hex.data)));

    return map;
  }

  configuration() {
    return SpaceMap.configuration(this.nbPlayers);
  }

  distance(hex1: CubeCoordinates, hex2: CubeCoordinates) {
    // const h1 = `${hex1.q}x${hex1.r}`;
    // const h2 = `${hex2.q}x${hex2.r}`;

    // let distance = _.get(this.distanceCache, `${h1}.${h2}`) as any as number;

    // if (distance !== undefined) {
    //   return distance;
    // }

    // distance = this.grid.distance(hex1, hex2);

    // _.set(this.distanceCache, `${h1}.${h2}`, distance);
    // _.set(this.distanceCache, `${h2}.${h1}`, distance);

    // return distance;
    return CubeCoordinates.distance(hex1, hex2);
  }

  withinDistance(center: CubeCoordinates, distance: number): GaiaHex[] {
    const group = GaiaHex.hexagon(distance, {center});
    const ret: GaiaHex[] = [];

    for (const hex of group) {
      if (this.grid.get(hex)) {
        ret.push(this.grid.get(hex));
      }
    }

    return ret;
  }

  excludedHexesForBuildingFederation(player: Player, faction: Faction) {
    const ret: Set<GaiaHex> = new Set();

    for (const hex of this.grid.values()) {
      // A planet not occupied by the player can't be used to build a federation
      if (hex.data.planet !== Planet.Empty && !hex.colonizedBy(player)) {
        ret.add(hex);
        continue;
      }

      // If the player already has a federation including this hex, then this hex
      // and the ones around are off limits.
      if (faction !== Faction.Ivits && hex.belongsToFederationOf(player)) {
        ret.add(hex);
        for (const neighbour of this.grid.neighbours(hex)) {
          ret.add(neighbour);
        }
      }
    }

    return ret;
  }

  recalibrate() {
    this.grid.recalibrate();
  }

  static configuration(nbPlayers: number) {
    if (nbPlayers <= 2) {
      return smallConfiguration;
    } else {
      return bigConfiguration;
    }
  }
}

export {smallConfiguration, bigConfiguration};
