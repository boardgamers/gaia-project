import { expect } from "chai";
import Engine, { AuctionVariant } from "./engine";
import { Faction } from "./enums";

describe("auction bid-while-choosing", () => {
  it("should conclude if everyone picks a faction", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
    `);
    const engine = new Engine(moves, { auction: AuctionVariant.BidWhileChoosing });

    expect(engine.players[0].faction).to.equal(Faction.Geodens);
    expect(engine.players[1].faction).to.equal(Faction.Itars);
  });

  it("should allow auction if players bid on the other faction first", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 bid geodens 2
        p1 bid geodens 3
        p2 bid geodens 4
        p1 faction itars
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.BidWhileChoosing });

    expect(engine.players[1].data.bid).to.equal(4);
    expect(engine.players[0].data.bid).to.equal(0);
    expect(engine.players[0].faction).to.equal(Faction.Itars);
    expect(engine.players[1].faction).to.equal(Faction.Geodens);
  });

  it("should throw, wrong bid", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction itars
        p2 bid itars 0
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.throw();
  });

  it("should allow auction, 3 players", () => {
    const moves = Engine.parseMoves(`
        init 3 djfjjv4k
        p1 faction geodens
        p2 faction taklons
        p3 bid geodens 1
        p1 bid geodens 2
        p3 bid taklons 1
        p2 bid geodens 3
        p1 bid geodens 4
        p2 bid geodens 5
        p1 bid taklons 2
        p3 bid geodens 6
        p2 faction itars
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.BidWhileChoosing });

    expect(engine.players[2].data.bid).to.equal(6);
    expect(engine.players[1].data.bid).to.equal(0);
    expect(engine.players[0].data.bid).to.equal(2);

    expect(engine.players[0].faction).to.equal(Faction.Taklons);
    expect(engine.players[1].faction).to.equal(Faction.Itars);
    expect(engine.players[2].faction).to.equal(Faction.Geodens);
  });

  it("should throw auction, faction is not in list", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 bid terrans 1
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.throw();
  });

  it("should throw auction, bid is wrong", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 bid itars 1
        p1 bid itars 1
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.throw();
  });

  it("should throw auction, bid is not in the range", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction itars
        p2 bid itars 1
        p1 bid itars 12
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.throw();
  });

  it("should support auction and then go to building phase", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 bid terrans 1
      p1 bid terrans 2
      p2 bid terrans 3
      p1 faction geodens
      terrans build m -4x2
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.not.throw();
  });

  it("should throw because players are bidding in the wrong order", () => {
    const moves = Engine.parseMoves(`
      init 4 djfjjv4k
      p1 faction geodens
      p2 bid geodens 1
      p4 bid geodens 2
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.throw();
  });

  it("should allow auction, 4 players, right turn order", () => {
    const moves = Engine.parseMoves(`
        init 4 djfjjv4k
        p1 faction itars
        p2 faction taklons
        p3 bid itars 2
        p4 faction terrans
        p1 bid taklons 1
        p2 bid terrans 1
        p4 bid taklons 2
        p1 faction geodens
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.BidWhileChoosing });

    expect(engine.players[0].faction).to.equal(Faction.Geodens);
    expect(engine.players[1].faction).to.equal(Faction.Terrans);
    expect(engine.players[2].faction).to.equal(Faction.Itars);
    expect(engine.players[3].faction).to.equal(Faction.Taklons);
  });

  it("should preserve the order based on auction setup", () => {
    const moves = Engine.parseMoves(`
      init 3 randomSeed
      p1 faction terrans
      p2 faction geodens
      p3 bid terrans 1
      p1 faction ambas
      terrans build m -1x-4
      geodens build m -3x-4
      ambas build m -2x-2
      ambas build m -5x3
      geodens build m -4x1
      terrans build m -5x4
      ambas booster booster1
      geodens booster booster2
      terrans booster booster3
      terrans build ts -1x-4.
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.not.throw();
  });

  it("should throw , wrong leech order based on auction setup", () => {
    const moves = Engine.parseMoves(`
      init 3 randomSeed
      p1 faction terrans
      p2 faction geodens
      p3 bid terrans 1
      p1 faction ambas
      terrans build m -1x-4
      geodens build m -3x-4
      ambas build m -2x-2
      ambas build m -5x3
      geodens build m -4x1
      terrans build m -5x4
      ambas booster booster1
      geodens booster booster2
      terrans booster booster3
      terrans build ts -1x-4.
      ambas charge 1pw
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.BidWhileChoosing })).to.throw();
  });
});
