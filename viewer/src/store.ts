import Engine, {
  AdvTechTilePos,
  Booster,
  Federation,
  GaiaHex,
  Player,
  ResearchField,
  TechTilePos,
} from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import Vue from "vue";
import Vuex, { Store } from "vuex";
import { ButtonData, GameContext } from "./data";
import { CommandObject, parseCommands, recentMoves, roundMoves } from "./logic/recent";

Vue.use(Vuex);

type Preference = "accessibleSpaceMap" | "noFactionFill" | "flatBuildings" | "highlightRecentActions";

export type State = {
  data: Engine;
  context: GameContext;
  preferences: {
    [key in Preference]: boolean;
  };
  player: { index?: number; auth?: string } | null;
};

const gaiaViewer = {
  namespaced: true,
  state: {
    data: new Engine(),
    context: {
      highlighted: {
        hexes: new Map(),
        researchTiles: new Set(),
        techs: new Set(),
        boosters: new Set(),
        actions: new Set(),
        federations: new Set(),
      },
      rotation: new Map(),
      hexSelection: false,
      activeButton: null,
    },
    preferences: {
      accessibleSpaceMap: false,
      noFactionFill: false,
      flatBuildings: false,
      highlightRecentActions: false,
    },
    player: null,
  } as State,
  mutations: {
    receiveData(state: State, data: Engine) {
      state.data = data;
      state.context.rotation = new Map();
    },

    highlightHexes(state: State, hexes: Map<GaiaHex, { cost?: string }>) {
      state.context.highlighted.hexes = hexes;
    },

    highlightResearchTiles(state: State, tiles: string[]) {
      state.context.highlighted.researchTiles = new Set(tiles);
    },

    highlightTechs(state: State, techs: Array<TechTilePos | AdvTechTilePos>) {
      state.context.highlighted.techs = new Set(techs);
    },

    highlightBoosters(state: State, boosters: Booster[]) {
      state.context.highlighted.boosters = new Set(boosters);
    },

    highlightActions(state: State, actions: string[]) {
      state.context.highlighted.actions = new Set(actions);
    },

    highlightFederations(state: State, federations: Federation[]) {
      state.context.highlighted.federations = new Set(federations);
    },

    selectHexes(state: State, defaultHexes?: Array<[GaiaHex, { cost?: string }]>) {
      state.context.hexSelection = true;
      state.context.highlighted.hexes = new Map(defaultHexes || []);
    },

    rotate(state: State, coords: CubeCoordinates) {
      const coordsStr = `${coords.q}x${coords.r}`;

      state.context.rotation.set(coordsStr, (state.context.rotation.get(coordsStr) || 0) + 1);
      state.context.rotation = new Map(state.context.rotation.entries());
    },

    clearContext(state: State) {
      state.context.highlighted.hexes = new Map();
      state.context.highlighted.researchTiles = new Set();
      state.context.highlighted.techs = new Set();
      state.context.highlighted.boosters = new Set();
      state.context.highlighted.actions = new Set();
      state.context.highlighted.federations = new Set();
      // state.context.rotation = new Map();
      state.context.hexSelection = false;
      state.context.activeButton = null;
    },

    activeButton(state: State, button: ButtonData | null) {
      state.context.activeButton = button;
    },

    preferences(state: State, preferences: { [key in Preference]: boolean }) {
      state.preferences = preferences;
    },

    player(state: State, data: { index?: number }) {
      state.player = data;
    },
  },
  actions: {
    // No body, used for signalling with store.subscribeAction
    hexClick(context: any, hex: GaiaHex) {},
    researchClick(context: any, field: ResearchField) {},
    techClick(context: any, pos: TechTilePos | AdvTechTilePos) {},
    boosterClick(context: any, booster: Booster) {},
    actionClick(context: any, action: string) {},
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
  },
  getters: {
    currentRoundCommands: (state: State): CommandObject[] => {
      if (state.preferences.highlightRecentActions) {
        const data = state.data;
        return roundMoves(data.advancedLog, data.moveHistory).flatMap((m) => parseCommands(m));
      }
      return [];
    },
    recentCommands: (state: State): CommandObject[] => {
      if (state.preferences.highlightRecentActions) {
        const data = state.data;
        const player = state.player?.index ?? data.currentPlayer;
        return recentMoves(player, data.advancedLog, data.moveHistory).flatMap((m) => parseCommands(m));
      }
      return [];
    },
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
