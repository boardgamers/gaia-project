# Lost Fleet AI: offline foundation through Phase 1.3

This directory is an offline-only foundation for the fixed Lost Fleet AI challenge. It is deliberately
not exported from `engine/index.ts` and must not be imported by the viewer, hosted-game code, Supabase,
or another production entry point.

The directory currently contains:

- a versioned static challenge definition;
- a manifest generator that boots the real engine and projects the initialized challenge setup;
- a reproducible benchmark harness;
- a committed-state canonical projection and hash;
- typed atomic decision expansion and canonical candidate keys;
- an exhaustive resource-conversion planner with executable plans and Pareto frontiers;
- golden, smoke, parity, and applicability tests for those offline tools.

It does not contain committed-turn macro construction, search, evaluation, bots, feature encoding,
models, hosted routes, or production feature flags. Starting buildings and round boosters are
intentionally not part of the scripted challenge prefix: both remain strategic decisions.

## Safety invariants

1. Production code must never import from `src/ai/` during the live-game freeze.
2. The AI code may read public engine state and call existing engine APIs, but may not change engine
   rules, move processing, availability, serialization, hydration, or replay behavior.
3. The checked-in challenge manifest is generated from a real engine boot. Tile, map, ship, artifact,
   and effect values are not transcribed from strategy prose.
4. Benchmarks are descriptive baselines. Phase 0 has no machine-specific performance pass/fail gates.
5. The fuzz random player is used only for a labeled full-game benchmark workload. It is a sampler,
   not a complete legal-action enumerator.

## Offline commands

Run from `engine/`:

```text
npx ts-node scripts/ai/generate-challenge-manifest.ts
npx ts-node scripts/ai/benchmark.ts --warmup 5 --iterations 50 --random-games 1
```

Both commands write JSON to standard output by default. `--output <path>` is available for an explicit
offline artifact path. The benchmark also accepts `--random-warmup`, `--memory-clones`, and
`--skip-random-games`.

## Phase 1.1: canonical committed-state projection

`canonical-state.ts` adds an offline-only, versioned canonical projection and SHA-256 hash for
committed engine states. It is intentionally narrow:

- committed states only: `engine.newTurn === true`;
- initialized game states only: `phase !== setupInit`, `map` exists, players exist;
- non-replay instances only;
- standard faction-picking flow only: no auction variant, no random-factions flow, no ban phase;
- Lost Fleet states must carry their persisted setup-randomization fields (`lostFleetTerraformingRow`,
  `scoringExtensionSide`, `lostFleetEconomySide`);
- transient in-line prompt state is rejected (`turnMoves`, `pendingMove`, unresolved brainstone /
  reward-pick state, nonzero temporary range/step, nonzero `turns`).

Included state families:

- engine version plus supported game options that can still affect future behavior;
- phase, round, current/temp actors, turn orders, passed players, leech queue, last leech source;
- chosen faction order, board/spaceship action ownership, Lost Fleet setup choices, and remaining
  tile / token / artifact supplies;
- map placement plus every hex's future-relevant state;
- every player's faction / variant / resource / power / research / building / ship / exploration /
  federation / artifact / event state;
- `player.federationCache`, intentionally included despite the name because current engine behavior
  can diverge when that cache is stale.

Excluded or normalized fields:

- `availableCommands`, `availableCommand`: derived command caches, regenerated on demand;
- `moveHistory`, `advancedLog`, `silentAuctionLog`: replay / presentation / audit history only;
- `pendingMove`, `turnMoves`, `brainstoneDest`, `toPick`, `temporaryRange`, `temporaryStep`, `turns`:
  transient in-line state, rejected unless cleared;
- `oldPhase`, `processedPlayer`, `replayVersion`, `replay`, `subPhase`: unused or replay-only
  scaffolding under the supported-state contract;
- `map.rng`, `map.seed`, `map.distanceCache`: non-serializable RNG/cache state; future randomness is
  unsupported in Phase 1.1 outside the standard faction-picking flow, and distance is recomputed;
- `player.settings`, `player.name`, `player.declined`: UI / automation state, not future game rules
  under the committed-state contract;
- `player.data.occupied`: reconstructed from map hex occupancy;
- `engine.options.map`: duplicated by canonical map placement;
- `engine.options.auction`, `engine.options.randomFactions`, `engine.options.banPhase`,
  `engine.randomFactions`, `engine.bannedFactions`, `engine.silentAuctionBids`: unsupported
  faction-picking variants, rejected instead of canonicalized;
- semantically unordered collections are sorted in the projection (`tiles.artifacts`,
  `lostFleetCost3Planets`, `artifactPlanetTypes`, `usedTinkeringTiles`, hex membership lists).

## Phase 1.2: typed atomic decision expansion

