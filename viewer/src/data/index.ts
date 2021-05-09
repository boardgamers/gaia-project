import {
  AdvTechTilePos,
  BoardAction,
  Booster,
  Event,
  Federation,
  GaiaHex,
  HighlightHex,
  Reward,
  TechTilePos,
} from "@gaia-project/engine";
import { FastConversionTooltips } from "../logic/commands";

export type ButtonWarning = { title?: string; body: string[]; okButton?: { label: string; action: () => void } };

export type ModalButtonData = { content: string; canActivate: () => boolean; show: (boolean) => void };

export type SpecialActionInfo = { events: Event[] };

export interface ButtonData {
  label?: string;
  command?: string;
  tooltip?: string;
  // Simple label
  title?: string;
  times?: number[];
  conversion?: { from: Reward[]; to: Reward[] };
  modal?: ModalButtonData;
  hexes?: HighlightHexData;
  hover?: boolean;
  researchTiles?: string[];
  techs?: Array<TechTilePos | AdvTechTilePos>;
  boosters?: Booster[];
  selectHexes?: boolean;
  boardActions?: BoardAction[];
  specialActions?: SpecialActionInfo[];
  federations?: Federation[];
  range?: number;
  costs?: { [range: number]: string };
  // Rotate sectors command?
  rotation?: boolean;
  needConfirm?: boolean;
  warning?: ButtonWarning;

  buttons?: ButtonData[];
  hide?: boolean;
  undo?: boolean;
  booster?: Booster;
  tech?: TechTilePos | AdvTechTilePos;
  boardAction?: BoardAction;
  specialAction?: SpecialActionInfo;
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
    boardActions: Set<BoardAction>;
    specialActions: Set<SpecialActionInfo>;
    federations: Set<Federation>;
  };

  rotation: Map<string, number>;

  activeButton: ButtonData | null;
  fastConversionTooltips: FastConversionTooltips;
  hexSelection: boolean;
  hasCommandChain: boolean;

  logPlacement: LogPlacement;
}
