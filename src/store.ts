import Vue from 'vue';
import Vuex from 'vuex';
import { GameContext } from './data';
import Engine, { GaiaHex, ResearchField, TechTilePos, AdvTechTilePos, Booster, Federation, Player, EngineOptions } from '@gaia-project/engine';
import { CubeCoordinates } from 'hexagrid';

Vue.use(Vuex);

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
        federations: new Set()
      },
      rotation: new Map(),
      hexSelection: false,
      activeButton: null
    } as GameContext
  },
  mutations: {
    receiveData(state, data: Engine) {
      state.data = data;
      state.context.rotation = new Map();
    },

    highlightHexes(state, hexes: Map<GaiaHex, {cost?: string}>) {
      state.context.highlighted.hexes = hexes;
    },

    highlightResearchTiles(state, tiles: string[]) {
      state.context.highlighted.researchTiles = new Set(tiles);
    },

    highlightTechs(state, techs: Array<TechTilePos | AdvTechTilePos>) {
      state.context.highlighted.techs = new Set(techs);
    },

    highlightBoosters(state, boosters: Booster[]) {
      state.context.highlighted.boosters = new Set(boosters);
    },

    highlightActions(state, actions: string[]) {
      state.context.highlighted.actions = new Set(actions);
    },

    highlightFederations(state, federations: Federation[]) {
      state.context.highlighted.federations = new Set(federations);
    },

    selectHexes(state, defaultHexes) {
      state.context.hexSelection = true;
      state.context.highlighted.hexes = new Map(defaultHexes || []);
    },

    rotate(state, coords: CubeCoordinates) {
      const coordsStr = `${coords.q}x${coords.r}`;

      state.context.rotation.set(coordsStr, (state.context.rotation.get(coordsStr) || 0) + 1);
      state.context.rotation = new Map(state.context.rotation.entries());
    },

    clearContext(state) {
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
    
    activeButton(state, button) {
      state.context.activeButton = button;
    },

    error: (state, error: string) => { state.error = error; state.errorIssued = new Date(); },
    info: (state, info: string) => { state.info = info; state.infoIssued = new Date(); },
    removeError: state => state.error = state.errorIssued = null,
    removeInfo: state => state.info = state.infoIssued = null
  },
  actions: {
    // No body, used for signalling with store.subscribeAction
    hexClick(context, hex: GaiaHex) {},
    researchClick(context, field: ResearchField) {},
    techClick(context, pos: TechTilePos | AdvTechTilePos) {},
    boosterClick(context, booster: Booster) {},
    actionClick(context, action: string) {},
    federationClick(context, federation: Federation) {},
    playerClick(context, player: Player) {}
  },
  getters: {
    data: state => state.data,
    availableCommands: state => state.data.availableCommands
  }
}

export default new Vuex.Store({
  modules: {
    gaiaViewer
  },
  state: {
    options: {spaceShips: false} as EngineOptions,
    error: null as string,
    info: null as string,
    errorIssued: null as Date,
    infoIssued: null as Date
  },
  mutations: {
    options: (state, options: EngineOptions) => state.options = options,
    error: (state, error: string) => { state.error = error; state.errorIssued = new Date(); },
    info: (state, info: string) => { state.info = info; state.infoIssued = new Date(); },
    removeError: state => state.error = state.errorIssued = null,
    removeInfo: state => state.info = state.infoIssued = null
  }
});

export {gaiaViewer};