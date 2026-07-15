export type FixedFrameActor = 0 | 1;

export type SearchMode = "puct" | "gumbel-sequential-halving";

export type RootReuseVisitPolicy = "retain" | "reset-subtree";

export interface SearchPriorDetails {
  policy: string;
  rawValue: number;
  orientedValue: number;
  centeredValue: number;
  temperature: number;
}

export interface SearchCandidate<State, Action> {
  key: string;
  action: Action;
  state: State;
  /** Exact terminal value or the fixed-frame heuristic value of the child. */
  value: number;
  prior: number;
  priorDetails?: SearchPriorDetails;
}

export interface SearchDomain<State, Action> {
  stateKey(state: State): string;
  actor(state: State): FixedFrameActor | null;
  terminalValue(state: State): number | null;
  evaluate(state: State): number;
  expand(state: State): SearchCandidate<State, Action>[];
  /** Required guard when transpositions are enabled. It must throw on any semantic mismatch. */
  assertTranspositionParity?(retained: State, candidate: State): void;
}

export interface SearchOptions {
  simulations: number;
  mode?: SearchMode;
  explorationConstant?: number;
  /** Divide fixed-frame Q values by this scale before adding dimensionless PUCT exploration. */
  puctValueScale?: number;
  /** Whether a promoted child keeps old search moments or only its expanded structure. */
  rootReuseVisitPolicy?: RootReuseVisitPolicy;
  seed?: string;
  gumbelMaxActions?: number;
  gumbelValueScale?: number;
  transpositions?: boolean;
}

export interface SearchRootActionDiagnostics {
  key: string;
  prior: number;
  visits: number;
  visitDelta: number;
  meanValue: number;
  standardDeviation: number;
  minimumValue: number;
  maximumValue: number;
  priorDetails?: SearchPriorDetails;
  gumbel?: number;
  sequentialHalvingVisits: number;
}

export interface SearchDeterministicDiagnostics {
  rootStateKey: string;
  rootActor: FixedFrameActor;
  mode: SearchMode;
  simulationBudget: number;
  completedSimulations: number;
  explorationConstant: number;
  puctValueScale: number;
  rootReuseVisitPolicy: RootReuseVisitPolicy;
  seed: string;
  selectedActionKey: string;
  selectedMeanValue: number;
  rootValue: number;
  rootVisits: number;
  expansions: number;
  expandedEdges: number;
  terminalLeaves: number;
  cycleStops: number;
  principalVariation: string[];
  rootActions: SearchRootActionDiagnostics[];
  reuse: {
    kind: "fresh" | "same-root" | "descendant" | "transposition-table";
    availableVisits: number;
    reusedVisits: number;
    reusedNodes: number;
  };
  transpositions: {
    enabled: boolean;
    hits: number;
    parityChecks: number;
  };
}

export interface SearchPerformanceDiagnostics {
  elapsedMs: number;
  expansionsPerSecond: number;
}

export interface SearchDiagnostics {
  deterministic: SearchDeterministicDiagnostics;
  performance: SearchPerformanceDiagnostics;
}

export interface SearchResult<Action> {
  action: Action;
  actionKey: string;
  diagnostics: SearchDiagnostics;
}

interface SearchNode<State, Action> {
  key: string;
  state: State;
  actor: FixedFrameActor | null;
  terminalValue: number | null;
  leafValue: number;
  visits: number;
  valueSum: number;
  valueSquareSum: number;
  minimumValue: number;
  maximumValue: number;
  edges: Array<SearchEdge<State, Action>> | null;
}

interface SearchEdge<State, Action> {
  key: string;
  action: Action;
  prior: number;
  priorDetails?: SearchPriorDetails;
  child: SearchNode<State, Action>;
  visits: number;
  valueSum: number;
  valueSquareSum: number;
  minimumValue: number;
  maximumValue: number;
}

interface SearchCallCounters {
  expansions: number;
  expandedEdges: number;
  terminalLeaves: number;
  cycleStops: number;
  transpositionHits: number;
  parityChecks: number;
}

interface RootPreparation {
  kind: SearchDeterministicDiagnostics["reuse"]["kind"];
  availableVisits: number;
  reusedVisits: number;
  reusedNodes: number;
}

interface PendingAdvance {
  key: string;
  availableVisits: number;
  reusedNodes: number;
}

interface GumbelAllocation<State, Action> {
  selected: SearchEdge<State, Action>;
  samples: Map<string, number>;
  allocatedVisits: Map<string, number>;
}

