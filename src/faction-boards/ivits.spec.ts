import { expect } from "chai";
import Engine from "../engine";
import { Player, Command } from '../enums';

const parseMoves = Engine.parseMoves;

describe('Ivits', () => {
  it ("should be able to place a space station and use it as a starting point to build a mine", () => {
    const moves = parseMoves(`
      init 2 randomSeed2
      p1 faction ivits
      p2 faction geodens
      p2 build m 3x-1
      p2 build m -2x-2
      p1 build PI 2x-1
      p2 booster booster5
      p1 booster booster1
      p1 income 4pw
      p1 special space-station. build sp -1x-3.
      p2 pass booster3
      p1 build m -1x-4
    `);

    expect (() => new Engine(moves)).to.not.throw();
  });

  it ("spacestation is not discounting upgrade cost for others", () => {
    const moves = parseMoves(`
      init 2 curious-stay-2150
      p1 faction nevlas
      p2 faction ivits
      nevlas build m -2x0
      nevlas build m 1x3
      ivits build PI -3x1
      ivits booster booster9
      nevlas booster booster3
      ivits income 4pw. income 4pw
      nevlas build m 0x-1.
      ivits up nav.
      nevlas build ts -2x0.
      ivits charge 2pw
      ivits special space-station. build sp -3x0.
      nevlas build lab -2x0. tech free2. up eco.
      ivits action power2. build m -3x-1.
      nevlas charge 2pw
      nevlas special 4pw.
      ivits build ts -3x-1.
      nevlas charge 2pw
      nevlas up eco.
      ivits pass booster8
      nevlas spend t-a3 for 1k. spend t-a3 for 1k. spend t-a3 for 1k. spend t-a3 for 1k. up sci.
      nevlas pass booster2
      ivits income 4pw
      nevlas income 2t
      ivits build lab -3x-1. tech free2. up nav.
      nevlas charge 2pw
      nevlas spend t-a3 for 1k. up eco.
      ivits special space-station. build sp -1x1.
    `);
    const engine = new Engine(moves);
    const credits = engine.player(Player.Player1).data.credits;
    engine.move("nevlas build ts 0x-1.");
    expect(engine.player(Player.Player1).data.credits).to.equal(credits - 6);

  });

  it ("should be able to build a federation using a space station and qic", () => {
    const moves = parseMoves(`
      init 2 randomSeed2
      p1 faction ivits
      p2 faction baltaks
      p2 build m 3x-1
      p2 build m -2x-2
      p1 build PI 2x-1
      p2 booster booster1
      p1 booster booster4
      p1 income 4pw
      p1 special step. build m 1x2.
      p2 build ts 3x-1.
      p1 charge 3pw
      p1 build m 3x0.
      p2 charge 2pw
      p2 build lab 3x-1. tech free3. up gaia.
      p1 charge 3pw
      p1 action power2. build m 2x1.
      p2 charge 2pw
      p2 up gaia.
      p1 up int.
      p2 build gf 2x0.
      p1 special space-station. build sp 1x1.
      p2 spend 1gf for 1q. build m -1x-1.
    `);

    const engine = new Engine(moves);

    const tokens = engine.player(Player.Player1).data.discardablePowerTokens();
    const qic = engine.player(Player.Player1).data.qics;
    engine.move("p1 federation 1x0,1x1,1x2,2x-1,2x1,3x0 fed2.");
    // No tokens discarded
    expect(engine.player(Player.Player1).data.discardablePowerTokens()).to.equal(tokens);
    // 1 qic discarded (satellite) & one gained (federation tile)
    expect(engine.player(Player.Player1).data.qics).to.equal(qic - 1 + 1);
  });

  it ("should be able to build a federation using using PA->4pw", () => {
    const moves = parseMoves(`
      init 2 waiting-fabs-1
      p1 faction baltaks
      p2 faction ivits
      baltaks build m 0x-4
      baltaks build m -4x4
      ivits build PI 2x-5
      ivits booster booster9
      baltaks booster booster3
      ivits income 4pw. income 4pw
      baltaks build ts 0x-4.
      ivits charge 2pw
      ivits special space-station. build sp 3x-6.
      baltaks up gaia.
      ivits action power6. build m 4x-6.
      baltaks build lab 0x-4. tech free1. up gaia.
      ivits charge 3pw
      ivits action power4.
      baltaks build ts -4x4.
      ivits build ts 4x-6.
      baltaks pass booster1
      ivits up terra.
      ivits build lab 4x-6. tech free3. up terra.
      ivits spend 1o for 1c
    `);

    const engine = new Engine(moves);

    expect(engine.player(Player.Player2).federationCache.federations.length).to.equal(1);
  });

  it("should be able to form this federation with 0 satellite & one space station", () => {
    const moves = parseMoves(`
      init 4 green-jeans-8458
      p1 faction ivits
      p2 faction xenos
      p3 faction ambas
      p4 faction itars
      xenos build m 2x-3
      ambas build m -2x3
      itars build m 2x0
      itars build m -1x-4
      ambas build m -3x-2
      xenos build m 1x3
      xenos build m -1x-5
      ivits build PI -2x4
      itars booster booster4
      ambas booster booster3
      xenos booster booster5
      ivits booster booster9
      ivits income 1t
      ivits spend 1pw for 1c. special space-station. build sp -3x5.
      xenos build ts -1x-5.
      itars charge 1pw
      ambas build ts -3x-2.
      itars charge 1pw
      itars build ts -1x-4.
      xenos charge 2pw
      ambas charge 2pw
      ivits build m -4x5.
      ambas charge 1pw
      xenos burn 1. action power6. build m 3x-4.
      ambas build lab -3x-2. tech free1. up nav.
      itars charge 2pw
      itars build lab -1x-4. tech free1. up terra.
      xenos charge 2pw
      ambas charge 2pw
      ivits action power3.
      xenos build m 1x-1.
      itars charge 1pw
      ambas action qic1. tech free2. up terra.
      itars build ts 2x0.
      xenos charge 1pw
      ivits build m -3x6.
      xenos up int.
      ambas build ac1 -3x-2. tech nav. up nav.
      itars charge 2pw
      itars burn 2. action power4.
      ivits build ts -4x5.
      xenos build lab -1x-5. tech free1. up int.
      itars decline 2pw
      ambas spend 1pw for 1c. up nav.
      itars special step. build m 2x1.
      xenos charge 1pw
      ivits build lab -4x5. tech eco. up eco.
      ambas charge 1pw
      xenos action power5.
      ambas spend 3pw for 1o. build m -2x0.
      itars spend 1q for 1o. build PI 2x0.
      xenos charge 1pw
    `);

    const engine = new Engine(moves);

    engine.generateAvailableCommandsIfNeeded();
    // tslint:disable-next-line no-unused-expression
    expect(engine.findAvailableCommand(Player.Player1, Command.FormFederation)).to.not.be.undefined;
  });
});
