# Strongest-AI Implementation Plan

> **Status: AUTHORITATIVE EXECUTION PLAN (2026-07-13).** This document incorporates the external
> architecture/code review of `AI_CHALLENGE_PLAN.md` against `master` commit `8146e29f`. Use this
> document for implementation order, safety gates, acceptance criteria, and session handoffs.
> `AI_CHALLENGE_PLAN.md` remains the concept/brainstorming record; where it conflicts with this plan,
> **this plan wins**.
>
> **Current production constraint:** real hosted games are in progress, and every push to `master`
> triggers a Vercel production deployment. Until the owner explicitly declares a maintenance window,
> AI work must be additive, unreachable from existing production entry points, and must not change
> shared engine semantics, existing hosted-game tables/RPCs/triggers, or current viewer behavior.
>
> **Current implementation status (2026-07-14):** Phases 0, 1.1, 1.2, 1.3, and 1.4 are complete
> (Phase 1.4 on `claude/gaia-phase-1-4-yjb6qo`, built on `agent/phase-1-3-resource-planner`).
> `AI_PHASE_1_4_HANDOFF.md` carries the measured Phase 1.4 results; AI-6 (greedy/heuristic bots +
> evaluator) is the next owner-gated slice and is unstarted.
>
> **First challenge:** seed `lf-mrj5exuu-c680`, 2-player Lost Fleet, Xenos seat 1 versus Hadsch
> Hallas seat 2; the human may play either faction. The final ranked configuration is one fixed,
> deterministic AI version per faction/difficulty leaderboard.

---

## 0. How to use this plan

### 0.1 Objective

Build the strongest practical opponent for one fixed Gaia Project + Lost Fleet setup on a single
training machine, without putting existing games at risk. The long-term target is a
challenge-specialized policy/value network guiding deterministic live search, strengthened by:

- a correct macro-action and resource-conversion planner;
- a strong non-neural search baseline;
- exact late-game/subproblem solving where tractable;
- a state-keyed opening book;
- Expert Iteration / self-play and adversarial evaluation;
- an authoritative ranked-game backend.

The neural system is a promoted successor to a measured search-only baseline, not an assumption
that bypasses the hard engine/search work.

### 0.2 Execution rule: one gated phase at a time

Do not start the next phase merely because the current phase compiles. Each phase below has an exit
gate. Record its measurements/results in this file before proceeding. A normal implementation
session should complete one bounded slice, update this handoff, and stop.

Recommended session boundaries are in §14. The immediate next session implements **Phase 0 only**.

### 0.3 Authority and production rules

1. Follow `PROGRESS.md` working agreements and quiet test commands (`--reporter min`).
2. Check `git status --short --branch` before every edit. Preserve unrelated/untracked work.
3. During the live-game freeze:
   - AI files may be added under new, unimported paths.
   - Offline scripts/tests/docs may be added.
   - No existing engine rule, serialization, move, availability, or replay behavior may change.
   - No existing viewer/hosted entry point may import AI code.
   - No Supabase migration, RPC, trigger, Edge Function, or production configuration may change.
   - Do not push runtime changes merely because tests pass. Get owner confirmation first.
4. Shared-engine semantic fixes require all of:
   - a minimized regression fixture;
   - constructor-replay and host-style-replay parity tests;
   - an old-game compatibility decision;
   - an explicit maintenance window or version-gated behavior;
   - owner confirmation before push.
5. The challenge system must use separate routes/tables/functions until production rollout. Never
   attach AI triggers to existing hosted games.

### 0.4 Non-goals for the first release

- General strong play across arbitrary boards, factions, player counts, or Frontiers.
- Multiplayer max-n or kingmaking logic.
- A live server bot inside the current `resolve-automation` Edge Function.
- A human-opponent model that changes the minimax objective.
- Engine-wide incremental undo before profiling proves it necessary.
- A single mixed leaderboard across Xenos and Hadsch Hallas.

---

## 1. Corrected technical decisions

These decisions replace ambiguous or incorrect portions of `AI_CHALLENGE_PLAN.md`.

### 1.1 Search utility and actor semantics

- Terminal utility is final score margin: `seat0 score - seat1 score`.
- The game is zero-sum under that utility, but engine decision edges do not strictly alternate.
  Free actions and forced sub-decisions may keep the same actor; leech can change the actor inside
  another player's turn resolution.
- Store values in a fixed seat-0 frame in the initial implementation. At a tree node, seat 0 selects
  the maximum and seat 1 the minimum. Do not negate on every edge.
- A later actor-relative encoder may swap player tokens and signs, but must prove parity against the
  fixed-frame implementation.
- Do not implement multiplayer `max-n` or a per-player value vector for this challenge.

### 1.2 Search edge

The initial search edge is a **complete committed move line** that ends with `engine.newTurn === true`.
This matches the real hosts and avoids cloning incomplete engine states whose transient fields are
not serialized.

An edge may contain:

1. zero or more before-move free actions;
2. exactly one main action or Pass;
3. all required chained choices;
4. zero or more strategically relevant after-move free actions;
5. `end` when required;
6. any resulting committed leech decision as a separate subsequent decision edge.

If profiling later shows macro generation is the limiting factor, add an explicit search-only atomic
state API. Do not use `Engine.fromData()` on arbitrary incomplete states.

