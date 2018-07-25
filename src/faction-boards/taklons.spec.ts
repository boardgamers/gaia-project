import { expect } from "chai";
import Engine from "../engine";
import { Player, BrainstoneArea } from "../enums";

describe("Taklons", () => {
  it("should allow charge with +t freeIncome", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction taklons
      p1 build m -4x-1
      p2 build m -3x-2
      p2 build m -6x3
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -4x-1.
      p2 charge 1pw. brainstone area2
      p2 build ts -3x-2.
      p1 charge 2pw
      p1 build ts -4x2.
      p2 charge 1pw
      p2 build PI -3x-2.
      p1 charge 2pw
      p1 build lab -4x-1. tech gaia. up gaia.
    `);

    expect(() => new Engine([...moves, "p2 charge 3pw,1t"])).to.not.throw();
    expect(() => new Engine([...moves, "p2 charge 1t,3pw"])).to.not.throw();
  });

  it("should choose brainstone destination when chargeing power", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction taklons
      p1 build m -4x-1
      p2 build m -3x-2
      p2 build m -6x3
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -4x-1.
    `);

    expect(new Engine([...moves, "p2 charge 1pw. brainstone area2"]).player(Player.Player2).data.brainstone).to.equal(BrainstoneArea.Area2);
    expect(new Engine([...moves, "p2 charge 1pw. brainstone area1"]).player(Player.Player2).data.brainstone).to.equal(BrainstoneArea.Area1);
    expect(() => new Engine([...moves, "p2 charge 1pw. brainstone area3"])).to.throw();
  });

  it("should ask when moving power tokens to gaia, whether to move the brainstone", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction taklons
      p1 build m -4x-1
      p2 build m -3x-2
      p2 build m -6x3
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster4
      p1 build ts -4x-1.
      p2 charge 1pw. brainstone area2
      p2 up gaia.
      p1 build ts -4x2.
      p2 charge 1pw
    `);

    const engine1 = new Engine([...moves, "p2 build gf -5x6. brainstone gaia"]);
    expect(engine1.player(Player.Player2).data.power.area1).to.equal(0);
    expect(engine1.player(Player.Player2).data.power.area2).to.equal(1);
    expect(engine1.player(Player.Player2).data.brainstone).to.equal(BrainstoneArea.Gaia);
    expect(engine1.player(Player.Player2).data.power.gaia).to.equal(5);

    const engine2 = new Engine([...moves, "p2 build gf -5x6. brainstone area2"]);
    expect(engine2.player(Player.Player2).data.power.area1).to.equal(0);
    expect(engine2.player(Player.Player2).data.power.area2).to.equal(0);
    expect(engine2.player(Player.Player2).data.brainstone).to.equal(BrainstoneArea.Area2);
    expect(engine2.player(Player.Player2).data.power.gaia).to.equal(6);
  });
});
