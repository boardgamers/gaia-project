import { expect } from "chai";
import Engine from "../engine";
import { Player } from '../enums';

const parseMoves = Engine.parseMoves;

describe("Nevlas", () => {
  it("should allow Nevlas to use action power using empowered tokens and free actions", () => {
    const engine = new Engine(parseMoves(`
      init 2 randomSeed
      p1 faction nevlas
      p2 faction gleens
      p1 build m -1x0
      p2 build m -2x2
      p2 build m 1x2
      p1 build m 2x2
      p2 booster booster4
      p1 booster booster3
      p1 build ts -1x0.
      p2 leech 1pw
      p2 build ts -2x2.
      p1 leech 2pw
      p1 build ts 2x2.
      p2 leech 1pw
      p2 build lab -2x2. tech terra.
      p1 leech 2pw
      p1 spend 1q for 1o. build PI -1x0.
      p2 leech 2pw
      p2 build ts 1x2.
      p1 leech 2pw
    `));

    const a3 = engine.player(Player.Player1).data.power.area3;
    const gaia = engine.player(Player.Player1).data.power.gaia;
    const know = engine.player(Player.Player1).data.knowledge;
    // power7 is 3 power
    engine.move('p1 action power7.');
    expect(engine.player(Player.Player1).data.power.area3).to.equal(a3 - 2);

    engine.move("p2 pass booster5");
    engine.move("p1 spend t-a3 for k. spend 1k for 1c. up sci. spend t-a3 for k");
    expect(engine.player(Player.Player1).data.power.gaia).to.equal(gaia + 2);
    expect(engine.player(Player.Player1).data.knowledge).to.equal(know + 1 - 1 - 4 + 1);
  });
});
