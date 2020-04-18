import Engine, {EngineOptions} from '@gaia-project/engine';

export interface EngineData extends Engine {
  nextMoveDeadline?: Date;
  lastUpdated?: Date;
}

export interface GameApi {
  loadGame(gameId: string): Promise<Engine>;
  /** Check if we need to refresh the game */
  checkStatus(gameId: string): Promise<any>;
  addMove(gameId: string, move: string, auth?: string): Promise<Engine>;
  replay(moveList: string[], options: EngineOptions): Promise<EngineData>;
  // Memo
  saveNotes(gameId: string, notes: string, auth?: string): Promise<void>;
  getNotes(gameId: string, auth?: string): Promise<string>;
}