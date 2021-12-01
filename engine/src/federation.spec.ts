import { expect } from "chai";
import Engine, { AuctionVariant } from "./engine";
import { Command } from "./enums";

describe("Federations", () => {
  it("should show the 21 options with flexible federation rules", function () {
    this.timeout(10000);
    const engine = new Engine(game(), { flexibleFederations: true });

    expect(engine.findAvailableCommand(engine.playerToMove, Command.FormFederation).data.federations).to.have.length(
      21
    );
  });

  it("should show 9 options with regular federation rules", function () {
    this.timeout(30000);
    const engine = new Engine(game());

    expect(engine.findAvailableCommand(engine.playerToMove, Command.FormFederation).data.federations).to.have.length(9);

    // This extra long federation should not work
    expect(() =>
      engine.move("gleens federation 0x1,0x0,0x-1,-1x-1,-1x-2,-1x-3,-2x-3,-3x-2,-3x-1,-3x0,-1x1,-2x2 fed6.")
    ).to.throw();
  });

  it("should not allow unnecessary mines if there's a PI and AC with 4pw each", function () {
    this.timeout(10000);
    const engine = new Engine(game2.moveHistory, game2.options);

    expect(() => engine.move("ambas federation -2x3,-2x2,-1x1,0x0 fed3.")).to.throw();
  });

  it("should force to add a mine to the federation if it means less satellites", function () {
    this.timeout(10000);

    const engine = new Engine(game3.moveHistory, game3.options);
    expect(() => engine.move("xenos federation 10A10,10A8,10A9,3A2,5A1,5A5,5A6,5B1,5B2 fed1.")).to.throw();
    expect(() => engine.move("xenos federation 5B3,5C,5A11,3A5,3B2,3B1 fed1.")).to.not.throw();
  });

  it("should show a federation with only 6 satellites", function () {
    this.timeout(10000);

    const engine = new Engine(game4.moveHistory, { advancedRules: true, auction: AuctionVariant.BidWhileChoosing });

    engine.generateAvailableCommandsIfNeeded();

    expect(engine.availableCommands.some((command) => command.name === Command.FormFederation)).to.be.true;
  });

  it("should not allow a federation with more satellites than tokens", function () {
    this.timeout(10000);

    const engine = new Engine(game5);
    expect(() =>
      engine.move(
        "terrans federation 6A4,6A5,7A11,7A10,9A3,9B2,9C,9B5,9A10,3A3,3B2,3C,3B5,3A11,4A5,4C,4B0,4A11,4A0,8A8 fed2."
      )
    ).to.throw("Federation requires too many satellites");
  });

  it("should show a federation for bescods", function () {
    this.timeout(10000);

    const engine = new Engine(game6.moveHistory, game6.options);

    engine.generateAvailableCommandsIfNeeded();

    expect(engine.availableCommands.some((command) => command.name === Command.FormFederation)).to.be.true;
  });
});

