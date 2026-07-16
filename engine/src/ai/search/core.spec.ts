import { expect } from "chai";
import "mocha";
import { FixedFrameActor, FixedFrameSearch, SearchCandidate, SearchDomain, SearchRootActionDiagnostics } from "./core";

interface ReferenceAction {
  key: string;
  next: string;
  prior: number;
}

interface ReferenceState {
  key: string;
  actor: FixedFrameActor | null;
  value: number;
  terminal: number | null;
  actions: ReferenceAction[];
}

class ReferenceDomain implements SearchDomain<ReferenceState, ReferenceAction> {
  parityCalls = 0;

  constructor(private readonly states: Map<string, ReferenceState>) {}

  stateKey(state: ReferenceState): string {
    return state.key;
  }

  actor(state: ReferenceState): FixedFrameActor | null {
    return state.actor;
  }

  terminalValue(state: ReferenceState): number | null {
    return state.terminal;
  }

  evaluate(state: ReferenceState): number {
    return state.value;
  }

  expand(state: ReferenceState): Array<SearchCandidate<ReferenceState, ReferenceAction>> {
    return state.actions.map((action) => {
      const destination = this.states.get(action.next);
      if (!destination) {
        throw new Error(`Missing reference state ${action.next}`);
      }
      return {
        key: action.key,
        action,
        state: destination,
        value: destination.terminal ?? destination.value,
        prior: action.prior,
      };
    });
  }

  assertTranspositionParity(retained: ReferenceState, candidate: ReferenceState): void {
    this.parityCalls += 1;
    expect(candidate.key).to.equal(retained.key);
    expect(candidate.actor).to.equal(retained.actor);
    expect(candidate.terminal).to.equal(retained.terminal);
    expect(candidate.value).to.equal(retained.value);
    expect(candidate.actions.map((action) => action.key).sort()).to.deep.equal(
      retained.actions.map((action) => action.key).sort()
    );
  }
}

function state(
  key: string,
  actor: FixedFrameActor | null,
  value: number,
  terminal: number | null,
  actions: ReferenceAction[] = []
): ReferenceState {
  return { key, actor, value, terminal, actions };
}

function action(key: string, next: string, prior: number): ReferenceAction {
  return { key, next, prior };
}

function map(states: ReferenceState[]): Map<string, ReferenceState> {
  return new Map(states.map((entry): [string, ReferenceState] => [entry.key, entry]));
}

function actionDiagnostics(actions: SearchRootActionDiagnostics[], key: string): SearchRootActionDiagnostics {
  const diagnostics = actions.find((entry) => entry.key === key);
  if (!diagnostics) {
    throw new Error(`Missing diagnostics for ${key}`);
  }
  return diagnostics;
}

