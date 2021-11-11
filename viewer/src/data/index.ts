import {
  AdvTechTile,
  AdvTechTilePos,
  BoardAction,
  Booster,
  Federation,
  GaiaHex,
  HighlightHex,
  Reward,
  TechTile,
  TechTilePos,
} from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import { FastConversionTooltips, MoveButtonController } from "../logic/buttons/types";

export type ButtonWarning = { title?: string; body: string[]; okButton?: { label: string; action: () => void } };

export type ModalButtonData = { title: string; content: string; canActivate: () => boolean; show: (boolean) => void };

export type SpecialActionIncome = string;

export interface ButtonData {
  label?: string;
  longLabel?: string;
  command?: string;
  tooltip?: string;
  times?: number[];
  conversion?: { from: Reward[]; to: Reward[] };
  modal?: ModalButtonData;
  hexes?: HexSelection;
  onClick?: (button: ButtonData) => void;
  onShow?: (button: ButtonData) => void;
  onShowTriggered?: boolean;
  buttonController?: MoveButtonController;
  hover?: { enter: () => void; leave: () => void };
  boardActions?: BoardAction[];
  specialActions?: SpecialActionIncome[];
  federations?: Federation[];
  needConfirm?: boolean;
  warning?: ButtonWarning;
  buttons?: ButtonData[];
  hide?: boolean;
  disabled?: boolean;
  booster?: Booster;
  tech?: { pos?: TechTilePos | AdvTechTilePos; tile?: TechTile | AdvTechTile; commandOverride?: string };
  boardAction?: BoardAction;
  specialAction?: SpecialActionIncome;
  shortcuts?: string[];
  autoClick?: boolean;
  smartAutoClick?: boolean;
  handlingClick?: boolean;
  keepContext?: boolean;
  subscription?: () => void;
}

export type HighlightHexData = Map<GaiaHex, HighlightHex>;
export type HexSelection = {
  hexes: HighlightHexData;
  selectedLight?: boolean;
  backgroundLight?: boolean;
  selectAnyHex?: boolean;
};
export type LogPlacement = "top" | "bottom" | "off";

export interface GameContext {
  highlighted: {
    sectors: CubeCoordinates[];
    hexes: HexSelection;
    researchTiles: Set<string>;
    techs: Set<TechTilePos | AdvTechTilePos>;
    boosters: Set<Booster>;
    boardActions: Set<BoardAction>;
    specialActions: Set<SpecialActionIncome>;
  };

  rotation: Map<string, number>;

  activeButton: ButtonData | null;
  fastConversionTooltips: FastConversionTooltips;
  hasCommandChain: boolean;
  autoClick: boolean[][];

  logPlacement: LogPlacement;
}