### 1.3 Search algorithm

- Primary search: deterministic minimax MCTS/PUCT over the legal macro candidates.
- Low-budget upgrade: Gumbel action sampling + sequential halving at the root.
- Alpha-beta: restricted to exact/bounded late-game subspaces after Phase 3 proves them tractable.
- Transpositions: enabled only after canonical hashing and replay/legal-set parity pass.
- Tree reuse: retain the selected subtree after every actual move.
- Maximum local search uses one fixed, high simulation count. It never stops early or silently
  substitutes a weaker model/search budget because a device is slow. Faster supported devices
  finish the same configured work sooner; incapable devices fail an explicit capability gate.
  Wall-clock search and variable pondering, if ever offered, are separate non-comparable practice
  features only.

### 1.4 Value target

The search objective is expected final margin, but the network predicts more than one scalar:

- categorical final-margin distribution with underflow/overflow bins;
- scalar expected margin auxiliary;
- each player's final raw score;
- round-scoring contributions;
- both final-scoring contributions;
- research endgame VP;
- selected resource/ownership auxiliary targets.

This preserves margin-maximizing behavior while providing denser training signal and uncertainty.

### 1.5 Policy representation

Do not allocate a single enormous fixed action logit array. Score the current variable set of legal
typed candidates with a shared candidate-action network and softmax only over those candidates.

### 1.6 Human model

The robust self-play/minimax value remains authoritative. A future human policy model may prioritize
book coverage, move ordering, and adversarial test positions, but it must not replace the opponent's
best-response logic in ranked search.

### 1.7 Ranked authority

An end-of-game replay validates legality and score but cannot prove that client-supplied AI moves
came from the strong AI. Ranked AI moves therefore require server authority or state-bound signed
receipts. Client-only AI is practice mode unless a later deterministic verifier is demonstrably
cheap and bit-reproducible.

---

## 2. Baseline findings to preserve

Measurements below were taken on the current machine after warm-up. They are baselines, not promises:

| Measurement                                             |                                            Result |
| ------------------------------------------------------- | ------------------------------------------------: |
| 20 full random 2p Lost Fleet fuzz games                 |                             188.7 ms/game average |
| Committed lines per game                                |                                     56.15 average |
| Full replay                                             |                        28.6 ms/game; 0.44 ms/line |
| JSON clone at legal locked-faction R1 state             |                             0.65 ms; 24,213 bytes |
| JSON clone at completed state                           |                                   0.78 ms; ~31 KB |
| Emitted JS clone                                        |                     0.66 ms (no material speedup) |
| `generateAvailableCommands()` across 179 sampled states | 0.27 ms median; 0.53 ms p95; 1.98 ms observed max |
| Concrete choices in one legal locked-faction R1 state   |              66 total; 32 conversion/burn choices |

Implications:

- Clone optimization is not an up-front task.
- Available-command/federation generation and conversion branching need profiling alongside clone.
- `ts-node --transpile-only` does not imply a several-times runtime penalty after module load.
- The real unit of training cost is leaf expansions, not random-game wall time.

Known correctness hazards that AI work must not conceal:

- `engine/src/fuzz/known-issues/base-003-federation-cache-staleness-nondeterminism.json` documents a
  federation-cache live/replay divergence.
- Brainstone live/replay divergences exist in the other known-issue fixtures; they do not affect this
  Xenos/HH setup but block a trustworthy general monthly base model until resolved/version-gated.
- Federation path generation uses a heuristic and can fall back to an unenumerated custom option.
- `fuzz/random-player.ts` is a sampler, not a complete action enumerator: it caps conversions,
  truncates amounts, and skips custom federations.

---

## 3. Target module and artifact layout

Keep new AI code unexported and unreachable until the relevant integration phase.

```text
engine/src/ai/
  README.md                       # scope, safety, invariants
  types.ts                        # typed states/actions/search results
  challenge.ts                    # challenge definition loading/validation
  challenge-manifest.ts           # generated fixed setup data
  canonical-state.ts              # path-independent state projection + hash input
  features/
    schema.ts                     # versioned feature schema
    encode-state.ts               # Engine -> graph/player/global tensors
    encode-action.ts              # typed candidate -> candidate tensor
    derived.ts                    # small, audited derived strategic features
  actions/
    expand.ts                     # AvailableCommand -> typed atomic choices
    turn-builder.ts               # atomic choices -> committed macro candidates
    resource-planner.ts           # conversion reachability/Pareto frontier
    federation-planner.ts         # exact/bounded AI-side federation candidates
    canonical-key.ts              # stable candidate identity
  transition.ts                   # apply macro to committed snapshot
  evaluate.ts                     # Tier-0/Tier-1 non-neural evaluator
  search/
    tree.ts
    mcts.ts
    gumbel-root.ts
    transpositions.ts
    time-control.ts               # fixed sims for ranked; time mode for practice
  bots/
    random.ts
    greedy.ts
    heuristic.ts
    search.ts
    neural.ts
  endgame/
    resource-frontier.ts
    round6-solver.ts
  book/
    format.ts
    build.ts
    lookup.ts
  net/
    interface.ts                  # inference abstraction
    onnx.ts                       # later, not imported initially
  selfplay/
    actor.ts
    replay-buffer.ts
    evaluator.ts
  testing/
    positions.ts                  # curated/golden states
    corpus.ts

engine/scripts/ai/
  benchmark.ts
  generate-challenge-manifest.ts
  strength-match.ts
  build-book.ts
  selfplay.ts
  verify-model.ts

training/                         # added only in Phase 4
  README.md
  pyproject.toml
  gaia_ai/
    model.py
    train.py
    dataset.py
    export_onnx.py
  configs/
  tests/

viewer/src/challenge/             # added only in Phase 7
supabase/functions/ai-turn/       # added only in Phase 8
supabase/migrations/*_ai_*.sql    # additive challenge-only schema, Phase 8
```