describe("Phase 2 fixed-frame reference search", () => {
  it("maximizes and minimizes by the actual actor, including a repeated actor", () => {
    const states = map([
      state("root", 0, 0, null, [action("repeat", "seat0-again", 0.5), action("switch", "seat1", 0.5)]),
      state("seat0-again", 0, 0, null, [action("good", "plus-nine", 0.5), action("bad", "minus-two", 0.5)]),
      state("seat1", 1, 0, null, [action("allow-eight", "plus-eight", 0.5), action("force-one", "plus-one", 0.5)]),
      state("plus-nine", null, 9, 9),
      state("minus-two", null, -2, -2),
      state("plus-eight", null, 8, 8),
      state("plus-one", null, 1, 1),
    ]);
    const search = new FixedFrameSearch(new ReferenceDomain(states), {
      simulations: 256,
      explorationConstant: 1,
    });
    const result = search.search(states.get("root"));
    expect(result.actionKey).to.equal("repeat");
    expect(result.diagnostics.deterministic.principalVariation.slice(0, 2)).to.deep.equal(["repeat", "good"]);
    expect(actionDiagnostics(result.diagnostics.deterministic.rootActions, "repeat").meanValue).to.be.greaterThan(
      actionDiagnostics(result.diagnostics.deterministic.rootActions, "switch").meanValue
    );
  });

  it("uses exact terminal margins and never negates the fixed seat-0 value", () => {
    const states = map([
      state("leech-switch", 1, 100, null, [
        action("seat0-plus-five", "plus-five", 0.5),
        action("seat0-minus-four", "minus-four", 0.5),
      ]),
      state("plus-five", null, 5, 5),
      state("minus-four", null, -4, -4),
    ]);
    const result = new FixedFrameSearch(new ReferenceDomain(states), { simulations: 32 }).search(
      states.get("leech-switch")
    );
    expect(result.actionKey).to.equal("seat0-minus-four");
    expect(result.diagnostics.deterministic.selectedMeanValue).to.equal(-4);
  });

  it("breaks exact ties by canonical action key and conserves every simulation", () => {
    const states = map([
      state("root", 0, 0, null, [action("z-key", "same-z", 0.5), action("a-key", "same-a", 0.5)]),
      state("same-z", null, 3, 3),
      state("same-a", null, 3, 3),
    ]);
    const result = new FixedFrameSearch(new ReferenceDomain(states), { simulations: 20 }).search(states.get("root"));
    expect(result.actionKey).to.equal("a-key");
    expect(result.diagnostics.deterministic.completedSimulations).to.equal(20);
    expect(result.diagnostics.deterministic.rootActions.reduce((sum, edge) => sum + edge.visitDelta, 0)).to.equal(20);
  });

  it("scales fixed-frame Q into PUCT exploration units without changing raw diagnostics", () => {
    const states = map([
      state("root", 0, 0, null, [action("high-value", "high", 0.01), action("high-prior", "prior", 0.99)]),
      state("high", null, 10, 10),
      state("prior", null, 8, 8),
    ]);
    const raw = new FixedFrameSearch(new ReferenceDomain(states), { simulations: 1 }).search(states.get("root"));
    const scaled = new FixedFrameSearch(new ReferenceDomain(states), {
      simulations: 1,
      puctValueScale: 10,
    }).search(states.get("root"));
    expect(raw.actionKey).to.equal("high-value");
    expect(scaled.actionKey).to.equal("high-prior");
    expect(scaled.diagnostics.deterministic.puctValueScale).to.equal(10);
    expect(scaled.diagnostics.deterministic.selectedMeanValue).to.equal(8);
    expect(() => new FixedFrameSearch(new ReferenceDomain(states), { simulations: 1, puctValueScale: 0 })).to.throw(
      "puctValueScale must be positive"
    );
  });

  it("allocates seeded Gumbel sequential halving deterministically at a fixed budget", () => {
    const states = map([
      state("root", 0, 0, null, [
        action("a", "a-terminal", 0.4),
        action("b", "b-terminal", 0.3),
        action("c", "c-terminal", 0.2),
        action("d", "d-terminal", 0.1),
      ]),
      state("a-terminal", null, 2, 2),
      state("b-terminal", null, 1, 1),
      state("c-terminal", null, 0, 0),
      state("d-terminal", null, -1, -1),
    ]);
    const options = {
      simulations: 17,
      mode: "gumbel-sequential-halving" as const,
      seed: "ai-7-gumbel-reference",
      gumbelMaxActions: 4,
    };
    const first = new FixedFrameSearch(new ReferenceDomain(states), options).search(states.get("root"));
    const second = new FixedFrameSearch(new ReferenceDomain(states), options).search(states.get("root"));
    expect(second.diagnostics.deterministic).to.deep.equal(first.diagnostics.deterministic);
    expect(first.diagnostics.deterministic.completedSimulations).to.equal(17);
    expect(
      first.diagnostics.deterministic.rootActions.reduce((sum, edge) => sum + edge.sequentialHalvingVisits, 0)
    ).to.equal(17);
    expect(first.diagnostics.deterministic.rootActions.filter((edge) => edge.gumbel !== undefined)).to.have.length(4);
  });

  it("retains a selected subtree and agrees with a fresh tree on the next decision", () => {
    const states = map([
      state("root", 0, 0, null, [action("advance", "next", 1)]),
      state("next", 1, 0, null, [action("low", "low-terminal", 0.5), action("high", "high-terminal", 0.5)]),
      state("low-terminal", null, -3, -3),
      state("high-terminal", null, 7, 7),
    ]);
    const reused = new FixedFrameSearch(new ReferenceDomain(states), { simulations: 8 });
    const first = reused.search(states.get("root"));
    reused.advanceSelectedAction(first.actionKey);
    const reusedResult = reused.search(states.get("next"));
    const freshResult = new FixedFrameSearch(new ReferenceDomain(states), { simulations: 8 }).search(
      states.get("next")
    );
    expect(reusedResult.diagnostics.deterministic.reuse.kind).to.equal("same-root");
    expect(reusedResult.diagnostics.deterministic.reuse.availableVisits).to.be.greaterThan(0);
    expect(reusedResult.diagnostics.deterministic.reuse.reusedVisits).to.be.greaterThan(0);
    expect(reusedResult.actionKey).to.equal(freshResult.actionKey);
    expect(reusedResult.actionKey).to.equal("low");
    expect(reusedResult.diagnostics.deterministic.rootActions.map((edge) => edge.key)).to.deep.equal(
      freshResult.diagnostics.deterministic.rootActions.map((edge) => edge.key)
    );
  });

  it("can preserve an expanded subtree while resetting its retained search moments", () => {
    const states = map([
      state("root", 0, 0, null, [action("advance", "next", 1)]),
      state("next", 1, 0, null, [action("low", "low-terminal", 0.5), action("high", "high-terminal", 0.5)]),
      state("low-terminal", null, -3, -3),
      state("high-terminal", null, 7, 7),
    ]);
    const search = new FixedFrameSearch(new ReferenceDomain(states), {
      simulations: 8,
      rootReuseVisitPolicy: "reset-subtree",
    });
    const first = search.search(states.get("root"));
    search.advanceSelectedAction(first.actionKey);
    const result = search.search(states.get("next"));
    expect(result.actionKey).to.equal("low");
    expect(result.diagnostics.deterministic.rootReuseVisitPolicy).to.equal("reset-subtree");
    expect(result.diagnostics.deterministic.reuse.kind).to.equal("same-root");
    expect(result.diagnostics.deterministic.reuse.availableVisits).to.be.greaterThan(0);
    expect(result.diagnostics.deterministic.reuse.reusedVisits).to.equal(0);
    expect(result.diagnostics.deterministic.reuse.reusedNodes).to.be.greaterThan(1);
    expect(result.diagnostics.deterministic.rootVisits).to.equal(8);
  });

  it("guards transpositions and preserves legal/value decisions when the DAG is ablated", () => {
    const states = map([
      state("root", 0, 0, null, [action("left", "shared", 0.5), action("right", "shared", 0.5)]),
      state("shared", 1, 0, null, [
        action("minimum", "minimum-terminal", 0.5),
        action("maximum", "maximum-terminal", 0.5),
      ]),
      state("minimum-terminal", null, -6, -6),
      state("maximum-terminal", null, 4, 4),
    ]);
    const guardedDomain = new ReferenceDomain(states);
    const dag = new FixedFrameSearch(guardedDomain, { simulations: 64, transpositions: true }).search(
      states.get("root")
    );
    const tree = new FixedFrameSearch(new ReferenceDomain(states), { simulations: 64, transpositions: false }).search(
      states.get("root")
    );
    expect(dag.diagnostics.deterministic.transpositions.hits).to.be.greaterThan(0);
    expect(dag.diagnostics.deterministic.transpositions.parityChecks).to.equal(guardedDomain.parityCalls);
    expect(guardedDomain.parityCalls).to.be.greaterThan(0);
    expect(dag.actionKey).to.equal(tree.actionKey);
    expect(dag.diagnostics.deterministic.rootActions.map((edge) => edge.key)).to.deep.equal(
      tree.diagnostics.deterministic.rootActions.map((edge) => edge.key)
    );
    expect(dag.diagnostics.deterministic.selectedMeanValue).to.be.lessThan(0);
    expect(tree.diagnostics.deterministic.selectedMeanValue).to.be.lessThan(0);
  });
});
