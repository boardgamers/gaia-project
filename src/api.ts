import * as $ from 'jquery';
import Engine, {EngineOptions} from '@gaia-project/engine';

export interface EngineData extends Engine {
  nextMoveDeadline?: Date;
  lastUpdated?: Date;
}

export interface GameApi {
  loadGame(gameId: string): Promise<Engine>;
  /** Check if we need to refresh the game */
  checkStatus(gameId: string): Promise<any>;
  addMove(gameId: string, move: string, auth: string): Promise<Engine>;
  replay(moveList: string[], options: EngineOptions): Promise<EngineData>;
}

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
  }
}

export default api;