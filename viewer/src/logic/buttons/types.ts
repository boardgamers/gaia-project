import { AdvTechTilePos, AvailableFreeActionData, Command, GaiaHex, TechTilePos } from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import { ActionPayload, SubscribeActionOptions, SubscribeOptions } from "vuex";
import { EmitCommandParams } from "../../components/Commands.vue";
import { ButtonData, HexSelection, HighlightHex, SpecialActionIncome } from "../../data";
import { FastConversionButton } from "../../data/actions";

export type FastConversionTooltips = { [key in FastConversionButton]?: string };

export class ExecuteBack {
  performed: boolean;

  constructor() {
    this.performed = false;
  }
}

export type AvailableConversions = {
  free?: AvailableFreeActionData;
  burn?: number[];
};

export interface CommandController {
  readonly customButtons: ButtonData[];
  readonly subscriptions: { [key in Command]?: () => void };

  readonly temporaryRange: number;

  undo();

  handleCommand(command: string, source?: ButtonData);

  disableTooltips();

  subscribeAction<P extends ActionPayload>(fn: SubscribeActionOptions<P, any>, options?: SubscribeOptions): () => void;

  setFastConversionTooltips(tooltips: FastConversionTooltips);

  supportsHover(): boolean;

  highlightResearchTiles(tiles: string[]);

  highlightTechs(techs: Array<TechTilePos | AdvTechTilePos>);

  activate(button: ButtonData | null);

  subscribeHexClick(
    button: ButtonData,
    callback: (hex: GaiaHex, highlight: HighlightHex) => void,
    filter?: (hex: GaiaHex) => boolean
  );

  highlightHexes(selection: HexSelection | null);

  highlightSectors(sectors: CubeCoordinates[]): void;

  executeCommand(button: ButtonData): void;

  clearContext(): void;

  handleButtonClick(button: ButtonData): void;

  emitButtonCommand(button: ButtonData, append?: string, params?: EmitCommandParams): void;

  isActiveButton(button: ButtonData): boolean;

  getHighlightedHexes(): HexSelection;

  getRotation(): any;

  rotate(hex: GaiaHex): void;

  subscribeFinal(action: string, button: ButtonData): void;

  enabledButtonWarnings(button: ButtonData): string[];

  isWarningEnabled(disableKey: string): boolean;

  highlightBoardActions(button: ButtonData): void;

  highlightSpecialActions(specialActions: SpecialActionIncome[]): void;
}

export interface MoveButtonController {
  setButton(button: ButtonData, key: string);

  setModalShow(value: boolean);
}
