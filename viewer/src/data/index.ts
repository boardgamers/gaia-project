import { AdvTechTilePos, Booster, Federation, GaiaHex, HighlightHex, TechTilePos } from "@gaia-project/engine";

export type ButtonWarning = { title?: string; body: string[]; okButton?: { label: string; action: () => void } };

export type ModalButtonData = { content: string; canActivate: () => boolean; show: (boolean) => void };

export interface ButtonData {
  label?: string;
  command?: string;
  tooltip?: string;
  // Simple label
  title?: string;
  times?: number[];
  modal?: ModalButtonData;
  hexes?: HighlightHexData;
  automatic?: boolean; // Should the user have to click on the hex or is it automatic?
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
  warning?: ButtonWarning;

  buttons?: ButtonData[];
  hide?: boolean;
  booster?: Booster;
  tech?: TechTilePos | AdvTechTilePos;
  shortcuts?: string[];
}

export type MapData = GaiaHex[];
export type HighlightHexData = Map<GaiaHex, HighlightHex>;
export type LogPlacement = "top" | "bottom" | "off";

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

  activeButton: ButtonData | null;
  hexSelection: boolean;

  logPlacement: LogPlacement;
}