Generated models, books, replay shards, profiling dumps, and self-play games do not belong in normal
Git history. Commit only small versioned manifests/configs and explicitly approved release assets.

---

## 4. Phase 0 — safety foundation and reproducible baselines

### Goal

Create a documentation/test/benchmark foundation without changing any current runtime path.

### Work

1. Add `engine/src/ai/README.md` and minimal `types.ts`; do not export them from `engine/index.ts`.
2. Add a static challenge definition for:
   - seed and options;
   - fixed faction assignment and seat order;
   - scripted faction-choice prefix only;
   - explicit note that starting buildings and boosters remain strategic decisions;
   - challenge/model/engine schema versions.
3. Add `generate-challenge-manifest.ts` that boots the real engine and emits/validates:
   - scoring tiles and exact effects/IDs;
   - boosters;
   - standard/advanced tech lineup and positions;
   - federation supply and terraforming federation;
   - Lost Fleet economy/extension sides;
   - spaceship coordinates, techs, federations, actions, shuttle slots;
   - exact artifact identities;
   - canonical map hex list, adjacency, planet/sector classification;
   - Space and Deep Space objectives as distinct fields.
4. Add a benchmark runner with warm-up and JSON output. Measure separately:
   - serialize, parse, hydrate, full clone;
   - command generation;
   - candidate expansion once available;
   - action application/replay;
   - full random games;
   - memory/state size.
5. Add fixed-setup boot tests that assert the generated manifest matches the current engine.
6. Record current test counts and baseline benchmark output in this document or a small checked-in
   baseline JSON, without machine-specific pass/fail thresholds yet.
7. Document a maintenance-window checklist for any later shared-engine fix.

### Tests

- Full engine suite with the required min reporter.
- New manifest golden test.
- New benchmark smoke test with very small iteration counts.
- `git diff --name-only` must show no viewer, Supabase, existing engine rule, availability, move, or
  serialization files.

### Exit gate

- Challenge manifest is complete and generated from code, not copied from strategy prose.
- Benchmarks are reproducible and report hardware/Node version/warm-up/iteration count.
- AI module is not imported by any production bundle path.
- Existing engine suite remains green.
- Owner reviews Phase 0 before Phase 1 begins.

---

## 5. Phase 1 — canonical state, complete decisions, and conversion planning

Split this phase across separate sessions; each subsection has its own tests.

### 5.1 Canonical state projection

Create a path-independent projection for search/book/transposition identity. Include every field that
can affect future legality, rewards, actor order, or terminal score. Exclude:

- move history and human-readable logs;
- names and local settings;
- available-command caches;
- federation caches;
- derived getters whose source fields are already included.

The projection must include at least:

- round, phase/subphase, current/temp actor, turn order, pass order, leech queues/source;
- shared board/ship action usage;
- remaining tile/token/artifact supplies;
- all dynamic map occupancy/federation/satellite/power-ring/Gaia state;
- all player resources, bowls, research, buildings, income/event activation, tiles, federation sides,
  artifacts, shuttles, Gaiaformers, range/temporary state, and faction-specific counters.

Hash a stable binary or canonical JSON encoding with an explicit schema version. Do not use raw
`JSON.stringify(engine)` as the transposition key.

Tests:

- Equal constructor and host-style committed states produce identical projections/hashes.
- Populating/clearing derived caches does not change the hash.
- Every deliberately changed future-relevant field changes the projection.
- Same hash implies the same canonical legal candidate keys on the tested corpus.

### 5.2 Typed atomic decision expansion

Build a discriminated union for every command used by the locked challenge, including setup,
income/Gaia/leech, normal actions, Lost Fleet actions, and all chained choices. Expand every nested
`.data` element and required cross-product.

Each candidate contains:

- stable key and command type;
- actor and phase/subphase;
- structured target(s);
- resource cost/reward vector;
- building/research/tile/booster/ship/federation identifiers;
- range/terraform/satellite metadata;
- engine warnings;
- original executable move fragment.

Tests:

- Every emitted candidate applies when selected in its source state.
- Every relevant option in every `AvailableCommand.data` appears exactly once unless documented as
  a semantic duplicate.
- Canonical keys survive clone/replay and are independent of `.data` array ordering.
- A corpus test covers every command variant required by Xenos, HH, and this Lost Fleet setup.

### 5.3 Resource-conversion planner

Treat free conversions as zero-tempo resource-state transitions. For a committed state:

1. Enumerate reachable conversion states without an arbitrary length cap.
2. Merge commutative sequences that reach the same semantic state.
3. Detect and terminate lossy cycles.
4. Maintain a Pareto frontier over strategically relevant resources/bowls/tokens.
5. For each main-action candidate, return conversion plans that make it affordable and leave a
   nondominated post-payment state.
