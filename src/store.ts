import Vue from 'vue';
import Vuex from 'vuex';
import { Data } from './data';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    game: {data: {players: []}} as {data: Data},
    error: null as string,
    info: null as string,
    errorIssued: null as Date,
    infoIssued: null as Date
  },
  mutations: {
    receiveData: (state, data: Data) => {
      state.game.data = data;
    },
    
    error: (state, error: string) => { state.error = error; state.errorIssued = new Date(); },
    info: (state, info: string) => { state.info = info; state.infoIssued = new Date(); },
    removeError: state => state.error = state.errorIssued = null,
    removeInfo: state => state.info = state.infoIssued = null
  },
  actions: {

  },
  getters: {
    data: state => state.game.data,
    availableCommands: state => state.game.data.availableCommands
  }
});
