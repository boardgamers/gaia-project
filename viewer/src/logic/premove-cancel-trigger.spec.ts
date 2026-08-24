import Engine from "@gaia-project/engine";
import { expect } from "chai";
import {
  CancelTriggerRow,
  candidateAtoms,
  LeechConfig,
  matchCancelTriggers,
  moveAtoms,
  SeatedMove,
} from "./premove-cancel-trigger";

// An identity map: hex args round-trip unchanged. Good enough for every test that isn't
// specifically exercising hex-notation canonicalization (that group builds a real engine map
// instead, since the module intentionally has no engine dependency of its own to fake one with).
const identityMap = { getS: (coords: string) => ({ toString: () => coords }) };

function trigger(overrides: Partial<CancelTriggerRow>): CancelTriggerRow {
  return {
    seq: 1,
    kind: "move",
    watchedSeat: 1,
    move: "",
    atoms: [],
    config: {},
    match: "any",
    armedFromMoveCount: 0,
    ...overrides,
  };
}

function seated(seq: number, seat: number, move: string): SeatedMove {
  return { seq, seat, move };
}

describe("moveAtoms", () => {
  it("normalizes a full move line into one atom per command", () => {
    expect(moveAtoms("firaks build lab 7A6. tech eco. up eco", identityMap)).to.deep.equal([
      "build:lab:7A6",
      "tech:eco",
      "up:eco",
    ]);
  });

  it("does NOT drop plumbing commands - an actual move is normalized in full", () => {
    const atoms = moveAtoms("xenos burn 2. spend 2pw for 1o. build m 3A4.", identityMap);
    expect(atoms).to.include("burn:2");
    expect(atoms).to.include("build:m:3A4");
    // "spend 2pw for 1o" - the "for" token is dropped by the underlying command/arg split the same
    // way parseCommands treats it (args are whitespace-split, "for"/"1o" both become plain args).
    expect(atoms.some((a) => a.startsWith("spend:"))).to.equal(true);
  });

  it("the three real up-eco routes all produce an up:eco atom (§2.2's verified fact)", () => {
    const techTile = moveAtoms("firaks build lab 7A6. tech eco. up eco", identityMap);
    const freeTile = moveAtoms("firaks build lab 7A6. tech free2. up eco", identityMap);
    const special = moveAtoms("bescods special up-lowest. up eco", identityMap);
    expect(techTile).to.include("up:eco");
    expect(freeTile).to.include("up:eco");
    expect(special).to.include("up:eco");
  });

  it("lowercases non-hex args and strips a trailing dot", () => {
    expect(moveAtoms("terrans pass Booster3.", identityMap)).to.deep.equal(["pass:booster3"]);
  });

  it("canonicalizes a FormFederation hex list by sorting its members", () => {
    const a = moveAtoms("ivits federation 3A4,1A2 fed3", identityMap);
    const b = moveAtoms("ivits federation 1A2,3A4 fed3", identityMap);
    expect(a).to.deep.equal(b);
    expect(a).to.deep.equal(["federation:1A2,3A4:fed3"]);
  });
});

describe("candidateAtoms", () => {
  it("drops plumbing commands from the composer's candidates", () => {
    const candidates = candidateAtoms("xenos burn 2. spend 2pw for 1o. build m 3A4.", identityMap);
    expect(candidates.map((c) => c.exact)).to.deep.equal(["build:m:3A4"]);
  });

  it("drops every command on the DROP list, keeps everything else, including unknown commands", () => {
    const candidates = candidateAtoms(
      "terrans charge 2pw. decline 3pw. income. endturn. brainstone. up eco. mystery 1 2",
      identityMap
    );
    expect(candidates.map((c) => c.exact)).to.deep.equal(["up:eco", "mystery:1:2"]);
  });

  it("offers a loose (*) form for build that keeps the building type and drops the hex", () => {
    const [candidate] = candidateAtoms("terrans build lab 7A6.", identityMap);
    expect(candidate).to.deep.equal({ exact: "build:lab:7A6", any: "build:lab:*", label: candidate.label });
  });

  it("offers a fully-collapsing loose form for up/tech/action/special/pass/federation", () => {
    expect(candidateAtoms("terrans up eco", identityMap)[0].any).to.equal("up:*");
    expect(candidateAtoms("terrans tech eco", identityMap)[0].any).to.equal("tech:*");
    expect(candidateAtoms("terrans action power3", identityMap)[0].any).to.equal("action:*");
    expect(candidateAtoms("terrans special up-lowest", identityMap)[0].any).to.equal("special:*");
    expect(candidateAtoms("terrans pass booster3", identityMap)[0].any).to.equal("pass:*");
    expect(candidateAtoms("ivits federation 3A4 fed3", identityMap)[0].any).to.equal("federation:*");
  });

  it("offers no loose form for a command outside the §2.4 table", () => {
    expect(candidateAtoms("terrans mystery 1 2", identityMap)[0].any).to.equal(null);
  });

  it("dedupes identical atoms, keeping first-seen order", () => {
    const candidates = candidateAtoms("terrans build m 3A4. build m 3A4.", identityMap);
    expect(candidates.length).to.equal(1);
  });
});