6. Model after-action power spending separately when it changes bowl capacity before leech.
7. Prove when other after-action conversions can be deferred to the next turn and canonicalize them
   away; otherwise retain them.

Do not encode resource values as fixed dominance weights. Safe dominance means one state is no worse
in every future-relevant dimension under the same action/phase context.

Tests:

- Exhaustive tiny-resource comparisons against brute-force conversion sequences.
- Xenos ore-to-area-III cases.
- HH pre-PI and post-PI conversion cases.
- burn-to-enable-action and burn-versus-wait cases.
- post-main-action bowl-opening before leech.
- final-round resource conversion cases.
- no fuzzer-style two-conversion cap.

### 5.4 Committed-turn macro builder

Combine conversions, main choices, forced follow-ups, after-action choices, and `end` into complete
move lines. Build each candidate from the last committed snapshot and validate by applying the whole
line, mirroring `self-contained.ts`/host behavior.

Keep forced one-choice decisions out of policy branching. Preserve meaningful choices such as tech
tile, cover tile, research advance, federation token, artifact, booster, Gaia target, and leech.

Tests:

- Every macro ends committed or is rejected before search.
- No `DeadEnd` macro is exposed.
- The result matches a fresh constructor replay of the accumulated committed history.
- Actor transition is recorded correctly, including leech.
- Randomly sampled macro play reaches EndGame without using the old fuzzer conversion cap.

### Exit gate

- At least 1,000 diverse committed corpus states pass hash/legal/apply/replay properties.
- All locked-setup command types have explicit coverage.
- No unsupported custom-federation state is silently treated as “no federation.”
- Branch statistics are measured before and after resource-plan dominance.
- No shared production engine behavior has changed.

---

## 6. Phase 2 — strong non-neural baseline and search

### 6.1 Bots

Implement four intentionally separate baselines:

1. **Random legal macro bot:** correctness/smoke baseline only.
2. **Greedy bot:** immediate score/resource change plus terminal-aware simple value.
3. **Heuristic bot:** projected income, board position, scoring progress, research, action scarcity,
   power economy, Gaia pipeline, federation potential, and opponent margin effects.
4. **Search bot:** minimax MCTS/PUCT using the heuristic evaluator at leaves.

The heuristic evaluator is a baseline and search teacher, not the final architecture. Keep every
feature inspectable and ablatable.

### 6.2 Required strategic coverage

At minimum, the evaluator/state features must distinguish:

- current VP and projected final margin;
- future income by resource and remaining income phases;
- building supply/uncovered income;
- exact round-tile timing;
- ordinary Space-sector versus Deep-Space progress;
- Gaia final/scoring and Gaiaformer project pipeline;
- research track level-3/5 races and advanced-tech prerequisites;
- standard-tech cover opportunity cost;
- shared power/ship action availability and affordability;
- booster value and pass order;
- exact marginal leech cost/benefit and bowl capacity;
- Trading Station adjacency discount versus opponent charge;
- federation current efficiency and future option value;
- Lost Planet, ship exploration, artifact, ship-tech, and ship-federation value;
- endgame leftover-resource conversion.

Do not implement separate learned opponent-build/race/human models in this phase.

### 6.3 Search behavior

- Fixed-frame max/min backup according to actual actor.
- Deterministic tie-breaking from canonical action keys.
- Tree reuse after selected moves.
- Optional transposition DAG only after Phase 1 hash tests pass.
- Search diagnostics: visits, prior, mean value, uncertainty, PV, cache hit rate, expansions/second.
- Root compute allocation based on policy entropy/value gaps, not hard-coded action categories.

### 6.4 Strength evaluation

Because the board is fixed, repeated deterministic games are not independent evidence. Evaluation
uses:

- paired policy assignments: A as Xenos/B as HH, then B as Xenos/A as HH;
- multiple evaluation-only search RNG seeds where the algorithm samples candidates;
- common random seeds across candidate/champion pairs;
- a curated suite of off-book valid positions across setup and rounds 1–6;
- margin, win rate, worst-position loss, nodes, and latency;
- final release evaluation with exploration noise disabled.

Never promote solely because a new model/bot beat the immediately previous version on one line.

### Exit gate

- Search bot has a statistically clear paired-margin improvement over greedy and heuristic bots.
- It plays both factions without command gaps or manual intervention.
- Target search budgets have measured single-machine and target-device costs.
- Tree/hash diagnostics show whether transpositions are materially useful.
- A first honest estimate exists for search-only strength and neural upside.

At this gate, decide whether search-only is strong enough for an early private practice challenge.
Do not cancel the neural phases if the stated goal remains strongest possible.

---

## 7. Phase 3 — exact subproblems, endgame, and opening book

### 7.1 Federation planner

> **Owner scope note (2026-07-14):** custom (hand-picked hex set) federations are out of scope. The
> AI forms only the federations the engine already enumerates with a satellite path, and picks the
> best among those; when the engine offers only its custom fallback, the AI forms no federation that
> turn (Phase 1.4 records this as `excludedCustomFederationTiles`). Reassess whether an AI-side
> federation planner is needed at all before building one; if built, it selects among
> engine-enumerated federations rather than constructing custom hex sets. Confirm with the owner
> when Phase 3 (AI-8) starts.

