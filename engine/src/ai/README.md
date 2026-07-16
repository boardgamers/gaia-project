# Lost Fleet AI: offline foundation through Phase 2 search

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
- a committed-turn macro builder with stable macro keys and a macro-driven corpus campaign;
- random, greedy, and inspectable heuristic committed-macro bots;
- a fixed-seat evaluation report with independently ablatable strategic features;
- a canonical strategy doctrine and a setup-only, inspectable placement-opportunity prior;
- a source-indexed strategy registry and persistent Academy/PI/Mine-spread opening-plan candidate;
- deterministic fixed-frame PUCT plus seeded Gumbel/sequential-halving search;
- an inspectable heuristic-softmax prior, tree reuse, guarded transpositions, and search diagnostics;
- paired full-game baseline/search strength harnesses and curated setup/Round-1–6 positions;
- golden, smoke, parity, and applicability tests for those offline tools.

It does not contain federation solving, the Round-6 solver, opening books, neural feature encoding,
models, training, Web Workers, hosted routes, or production feature flags. Starting buildings and
round boosters are intentionally not part of the scripted challenge prefix: both remain strategic
decisions.

## Lean session entry point

Start every new AI phase from `docs/lost-fleet/AI_CURRENT.md`. It is the single current session
contract and names the exact README sections, plan sections, source API surfaces, and gates to load.
This README owns stable module semantics; it is not a second handoff and should not be read cover to
cover by default. Historical sections remain authoritative only when their layer is in scope.

