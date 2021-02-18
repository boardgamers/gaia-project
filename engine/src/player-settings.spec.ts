import { expect } from "chai";
import Engine from "./engine";
import { Faction } from "./enums";
import { taklonGameMoves } from "./faction-boards/taklons.spec";

describe("Player settings", () => {
  it("should be able to replay games with the same log regardless of the settings", () => {
    const moves = taklonGameMoves();

    const engine = new Engine(moves.slice(0, 3));

    expect(engine.players.length).to.equal(2);
    expect(engine.players[0].faction).to.equal(Faction.Taklons);

    engine.players[0].settings.autoIncome = engine.players[0].settings.autoBrainstone = true;
    expect(() => engine.loadMoves(moves.slice(3))).to.not.throw();

    // Then do the same with the settings disabled
    expect(() => new Engine(moves)).to.not.throw();
  });
});