The current engine's heuristic is not an exact solver and may expose only a custom fallback. Build an
AI-side exact or bounded-exact planner that:

- enumerates relevant building-group subsets meeting faction power requirements;
- finds minimum added satellites under the real excluded-hex rules;
- retains strategically distinct building subsets, not merely smallest overshoot;
- computes future federation-option loss;
- validates every proposed federation through current engine legality before use;
- explicitly reports any valid search candidate the engine cannot accept.

Do not change the production federation engine during the live-game freeze. If the AI planner finds a
shared-engine correctness bug, minimize it and schedule the shared fix under §0.3.

### 7.2 Round-6 solver

Build exact search from selected Round 6 committed states using:

- resource-state Pareto dominance;
- no-future-income simplifications;
- final resource conversion;
- action ordering and opponent denial;
- exact final-scoring evaluation;
- alpha-beta and transpositions where valid.

Measure which Round 6 depths/state families are exactly solvable. Extend into late Round 5 only if
the measured state count permits it.

Exact values become:

- regression oracles;
- evaluator tests;
- network training labels;
- book/search calibration positions.

### 7.3 State-keyed opening book

Build from the strongest available search. Key by `(challenge version, canonical state hash)`, not
move prefix. Store:

- candidate visit counts and values;
- selected move;
- search configuration/model hash;
- nodes/simulations;
- value gap and uncertainty;
- principal alternatives;
- generation timestamp/version.

Prioritize coverage of setup placements, boosters, high-probability human lines, and adversarially
discovered deviations. Never claim exhaustive or perfect coverage without a proof/bound.

### Exit gate

- Federation candidates have brute-force validation on reduced maps/cases and corpus parity.
- Exact endgame coverage and limits are measured and documented.
- Book fallback to live search is seamless.
- Book entries are reproducible from pinned artifacts.

---

## 8. Phase 4 — versioned neural representation and training stack

### 8.1 Framework

Use Python/PyTorch for training and ONNX as the first inference interchange format. Node self-play
actors may use `onnxruntime-node`; a later browser worker may use `onnxruntime-web`. Pin all versions
and verify numerical parity before ranked use.

Do not add training dependencies to production viewer/engine packages. Keep `training/` isolated.

### 8.2 State architecture

Use a transferable graph + global/player token architecture:

- one node per map hex with six-neighbor adjacency;
- static planet/sector/ship/coordinate features;
- dynamic building/owner/Gaiaformer/federation/satellite/power-ring features;
- two player tokens containing resources, bowls, research, buildings, income, tiles, faction, and
  Lost Fleet state;
- global tokens for phase/order/shared actions/setup tiles and supplies;
- graph message passing or graph attention plus global pooling;
- challenge embedding/adapter for seed specialization.

Start small enough for batched single-GPU training and CPU/WASM inference. A reasonable experiment
range is width 96–192 and 4–8 residual graph/global blocks; choose by measured strength/latency, not
by plan fiat.

### 8.3 Candidate policy head

Encode each legal candidate using:

- action/subphase/actor embeddings;
- target hex embedding or pooled federation-set embedding;
- tile/booster/track/ship/building IDs;
- cost/reward and conversion-plan vectors;
- range/terraform/satellite/warning metadata;
- expected next-actor metadata.

Score `(state embedding, action embedding)` with a shared MLP/bilinear head and normalize only over
legal candidates. Store policy targets by canonical candidate key.

### 8.4 Value and auxiliary heads

- final-margin categorical distribution with explicit tail bins;
- expected margin scalar;
- both final scores;
- round scoring by player/round;
- final-condition progress/outcome;
- research endgame VP;
- future resource/income summary;
- optional claim/ownership heads for contested assets.

Auxiliary outputs are training signal unless a later ablation shows a search benefit.

### 8.5 Feature completeness audit

Maintain a checked-in matrix mapping every canonical-state field to:

- direct feature;
- derived feature;
- static challenge constant;
- proven irrelevant reason.

Add tests/probes for:

- tensor invariance across cache/log-only changes;
- actor/player-slot correctness;
- encode/decode metadata versions;
- legal policy mask coverage;
- small-batch overfit;
- ONNX versus PyTorch output parity;
- feature schema rejection on version mismatch.

### Exit gate

- Network deliberately overfits a tiny corpus and reproduces policy/value targets.
- PyTorch and ONNX agree within documented tolerances.
- Inference batching and target browser/CPU latency are measured.
- Candidate policy handles all corpus action shapes without a fixed action universe.
- Feature completeness matrix has no unexplained future-relevant omission.

---

## 9. Phase 5 — Expert Iteration and seed-specialized self-play

### 9.1 Bootstrap

Do not begin from uniformly random play unless used as a control. Bootstrap with:

- heuristic/search policy targets;
- finished search-bot games;
- exact Round 6 values;
- opening/setup analysis;
- any owner-approved human games.

Train an initial policy/value model by supervised search distillation, then enter iterative
self-play: current model + search generates games, training updates the model, and the strongest
candidate is gated against a champion population.

### 9.2 Self-play actors and batching

- Run multiple Node game actors in parallel.
- Batch leaf inference on the GPU.
- Record engine time, inference queue time, GPU utilization, games/hour, positions/hour, and
  simulations/decision.
- Use varied training search budgets; retain high-budget policy targets on a fraction of positions.
- Exploration noise is training-only and phase/round-aware.

