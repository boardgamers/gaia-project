import { expect } from "chai";
import Engine, { EngineOptions } from "../engine";
import { Player, Federation } from "../enums";

const parseMoves = Engine.parseMoves;

describe("gleens", () => {
  it("should grant gleens an ore instead of qic when upgrading navigation without an academy", () => {
    const engine = new Engine(
      parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster5
      p1 build m -5x0.
    `)
    );

    const range = engine.player(Player.Player2).data.range;

    engine.move("p2 up nav");

    expect(engine.player(Player.Player2).data.range).to.equal(range + 1);
  });

  it("should allow Gleens to get the faction federation", () => {
    const moves = parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction gleens
      p1 build m -4x-1
      p2 build m -7x3
      p2 build m -5x5
      p1 build m -3x4
      p2 booster booster4
      p1 booster booster5
      p1 build m -5x0.
      p2 build ts -5x5.
      p1 charge 1pw
      p1 build m -4x2.
      p2 build PI -5x5.
      p1 charge 1pw
    `);

    const engine = new Engine(moves);
    const data = engine.player(Player.Player2).data;

    // tslint:disable-next-line no-unused-expression
    expect(data.tiles.federations.some((fed) => fed.tile === Federation.Gleens)).to.be.true;
  });

  it("should grant gleens two victory points when building a mine on a gaia planet", () => {
    const engine = new Engine(
      parseMoves(`
      init 2 randomSeed
      p1 faction gleens
      p2 faction terrans
      p1 build m -2x2
      p2 build m -1x2
      p2 build m -3x4
      p1 build m 1x2
      p2 booster booster3
      p1 booster booster4
      p1 up gaia.
      p2 pass booster5
      p1 build gf -2x3.
      p1 pass booster3
      p2 pass booster4
    `)
    );

    const vp = engine.player(Player.Player1).data.victoryPoints;
    engine.move("p1 build m -2x3");
    expect(engine.player(Player.Player1).data.victoryPoints).to.equal(vp + 2);
  });

  it("should only grant two vps when building a mine on a gaia planet on the website", () => {
    const moves = parseMoves(`
      init 3 timid-front-3625
      p1 faction lantids
      p2 faction bescods
      p3 faction gleens
      lantids build m 0x2
      bescods build m -3x6
      gleens build m 4x0
      gleens build m -8x8
      bescods build m 2x1
      lantids build m -3x9
      gleens booster booster5
      bescods booster booster6
      lantids booster booster9
      lantids build ts 0x2.
      bescods charge 1pw
      bescods build ts 2x1.
      gleens charge 1pw
      lantids charge 2pw
      gleens build ts 4x0.
      bescods charge 2pw
      lantids up nav.
      bescods special up-lowest. up nav.
      gleens up nav.
      lantids build lab 0x2. tech free2. up nav.
      bescods charge 2pw
      bescods build lab 2x1. tech free2. up nav.
      gleens charge 2pw
      lantids charge 2pw
      gleens build m 3x2.
    `);

    const options: EngineOptions = {
      map: {
        sectors: [
          { sector: "1", rotation: 3 },
          { sector: "7A", rotation: 1 },
          { sector: "3", rotation: 5 },
          { sector: "4", rotation: 1 },
          { sector: "8", rotation: 1 },
          { sector: "9", rotation: 3 },
          { sector: "5A", rotation: 5 },
          { sector: "2", rotation: 3 },
          { sector: "6A", rotation: 3 },
          { sector: "10", rotation: 2 },
        ],
      },
    };

    expect(Engine.slowMotion(moves.slice(0, -1), options).player(Player.Player3).data.victoryPoints).to.equal(9);
    // 4vp scoring + 2vp gleens
    expect(Engine.slowMotion(moves, options).player(Player.Player3).data.victoryPoints).to.equal(15);
  });
});
