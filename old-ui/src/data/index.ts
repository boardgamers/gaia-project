import { AdvTechTilePos, Booster, Federation, GaiaHex, TechTilePos } from "@gaia-project/engine";

export interface ButtonData {
  label?: string;
  command?: string | number;
  tooltip?: string;
  // Simple label
  title?: string;
  times?: number[];
  modal?: string;
  hexes?: HighlightHexData;
  hover?: boolean;
  researchTiles?: string[];
  techs?: Array<TechTilePos | AdvTechTilePos>;
  boosters?: Booster[];
  selectHexes?: boolean;
  actions?: string[];
  federations?: Federation[];
  range?: number;
  costs?: { [range: number]: string };
  // Rotate sectors command?
  rotation?: boolean;
  needConfirm?: boolean;

  buttons?: ButtonData[];
  hide?: boolean;
  booster?: Booster;
}

export type MapData = GaiaHex[];
export type HighlightHexData = Map<GaiaHex, { cost?: string }>;

export interface GameContext {
  highlighted: {
    hexes: HighlightHexData;
    researchTiles: Set<string>;
    techs: Set<TechTilePos | AdvTechTilePos>;
    boosters: Set<Booster>;
    actions: Set<string>;
    federations: Set<Federation>;
  };

  rotation: Map<string, number>;

  activeButton: ButtonData;
  hexSelection: boolean;
}
