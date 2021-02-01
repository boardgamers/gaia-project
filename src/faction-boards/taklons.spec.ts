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

  it("should choose brainstone destination when charging power", () => {
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

    expect(new Engine([...moves, "p2 charge 1pw. brainstone area2"]).player(Player.Player2).data.brainstone).to.equal(
      BrainstoneArea.Area2
    );
    expect(new Engine([...moves, "p2 charge 1pw. brainstone area1"]).player(Player.Player2).data.brainstone).to.equal(
      BrainstoneArea.Area1
    );
    expect(() => new Engine([...moves, "p2 charge 1pw. brainstone area3"])).to.throw();
  });

  it("should not cause problems when deciding brainstone destination in income phase", () => {
    const moves = Engine.parseMoves(`
      init 3 9876
      p1 faction terrans
      p2 faction gleens
      p3 faction taklons
      terrans build m -4x1
      gleens build m -5x0
      taklons build m -5x3
      taklons build m -1x3
      gleens build m 1x5
      terrans build m 0x2
      taklons booster booster5
      gleens booster booster4
      terrans booster booster2
      taklons brainstone area1
      terrans build m -4x4.
    `);

    expect(() => new Engine(moves)).to.not.throw();
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

  it("should handle a complicated mix of income phase & brainstone area selection", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction taklons
      terrans build m -4x-1
      taklons build m -3x-2
      taklons build m -6x3
      terrans build m -4x2
      taklons booster booster3
      terrans booster booster4
      terrans build ts -4x2.
      taklons charge 1pw. brainstone area2
      taklons build ts -6x3.
      terrans charge 2pw
      terrans build PI -4x2.
      taklons charge 2pw
      taklons build PI -6x3.
      terrans charge 3pw
      terrans special step. build m -5x0.
      taklons charge 1pw,1t. brainstone area3
      taklons burn 3. action power2. build m -7x3.
      terrans up gaia.
      taklons up terra.
      terrans build gf -3x1.
      taklons build ts -3x-2.
      terrans charge 1pw
      terrans burn 1. spend 3pw for 1o. spend 1q for 1o. build ts -5x0.
      taklons charge 2pw,1t. brainstone area2
      taklons burn 1. action power3.
      terrans pass booster8
      taklons pass booster5
      terrans income 4pw
      taklons income 2pw. brainstone area1. income 4pw. brainstone area3
      terrans spend 4tg for 1q. spend 1tg for 1c. spend 1tg for 1c
      terrans build m -3x1.
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should properly burn power when moving up brainstone", () => {
    const moves = Engine.parseMoves(`
      init 2 yellow-paint-8951
      p1 faction xenos
      p2 faction taklons
      xenos build m 0x-2
      taklons build m -1x-3
      taklons build m -2x5
      xenos build m -4x3
      xenos build m -2x6
      taklons booster booster9
      xenos booster booster7
      taklons brainstone area3
      xenos build ts 0x-2.
      taklons charge 1pw
      taklons build ts -1x-3.
      xenos charge 2pw
      xenos build ts -2x6.
      taklons charge 1pw
      taklons action power3.
      xenos build ts -4x3.
      taklons build ts -2x5.
      xenos charge 2pw
      xenos up terra.
      taklons build lab -1x-3. tech terra. up terra.
      xenos charge 2pw
      xenos action power4.
      taklons up nav.
      xenos pass booster3
      taklons spend 1pw for 1c. build lab -2x5. tech free2. up int.
      xenos charge 2pw
      taklons action qic1. tech sci. up sci.
      taklons burn 2. special 4pw. brainstone area3.
      taklons pass booster1
      xenos build lab 0x-2. tech terra. up terra.
      taklons charge 2pw
      taklons action power3. brainstone area1.
      xenos pass booster9
      taklons special 4pw.
      taklons action power4. brainstone area1.
      taklons build ac2 -1x-3. tech free1. up nav.
      xenos charge 2pw
      taklons up nav. brainstone area3.
      taklons special q. spend 6pw for 2o.
      taklons build m -2x-4.
      taklons build m -3x-2.
      taklons pass booster3. brainstone area2
      xenos action power3.
      taklons burn 1
    `);

    const engine = new Engine(moves);

    expect(engine.player(Player.Player2).data.power.area2).to.equal(0);
  });

  it("should work when moving brainstone right after picking booster", () => {
    const moves = Engine.parseMoves(`
      init 2 randomseed
      p1 faction taklons
      p2 faction hadsch-hallas
      taklons build m 1x4
      hadsch-hallas build m 0x4
      hadsch-hallas build m -4x0
      taklons build m -3x-2
      hadsch-hallas booster booster4
      taklons booster booster9
      taklons brainstone area3
    `);

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should allow to gain a power token when leeching even if all power tokens are in bowl 3", () => {
    const moves = Engine.parseMoves(`
      init 2 randomseed
      p1 faction taklons
      p2 faction hadsch-hallas
      taklons build m 1x4
      hadsch-hallas build m 0x4
      hadsch-hallas build m -4x0
      taklons build m -3x-2
      hadsch-hallas booster booster4
      taklons booster booster9
      taklons brainstone area3
      taklons build ts 1x4.
      hadsch-hallas charge 1pw
      hadsch-hallas build ts 0x4.
      taklons charge 2pw
      taklons build PI 1x4. burn 2.
      hadsch-hallas charge 2pw
      hadsch-hallas build PI 0x4.
      taklons charge 0pw,1t
    `);

    const engine = new Engine(moves);

    expect(engine.player(Player.Player1).data.power.area1).to.equal(1);
  });
});
