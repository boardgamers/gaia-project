import Engine, {
  AdvTechTilePos,
  BoardAction,
  Command,
  Faction,
  Federation,
  GaiaHex,
  HighlightHex,
  Player,
  ResearchField,
  TechTilePos,
} from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import Vue from "vue";
import Vuex, { Store } from "vuex";
import { ButtonData, GameContext, HexSelection, SpecialActionIncome } from "./data";
import { FastConversionEvent } from "./data/actions";
import { FastConversionTooltips } from "./logic/commands";
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

type Preference = "accessibleSpaceMap" | "noFactionFill" | "flatBuildings" | "highlightRecentActions" | "logPlacement";

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
  namespaced: true,
  state: {
    data: new Engine(),
    context: {
      highlighted: {
        hexes: { hexes: new Map() } as HexSelection,
        researchTiles: new Set(),
        techs: new Set(),
        boosters: new Set(),
        boardActions: new Set(),
        specialActions: new Set(),
        federations: new Set(),
      },
      rotation: new Map(),
      activeButton: null,
      hasCommandChain: false,
      fastConversionTooltips: {} as FastConversionTooltips,
    },
    preferences: {
      accessibleSpaceMap: !!process.env.VUE_APP_accessibleSpaceMap,
      noFactionFill: !!process.env.VUE_APP_noFactionFill,
      flatBuildings: !!process.env.VUE_APP_flatBuildings,
      highlightRecentActions: !!process.env.VUE_APP_highlightRecentActions,
      logPlacement: process.env.VUE_APP_logPlacement ?? "bottom",
    },
    player: null,
  } as State,
  mutations: {
    receiveData(state: State, data: Engine) {
      state.data = data;
      state.context.rotation = new Map();
    },

    highlightHexes(state: State, hexes: HexSelection) {
      state.context.highlighted.hexes = hexes;
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

    highlightFederations(state: State, federations: Federation[]) {
      state.context.highlighted.federations = new Set(federations);
    },

    rotate(state: State, coords: CubeCoordinates) {
      const map = state.data.map;
      const center = map.configuration().centers.find((center) => map.distance(center, coords) <= 2);
      const key = CubeCoordinates.toString(center);
      state.context.rotation.set(key, (state.context.rotation.get(key) || 0) + 1);
      state.context.rotation = new Map(state.context.rotation.entries());
    },

    clearContext(state: State) {
      state.context.highlighted.hexes = { hexes: new Map() } as HexSelection;
      state.context.highlighted.researchTiles = new Set();
      state.context.highlighted.techs = new Set();
      state.context.highlighted.boardActions = new Set();
      state.context.highlighted.specialActions = new Set();
      state.context.highlighted.federations = new Set();
      state.context.activeButton = null;
      state.context.fastConversionTooltips = {};
    },

    activeButton(state: State, button: ButtonData | null) {
      state.context.activeButton = button;
    },

    setCommandChain(state: State, hasChain: boolean) {
      state.context.hasCommandChain = hasChain;
    },

    fastConversionTooltips(state: State, tooltips: FastConversionTooltips) {
      state.context.fastConversionTooltips = tooltips;
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
  },
  actions: {
    // No body, used for signalling with store.subscribeAction
    hexClick(context: any, hex: GaiaHex, highlight?: HighlightHex) {},
    researchClick(context: any, field: ResearchField) {},
    techClick(context: any, pos: TechTilePos | AdvTechTilePos) {},
    fastConversionClick(context: any, event: FastConversionEvent) {},
    specialActionClick(context: any, action: SpecialActionIncome) {},
    boardActionClick(context: any, action: BoardAction) {},
    federationClick(context: any, federation: Federation) {},
    confirmClick(context: any, action: string) {},
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
    loadFromJSON(context: any, data: any) {},
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
  },
};

function makeStore(): Store<{ gaiaViewer: State }> {
  return new Vuex.Store({
    modules: {
      gaiaViewer,
    },
  });
}

export default makeStore();

export { gaiaViewer, makeStore };
