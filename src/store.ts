import Vue from 'vue';
import Vuex from 'vuex';
import { Data, GameContext } from './data';
import { GaiaHex, ResearchField, TechTilePos, AdvTechTilePos } from '../node_modules/@gaia-project/engine';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    game: {
      data: {players: []} as Data,
      context: {
        highlighted: {
          hexes: new Map(),
          researchTiles: new Set(),
          techs: new Set()
        },
        coordsMap: new Map()
      } as GameContext
    },
    error: null as string,
    info: null as string,
    errorIssued: null as Date,
    infoIssued: null as Date
  },
  mutations: {
    receiveData(state, data: Data) {
      state.game.data = data;
      state.game.context.coordsMap.clear();

      for (const hex of data.map || []) {
        state.game.context.coordsMap.set(`${hex.q}x${hex.r}`, hex);
      }
    },

    highlightHexes(state, hexes: Map<GaiaHex, {cost?: string}>) {
      state.game.context.highlighted.hexes = hexes;
    },

    highlightResearchTiles(state, tiles: string[]) {
      state.game.context.highlighted.researchTiles = new Set(tiles);
    },

    highlightTechs(state, techs: Array<TechTilePos | AdvTechTilePos>) {
      state.game.context.highlighted.techs = new Set(techs);
    },

    clearContext(state) {
      state.game.context.highlighted.hexes = new Map();
      state.game.context.highlighted.researchTiles = new Set();
      state.game.context.highlighted.techs = new Set();
    },
    
    activeButton(state, button) {state.game.context.activeButton = button},
    error: (state, error: string) => { state.error = error; state.errorIssued = new Date(); },
    info: (state, info: string) => { state.info = info; state.infoIssued = new Date(); },
    removeError: state => state.error = state.errorIssued = null,
    removeInfo: state => state.info = state.infoIssued = null
  },
  actions: {
    // No body, used for signalling with store.subscribeAction
    hexClick(context, hex: GaiaHex) {},
    researchClick(context, field: ResearchField) {},
    techClick(context, pos: TechTilePos | AdvTechTilePos) {}
  },
  getters: {
    data: state => state.game.data,
    availableCommands: state => state.game.data.availableCommands
  }
});
