import {Types} from "honeycomb-grid";
import * as seedrandom from "seedrandom";
import * as shuffleSeed from "shuffle-seed";
import Sector, { GaiaHex } from "./sector";

const s1 = "eee,dsee,eeere,eeem,ove";
const s2 = "evt,eeee,eseie,oeed,eme";
const s3 = "eem,egee,eeeee,reit,dee";
const s4 = "eet,ieoe,eveee,eese,eer";
const s5 = "eei,egee,eeeem,veeo,dee";
const s5b = "eei,egee,eeeem,veeo,eee";
const s6 = "eee,esem,eeere,egee,emd";
const s6b = "eee,eeem,eeere,egee,emd";
const s7 = "mee,eeos,egeee,eege,tee";
const s7b = "mee,eege,egeee,eese,tee";
const s8 = "eer,eeie,eveem,mete,eee";
const s9 = "eve,eeem,steei,eege,eee";
const s10 = "eee,edem,reeem,oege,eee";

const smallConfiguration = {
  sectors: [s1, s2, s3, s4, s5b, s6b, s7b],
  nbSectors: 7,
  centers: [{x:0, y: 0}, {x: -2, y: -4}, {x: -5, y: -1}, {x: -3, y: 3}, {x: 3, y: -4}, {x: 5, y: 0}, {x: 2, y: 4}]
};

const bigConfiguration = {
  sectors: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10],
  nbSectors: 10,
  centers: [
    // ROW 1
    {x: -2, y: -4}, {x: 3, y: -4}, {x: 8, y: -3},
    // ROW 2
    {x: -5, y: -1}, {x:0, y: 0}, {x: 5, y: 0}, {x: 10, y: 1},
    // ROW 3 
    {x: -3, y: 3}, {x: 2, y: 4}, {x: 7, y: 4}
  ]
};

export default class SpaceMap {
  rng: seedrandom.prng;
  nbPlayers;
  grid: Types.Grid<GaiaHex>; // honeycomb-grid

  constructor(nbPlayers : number, seed : string) {
    if (nbPlayers !== undefined) {
      this.nbPlayers = nbPlayers;
    }

    this.rng = seedrandom(seed);
    
    do {
      this.generate();
    } while (!this.isValid());
  }

  /** 
   *  Check if the map is correct (no two planets of the same color side by side)
  */
  isValid(): boolean {
    return true;
  }

  /** 
   * Generate the map
  */
  generate() {
    const definitions = this.chooseSides();
    const [hexagon, ...hexagons] = definitions.map((side, index) => Sector.create(side, index, this.configuration().centers[index]));

    //Todo: concatenate the hexagons in the right way, and store in this.grid
    this.grid = hexagon.concat(...hexagons);
  }

  chooseSides() : string[] {
    const definitions = this.configuration().sectors;
    // Random sort of the chosen sectors, sliced
    return shuffleSeed.shuffle(definitions, this.rng()).slice(0, this.configuration().nbSectors);
  }

  toJSON() {
    return this.grid;
  }

  configuration() {
    return SpaceMap.configuration(this.nbPlayers);
  }

  static configuration(nbPlayers: number) {
    if (nbPlayers <= 2) {
      return smallConfiguration;
    } else {
      return bigConfiguration;
    }
  }
}