const DEFAULT_EXPLORATION_CONSTANT = 1.25;
const DEFAULT_PUCT_VALUE_SCALE = 1;
const DEFAULT_GUMBEL_VALUE_SCALE = 0.12;
const MIN_RANDOM = 1e-12;
const VALUE_EPSILON = 1e-9;

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function mean(visits: number, sum: number, fallback: number): number {
  return visits === 0 ? fallback : sum / visits;
}

function standardDeviation(visits: number, sum: number, squareSum: number): number {
  if (visits <= 1) {
    return 0;
  }
  const average = sum / visits;
  return Math.sqrt(Math.max(0, squareSum / visits - average * average));
}

function updateMoments(
  target: {
    visits: number;
    valueSum: number;
    valueSquareSum: number;
    minimumValue: number;
    maximumValue: number;
  },
  value: number
): void {
  target.visits += 1;
  target.valueSum += value;
  target.valueSquareSum += value * value;
  target.minimumValue = Math.min(target.minimumValue, value);
  target.maximumValue = Math.max(target.maximumValue, value);
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small evaluation-only PRNG. Search never consumes the engine RNG. */
function deterministicRandom(seed: string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleGumbel(random: () => number): number {
  const uniform = Math.min(1 - MIN_RANDOM, Math.max(MIN_RANDOM, random()));
  return -Math.log(-Math.log(uniform));
}

function oriented(actor: FixedFrameActor, value: number): number {
  return actor === 0 ? value : -value;
}

export class FixedFrameSearch<State, Action> {
  private root: SearchNode<State, Action> | null = null;
  private readonly transpositionTable = new Map<string, SearchNode<State, Action>>();
  private readonly parityValidatedKeys = new Set<string>();
  private searchCount = 0;
  private pendingAdvance: PendingAdvance | null = null;

  constructor(private readonly domain: SearchDomain<State, Action>, private readonly options: SearchOptions) {
    assertPositiveInteger(options.simulations, "simulations");
    if ((options.explorationConstant ?? DEFAULT_EXPLORATION_CONSTANT) < 0) {
      throw new Error("explorationConstant must be non-negative");
    }
    if (
      !Number.isFinite(options.puctValueScale ?? DEFAULT_PUCT_VALUE_SCALE) ||
      (options.puctValueScale ?? DEFAULT_PUCT_VALUE_SCALE) <= 0
    ) {
      throw new Error("puctValueScale must be positive");
    }
    if (options.transpositions && !domain.assertTranspositionParity) {
      throw new Error("Transpositions require an assertTranspositionParity guard");
    }
  }

  search(state: State): SearchResult<Action> {
    const started = Date.now();
    const counters: SearchCallCounters = {
      expansions: 0,
      expandedEdges: 0,
      terminalLeaves: 0,
      cycleStops: 0,
      transpositionHits: 0,
      parityChecks: 0,
    };
    const preparation = this.prepareRoot(state);
    const root = this.root;
    if (!root || root.terminalValue !== null || root.actor === null) {
      throw new Error("Cannot search a terminal state or a state without an actor");
    }
    this.expandNode(root, counters);
    const rootEdges = root.edges;
    if (!rootEdges || rootEdges.length === 0) {
      throw new Error(`Search root ${root.key} has no legal actions`);
    }

    const beforeVisits = new Map<string, number>();
    for (const edge of rootEdges) {
      beforeVisits.set(edge.key, edge.visits);
    }

    const mode = this.options.mode ?? "puct";
    const seed = `${this.options.seed ?? "gaia-ai-7"}:${root.key}:${this.searchCount}`;
    let selected: SearchEdge<State, Action>;
    let gumbelSamples = new Map<string, number>();
    let sequentialHalvingVisits = new Map<string, number>();
    if (mode === "gumbel-sequential-halving") {
      const allocation = this.runSequentialHalving(root, seed, counters);
      selected = allocation.selected;
      gumbelSamples = allocation.samples;
      sequentialHalvingVisits = allocation.allocatedVisits;
    } else {
      for (let simulation = 0; simulation < this.options.simulations; simulation += 1) {
        this.simulate(root, null, counters);
      }
      selected = this.finalEdge(root);
    }
    this.searchCount += 1;

    const rootActions = rootEdges.map((edge): SearchRootActionDiagnostics => {
      const priorVisits = beforeVisits.get(edge.key) ?? 0;
      const details: SearchRootActionDiagnostics = {
        key: edge.key,
        prior: edge.prior,
        visits: edge.visits,
        visitDelta: edge.visits - priorVisits,
        meanValue: mean(edge.visits, edge.valueSum, edge.child.leafValue),
        standardDeviation: standardDeviation(edge.visits, edge.valueSum, edge.valueSquareSum),
        minimumValue: edge.visits === 0 ? edge.child.leafValue : edge.minimumValue,
        maximumValue: edge.visits === 0 ? edge.child.leafValue : edge.maximumValue,
        priorDetails: edge.priorDetails,
        sequentialHalvingVisits: sequentialHalvingVisits.get(edge.key) ?? 0,
      };
      const gumbel = gumbelSamples.get(edge.key);
      if (gumbel !== undefined) {
        details.gumbel = gumbel;
      }
      return details;
    });
    const completedSimulations = rootActions.reduce((sum, edge) => sum + edge.visitDelta, 0);
    if (completedSimulations !== this.options.simulations) {
      throw new Error(
        `Search budget accounting mismatch: completed ${completedSimulations}, expected ${this.options.simulations}`
      );
    }

    const elapsedMs = Math.max(0, Date.now() - started);
    return {
      action: selected.action,
      actionKey: selected.key,
      diagnostics: {
        deterministic: {
          rootStateKey: root.key,
          rootActor: root.actor,
          mode,
          simulationBudget: this.options.simulations,
          completedSimulations,
          explorationConstant: this.options.explorationConstant ?? DEFAULT_EXPLORATION_CONSTANT,
          puctValueScale: this.options.puctValueScale ?? DEFAULT_PUCT_VALUE_SCALE,
          rootReuseVisitPolicy: this.options.rootReuseVisitPolicy ?? "retain",
          seed,
          selectedActionKey: selected.key,
          selectedMeanValue: mean(selected.visits, selected.valueSum, selected.child.leafValue),
          rootValue: mean(root.visits, root.valueSum, root.leafValue),
          rootVisits: root.visits,
          expansions: counters.expansions,
          expandedEdges: counters.expandedEdges,
          terminalLeaves: counters.terminalLeaves,
          cycleStops: counters.cycleStops,
          principalVariation: this.principalVariation(root),
          rootActions,
          reuse: {
            kind: preparation.kind,
            availableVisits: preparation.availableVisits,
            reusedVisits: preparation.reusedVisits,
            reusedNodes: preparation.reusedNodes,
          },
          transpositions: {
            enabled: this.options.transpositions ?? false,
            hits: counters.transpositionHits,
            parityChecks: counters.parityChecks,
          },
        },
        performance: {
          elapsedMs,
          expansionsPerSecond: elapsedMs === 0 ? counters.expansions * 1000 : (counters.expansions * 1000) / elapsedMs,
        },
      },
    };
  }

  /** Retain the chosen child as the next expected committed root. */
  advanceSelectedAction(actionKey: string): void {
    if (!this.root || !this.root.edges) {
      throw new Error("Cannot advance an unexpanded search tree");
    }
    const selected = this.root.edges.find((edge) => edge.key === actionKey);
    if (!selected) {
      throw new Error(`Cannot advance unknown root action ${actionKey}`);
    }
    this.root = selected.child;
    this.pendingAdvance = {
      key: this.root.key,
      availableVisits: this.root.visits,
      reusedNodes: this.countReachable(this.root),
    };
    if (this.options.rootReuseVisitPolicy === "reset-subtree") {
      this.resetReachableMoments(this.root);
    }
    if (this.options.transpositions) {
      this.rebuildTranspositionTable();
    }
  }

  reset(): void {
    this.root = null;
    this.transpositionTable.clear();
    this.parityValidatedKeys.clear();
    this.searchCount = 0;
    this.pendingAdvance = null;
  }

  private prepareRoot(state: State): RootPreparation {
    const key = this.domain.stateKey(state);
    if (this.root && this.root.key === key) {
      if (this.pendingAdvance?.key === key) {
        const preparation = {
          kind: "same-root" as const,
          availableVisits: this.pendingAdvance.availableVisits,
          reusedVisits: this.root.visits,
          reusedNodes: this.pendingAdvance.reusedNodes,
        };
        this.pendingAdvance = null;
        return preparation;
      }
      return {
        kind: "same-root",
        availableVisits: this.root.visits,
        reusedVisits: this.root.visits,
        reusedNodes: this.countReachable(this.root),
      };
    }
    this.pendingAdvance = null;
    if (this.root) {
      const descendant = this.findReachable(this.root, key);
      if (descendant) {
        this.root = descendant;
        if (this.options.transpositions) {
          this.rebuildTranspositionTable();
        }
        return {
          kind: "descendant",
          availableVisits: descendant.visits,
          reusedVisits: descendant.visits,
          reusedNodes: this.countReachable(descendant),
        };
      }
    }
    if (this.options.transpositions) {
      const retained = this.transpositionTable.get(key);
      if (retained) {
        this.root = retained;
        this.rebuildTranspositionTable();
        return {
          kind: "transposition-table",
          availableVisits: retained.visits,
          reusedVisits: retained.visits,
          reusedNodes: this.countReachable(retained),
        };
      }
    }
    this.root = this.createNode(state);
    this.transpositionTable.clear();
    this.parityValidatedKeys.clear();
    if (this.options.transpositions) {
      this.transpositionTable.set(key, this.root);
    }
    return { kind: "fresh", availableVisits: 0, reusedVisits: 0, reusedNodes: 0 };
  }

  private createNode(state: State, suppliedValue?: number): SearchNode<State, Action> {
    const terminalValue = this.domain.terminalValue(state);
    const leafValue = terminalValue === null ? suppliedValue ?? this.domain.evaluate(state) : terminalValue;
    return {
      key: this.domain.stateKey(state),
      state,
      actor: terminalValue === null ? this.domain.actor(state) : null,
      terminalValue,
      leafValue,
      visits: 0,
      valueSum: 0,
      valueSquareSum: 0,
      minimumValue: Number.POSITIVE_INFINITY,
      maximumValue: Number.NEGATIVE_INFINITY,
      edges: null,
    };
  }

  private expandNode(node: SearchNode<State, Action>, counters: SearchCallCounters): void {
    if (node.edges !== null || node.terminalValue !== null) {
      return;
    }
    if (node.actor === null) {
      throw new Error(`Non-terminal search node ${node.key} has no actor`);
    }
    const candidates = [...this.domain.expand(node.state)].sort((left, right) => left.key.localeCompare(right.key));
    if (candidates.length === 0) {
      throw new Error(`Non-terminal search node ${node.key} has no legal actions`);
    }
    const keySet = new Set(candidates.map((candidate) => candidate.key));
    if (keySet.size !== candidates.length) {
      throw new Error(`Search node ${node.key} has duplicate action keys`);
    }
    const priorSum = candidates.reduce((sum, candidate) => sum + candidate.prior, 0);
    if (!Number.isFinite(priorSum) || Math.abs(priorSum - 1) > VALUE_EPSILON) {
      throw new Error(`Search priors at ${node.key} sum to ${priorSum}, expected 1`);
    }
    for (const candidate of candidates) {
      if (!Number.isFinite(candidate.value) || !Number.isFinite(candidate.prior) || candidate.prior < 0) {
        throw new Error(`Search candidate ${candidate.key} has a non-finite value or invalid prior`);
      }
    }
    node.edges = candidates.map(
      (candidate): SearchEdge<State, Action> => ({
        key: candidate.key,
        action: candidate.action,
        prior: candidate.prior,
        priorDetails: candidate.priorDetails,
        child: this.transposedChild(candidate, counters),
        visits: 0,
        valueSum: 0,
        valueSquareSum: 0,
        minimumValue: Number.POSITIVE_INFINITY,
        maximumValue: Number.NEGATIVE_INFINITY,
      })
    );
    counters.expansions += 1;
    counters.expandedEdges += node.edges.length;
  }

  private transposedChild(
    candidate: SearchCandidate<State, Action>,
    counters: SearchCallCounters
  ): SearchNode<State, Action> {
    const key = this.domain.stateKey(candidate.state);
    if (!this.options.transpositions) {
      return this.createNode(candidate.state, candidate.value);
    }
    const retained = this.transpositionTable.get(key);
    if (!retained) {
      const child = this.createNode(candidate.state, candidate.value);
      this.transpositionTable.set(key, child);
      return child;
    }
    if (
      retained.actor !== (retained.terminalValue === null ? this.domain.actor(candidate.state) : null) ||
      retained.terminalValue !== this.domain.terminalValue(candidate.state) ||
      Math.abs(retained.leafValue - candidate.value) > VALUE_EPSILON
    ) {
      throw new Error(`Transposition value/actor parity failed for ${key}`);
    }
    if (!this.parityValidatedKeys.has(key)) {
      if (!this.domain.assertTranspositionParity) {
        throw new Error("Missing transposition parity guard");
      }
      this.domain.assertTranspositionParity(retained.state, candidate.state);
      this.parityValidatedKeys.add(key);
      counters.parityChecks += 1;
    }
    counters.transpositionHits += 1;
    return retained;
  }

  private selectPuctEdge(node: SearchNode<State, Action>): SearchEdge<State, Action> {
    const edges = node.edges;
    if (!edges || node.actor === null) {
      throw new Error(`Cannot select from unexpanded node ${node.key}`);
    }
    const explorationConstant = this.options.explorationConstant ?? DEFAULT_EXPLORATION_CONSTANT;
    const puctValueScale = this.options.puctValueScale ?? DEFAULT_PUCT_VALUE_SCALE;
    let best = edges[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const edge of edges) {
      const value = mean(edge.visits, edge.valueSum, edge.child.leafValue);
      const exploration = (explorationConstant * edge.prior * Math.sqrt(Math.max(1, node.visits))) / (1 + edge.visits);
      const score = oriented(node.actor, value) / puctValueScale + exploration;
      if (score > bestScore || (score === bestScore && edge.key.localeCompare(best.key) < 0)) {
        best = edge;
        bestScore = score;
      }
    }
    return best;
  }

  private simulate(
    root: SearchNode<State, Action>,
    forcedRootEdge: SearchEdge<State, Action> | null,
    counters: SearchCallCounters
  ): number {
    const nodes: Array<SearchNode<State, Action>> = [root];
    const edges: Array<SearchEdge<State, Action>> = [];
    const pathKeys = new Set<string>([root.key]);
    let node = root;
    let first = true;
    while (node.terminalValue === null) {
      this.expandNode(node, counters);
      const edge = first && forcedRootEdge ? forcedRootEdge : this.selectPuctEdge(node);
      first = false;
      edges.push(edge);
      node = edge.child;
      if (pathKeys.has(node.key)) {
        counters.cycleStops += 1;
        break;
      }
      nodes.push(node);
      pathKeys.add(node.key);
      if (node.terminalValue !== null) {
        counters.terminalLeaves += 1;
        break;
      }
      if (node.edges === null) {
        this.expandNode(node, counters);
        break;
      }
    }
    const value = node.terminalValue ?? node.leafValue;
    for (const visited of nodes) {
      updateMoments(visited, value);
    }
    for (const edge of edges) {
      updateMoments(edge, value);
    }
    return value;
  }

  private runSequentialHalving(
    root: SearchNode<State, Action>,
    seed: string,
    counters: SearchCallCounters
  ): GumbelAllocation<State, Action> {
    const edges = root.edges;
    if (!edges || root.actor === null) {
      throw new Error("Cannot run root allocation on an unexpanded root");
    }
    const random = deterministicRandom(seed);
    const samples = new Map<string, number>();
    for (const edge of edges) {
      samples.set(edge.key, sampleGumbel(random));
    }
    const maxActions = Math.min(edges.length, this.options.simulations, this.options.gumbelMaxActions ?? edges.length);
    let feasibleActions = maxActions;
    while (
      feasibleActions > 1 &&
      feasibleActions * Math.max(1, Math.ceil(Math.log2(feasibleActions))) > this.options.simulations
    ) {
      feasibleActions -= 1;
    }
    assertPositiveInteger(feasibleActions, "gumbelMaxActions after budget restriction");
    let active = [...edges]
      .sort((left, right) => {
        const leftScore = Math.log(Math.max(MIN_RANDOM, left.prior)) + (samples.get(left.key) ?? 0);
        const rightScore = Math.log(Math.max(MIN_RANDOM, right.prior)) + (samples.get(right.key) ?? 0);
        return rightScore - leftScore || left.key.localeCompare(right.key);
      })
      .slice(0, feasibleActions);
    const allocatedVisits = new Map<string, number>();
    let remaining = this.options.simulations;
    while (active.length > 1 && remaining > 0) {
      const remainingRounds = Math.max(1, Math.ceil(Math.log2(active.length)));
      const roundBudget = Math.min(remaining, Math.max(active.length, Math.floor(remaining / remainingRounds)));
      const base = Math.floor(roundBudget / active.length);
      let extra = roundBudget % active.length;
      for (const edge of active) {
        const allocation = base + (extra > 0 ? 1 : 0);
        extra = Math.max(0, extra - 1);
        for (let simulation = 0; simulation < allocation; simulation += 1) {
          this.simulate(root, edge, counters);
        }
        allocatedVisits.set(edge.key, (allocatedVisits.get(edge.key) ?? 0) + allocation);
      }
      remaining -= roundBudget;
      const valueScale = this.options.gumbelValueScale ?? DEFAULT_GUMBEL_VALUE_SCALE;
      active.sort((left, right) => {
        const leftValue = mean(left.visits, left.valueSum, left.child.leafValue);
        const rightValue = mean(right.visits, right.valueSum, right.child.leafValue);
        const leftScore = (samples.get(left.key) ?? 0) + valueScale * oriented(root.actor, leftValue);
        const rightScore = (samples.get(right.key) ?? 0) + valueScale * oriented(root.actor, rightValue);
        return rightScore - leftScore || left.key.localeCompare(right.key);
      });
      active = active.slice(0, Math.ceil(active.length / 2));
    }
    const selected = active[0];
    while (remaining > 0) {
      this.simulate(root, selected, counters);
      allocatedVisits.set(selected.key, (allocatedVisits.get(selected.key) ?? 0) + 1);
      remaining -= 1;
    }
    return { selected, samples, allocatedVisits };
  }

  private finalEdge(node: SearchNode<State, Action>): SearchEdge<State, Action> {
    const edges = node.edges;
    if (!edges || node.actor === null) {
      throw new Error(`Cannot choose a final edge from ${node.key}`);
    }
    let best = edges[0];
    for (const edge of edges.slice(1)) {
      const edgeMean = mean(edge.visits, edge.valueSum, edge.child.leafValue);
      const bestMean = mean(best.visits, best.valueSum, best.child.leafValue);
      if (
        edge.visits > best.visits ||
        (edge.visits === best.visits && oriented(node.actor, edgeMean) > oriented(node.actor, bestMean)) ||
        (edge.visits === best.visits && edgeMean === bestMean && edge.key.localeCompare(best.key) < 0)
      ) {
        best = edge;
      }
    }
    return best;
  }

  private principalVariation(root: SearchNode<State, Action>): string[] {
    const variation: string[] = [];
    const seen = new Set<string>();
    let node: SearchNode<State, Action> | null = root;
    while (node && node.edges && node.edges.length > 0 && node.actor !== null && !seen.has(node.key)) {
      seen.add(node.key);
      const edge = this.finalEdge(node);
      if (edge.visits === 0) {
        break;
      }
      variation.push(edge.key);
      node = edge.child;
    }
    return variation;
  }

  private findReachable(root: SearchNode<State, Action>, key: string): SearchNode<State, Action> | null {
    const queue: Array<SearchNode<State, Action>> = [root];
    const visited = new Set<SearchNode<State, Action>>();
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || visited.has(node)) {
        continue;
      }
      if (node.key === key) {
        return node;
      }
      visited.add(node);
      if (node.edges) {
        queue.push(...node.edges.map((edge) => edge.child));
      }
    }
    return null;
  }

  private countReachable(root: SearchNode<State, Action>): number {
    const queue: Array<SearchNode<State, Action>> = [root];
    const visited = new Set<SearchNode<State, Action>>();
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || visited.has(node)) {
        continue;
      }
      visited.add(node);
      if (node.edges) {
        queue.push(...node.edges.map((edge) => edge.child));
      }
    }
    return visited.size;
  }

  private resetReachableMoments(root: SearchNode<State, Action>): void {
    const queue: Array<SearchNode<State, Action>> = [root];
    const visited = new Set<SearchNode<State, Action>>();
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || visited.has(node)) {
        continue;
      }
      visited.add(node);
      node.visits = 0;
      node.valueSum = 0;
      node.valueSquareSum = 0;
      node.minimumValue = Number.POSITIVE_INFINITY;
      node.maximumValue = Number.NEGATIVE_INFINITY;
      if (node.edges) {
        for (const edge of node.edges) {
          edge.visits = 0;
          edge.valueSum = 0;
          edge.valueSquareSum = 0;
          edge.minimumValue = Number.POSITIVE_INFINITY;
          edge.maximumValue = Number.NEGATIVE_INFINITY;
          queue.push(edge.child);
        }
      }
    }
  }

  private rebuildTranspositionTable(): void {
    this.transpositionTable.clear();
    if (!this.root) {
      return;
    }
    const queue: Array<SearchNode<State, Action>> = [this.root];
    const visited = new Set<SearchNode<State, Action>>();
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || visited.has(node)) {
        continue;
      }
      visited.add(node);
      this.transpositionTable.set(node.key, node);
      if (node.edges) {
        queue.push(...node.edges.map((edge) => edge.child));
      }
    }
  }
}
