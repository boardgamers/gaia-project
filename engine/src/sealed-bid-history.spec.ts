import { expect } from "chai";
import { canMoveOutOfTurn, currentPlayer, isLiveUpdate, logLength, logSlice, move, timeIncrements } from "../wrapper";
import Engine, { AuctionVariant } from "./engine";
import { Phase } from "./enums";

for (const auction of [AuctionVariant.Silent, AuctionVariant.PreferenceSplit]) {
  describe(`${auction} - compact replacement history`, () => {
    const command = auction === AuctionVariant.Silent ? "silentBid" : "preferenceBid";
    const bid = (seat: number, amounts: number[]) =>
      `p${seat + 1} ${command} itars ${amounts[0]} xenos ${amounts[1]} taklons ${amounts[2]}`;
    const options = () => ({ auction, auctionBudget: 60 });
    const start = () =>
      new Engine(
        [
          "init 3 compact-sealed-bids",
          ...(auction === AuctionVariant.Silent
            ? ["p1 banFaction terrans", "p2 banFaction lantids", "p3 banFaction hadsch-hallas"]
            : []),
          "p1 faction itars",
          "p2 faction xenos",
          "p3 faction taklons",
        ],
        options()
      );

    function expectSamePosition(actual: Engine, replayed: Engine) {
      for (const key of [
        "phase",
        "currentPlayer",
        "turnOrder",
        "moveHistory",
        "advancedLog",
        "silentAuctionBids",
        "preferenceSplitBids",
        "silentAuctionLog",
        "preferenceSplitResult",
        "setup",
      ] as const) {
        expect(JSON.stringify(replayed[key]), key).to.equal(JSON.stringify(actual[key]));
      }
      expect(replayed.players.map((player) => ({ faction: player.faction, bid: player.data.bid }))).to.deep.equal(
        actual.players.map((player) => ({ faction: player.faction, bid: player.data.bid }))
      );
    }

    it("keeps one history slot per seat through repeated interleaved revisions and JSON reloads", () => {
      let engine = start();
      const beforeBids = logLength(engine);
      engine = move(engine, bid(1, [20, 20, 20]), 1);
      engine = move(engine, bid(0, [21, 19, 20]), 0);
      const increments = [...timeIncrements(engine)];
      const advancedLog = JSON.parse(JSON.stringify(engine.advancedLog));
      const turnOrder = [...engine.turnOrder];
      const turnPlayer = engine.currentPlayer;

      for (let n = 10; n < 30; n++) {
        const seat = n % 2;
        const replacement = bid(seat, [n, 30 - n, 30]);
        expect(canMoveOutOfTurn(engine, replacement, seat)).to.equal(true);
        engine = move(JSON.parse(JSON.stringify(engine)), replacement, seat);
        expect(isLiveUpdate(engine)).to.equal(true);
        expect(timeIncrements(engine)).to.deep.equal(increments);
        expect(currentPlayer(engine)).to.equal(2);
        expect(logLength(engine)).to.equal(beforeBids + 2);
        expect(engine.moveHistory[beforeBids + (seat === 1 ? 0 : 1)]).to.equal(replacement);
        expect(engine.advancedLog).to.deep.equal(advancedLog);
        expect(engine.turnOrder).to.deep.equal(turnOrder);
        expect(engine.currentPlayer).to.equal(turnPlayer);

        // The platform requests a tail from the old length on a live update. The authoritative
        // state still carries the replacement; the viewer replaces its history from that state.
        const ownLog = logSlice(engine, { player: seat, start: beforeBids + 2 });
        expect(ownLog.log).to.deep.equal([]);
        expect(ownLog.state.moveHistory).to.include(replacement);
        for (const viewer of [2, undefined]) {
          expect(logSlice(engine, { player: viewer }).log.slice(beforeBids)).to.deep.equal([
            `p2 ${command}`,
            `p1 ${command}`,
          ]);
        }
        expectSamePosition(engine, new Engine(engine.moveHistory, options()));
      }

      // The final pending seat resolves exactly once, with the revised vectors. The canonical
      // history replays to the same result, including advanced-log positions/resource changes.
      engine = move(engine, bid(2, [18, 22, 20]), 2);
      expect(engine.phase).to.equal(Phase.SetupBuilding);
      expect(logLength(engine)).to.equal(beforeBids + 3);
      expect(isLiveUpdate(engine)).to.equal(false);
      expectSamePosition(engine, new Engine(engine.moveHistory, options()));
      expectSamePosition(engine, Engine.fromData(JSON.parse(JSON.stringify(engine))).replayedTo());
      expect(canMoveOutOfTurn(engine, bid(0, [20, 20, 20]), 0)).to.equal(false);
      expect(() => move(engine, bid(0, [20, 20, 20]), 0)).to.throw();
    });

    it("does not change the bid or either log when a replacement is invalid", () => {
      const engine = move(start(), bid(0, [20, 20, 20]), 0);
      const history = [...engine.moveHistory];
      const advancedLog = JSON.parse(JSON.stringify(engine.advancedLog));
      const bids = JSON.parse(JSON.stringify([engine.silentAuctionBids, engine.preferenceSplitBids]));
      expect(() => move(engine, bid(0, [61, 0, 0]), 0)).to.throw();
      expect(engine.moveHistory).to.deep.equal(history);
      expect(JSON.parse(JSON.stringify(engine.advancedLog))).to.deep.equal(advancedLog);
      expect([engine.silentAuctionBids, engine.preferenceSplitBids]).to.deep.equal(bids);
    });

    it("uses the same private replacement slot when the original submission used a faction alias", () => {
      let engine = move(start(), bid(0, [20, 20, 20]).replace("p1", "itars"), 0);
      const index = logLength(engine) - 1;
      expect(engine.moveHistory[index]).to.equal(bid(0, [20, 20, 20]));
      expect(logSlice(engine, { player: 1 }).log[index]).to.equal(`p1 ${command}`);
      engine = move(engine, bid(0, [22, 18, 20]), 0);
      expect(logLength(engine)).to.equal(index + 1);
      expect(engine.moveHistory[index]).to.equal(bid(0, [22, 18, 20]));
      expect(logSlice(engine, { player: 1 }).log[index]).to.equal(`p1 ${command}`);
    });

    it("replaces the latest slot in a save containing revisions from the older engine", () => {
      let engine = move(start(), bid(0, [20, 20, 20]), 0);
      // Older releases appended every revision. Preserve their existing positions while ensuring
      // another revision changes the final value that replay will consume, not an obsolete slot.
      const oldIndex = engine.moveHistory.length;
      engine.moveHistory.push(bid(0, [20, 20, 20]));
      engine.advancedLog.push({ player: 0, move: oldIndex });
      engine = move(engine, bid(1, [21, 19, 20]), 1);
      const oldHistory = [...engine.moveHistory];
      engine = move(JSON.parse(JSON.stringify(engine)), bid(0, [22, 18, 20]), 0);
      expect(engine.moveHistory).to.deep.equal(
        oldHistory.map((entry, index) => (index === oldIndex ? bid(0, [22, 18, 20]) : entry))
      );
      expect(logLength(engine)).to.equal(oldHistory.length);
      engine = move(engine, bid(2, [18, 22, 20]), 2);
      const replayed = new Engine(engine.moveHistory, options());
      expect(replayed.players.map((player) => [player.faction, player.data.bid])).to.deep.equal(
        engine.players.map((player) => [player.faction, player.data.bid])
      );
      expectSamePosition(engine, engine.replayedTo());
    });
  });
}
