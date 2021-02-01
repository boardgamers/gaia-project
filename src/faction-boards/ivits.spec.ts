import { expect } from "chai";
import Engine from "../engine";
import { Player, Command } from "../enums";

const parseMoves = Engine.parseMoves;

describe("Ivits", () => {
  it("should be able to place a space station and use it as a starting point to build a mine", () => {
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

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("spacestation is not discounting upgrade cost for others", () => {
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

  it("should be able to build a federation using a space station and qic", () => {
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

  it("should be able to build a federation using using PA->4pw", () => {
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

  it("should have 1q after forming this federation", () => {
    const engine = new Engine(almostFullGame.slice(0, -1), { advancedRules: true, noFedCheck: true });

    engine.options.noFedCheck = false;

    engine.move(almostFullGame.slice(-1)[0]);

    expect(engine.player(Player.Player2).data.qics).to.equal(1);
  });

  it("should place PI last even with auction", () => {
    const engine = new Engine(
      [
        "init 3 Pink-visit-2792",
        "p1 faction ivits",
        "p2 faction terrans",
        "p3 faction gleens",
        "p1 bid ivits 8",
        "p2 bid ivits 11",
        "p3 bid terrans 2",
        "p1 bid gleens 0",
      ],
      {
        auction: true,
        map: {
          sectors: [
            { sector: "9", rotation: 0 },
            { sector: "6A", rotation: 4 },
            { sector: "2", rotation: 5 },
            { sector: "3", rotation: 3 },
            { sector: "1", rotation: 5 },
            { sector: "5A", rotation: 5 },
            { sector: "8", rotation: 5 },
            { sector: "4", rotation: 4 },
            { sector: "7A", rotation: 2 },
            { sector: "10", rotation: 4 },
          ],
        },
      }
    );

    expect(() => engine.move("ivits build PI -6x3")).to.throw();
    expect(() => engine.move("gleens build m -5x7")).to.throw();
    expect(() => engine.move("terrans build m 1x0")).to.not.throw();
    expect(() => engine.move("gleens build m -5x7")).to.not.throw();
  });
});

const almostFullGame = Engine.parseMoves(`
  init 3 Three
  p3 rotate
  p1 faction firaks
  p2 faction ivits
  p3 faction terrans
  firaks build m -4x3
  terrans build m 3x-3
  terrans build m -4x0
  firaks build m -6x5
  ivits build PI -7x6
  terrans booster booster5
  ivits booster booster4
  firaks booster booster3
  ivits income 1t
  firaks build ts -6x5.
  ivits charge 3pw
  ivits action power3.
  terrans build ts -4x0.
  firaks build lab -6x5. tech terra. up terra.
  ivits charge 3pw
  ivits special space-station. build sp -6x6.
  terrans build PI -4x0.
  firaks special 4pw.
  ivits special step. build m -5x6.
  firaks charge 2pw
  terrans up nav.
  firaks action power6. build m -3x3.
  ivits build ts -5x6.
  firaks charge 2pw
  terrans special range+3. build gf -4x7.
  firaks build m -3x4.
  ivits charge 2pw
  ivits build lab -5x6. tech free2. up eco.
  firaks charge 2pw
  terrans pass booster2
  firaks up eco.
  ivits build m -6x9.
  firaks build m -2x5.
  ivits up eco.
  firaks pass booster1
  ivits spend 1pw for 1c. pass booster8
  terrans income 1t. income 4pw
  ivits income 2pw. income 1pw. income 4pw
  terrans spend 4tg for 1q. spend 1tg for 1c. spend 1tg for 1c
  terrans build m -4x7.
  firaks charge 1pw
  ivits charge 2pw
  firaks action power4.
  ivits action power1.
  terrans burn 1. action power3.
  firaks build ts -2x5.
  terrans charge 1pw
  ivits special space-station. build sp -5x7.
  terrans build gf -1x-1.
  firaks special 4pw.
  ivits build m -3x9.
  terrans build ts -4x7.
  firaks charge 2pw
  ivits charge 2pw
  firaks burn 1. spend 3pw for 1o. build PI -2x5.
  terrans charge 2pw
  ivits federation -5x6,-5x7,-6x6,-7x6 fed6.
  terrans pass booster5
  firaks special down-lab. build ts -6x5. up eco.
  ivits charge 3pw
  ivits build ts -6x9.
  terrans charge 2pw
  firaks up eco.
  ivits up eco.
  firaks pass booster4
  ivits up terra.
  ivits burn 1. spend 2pw for 2c. build lab -6x9. tech sci. up sci.
  ivits pass booster2
  terrans income 1t
  firaks income 1t
  ivits income 4pw. income 3pw. income 1pw
  terrans spend 4tg for 1k. spend 1tg for 1c. spend 1tg for 1c
  terrans build lab -4x7. tech eco. up eco.
  ivits charge 2pw
  firaks action power3.
  ivits spend 3pw for 1o. build ac2 -6x9. tech nav. up nav.
  terrans charge 2pw
  terrans action power1.
  firaks special step. build m -4x2.
  terrans charge 3pw
  ivits special space-station. build sp -5x9.
  terrans up sci.
  firaks build lab -6x5. tech int. up int.
  ivits charge 4pw
  ivits special q.
  terrans burn 2. spend 2pw for 2c. build m -1x-1.
  firaks special 4pw.
  ivits burn 1. spend 1pw for 1c. spend 1q for 1o. action power6. build m -4x9.
  terrans charge 2pw
  terrans special range+3. build gf 0x4.
  firaks special down-lab. build ts -6x5. up terra.
  ivits charge 4pw
  ivits federation -3x9,-4x9,-5x6,-5x7,-5x8,-5x9,-6x6,-6x9,-7x6 fed2.
  terrans pass booster1
  firaks up terra.
  ivits up eco.
  firaks action power4.
  ivits pass booster5
  firaks build ts -4x2.
  terrans charge 3pw
  firaks federation -3x3,-3x4,-4x2,-4x3,-5x4,-6x5 fed4.
  firaks spend 1q for 1o. build lab -6x5. tech eco. up eco.
  ivits decline 4pw
  firaks pass booster3
  terrans income 1t
  ivits income 1t
  firaks income 1t
  terrans spend 6tg for 6c
  terrans build m 0x4.
  firaks charge 1pw
  ivits action power3.
  firaks action power5.
  terrans build m 1x4.
  ivits spend 4pw for 1k. up nav.
  firaks up terra.
  terrans up nav.
  ivits build m -1x7.
  firaks up terra.
  terrans build ts 0x4.
  firaks charge 3pw
  ivits special space-station. build sp 1x5.
  firaks build m -3x10.
  ivits charge 1pw
  terrans action power4.
  ivits build m 3x3.
  terrans charge 1pw
  firaks special 4pw.
  terrans build gf 1x6.
  ivits special range+3. build m 5x-4.
  terrans charge 1pw
  firaks special down-lab. build ts -6x5. up int.
  ivits charge 4pw
  terrans pass booster8
  ivits special q.
  firaks action power2. build m -4x10.
  ivits charge 1pw
  ivits spend 1pw for 1c. build ts -3x9.
  firaks charge 1pw
  firaks build lab -6x5. tech adv-terra. cover int. up int.
  ivits charge 4pw
  ivits burn 1. spend 3pw for 3c. build ts -4x9.
  terrans charge 2pw
  firaks charge 1pw
  firaks action qic2. fedtile fed4.
  ivits pass booster1
  firaks build ts -3x10.
  ivits charge 2pw
  firaks pass booster2
  terrans income 1t
  ivits income 4pw. income 1pw. income 4pw
  firaks income 1t. income 4pw. income 4pw
  terrans spend 6tg for 2o
  terrans build ac1 -4x7. tech terra. up terra.
  firaks charge 3pw
  ivits charge 3pw
  ivits action power2. build m -3x7.
  terrans charge 3pw
  firaks charge 1pw
  firaks action power4.
  terrans build m 1x6.
  ivits charge 1pw
  ivits build ac1 -5x6. tech free1. up nav.
  terrans charge 3pw
  firaks charge 2pw
  firaks action power3.
  terrans up nav.
  ivits up nav.
  firaks build lab -4x2. tech nav. up nav.
  terrans action power1.
  ivits burn 1. spend 6pw for 2o. build lab -3x9. tech adv-nav. cover free1. up nav. lostPlanet -2x8.
  firaks charge 2pw
  firaks charge 2pw
  firaks up nav.
  terrans build gf 1x7.
  ivits special 3o.
  firaks build m 2x2.
  ivits charge 1pw
  terrans charge 2pw
  terrans build m 6x-2.
  ivits spend 1q for 1o. build m 2x-5.
  firaks build m 2x0.
  terrans up eco.
  ivits special space-station. build sp 0x6.
  firaks special 4pw.
  terrans action power6.
  ivits special q.
  firaks build m 4x-1.
  terrans charge 1pw
  terrans special 4pw.
  ivits federation -1x7,-2x8,-3x9,-4x9,-5x6,-5x7,-5x8,-5x9,-6x6,-6x9,-7x6,0x6,1x5 fed2.
  firaks special down-lab. build ts -4x2. up nav.
  terrans charge 1pw
  terrans action power5.
  ivits pass booster3
  firaks spend 3pw for 1o. build ts 4x-1.
  terrans charge 1pw
  terrans up eco.
  firaks action power7.
  terrans pass booster1
  firaks federation -1x6,-1x8,-2x5,-2x6,-2x9,-3x10,-4x10,0x6,0x7 fed4.
  firaks build ts 2x2.
  ivits charge 1pw
  terrans charge 2pw
  firaks pass booster8
  ivits income 4pw. income 4pw. income 1pw
  terrans income 1t
  firaks income 1t
  terrans spend 6tg for 2o
  ivits spend 1pw for 1c. up eco.
  terrans pass
  firaks up int.
  ivits action power1.
  firaks build lab 4x-1. tech adv-eco. cover eco. up nav.
  terrans charge 1pw
  ivits build m -2x-4.
  firaks build ac2 4x-1. tech free1. up gaia.
  terrans charge 1pw
  ivits action qic1. tech terra. up terra.
  firaks special down-lab. build ts -6x5. up gaia.
  ivits decline 4pw
  ivits up terra.
  firaks federation 2x0,2x2,3x0,3x1,4x-1 fed4.
  ivits build m -3x0.
  terrans decline 3pw
  firaks charge 2pw
  firaks build m -2x-1.
  ivits charge 1pw
  terrans decline 3pw
  ivits build m -2x1.
  terrans charge 1pw
  firaks charge 1pw
  firaks action power3.
  ivits special 4pw.
  firaks special 4pw.
  ivits special 3o.
  firaks burn 1. action power4.
  ivits build lab -4x9. tech free3. up terra.
  terrans decline 3pw
  firaks charge 2pw
  firaks build m 4x-6.
  ivits charge 1pw
  ivits build ts -1x7.
  terrans charge 1pw
  firaks special q.
  ivits build m -6x2.
  terrans decline 2pw
  firaks charge 2pw
  firaks build m 3x-4.
  ivits charge 1pw
  terrans charge 1pw
  ivits build ts -3x7.
  terrans charge 1pw
  firaks decline 4pw
  firaks build lab -6x5. tech gaia. up gaia.
  ivits decline 4pw
  ivits special space-station. build sp -3x8.
  firaks build ts 3x-4.
  ivits charge 1pw
  ivits spend 1pw for 1c. build m -7x12.
  firaks action qic3.
  ivits special q.
  firaks burn 1. spend 4pw for 1q. action qic2. fedtile fed2.
  ivits federation -1x7,-2x8,-3x7,-3x8,-3x9,-4x9,-5x6,-5x7,-5x8,-5x9,-6x6,-6x9,-7x6,0x6,1x5,2x4,3x3 fed1.
`);
