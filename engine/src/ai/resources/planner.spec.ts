import { expect } from "chai";
import { createHash } from "crypto";
import "mocha";
import Engine, { AuctionVariant } from "../../engine";
import { Building, Command, Phase, Player, PowerArea, Resource, Round, SubPhase } from "../../enums";
import { expandAtomicDecisions } from "../actions/expand";
import { AtomicDecisionCandidate } from "../actions/types";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "../challenge";
import { canonicalConversionPlanKey, canonicalConversionStateKey } from "./canonical-key";
import { planAfterActionConversions, planResourceConversions, ResourceConversionPlannerError } from "./planner";

function hydrate(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

function actorPrefix(engine: Engine): string {
  return engine.player(engine.playerToMove).faction;
}

function lockedRoundOneEngine(): Engine {
  const engine = new Engine(LOST_FLEET_CHALLENGE.scriptedPrefix, challengeEngineOptions());
  let guard = 20;
  while (engine.phase === Phase.SetupBuilding || engine.phase === Phase.SetupBooster) {
    const candidate = expandAtomicDecisions(engine).candidates[0];
    engine.move(`${actorPrefix(engine)} ${candidate.moveFragment}`);
    expect(--guard, "locked setup must terminate").to.be.greaterThan(0);
  }
  expect(engine.phase).to.equal(Phase.RoundMove);
  return engine;
}

function hadschHallasTurn(): Engine {
  const engine = lockedRoundOneEngine();
  const pass = expandAtomicDecisions(engine).candidates.find((candidate) => candidate.command === Command.Pass);
  expect(pass).not.to.equal(undefined);
  engine.move(`${actorPrefix(engine)} ${pass.moveFragment}`);
  expect(engine.player(engine.playerToMove).faction).to.equal("hadsch-hallas");
  return engine;
}

function smallWallet(
  engine: Engine,
  wallet: Partial<{
    credits: number;
    ores: number;
    knowledge: number;
    qics: number;
    area1: number;
    area2: number;
    area3: number;
    gaia: number;
  }>
): Engine {
  const player = engine.player(engine.playerToMove);
  player.data.credits = wallet.credits ?? 0;
  player.data.ores = wallet.ores ?? 0;
  player.data.knowledge = wallet.knowledge ?? 0;
  player.data.qics = wallet.qics ?? 0;
  player.data.power.area1 = wallet.area1 ?? 0;
  player.data.power.area2 = wallet.area2 ?? 0;
  player.data.power.area3 = wallet.area3 ?? 0;
  player.data.power.gaia = wallet.gaia ?? 0;
  player.data.brainstone = null;
  player.data.temporaryRange = 0;
  player.data.temporaryStep = 0;
  player.data.turns = 0;
  engine.subPhase = SubPhase.BeforeMove;
  engine.newTurn = true;
  engine.pendingMove = "";
  engine.turnMoves = [];
  engine.clearAvailableCommands();
  player.federationCache = null;
  return engine;
}

function walletKey(state: {
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
  power: { area1: number; area2: number; area3: number };
}): string {
  return [
    state.credits,
    state.ores,
    state.knowledge,
    state.qics,
    state.power.area1,
    state.power.area2,
    state.power.area3,
  ].join("/");
}

function planningResultKeyDigest(result: ReturnType<typeof planResourceConversions>): string {
  const keyMaterial = {
    sourceStateKey: result.sourceStateKey,
    states: result.reachableStates.map(canonicalConversionStateKey).sort(),
    plans: result.reachablePlans.map((plan) => plan.key).sort(),
    frontier: result.stateFrontier.frontier.map(canonicalConversionStateKey).sort(),
    candidates: result.candidates.map((entry) => ({
      candidateKey: entry.candidate.key,
      plans: entry.plans.map((plan) => plan.key).sort(),
      paymentFrontier: entry.payments.frontier
        .map((payment) => [payment.postPaymentStateKey, payment.conversionPlanKey])
        .sort(),
      paymentDominated: entry.payments.dominated.map((payment) => [payment.dominatedKey, payment.dominatingKey]).sort(),
    })),
  };
  return createHash("sha256").update(JSON.stringify(keyMaterial)).digest("hex");
}

function bruteForceBaseConversions(initial: {
  credits: number;
  ores: number;
  knowledge: number;
  qics: number;
  area1: number;
}): string[] {
  type Wallet = typeof initial;
  const key = (state: Wallet) => [state.credits, state.ores, state.knowledge, state.qics, state.area1, 0, 0].join("/");
  const seen = new Map<string, Wallet>([[key(initial), initial]]);
  const queue: Wallet[] = [initial];
  while (queue.length > 0) {
    const state = queue.shift() as Wallet;
    const next: Wallet[] = [];
    if (state.qics >= 1) {
      next.push({ ...state, qics: state.qics - 1, ores: state.ores + 1 });
    }
    if (state.knowledge >= 1) {
      next.push({ ...state, knowledge: state.knowledge - 1, credits: state.credits + 1 });
    }
    if (state.ores >= 1) {
      next.push({ ...state, ores: state.ores - 1, credits: state.credits + 1 });
      next.push({ ...state, ores: state.ores - 1, area1: state.area1 + 1 });
    }
    for (const candidate of next) {
      const candidateKey = key(candidate);
      if (!seen.has(candidateKey)) {
        seen.set(candidateKey, candidate);
        queue.push(candidate);
      }
    }
  }
  return Array.from(seen.keys()).sort();
}

function candidateByCommand(engine: Engine, command: Command): AtomicDecisionCandidate {
  const candidate = expandAtomicDecisions(engine).candidates.find((entry) => entry.command === command);
  expect(candidate, `candidate ${command}`).not.to.equal(undefined);
  return candidate;
}

describe("Phase 1.3 offline resource-conversion planner", () => {
  it("matches an independent tiny bounded brute-force conversion oracle", () => {
    const source = smallWallet(hadschHallasTurn(), { ores: 2, knowledge: 1, qics: 1 });
    const result = planResourceConversions(source);
    const actual = result.reachableStates.map(walletKey).sort();
    const expected = bruteForceBaseConversions({ credits: 0, ores: 2, knowledge: 1, qics: 1, area1: 0 });

    expect(actual).to.deep.equal(expected);
    expect(result.diagnostics.lossyCycles).to.have.length(0);
  });

  it("models Xenos ore-to-Area-III and replays its executable fragment", () => {
    const source = smallWallet(lockedRoundOneEngine(), { ores: 1 });
    const result = planResourceConversions(source);
    const plan = result.reachablePlans.find(
      (entry) => entry.moveFragments.length === 1 && entry.moveFragments[0] === "spend 1o for 1ta3"
    );
    expect(plan).not.to.equal(undefined);
    const destination = result.reachableStates.find(
      (state) => canonicalConversionStateKey(state) === plan.destinationStateKey
    );
    expect(destination.ores).to.equal(0);
    expect(destination.power.area3).to.equal(1);

    const replay = hydrate(source);
    replay.move(`${actorPrefix(replay)} ${plan.moveFragments.join(". ")}`);
    expect(replay.player(replay.playerToMove).data.ores).to.equal(destination.ores);
    expect(replay.player(replay.playerToMove).data.power.area3).to.equal(destination.power.area3);
  });

  it("keeps Hadsch Halla credit conversions gated by its Planetary Institute", () => {
    const before = smallWallet(hadschHallasTurn(), { credits: 4 });
    const beforeResult = planResourceConversions(before);
    expect(beforeResult.reachablePlans.some((plan) => plan.moveFragments.includes("spend 4c for 1q"))).to.equal(false);

    const after = hydrate(before);
    after.player(after.playerToMove).data.buildings[Building.PlanetaryInstitute] = 1;
    after.players.forEach((player) => {
      player.federationCache = null;
    });
    after.clearAvailableCommands();
    const afterResult = planResourceConversions(after);
    expect(afterResult.reachablePlans.some((plan) => plan.moveFragments.includes("spend 4c for 1q"))).to.equal(true);
    expect(afterResult.reachableStates.some((state) => state.credits === 0 && state.qics === 1)).to.equal(true);
  });

  it("keeps burn and wait nondominated and uses burn to expose a typed main action", () => {
    const source = smallWallet(lockedRoundOneEngine(), { area2: 8 });
    const affordable = smallWallet(hydrate(source), { area3: 4 });
    const target = candidateByCommand(affordable, Command.Action);
    expect(expandAtomicDecisions(source).candidates.some((entry) => entry.key === target.key)).to.equal(false);

    const result = planResourceConversions(source, { mainCandidates: [target] });
    expect(result.largestConversionDepth).to.equal(8);
    expect(result.stateFrontier.frontier.some((state) => state.power.area2 === 8 && state.power.area3 === 0)).to.equal(
      true
    );
    expect(result.stateFrontier.frontier.some((state) => state.power.area2 === 0 && state.power.area3 === 4)).to.equal(
      true
    );
    const candidate = result.candidates.find((entry) => entry.candidate.key === target.key);
    expect(candidate).not.to.equal(undefined);
    expect(candidate.plans.some((plan) => plan.steps.filter((step) => step.kind === "burn").length === 4)).to.equal(
      true
    );
    expect(
      candidate.payments.frontier.some(
        (payment) => payment.postPaymentState.power.area1 === 4 && payment.postPaymentState.power.area3 === 0
      )
    ).to.equal(true);
  });

  it("reaches depths above two without a depth cap and canonicalizes ranged aliases", () => {
    const source = smallWallet(lockedRoundOneEngine(), { ores: 3 });
    const result = planResourceConversions(source);

    expect(result.largestConversionDepth).to.be.at.least(3);
    expect(
      result.reachablePlans.some(
        (plan) => plan.steps.filter((step) => step.moveFragments[0] === "spend 1o for 1ta3").length === 3
      )
    ).to.equal(true);
    expect(
      result.diagnostics.aliases.some(
        (entry) => entry.moveFragment === "spend 2o for 2ta3" && entry.canonicalUnitFragment === "spend 1o for 1ta3"
      )
    ).to.equal(true);
  });

  it("keeps brainstone payment branches distinct and replays brainstone burn exactly", () => {
    const spendSource = smallWallet(lockedRoundOneEngine(), { area3: 4 });
    spendSource.player(spendSource.playerToMove).data.brainstone = PowerArea.Area3;
    const spend = planResourceConversions(spendSource);
    const qicStates = spend.reachablePlans
      .filter((plan) => plan.moveFragments[0] === "spend 4pw for 1q")
      .map((plan) =>
        spend.reachableStates.find((state) => canonicalConversionStateKey(state) === plan.destinationStateKey)
      );
    expect(qicStates.some((state) => state.power.brainstone === PowerArea.Area1)).to.equal(true);
    expect(qicStates.some((state) => state.power.brainstone === PowerArea.Area3)).to.equal(true);
    expect(spend.reachablePlans.some((plan) => plan.moveFragments.includes("brainstone area1"))).to.equal(true);
    expect(spend.reachablePlans.some((plan) => plan.moveFragments.includes("brainstone area3"))).to.equal(true);

    const burnSource = smallWallet(lockedRoundOneEngine(), { area2: 1 });
    burnSource.player(burnSource.playerToMove).data.brainstone = PowerArea.Area2;
    const burn = planResourceConversions(burnSource);
    const burnPlan = burn.reachablePlans.find(
      (plan) => plan.moveFragments.length === 1 && plan.moveFragments[0] === "burn 1"
    );
    const destination = burn.reachableStates.find(
      (state) => canonicalConversionStateKey(state) === burnPlan.destinationStateKey
    );
    expect(destination.power.brainstone).to.equal(PowerArea.Area3);
    expect(destination.power.area2).to.equal(0);
    const replay = hydrate(burnSource);
    replay.move(`${actorPrefix(replay)} burn 1`);
    expect(replay.player(replay.playerToMove).data.brainstone).to.equal(PowerArea.Area3);
    expect(replay.player(replay.playerToMove).data.power.area2).to.equal(0);
  });

  it("merges commutative orders into one semantic state and plan key", () => {
    const source = smallWallet(hadschHallasTurn(), { knowledge: 1, qics: 1 });
    const result = planResourceConversions(source);
    const merge = result.diagnostics.merges.find(
      (entry) =>
        entry.reason === "commutative-order" &&
        entry.keptMoveFragments.includes("spend 1k for 1c") &&
        entry.mergedMoveFragments.includes("spend 1q for 1o")
    );
    expect(merge).not.to.equal(undefined);
    const plan = result.reachablePlans.find((entry) => entry.key === merge.keptPlanKey);
    expect(plan.destinationStateKey).to.equal(merge.destinationStateKey);
    expect(
      canonicalConversionPlanKey({
        sourceStateKey: plan.sourceStateKey,
        destinationStateKey: plan.destinationStateKey,
        timing: plan.timing,
      })
    ).to.equal(plan.key);
  });

  it("detects Hadsch Halla lossy cycles and preserves every nondominated outcome", () => {
    const source = smallWallet(hadschHallasTurn(), { credits: 4 });
    source.player(source.playerToMove).data.buildings[Building.PlanetaryInstitute] = 1;
    source.clearAvailableCommands();
    const result = planResourceConversions(source);

    expect(result.diagnostics.lossyCycles.length).to.be.greaterThan(0);
    expect(
      result.diagnostics.lossyCycles.some(
        (cycle) => cycle.resourceCycle.includes(Resource.Credit) && cycle.resourceCycle.includes(Resource.Ore)
      )
    ).to.equal(true);
    expect(result.stateFrontier.frontier.some((state) => state.credits === 4)).to.equal(true);
    expect(
      result.reachableStates.some(
        (state) =>
          state.credits === 1 &&
          state.qics === 0 &&
          state.ores === 0 &&
          state.knowledge === 0 &&
          state.power.area1 === 0 &&
          state.power.area2 === 0 &&
          state.power.area3 === 0
      )
    ).to.equal(false);
  });

  it("models final-round conversions without assigning resource values", () => {
    const source = smallWallet(hadschHallasTurn(), { qics: 1 });
    source.round = Round.LastRound;
    const result = planResourceConversions(source);

    expect(result.reachableStates.every((state) => state.finalRound)).to.equal(true);
    expect(
      result.reachableStates.some((state) => state.qics === 0 && state.ores === 0 && state.credits === 1)
    ).to.equal(true);
  });

  it("retains post-action bowl opening before leech and defers ordinary conversions", () => {
    const source = smallWallet(lockedRoundOneEngine(), { ores: 1, knowledge: 4 });
    const main = candidateByCommand(source, Command.UpgradeResearch);
    const result = planAfterActionConversions(source, main);

    expect(result.status).to.equal("planned");
    expect(
      result.retained.some(
        (entry) =>
          entry.reason === "opens-power-bowl-capacity-before-leech" &&
          entry.leechCapacityAfter > entry.leechCapacityBefore &&
          entry.plan.moveFragments.includes("spend 1o for 1ta3") &&
          entry.plan.moveFragments.includes("spend 1pw for 1c")
      )
    ).to.equal(true);
    expect(
      result.deferred.some((entry) => entry.reason === "ordinary-resources-unobservable-before-next-before-move")
    ).to.equal(true);
  });

  it("keeps state and plan keys stable across replay, slow motion, hydration, and object ordering", () => {
    const base = lockedRoundOneEngine();
    const constructorReplay = new Engine(base.moveHistory, challengeEngineOptions(), base.version);
    const slowMotion = Engine.slowMotion(base.moveHistory, challengeEngineOptions(), base.version);
    const hydration = hydrate(base);
    const sources = [base, constructorReplay, slowMotion, hydration].map((engine) => smallWallet(engine, { ores: 1 }));
    const results = sources.map((engine) => planResourceConversions(engine));
    const stateKeys = results.map((result) => result.reachableStates.map(canonicalConversionStateKey).sort());
    const planKeys = results.map((result) => result.reachablePlans.map((plan) => plan.key).sort());
    expect(stateKeys.slice(1).every((keys) => JSON.stringify(keys) === JSON.stringify(stateKeys[0]))).to.equal(true);
    expect(planKeys.slice(1).every((keys) => JSON.stringify(keys) === JSON.stringify(planKeys[0]))).to.equal(true);

    const reordered = JSON.parse(JSON.stringify(results[0].reachableStates[0]));
    reordered.conversionRights.reverse();
    expect(canonicalConversionStateKey(reordered)).to.equal(canonicalConversionStateKey(results[0].reachableStates[0]));
  });

  it("completes the untouched locked state with stable exhaustive keys and executable unit fragments", function () {
    this.timeout(10 * 60 * 1000);
    const base = lockedRoundOneEngine();
    const sources = [
      base,
      new Engine(base.moveHistory, challengeEngineOptions(), base.version),
      Engine.slowMotion(base.moveHistory, challengeEngineOptions(), base.version),
      hydrate(base),
    ];
    const expectedDigest = "b4e266ef95ca8cc34cfd1cde4380a782ff01f4802a077d49ac9686924e222850";

    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const result = planResourceConversions(sources[sourceIndex]);
      expect(result.reachableStates).to.have.length(36_159);
      expect(result.reachablePlans).to.have.length(36_159);
      expect(result.stateFrontier.frontier).to.have.length(9_985);
      expect(result.candidates).to.have.length(45);
      expect(result.largestConversionDepth).to.equal(30);
      expect(result.diagnostics.merges).to.have.length(85_126);
      expect(result.diagnostics.lossyCycles).to.have.length(0);
      expect(result.diagnostics.paretoPruned).to.have.length(56_139);
      expect(result.diagnostics.aliases).to.have.length(111);
      expect(result.profile.counters.statesGenerated).to.equal(151_249);
      expect(result.profile.counters.statesAccepted).to.equal(36_159);
      expect(result.profile.counters.transitionsConsidered).to.equal(254_360);
      expect(result.profile.counters.activeFrontierSize).to.equal(9_985);
      expect(result.profile.counters.candidateStatesExpanded).to.equal(9_985);
      expect(result.profile.counters.paymentResultsGenerated).to.equal(130_532);
      expect(planningResultKeyDigest(result)).to.equal(expectedDigest);

      if (sourceIndex === 0) {
        const states = new Map(result.reachableStates.map((state) => [canonicalConversionStateKey(state), state]));
        const representatives = new Map<string, (typeof result.reachablePlans)[number]>();
        for (const plan of result.reachablePlans) {
          const step = plan.steps[plan.steps.length - 1];
          if (step) {
            const signature = `${step.familyKey}\0${step.moveFragments.join(". ")}`;
            representatives.set(signature, plan);
          }
        }
        const representativeFragments = new Set(
          Array.from(representatives.values()).map((plan) => plan.steps[plan.steps.length - 1].moveFragments[0])
        );
        for (const alias of result.diagnostics.aliases) {
          expect(representativeFragments.has(alias.canonicalUnitFragment), alias.canonicalUnitFragment).to.equal(true);
        }
        for (const plan of representatives.values()) {
          const replay = hydrate(base);
          replay.move(`${actorPrefix(replay)} ${plan.moveFragments.join(". ")}`);
          const destination = states.get(plan.destinationStateKey);
          const data = replay.player(replay.playerToMove).data;
          expect({
            credits: data.credits,
            ores: data.ores,
            knowledge: data.knowledge,
            qics: data.qics,
            victoryPoints: data.victoryPoints,
            area1: data.power.area1,
            area2: data.power.area2,
            area3: data.power.area3,
            gaia: data.power.gaia,
            brainstone: data.brainstone,
          }).to.deep.equal({
            credits: destination.credits,
            ores: destination.ores,
            knowledge: destination.knowledge,
            qics: destination.qics,
            victoryPoints: destination.victoryPoints,
            area1: destination.power.area1,
            area2: destination.power.area2,
            area3: destination.power.area3,
            gaia: destination.power.gaia,
            brainstone: destination.power.brainstone,
          });
        }
      }
    }
  });

  it("rejects unsupported faction-picking variants and incomplete external states", () => {
    const variants = [
      (engine: Engine) => {
        engine.options.randomFactions = true;
      },
      (engine: Engine) => {
        engine.options.banPhase = true;
      },
      (engine: Engine) => {
        engine.options.auction = AuctionVariant.ChooseBid;
      },
      (engine: Engine) => {
        engine.silentAuctionBids = [{ player: Player.Player1, bids: [0, 0] }] as any;
      },
    ];
    for (const mutate of variants) {
      const source = smallWallet(lockedRoundOneEngine(), {});
      mutate(source);
      expect(() => planResourceConversions(source)).to.throw();
    }
    const incomplete = smallWallet(lockedRoundOneEngine(), {});
    incomplete.newTurn = false;
    expect(() => planResourceConversions(incomplete)).to.throw();
  });

  it("rejects the committed Phase 0 setup state outside the RoundMove boundary", () => {
    const challenge = new Engine(LOST_FLEET_CHALLENGE.scriptedPrefix, challengeEngineOptions());
    expect(challenge.phase).to.equal(Phase.SetupBuilding);
    expect(() => planResourceConversions(challenge)).to.throw(ResourceConversionPlannerError);
  });

  it("leaves the locked Phase 1.2 candidate count, keys, digest, and fragments unchanged", () => {
    const source = lockedRoundOneEngine();
    const before = expandAtomicDecisions(source).candidates;
    expect(before).to.have.length(62);
    const digest = createHash("sha256")
      .update(
        before
          .map((candidate) => candidate.key)
          .sort()
          .join("\n")
      )
      .digest("hex");
    expect(digest).to.equal("a28eb3d03e2b51e1bea28170b92f5e99991f41c76b1b1c8a2193a97a0ee704d9");
    for (const candidate of before) {
      expect(candidate.moveFragment).to.be.a("string").and.not.equal("");
    }
    expect(expandAtomicDecisions(source).candidates.map((candidate) => candidate.key)).to.deep.equal(
      before.map((candidate) => candidate.key)
    );
  });
});