Before changing strategic evaluation or planning, read `STRATEGY_DOCTRINE.md` completely. It owns
the general expert/forum synthesis, evidence confidence, anti-overfitting rules, plan archetypes,
and AI-7 implementation order. Exact challenge coordinates remain regression evidence, not policy.
`strategy/knowledge.ts` is the corresponding machine-checkable source/principle/application map.

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
npx ts-node src/ai/testing/strength-campaign.ts # historical measured arms; do not rerun routinely
```

All three commands write JSON to standard output by default. `--output <path>` is available for an
explicit manifest/benchmark artifact path. The benchmark also accepts `--random-warmup`,
`--memory-clones`, and `--skip-random-games`; the strength campaign intentionally has one checked-in
fixed configuration.

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
  can diverge when that cache is stale. Its boolean `custom` flag is projected through the same
  truthy coercion the engine itself applies (`!!custom`), because `Player.toJSON()` drops the flag:
  the projection stays byte-identical for every live boolean value, hydrated mid-game caches become
  hashable instead of crashing the projection, and a live `custom: true` cache still hashes
  differently from its serialized counterpart on purpose — that pair genuinely behaves differently
  in the current engine (the base-003 staleness class).

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

## Phase 1.4: committed-turn macro construction

`actions/turn-builder.ts` builds every complete committed-turn macro from one supported committed
snapshot, replaying each candidate line against a fresh clone with the production commit rule
(`copy.move(line)`, commit only when `copy.newTurn`, exactly like `viewer/src/hosted/host.ts`,
`self-contained.ts`, and the fuzzer driver). A macro contains an optional Phase 1.3 conversion
prefix, exactly one Phase 1.2 main action, every forced follow-up, meaningful follow-up choices as
distinct branches, retained AfterMove bowl-opening conversions, and `end` when the engine requires
it. Transient engine states are never serialized: a line is only ever represented by its committed
source plus executable fragments.

- **Macro keys** (`macro-v1:` + SHA-256) hash the semantic choice only: source canonical hash,
  actor, the Phase 1.3 destination wallet key of a non-empty conversion prefix (null otherwise),
  the Phase 1.2 main-candidate key, the candidate keys chosen at meaningful (more than one option)
  follow-up decisions in order, and the wallet key of a retained AfterMove conversion suffix.
  Forced one-choice follow-ups are recorded for audit but never branch and never enter the key,
  so a macro built through the conversion-integrated route and the same macro built without it
  carry identical keys, and equivalent conversion prefixes cannot mint duplicate macros (Phase 1.3
  already canonicalizes one plan per destination wallet).
- **Decision walk.** Non-committed lines re-expand the engine's own follow-up offer through the
  Phase 1.2 projector: one candidate means a forced spine step; several mean one branch per
  candidate. The narrow `Spend`/`Burn`/`EndTurn` window is never branched per conversion; with
  after-conversion integration enabled it becomes plain `end` (defer everything, proof per Phase
  1.3) plus one branch per retained bowl-opening plan from
  `planAfterActionConversionsForLine`, cached per distinct (main candidate, post-main wallet).
- **Every emitted macro was applied to a fresh clone and ended committed**, with its canonical
  destination hash, next actor, leech interruption (`destination.leechPending`), pass order, and
  EndGame flag recorded. Lines whose required chained decision comes back as the engine's
  `DeadEnd` undo signal are rejected before exposure and reported in `rejected`
  (`dead-end-follow-up`), mirroring the fuzzer's ban-and-retry rule. Committed leech decisions are
  separate subsequent edges built from the committed leech state through the same generic path as
  setup, income, and Gaia decisions.
- **Custom federations are out of scope by design; never read as "no federation".** The AI forms
  only the engine's enumerated federations — the ones the engine already proposes with a real
  satellite path — and picks among those. When the engine offers a federation ONLY through its
  custom (hand-picked hex set) fallback (`federations: []`), there is no enumerable geometry and
  no satellite-path federation available at that state, so the AI simply forms no federation that
  turn: the fallback command is dropped (Phase 1.2 rejects it anyway) and the dropped tiles are
  recorded in `excludedCustomFederationTiles` for offline audit, so the skip is deliberate and
  visible rather than silent. This is a permanent scoping decision (owner, 2026-07-14), not a gap
  awaiting a later custom-federation feature.
- **Conversion integration is a two-axis option.** `conversionIntegration` seeds one line per
  nondominated (conversion prefix, main candidate) pair from the complete Phase 1.3 result —
  including candidates only affordable after conversions — and `afterConversionIntegration`
  controls the AfterMove bowl-opening axis separately. Both are exact and uncapped whenever they
  run; wall-clock cost is wallet-dependent and measured, not capped (see the measured numbers
  below), so statistics runs state explicitly which axes were enabled.

Measured locked Round-1 branch statistics (the before/after conversion-integration gate):

- before integration: 52 committed macros over 32 root main candidates, zero rejections, macro
  key/destination digest `972a1e9b062ebcda5a96e2242039bbc29eee83934c9eb41e175a493bb1009096`;
- after integration (seed level, from the locked Phase 1.3 result): 45 candidate frontiers,
  130,532 (conversion prefix, main candidate) seed pairs, of which 130,500 carry a non-empty
  prefix (the 32 empty-prefix seeds are exactly the root-affordable mains); per-candidate prefix
  counts span 5 to 9,985 with median 2,134. Fully emitting all ~130k lines validates each by
  replay and is a measured multi-hour offline job on this state, so the focused suite locks the
  seed-pair counts and emits complete integrated macro sets on smaller wallets instead.
- Exhaustive planning cost is wallet-dependent: measured `planResourceConversions` runs span
  0.01 s (lean mid-game wallets) through ~80 s (pristine Round-1) to 738 s (a power-rich Round-6
  state), and the pristine-wallet AfterMove axis exceeds practical wall-clock entirely. Scheduling
  which turns a sampled player converts on is a play-policy choice and is reported with every
  statistic; the planner itself never gets a depth cap, timeout, weight, or beam.

`testing/corpus.ts` drives complete macro-sampled games from the locked challenge prefix
(host-style commit chain) and runs the Phase 1.4 corpus campaign: every committed state is checked
for the hash (canonical hash + serialize/parse hydration), legal (typed expansion, unique sorted
macro keys, no exposed DeadEnd/non-committed line), apply (fresh-clone replay of macros incl. the
sampled one, destination hash equality), and replay (constructor replay hash + macro-key parity on
a deterministic subsample) property families. Replay-path hash differences confined to the
documented base-003 federationCache staleness class (Player.toJSON() drops the cache's `custom`
flag, and current engine behavior genuinely reads it) are counted as
`federationCacheHashDivergences` after a cache-masked byte comparison proves nothing else differs;
on those states macro parity is checked on hash-independent semantic content. Any other
divergence fails the campaign.

## Phase 2 / AI-6: non-neural evaluation baselines

The Phase 2 baseline path remains wholly offline and consumes only
`buildCommittedTurnMacros(...)` output:

- `bots/random.ts` samples uniformly from the committed macro set with a reproducible seed. It is a
  legality/smoke baseline, not the old fuzz command sampler.
- `bots/greedy.ts` applies every candidate host-style and selects by immediate score/resource value.
  An EndGame destination always returns the exact fixed-frame final margin.
- `evaluation.ts` exposes 28 stable feature names, default weights, raw seat values, seat-0-minus-
  seat-1 margins, and per-feature weighted contributions. `disabledFeatures` independently zeros
  any named term; `weights` permits explicit ablations/tuning without changing extraction. The
  features cover current score/resources, income by resource and remaining income phases, building
  supply/uncovered income, round timing, separate Space/Deep-Space progress, Gaia pipeline,
  research 3/5 races and Advanced-Tech prerequisites, standard-Tech cover cost, shared power/ship
  actions, booster/pass order, power-bowl capacity, exact edge-level leech charge/VP cost, Trading
  Station discount/opponent offer, federation state/options, Lost Planet, exploration, artifacts,
  ship tech/federation rewards, current final-scoring projection, and exact leftover conversion.
- `bots/heuristic.ts` applies every committed macro, evaluates the destination plus the exact edge
  marginals, and deterministically selects the highest fixed-frame value for seat 0 or the lowest
  same value for seat 1. It never negates utility per edge and constructs no search tree.
- `testing/self-play.ts` re-applies every chosen line to a fresh hydrated engine, requires
  `newTurn`, verifies the recorded destination hash/actor, and plays paired faction assignments to
  EndGame without manual commands. Its 800-line check is only a loud full-game termination guard;
  macro generation and conversion planning remain exact and uncapped.

The baseline play policy defaults conversion integration off because the pristine locked wallet has
130,532 exact seed pairs. A caller may enable either Phase 1.4 conversion axis; when enabled the
existing planner/builder runs to its complete fixpoint with no depth, sequence, beam, or time cap.

Locked deterministic paired measurements (A as Xenos/B as Hadsch Hallas, then swapped):

- greedy vs random: `68-51` (+17) and `20-46` (+26 for greedy as Hadsch Hallas), paired margin
  `+43`, mean `+21.5`, record 2-0;
- heuristic vs greedy: `49-67` (-18) and `66-48` (-18 for heuristic as Hadsch Hallas), paired margin
  `-36`, mean `-18`, record 0-2.

Verification at the AI-6 handoff: 12/12 focused, 68/68 complete offline AI, and 698 passing / 4
pending in the complete engine suite. Engine 4.8.51, Phase 0 semantic SHA
`ce3bdd7322860484dfae771320b9f12967d0677b908f91cdc682d9c4427bf51e`, the Phase 1.2 62-candidate
digest `a28eb3d03e2b51e1bea28170b92f5e99991f41c76b1b1c8a2193a97a0ee704d9`, the Phase 1.3 36,159 /
9,985 / 45 / depth-30 digest `b4e266ef95ca8cc34cfd1cde4380a782ff01f4802a077d49ac9686924e222850`,
and the Phase 1.4 52-macro / 32-main digest
`972a1e9b062ebcda5a96e2242039bbc29eee83934c9eb41e175a493bb1009096` all remain locked.

The second result is retained as evidence, not hidden or promoted: the first inspectable heuristic
is a coverage/ablation baseline and future teacher candidate, but its default hand weights require
calibration before it can be treated as stronger than greedy. Phase 2 has no single-line promotion
claim. Search, MCTS/PUCT/Gumbel, tree reuse, transpositions, and learned opponent models remain
absent and deferred to AI-7 or later owner-approved phases.

The complete current-session contract and inherited stop conditions are consolidated in
`docs/lost-fleet/AI_CURRENT.md`.

The later player-facing maximum AI has an owner-locked local-runtime policy: one unchanged
model/book and fixed high simulation workload for every supported device, no time-based early exit,
and no silent low-device downgrade. Incapable devices are unsupported. That policy, plus truthful
search progress/ETA/heartbeat requirements, belongs to the later viewer-integration phase and is
not implemented by the offline Phase 2 baselines.

## Phase 2 / AI-7: offline search baseline

`search/core.ts` is a domain-generic, deterministic minimax MCTS/PUCT implementation. Values stay in
one seat-0 frame: actor 0 maximizes and actor 1 minimizes without edge negation. A simulation expands
at most one new node, backs up the same fixed-frame value, and is conserved in per-call visit deltas.
Canonical action keys order all ties. `gumbel-sequential-halving` is a separately selectable root
allocator with an explicit seed and feasible fixed-budget candidate count; plain `puct` remains the
default and independently measurable. `puctValueScale` explicitly divides fixed-frame Q before the
dimensionless exploration bonus is added; its default of one preserves the frozen raw-Q baseline.
`rootReuseVisitPolicy` independently retains promoted-subtree moments (the default) or resets all
reachable visit/value moments while preserving expanded structure. Reuse diagnostics distinguish
visits available before promotion from visits actually retained.

`search/engine-domain.ts` makes one Phase 1.4 committed macro the only engine search edge. Every
destination is applied on a fresh hydrated engine and checked against its recorded hash and next
actor. Non-terminal leaves use the state-only AI-6 heuristic so canonical transposition values are
path-independent; terminal leaves use exact final margin. The inspectable prior is a temperature-8
softmax of actual-actor-oriented heuristic values with a 5% uniform mixture. Its optional
`greedyMix` performs a probability-level blend with an immediate-greedy softmax; zero is the default
and exactly preserves the frozen heuristic-only prior. The separate `leafGreedyMix` performs the
same bounded value-level blend in non-terminal leaf Q; terminal utility is never blended. Its default
is also zero. Search pins and reports both macro conversion axes; they default off while the existing
planner remains exact and uncapped when explicitly enabled.

`bots/search.ts` exposes `SearchMacroBot`, `SearchMacroBotOptions`, and `SearchMacroEvaluation`.
Diagnostics separate deterministic search facts from wall-clock performance and include root visits,
prior/value/spread, principal variation, expansions, tree reuse, and transposition hits. The bot
retains the selected child and reconciles the next observed committed state against its descendants.
Transpositions default off; when enabled, the engine adapter must prove equal canonical hash,
state-only value, actor/terminal status, and complete legal macro set before sharing a node.

`testing/strength.ts` exposes paired fixed-faction strength games/campaigns plus seven deterministic
committed probes spanning setup and rounds 1–6. It records candidate margins/records, fixed simulation
counts, raw final scores for both factions in every game, expansions/edges, latency, reuse, and
guarded-DAG telemetry. The frozen eight-simulation campaign found:

- plain PUCT vs greedy: margins `[-12, -18]`, mean `-15`, record 0–2;
- plain PUCT vs heuristic: `[+10, +16]`, mean `+13`, record 2–0;
- four-seed Gumbel vs greedy: `[-16, -39, -6, -17, -14, -14, +14, -36]`, mean `-16`, record 1–7;
- four-seed Gumbel vs heuristic: `[-10, -1, +11, +30, -1, -9, -6, -8]`, mean `+0.75`, record 2–6.

Tree reuse occurred on 31/37 and 32/34 plain-PUCT selections and 418/435 four-seed Gumbel
selections. On the common-seed Gumbel DAG ablation, 90 guarded hits/parity checks produced the same
game margins and selected curated actions as the tree variant, with no demonstrated latency benefit.
The implementation gate is complete, but the strength-promotion gate is not: no AI-7 bot is promoted
over greedy, and AI-8 must not begin until an AI-7 follow-up clears that gate.

Final AI-7 verification: 12/12 focused; complete engine 710 passing / 4 pending; TypeScript,
changed-file ESLint, diff/whitespace, and production-isolation audits clean. The first full-suite
attempt was externally terminated with Windows status `0x40010004` and no Mocha failure; the exact
recovery command completed successfully.

The focused AI-7 calibration kept Gumbel/transpositions ablated and compared budgets 1/2/4/8/16 on
the seven curated positions. A 50/50 greedy/heuristic prior changed 0/35 choices relative to the
heuristic-only prior; both arms matched greedy on only 1, 1, 1, 2, and 1 positions respectively.
Unvisited-edge Q starts at the full raw heuristic value while the exploration bonus is only about
`1.25 × prior`, so a prior-only blend cannot overcome the measured heuristic gaps. Early traces
found two mine-over-trading-station evaluator divergences and one retained-subtree research choice
that fresh search replaced with Pass. No trace reached EndGame, so no final-score result was produced.
Completed-game harness results always include both raw seat scores. Calibration verification was
13/13 focused and 711 passing / 4 pending in the complete engine suite; TypeScript and ESLint passed.

The next bounded calibration made Q units explicit and moved the evaluator blend into both prior and
non-terminal leaf value. At budgets 1/2/4/8/16, the predeclared scale-16, 75%-greedy candidate matched
greedy on 3/3/3/5/5 of seven curated positions, versus 1/1/1/2/1 for the frozen arm. On two fixed
32-line stateful traces it differed from a fresh tree only once; resetting promoted-subtree moments
differed four times and retained no old visits, so the campaign candidate keeps the default retain
policy. The exact one-pair, eight-simulation campaign configuration is checked into
`testing/strength-campaign.ts` behind `--scaled-greedy-75-candidate` before measurement.

That campaign ran once after source freeze. Versus greedy, the candidate scored raw games `65-72`
and `56-84` from its Xenos and Hadsch Hallas assignments: margins `[-7, +28]`, paired mean `+10.5`,
record 1-1. Versus heuristic it scored `73-43` and `49-67`: margins `[+30, +18]`, mean `+24`, record
2-0. Mean search latency was 2,042 ms/selection versus greedy and 2,127 ms versus heuristic. This is
the leading search-only arm on paired margin, not a statistically clear final claim: it has one
deterministic pair per opponent and lost the Xenos/greedy game. The measured arm must not be rerun or
retuned; AI-7 remains open for broader predeclared strength evidence.

`docs/lost-fleet/AI_CURRENT.md` grants continuing autonomy for offline AI-7 iteration. An agent may
predeclare, source-freeze, and run one comparable paired campaign per evidence-backed candidate
without an owner checkpoint. It must not rerun/cherry-pick failed seeds, start AI-8, change shared or
production code, or commit/push/deploy under that authority.

`testing/full-game-report.ts` adds exact inspectable absolute-score/productivity reporting to both
baseline and search games. It uses only committed macro observations and the engine's existing
advanced log. Every player report includes raw score after rounds 1–6; Round-tile, Federation,
research-track/endgame, both final-scoring, other immediate, resource-conversion, and bid VP;
ordinary action counts/types and Pass turn by round; and final buildings/research/resources. Round
and final totals are reconciled exactly, with a loud error on unattributed VP.

The productivity investigation found that baseline players took only 1–9 ordinary actions over six
rounds, often passing immediately with capped wallets; all four diagnostic players scored zero
Federation and research-track/endgame VP. `greedyStateValue` therefore has an independently opt-in
`income-normalized` mode, but its measured 45–72 scores did not improve productivity and it is not a
candidate. The default remains the frozen immediate-greedy baseline.

Search additionally exposes `nonTerminalPassValuePenalty`, default zero. It applies an actor-relative
opportunity cost to non-terminal Pass leaf/prior values only; exact terminal utility is unchanged.
The predeclared value-4 arm selected no Pass at any of 35 curated budget/position probes. In its one
allowed fresh-seed campaign it beat greedy 2-0 (`76-57`, `72-70`) but remained absolutely weak; the
retained 72, 76, and 77 VP reports still showed zero-action middle rounds and no
Federation/research endgame scoring. It is an AI-7 diagnostic improvement, not a promoted champion.

`setup-placement.ts` adds an owner-labelled, setup-only placement prior. It grades distance-one,
two, and three access to spaceships, the opponent home colour, Gaia planets, Asteroids, one-step
terrain colours, and nearby planet density. Spaceship value combines its fixed action board with
the tech and Federation reward actually seeded on it. `setup-placement-opportunity` reports every
component independently and becomes zero after setup; on the locked challenge it changes the four
previously tied Xenos first-Mine choices to the expert-confirmed order
`3A0 > 6A4 > 1A3 > 2A11`.

`STRATEGY_DOCTRINE.md` consolidates the owner's general guidance and the expansion/base-game forum
review into implementable plan archetypes. `strategy/knowledge.ts` currently maps 20 sources to 37
deduplicated principles, including contradictions and rejected universal rules; traceability tests
require every retained principle to have an explicit AI disposition.

`strategy/opening-plans.ts` implements the first general application: inspectable Academy, PI, and
Mine-spread assessments with prerequisites, exact next-building reserves, progress, affordability,
round-scoring/faction context, and transition penalties for reserve damage or productive Passes.
`StrategyPlanMacroBot` retains the selected plan through rounds 1–2 and reports selection, retention,
completion, abort, and material-switch reasons. It does not script coordinates or move sequences and
does not change the frozen heuristic baseline.

Its first diagnostic game was deliberately not a campaign: as Xenos against greedy Hadsch Hallas it
scored `74-61`, took 14 ordinary actions, built Academy 2 and eight Mines, explored two ships, and
earned 12 Federation VP. Zero actions in rounds 3–5 and zero research-track/endgame VP remain, so the
opening layer alone was not a promotion candidate.

`strategy/research-plan.ts` implements the evidence-backed continuation for rounds 3–6. It ranks
research targets from the actual seeded Advanced Tech event, current infrastructure/track position,
green-Federation readiness, remaining uses, four-knowledge affordability, and small faction-context
modifiers. It retains the target, rewards focused research plus Standard/Advanced Tech and
Federation-readiness progress, protects four knowledge from unrelated spending, and penalizes Pass
only when a productive transition exists. Advanced Tech utility is derived from the tile's actual
rewards/operator/current condition count and remaining rounds; there is no fixed tile tier or track
order.

The one final diagnostic—not a paired campaign—improved Xenos from 74 to 107 VP and from 14 to 21
ordinary actions. Rounds 3–5 changed from `[0,0,0]` actions to `[5,4,4]`, and research/endgame VP
changed from 0 to 16; final research was AI 5, Terraforming 3, Science 2. This is evidence for the
planning mechanism, not competent play: 107 remains well below the owner-supplied 150–160 target.

Keeping that same plan active in round 6 is the retained follow-up: Xenos spent four stranded
knowledge to reach Terraforming 4, increasing the diagnostic to 110 VP, 22 actions, and 20
research/endgame VP. `strategy/tempo.ts` also exposes an optional measurable-productivity Pass guard,
and research assessments expose an optional same-turn Federation feasibility context. Both are off
by default: Pass values 4/8 scored 99/105 and the Federation gate scored 94, so none replaced the
validated policy. Removed final-scoring/reachability experiments scored 103/88.

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