const game = () =>
  Engine.parseMoves(`
init 4 GaiaRocks
p1 faction nevlas
p2 faction hadsch-hallas
p3 faction gleens
p4 faction bescods
nevlas build m 2x2
hadsch-hallas build m -6x6
gleens build m 0x3
bescods build m -5x4
bescods build m 3x1
gleens build m -5x11
hadsch-hallas build m 5x0
nevlas build m -3x7
bescods booster booster3
gleens booster booster6
hadsch-hallas booster booster1
nevlas booster booster10
nevlas build ts 2x2.
gleens charge 1pw
bescods charge 1pw
hadsch-hallas build ts 5x0.
bescods charge 1pw
gleens up nav.
bescods build ts 3x1.
nevlas charge 2pw
hadsch-hallas charge 2pw
nevlas build lab 2x2. tech sci. up sci.
gleens charge 1pw
bescods charge 2pw
hadsch-hallas build lab 5x0. tech eco. up eco.
bescods charge 2pw
gleens build m 0x1.
bescods special up-lowest. up nav.
nevlas up sci.
hadsch-hallas up eco.
gleens build m -2x2.
bescods build lab 3x1. tech free2. up nav.
nevlas charge 2pw
hadsch-hallas charge 2pw
nevlas action power6. build m -3x4.
gleens charge 1pw
bescods charge 1pw
hadsch-hallas action power3.
gleens build m -4x2.
bescods charge 1pw
bescods build m -6x3. spend 4pw for 1q.
gleens charge 1pw
nevlas pass booster7
hadsch-hallas spend 1q for 1o. build ac1 5x0. tech free1. up eco.
bescods charge 2pw
gleens build m -2x5.
nevlas charge 1pw
bescods build ts -5x4.
nevlas charge 1pw
hadsch-hallas charge 1pw
gleens charge 1pw
hadsch-hallas pass booster2
gleens pass booster10
bescods action qic1. tech terra. up terra.
bescods special 4pw. spend 3pw for 1o.
bescods spend 1pw for 1c. build lab -5x4. tech free1. up sci.
nevlas charge 1pw
hadsch-hallas charge 1pw
gleens charge 1pw
bescods pass booster1
hadsch-hallas income 2t
nevlas action power3.
hadsch-hallas action power6. build m -5x6.
bescods charge 2pw
nevlas charge 1pw
gleens build ts -2x5.
nevlas charge 1pw
bescods build ts -6x3.
gleens charge 1pw
nevlas build ts -3x4.
hadsch-hallas charge 1pw
gleens charge 1pw
bescods charge 2pw
hadsch-hallas build ts -5x6.
bescods charge 2pw
nevlas charge 2pw
gleens spend 1o for 1t. build ts -4x2.
bescods charge 2pw
bescods spend 3pw for 1o. special up-lowest. up eco.
nevlas build PI -3x4.
hadsch-hallas charge 2pw
gleens charge 2pw
bescods charge 2pw
hadsch-hallas up nav.
gleens action power1.
bescods up eco.
nevlas up nav.
hadsch-hallas build lab -5x6. tech free2. up nav.
bescods charge 2pw
nevlas charge 3pw
gleens up gaia.
bescods special 4pw. spend 3pw for 1o.
nevlas burn 1. spend t-a3 for 1k. spend t-a3 for 1k. action power5.
hadsch-hallas build m -5x8.
nevlas charge 1pw
gleens build gf -4x7.
bescods build lab -6x3. tech eco. up eco.
gleens charge 2pw
nevlas up nav.
hadsch-hallas pass booster3
gleens build lab -2x5. tech gaia. up gaia.
nevlas charge 3pw
bescods pass booster2
nevlas action power4.
gleens pass booster8
nevlas build m -2x8.
nevlas pass booster1
bescods income 3pw. income 2t
nevlas income 1t
hadsch-hallas build m -8x8.
bescods action power6. build m -3x3.
nevlas charge 3pw
gleens charge 2pw
gleens build m -4x7.
nevlas charge 1pw
hadsch-hallas charge 2pw
nevlas action power3.
hadsch-hallas action power5.
bescods special 4pw.
gleens spend 3k for 3c. spend 1pw for 1c. build lab -4x2. tech free1. up gaia.
bescods charge 2pw
nevlas action power2. build m -6x9.
hadsch-hallas charge 1pw
gleens charge 1pw
hadsch-hallas build m 2x4.
nevlas charge 2pw
bescods action power7.
gleens build gf -3x10.
nevlas build m -6x11.
gleens charge 1pw
hadsch-hallas up terra.
bescods special up-lowest. up gaia.
gleens spend 1pw for 1c. build gf -3x0.
nevlas build m 0x4.
hadsch-hallas charge 1pw
gleens charge 2pw
hadsch-hallas build ts -6x6.
bescods decline 2pw
bescods build gf -1x2.
gleens spend 1pw for 1c. pass booster10
nevlas up terra.
hadsch-hallas build lab -6x6. tech terra. up terra.
bescods charge 2pw
bescods spend 3pw for 1o. build PI -5x4.
nevlas decline 3pw
hadsch-hallas charge 2pw
gleens charge 2pw
nevlas build ts 0x4.
hadsch-hallas charge 1pw
hadsch-hallas action power4.
bescods federation -3x3,-4x3,-5x3,-5x4,-6x3 fed3.
nevlas federation -1x4,-2x4,-3x4,0x4,1x3,2x2 fed5.
hadsch-hallas up terra.
bescods pass booster8
nevlas pass booster2
hadsch-hallas burn 3. spend 3pw for 1o. build ts -5x8.
nevlas charge 1pw
hadsch-hallas federation -7x7,-5x7 fed4.
hadsch-hallas pass booster6
bescods income 2t
nevlas income 2t. income 2pw. income 4pw
gleens build m -3x0.
bescods action power3.
nevlas spend 1pw for 1c. up nav.
hadsch-hallas action power6. build m 4x0.
bescods charge 3pw
nevlas charge 1pw
gleens build gf -1x-1.
bescods build m -1x2.
gleens charge 1pw
nevlas action power2. build m 1x-1.
gleens charge 1pw
hadsch-hallas build m 4x-2.
gleens build ts 0x1.
bescods charge 1pw
nevlas charge 1pw
bescods build gf 3x-1.
nevlas action power5.
hadsch-hallas build ts 4x0.
bescods charge 3pw
nevlas charge 2pw
gleens build m -3x10.
nevlas charge 1pw
bescods special up-lowest. up int.
nevlas spend 1t-a3 for 1k. up nav.
hadsch-hallas build lab 4x0. tech adv-eco. cover free2. up nav.
bescods charge 3pw
nevlas charge 2pw
gleens up nav.
bescods spend 4pw for 1q. special 4pw.
nevlas build ts -3x7.
hadsch-hallas charge 2pw
gleens charge 2pw
hadsch-hallas up nav.
gleens action power4.
bescods up eco.
nevlas pass booster1
hadsch-hallas special 3k.
gleens build gf -4x9.
bescods build ts -1x2.
nevlas charge 3pw
gleens charge 1pw
hadsch-hallas build m 2x-3.
nevlas charge 1pw
gleens pass booster2
bescods build lab -1x2. tech nav. up nav. spend 3pw for 1o.
hadsch-hallas spend 1pw for 1c. spend 1pw for 1c. special 4pw.
bescods up nav.
hadsch-hallas spend 2pw for 2c. federation 2x-2,2x-3,3x-2,4x-1,4x-2,4x0,5x0 fed3.
bescods pass booster3
hadsch-hallas up nav. lostPlanet -2x0.
hadsch-hallas pass booster8
nevlas income 1t
bescods income 4pw. income 2t
nevlas action power3.
gleens build ac2 -4x2. tech int. up int.
bescods charge 4pw
bescods action power5.
hadsch-hallas spend 1pw for 1c. build m -5x1.
gleens charge 4pw
bescods charge 2pw
nevlas build lab -3x7. tech free2. up terra.
hadsch-hallas decline 2pw
gleens charge 2pw
gleens spend 1q for 1o. spend 1pw for 1c. build PI 0x1.
bescods charge 2pw
nevlas charge 1pw
bescods special 4pw.
hadsch-hallas build m -3x-3.
nevlas build ac2 -3x7. tech terra. up terra.
hadsch-hallas decline 2pw
gleens decline 2pw
gleens build m -1x-1.
nevlas charge 1pw
hadsch-hallas charge 1pw
bescods special up-lowest. up sci.
hadsch-hallas build ts -5x1.
gleens decline 4pw
bescods charge 2pw
nevlas special q.
gleens up gaia.
bescods build m 3x-1.
nevlas charge 1pw
hadsch-hallas charge 1pw
hadsch-hallas up terra. spend 1pw for 1c.
nevlas spend 6pw for 2o. build m -2x-1.
hadsch-hallas charge 1pw
gleens charge 1pw
gleens build gf 1x-3.
bescods up sci.
hadsch-hallas build PI -5x1.
gleens charge 4pw
bescods charge 2pw
nevlas build m 1x-5.
gleens action power4.
bescods build m 3x-6.
nevlas charge 1pw
hadsch-hallas up int.
nevlas up terra.
`);

const game2 = {
  options: {
    map: {
      sectors: [
        {
          sector: "5B",
          rotation: 0,
          center: {
            q: 0,
            r: 0,
            s: 0,
          },
        },
        {
          sector: "6B",
          rotation: 1,
          center: {
            q: 5,
            r: -2,
            s: -3,
          },
        },
        {
          sector: "2",
          rotation: 0,
          center: {
            q: 2,
            r: 3,
            s: -5,
          },
        },
        {
          sector: "7B",
          rotation: 2,
          center: {
            q: -3,
            r: 5,
            s: -2,
          },
        },
        {
          sector: "4",
          rotation: 4,
          center: {
            q: -5,
            r: 2,
            s: 3,
          },
        },
        {
          sector: "3",
          rotation: 3,
          center: {
            q: -2,
            r: -3,
            s: 5,
          },
        },
        {
          sector: "1",
          rotation: 0,
          center: {
            q: 3,
            r: -5,
            s: 2,
          },
        },
      ],
    },
  },

  moveHistory: [
    "init 2 Gentle-officer-4378",
    "p1 faction ivits",
    "p2 faction ambas",
    "ambas build m -3x4",
    "ambas build m 2x2",
    "ivits build PI -1x2",
    "ambas booster booster4",
    "ivits booster booster9",
    "ivits income 1t",
    "ivits special space-station. build sp -2x2.",
    "ambas build ts -3x4.",
    "ivits charge 2pw",
    "ivits action power6. build m -3x2.",
    "ambas charge 2pw",
    "ambas up nav.",
    "ivits action power3.",
    "ambas build m -2x5.",
    "ivits up gaia.",
    "ambas special step. build m -1x3.",
    "ivits charge 3pw",
    "ivits build ts -3x2.",
    "ambas charge 2pw",
    "ambas build m -4x6.",
    "ivits build m -5x1.",
    "ambas build lab -3x4. tech sci. up sci.",
    "ivits charge 3pw",
    "ivits build lab -3x2. tech free2. up sci.",
    "ambas charge 2pw",
    "ambas pass booster8",
    "ivits special 4pw.",
    "ivits action power7.",
    "ivits build gf 0x2.",
    "ivits pass booster4",
    "ivits income 1t",
    "ambas action power4.",
    "ivits build m 0x2.",
    "ambas charge 1pw",
    "ambas build ts 2x2.",
    "ivits charge 1pw",
    "ivits burn 1. action power5.",
    "ambas up terra.",
    "ivits build m 1x2.",
    "ambas charge 2pw",
    "ambas build lab 2x2. tech nav. up nav.",
    "ivits charge 1pw",
    "ivits build gf 4x0.",
    "ambas build ts -1x3.",
    "ivits charge 3pw",
    "ivits special space-station. build sp -5x2.",
    "ambas spend 1pw for 1c. pass booster9",
    "ivits federation -1x2,-2x2,-3x2,0x2,1x2 fed4.",
    "ivits spend 1pw for 1c. special 4pw.",
    "ivits spend 1pw for 1c. special step. build m -6x3.",
    "ivits up sci.",
    "ivits pass booster8",
    "ivits income 1t",
    "ambas action power5.",
    "ivits up sci.",
    "ambas up terra.",
    "ivits special 4pw.",
    "ambas up terra.",
    "ivits special space-station. build sp -3x1.",
    "ambas build m 2x0.",
    "ivits charge 1pw",
    "ivits action power4.",
    "ambas build m 1x-1.",
    "ivits build ts 0x2.",
    "ambas charge 2pw",
    "ambas pass booster2",
    "ivits build lab 0x2. tech free1. up sci. burn 2. spend 4pw for 1q.",
    "ambas charge 2pw",
    "ivits action qic1. tech adv-sci. cover free1. up eco.",
    "ivits special 3o.",
    "ivits spend 2o for 2c. build m 4x0.",
    "ambas charge 2pw",
    "ivits pass booster9",
    "ambas income 2t",
    "ivits income 4pw. income 1pw. income 4pw",
    "ambas action power4.",
    "ivits special 4pw.",
    "ambas up terra.",
    "ivits special space-station. build sp -4x1.",
    "ambas build PI -1x3.",
    "ivits charge 3pw",
    "ivits federation -1x2,-2x2,-3x1,-3x2,-4x1,-5x1,-5x2,-6x3,0x2,1x2 fed5.",
    "ambas build ac1 -3x4. tech int. up int.",
    "ivits charge 2pw",
    "ivits spend 1pw for 1c. special 3o.",
  ],
};

