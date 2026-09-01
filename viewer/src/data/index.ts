import { BoardAction, Booster, Building, GaiaHex } from "@gaia-project/engine";
import type { AnyTechTilePos } from "@gaia-project/engine/src/enums";
import { CubeCoordinates } from "hexagrid";
import type { RichText } from "../graphics/rich-text";
import type { FastConversionTooltips, MoveButtonController } from "../logic/buttons/types";
import type { MapMode } from "./actions";

export type WarningWithKey = { disableKey: string; message: string };

export type ButtonWarning = {
  title?: string;
  body: WarningWithKey[];
  okButton?: { label: string; action: () => void };
};

export type ModalButtonData = {
  title: string;
  /** Plain HTML content, rendered via v-html. Ignored when `component` is set. */
  content?: string;
  /** A real Vue component to render as the modal body instead of `content` - lets the body use
   * actual icon components (SVG-rendered, can't be embedded in an HTML string). */
  component?: unknown;
  props?: Record<string, unknown>;
  canActivate: () => boolean;
  show: (boolean) => void;
  okTitle?: string;
};

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

export interface GameContext {
  highlighted: {
    sectors: CubeCoordinates[];
    hexes: HexSelection;
    researchTiles: Set<string>;
    techs: Set<AnyTechTilePos>;
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
