import {Types} from "honeycomb-grid";
import * as seedrandom from "seedrandom";
import * as shuffleSeed from "shuffle-seed";
import Sector, { GaiaHex } from "./sector";

const s1 = "eee,dsee,eeere,eeem,ove"
const s2 = "evt,eeee,eseie,oeed,eme"
const s3 = "eem,egee,eeeee,reit,dee"
const s4 = "eet,ieoe,eveee,eese,eer"
const s5 = "eei,egee,eeeem,veeo,dee"
const s5b = "eei,egee,eeeem,veeo,eee"
const s6 = "eee,esem,eeere,egee,emd"
const s6b = "eee,eeem,eeere,egee,emd"
const s7 = "mee,eeos,egeee,eege,tee"
const s7b = "mee,eege,egeee,eese,tee"
const s8 = "eer,eeie,eveem,mete,eee"
const s9 = "eve,eeem,steei,eege,eee"
const s10 = "eee,edem,reeem,oege,eee"

const sectors = [[s1,s1],[s2,s2],[s3,s3],[s4,s4],[s5,s5b],[s6,s6b],[s7,s7b],[s8,s8],[s9,s9],[s10,s10]]

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
    const hexagons = definitions.map((side, index) => Sector.create(side, index));

    //Todo: concatenate the hexagons in the right way, and store in this.grid
    this.grid = hexagons[0];
  }

  chooseSides() : string[] {
    const definitions = sectors.map(el => this.rng() >= 0.5 ? el[0] : el[1]);
    // Random sort of the chosen sectors, limited to 8
    return shuffleSeed.shuffle(definitions, this.rng()).slice(0, 8);
  }

  toJSON() {
    return this.grid;
  }
}