const game3 = {
  moveHistory: [
    "init 4 jobefunhouse017",
    "p1 faction itars",
    "p2 faction ambas",
    "p3 faction baltaks",
    "p4 faction xenos",
    "itars build m 3x-4",
    "ambas build m 1x1",
    "baltaks build m -4x4",
    "xenos build m -5x5",
    "xenos build m 3x-1",
    "baltaks build m 5x-6",
    "ambas build m -4x2",
    "itars build m 3x3",
    "xenos build m 2x5",
    "xenos booster booster3",
    "baltaks booster booster5",
    "ambas booster booster4",
    "itars booster booster6",
    "itars build ts 3x-4.",
    "baltaks charge 1pw",
    "ambas up nav.",
    "baltaks build ts -4x4.",
    "xenos charge 1pw",
    "ambas charge 1pw",
    "xenos build ts 5A6.",
    "baltaks charge 2pw",
    "itars up terra.",
    "ambas build ts 4B0.",
    "baltaks charge 1pw",
    "baltaks spend 1gf for 1q. special range+3. build m 7B2.",
    "ambas charge 1pw",
    "xenos build lab 5A6. tech terra. up terra.",
    "itars build lab 2B1. tech free3. up eco.",
    "ambas build m 1B3.",
    "xenos charge 1pw",
    "baltaks action power3.",
    "xenos up nav.",
    "itars build m 3B3.",
    "ambas charge 1pw",
    "ambas burn 2. action power6. build m 7A6.",
    "baltaks charge 1pw",
    "baltaks build lab 5A7. tech free2. up gaia.",
    "xenos charge 2pw",
    "ambas charge 2pw",
    "xenos action qic1. tech free3. up eco.",
    "itars burn 1. spend 1pw for 1c. build ac1 2B1. tech free2. up eco.",
    "baltaks charge 1pw",
    "ambas build m 7B4.",
    "baltaks charge 1pw",
    "baltaks up gaia.",
    "xenos burn 1. spend 3pw for 1o. build ac1 5A6. tech eco. up eco.",
    "baltaks charge 2pw",
    "itars pass booster10",
    "ambas build lab 4B0. tech terra. up terra.",
    "baltaks charge 2pw",
    "baltaks spend 1gf for 1q. build m 4B2.",
    "ambas charge 2pw",
    "xenos pass booster6",
    "ambas special step. build m 2A3.",
    "itars charge 3pw",
    "baltaks build ts 7B2.",
    "ambas charge 1pw",
    "ambas pass booster3",
    "baltaks pass booster4",
    "itars income 2pw",
    "itars up eco.",
    "xenos up eco.",
    "ambas build m 9B1.",
    "baltaks spend 1gf for 1q. special step. build m 7B0.",
    "xenos charge 1pw",
    "ambas charge 1pw",
    "itars burn 4. action power3.",
    "xenos action power4.",
    "ambas spend 1o for 1c. build ts 7B4.",
    "baltaks charge 2pw",
    "baltaks action power5.",
    "itars build ts 3B0.",
    "xenos charge 1pw",
    "xenos build ts 3A2.",
    "itars charge 2pw",
    "ambas pass booster8",
    "baltaks up eco.",
    "itars build PI 3B0.",
    "xenos charge 2pw",
    "xenos build PI 3A2.",
    "itars charge 3pw",
    "baltaks spend 1gf for 1q. spend 1q for 1o. build lab 7B2. tech eco. up eco.",
    "ambas charge 1pw",
    "itars pass booster3",
    "xenos pass booster2",
    "baltaks pass booster5",
    "itars income 4pw. income 1t. income 3pw",
    "xenos income 2t",
    "itars spend 4tg for tech. tech nav. up nav",
    "ambas action power4.",
    "itars action power3.",
    "xenos build m 5B5.",
    "baltaks charge 2pw",
    "baltaks action power5.",
    "ambas build ts 7A6.",
    "baltaks charge 2pw",
    "itars action power6. build m 3A11.",
    "xenos up eco.",
    "baltaks special range+3. build m 8B1.",
    "ambas build lab 7B4. tech free1. up sci.",
    "baltaks charge 2pw",
    "itars up nav.",
    "xenos build ts 1A5.",
    "ambas charge 1pw",
    "baltaks charge 1pw",
    "baltaks up eco.",
    "ambas up sci.",
    "itars build m 5A0.",
    "xenos charge 1pw",
  ],
  options: {
    map: {
      sectors: [
        {
          sector: "1",
          rotation: 4,
        },
        {
          sector: "3",
          rotation: 4,
        },
        {
          sector: "10",
          rotation: 5,
        },
        {
          sector: "2",
          rotation: 0,
        },
        {
          sector: "7A",
          rotation: 0,
        },
        {
          sector: "5A",
          rotation: 0,
        },
        {
          sector: "6A",
          rotation: 0,
        },
        {
          sector: "9",
          rotation: 5,
        },
        {
          sector: "4",
          rotation: 4,
        },
        {
          sector: "8",
          rotation: 3,
        },
      ],
    },
  },
};

