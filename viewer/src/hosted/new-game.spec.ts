import { expect } from "chai";
import Engine from "@gaia-project/engine";
import { buildCreateGameParams } from "./new-game";

describe("buildCreateGameParams", () => {
  it("builds params with pristine options, the setup move, and an engine-derived first seat", () => {
    const params = buildCreateGameParams(
      {
        playerCount: 2,
        seats: [
          { userId: "user-alice", name: "Alice" },
          { userId: "user-bob", name: "Bob" },
        ],
      },
      "fixed-seed",
      "p2 rotate"
    );

    // the probe engine must not leak its mutations (map, factionVariantVersion)
    expect(params.p_options).to.deep.equal({ lostFleet: true, advancedRules: true, factionVariant: "standard" });
    expect(params.p_name).to.be.a("string").and.to.not.equal("");
    expect(params.p_seed).to.equal("fixed-seed");
    expect(params.p_setup_move).to.equal("p2 rotate");
    expect(params.p_current_seat).to.be.a("number");
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
      },
      "fixed-seed-3p",
      "p3 rotate"
    );

    expect(params.p_current_seat).to.equal(0);
  });

  it("does not mutate the options object it returns across repeated calls", () => {
    const params1 = buildCreateGameParams(
      { playerCount: 2, seats: [{ userId: "a", name: "A" }, { userId: "b", name: "B" }] },
      "seed-1",
      "p2 rotate"
    );
    const params2 = buildCreateGameParams(
      { playerCount: 2, seats: [{ userId: "a", name: "A" }, { userId: "b", name: "B" }] },
      "seed-2",
      "p2 rotate"
    );

    expect(params1.p_options).to.deep.equal({ lostFleet: true, advancedRules: true, factionVariant: "standard" });
    expect(params2.p_options).to.deep.equal({ lostFleet: true, advancedRules: true, factionVariant: "standard" });
  });
});