`actions/expand.ts` regenerates legal commands on a clone of a supported Phase 1.1 committed state
and projects every executable `.data` option into the explicit discriminated union in
`actions/types.ts`. A caller may supply already-selected command fragments to expose the next
chained prompt; the committed root is still validated first, and Phase 1.2 never selects or plans
the prefix itself.

Every candidate carries:

- a SHA-256 canonical key over command, actor, phase/subphase, and normalized structured target;
- typed building, coordinate, research, tile, booster, spaceship, artifact, and Federation IDs as
  applicable;
- fixed cost/reward vectors plus explicit deferred/conditional effect specs;
- range, terraforming, and satellite metadata where applicable;
- engine warnings and an executable move fragment.

Covered command families:

- standard setup: faction choice, starting buildings, round boosters;
- income and leech: income ordering, charge, decline;
- normal turns: build/upgrade, board and special actions, ranged free actions, burn, research,
  Federation geometry x tile, pass, and end-turn;
- Lost Fleet: explore, spaceship board actions, Examine Artifact, artifact choice, instant
  Gaiaforming, and ship-Federation reward branches;
- chained choices: Tech/cover, research, Federation/rescore, Lost Planet, bonus mine/building,
  artifact, Gaiaforming, brainstone, PI swap, Tinkering tile, and Power Ring targets.

Intentional semantic deduplication is always reported in `deduplications`:

- byte-for-byte equivalent semantic options become one candidate with occurrence count;
- `Decline` is one executable choice even when its compatibility payload lists multiple leech
  offers, because the move executor ignores an offer argument.

Explicit rejections:

- every Phase 1.1 unsupported/incomplete state, including auction, silent-auction, ban, and random
  faction-picking flows;
- non-`standard` faction-board variants;
- `DeadEnd`, because it is an undo signal rather than an executable candidate;
- custom Federation fallback commands with no enumerated geometry;
- custom setup/rotation, bidding/ban commands, initialization, and Frontiers ship movement, which
  are outside the locked challenge boundary;
- any offered executable command with an empty option set or unfamiliar command branch.

## Phase 1.3: resource-conversion planning

`resources/planner.ts` accepts the same Phase 1.1 committed-state boundary and uses Phase 1.2 typed
candidates as its only executable action input. It is offline-only. The small additive internal
hooks in `actions/expand.ts` project typed candidates from an internally replayed Phase 1.3 resource
node or a caller-supplied set of production free-conversion commands; the existing committed-source
Phase 1.2 API and outputs are unchanged.

The graph uses an explicit `ProjectedConversionState` rather than engine object identity. It binds
every projection to the canonical committed source/action timing context and includes:

- credits, ore, knowledge, Q.I.C., and victory points;
- all four power bowls and exact brainstone placement;
- Gaiaformer total, Gaia-area, on-board, asteroid-used, other-used, and available counts;
- token modifier, terraform discount, temporary range/steps, satellites, and Frontiers trade
  counters;
- actor, faction, round/final-round marker, Planetary Institute state, timing, and the sorted set of
  conversion rights.

Supported normal-round conversion families are the eight base conversions (power to Q.I.C./ore/
knowledge/credit, Q.I.C. to ore, knowledge/ore to credit, ore to an Area-I token), power burn, and:

- Hadsch Halla after its PI: credits to Q.I.C./ore/knowledge;
- Nevlas: Area-III token to Gaia plus knowledge, and after its PI the three convenience power
  conversions; `tokenModifier` is applied exactly to power spending;
- Baltaks: Gaiaformer to Q.I.C., preserving the engine's Gaiaformer bookkeeping;
- Taklons: its three-power-to-three-credit convenience conversion, including brainstone choices;
- Lost Fleet Xenos: ore to a new Area-III token.

Terrans' and Itars' Gaia-phase conversions are intentionally excluded: Phase 1.3 plans main-action
affordability in `RoundMove`, not `RoundGaia`. An unfamiliar offered cost/reward resource fails
explicitly rather than being silently ignored.

Reachability is a semantic worklist with no depth or time cap. Production availability supplies one
typed unit candidate for each applicable family; ranged `Spend` multipliers and `burn N` are exact
aliases for repeated unit fragments and are reported in `diagnostics.aliases`. Every new unit
transition is projected explicitly, including resource caps, bowl movement, brainstone branches,
Gaia-token movement, Gaiaformer use, and faction token modifiers. Plans retain their ordered,
replayable fragments even though their canonical key depends only on source, destination, and
timing.

Intentional graph canonicalization is fully reported:

- different orders with the same step multiset and semantic destination are
  `commutative-order` merges;
- other executable sequences with the same destination are `equivalent-executable-sequence`
  merges;
- ranged conversion/burn aliases are canonicalized to repeated unit fragments;
- resource-dependency cycles are cut only when the resulting state is componentwise dominated by
  an ancestor; every such cut records the resource cycle, fragments, ancestor, and discarded key;
