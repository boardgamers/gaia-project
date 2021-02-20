import { expect } from "chai";
import Engine from "../engine";
import { Command, Player } from "../enums";

const parseMoves = Engine.parseMoves;

describe("Federation", () => {
  it("should allow to form a federation and gain rewards. Gaia phase to test income for terrans", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction bescods
      p1 build m -1x2
      p2 build m -1x-1
      p2 build m 3x-2
      p1 build m -4x2
      p2 booster booster3
      p1 booster booster7
      p1 up gaia.
      p2 build ts -1x-1.
      p1 build gf -2x3.
      p2 build m -1x0.
      p1 charge 1pw
      p1 build ts -1x2.
      p2 charge 1pw
      p2 build m 1x0.
      p1 charge 2pw
      p1 build m -3x4.
      p2 pass booster8
      p1 build PI -1x2.
      p2 charge 1pw
      p1 pass booster3
      p1 income t
      p1 spend 4tg for 1k. spend 2tg for 2c
      p2 burn 3. spend 3pw for 1o. pass booster5
      p1 build m -2x3. spend 2pw for 2c.
      p1 build ts -4x2.
    `);

    const engine = new Engine(moves);
    const data = engine.player(Player.Player1).data;
    const vp = data.victoryPoints;
    const powerTokens = data.discardablePowerTokens();
    engine.move("p1 federation -1x2,-2x3,-3x2,-3x3,-3x4,-4x2 fed2");
    // gets vp for federation and for fed building from roundbooster
    expect(data.victoryPoints).to.equal(vp + 8 + 5);
    expect(data.power.gaia).to.be.gte(0);
    expect(data.satellites).to.equal(2);
    expect(data.discardablePowerTokens()).to.be.equal(
      powerTokens - 2,
      "The 2 satellites should remove one power token each"
    );

    // Test other federation with the same buildings
    expect(() => new Engine([...moves, "p1 federation -1x2,-2x3,-3x3,-3x4,-4x2,-4x3 fed2"])).to.not.throw();
  });

  it("should offer one choice for Ivits in this game", () => {
    const moves = [
      "init 4 2021-02-08-01",
      "p4 rotate -2x-3 3 -1x8 2 -6x10 4",
      "p1 faction ambas",
      "p2 faction ivits",
      "p3 faction terrans",
      "p4 faction firaks",
      "ambas build m 7A7",
      "terrans build m 10A6",
      "firaks build m 8B0",
      "firaks build m 7A0",
      "terrans build m 4A4",
      "ambas build m 4B2",
      "ivits build PI 10A5",
      "firaks booster booster4",
      "terrans booster booster1",
      "ivits booster booster9",
      "ambas booster booster5",
      "ivits income 4pw. income 4pw",
      "ambas special range+3. build m 10B1.",
      "ivits charge 2pw",
      "ivits action power3.",
      "terrans build gf 1A9.",
      "firaks build ts 7A0.",
      "ambas charge 1pw",
      "terrans charge 1pw",
      "ambas build ts 4B2.",
      "terrans charge 1pw",
      "firaks charge 2pw",
      "ivits build m 7B5.",
      "firaks charge 2pw",
      "ambas charge 1pw",
      "terrans build ts 4A4.",
      "firaks charge 2pw",
      "ambas charge 2pw",
      "firaks action power4.",
      "ambas action power5.",
      "ivits build ts 7B5.",
      "firaks charge 2pw",
      "ambas charge 1pw",
      "terrans up gaia.",
      "firaks build lab 7A0. tech free2. up terra.",
      "ambas charge 2pw",
      "ivits charge 2pw",
      "terrans charge 2pw",
      "ambas build lab 4B2. tech free2. up terra.",
      "terrans charge 2pw",
      "firaks charge 2pw",
      "ivits build lab 7B5. tech free2. up terra.",
      "firaks charge 2pw",
      "ambas charge 1pw",
      "terrans build PI 4A4.",
      "firaks charge 2pw",
      "ambas charge 2pw",
      "firaks build ts 8B0.",
      "ambas charge 1pw",
      "ivits charge 3pw",
      "terrans charge 1pw",
      "ambas spend 3pw for 1o. burn 1. spend 1pw for 1c. build ac1 4B2. tech nav. up nav.",
      "terrans charge 1pw",
      "firaks charge 2pw",
      "ivits special space-station. build sp 7C.",
      "terrans spend 2pw for 2c. pass booster8",
      "firaks spend 3pw for 1o. spend 3pw for 1o. build PI 8B0.",
      "ambas charge 1pw",
      "ivits charge 3pw",
      "terrans charge 1pw",
      "ambas up terra.",
      "ivits spend 1pw for 1c. spend 6pw for 2o. build ac1 7B5. tech nav. up nav.",
      "firaks charge 2pw",
      "ambas charge 1pw",
      "firaks special down-lab. build ts 7A0. up nav.",
      "ambas charge 3pw",
      "ivits charge 3pw",
      "terrans charge 3pw",
      "ambas pass booster10",
      "ivits up terra.",
      "firaks up nav.",
      "ivits pass booster1",
      "firaks spend 1q for 1o. build m 7B1.",
      "ivits charge 3pw",
      "firaks spend 1q for 1o. special step. build m 9A10.",
      "firaks pass booster9",
      "terrans income 1t",
      "ivits income 4pw",
      "firaks income 4pw. income 4pw",
      "terrans spend 3tg for 1o. spend 3tg for 3c",
      "terrans action power5.",
      "ambas up terra.",
      "ivits burn 2. action power4.",
      "firaks action power3.",
      "terrans build m 1A9.",
      "firaks charge 2pw",
      "ambas charge 1pw",
      "ambas action power2. build m 1A11.",
      "terrans charge 1pw",
      "ivits build m 7B3.",
      "firaks charge 1pw",
      "ambas charge 1pw",
      "firaks build lab 7A0. tech nav. up nav.",
      "ambas charge 3pw",
      "ivits charge 3pw",
      "terrans charge 3pw",
      "terrans build ts 10A6.",
      "firaks charge 3pw",
      "ivits charge 3pw",
      "ambas build m 6A0.",
      "ivits charge 1pw",
      "ivits up terra. spend 3pw for 1o.",
      "firaks spend 1pw for 1c. build m 9B0.",
      "terrans build m 1B4.",
      "firaks charge 2pw",
      "ambas charge 1pw",
      "ambas pass booster5",
      "ivits build ts 7B3.",
      "firaks charge 1pw",
      "ambas charge 1pw",
      "firaks special down-lab. build ts 7A0. up sci.",
      "ambas decline 3pw",
      "ivits charge 3pw",
      "terrans charge 3pw",
      "terrans up terra.",
      "ivits spend 3pw for 1o. spend 2q for 2o. build lab 7B3. tech terra. up terra.",
      "firaks charge 1pw",
      "ambas charge 1pw",
      "firaks spend 2pw for 2c. build m 9B2.",
      "terrans spend 1pw for 1c. build lab 10A6. tech gaia. up gaia.",
      "firaks decline 3pw",
      "ivits charge 3pw",
      "ivits special 4pw.",
      "firaks pass booster10",
      "terrans build gf 8A10.",
      "ivits special space-station. build sp 10A4.",
      "terrans spend 4pw for 4c. build gf 5A2.",
      "ivits spend 3pw for 1o. spend 1pw for 1c. pass booster9",
      "terrans pass booster1",
      "firaks income 4pw",
      "ivits income 4pw. income 4pw",
      "terrans income 1t",
      "terrans spend 3tg for 3c. spend 3tg for 1o. spend 2tg for 2c",
      "ambas action power3.",
      "firaks action power4.",
      "ivits federation 10A4,10A5,7A9,7B3,7B5,7C fed5.",
      "terrans build m 5A2.",
      "ivits charge 3pw",
      "ambas up nav.",
      "firaks build ts 7B1.",
      "ivits charge 1pw",
      "ivits spend 3pw for 1o. up terra.",
      "terrans build ts 1A9.",
      "firaks decline 2pw",
      "ambas charge 3pw",
      "ambas special range+3. build m 1B2.",
      "terrans charge 1pw",
      "firaks federation 7A0,7A1,7A2,7B1,9A10,9A11,9B0,9B1,9B2 fed4.",
      "ivits build ac2 7B3. tech adv-terra. cover free2. up nav.",
      "firaks charge 2pw",
      "ambas charge 1pw",
      "terrans spend 3pw for 1o. spend 1pw for 1c. build lab 1A9. tech eco. up eco.",
      "firaks charge 1pw",
      "ambas charge 2pw",
      "ambas spend 1pw for 1c. build ts 1A11.",
      "terrans charge 2pw",
      "firaks build lab 7B1. tech free3. up nav. spend 3pw for 1o.",
      "ivits charge 3pw",
      "ivits spend 1pw for 1c. special 4pw. spend 3pw for 1o.",
      "terrans federation 1A9,1B4,4A4 fed4.",
      "ambas build ts 1B2.",
      "terrans charge 1pw",
      "firaks up nav. lostPlanet 10A8.",
      "terrans charge 2pw",
      "ivits special space-station. build sp 8B5.",
      "terrans up nav.",
      "ambas action power7.",
      "firaks up sci.",
      "ivits build m 5A3.",
      "terrans charge 2pw",
      "terrans spend 2pw for 2c. build m 8A10.",
      "firaks decline 3pw",
      "ivits charge 3pw",
      "ambas federation 1A10,1A11,1B2,1B5,1C,4A3,4B2 fed5.",
      "firaks special down-lab. build ts 7B1. up sci.",
      "ivits charge 3pw",
      "ivits spend 3pw for 1o. spend 3pw for 1o. build m 8A8.",
      "terrans charge 1pw",
      "terrans build gf 6A9.",
      "ambas build m 6B1.",
      "firaks build m 2A6.",
      "ivits special q.",
      "terrans pass booster8",
      "ambas build m 10B4.",
      "ivits charge 3pw",
      "terrans charge 2pw",
      "firaks charge 1pw",
      "firaks spend 2pw for 2c. pass booster7",
    ];

    const engine = new Engine(moves, { advancedRules: true });

    engine.generateAvailableCommands();

    expect(engine.findAvailableCommand(Player.Player2, Command.FormFederation)).to.not.be.undefined;
    expect(engine.findAvailableCommand(Player.Player2, Command.FormFederation).data.federations.length).to.equal(1);
  });
});
