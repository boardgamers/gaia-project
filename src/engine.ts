import SpaceMap from "./map";
import * as assert from "assert";

export default class Engine {
  map: SpaceMap;

  constructor( moves: string [] = []) {
    this.loadMoves(moves);
  }

  loadMoves(moves: string[]) {
    for (let move of moves) {
      this.move(move);
    }
  }

  move(move: string) {
    if (!this.map) {
      assert (move.startsWith("init"));
      const split = move.trim().split(" ");

      const players = +move[1] || 2;
      const seed = move[2] || "defaultSeed";

      this.map = new SpaceMap(players, seed);

      return;
    }

    assert(false, "Pas encore implémenté");
  }

  data(): Object {
    return {
      map: this.map.toJSON()
    };
  }
}
