import $ from 'jquery';
import Engine, {EngineOptions} from '@gaia-project/engine';
import {GameApi} from "./types/api";

const api: GameApi = {
  async loadGame(gameId: string) {
    const data = await $.get(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}`);
    return Engine.fromData(data);
  },
  checkStatus(gameId: string) {
    return $.get(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}/status`) as any;
  },
  async addMove(gameId: string, move: string, auth: string) {
    const data = await $.post(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}/move`,  {auth, move}) as any;
    return Engine.fromData(data);
  },
  async replay(moves: string[], options: EngineOptions) {
    const data = await $.post(`${window.location.protocol}//${window.location.hostname}:9508/`, {data: JSON.stringify({moves, options})}) as any;
    return Engine.fromData(data);
  },
  async saveNotes(gameId: string, notes: string, auth?: string): Promise<void> {
    // Note: not currently implemented in multiplayer backend, but implemented for the site
    // await $.post(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}/notes`, {notes, auth});
  },
  async getNotes(gameId: string, auth?: string): Promise<string> {
    // Note: not currently implemented in multiplayer backend, but implemented for the site
    // return await $.get(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}/notes?auth=${encodeURIComponent(auth)}`);
    return '';
  }
}

export default api;