- other componentwise dominated transitions are recorded in `paretoPruned`.

There are no resource weights. Dominance requires an identical source/action/timing context,
brainstone placement, raw Gaiaformer bookkeeping, modifier/temporary/faction-specific state, and
conversion rights. Only then may one state dominate another by being no smaller in every one of:
credits, ore, knowledge, Q.I.C., victory points, Area I, Area II, Area III, Gaia-area power, and
available Gaiaformers, with at least one strict improvement. Candidate payment frontiers apply the
same rule under the same candidate key.

Phase 1.3 hardening keeps those semantics but removes the locked-state hot path. Exact-context and
canonical-state material are cached per immutable projected state; active Pareto rows use
deterministic exact-context/credit/ore/knowledge/Q.I.C. buckets as necessary-condition filters and
still pass the complete ten-dimensional predicate before pruning. Scalar candidate payments
(credit, ore, knowledge, Q.I.C., and victory points only) use the proof that subtracting the same
vector from a subset of an existing Pareto frontier cannot create a new dominance relationship;
power, burn, token-movement, brainstone, and Gaiaformer cases retain the full frontier algorithm.
The worklist also uses an index cursor instead of shifting the queue. None of these mechanisms is a
depth limit, timeout, weight, beam, or heuristic prune.

The untouched locked Round-1 state now has a deterministic completion regression: 36,159 reachable
states/plans, a 9,985-state frontier, 45 affordable candidate frontiers, maximum conversion depth
30, 85,126 exact-state merges, 56,139 Pareto-prune diagnostics, 111 ranged aliases, and no lossy
cycle prune. Its full state/plan/frontier/candidate/payment-key digest is
`b4e266ef95ca8cc34cfd1cde4380a782ff01f4802a077d49ac9686924e222850`, checked across constructor
replay, `Engine.slowMotion`, and hydration. A final local descriptive profile completed in 46.11s
(27.21s reachability, 1.10s result assembly, 14.24s candidate construction, 3.55s payment
frontiers); the pre-hardening run was still in reachability after 120.04s. Timings are reported in
`result.profile` and are never used for termination or pruning.

After a main candidate is replayed internally, Phase 1.3 proceeds only if the engine exposes the
narrow `AfterMove` set `Spend`/`Burn`/`EndTurn`; forced follow-ups remain Phase 1.4 work. Ordinary
resource conversions are deferred because an ordinary non-pass action guarantees the same player a
future `BeforeMove` conversion window before their next main action/pass, and opponents cannot
observe or consume those ordinary resources. Power-bowl prefixes are retained only when they
strictly increase charge capacity before intervening leech; trailing non-bowl suffixes are deferred.
Burns or other bowl changes that do not increase capacity are canonicalized to wait. The result and
timing types also carry an explicit deferral-proof flag; a context without that proof must retain
the conversion instead of applying this canonicalization.

Phase 1.4 alone will combine conversion plans, a main choice, forced follow-ups, after-action choices,
and `end` into a committed turn line. Committed-line macros, search, evaluation, training, and neural
features remain deferred to later owner-approved phases.

The complete next-session contract, preserved hashes/counts, Phase 1.3 before/after profile, proof
obligations, Phase 1.4 corpus gate, and stop conditions are consolidated in
`docs/lost-fleet/AI_PHASE_1_4_HANDOFF.md`.

The later player-facing maximum AI has an owner-locked local-runtime policy: one unchanged
model/book and fixed high simulation workload for every supported device, no time-based early exit,
and no silent low-device downgrade. Incapable devices are unsupported. That policy, plus truthful
search progress/ETA/heartbeat requirements, belongs to the later viewer-integration phase and must
not be implemented as part of Phase 1.4.

## Future shared-engine correction: maintenance-window checklist

No shared-engine correction may be folded into AI work. Before making one, all boxes below must be
checked in a separately approved maintenance window:

- [ ] The owner has explicitly opened a maintenance window and approved the proposed scope.
- [ ] A minimized regression fixture demonstrates the discrepancy without relying on AI code.
- [ ] Constructor replay and host-style serialize/parse/hydrate/action replay parity tests exist.
- [ ] Compatibility for existing serialized games has a written decision; behavior is version-gated
      when old records must retain old semantics.
- [ ] The change has an isolated rollback plan and does not require rewriting hosted game records.
- [ ] The complete engine suite and relevant viewer/host integration tests pass with quiet reporters.
- [ ] The diff has been audited for availability, move, serialization, replay, viewer, Supabase, and
      deployment impact.
- [ ] Production deployment timing and active-game risk have been reviewed with the owner.
- [ ] The owner has explicitly approved commit, push, and deployment after reviewing the evidence.
