import { expect } from "chai";
import Engine, { AuctionVariant } from "./engine";
import { Faction, Phase } from "./enums";

describe("Ban phase (independent of auction variant)", () => {
  it("runs a ban phase with no auction variant when banPhase is explicitly true", () => {
    const moves = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 banFaction terrans
      p2 banFaction lantids
      p3 banFaction hadsch-hallas
      p1 faction itars
      p2 faction xenos
      p3 faction taklons
    `);

    const engine = new Engine(moves, { banPhase: true });

    expect(engine.bannedFactions).to.have.members([Faction.Terrans, Faction.Lantids, Faction.HadschHallas]);
    expect(engine.players[0].faction).to.equal(Faction.Itars);
    expect(engine.players[1].faction).to.equal(Faction.Xenos);
    expect(engine.players[2].faction).to.equal(Faction.Taklons);
    // No auction variant: picking a faction assigns it immediately (bid 0), straight into building.
    expect(engine.phase).to.equal(Phase.SetupBuilding);
  });

  it("skips the ban phase for Silent Auction when banPhase is explicitly false", () => {
    const moves = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 faction itars
      p2 faction xenos
      p3 faction taklons
      p1 silentBid itars 15 xenos 0 taklons 10
      p2 silentBid itars 15 xenos 5 taklons 8
      p3 silentBid itars 7 xenos 0 taklons 0
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.Silent, banPhase: false });

    expect(engine.bannedFactions).to.deep.equal([]);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
  });

  it("still bans by default for Silent Auction when banPhase is left unset (legacy back-compat)", () => {
    const moves = Engine.parseMoves(`
      init 3 djfjjv4k
      p1 banFaction terrans
      p2 banFaction lantids
      p3 banFaction hadsch-hallas
      p1 faction itars
      p2 faction xenos
      p3 faction taklons
      p1 silentBid itars 15 xenos 0 taklons 10
      p2 silentBid itars 15 xenos 5 taklons 8
      p3 silentBid itars 7 xenos 0 taklons 0
    `);

    const engine = new Engine(moves, { auction: AuctionVariant.Silent });

    expect(engine.bannedFactions).to.have.members([Faction.Terrans, Faction.Lantids, Faction.HadschHallas]);
    expect(engine.phase).to.equal(Phase.SetupBuilding);
  });
});
