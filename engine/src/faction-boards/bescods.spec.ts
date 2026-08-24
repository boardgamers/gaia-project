import { expect } from "chai";
import Engine from "../engine";
import { Expansion, Faction, Player as PlayerEnum } from "../enums";
import Player from "../player";

const parseMoves = Engine.parseMoves;

describe("Bescods", () => {
  it("should start with 3 knowledge in the standard faction board", () => {
    const player = new Player(Expansion.None, PlayerEnum.Player1);

    player.faction = Faction.Bescods;
    player.loadFaction(null);

    expect(player.data.knowledge).to.equal(3);
  });

  it("should allow bescods to upgrade a research area with special action", () => {
    const moves = Engine.parseMoves(`
    init 2 randomSeed
    p1 faction terrans
    p2 faction bescods
    p1 build m -4x2
    p2 build m -1x-1
    p2 build m 3x-2
    p1 build m -3x4
    p2 booster booster3
    p1 booster booster4
    p1 pass booster8
    p2 special up-lowest. up terra.
    p2 pass booster5
    p1 pass booster4
    `);
    const engine = new Engine(moves);
    expect(() => engine.move("p2 special up-lowest. up terra")).to.throw();

    const engine1 = new Engine(moves);
    expect(() => engine1.move("p2 special up-lowest. up nav")).to.not.throw();
  });
});