const game4 = {
  moveHistory: Engine.parseMoves(`
  init 4 fast-turn-based-game-EU
p4 rotate -5x2 1 0x0 1 -2x-3 1 -3x5 3 2x3 3
p1 faction firaks
p2 faction gleens
p3 faction ivits
p4 faction itars
firaks build m 4A4
gleens build m 10B1
itars build m 8B3
itars build m 4A1
gleens build m 3A4
firaks build m 7A0
ivits build PI 4B2
itars booster booster9
ivits booster booster4
gleens booster booster2
firaks booster booster3
ivits income 4pw
itars income 4pw
firaks build m 7B5.
gleens charge 1pw
gleens up nav.
ivits burn 2. action power3.
itars build ts 4A1.
ivits charge 3pw
firaks build ts 7B5.
gleens charge 1pw
gleens build m 10B4.
itars charge 2pw
ivits up terra.
itars build lab 4A1. tech sci. up sci.
gleens charge 1pw
ivits charge 3pw
firaks build lab 7B5. tech sci. up sci.
gleens charge 1pw
gleens build ts 3A4.
firaks charge 2pw
ivits special space-station. build sp 4C.
itars up terra.
firaks up terra.
gleens build lab 3A4. tech free2. up gaia.
firaks charge 2pw
ivits special step. build m 4B0.
itars charge 2pw
itars spend 3pw for 1o. build ac1 4A1. tech free2. up sci.
gleens charge 1pw
ivits charge 3pw
firaks build ts 4A4.
ivits charge 1pw
gleens build gf 10A5.
ivits action power2. build m 5A10.
itars charge 3pw
firaks charge 2pw
itars burn 4. action power5.
firaks pass booster7
gleens pass booster3
ivits build ts 4B0.
itars charge 3pw
itars pass booster2
ivits build lab 4B0. tech free2. up terra.
itars charge 3pw
ivits pass booster9
itars income 1pw
ivits income 4pw. income 4pw
firaks action power3.
gleens build ac2 3A4. tech free1. up sci.
firaks charge 2pw
itars action power6. build m 8A6.
ivits special space-station. build sp 4A3.
firaks build PI 4A4.
ivits charge 3pw
gleens special q.
itars up sci.
ivits federation 4A3,4B0,4B2,4C,5A10 fed4.
firaks special down-lab. build ts 7B5. up eco.
gleens decline 3pw
gleens spend 1q for 1o. build m 10A5.
ivits charge 1pw
itars up sci.
ivits action power5.
firaks up eco.
gleens build gf 8A8.
itars pass booster4
ivits up terra.
firaks pass booster8
gleens pass booster2
ivits build ac2 4B0. tech terra. up terra.
itars charge 3pw
ivits special q.
ivits build m 5A11.
gleens charge 1pw
ivits spend 1q for 1o. spend 1pw for 1c. build m 5B1.
itars charge 1pw
ivits pass booster3
itars income 1pw
firaks income 4pw. income 2pw. income 1pw
ivits income 4pw
itars burn 4. action power4.
firaks action power3.
gleens build m 8A8.
ivits charge 1pw
itars charge 1pw
ivits special q.
itars up nav.
firaks build lab 7B5. tech int. up int.
gleens decline 3pw
gleens build gf 10A6.
ivits burn 1. spend 4pw for 1q. action qic1. tech free3. up int.
itars up nav.
firaks special down-lab. build ts 7B5. up eco.
gleens charge 3pw
gleens special q.
ivits special space-station. build sp 5B2.
itars build m 5A4.
firaks charge 1pw
ivits charge 1pw
firaks special 4pw.
gleens build m 9B0.
ivits build m 5A7.
firaks charge 2pw
itars build ts 5A4.
ivits charge 1pw
firaks spend 7pw for 7c. build lab 7B5. tech free2. up nav.
gleens charge 1pw
gleens spend 2pw for 2c. pass booster9
ivits pass booster7
itars build PI 5A4.
firaks charge 1pw
ivits charge 1pw
firaks up nav.
itars pass booster3
firaks build m 7B1.
firaks pass booster4
ivits income 4pw
itars income 4pw. income 1pw
firaks income 4pw. income 3pw. income 1pw
itars spend 4tg for tech. tech nav. up nav
gleens action power3.
ivits burn 1. action power5.
itars build ts 8B3.
gleens charge 1pw
firaks build m 3A1.
ivits charge 1pw
gleens build m 10A6.
ivits charge 1pw
itars charge 3pw
ivits special q.
itars action power6. build m 6B5.
firaks special step. build m 3B1.
gleens decline 3pw
ivits charge 1pw
gleens build ts 10B4.
itars decline 3pw
ivits action qic3.
itars build ts 8A6.
gleens charge 1pw
ivits charge 1pw
firaks special 4pw.
gleens build PI 10B4.
itars decline 3pw
ivits special space-station. build sp 5B0.
itars federation 5A2,5A3,5A4,8A6,8B3 fed4.
firaks action power4.
gleens special q.
ivits federation 4A3,4B0,4B2,4C,5A10,5A11,5B0,5B1,5B2 fed4.
itars up gaia.
firaks special down-lab. build ts 7B5. up terra.
gleens decline 3pw
gleens build m 3B4.
firaks charge 1pw
ivits build ts 5A10.
itars charge 3pw
firaks charge 3pw
gleens charge 1pw
itars burn 3. action power2. build m 9A4.
gleens decline 3pw
ivits decline 4pw
firaks build lab 7B5. tech terra. up terra.
gleens decline 3pw
gleens federation 10B3,10B2,10A4 fed5.
ivits up terra.
itars action qic1. tech adv-sci. cover nav. up gaia.
firaks up terra.
gleens up gaia.
ivits build lab 5A10. tech adv-terra. cover free3. up int.
itars charge 3pw
firaks charge 4pw
gleens charge 1pw
itars burn 1. spend 1pw for 1c. build gf 5A6.
firaks build ts 3B1.
gleens decline 3pw
ivits charge 1pw
gleens up gaia.
ivits special q,5c.
itars up eco.
firaks spend 3pw for 1o. build ts 7A0.
itars charge 2pw
gleens build gf 3A10.
ivits action qic2. fedtile fed4.
itars spend 1pw for 1c. pass booster2
firaks federation 3A1,3B1,4A4,5A8 fed2.
gleens build gf 9A9.
ivits build ts 5A7.
firaks decline 4pw
firaks spend 3pw for 1o. pass booster3
gleens pass booster6
ivits pass booster9
itars income 1t. income 4pw. income 1t. income 1pw. income 1pw
firaks income 4pw. income 3pw. income 1pw
ivits income 1t
itars spend 4tg for tech. tech eco. up eco. spend 4tg for tech. tech int. up int
itars action power3.
firaks action qic2. fedtile fed2.
gleens special q.
ivits action power4.
itars up terra.
firaks build lab 7A0. tech nav. up nav.
itars decline 3pw
gleens build m 3A10.
ivits special q,5c.
itars build m 6B1.
firaks up eco.
gleens build m 2A5.
ivits action qic3.
itars build m 5A6.
firaks charge 1pw
ivits decline 2pw
firaks action power6. build m 7A7.
gleens charge 3pw
gleens build gf 2A7.
ivits special q.
itars up terra.
firaks build ts 7A7.
gleens charge 3pw
gleens build ts 3B4.
firaks decline 2pw
ivits build ts 5B1.
itars decline 3pw
gleens charge 1pw
itars build m 9B2.
gleens charge 1pw
firaks federation 7A0,7A7,7B0,7B1,7B4,7B5 fed2.
gleens build m 9A9.
ivits build lab 5B1. tech int. up int.
itars decline 3pw
itars build ts 9B2.
firaks spend 3pw for 1o. spend 1q for 1o. build lab 7A7. tech adv-eco. cover nav. up nav.
gleens spend 1pw for 1c. build ts 9B0.
itars charge 2pw
ivits special 4pw.
itars build ts 9A4.
gleens decline 2pw
ivits charge 1pw
firaks special 3o.
gleens up gaia.
ivits action power5.
itars special 4pw.
firaks special down-lab. build ts 7B5. up int.
gleens decline 2pw
itars charge 1pw
gleens spend 1o for 1t. pass booster8
ivits up nav.
itars burn 1. action power7.
firaks build m 2A2.
gleens charge 1pw
ivits build ts 5A11.
gleens charge 1pw
itars federation 10A8,4A1,9A4,9B2 fed3.
firaks pass booster4
ivits action qic1. tech gaia. up gaia.
itars build gf 6A1.
ivits special space-station. build sp 5B3.
itars burn 1. spend 1pw for 1c. pass booster7
ivits federation 4A3,4B0,4B2,4C,5A10,5A11,5A7,5B0,5B1,5B2,5B3 fed6.
ivits up int.
ivits pass booster3
firaks income 4pw. income 4pw. income 1t
itars income 1t. income 4pw. income 1t
ivits income 4pw
itars spend 4tg for tech. tech free3. up gaia. spend 4tg for tech. tech gaia. up gaia
gleens build lab 9B0. tech adv-gaia. cover free2. up gaia.
firaks action qic2. fedtile fed2.
itars action power5.
ivits action qic3.
gleens action power7.
firaks action power3.
itars build m 6B3.
ivits up int.
gleens spend 3pw for 1o. build ac1 9B0. tech terra. up terra.
itars charge 2pw
firaks special down-lab. build ts 7A7. up eco.
gleens decline 4pw
itars up nav.
ivits special 4pw.
gleens federation 3B5,3C,3B2 fed3.
firaks special 4pw.
itars up terra.
ivits burn 1. action power1.
gleens spend 1pw for 1c. build m 2A7.
firaks special step. build m 2B5.
gleens charge 1pw
itars special 4pw.
ivits special q,5c.
gleens federation 1A4,2A0,2A5,2A7,2B0,2B3,2C,4A10,4A9,9A6,9A9,9B0,9B3,9B4,9B5 fed5.
firaks build m 1B2.
itars build m 6A0.
ivits special q.
gleens special q.
firaks build m 2B2.
gleens charge 1pw
itars up sci.
ivits special space-station. build sp 5A5.
gleens spend 1pw for 1c. up nav.
firaks build ts 2A2.
itars up int.
ivits action qic1. tech nav. up nav.
gleens spend 2q for 2o. build lab 3B4. tech free3. up nav.
firaks spend 3pw for 3c. build lab 2A2. tech free3. up int.
itars up int.
ivits spend 4q for 4o. build ac1 5B1. tech free1. up nav.
gleens spend 1pw for 1c. pass
firaks special 3o.
itars action power2. build m 7B3.
firaks decline 2pw
ivits up nav.
firaks build ac2 2A2. tech gaia. up gaia.
gleens charge 1pw
itars spend 2q for 2o. build m 6A1. spend 1o for 1t.
ivits pass
firaks spend 4pw for 1k. federation 1A4,1B2,2A0,2A2,2B0,2B1,2B2,2B5 fed6.
  `),
};

