import { expect } from "chai";
import Engine from "@gaia-project/engine";
import { auctionVariantBlockedReason, buildCreateGameParams, shuffleSeats } from "./new-game";

describe("buildCreateGameParams", () => {
  it("builds params with pristine options, the setup move, and an engine-derived first seat", () => {
    const params = buildCreateGameParams(
      {
        playerCount: 2,
        seats: [
          { userId: "user-alice", name: "Alice" },
          { userId: "user-bob", name: "Bob" },
        ],
        auctionVariant: "none",
        openLobby: false,
      },
      "fixed-seed",
      "p2 rotate"
    );

    // the probe engine must not leak its mutations (map, factionVariantVersion)
    expect(params.p_options).to.deep.equal({
      lostFleet: true,
      advancedRules: true,
      factionVariant: "standard",
      banPhase: false,
    });
    expect(params.p_name).to.be.a("string").and.to.not.equal("");
    expect(params.p_seed).to.equal("fixed-seed");
    expect(params.p_setup_move).to.equal("p2 rotate");
    expect(params.p_current_seat).to.be.a("number");
    expect(params.p_open_lobby).to.equal(false);
    expect(params.p_invites).to.deep.equal([
      { user_id: "user-alice", seat: 0, display_name: "Alice" },
      { user_id: "user-bob", seat: 1, display_name: "Bob" },
    ]);
  });

  it("derives p_current_seat AFTER the setup move is applied, not straight off init", () => {
    // advancedRules makes beginSetupBoardPhase enter Phase.SetupBoard first,
    // whose currentPlayer is the LAST player (seat player_count - 1) — that's
    // who the bare "init" probe would report as playerToMove. Once the rotate
    // move is applied, play should move on to Phase.SetupFaction, whose first
    // mover is seat 0.
    const bareInitProbe = new Engine(["init 3 fixed-seed-3p"], {
      lostFleet: true,
      advancedRules: true,
      factionVariant: "standard",
    });
    bareInitProbe.generateAvailableCommandsIfNeeded();
    expect(bareInitProbe.playerToMove).to.equal(2);

    const params = buildCreateGameParams(
      {
        playerCount: 3,
        seats: [
          { userId: "user-alice", name: "Alice" },
          { userId: "user-bob", name: "Bob" },
          { userId: "user-carol", name: "Carol" },
        ],
        auctionVariant: "none",
        openLobby: false,
      },
      "fixed-seed-3p",
      "p3 rotate"
    );

    expect(params.p_current_seat).to.equal(0);
  });

  it("does not mutate the options object it returns across repeated calls", () => {
    const params1 = buildCreateGameParams(
      {
        playerCount: 2,
        seats: [
          { userId: "a", name: "A" },
          { userId: "b", name: "B" },
        ],
        auctionVariant: "none",
        openLobby: false,
      },
      "seed-1",
      "p2 rotate"
    );
    const params2 = buildCreateGameParams(
      {
        playerCount: 2,
        seats: [
          { userId: "a", name: "A" },
          { userId: "b", name: "B" },
        ],
        auctionVariant: "none",
        openLobby: false,
      },
      "seed-2",
      "p2 rotate"
    );

    expect(params1.p_options).to.deep.equal({
      lostFleet: true,
      advancedRules: true,
      factionVariant: "standard",
      banPhase: false,
    });
    expect(params2.p_options).to.deep.equal({
      lostFleet: true,
      advancedRules: true,
      factionVariant: "standard",
      banPhase: false,
    });
  });
});

describe("shuffleSeats", () => {
  it("returns a permutation of the input without mutating it", () => {
    const seats = [{ userId: "a" }, { userId: "b" }, { userId: "c" }, { userId: "d" }];
    const original = [...seats];

    const shuffled = shuffleSeats(seats);

    expect(seats).to.deep.equal(original);
    expect(shuffled).to.have.members(seats);
    expect(shuffled).to.have.lengthOf(seats.length);
  });

  it("can produce every seat order over many runs", () => {
    const seats = ["a", "b", "c"];
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      seen.add(shuffleSeats(seats).join(""));
    }
    // all 3! = 6 permutations should show up given enough runs
    expect(seen.size).to.equal(6);
  });
});

describe("Preference Split Auction setup", () => {
  const fourSeats = [0, 1, 2, 3].map((i) => ({ userId: `user-${i}`, name: `P${i + 1}` }));

  it("is offered at every player count, like every other variant", () => {
    // It was 4-players-only until the owner generalized it (2026-08-05). The blocking machinery
    // stays for a future count-restricted variant, so this also guards against one of the current
    // variants picking up a restriction by accident.
    for (const variant of ["none", "silent", "preference-split", "choose-bid", "bid-while-choosing"] as const) {
      for (const count of [2, 3, 4, 5]) {
        expect(auctionVariantBlockedReason(variant, count)).to.equal("");
      }
    }
  });

  it("stores the variant and the budget its player count fixes", () => {
    const params = buildCreateGameParams(
      { playerCount: 4, seats: fourSeats, auctionVariant: "preference-split", openLobby: false },
      "fixed-seed",
      "p4 rotate"
    );

    expect(params.p_options).to.deep.equal({
      lostFleet: true,
      advancedRules: true,
      factionVariant: "standard",
      auction: "preference-split",
      auctionBudget: 40,
      banPhase: false,
    });
  });

  it("scales the stored budget with the player count, and stores none for another variant", () => {
    for (const [playerCount, budget] of [
      [2, 20],
      [3, 30],
      [4, 40],
    ]) {
      const defaulted = buildCreateGameParams(
        {
          playerCount,
          seats: fourSeats.slice(0, playerCount),
          auctionVariant: "preference-split",
          openLobby: false,
        },
        "fixed-seed",
        `p${playerCount} rotate`
      );
      expect((defaulted.p_options as any).auctionBudget).to.equal(budget);
    }

    const silent = buildCreateGameParams(
      { playerCount: 4, seats: fourSeats, auctionVariant: "silent", openLobby: false },
      "fixed-seed",
      "p4 rotate"
    );
    expect((silent.p_options as any).auctionBudget).to.equal(undefined);
  });

  it("builds params for a three-player game the same way", () => {
    const params = buildCreateGameParams(
      { playerCount: 3, seats: fourSeats.slice(0, 3), auctionVariant: "preference-split", openLobby: false },
      "fixed-seed",
      "p3 rotate"
    );

    expect(params.p_player_count).to.equal(3);
    expect((params.p_options as any).auction).to.equal("preference-split");
    expect((params.p_options as any).auctionBudget).to.equal(30);
  });
});