### 9.3 Replay buffer

Use a stratified reservoir rather than a short rolling window that forgets rare branches. Preserve:

- recent self-play;
- setup/opening branches;
- both factions and all rounds;
- high-entropy/high-value-error states;
- exact endgame states;
- human and adversarial positions;
- champion-regression positions.

Periodically reanalyse retained states with the latest search so stale weak-policy labels do not
become permanent truth.

### 9.4 Champion gating

Evaluate candidate versus:

- current champion;
- search-only champion;
- selected historical champions to detect cycles;
- deeper-search opponent;
- curated off-book position suite;
- frozen adversarial attacker once available.

Use paired faction assignments and confidence intervals on paired margin. Record compute/latency as
well as score. Promotion requires no severe regression on any protected position group.

### 9.5 Stop criteria

Training stops for a release candidate only when:

- improvement has plateaued across several independent candidate trainings/evaluations;
- deeper search gives acceptably small gains at the live budget;
- adversarial evaluation no longer finds cheap catastrophic lines within its budget;
- both faction policies meet latency and strength gates;
- the final model/search/book hashes are frozen.

“Did not beat the immediately previous model once” is not a stop criterion.

---

## 10. Phase 6 — adversarial hardening, transfer, and final AI artifact

### 10.1 Frozen-AI attacker

Train/search specifically from the human seat against a frozen release candidate. Optimize for human
margin, including unusual legal openings and conversion/federation lines. Feed discovered failures
back into the protected corpus and self-play population.

### 10.2 Human coverage

If real challenge games become numerous enough, train a separate human-policy head conditioned on
faction/round/state. Use it only to:

- prioritize book branches;
- sample realistic adversarial starts;
- order practice-mode pondering;
- report likely human moves.

Do not let it weaken minimax backups or replace the robust opponent policy.

### 10.3 Cross-month architecture

Maintain:

- a general graph/candidate trunk trained on all approved boards/data;
- challenge-specific adapters/embeddings and specialist heads;
- a reanalysed base replay reservoir;
- separate opening books per challenge.

For every new month compare three initializations: scratch, general base, and prior specialist. Mix a
small base-data fraction during specialization and promote only by measured results. Never assume the
last specialist transfers positively.

### 10.4 Frozen release bundle

The immutable release manifest contains:

- challenge definition and manifest hashes;
- engine/search/feature schema versions;
- model hash and format;
- book hash;
- exact search parameters and simulation count;
- canonical RNG derivation;
- per-faction par/reference scores;
- evaluation report.

RNG derivation must include challenge ID/version, canonical state hash, acting seat, decision index,
model hash, and search-config hash. Do not seed from game seed + ply alone.

---

## 11. Phase 7 — isolated practice-mode viewer integration

Do not begin while existing-game safety work is unresolved. Read `PERFORMANCE.md` before viewer
rendering changes and follow the standing render-test/visual-verification rules.

### Work

1. Add a new challenge route and lazy-loaded challenge bundle. Do not modify existing hosted-game
   seat resolution or `resolve-automation` behavior.
2. Put local inference/search in a dedicated Web Worker.
3. Load model/book assets by content hash and reject version mismatch.
4. Lock human/AI seats only inside challenge mode.
5. Use the owner-approved maximum local configuration: fixed high simulations with no device-speed
   downgrade. Show genuine completed/target simulations, positions evaluated, elapsed time, moving
   ETA range, and a worker heartbeat/last-update status.
6. Keep client results explicitly **unranked** until Phase 8 authority exists.
7. Add an explicit capability gate and graceful worker failure. If a device cannot run the full
   maximum configuration, mark it unsupported; do not silently lower the model or search budget.
   Detect hidden/background suspension and distinguish it from a dead worker. A screen-wake request
   may be offered where supported.

### Exit gate

- Existing self-contained and hosted flows are byte/behaviorally unaffected outside the new route.
- Full engine/viewer suites and production builds pass.
- Real browser verification covers both faction choices, worker cancellation, reload, model
  version failure, truthful progress/ETA/heartbeat, and background suspension.
- Benchmark the full unchanged workload on the owner's Ryzen 5 5600G / RTX 3060 12GB / 16GB
  desktop and iPhone 16 Pro Max. Phone support must not weaken the desktop configuration.
- No Supabase ranked submission is exposed.

---

## 12. Phase 8 — authoritative ranked backend and anti-cheat

### 12.1 Separate additive schema

Use challenge-specific tables, for example:

- `ai_challenges`: immutable versioned release manifests;
- `ai_sessions`: user, challenge version, human faction, status, attempt number;
- `ai_session_moves`: sequential human and authoritative AI moves with pre/post state hashes;
- `ai_results`: server-derived final scores/margin and verification version;
- `ai_leaderboard_entries`: derived/denormalized display data if needed.

Do not add triggers to existing `games`, `moves`, `premoves`, or `resolve-automation` flows.

Before implementing this phase, re-check the current Supabase changelog and security documentation;
do not freeze API, CLI, or Data API exposure assumptions from this plan. Build and validate the
migration against a disposable local or staging project first. Run database advisors and review the
generated migration before it can be considered for production.

Security boundaries are explicit:

- Enable RLS on every challenge table in an exposed schema.
- User policies must combine the `authenticated` role with an `auth.uid()` ownership predicate;
  authentication alone is not authorization.
