import type { AvailableFreeActionData } from "@gaia-project/engine";
import { BoardAction, Command, GaiaHex } from "@gaia-project/engine";
import type { AnyTechTilePos } from "@gaia-project/engine/src/enums";
import { Spaceship } from "@gaia-project/engine/src/enums";
import { CubeCoordinates } from "hexagrid";
import { ActionPayload, SubscribeActionOptions, SubscribeOptions } from "vuex";
import type { EmitCommandParams } from "../../components/Commands.vue";
import type { ButtonData, HexSelection, HighlightHex, SpecialActionIncome } from "../../data";
import type { FastConversionButton } from "../../data/actions";

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

  /** Whether the board is a non-committing analysis sandbox (ANALYSIS_MODE_PLAN.md §12) - read by
   * `checkAutoClick` to skip the per-move confirmation press there. */
  readonly analysisMode: boolean;

  undo();

  handleCommand(command: string, source?: ButtonData);

  disableTooltips();

  subscribeAction<P extends ActionPayload>(fn: SubscribeActionOptions<P, any>, options?: SubscribeOptions): () => void;

  setFastConversionTooltips(tooltips: FastConversionTooltips);

  supportsHover(): boolean;

  highlightResearchTiles(tiles: string[]);

  highlightTechs(techs: Array<AnyTechTilePos | Spaceship>);

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

  /** The local user's raw "auto-leech" preference (a string - "ask", "decline-cost", "1".."5", or
   * an encoded value with a passed-round cap; see auto-decide.ts), never synced as engine/game state. Needed by
   * `passWarning` to warn about a setting that could auto-accept a VP-costing leech later this
   * round, which `engine.player(...).settings.autoChargePower` can't answer on its own since it's
   * only ever set transiently at the moment an auto-decide actually runs. */
  autoChargePreference(): string;

  highlightSpecialActions(specialActions: SpecialActionIncome[]): void;

  highlightBoardActions(boardActions: BoardAction[]): void;
}

export interface MoveButtonController {
  setButton(button: ButtonData, key: string);

  setModalShow(value: boolean);
}
