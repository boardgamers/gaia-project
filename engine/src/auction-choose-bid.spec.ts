import { expect } from "chai";
import { generate } from "./available/available-command";
import Engine, { AuctionVariant } from "./engine";
import { Faction } from "./enums";

describe("auction choose-bid", () => {
  it("should allow auction, everyone is fine wiht the current", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid geodens 1
        p2 bid itars 1
    `);
    const engine = new Engine(moves, { auction: AuctionVariant.ChooseBid });

    expect(engine.players[0].faction).to.equal(Faction.Geodens);
    expect(engine.players[1].faction).to.equal(Faction.Itars);
  });

  it("should allow auction, geodens are good", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid geodens 1
        p2 bid geodens 2
        p1 bid geodens 3
        p2 bid geodens 4
        p1 bid itars 1
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.ChooseBid });

    expect(engine.players[1].data.bid).to.equal(4);
    expect(engine.players[0].data.bid).to.equal(1);
    expect(engine.players[0].faction).to.equal(Faction.Itars);
    expect(engine.players[1].faction).to.equal(Faction.Geodens);
  });

  it("should allow auction, everyone is fine wiht the current", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 0
        p2 bid geodens 0
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.not.throw();
  });

  it("should throw, wrong bid", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 0
        p2 bid itars 0
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.throw();
  });

  it("should allow auction, 3 players", () => {
    const moves = Engine.parseMoves(`
        init 3 djfjjv4k
        p1 faction geodens
        p2 faction taklons
        p3 faction itars
        p1 bid geodens 1
        p2 bid geodens 2
        p3 bid taklons 1
        p1 bid geodens 3
        p2 bid geodens 4
        p1 bid geodens 5
        p2 bid taklons 2
        p3 bid geodens 6
        p1 bid itars 1
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.ChooseBid });

    expect(engine.players[2].data.bid).to.equal(6);
    expect(engine.players[1].data.bid).to.equal(2);
    expect(engine.players[0].data.bid).to.equal(1);

    expect(engine.players[0].faction).to.equal(Faction.Itars);
    expect(engine.players[1].faction).to.equal(Faction.Taklons);
    expect(engine.players[2].faction).to.equal(Faction.Geodens);
  });

  it("should throw auction, faction is not in list", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 1
        p2 bid terrans 1
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.throw();
  });

  it("should throw auction, bid is wrong", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 1
        p2 bid itars 1
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.throw();
  });

  it("should throw auction, bid is not in the range", () => {
    const moves = Engine.parseMoves(`
        init 2 djfjjv4k
        p1 faction geodens
        p2 faction itars
        p1 bid itars 1
        p2 bid itars 12
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.throw();
  });

  it("should support auction and then go to building phase", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction geodens
      p1 bid terrans 1
      p2 bid terrans 2
      p1 bid terrans 3
      p2 bid terrans 4
      p1 bid geodens 1
      terrans build m -4x2
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.not.throw();
  });

  it("should throw because players are bidding in the wrong order", () => {
    const moves = Engine.parseMoves(`
      init 4 djfjjv4k
      p1 faction geodens
      p2 faction taklons
      p3 faction itars
      p4 faction terrans
      p1 bid itars 1
      p2 bid terrans 1
      p3 bid itars 2
      p4 bid terrans 2
      p2 bid terrans 3
    `);

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.throw();
  });

  it("should allow auction, 4 players, right turn order", () => {
    const moves = Engine.parseMoves(`
        init 4 djfjjv4k
        p1 faction geodens
        p2 faction taklons
        p3 faction itars
        p4 faction terrans
        p1 bid itars 1
        p2 bid terrans 1
        p3 bid itars 2
        p4 bid terrans 2
        p1 bid geodens 1
        p2 bid terrans 3
        p4 bid taklons 1
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.ChooseBid });

    expect(engine.players[0].faction).to.equal(Faction.Geodens);
    expect(engine.players[1].faction).to.equal(Faction.Terrans);
    expect(engine.players[2].faction).to.equal(Faction.Itars);
    expect(engine.players[3].faction).to.equal(Faction.Taklons);
  });

  it("should throw , wrong leech order based on auction setup", () => {
    const moves = Engine.parseMoves(`
      init 3 randomSeed
      p1 faction terrans
      p2 faction geodens
      p3 faction ambas
      p1 bid ambas 0
      p2 bid geodens 0
      p3 bid terrans 0
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

    expect(() => new Engine(moves, { auction: AuctionVariant.ChooseBid })).to.throw();
  });
});

// LEGACY: ensure backwards compatibility
describe("legacy engine", () => {
  it("should move to building after picking factions", () => {
    const moves = Engine.parseMoves(`
      init 2 randomSeed
      p1 faction terrans
      p2 faction geodens
      terrans build m -4x2
    `);

    expect(() => new Engine(moves, { auction: false }, "4.6.10")).to.not.throw();
  });

  it("should be able to continue a legacy non-auction game", () => {
    const legacyGame = `{"players":[{"player":0,"faction":null,"data":{"victoryPoints":10,"bid":0,"credits":0,"ores":0,"qics":0,"knowledge":0,"power":{"area1":0,"area2":0,"area3":0,"gaia":0},"research":{"terra":0,"nav":0,"int":0,"gaia":0,"eco":0,"sci":0},"range":1,"gaiaformers":0,"gaiaformersInGaia":0,"terraformCostDiscount":0,"tiles":{"booster":null,"techs":[],"federations":[]},"satellites":0,"brainstone":null,"tokenModifier":1,"buildings":{"m":0,"ts":0,"lab":0,"PI":0,"ac1":0,"ac2":0,"gf":0,"sp":0},"federationCount":0,"lostPlanet":0},"settings":{"autoChargePower":1,"autoIncome":false,"autoBrainstone":false,"itarsAutoChargeToArea3":false},"events":{">":[],"+":[],">>":[],"=>":[],"|":[],"PA->4pw":[]}},{"player":1,"faction":null,"data":{"victoryPoints":10,"bid":0,"credits":0,"ores":0,"qics":0,"knowledge":0,"power":{"area1":0,"area2":0,"area3":0,"gaia":0},"research":{"terra":0,"nav":0,"int":0,"gaia":0,"eco":0,"sci":0},"range":1,"gaiaformers":0,"gaiaformersInGaia":0,"terraformCostDiscount":0,"tiles":{"booster":null,"techs":[],"federations":[]},"satellites":0,"brainstone":null,"tokenModifier":1,"buildings":{"m":0,"ts":0,"lab":0,"PI":0,"ac1":0,"ac2":0,"gf":0,"sp":0},"federationCount":0,"lostPlanet":0},"settings":{"autoChargePower":1,"autoIncome":false,"autoBrainstone":false,"itarsAutoChargeToArea3":false},"events":{">":[],"+":[],">>":[],"=>":[],"|":[],"PA->4pw":[]}},{"player":2,"faction":null,"data":{"victoryPoints":10,"bid":0,"credits":0,"ores":0,"qics":0,"knowledge":0,"power":{"area1":0,"area2":0,"area3":0,"gaia":0},"research":{"terra":0,"nav":0,"int":0,"gaia":0,"eco":0,"sci":0},"range":1,"gaiaformers":0,"gaiaformersInGaia":0,"terraformCostDiscount":0,"tiles":{"booster":null,"techs":[],"federations":[]},"satellites":0,"brainstone":null,"tokenModifier":1,"buildings":{"m":0,"ts":0,"lab":0,"PI":0,"ac1":0,"ac2":0,"gf":0,"sp":0},"federationCount":0,"lostPlanet":0},"settings":{"autoChargePower":1,"autoIncome":false,"autoBrainstone":false,"itarsAutoChargeToArea3":false},"events":{">":[],"+":[],">>":[],"=>":[],"|":[],"PA->4pw":[]}}],"setup":["hadsch-hallas","baltaks"],"options":{"map":{"sectors":[{"sector":"3","rotation":3,"center":{"q":0,"r":0,"s":0}},{"sector":"5A","rotation":4,"center":{"q":5,"r":-2,"s":-3}},{"sector":"8","rotation":1,"center":{"q":2,"r":3,"s":-5}},{"sector":"9","rotation":1,"center":{"q":-3,"r":5,"s":-2}},{"sector":"6A","rotation":3,"center":{"q":-5,"r":2,"s":3}},{"sector":"4","rotation":5,"center":{"q":-2,"r":-3,"s":5}},{"sector":"2","rotation":0,"center":{"q":3,"r":-5,"s":2}},{"sector":"10","rotation":2,"center":{"q":-1,"r":8,"s":-7}},{"sector":"1","rotation":0,"center":{"q":-6,"r":10,"s":-4}},{"sector":"7A","rotation":3,"center":{"q":-8,"r":7,"s":1}}],"mirror":false}},"tiles":{"boosters":{"booster7":true,"booster1":true,"booster3":true,"booster2":true,"booster6":true,"booster8":true},"techs":{"terra":{"tile":"tech1","count":4},"nav":{"tile":"tech3","count":4},"int":{"tile":"tech2","count":4},"gaia":{"tile":"tech7","count":4},"eco":{"tile":"tech4","count":4},"sci":{"tile":"tech9","count":4},"free1":{"tile":"tech8","count":4},"free2":{"tile":"tech6","count":4},"free3":{"tile":"tech5","count":4},"adv-terra":{"tile":"advtech12","count":1},"adv-nav":{"tile":"advtech2","count":1},"adv-int":{"tile":"advtech6","count":1},"adv-gaia":{"tile":"advtech13","count":1},"adv-eco":{"tile":"advtech11","count":1},"adv-sci":{"tile":"advtech14","count":1}},"scorings":{"round":["score8","score6","score5","score1","score2","score4"],"final":["satellite","sector"]},"federations":{"fed1":3,"fed2":3,"fed3":2,"fed4":3,"fed5":3,"fed6":3}},"boardActions":{"power1":null,"power2":null,"power3":null,"power4":null,"power5":null,"power6":null,"power7":null,"qic1":null,"qic2":null,"qic3":null},"availableCommands":[{"name":"faction","player":2,"data":["terrans","lantids","xenos","gleens","taklons","ambas","firaks","bescods","nevlas","itars"]}],"phase":"setupFaction","subPhase":"beforeMove","round":0,"turnOrder":[],"tempTurnOrder":[],"leechSources":[],"moveHistory":["init 3 12","p1 faction hadsch-hallas","p2 faction baltaks"],"advancedLog":[{"player":0,"move":1},{"player":1,"move":2}],"turnMoves":[],"newTurn":true,"version":"4.6.10","terraformingFederation":"fed3","currentPlayer":2,"availableCommand":null,"oldPhase":"setupFaction","processedPlayer":1,"map":[{"q":-2,"r":0,"s":2,"data":{"planet":"m","sector":"3"}},{"q":-1,"r":-1,"s":2,"data":{"planet":"e","sector":"3"}},{"q":0,"r":-2,"s":2,"data":{"planet":"e","sector":"3"}},{"q":1,"r":-2,"s":1,"data":{"planet":"e","sector":"3"}},{"q":2,"r":-2,"s":0,"data":{"planet":"e","sector":"3"}},{"q":2,"r":-1,"s":-1,"data":{"planet":"r","sector":"3"}},{"q":2,"r":0,"s":-2,"data":{"planet":"d","sector":"3"}},{"q":1,"r":1,"s":-2,"data":{"planet":"e","sector":"3"}},{"q":0,"r":2,"s":-2,"data":{"planet":"e","sector":"3"}},{"q":-1,"r":2,"s":-1,"data":{"planet":"t","sector":"3"}},{"q":-2,"r":2,"s":0,"data":{"planet":"e","sector":"3"}},{"q":-2,"r":1,"s":1,"data":{"planet":"e","sector":"3"}},{"q":-1,"r":0,"s":1,"data":{"planet":"e","sector":"3"}},{"q":0,"r":-1,"s":1,"data":{"planet":"g","sector":"3"}},{"q":1,"r":-1,"s":0,"data":{"planet":"e","sector":"3"}},{"q":1,"r":0,"s":-1,"data":{"planet":"e","sector":"3"}},{"q":0,"r":1,"s":-1,"data":{"planet":"i","sector":"3"}},{"q":-1,"r":1,"s":0,"data":{"planet":"e","sector":"3"}},{"q":0,"r":0,"s":0,"data":{"planet":"e","sector":"3"}},{"q":5,"r":-4,"s":-1,"data":{"planet":"i","sector":"5A"}},{"q":6,"r":-4,"s":-2,"data":{"planet":"e","sector":"5A"}},{"q":7,"r":-4,"s":-3,"data":{"planet":"e","sector":"5A"}},{"q":7,"r":-3,"s":-4,"data":{"planet":"e","sector":"5A"}},{"q":7,"r":-2,"s":-5,"data":{"planet":"e","sector":"5A"}},{"q":6,"r":-1,"s":-5,"data":{"planet":"v","sector":"5A"}},{"q":5,"r":0,"s":-5,"data":{"planet":"d","sector":"5A"}},{"q":4,"r":0,"s":-4,"data":{"planet":"e","sector":"5A"}},{"q":3,"r":0,"s":-3,"data":{"planet":"e","sector":"5A"}},{"q":3,"r":-1,"s":-2,"data":{"planet":"o","sector":"5A"}},{"q":3,"r":-2,"s":-1,"data":{"planet":"m","sector":"5A"}},{"q":4,"r":-3,"s":-1,"data":{"planet":"e","sector":"5A"}},{"q":5,"r":-3,"s":-2,"data":{"planet":"e","sector":"5A"}},{"q":6,"r":-3,"s":-3,"data":{"planet":"g","sector":"5A"}},{"q":6,"r":-2,"s":-4,"data":{"planet":"e","sector":"5A"}},{"q":5,"r":-1,"s":-4,"data":{"planet":"e","sector":"5A"}},{"q":4,"r":-1,"s":-3,"data":{"planet":"e","sector":"5A"}},{"q":4,"r":-2,"s":-2,"data":{"planet":"e","sector":"5A"}},{"q":5,"r":-2,"s":-3,"data":{"planet":"e","sector":"5A"}},{"q":2,"r":5,"s":-7,"data":{"planet":"r","sector":"8"}},{"q":1,"r":5,"s":-6,"data":{"planet":"e","sector":"8"}},{"q":0,"r":5,"s":-5,"data":{"planet":"e","sector":"8"}},{"q":0,"r":4,"s":-4,"data":{"planet":"e","sector":"8"}},{"q":0,"r":3,"s":-3,"data":{"planet":"e","sector":"8"}},{"q":1,"r":2,"s":-3,"data":{"planet":"m","sector":"8"}},{"q":2,"r":1,"s":-3,"data":{"planet":"e","sector":"8"}},{"q":3,"r":1,"s":-4,"data":{"planet":"e","sector":"8"}},{"q":4,"r":1,"s":-5,"data":{"planet":"e","sector":"8"}},{"q":4,"r":2,"s":-6,"data":{"planet":"e","sector":"8"}},{"q":4,"r":3,"s":-7,"data":{"planet":"m","sector":"8"}},{"q":3,"r":4,"s":-7,"data":{"planet":"e","sector":"8"}},{"q":2,"r":4,"s":-6,"data":{"planet":"i","sector":"8"}},{"q":1,"r":4,"s":-5,"data":{"planet":"e","sector":"8"}},{"q":1,"r":3,"s":-4,"data":{"planet":"v","sector":"8"}},{"q":2,"r":2,"s":-4,"data":{"planet":"e","sector":"8"}},{"q":3,"r":2,"s":-5,"data":{"planet":"t","sector":"8"}},{"q":3,"r":3,"s":-6,"data":{"planet":"e","sector":"8"}},{"q":2,"r":3,"s":-5,"data":{"planet":"e","sector":"8"}},{"q":-3,"r":7,"s":-4,"data":{"planet":"e","sector":"9"}},{"q":-4,"r":7,"s":-3,"data":{"planet":"v","sector":"9"}},{"q":-5,"r":7,"s":-2,"data":{"planet":"e","sector":"9"}},{"q":-5,"r":6,"s":-1,"data":{"planet":"e","sector":"9"}},{"q":-5,"r":5,"s":0,"data":{"planet":"s","sector":"9"}},{"q":-4,"r":4,"s":0,"data":{"planet":"e","sector":"9"}},{"q":-3,"r":3,"s":0,"data":{"planet":"e","sector":"9"}},{"q":-2,"r":3,"s":-1,"data":{"planet":"e","sector":"9"}},{"q":-1,"r":3,"s":-2,"data":{"planet":"e","sector":"9"}},{"q":-1,"r":4,"s":-3,"data":{"planet":"e","sector":"9"}},{"q":-1,"r":5,"s":-4,"data":{"planet":"i","sector":"9"}},{"q":-2,"r":6,"s":-4,"data":{"planet":"m","sector":"9"}},{"q":-3,"r":6,"s":-3,"data":{"planet":"e","sector":"9"}},{"q":-4,"r":6,"s":-2,"data":{"planet":"e","sector":"9"}},{"q":-4,"r":5,"s":-1,"data":{"planet":"t","sector":"9"}},{"q":-3,"r":4,"s":-1,"data":{"planet":"e","sector":"9"}},{"q":-2,"r":4,"s":-2,"data":{"planet":"g","sector":"9"}},{"q":-2,"r":5,"s":-3,"data":{"planet":"e","sector":"9"}},{"q":-3,"r":5,"s":-2,"data":{"planet":"e","sector":"9"}},{"q":-7,"r":2,"s":5,"data":{"planet":"e","sector":"6A"}},{"q":-6,"r":1,"s":5,"data":{"planet":"e","sector":"6A"}},{"q":-5,"r":0,"s":5,"data":{"planet":"e","sector":"6A"}},{"q":-4,"r":0,"s":4,"data":{"planet":"e","sector":"6A"}},{"q":-3,"r":0,"s":3,"data":{"planet":"e","sector":"6A"}},{"q":-3,"r":1,"s":2,"data":{"planet":"e","sector":"6A"}},{"q":-3,"r":2,"s":1,"data":{"planet":"e","sector":"6A"}},{"q":-4,"r":3,"s":1,"data":{"planet":"m","sector":"6A"}},{"q":-5,"r":4,"s":1,"data":{"planet":"d","sector":"6A"}},{"q":-6,"r":4,"s":2,"data":{"planet":"e","sector":"6A"}},{"q":-7,"r":4,"s":3,"data":{"planet":"e","sector":"6A"}},{"q":-7,"r":3,"s":4,"data":{"planet":"m","sector":"6A"}},{"q":-6,"r":2,"s":4,"data":{"planet":"e","sector":"6A"}},{"q":-5,"r":1,"s":4,"data":{"planet":"s","sector":"6A"}},{"q":-4,"r":1,"s":3,"data":{"planet":"e","sector":"6A"}},{"q":-4,"r":2,"s":2,"data":{"planet":"g","sector":"6A"}},{"q":-5,"r":3,"s":2,"data":{"planet":"e","sector":"6A"}},{"q":-6,"r":3,"s":3,"data":{"planet":"r","sector":"6A"}},{"q":-5,"r":2,"s":3,"data":{"planet":"e","sector":"6A"}},{"q":0,"r":-5,"s":5,"data":{"planet":"t","sector":"4"}},{"q":0,"r":-4,"s":4,"data":{"planet":"e","sector":"4"}},{"q":0,"r":-3,"s":3,"data":{"planet":"e","sector":"4"}},{"q":-1,"r":-2,"s":3,"data":{"planet":"i","sector":"4"}},{"q":-2,"r":-1,"s":3,"data":{"planet":"e","sector":"4"}},{"q":-3,"r":-1,"s":4,"data":{"planet":"e","sector":"4"}},{"q":-4,"r":-1,"s":5,"data":{"planet":"e","sector":"4"}},{"q":-4,"r":-2,"s":6,"data":{"planet":"e","sector":"4"}},{"q":-4,"r":-3,"s":7,"data":{"planet":"r","sector":"4"}},{"q":-3,"r":-4,"s":7,"data":{"planet":"e","sector":"4"}},{"q":-2,"r":-5,"s":7,"data":{"planet":"e","sector":"4"}},{"q":-1,"r":-5,"s":6,"data":{"planet":"e","sector":"4"}},{"q":-1,"r":-4,"s":5,"data":{"planet":"o","sector":"4"}},{"q":-1,"r":-3,"s":4,"data":{"planet":"e","sector":"4"}},{"q":-2,"r":-2,"s":4,"data":{"planet":"v","sector":"4"}},{"q":-3,"r":-2,"s":5,"data":{"planet":"e","sector":"4"}},{"q":-3,"r":-3,"s":6,"data":{"planet":"s","sector":"4"}},{"q":-2,"r":-4,"s":6,"data":{"planet":"e","sector":"4"}},{"q":-2,"r":-3,"s":5,"data":{"planet":"e","sector":"4"}},{"q":5,"r":-5,"s":0,"data":{"planet":"t","sector":"2"}},{"q":4,"r":-4,"s":0,"data":{"planet":"v","sector":"2"}},{"q":3,"r":-3,"s":0,"data":{"planet":"e","sector":"2"}},{"q":2,"r":-3,"s":1,"data":{"planet":"e","sector":"2"}},{"q":1,"r":-3,"s":2,"data":{"planet":"e","sector":"2"}},{"q":1,"r":-4,"s":3,"data":{"planet":"o","sector":"2"}},{"q":1,"r":-5,"s":4,"data":{"planet":"e","sector":"2"}},{"q":2,"r":-6,"s":4,"data":{"planet":"m","sector":"2"}},{"q":3,"r":-7,"s":4,"data":{"planet":"e","sector":"2"}},{"q":4,"r":-7,"s":3,"data":{"planet":"d","sector":"2"}},{"q":5,"r":-7,"s":2,"data":{"planet":"e","sector":"2"}},{"q":5,"r":-6,"s":1,"data":{"planet":"e","sector":"2"}},{"q":4,"r":-5,"s":1,"data":{"planet":"e","sector":"2"}},{"q":3,"r":-4,"s":1,"data":{"planet":"e","sector":"2"}},{"q":2,"r":-4,"s":2,"data":{"planet":"s","sector":"2"}},{"q":2,"r":-5,"s":3,"data":{"planet":"e","sector":"2"}},{"q":3,"r":-6,"s":3,"data":{"planet":"e","sector":"2"}},{"q":4,"r":-6,"s":2,"data":{"planet":"i","sector":"2"}},{"q":3,"r":-5,"s":2,"data":{"planet":"e","sector":"2"}},{"q":-3,"r":10,"s":-7,"data":{"planet":"e","sector":"10"}},{"q":-3,"r":9,"s":-6,"data":{"planet":"e","sector":"10"}},{"q":-3,"r":8,"s":-5,"data":{"planet":"e","sector":"10"}},{"q":-2,"r":7,"s":-5,"data":{"planet":"e","sector":"10"}},{"q":-1,"r":6,"s":-5,"data":{"planet":"r","sector":"10"}},{"q":0,"r":6,"s":-6,"data":{"planet":"o","sector":"10"}},{"q":1,"r":6,"s":-7,"data":{"planet":"e","sector":"10"}},{"q":1,"r":7,"s":-8,"data":{"planet":"e","sector":"10"}},{"q":1,"r":8,"s":-9,"data":{"planet":"e","sector":"10"}},{"q":0,"r":9,"s":-9,"data":{"planet":"e","sector":"10"}},{"q":-1,"r":10,"s":-9,"data":{"planet":"m","sector":"10"}},{"q":-2,"r":10,"s":-8,"data":{"planet":"m","sector":"10"}},{"q":-2,"r":9,"s":-7,"data":{"planet":"e","sector":"10"}},{"q":-2,"r":8,"s":-6,"data":{"planet":"d","sector":"10"}},{"q":-1,"r":7,"s":-6,"data":{"planet":"e","sector":"10"}},{"q":0,"r":7,"s":-7,"data":{"planet":"e","sector":"10"}},{"q":0,"r":8,"s":-8,"data":{"planet":"g","sector":"10"}},{"q":-1,"r":9,"s":-8,"data":{"planet":"e","sector":"10"}},{"q":-1,"r":8,"s":-7,"data":{"planet":"e","sector":"10"}},{"q":-4,"r":10,"s":-6,"data":{"planet":"e","sector":"1"}},{"q":-5,"r":11,"s":-6,"data":{"planet":"e","sector":"1"}},{"q":-6,"r":12,"s":-6,"data":{"planet":"e","sector":"1"}},{"q":-7,"r":12,"s":-5,"data":{"planet":"d","sector":"1"}},{"q":-8,"r":12,"s":-4,"data":{"planet":"e","sector":"1"}},{"q":-8,"r":11,"s":-3,"data":{"planet":"e","sector":"1"}},{"q":-8,"r":10,"s":-2,"data":{"planet":"o","sector":"1"}},{"q":-7,"r":9,"s":-2,"data":{"planet":"v","sector":"1"}},{"q":-6,"r":8,"s":-2,"data":{"planet":"e","sector":"1"}},{"q":-5,"r":8,"s":-3,"data":{"planet":"m","sector":"1"}},{"q":-4,"r":8,"s":-4,"data":{"planet":"e","sector":"1"}},{"q":-4,"r":9,"s":-5,"data":{"planet":"e","sector":"1"}},{"q":-5,"r":10,"s":-5,"data":{"planet":"e","sector":"1"}},{"q":-6,"r":11,"s":-5,"data":{"planet":"s","sector":"1"}},{"q":-7,"r":11,"s":-4,"data":{"planet":"e","sector":"1"}},{"q":-7,"r":10,"s":-3,"data":{"planet":"e","sector":"1"}},{"q":-6,"r":9,"s":-3,"data":{"planet":"e","sector":"1"}},{"q":-5,"r":9,"s":-4,"data":{"planet":"r","sector":"1"}},{"q":-6,"r":10,"s":-4,"data":{"planet":"e","sector":"1"}},{"q":-10,"r":7,"s":3,"data":{"planet":"e","sector":"7A"}},{"q":-9,"r":6,"s":3,"data":{"planet":"e","sector":"7A"}},{"q":-8,"r":5,"s":3,"data":{"planet":"m","sector":"7A"}},{"q":-7,"r":5,"s":2,"data":{"planet":"e","sector":"7A"}},{"q":-6,"r":5,"s":1,"data":{"planet":"e","sector":"7A"}},{"q":-6,"r":6,"s":0,"data":{"planet":"e","sector":"7A"}},{"q":-6,"r":7,"s":-1,"data":{"planet":"t","sector":"7A"}},{"q":-7,"r":8,"s":-1,"data":{"planet":"e","sector":"7A"}},{"q":-8,"r":9,"s":-1,"data":{"planet":"e","sector":"7A"}},{"q":-9,"r":9,"s":0,"data":{"planet":"e","sector":"7A"}},{"q":-10,"r":9,"s":1,"data":{"planet":"e","sector":"7A"}},{"q":-10,"r":8,"s":2,"data":{"planet":"s","sector":"7A"}},{"q":-9,"r":7,"s":2,"data":{"planet":"o","sector":"7A"}},{"q":-8,"r":6,"s":2,"data":{"planet":"e","sector":"7A"}},{"q":-7,"r":6,"s":1,"data":{"planet":"g","sector":"7A"}},{"q":-7,"r":7,"s":0,"data":{"planet":"e","sector":"7A"}},{"q":-8,"r":8,"s":0,"data":{"planet":"g","sector":"7A"}},{"q":-9,"r":8,"s":1,"data":{"planet":"e","sector":"7A"}},{"q":-8,"r":7,"s":1,"data":{"planet":"e","sector":"7A"}}],"expansions":0,"turnOrderAfterSetupAuction":[-1,-1],"playerToMove":2,"ended":false,"isLastRound":false}`;
    const engine = Engine.fromData(JSON.parse(legacyGame));
    engine.move("p3 faction terrans");
    expect(generate(engine).map((cmd) => cmd.name)).to.contain("build");
  });
});