- Clients may create/read only the minimum session surface allowed by the protocol. They may never
  insert or update authoritative AI moves, hashes, final results, leaderboard ranks, or release
  manifests.
- Keep worker-only data in an unexposed/private schema where practical. If a public leaderboard
  view is used, make it a deliberately sanitized `security_invoker` surface rather than exposing
  session rows.
- Never ship a service-role or secret key to the viewer. The worker path is server-only and must
  authenticate its caller independently.
- Do not use user-editable JWT metadata for authorization.

### 12.2 Authoritative move protocol

1. Server creates a session pinned to immutable challenge/engine/model/search artifacts.
2. Human submits one committed line with expected sequence and pre-state hash.
3. Server locks the session row, replays and validates the line, commits it transactionally, and
   derives the next state. A unique `(session_id, sequence)` key plus an idempotency key prevents
   duplicate or reordered writes.
4. When the AI is actor, an authoritative worker computes the fixed-budget move, records diagnostics
   and hashes, and commits it.
5. Client receives only committed authoritative state/moves.
6. Final score and leaderboard row are derived server-side; submitted client scores are ignored.

If authoritative search exceeds Edge Function limits, use a queue plus long-running worker. Do not
weaken verification to random spot checks.

### 12.3 Fairness and leaderboard rules

- Separate Xenos and HH leaderboards; optionally show a normalized combined achievement only after
  faction-specific par calibration.
- Separate difficulty/search configurations.
- Decide and display attempt policy: unlimited puzzle attempts, best result, first result, or limited
  ranked attempts. Store attempt counts either way.
- Fixed simulations eliminate device-speed strength differences; server compute eliminates browser
  nondeterminism.
- Pondering and client model study may remain available in unranked practice, not authoritative play.
- Pin old challenge versions so later engine/model releases cannot rewrite completed results.

### 12.4 Security tests

- forged/changed AI move rejected;
- legal but non-authoritative AI move rejected;
- stale sequence/state hash rejected;
- replay/model/engine version mismatch rejected;
- duplicate submit idempotent;
- concurrent submissions serialize to exactly one accepted next move;
- RLS prevents reading private session internals or writing results directly;
- service-role path is the only result insertion authority;
- no service-role/secret value exists in a built client artifact;
- database advisors report no unresolved security finding in the challenge schema;
- old completed sessions still replay under their pinned bundle.

### Exit gate

- Ranked result can be reproduced from authoritative stored artifacts.
- A modified client cannot weaken the AI or forge a better margin.
- Existing multiplayer schema/functions remain unaffected.
- Load/cost limits are measured before public rollout.

---

## 13. Phase 9 — safe production rollout and monthly operation

### 13.1 Rollout order

1. Keep feature flag off.
2. Deploy additive challenge schema/functions without touching existing-game triggers.
3. Deploy hidden practice route.
4. Run owner-only practice and ranked sessions.
5. Replay/verify every beta session and inspect logs/cost/latency.
6. Confirm no active hosted-game regression.
7. Enable for a small private group.
8. Enable the public/private monthly leaderboard only after the owner explicitly approves.

Rollback must be disabling the challenge flag/worker, not rolling back shared engine code used by
live games.

### 13.2 Monthly production checklist

1. Define seed/factions/order/options.
2. Generate and human-review the exact challenge manifest.
3. Run full engine replay/fuzz safety corpus.
4. Start from scratch/base/prior-specialist candidates and select by evaluation.
5. Build exact endgame data and state-keyed book.
6. Train/fine-tune specialist with stratified data.
7. Run paired champion/search/deeper-search/adversarial evaluations.
8. Freeze engine/model/book/search hashes.
9. Calibrate per-faction par scores and difficulty tiers.
10. Deploy hidden beta, verify, then activate.
11. Add completed human games to the approved corpus only after privacy/data-retention review.

---

## 14. Recommended implementation sessions

This plan is deliberately split for token/context efficiency and reviewability.

| Session       | Scope                                                     | Stop condition                 |
| ------------- | --------------------------------------------------------- | ------------------------------ |
| Plan          | Reviewed execution plan                                   | Done                           |
| AI-1          | Phase 0 safety, challenge definition/manifest, benchmarks | Done                           |
| AI-2          | Phase 1.1 canonical state/hash                            | Done                           |
| AI-3          | Phase 1.2 typed decision expander                         | Done                           |
| AI-4          | Phase 1.3 conversion planner + locked-state hardening     | Done                           |
| AI-5          | Phase 1.4 macro builder + corpus campaign                 | Done                           |
| **AI-6 next** | **Greedy/heuristic bots + evaluator**                     | Inspectable baselines complete |
| AI-7          | MCTS/Gumbel search + strength harness                     | Phase 2 gate/measurements      |
| AI-8          | Federation planner + exact R6 solver                      | Exactness/coverage documented  |
| AI-9          | State-keyed book                                          | Reproducible book + fallback   |
| AI-10         | Neural schemas/PyTorch/ONNX stack                         | Phase 4 gate                   |
| AI-11+        | Self-play iterations, each with one measured objective    | Champion gate per iteration    |
| Later         | Adversarial hardening, practice UI, backend, rollout      | Each phase gate separately     |

