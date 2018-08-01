import * as $ from 'jquery';
import { Data } from './data';

export interface GameApi {
  loadGame(gameId: string): Promise<Data>;
  /** Check if we need to refresh the game */
  checkStatus(gameId: string): Promise<any>;
  addMove(gameId: string, move: string): Promise<any>;
  replay(moveList: string[]): Promise<any>;
}

const api: GameApi = {
  loadGame(gameId: string) {
    return $.get(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}`) as any;
  },
  checkStatus(gameId: string) {
    return $.get(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}/status`) as any;
  },
  addMove(gameId: string, move: string) {
    return $.post(`${window.location.protocol}//${window.location.hostname}:9508/g/${gameId}/move`,  {move}) as any;
  },
  replay(moves: string[]) {
    return $.post(`${window.location.protocol}//${window.location.hostname}:9508/`, {moves}) as any;
  }
}

export default api;