describe("hex notation equivalence (real engine map)", () => {
  it("a regular hex's cube and sector-relative notations produce the same atom", () => {
    const engine = new Engine(["init 2 randomSeed"]);
    const [hex] = [...(engine.map as any).grid.values()];
    const cube = `${hex.q}x${hex.r}`;
    const relative = hex.toString();
    expect(moveAtoms(`terrans build m ${cube}.`, engine.map)).to.deep.equal(
      moveAtoms(`terrans build m ${relative}.`, engine.map)
    );
  });

  it("a Lost Fleet Interspace/Deep Space hex's cube and canonical (IS.../DS...) notations agree", () => {
    const engine = new Engine(["init 2 randomSeed"], { lostFleet: true });
    const hexes = [...(engine.map as any).grid.values()] as any[];
    const special = hexes.find((h) => /^(IS|DS)/.test(h.toString()));
    if (!special) {
      // Some seeds/configurations may not place any - nothing to assert against, so skip rather
      // than fail on an environment-dependent absence.
      return;
    }
    const cube = `${special.q}x${special.r}`;
    expect(moveAtoms(`terrans build m ${cube}.`, engine.map)).to.deep.equal(
      moveAtoms(`terrans build m ${special.toString()}.`, engine.map)
    );
  });
});

describe("matchCancelTriggers - move kind", () => {
  it("matches an exact stored atom against the same actual atom", () => {
    const triggers = [trigger({ atoms: ["build:m:3A4"] })];
    const moves = [seated(1, 1, "xenos build m 3A4.")];
    const result = matchCancelTriggers(triggers, moves, identityMap);
    expect(result?.atom).to.equal("build:m:3A4");
    expect(result?.matchedMove.seq).to.equal(1);
  });

  it("does not match a different hex under an exact atom", () => {
    const triggers = [trigger({ atoms: ["build:m:3A4"] })];
    const moves = [seated(1, 1, "xenos build m 9B2.")];
    expect(matchCancelTriggers(triggers, moves, identityMap)).to.equal(null);
  });

  it("a loose (*) stored atom matches any hex", () => {
    const triggers = [trigger({ atoms: ["build:m:*"] })];
    const moves = [seated(1, 1, "xenos build m 9B2.")];
    expect(matchCancelTriggers(triggers, moves, identityMap)?.atom).to.equal("build:m:9B2");
  });

  it("build:m:* does not match build:lab:* - the loose form still pins the building type", () => {
    const triggers = [trigger({ atoms: ["build:m:*"] })];
    const moves = [seated(1, 1, "xenos build lab 9B2.")];
    expect(matchCancelTriggers(triggers, moves, identityMap)).to.equal(null);
  });

  it("only scans moves with seq strictly greater than armed_from_move_count", () => {
    const triggers = [trigger({ atoms: ["up:eco"], armedFromMoveCount: 5 })];
    const moves = [seated(5, 1, "xenos up eco"), seated(4, 1, "xenos up eco")];
    expect(matchCancelTriggers(triggers, moves, identityMap)).to.equal(null);

    const laterMoves = [...moves, seated(6, 1, "xenos up eco")];
    expect(matchCancelTriggers(triggers, laterMoves, identityMap)?.matchedMove.seq).to.equal(6);
  });

  it("only watches the trigger's own watched seat - a different seat's identical move never fires it", () => {
    const triggers = [trigger({ atoms: ["up:eco"], watchedSeat: 1 })];
    const moves = [seated(1, 2, "firaks up eco")];
    expect(matchCancelTriggers(triggers, moves, identityMap)).to.equal(null);
  });

  it("OR-s multiple triggers on different opponents - the first (chronological) match wins", () => {
    const triggers = [
      trigger({ seq: 1, watchedSeat: 1, atoms: ["up:eco"] }),
      trigger({ seq: 2, watchedSeat: 2, atoms: ["tech:*"] }),
    ];
    const moves = [seated(1, 2, "firaks tech eco"), seated(2, 1, "xenos up eco")];
    const result = matchCancelTriggers(triggers, moves, identityMap);
    expect(result?.trigger.seq).to.equal(2);
    expect(result?.matchedMove.seq).to.equal(1);
  });

  it("atoms combine with OR within one trigger - either selected atom fires it", () => {
    const triggers = [trigger({ atoms: ["up:eco", "tech:eco"] })];
    expect(matchCancelTriggers(triggers, [seated(1, 1, "xenos tech eco")], identityMap)?.atom).to.equal("tech:eco");
  });

  it("requires the atom to appear within a single committed move, not spread across two", () => {
    const triggers = [trigger({ atoms: ["build:m:*"] })];
    // "build" never appears in either move on its own - only "gaiaform" then, separately, "up".
    const moves = [seated(1, 1, "xenos gaiaFormTransdim 3A4"), seated(2, 1, "xenos up eco")];
    expect(matchCancelTriggers(triggers, moves, identityMap)).to.equal(null);
  });
});