Do not compress AI-1 through AI-5 into one session. The action/search foundation is the highest-risk
part, and each slice produces evidence that may change the next design.

### Fresh-session starter prompt

AI-5 is complete; its evidence lives in `docs/lost-fleet/AI_PHASE_1_4_HANDOFF.md` ("Phase 1.4
result"). AI-6 needs a fresh owner-approved handoff before any session starts it; do not reuse the
obsolete AI-1 or AI-5 prompts.

---

## 15. Global verification matrix

Every later phase must preserve the applicable rows:

| Risk                        | Required verification                                               |
| --------------------------- | ------------------------------------------------------------------- |
| Existing live-game behavior | No import/runtime path until integration; full existing suites      |
| Replay determinism          | Constructor vs host-style vs search transition parity               |
| State hash                  | Cache/log invariant; future-relevant counterfactual sensitivity     |
| Legal completeness          | Available data -> canonical candidates -> successful application    |
| Conversion pruning          | Brute-force equivalence on bounded cases; no arbitrary cap          |
| Federation planning         | Reduced-case brute force + current-engine legality validation       |
| Search correctness          | Tiny-game/reference trees; actor-switch/leech tests; exact endgames |
| Value orientation           | Seat swap/sign tests and terminal exact-margin tests                |
| Network legality            | Mask/candidate-key parity; no illegal policy mass                   |
| Training progress           | Paired faction evaluation + protected off-book corpus               |
| Browser inference           | ONNX parity, latency, worker failure/cancel tests                   |
| Ranked integrity            | Server-authoritative moves, pinned hashes, transactional sequence   |
| Production isolation        | Challenge-only feature flag/schema/functions; rollback by disable   |

---

## 16. Decision log and measured phase results

Append decisions here rather than silently changing the architecture.

| Date       | Phase           | Decision/result                                                                                                                                                                                                                                                                                                                    | Evidence                                                                                       |
| ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 2026-07-13 | Plan review     | Keep net-guided search as final target; build/promote from search-only Expert Iteration baseline                                                                                                                                                                                                                                   | External code/design audit                                                                     |
| 2026-07-13 | Performance     | Do not implement undo up front; clone ~0.65–0.78 ms and command generation reached ~1.98 ms                                                                                                                                                                                                                                        | Local warm-process benchmark                                                                   |
| 2026-07-13 | Search model    | Complete committed move line is the initial tree edge                                                                                                                                                                                                                                                                              | Engine transient serialization + host/fuzzer flow                                              |
| 2026-07-13 | Policy          | Use variable legal-candidate scorer, not fixed action universe                                                                                                                                                                                                                                                                     | Structured nested actions + conversion/federation branching                                    |
| 2026-07-13 | Ranked security | Server authority/state-bound receipts required; end replay alone is insufficient                                                                                                                                                                                                                                                   | Client can submit arbitrary legal weak AI moves                                                |
| 2026-07-13 | Production      | Documentation now; Phase 0 in a fresh session; no runtime change during current live games                                                                                                                                                                                                                                         | Production `master` auto-deploy constraint                                                     |
| 2026-07-13 | Phase 0         | Locked manifest/benchmark foundation complete; semantic SHA `ce3bdd…51e`                                                                                                                                                                                                                                                           | 3 focused tests + fresh byte/golden check                                                      |
| 2026-07-13 | Phase 1.1       | Canonical future-relevant state/hash complete                                                                                                                                                                                                                                                                                      | 12 focused tests; constructor/slow-motion/hydration parity                                     |
| 2026-07-13 | Phase 1.2       | Typed atomic expander complete; 62 locked candidates                                                                                                                                                                                                                                                                               | 10 focused tests; digest `a28eb3…04d9`                                                         |
| 2026-07-13 | Phase 1.3       | Exhaustive conversion planner hardened; 36,159 states, 9,985 frontier, 45 candidates, depth 30                                                                                                                                                                                                                                     | 15 focused tests; locked digest `b4e266…850`; full engine 671/4                                |
| 2026-07-13 | Local runtime   | Maximum mode uses one fixed high simulation workload; no device-driven downgrade; incapable devices unsupported                                                                                                                                                                                                                    | Owner decision; target desktop + iPhone 16 Pro Max; later UI needs real progress/ETA/heartbeat |
| 2026-07-14 | Phase 1.4       | Committed-turn macro builder complete: stable `macro-v1` keys over semantic choice only; locked Round-1 branch stats 52 macros/32 mains before vs 45 candidates and 130,532 seed pairs after conversion integration; every emitted macro validated by fresh-clone host-style replay                                                | Focused suite + locked digests `972a1e…9096`; corpus campaign                                  |
| 2026-07-14 | Phase 1.4       | Custom (hand-picked hex set) federations are descoped by owner: the AI forms only engine-enumerated satellite-path federations; a custom-only fallback offer is deliberately excluded and recorded (`excludedCustomFederationTiles`), never aborting a state or read as "no federation", and is not a gap awaiting a later feature | Owner decision + live macro-game campaign (11/1,039 states hit the fallback)                   |
| 2026-07-14 | Phase 1.4       | Replay-path hash differences confined to the base-003 federationCache staleness class (serialization drops the cache's `custom` flag) are counted and mask-verified, not concealed and not "fixed" in shared engine code                                                                                                           | Cache-masked canonical comparison in the corpus campaign                                       |
