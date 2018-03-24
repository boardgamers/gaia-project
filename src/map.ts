import {Grid, Hex, CubeCoordinates} from "hexagrid";
import * as seedrandom from "seedrandom";
import * as shuffleSeed from "shuffle-seed";
import Sector, { GaiaHexData } from "./sector";

// Data: from outer ring to inside ring, starting from a corner
const s1 = "eeeeemevoeed,sereee,e".replace(/,/g, "");
const s2 = "evteedemeoee,eeiees,e".replace(/,/g, "");
const s3 = "eemeeteedree,geeiee,e".replace(/,/g, "");
const s4 = "eeteeereeeei,eoesev,e".replace(/,/g, "");
const s5 = "eeiemoeedvee,geeeee,e".replace(/,/g, "");
const s5b = "eeiemoeeevee,geeeee,e".replace(/,/g, "");
const s6 = "eeemeedmeeee,serege,e".replace(/,/g, "");
const s6b = "eeemeedmeeee,eerege,e".replace(/,/g, "");
const s7 = "meeseeeeteee,eoegeg,e".replace(/,/g, "");
const s7b = "meeeeeeeteee,egeseg,e".replace(/,/g, "");
const s8 = "eeremeeeemee,eietev,e".replace(/,/g, "");
const s9 = "evemieeeeese,eeeget,e".replace(/,/g, "");
const s10 = "eeemmeeeeore,deegee,e".replace(/,/g, "");

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
  hex.rotateLeft(i);

  smallConfiguration.centers.push(hex.toJSON());
  bigConfiguration.centers.push(hex.toJSON());
}

// Big configuration: add 3 more
for (let i = -1; i <= 1; i++) {
  const hex = new Hex(10, -4);
  hex.rotateLeft(i, {q: 5, r: -2, s: -3});
  bigConfiguration.centers.push(hex);
}

export default class SpaceMap {
  rng: seedrandom.prng;
  nbPlayers: number;
  grid: Grid<GaiaHexData>; // hexagrid

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
    const centers = this.configuration().centers;

    const [hexagon, ...hexagons] = definitions.map((side, index) => Sector.create(side, index, centers[index]).rotateLeft(Math.floor(this.rng()*6), centers[index]));

    this.grid = hexagon.merge(...hexagons);
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