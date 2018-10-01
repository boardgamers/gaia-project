import {Grid, Hex, CubeCoordinates} from "hexagrid";
import * as seedrandom from "seedrandom";
import * as shuffleSeed from "shuffle-seed";
import * as assert from 'assert';
import Sector from "./sector";
import { Player, Planet, Faction } from "./enums";
import { GaiaHex } from "./gaia-hex";

// Data: from outer ring to inside ring, starting from a corner
const s1 = {name: "s1", map: "eeeeemevoeed,sereee,e".replace(/,/g, "")};
const s2 = {name: "s2", map: "evteedemeoee,eeiees,e".replace(/,/g, "")};
const s3 = {name: "s3", map: "eemeeteedree,geeiee,e".replace(/,/g, "")};
const s4 = {name: "s4", map: "eeteeereeeei,eoesev,e".replace(/,/g, "")};
const s5 = {name: "s5", map: "eeiemoeedvee,geeeee,e".replace(/,/g, "")};
const s5b = {name: "s5b", map: "eeiemoeeevee,geeeee,e".replace(/,/g, "")};
const s6 = {name: "s6", map: "eeemeedmeeee,serege,e".replace(/,/g, "")};
const s6b = {name: "s6b", map: "eeemeedmeeee,eerege,e".replace(/,/g, "")};
const s7 = {name: "s7", map: "meeseeeeteee,eoegeg,e".replace(/,/g, "")};
const s7b = {name: "s7b", map: "meeeeeeeteee,egeseg,e".replace(/,/g, "")};
const s8 = {name: "s8", map: "eeremeeeemee,eietev,e".replace(/,/g, "")};
const s9 = {name: "s9", map: "evemieeeeese,eeeget,e".replace(/,/g, "")};
const s10 = {name: "s10", map: "eeemmeeeeore,deegee,e".replace(/,/g, "")};

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
  grid: Grid<GaiaHex>; // hexagrid
  distanceCache: {[coord: string]: {[coord: string]: number}} = {};

  constructor(nbPlayers ?: number, seed ?: string) {
    if (nbPlayers === undefined) {
      return;
    }

    this.nbPlayers = nbPlayers;
    this.rng = seedrandom(seed);
    this.seed = seed;

    // Keep tests valid even under new map generation rules
    const germanRules = !["randomSeed", "12", "9876", "yellow-paint-8951", "green-jeans-8458", "Fastgame01"].includes(seed);
    do {
      this.generate();
    } while (!this.isValid(germanRules));
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
  generate() {
    const definitions = this.chooseSides();
    const centers = this.configuration().centers;

    const [hexagon, ...hexagons] = definitions.map((side, index) => Sector.create(side.map, side.name, centers[index]).rotateRight(Math.floor(this.rng() * 6), centers[index]));

    this.grid = hexagon.merge(...hexagons);
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