const game5 = [
  "init 4 Gentle-union-3021",
  "p1 faction terrans",
  "p2 faction hadsch-hallas",
  "p3 faction itars",
  "p4 faction baltaks",
  "terrans build m 6B4",
  "hadsch-hallas build m 5A7",
  "itars build m 9A0",
  "baltaks build m 9A9",
  "baltaks build m 1A9",
  "itars build m 5A4",
  "hadsch-hallas build m 1A10",
  "terrans build m 10A0",
  "baltaks booster booster1",
  "itars booster booster2",
  "hadsch-hallas booster booster5",
  "terrans booster booster6",
  "terrans build ts 10A0.",
  "hadsch-hallas charge 1pw",
  "hadsch-hallas build ts 1A10.",
  "itars charge 1pw",
  "baltaks charge 1pw",
  "itars build ts 5A4.",
  "baltaks charge 1pw",
  "hadsch-hallas charge 2pw",
  "baltaks build ts 1A9.",
  "hadsch-hallas charge 2pw",
  "itars charge 2pw",
  "terrans build PI 10A0.",
  "hadsch-hallas action power3.",
  "itars build lab 5A4. tech free3. up eco.",
  "baltaks charge 2pw",
  "hadsch-hallas charge 2pw",
  "baltaks build lab 1A9. tech int. up int.",
  "hadsch-hallas charge 2pw",
  "itars charge 2pw",
  "terrans up gaia.",
  "hadsch-hallas burn 2. action power4.",
  "itars up eco.",
  "baltaks spend 2q for 2o. build ac1 1A9. tech free1. up gaia.",
  "hadsch-hallas charge 2pw",
  "itars charge 2pw",
  "terrans build gf 6A7.",
  "hadsch-hallas build m 10A11.",
  "terrans charge 3pw",
  "itars burn 3. spend 3pw for 1o. spend 1q for 1o. build ac1 5A4. tech free1. up gaia.",
  "baltaks charge 3pw",
  "hadsch-hallas charge 2pw",
  "baltaks up gaia.",
  "terrans pass booster7",
  "hadsch-hallas up terra.",
  "itars burn 2. spend 2pw for 2c. build gf 10A5.",
  "baltaks spend 4pw for 1q. build gf 10A6.",
  "hadsch-hallas build PI 1A10.",
  "baltaks charge 2pw",
  "itars pass booster10",
  "baltaks spend 1gf for 1q. action power7.",
  "hadsch-hallas spend 4c for 1q. special range+3. build m 10B4.",
  "baltaks pass booster9",
  "hadsch-hallas pass booster1",
  "terrans income 1t",
  "itars income 1t",
  "hadsch-hallas income 1t",
  "terrans spend 6tg for 6c",
  "terrans action power3.",
  "itars build m 10A5.",
  "hadsch-hallas charge 1pw",
  "baltaks build gf 9A11.",
  "hadsch-hallas action power4.",
  "terrans build m 6A7.",
  "itars charge 1pw",
  "itars up nav.",
  "baltaks up gaia.",
  "hadsch-hallas build ts 10B4.",
  "itars charge 1pw",
  "terrans build ts 6A7.",
  "itars charge 1pw",
  "itars build gf 3A2.",
  "baltaks burn 1. spend 1pw for 1c. build m 10A6.",
  "hadsch-hallas charge 2pw",
  "itars charge 1pw",
  "hadsch-hallas build lab 10B4. tech free3. up nav.",
  "itars charge 1pw",
  "baltaks charge 1pw",
  "terrans spend 1pw for 1c. build gf 8A4.",
  "itars pass booster2",
  "baltaks spend 1gf for 1q. build gf 6A11.",
  "hadsch-hallas spend 12c for 3q. action qic1. tech terra. up terra.",
  "terrans build lab 6A7. tech free3. up nav.",
  "itars charge 1pw",
  "baltaks pass booster10",
  "hadsch-hallas spend 1pw for 1c. build ts 10A11.",
  "terrans charge 3pw",
  "terrans build m 6B0.",
  "itars charge 3pw",
  "hadsch-hallas pass booster9",
  "terrans pass booster1",
  "itars income 1t. income 2pw",
  "hadsch-hallas income 4pw. income 4pw. income 1t",
  "terrans income 1t",
  "terrans spend 6tg for 6c",
  "itars action power3.",
  "baltaks build m 6A11.",
  "terrans charge 1pw",
  "itars charge 3pw",
  "hadsch-hallas action power4.",
  "terrans build m 8A4.",
  "hadsch-hallas charge 2pw",
  "itars build m 3A2.",
  "baltaks charge 1pw",
  "hadsch-hallas charge 2pw",
  "baltaks build gf 5A6.",
  "hadsch-hallas up terra.",
  "terrans up nav.",
  "itars up nav.",
  "baltaks spend 1gf for 1q. burn 1. spend 1pw for 1c. build ts 10A6.",
  "hadsch-hallas charge 1pw",
  "itars charge 1pw",
  "hadsch-hallas spend 16c for 4q. action qic1. tech nav. up nav. spend 1pw for 1c.",
  "terrans action power6. build m 8B1.",
  "itars build gf 1A7.",
  "baltaks pass booster5",
  "hadsch-hallas action power2. build m 6A10.",
  "baltaks charge 1pw",
  "terrans charge 1pw",
  "terrans build m 8A2.",
  "itars burn 2. action power5.",
  "hadsch-hallas pass booster10",
  "terrans spend 4pw for 1q. build gf 2A9.",
  "itars build ts 9A0.",
  "baltaks charge 2pw",
  "terrans charge 2pw",
  "terrans pass booster9",
  "itars build PI 9A0.",
  "baltaks charge 2pw",
  "terrans decline 2pw",
  "itars build ts 10A5.",
  "baltaks charge 2pw",
  "hadsch-hallas charge 2pw",
  "itars pass booster6",
  "hadsch-hallas income 4pw. income 1pw. income 1pw",
  "terrans income 1t",
  "itars income 4pw. income 2pw",
  "terrans spend 6tg for 6c",
  "itars spend 4tg for tech. tech nav. up nav. spend 4tg for tech. tech int. up int",
  "baltaks action power4.",
  "hadsch-hallas spend 4c for 1q. build m 5B1.",
  "itars charge 4pw",
  "baltaks decline 3pw",
  "terrans action power3.",
  "itars build m 9B1.",
  "terrans charge 2pw",
  "baltaks build m 5A6.",
  "terrans charge 1pw",
  "hadsch-hallas charge 1pw",
  "itars charge 4pw",
  "hadsch-hallas build ts 5B1.",
  "baltaks decline 3pw",
  "terrans action power5.",
  "itars build m 3B0.",
  "baltaks spend 1gf for 1q. special range+3. build m 7B5.",
  "hadsch-hallas burn 1. action power7.",
  "terrans build m 2A9.",
  "itars build m 1A7. spend 3pw for 1o.",
  "baltaks charge 3pw",
  "terrans charge 1pw",
  "baltaks build ts 6A11.",
  "terrans charge 1pw",
  "hadsch-hallas charge 1pw",
  "itars decline 4pw",
  "hadsch-hallas federation 5A3,5B1,5B2,5B3,5A7,1A10 fed6.",
  "terrans build ac1 6A7. tech nav. up nav.",
  "itars decline 4pw",
  "itars action power6. build m 1B3.",
  "baltaks decline 3pw",
  "baltaks up terra.",
  "hadsch-hallas up terra.",
  "terrans federation 10A0,8A2,8A3,8A4,8B1 fed4.",
  "itars up nav.",
  "baltaks build m 9A11.",
  "itars charge 4pw",
  "hadsch-hallas build lab 5B1. tech free2. up terra.",
  "itars charge 4pw",
  "baltaks decline 3pw",
  "terrans build ts 6B4.",
  "hadsch-hallas charge 1pw",
  "itars charge 4pw",
  "baltaks charge 2pw",
  "itars spend 4pw for 1q. build m 7B1.",
  "baltaks charge 1pw",
  "baltaks spend 1gf for 1q. build gf 7A4.",
  "hadsch-hallas spend 3c for 1o. build lab 10A11. tech adv-terra. cover free2. up nav.",
  "terrans charge 4pw",
  "terrans federation 6A7,6B0,6B4,6C fed4.",
  "itars federation 9A1 fed4.",
  "baltaks pass booster2",
  "hadsch-hallas special q,5c.",
  "terrans up nav.",
  "itars action power2. build m 2A11.",
  "terrans charge 1pw",
  "hadsch-hallas spend 4c for 1q. action qic2. fedtile fed5.",
  "terrans spend 1pw for 1c. build lab 6B4. tech adv-nav. cover nav. up nav. lostPlanet 4B2.",
  "hadsch-hallas charge 1pw",
  "itars charge 4pw",
  "baltaks charge 2pw",
  "itars burn 2. spend 2pw for 2c. build m 4A3.",
  "terrans charge 1pw",
  "hadsch-hallas charge 1pw",
  "hadsch-hallas spend 5pw for 5c. spend 4c for 1q. spend 3c for 1o. build m 4B3.",
  "itars charge 1pw",
  "terrans charge 1pw",
  "terrans spend 1q for 1o. spend 2pw for 2c. build m 3A9.",
  "itars charge 1pw",
  "itars federation 1A6,1A7,1A8,1B3,2A11,5A4 fed6.",
  "hadsch-hallas pass booster5",
  "terrans burn 1. spend 4pw for 4c. build gf 8A9.",
  "itars burn 1. spend 1pw for 1c. up eco. burn 1.",
  "terrans pass booster10",
  "itars spend 1pw for 1c. pass booster9",
  "hadsch-hallas income 4pw. income 1t",
  "terrans income 4pw",
  "itars income 1t. income 1t",
  "terrans spend 6tg for 2o",
  "itars spend 4tg for tech. tech free2. up int",
  "baltaks build PI 10A6.",
  "hadsch-hallas charge 2pw",
  "hadsch-hallas action power4.",
  "terrans up gaia.",
  "itars action power3.",
  "baltaks spend 1gf for 1q. spend 1q for 1o. burn 1. spend 3pw for 3c. build lab 6A11. tech nav. up nav.",
  "terrans charge 2pw",
  "hadsch-hallas charge 1pw",
  "itars charge 4pw",
  "hadsch-hallas spend 6c for 2o. build ac1 10A11. tech int. up int.",
  "itars charge 1pw",
  "terrans charge 3pw",
  "terrans action power6. build m 3B3.",
  "itars charge 1pw",
  "itars build ts 7B1.",
  "baltaks charge 1pw",
  "baltaks federation 1A8,1A9,5A6,6A0,6A11 fed5.",
  "hadsch-hallas spend 4c for 1q. action qic2. fedtile fed5.",
  "terrans build m 4A10.",
  "itars build lab 7B1. tech eco. up eco.",
  "baltaks charge 1pw",
  "baltaks spend 1q for 1o. build m 7A4.",
  "itars charge 2pw",
  "hadsch-hallas spend 3c for 1o. build m 4B1.",
  "terrans charge 1pw",
  "terrans spend 2pw for 2c. build ts 3B3.",
  "itars spend 3pw for 3c. up int.",
  "baltaks spend 2gf for 2q. up gaia.",
  "hadsch-hallas special q,5c.",
  "terrans build lab 3B3. tech free2. up gaia.",
  "itars charge 1pw",
  "itars up int.",
  "baltaks spend 2q for 2o. build ts 9A9.",
  "itars charge 1pw",
  "hadsch-hallas spend 6c for 2o. build ts 4B1.",
  "itars charge 1pw",
  "terrans charge 1pw",
  "terrans build m 8A9.",
  "itars action qic3. spend 1pw for 1c.",
  "baltaks federation 10A6,9A10,9A11,9A9 fed5.",
  "hadsch-hallas up eco.",
  "terrans pass booster6",
  "itars build ac2 7B1. tech adv-int. cover free2. up terra.",
  "baltaks charge 1pw",
  "baltaks pass booster10",
  "hadsch-hallas federation 10A11,10A10,4A2,4C,4B1,4B3 fed3.",
  "itars build m 2B3.",
  "terrans charge 1pw",
  "hadsch-hallas pass booster7",
  "itars pass booster5",
  "terrans income 4pw",
  "baltaks income 4pw",
  "hadsch-hallas income 4pw. income 1t",
  "itars income 1t. income 1t",
];

