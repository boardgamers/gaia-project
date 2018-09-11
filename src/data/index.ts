import {TechTilePos, GaiaHex, AdvTechTilePos, Booster, Federation} from "@gaia-project/engine";

export interface ButtonData {
  label?: string;
  command: string;
  tooltip?: string;
  modal?: string;
  hexes?: HighlightHexData;
  hover?: boolean;
  researchTiles?: string[];
  techs?: Array<TechTilePos | AdvTechTilePos>;
  boosters?: Booster[];
  selectHexes?: boolean;
  actions?: string[];
  federations?: Federation[];

  buttons?: ButtonData[];
  hide?: boolean;
}

export type MapData = GaiaHex[];
export type HighlightHexData = Map<GaiaHex, {cost?: string}>;

export interface GameContext {
  highlighted: {
    hexes: HighlightHexData,
    researchTiles: Set<string>,
    techs: Set<TechTilePos | AdvTechTilePos>,
    boosters: Set<Booster>,
    actions: Set<string>,
    federations: Set<Federation>
  };

  activeButton: ButtonData;
  hexSelection: boolean;
}
