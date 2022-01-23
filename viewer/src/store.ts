import Engine, {
  AdvTechTilePos,
  BoardAction,
  Command,
  Faction,
  GaiaHex,
  Player,
  ResearchField,
  TechTilePos,
} from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import Vue from "vue";
import Vuex from "vuex";
import { ButtonData, GameContext, HexSelection, HighlightHex, SpecialActionIncome } from "./data";
import { FastConversionEvent, MapMode } from "./data/actions";
import { ExecuteBack, FastConversionTooltips } from "./logic/buttons/types";
import {
  CommandObject,
  MovesSlice,
  movesToHexes,
  parseCommands,
  parseMoves,
  recentMoves,
  researchClasses,
  roundMoves,
} from "./logic/recent";

Vue.use(Vuex);

type Preference =
  | "accessibleSpaceMap"
  | "noFactionFill"
  | "flatBuildings"
  | "highlightRecentActions"
  | "logPlacement"
  | "extendedLog"
  | "warnings"
  | "autoClick"
  | "statistics"
  | "uiMode";

export enum UiMode {
  graphical = "graphical",
  table = "table",
  compactTable = "compactTable",
}

export enum LoadFromJsonType {
  load = "load",
  strictReplay = "strictReplay",
  permissiveReplay = "permissiveReplay",
}

export type LoadFromJson = {
  engineData: Engine;
  type: LoadFromJsonType;
  stopMove?: string;
};

export type State = {
  data: Engine;
  context: GameContext;
  preferences: {
    [key in Preference]: boolean | string;
  };
  player: { index?: number; auth?: string } | null;
};

function indexCommands(commands, command: Command) {
  const map = new Map<Faction, CommandObject[]>();
  for (const c of commands as CommandObject[]) {
    if (c.command === command) {
      if (!map.has(c.faction)) {
        map.set(c.faction, []);
      }
      map.get(c.faction).push(c);
    }
  }

  return map;
}

