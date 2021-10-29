import {
  AdvTechTilePos,
  AvailableFreeActionData,
  Command,
  GaiaHex,
  HighlightHex,
  TechTilePos,
} from "@gaia-project/engine";
import { ButtonData, HexSelection } from "../../data";
import { ActionPayload, SubscribeActionOptions, SubscribeOptions } from "vuex";
import { FastConversionButton } from "../../data/actions";

export type FastConversionTooltips = { [key in FastConversionButton]?: string };

export type UndoPropagation = {
  undoPerformed: boolean;
};

export type AvailableConversions = {
  free?: AvailableFreeActionData;
  burn?: number[];
};

export interface CommandController {
  readonly customButtons: ButtonData[];
  readonly subscriptions: { [key in Command]?: () => void };

  undo();

  handleCommand(command: string, source?: ButtonData);

  disableTooltips();

  highlightHexes(selection: HexSelection);

  subscribeAction<P extends ActionPayload>(fn: SubscribeActionOptions<P, any>, options?: SubscribeOptions): () => void;

  setFastConversionTooltips(tooltips: FastConversionTooltips);

  supportsHover(): boolean;
}

export interface MoveButtonController {
  handleClick();

  highlightResearchTiles(tiles: string[]);

  highlightTechs(techs: Array<TechTilePos | AdvTechTilePos>);

  subscribeButtonClick(action: string, transform?: (button: ButtonData) => ButtonData, activateButton?: boolean);

  setButton(button: ButtonData, key: string);

  activate(button: ButtonData | null);

  subscribeHexClick(callback: (hex: GaiaHex, highlight: HighlightHex) => void, activateButton: boolean);

  highlightHexes(selection: HexSelection);

  executeCommand(): void;
}

