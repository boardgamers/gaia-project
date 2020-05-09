import {expect} from "chai";
import Engine from "./engine";
import { Command } from "./enums";

describe("Federations", () => {
  it("should show the 21 options with flexible federation rules", function() {
    this.timeout(10000);
    const engine = new Engine(game(), {flexibleFederations: true});

    expect(engine.findAvailableCommand(engine.playerToMove, Command.FormFederation).data.federations).to.have.length(21);
  });

  it("should show 15 options with regular federation rules", function() {
    this.timeout(10000);
    const engine = new Engine(game());

    expect(engine.findAvailableCommand(engine.playerToMove, Command.FormFederation).data.federations).to.have.length(15);

    // This extra long federation should not work
    expect(() => engine.move('gleens federation 0x1,0x0,0x-1,-1x-1,-1x-2,-1x-3,-2x-3,-3x-2,-3x-1,-3x0,-1x1,-2x2 fed6.')).to.throw();
  });

  it("should not allow unnecessary mines if there's a PI and AC with 4pw each", function() {
    this.timeout(10000);
    const engine = new Engine(game2.moveHistory, game2.options);

    expect(() => engine.move('ambas federation -2x3,-2x2,-1x1,0x0 fed3.')).to.throw();
  });
});

const game = () => Engine.parseMoves(`
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
            s: 0
          }
        },
        {
          sector: "6B",
          rotation: 1,
          center: {
            q: 5,
            r: -2,
            s: -3
          }
        },
        {
          sector: "2",
          rotation: 0,
          center: {
            q: 2,
            r: 3,
            s: -5
          }
        },
        {
          sector: "7B",
          rotation: 2,
          center: {
            q: -3,
            r: 5,
            s: -2
          }
        },
        {
          sector: "4",
          rotation: 4,
          center: {
            q: -5,
            r: 2,
            s: 3
          }
        },
        {
          sector: "3",
          rotation: 3,
          center: {
            q: -2,
            r: -3,
            s: 5
          }
        },
        {
          sector: "1",
          rotation: 0,
          center: {
            q: 3,
            r: -5,
            s: 2
          }
        }
      ],
    }
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
    "ivits spend 1pw for 1c. special 3o."
  ]
};