const gaiaViewer = {
  state: {
    data: new Engine(),
    context: {
      highlighted: {
        sectors: [],
        hexes: null,
        researchTiles: new Set(),
        techs: new Set(),
        boosters: new Set(),
        boardActions: new Set(),
        specialActions: new Set(),
      },
      rotation: new Map(),
      activeButton: null,
      hasCommandChain: false,
      autoClick: [],
      mapModes: [],
      fastConversionTooltips: {} as FastConversionTooltips,
    },
    preferences: {
      accessibleSpaceMap: !!process.env.VUE_APP_accessibleSpaceMap,
      noFactionFill: !!process.env.VUE_APP_noFactionFill,
      flatBuildings: !!process.env.VUE_APP_flatBuildings,
      highlightRecentActions: !!process.env.VUE_APP_highlightRecentActions,
      autoClick: process.env.VUE_APP_autoClick ?? "smart",
      logPlacement: process.env.VUE_APP_logPlacement ?? "bottom",
      extendedLog: !!process.env.VUE_APP_extendedLog,
      warnings: process.env.VUE_APP_warnings ?? "modalDialog",
      statistics: process.env.VUE_APP_statistics ?? "auto",
      uiMode: process.env.VUE_APP_uiMode ?? "graphical",
    },
    player: null,
    avatars: [] as string[],
  } as State,
  mutations: {
    receiveData(state: State, data: Engine) {
      state.data = data;
      state.context.rotation = new Map();
    },

    highlightSectors(state: State, sectors: CubeCoordinates[]) {
      state.context.highlighted.sectors = sectors;
    },

    highlightHexes(state: State, selection: HexSelection) {
      state.context.highlighted.hexes = selection;
    },

    highlightResearchTiles(state: State, tiles: string[]) {
      state.context.highlighted.researchTiles = new Set(tiles);
    },

    highlightTechs(state: State, techs: Array<TechTilePos | AdvTechTilePos>) {
      state.context.highlighted.techs = new Set(techs);
    },

    highlightBoardActions(state: State, actions: BoardAction[]) {
      state.context.highlighted.boardActions = new Set(actions);
    },

    highlightSpecialActions(state: State, actions: SpecialActionIncome[]) {
      state.context.highlighted.specialActions = new Set(actions);
    },

    rotate(state: State, coords: CubeCoordinates) {
      const map = state.data.map;
      const center = map.configuration().centers.find((center) => map.distance(center, coords) <= 2);
      const key = CubeCoordinates.toString(center);
      state.context.rotation.set(key, (state.context.rotation.get(key) || 0) + 1);
      state.context.rotation = new Map(state.context.rotation.entries());
    },

    clearContext(state: State) {
      state.context.highlighted.sectors = [];
      state.context.highlighted.hexes = null;
      state.context.highlighted.researchTiles = new Set();
      state.context.highlighted.techs = new Set();
      state.context.highlighted.boardActions = new Set();
      state.context.highlighted.specialActions = new Set();
      state.context.activeButton = null;
      state.context.fastConversionTooltips = {};
      state.context.mapModes = [];
    },

    activeButton(state: State, button: ButtonData | null) {
      state.context.activeButton = button;
    },

    setCommandChain(state: State, hasChain: boolean) {
      state.context.hasCommandChain = hasChain;
    },

    setAutoClick(state: State, autoClick: boolean[][]) {
      state.context.autoClick = autoClick;
    },

    fastConversionTooltips(state: State, tooltips: FastConversionTooltips) {
      state.context.fastConversionTooltips = tooltips;
    },

    toggleMapMode(state: State, mapMode: MapMode) {
      const modes = state.context.mapModes;
      const old =
        mapMode.type === "planetType"
          ? modes.find((m) => m.type == "planetType" && m.planet == mapMode.planet)
          : modes.find((m) => m.planet == null);

      if (old) {
        modes.splice(modes.indexOf(old), 1);
        if (JSON.stringify(old) !== JSON.stringify(mapMode)) {
          modes.push(mapMode);
        }
      } else {
        modes.push(mapMode);
      }
    },

    preferences(state: State, preferences: { [key in Preference]: boolean }) {
      state.preferences = {
        ...state.preferences,
        ...preferences,
      };
    },

    player(state: State, data: { index?: number }) {
      state.player = data;
    },

    avatars(state, data) {
      state.avatars = data;
    },
  },
  actions: {
    // No body, used for signalling with store.subscribeAction
    hexClick(context: any, hex: GaiaHex, highlight?: HighlightHex) {},
    researchClick(context: any, field: ResearchField) {},
    techClick(context: any, pos: TechTilePos | AdvTechTilePos) {},
    fastConversionClick(context: any, event: FastConversionEvent) {},
    specialActionClick(context: any, action: SpecialActionIncome) {},
    boardActionClick(context: any, action: BoardAction) {},
    // API COMMUNICATION
    playerClick(context: any, player: Player) {},
    move(context: any, move: string) {},
    replayInfo(context: any, info: { start: number; end: number; current: number }) {},
    // ^ up - down v
    externalData(context: any, data: Engine) {},
    replayStart(context: any) {},
    replayTo(context: any, to: number) {},
    replayEnd(context: any, data: Engine) {},
    // WRAPPER / DEBUG COMMUNICATION
    loadFromJSON(context: any, data: LoadFromJson) {},
    back(context: any, arg: ExecuteBack) {},
    undo(context: any) {},
  },
  getters: {
    recentMoves: (state: State): MovesSlice => {
      // don't check for state.preferences.highlightRecentActions, this is also used in advanced log
      const data = state.data;
      const player = state.player?.index ?? data.currentPlayer;
      if (player == undefined) {
        return { index: -1, moves: [], allMoves: parseMoves(data.moveHistory) };
      }
      return recentMoves(player, data.advancedLog, data.moveHistory);
    },
    currentRoundCommands: (state: State): CommandObject[] => {
      if (state.preferences.highlightRecentActions) {
        const data = state.data;
        return roundMoves(data.advancedLog, data.moveHistory).flatMap((m) => parseCommands(m));
      }
      return [];
    },
    recentCommands: (state: State, getters): CommandObject[] => {
      if (state.preferences.highlightRecentActions) {
        return getters.recentMoves.moves.flatMap((m) => m.commands);
      }
      return [];
    },
    recentHexes: (state: State, getters): Set<GaiaHex> => {
      return new Set(movesToHexes(state.data, getters.recentCommands));
    },
    currentRoundHexes: (state: State, getters): Set<GaiaHex> => {
      return new Set(movesToHexes(state.data, getters.currentRoundCommands));
    },
    researchClasses: (state: State, getters): Map<Faction, Map<ResearchField, "recent" | "current-round">> => {
      return researchClasses(getters.recentCommands, getters.currentRoundCommands);
    },
    recentBuildingCommands: (state: State, getters): Map<Faction, CommandObject[]> =>
      indexCommands(getters.recentCommands, Command.Build),
    currentRoundBuildingCommands: (state: State, getters): Map<Faction, CommandObject[]> =>
      indexCommands(getters.currentRoundCommands, Command.Build),
    recentActions: (state: State, getters): Map<Faction, CommandObject[]> =>
      indexCommands(getters.recentCommands, Command.Special),
    canUndo: (state: State): boolean => state.context.hasCommandChain || !state.data.newTurn,
    autoClick: (state: State): boolean[][] => state.context.autoClick,
    mapModes: (state: State): MapMode[] => state.context.mapModes,
  },
};

function makeStore() {
  const store = new Vuex.Store(gaiaViewer);
  for (const k in process.env) {
    if (k.startsWith("VUE_APP_warning-")) {
      store.state.preferences[k.substring("VUE_APP_".length)] = process.env[k] === "true";
    }
  }
  return store;
}

export default makeStore();

export { gaiaViewer, makeStore };
