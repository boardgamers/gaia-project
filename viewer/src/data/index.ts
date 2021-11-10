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
import { FastConversionTooltips, MoveButtonController } from "../logic/commands";

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
  boosters?: Booster[];
  onClick?: () => void;
  onOpen?: () => void;
  onShow?: () => void;
  onShowTriggered?: boolean;
  onCreate?: (controller: MoveButtonController) => void; //may be called multiple times!
  hover?: { enter: () => void; leave: () => void };
  boardActions?: BoardAction[];
  specialActions?: SpecialActionIncome[];
  federations?: Federation[];
  costs?: { [range: number]: string };
  // Rotate sectors command?
  rotation?: boolean;
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

  logPlacement: LogPlacement;
}