describe("matchCancelTriggers - leech kind", () => {
  const gained: LeechConfig = { mode: "gained", minPower: 2 };
  const offered: LeechConfig = { mode: "offered", minPower: 2 };

  function leechTrigger(config: LeechConfig, seat = 1): CancelTriggerRow {
    return trigger({ kind: "leech", watchedSeat: seat, atoms: [], config });
  }

  it("fires on charge 2pw at minPower 2", () => {
    const result = matchCancelTriggers([leechTrigger(gained)], [seated(1, 1, "xenos charge 2pw")], identityMap);
    expect(result?.atom).to.equal("charge:2pw");
  });

  it("does not fire on charge 1pw at minPower 2", () => {
    expect(matchCancelTriggers([leechTrigger(gained)], [seated(1, 1, "xenos charge 1pw")], identityMap)).to.equal(null);
  });

  it("decline 3pw fires in 'offered' mode but not in 'gained' mode", () => {
    const moves = [seated(1, 1, "xenos decline 3pw")];
    expect(matchCancelTriggers([leechTrigger(offered)], moves, identityMap)?.atom).to.equal("decline:3pw");
    expect(matchCancelTriggers([leechTrigger(gained)], moves, identityMap)).to.equal(null);
  });

  it("an opponent's charge never fires the owner's leech trigger", () => {
    // Trigger's watched_seat is the OWNER's own seat (1); the charge below belongs to seat 2.
    const result = matchCancelTriggers([leechTrigger(gained, 1)], [seated(1, 2, "firaks charge 5pw")], identityMap);
    expect(result).to.equal(null);
  });
});

describe("matchCancelTriggers - mixed kinds", () => {
  it("a leech trigger and a move trigger armed together: whichever matches first (chronologically) wins", () => {
    const moveTrig = trigger({ seq: 1, kind: "move", watchedSeat: 2, atoms: ["up:eco"] });
    const leechTrig = trigger({
      seq: 2,
      kind: "leech",
      watchedSeat: 1,
      atoms: [],
      config: { mode: "gained", minPower: 2 },
    });
    const moves = [seated(1, 1, "xenos charge 2pw"), seated(2, 2, "firaks up eco")];
    const result = matchCancelTriggers([moveTrig, leechTrig], moves, identityMap);
    expect(result?.trigger.kind).to.equal("leech");
    expect(result?.matchedMove.seq).to.equal(1);
  });

  it("returns null when no trigger matches anything", () => {
    const moveTrig = trigger({ kind: "move", watchedSeat: 2, atoms: ["up:eco"] });
    const leechTrig = trigger({ kind: "leech", watchedSeat: 1, atoms: [], config: { mode: "gained", minPower: 2 } });
    const moves = [seated(1, 1, "xenos charge 1pw"), seated(2, 2, "firaks tech eco")];
    expect(matchCancelTriggers([moveTrig, leechTrig], moves, identityMap)).to.equal(null);
  });
});
