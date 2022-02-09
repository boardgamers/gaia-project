import { AdvTechTilePos, BoardAction, Booster, Building, GaiaHex, TechTilePos } from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import { RichText } from "../graphics/rich-text";
import { FastConversionTooltips, MoveButtonController } from "../logic/buttons/types";
import { MapMode } from "./actions";

export type WarningWithKey = { disableKey: string; message: string };

export type ButtonWarning = {
  title?: string;
  body: WarningWithKey[];
  okButton?: { label: string; action: () => void };
};

export type ModalButtonData = { title: string; content: string; canActivate: () => boolean; show: (boolean) => void };

export type SpecialActionIncome = string;

export interface ButtonData {
  label?: string;
  richText?: RichText;
  longLabel?: string;
  command?: string;
  tooltip?: string;
  times?: number[];
  modal?: ModalButtonData;
  hexes?: HexSelection;
  onClick?: (button: ButtonData) => void;
  onShow?: (button: ButtonData) => void;
  onShowTriggered?: boolean;
  buttonController?: MoveButtonController;
  hover?: { enter: (button: ButtonData) => void; leave: (button: ButtonData) => void };
  needConfirm?: boolean;
  warning?: ButtonWarning;
  warningInLabel?: boolean;
  buttons?: ButtonData[];
  hide?: boolean;
  disabled?: boolean;
  shortcuts?: string[];
  autoClick?: boolean;
  smartAutoClick?: boolean;
  handlingClick?: boolean;
  keepContext?: boolean;
  subscription?: () => void;
  parents?: number;
}

export type HighlightHex = {
  cost?: string;
  tradeCost?: string;
  rewards?: string;
  warnings?: WarningWithKey[];
  building?: Building;
  hideBuilding?: Building;
  preventClick?: boolean;
  class?: string;
};
export type HighlightHexData = Map<GaiaHex, HighlightHex>;
export type HexSelection = {
  hexes: HighlightHexData;
  selectedLight?: boolean;
  backgroundLight?: boolean;
  selectAnyHex?: boolean;
};
export type LogPlacement = "top" | "bottom" | "off";

export enum WarningsPreference {
  Tooltip = "tooltip",
  ButtonColor = "buttonColor",
  ButtonText = "buttonText", //including button color
  ModalDialog = "modalDialog", //including button color
}

export enum StatisticsDisplay {
  auto = "auto", //depending on screen size
  table = "table",
  charts = "charts",
}

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

  mapModes: MapMode[];
}