const game6 = {
  moveHistory: [
    "init 2 Wet-people-2252",
    "p1 faction ambas",
    "p2 faction bescods",
    "p1 bid ambas 0",
    "p2 bid bescods 0 (0/0/0/0 ⇒ 2/4/0/0)",
    "ambas build m 7B1",
    "bescods build m 7A4",
    "bescods build m 4A10",
    "ambas build m 2B1",
    "bescods booster booster1",
    "ambas booster booster5 (2/4/0/0 ⇒ 0/6/0/0)",
    "ambas up nav (1 ⇒ 2).",
    "bescods build ts 7A4.",
    "ambas charge 1pw (0/6/0/0 ⇒ 0/5/1/0)",
    "ambas build ts 7B1.",
    "bescods charge 2pw (2/4/0/0 ⇒ 0/6/0/0)",
    "bescods build lab 7A4. tech free2. up terra (0 ⇒ 1).",
    "ambas charge 2pw (0/5/1/0 ⇒ 0/3/3/0)",
    "ambas action power6. build m 1A7. (0/3/3/0 ⇒ 3/3/0/0)",
    "bescods charge 1pw (0/6/0/0 ⇒ 0/5/1/0)",
    "bescods build ts 4A10.",
    "ambas charge 1pw (3/3/0/0 ⇒ 2/4/0/0)",
    "ambas build m 1B4.",
    "bescods special up-lowest. up eco (0 ⇒ 1).",
    "ambas special range+3. build m 4B1.",
    "bescods up sci (2 ⇒ 3). (0/5/1/0 ⇒ 0/2/4/0)",
    "ambas build m 7B5.",
    "bescods build m 7B3.",
    "ambas charge 2pw (2/4/0/0 ⇒ 0/6/0/0)",
    "ambas build ts 1A7.",
    "bescods charge 2pw (0/2/4/0 ⇒ 0/0/6/0)",
    "bescods action power4. (0/0/6/0 ⇒ 4/0/2/0)",
    "ambas pass booster8 returning booster5",
    "bescods build lab 4A10. tech eco. up eco (1 ⇒ 2).",
    "ambas charge 2pw (0/6/0/0 ⇒ 0/4/2/0)",
    "bescods pass booster5 returning booster1 (4/0/2/0 ⇒ 0/4/2/0)",
    "ambas build lab 1A7. tech nav. up nav (2 ⇒ 3). (0/4/2/0 ⇒ 0/1/5/0)",
    "bescods charge 2pw (0/4/2/0 ⇒ 0/2/4/0)",
    "bescods special range+3. build m 3A5.",
    "ambas action power5. (0/1/5/0 ⇒ 4/1/1/0)",
    "bescods special up-lowest. up nav (0 ⇒ 1).",
    "ambas special 4pw. (4/1/1/0 ⇒ 0/5/1/0)",
    "bescods action power3. (0/2/4/0 ⇒ 4/2/0/0)",
    "ambas burn 1. spend 2pw for 2c. spend 1q for 1o. build lab 7B1. tech sci. up sci (0 ⇒ 1). (0/5/1/0 ⇒ 2/3/0/0)",
    "bescods charge 2pw (4/2/0/0 ⇒ 2/4/0/0)",
    "bescods up eco (2 ⇒ 3). (2/4/0/0 ⇒ 0/5/1/0)",
    "ambas up sci (1 ⇒ 2).",
    "bescods build m 2A6.",
    "ambas pass booster6 returning booster8",
    "bescods build ts 7B3.",
    "ambas charge 2pw (2/3/0/0 ⇒ 0/5/0/0)",
    "bescods pass booster8 returning booster5 (0/5/1/0 ⇒ 0/2/4/0)",
    "ambas special 4pw. (0/5/0/0 ⇒ 0/1/4/0)",
    "bescods up eco (3 ⇒ 4).",
    "ambas action power6. build m 3A8. (0/1/4/0 ⇒ 3/1/1/0)",
    "bescods special up-lowest. up gaia (0 ⇒ 1).",
    "ambas up nav (3 ⇒ 4).",
    "bescods build lab 7B3. tech gaia. up gaia (1 ⇒ 2). (0/2/4/0 ⇒ 3/2/4/0)",
    "ambas charge 2pw (3/1/1/0 ⇒ 1/3/1/0)",
    "ambas build m 3B0.",
    "bescods action power7. (3/2/4/0 ⇒ 8/2/1/0)",
    "ambas pass booster10 returning booster6",
    "bescods build gf 2A11 using area1: 6. (8/2/1/0 ⇒ 2/2/1/6)",
    "bescods pass booster6 returning booster8 (2/2/1/6 ⇒ 6/1/4/0)",
    "ambas special 4pw. (1/3/1/0 ⇒ 0/1/4/0)",
    "bescods action power3. (6/1/4/0 ⇒ 10/1/0/0)",
    "ambas action power4. (0/1/4/0 ⇒ 4/1/0/0)",
    "bescods build ts 3A5.",
    "ambas build ac1 7B1. tech free3. up terra (0 ⇒ 1).",
    "bescods decline 2pw",
    "bescods build ac1 3A5. tech int. up int (0 ⇒ 1).",
    "ambas build ts 7B5.",
    "bescods decline 2pw",
    "bescods build m 2A11.",
    "ambas charge 1pw (4/1/0/0 ⇒ 3/2/0/0)",
    "ambas build PI 7B5.",
    "bescods decline 2pw",
    "bescods special up-lowest. up nav (1 ⇒ 2).",
    "ambas federation 7B1,7B5,7C fed5 using area1: 1. (3/2/0/0 ⇒ 2/2/0/0)",
    "bescods up gaia (2 ⇒ 3). (10/1/0/0 ⇒ 7/4/0/0)",
    "ambas up terra (1 ⇒ 2).",
    "bescods build gf 7A8 using area1: 4. (7/4/0/0 ⇒ 3/4/0/4)",
    "ambas special swap-PI. swap-PI 3A8.",
    "bescods build gf 5A10 using area1: 3, area2: 1. (3/4/0/4 ⇒ 0/3/0/8)",
    "ambas pass booster1 returning booster10",
    "bescods build ts 2A11.",
    "ambas charge 1pw (2/2/0/0 ⇒ 1/3/0/0)",
    "bescods pass booster8 returning booster6",
    "ambas income 4pw (1/3/0/0 ⇒ 2/1/3/0)",
    "ambas up terra (2 ⇒ 3). (2/1/3/0 ⇒ 0/2/4/0)",
    "bescods build PI 7B3.",
    "ambas charge 2pw (0/2/4/0 ⇒ 0/0/6/0)",
    "ambas build m 3B3. spend 1pw for 1c. (0/0/6/0 ⇒ 1/0/5/0)",
    "bescods decline 4pw",
    "bescods action power6. build m 2B4. (8/0/3/0 ⇒ 11/0/0/0)",
    "ambas charge 1pw (1/0/5/0 ⇒ 0/1/5/0)",
    "ambas build ts 3B3.",
    "bescods decline 4pw",
    "bescods federation 2A11,2B4,2B5,3A5 fed4 using area1: 1. (11/0/0/0 ⇒ 10/0/0/0)",
    "ambas action power4. (0/1/5/0 ⇒ 4/1/1/0)",
    "bescods build m 7A8.",
    "ambas charge 1pw (4/1/1/0 ⇒ 3/2/1/0)",
    "ambas federation 3A8,3B0,3B3,3B4,3B5 fed4 using area1: 2. (3/2/1/0 ⇒ 1/2/1/0)",
    "bescods federation 7A4,7A7,7A8,7B2,7B3 fed4 using area1: 2. (10/0/0/0 ⇒ 8/0/0/0)",
    "ambas special 4pw. (1/2/1/0 ⇒ 0/0/4/0)",
    "bescods build m 5A10.",
    "ambas action power3. (0/0/4/0 ⇒ 4/0/0/0)",
    "bescods up nav (2 ⇒ 3). (8/0/0/0 ⇒ 5/3/0/0)",
    "ambas build ac2 1A7. tech terra. up terra (3 ⇒ 4).",
    "bescods decline 3pw",
    "bescods up nav (3 ⇒ 4).",
    "ambas up nav (4 ⇒ 5). lostPlanet 2A2.",
    "bescods decline 3pw",
    "bescods build gf 6A1 using area1: 4. (5/3/0/0 ⇒ 1/3/0/4)",
    "ambas federation 1A7,1B4,2A2,2B1 fed2.",
    "bescods special up-lowest. up int (1 ⇒ 2).",
    "ambas special q.",
    "bescods action qic2. fedtile fed4.",
    "ambas build lab 3B3. tech adv-nav. cover terra. up int (0 ⇒ 1).",
    "bescods charge 4pw (1/3/0/4 ⇒ 0/1/3/4)",
    "bescods action power7. (0/1/3/4 ⇒ 5/1/0/4)",
    "ambas special swap-PI. swap-PI 4B1.",
    "bescods build gf 3A2 using area1: 4. (5/1/0/4 ⇒ 1/1/0/8)",
    "ambas pass booster6 returning booster1",
    "bescods build lab 2A11. tech free1. up int (2 ⇒ 3). (1/1/0/8 ⇒ 0/0/2/8)",
    "ambas decline 2pw",
    "bescods up int (3 ⇒ 4).",
    "bescods build m 5B3.",
    "bescods action qic3.",
    "bescods pass booster10 returning booster8",
    "ambas income 4pw (4/0/0/0 ⇒ 2/4/0/0)",
    "bescods income 2t (0/0/2/8 ⇒ 8/0/4/0)",
    "ambas special q.",
    "bescods action power3. (8/0/4/0 ⇒ 12/0/0/0)",
    "ambas action qic2. fedtile fed2.",
    "bescods build m 6A1.",
    "ambas build m 4B3.",
    "bescods charge 1pw (12/0/0/0 ⇒ 11/1/0/0)",
    "bescods build m 3A2.",
    "ambas charge 1pw (2/4/0/0 ⇒ 1/5/0/0)",
    "ambas special 4pw. (1/5/0/0 ⇒ 0/3/3/0)",
    "bescods special up-lowest. up terra (1 ⇒ 2).",
    "ambas build m 4B5.",
    "bescods charge 3pw (11/1/0/0 ⇒ 8/4/0/0)",
    "bescods build ts 3A2.",
    "ambas charge 1pw (0/3/3/0 ⇒ 0/2/4/0)",
    "ambas up int (1 ⇒ 2).",
    "bescods build ac2 3A2. tech terra. up terra (2 ⇒ 3). (8/4/0/0 ⇒ 5/7/0/0)",
    "ambas charge 1pw (0/2/4/0 ⇒ 0/1/5/0)",
    "ambas spend 4pw for 1q. action qic1. tech free1. up int (2 ⇒ 3). (0/1/5/0 ⇒ 1/4/1/0)",
    "bescods up eco (4 ⇒ 5). (5/7/0/0 ⇒ 0/11/1/0)",
    "ambas spend 1pw for 1c. spend 2q for 2o. build ts 4B5. (1/4/1/0 ⇒ 2/4/0/0)",
    "bescods charge 3pw (0/11/1/0 ⇒ 0/8/4/0)",
    "bescods special q.",
    "ambas up terra (4 ⇒ 5).",
    "bescods build m 1B0.",
    "ambas charge 1pw (2/4/0/0 ⇒ 1/5/0/0)",
    "ambas up int (3 ⇒ 4).",
    "bescods action power5. (0/8/4/0 ⇒ 4/8/0/0)",
    "ambas up int (4 ⇒ 5).",
    "bescods up terra (3 ⇒ 4).",
    "ambas federation 4B1,4B3,4B5,4C fed5 using area1: 1. (1/5/0/0 ⇒ 0/5/0/0)",
    "bescods build m 6B3.",
    "ambas action qic3.",
    "bescods federation 1A10,1A11,1A6,1B0,1B3,1C,3A2,4A10 fed1 using area1: 4, area2: 1. (4/8/0/0 ⇒ 0/7/0/0)",
    "ambas spend 3q for 3o. build lab 4B5. tech adv-terra. cover free1. up sci (2 ⇒ 3). (0/5/0/0 ⇒ 0/2/3/0)",
    "bescods decline 3pw",
    "bescods spend 1q for 1o. build ts 6A1.",
    "ambas charge 1pw (0/2/3/0 ⇒ 0/1/4/0)",
    "ambas action power4. spend 1q for 1o. spend 1o for 1c. (0/1/4/0 ⇒ 4/1/0/0)",
  ],
  options: {
    layout: "standard" as const,
    auction: AuctionVariant.ChooseBid,
    factionVariant: "beta" as const,
    creator: 1,
    factionVariantVersion: 2,
    map: {
      sectors: [
        {
          sector: "2",
          rotation: 3,
          center: {
            q: 0,
            r: 0,
            s: 0,
          },
        },
        {
          sector: "3",
          rotation: 1,
          center: {
            q: 5,
            r: -2,
            s: -3,
          },
        },
        {
          sector: "1",
          rotation: 5,
          center: {
            q: 2,
            r: 3,
            s: -5,
          },
        },
        {
          sector: "4",
          rotation: 5,
          center: {
            q: -3,
            r: 5,
            s: -2,
          },
        },
        {
          sector: "6B",
          rotation: 0,
          center: {
            q: -5,
            r: 2,
            s: 3,
          },
        },
        {
          sector: "5B",
          rotation: 4,
          center: {
            q: -2,
            r: -3,
            s: 5,
          },
        },
        {
          sector: "7B",
          rotation: 5,
          center: {
            q: 3,
            r: -5,
            s: 2,
          },
        },
      ],
      mirror: false,
    },
  },
};
