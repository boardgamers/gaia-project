# Lost Fleet AI — Phase 1.4 handoff

> **Status (2026-07-14): PHASE 1.4 COMPLETE.** Phases 0, 1.1, 1.2, 1.3, and 1.4 are done; the
> measured Phase 1.4 results are in the "Phase 1.4 result" section below. The next authorized
> slice is AI-6 (greedy/heuristic bots + evaluator, plan §6) and requires fresh owner approval.
> Do not start search, evaluation, federation solving, neural features, training, viewer
> integration, or backend work without that approval. The original Phase 1.4 contract below is
> retained unchanged as the record of what this phase had to satisfy.

## Phase 1.4 result (2026-07-14)

Implemented on `claude/gaia-phase-1-4-yjb6qo` (built from `agent/phase-1-3-resource-planner`
commit `8b9ee84b`), offline-only under `engine/src/ai/` and `engine/scripts/ai/`.

### Delivered

- `engine/src/ai/actions/turn-builder.ts` + `turn-builder.spec.ts` (12 focused tests): committed-
  turn macro construction. Every macro is built and validated by replaying its complete line
  against a fresh clone of the committed source with the production commit rule (one `move()`,
  commit only on `newTurn` — the same rule as `viewer/src/hosted/host.ts`, `self-contained.ts`,
  and the fuzzer). Macro keys (`macro-v1:` + SHA-256) hash the semantic choice only: source
  canonical hash, actor, Phase 1.3 conversion-destination wallet key (null for no prefix), Phase
  1.2 main-candidate key, chosen candidate keys at meaningful follow-up decisions in order, and
  the retained AfterMove conversion destination key. Forced one-choice follow-ups stay on the
  spine, never branch, and never enter the key; the conversion-integrated and conversion-free
  construction routes produce identical keys for the shared macros, and equivalent conversion
  prefixes cannot duplicate macros because Phase 1.3 already canonicalizes one plan per
  destination wallet. `DeadEnd` follow-ups reject the line before exposure
  (`rejected[].reason === "dead-end-follow-up"`); committed leech choices are separate subsequent
  edges built from the committed leech state. Setup, income, Gaia, and leech decisions flow
  through the same generic committed-decision path.
- `engine/src/ai/testing/corpus.ts` + `corpus.spec.ts` (3 focused tests) and
  `engine/scripts/ai/corpus-campaign.ts`: macro-sampled full games from the locked prefix
  (host-style commit chain) and the corpus campaign.
- Additive, output-preserving extensions to earlier phases (verified by the preserved suites):
  - `canonical-state.ts` projects `federationCache.custom` through the engine's own truthy
    coercion (`!!`), byte-identical for every live boolean and making hydrated mid-game caches
    hashable instead of a projection crash;
  - `resources/planner.ts` gained `planAfterActionConversionsForLine` (exact-prefix variant of
    `planAfterActionConversions`, shared implementation) and drops the engine's custom-only
    FormFederation fallback at conversion-reached wallets (custom federations are out of scope; see
    the finding below).

### Locked branch statistics (before/after conversion integration, locked Round-1 state)

- Before: 52 committed macros over 32 root main candidates, zero rejections, macro
  key/destination digest `972a1e9b062ebcda5a96e2242039bbc29eee83934c9eb41e175a493bb1009096`.
- After (seed level, from the locked Phase 1.3 result): 45 candidate frontiers; 130,532
  (conversion prefix, main candidate) seed pairs; 130,500 with a non-empty prefix; the 32
  empty-prefix seeds are exactly the root-affordable mains; per-candidate prefix counts 5 min /
  2,134 median / 9,985 max. Emitting all ~130k lines is a measured multi-hour offline job (each
  line is replay-validated), so the focused suite locks the exact seed-pair counts and emits
  complete integrated macro sets on smaller wallets; an integrated turn on a real mid-game state
  is exercised end-to-end in the corpus spec.

### Corpus campaign (locked challenge, macro-sampled games, integration off)

18 complete games, every game reached `EndGame`; 1,039 committed corpus states; per state:
canonical hash + serialize/parse hydration parity, typed expansion with unique sorted macro keys,
every emitted macro fresh-clone validated, sampled macro re-applied host-style with destination
hash + next-actor equality, constructor replay of the accumulated history hash-checked (all 1,039)
with full macro parity on 155 deep-check states. 106 committed leech-decision states; rounds 0–6
and phases setupBuilding/setupBooster/roundMove/roundLeech covered; 20,834 macros built (1–400
per state); 132 rejected lines, all `dead-end-follow-up`; zero deduplications; wall time 653 s
under load. ChooseIncome and PlaceLostPlanet never occur naturally in these trajectories and have
explicit synthetic coverage in the focused suite (as in Phase 1.2); BrainStone/PISwap/Tinkering
are outside the locked Xenos/Hadsch-Hallas boundary.

### Engine-reality findings (surfaced, not concealed; no shared-engine change)

1. **Custom-federation fallback in real play (deliberately excluded).** Macro-sampled Xenos/HH
   games reach states where the engine offers a federation only through its custom (hand-picked
   hex set) fallback (`federations: []`, `federationCache.custom`), which Phase 1.2 rejects by
   contract. Per owner decision (2026-07-14) custom federations are out of scope: the AI forms
   only the engine's enumerated satellite-path federations, so when only the custom fallback is
   offered it forms no federation that turn. The macro layer drops the un-enumerable offer and
   records the dropped tiles in `excludedCustomFederationTiles` (11 of the 1,039 corpus states) so
   the exclusion is audited, not silent. A custom-only offer means the heuristic found no
   satellite-path federation at that wallet, so nothing enumerable is lost. This is not a gap
   awaiting a later custom-federation feature.
2. **federationCache replay divergence (base-003 class).** `Player.toJSON()` drops the cache's
   boolean `custom` flag while current engine behavior reads it, so a live `custom: true` state
   and its serialized counterpart are genuinely different states; Phase 1.1 hashes the cache on
   purpose. 39 of 1,039 corpus states show replay-path hash differences, every one proven by a
   cache-masked byte comparison to be confined to this class and counted
   (`federationCacheHashDivergences`); macro parity on those states is checked on
   hash-independent semantic content and holds. Any divergence outside the masked cache fails the
   campaign. The shared-engine fix remains a Phase 3/maintenance-window item.

### Verification results (2026-07-14)

- Phase 1.4 focused: `turn-builder.spec.ts` 12 passing; `corpus.spec.ts` 3 passing.
- Preserved focused suites: Phase 1.3 `planner.spec.ts` 15, Phase 1.2 `expand.spec.ts` 10, Phase
  1.1 `canonical-state.spec.ts` 12, Phase 0 `challenge-manifest.spec.ts` 3 + `benchmark.spec.ts` 1
  = 41 passing (unchanged), confirming the Phase 1.2 62-candidate digest `a28eb3…04d9`, the Phase
  1.3 locked result 36,159 / 9,985 / 45 / depth 30 digest `b4e266…850`, and the Phase 1.1 corpus
  hashes all still hold after the additive `canonical-state.ts`/`planner.ts`/`types.ts` edits.
- Complete offline AI suite (`src/ai/**/*.spec.ts`): 56 passing (41 + 12 + 3).
- Complete engine suite (`src/**/*.spec.ts` `src/*.spec.ts` `*.spec.ts`): 686 passing, 4 pending
  (671 + 15 new; the 4 pending are the pre-existing engine pendings).
- `npx tsc --noEmit`: clean. Focused ESLint on every changed/added TS file: clean.
- Fresh Phase 0 manifest: byte-identical to `challenge-manifest.v1.json` (81,991 bytes, byte SHA
  `3c872d…449e`), semantic SHA `ce3bdd…51e`, engine version 4.8.51 — all unchanged.
- `git diff --check`: clean. Final-newline/trailing-whitespace checks on new files: clean.
- Production isolation: no `engine/index.ts`, viewer, or Supabase path imports `engine/src/ai/`;
  every new AI file imports only engine internals and other `engine/src/ai/` modules.

### Measured planning cost (descriptive, no caps added)

Exhaustive conversion planning is wallet-dependent: 0.01–12 s on typical mid-game wallets, ~80 s
on the pristine locked Round-1 wallet, 738 s on a measured power-rich Round-6 state, and the
pristine-wallet AfterMove axis exceeds practical wall-clock entirely (one complete fixpoint per
distinct post-main wallet). `conversionIntegration` and `afterConversionIntegration` therefore
stay separately selectable — exact and uncapped whenever enabled — and every statistic states
which axes ran. Scheduling which turns a sampled player converts on is a play-policy choice;
no depth cap, timeout, weight, beam, or heuristic prune was added anywhere.

### Remaining risks carried to later phases (nothing open blocks Phase 1.4)

| #   | Item                                                                           | Owner phase                             | Notes                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Custom (hand-picked hex set) federations                                       | none — descoped by owner (2026-07-14)   | The AI forms only engine-enumerated satellite-path federations; the custom-only fallback is deliberately excluded and recorded (`excludedCustomFederationTiles`), not a gap. A Phase 3 federation planner, if built, would still select among engine-enumerated federations, not construct custom hex sets — confirm scope when Phase 3 starts. |
| 2   | Shared-engine fix for the base-003 `federationCache.custom` serialization drop | Phase 3 / maintenance window            | Requires the §"maintenance-window checklist" in `engine/src/ai/README.md`; not authorized during the live-game freeze. Phase 1.4 counts and mask-verifies the divergence rather than hiding it.                                                                                                                                                 |
| 3   | Brainstone / PISwap / Tinkering follow-up families                             | later, if the challenge factions change | Outside the locked Xenos/Hadsch-Hallas boundary, so not exercised; the builder already routes them through the same generic path if they ever appear.                                                                                                                                                                                           |
| 4   | AfterMove-integration wall-clock on resource-rich wallets                      | AI-6/AI-7 search budgeting              | Split onto the `afterConversionIntegration` axis; the eventual search layer decides when to pay for it. No cap was added.                                                                                                                                                                                                                       |
| 5   | Phase 1.3 regression tests recommended by the #68 race-condition audit         | still open (pre-existing)               | Unrelated to Phase 1.4; noted so it is not lost.                                                                                                                                                                                                                                                                                                |

## Production boundary

- Real players may have active hosted games.
- `master` is the Vercel production branch; every push to it deploys.
- Keep Phase 1.4 under `engine/src/ai/`, offline, and unreachable from production imports/exports.
- Do not modify shared engine rules, serialization, hydration, replay, viewer, Supabase, deployment,
  feature flags, hosted data, or production entry points.
- Do not commit, push, deploy, migrate, or change flags without fresh owner approval.
- Do not use subagents unless the owner separately authorizes them.

## Start and read order

Run `git status --short --branch`, `git fetch origin`, `git rev-parse HEAD`, and
`git rev-parse origin/master` before editing. Work from the latest
`origin/agent/phase-1-3-resource-planner`; do not switch to or push `master`.

Read completely, in this order:

1. `AGENTS.md`.
2. `docs/lost-fleet/PROGRESS.md`, especially Working agreements and Testing.
3. `docs/lost-fleet/RULES_CLARIFICATIONS.md`.
4. `docs/lost-fleet/COMPONENTS.md`.
5. `docs/lost-fleet/AI_IMPLEMENTATION_PLAN.md`, especially §§1, 5.4, 14, 15, and 16.
6. `engine/src/ai/README.md`.
7. Every file under `engine/src/ai/`.
8. The production committed-turn/replay paths already cited by the plan: the self-contained host,
   hosted move application, fuzzer driver, leech/forced follow-up handling, and end-turn flow.

Preserve all existing work. Never reset, clean, stash, checkout, revert, or overwrite owner changes.

## Completed foundation

### Phase 0

- Locked challenge manifest and reproducible offline benchmark foundation.
- Engine version: `4.8.51`.
- Manifest semantic SHA-256:
  `ce3bdd7322860484dfae771320b9f12967d0677b908f91cdc682d9c4427bf51e`.
- Fresh normalized manifest bytes: 81,991 bytes with SHA-256
  `3c872d121f71447842e027a49de75e57c22e6919f2ac152d0cdf4f8a57f8449e`.

### Phase 1.1

- Canonical future-relevant state projection and stable state hash.
- Constructor replay, `Engine.slowMotion`, and hydration parity are locked.
- Canonical focused suite: 12 passing.

### Phase 1.2

- Typed atomic decision expansion with stable candidate keys and executable fragments.
- Locked Round-1 candidate count: 62.
- Candidate digest:
  `a28eb3d03e2b51e1bea28170b92f5e99991f41c76b1b1c8a2193a97a0ee704d9`.
- Focused suite: 10 passing.

### Phase 1.3 behavior

- Exhaustive semantic conversion-state fixpoint with no depth or time cap.
- Canonical unit actions for ranged `Spend`, burn aliases, and commutative/equivalent states.
- Lossy-cycle detection and context-aware, weight-free Pareto dominance.
- Explicit brainstone, bowls, Gaia tokens, Gaiaformers, token modifiers, and faction conversions.
- Phase 1.2 candidate affordability and nondominated post-payment frontiers.
- Separate `AfterMove` bowl-opening and safe-deferral handling.
- Stable keys, diagnostics, and executable conversion fragments.

## Phase 1.3 performance hardening

### Measured root cause

The first instrumented locked Round-1 run was still incomplete after 120.038 seconds. It had not
started candidate/payment construction. At that cutoff it had performed 11,131,245 dominance
comparisons. The old predicate serialized exact-context JSON twice per comparison: 22,262,490
serializations by the cutoff. Repeated full componentwise frontier scans, amplified by stable JSON
inside each comparison, were the primary bottleneck. Canonical plan/state keys, cycle graph
reconstruction, path retention, and candidate construction were not the initial blocker.

Baseline cutoff counters:

| Counter                          | Value at 120.038s |
| -------------------------------- | ----------------: |
| Generated states                 |             9,742 |
| Accepted states                  |             3,317 |
| Active/max frontier              |             1,528 |
| Transitions considered           |            14,150 |
| Exact-state merges               |             5,662 |
| Pareto prunes                    |             2,553 |
| Lossy-cycle prunes               |                 0 |
| Dominance comparisons            |        11,131,245 |
| State-key calls                  |            19,485 |
| Plan-key computations            |             3,317 |
| Cycle graph reconstructions      |             9,742 |
| Maximum depth                    |                 8 |
| Candidate states/payment results |             0 / 0 |

### Semantics-preserving optimization

- Cache canonical state keys per immutable projected-state object.
- Cache exact-context JSON and all ten monotone dominance dimensions per immutable state.
- Replace `queue.shift()` with a monotone cursor.
- Use deterministic exact-context dominance buckets and necessary-condition resource indexes before
  the complete strict ten-dimensional predicate. No bucket alone can prune a state.
- Preserve insertion order for deterministic diagnostics.
- Select the lexicographically smallest duplicate payment fragment in one pass.
- For payments that subtract only credits, ore, knowledge, QIC, and victory points, skip a redundant
  second Pareto pass: translating a subset of an already nondominated frontier by the same vector
  cannot create a new dominance relation. Nonlinear payments still use the complete index.
- Add deterministic counters, descriptive phase timings, and an optional work-count progress
  callback. No elapsed time participates in planning behavior.

The optimization does not add a depth cap, timeout, resource weight, beam, heuristic prune, or
missing semantic dimension. Every discarded reachability/payment state still has either an exact
semantic merge or a proven full componentwise dominator.

### Completed locked-state result

Final representative run:

| Result/counter              |     Value |
| --------------------------- | --------: |
| Total elapsed               |   46.113s |
| Setup                       |    0.014s |
| Reachability                |   27.207s |
| Result assembly             |    1.104s |
| Candidate construction      |   14.236s |
| Payment frontiers           |    3.551s |
| Generated states            |   151,249 |
| Accepted/reachable states   |    36,159 |
| Active/max frontier         |     9,985 |
| Transitions considered      |   254,360 |
| Exact-state merges          |    85,126 |
| Pareto prunes               |    56,139 |
| Lossy-cycle prunes          |         0 |
| Dominance comparisons       | 1,091,376 |
| Exact-context computations  |   170,652 |
| State-key computations      |   281,782 |
| Plan-key computations       |    36,159 |
| Cycle graph reconstructions |   151,249 |
| Candidate states expanded   |     9,985 |
| Payment results generated   |   130,532 |
| Candidate frontiers         |        45 |
| Maximum conversion depth    |        30 |

Diagnostics: 85,126 exact merges, 56,139 Pareto prunes, zero lossy-cycle prunes, 111 canonical
aliases, and no unavailable effects. Stable result digest:
`b4e266ef95ca8cc34cfd1cde4380a782ff01f4802a077d49ac9686924e222850`.

Elapsed time is descriptive and machine-dependent. The regression locks completion, counters that
describe semantic work, keys, and replay parity; it deliberately has no fragile time assertion.

### Verification already passed

- Phase 1.3 focused: 15 passing.
- Phase 1.2 focused: 10 passing.
- Complete offline AI: 41 passing.
- Phase 1.1 canonical: 12 passing.
- Phase 0 manifest: 3 passing.
- Complete engine: 671 passing, 4 pending.
- `npx tsc --noEmit`.
- Focused ESLint for all modified TypeScript files.
- Fresh Phase 0 byte/golden and both SHA checks.
- Explicit Phase 1.2 base/constructor/slow-motion/hydration 62-candidate digest and fragment check.
- Every representative conversion-fragment shape applies to a clone and reaches its projected state.
- `git diff --check`, final-newline/whitespace checks, and production-isolation audits.
- No production import/export references `engine/src/ai/`.

## Phase 1.4 objective

Build complete committed-turn macros from the last committed snapshot. A macro may contain:

1. a Phase 1.3 conversion plan;
2. exactly one Phase 1.2 main-action candidate;
3. every forced follow-up needed to make the action executable;
4. meaningful after-action choices that cannot safely be deferred;
5. `end` when required; and
6. a committed leech choice as a separate subsequent decision edge when control passes through
   leech before the next committed turn.

Do not serialize or cache arbitrary transient engine states. Construct and validate each complete
line by replaying from the last committed snapshot, matching the production host and fuzzer flow.

Forced one-choice follow-ups must not become policy branches. Preserve real choices such as tech
tile, covered tile, research advance, federation token, artifact, booster, Gaia target, Lost Fleet
special choices, and leech. Stable macro keys must encode the complete semantic choice, not timing,
object identity, or incidental command order.

## Required Phase 1.4 evidence

- Every emitted macro applies to a fresh clone and ends at a committed state, or is rejected before
  exposure.
- No `DeadEnd` macro is exposed.
- Constructor replay, `Engine.slowMotion`, hydration, and host-style replay produce the same macro
  keys and committed destination hashes.
- Actor transition is recorded correctly, including pass order and leech interruption.
- Equivalent conversion prefixes do not create duplicate macros.
- Phase 1.2 candidate keys/fragments/count/digest and Phase 1.3 locked digest/counters remain exact.
- Randomly sampled macro play reaches `EndGame` without the fuzzer's historical conversion cap.
- At least 1,000 diverse committed corpus states pass hash/legal/apply/replay properties.
- All locked-setup command/follow-up types have explicit coverage.
- Branch statistics are measured before and after conversion-plan integration.
- No unsupported custom-federation state is silently treated as “no federation.”
- No shared production-engine behavior or production import/export changes.

If the 1,000-state campaign exposes an engine-rule discrepancy, stop and report it. Phase 1.4 does
not authorize changing shared rules.

## Later runtime decision — document only, do not implement in Phase 1.4

The owner selected a maximum-strength local AI for the private challenge:

- Same model, opening book, and fixed high simulation count on every supported device.
- No time-based early exit and no automatic low-device search/model downgrade.
- Faster hardware returns the same work sooner; it does not receive a stronger configured opponent.
- Devices that cannot run the full configuration are declared unsupported rather than silently
  receiving weaker play.
- Primary target devices are the owner's Ryzen 5 5600G / RTX 3060 12GB / 16GB Windows desktop and
  iPhone 16 Pro Max. Actual support must be benchmarked; phone support must not weaken desktop AI.
- The later Web Worker UI must show real completed/target simulations, evaluated positions, elapsed
  time, a moving ETA range, and a heartbeat/last-update status. It must detect background suspension
  and distinguish it from a dead worker. A supported screen-wake request may be offered.
- Server-authoritative AI remains an optional later choice only if ranked anti-cheat or identical
  server execution is desired. It is not required for the private local challenge.

“No device-driven limit” does not mean infinite search: an infinite search never moves. The final
fixed workload must be selected from strength-versus-compute measurements and diminishing returns,
not from a requirement to support low-end devices.

## Verification commands for Phase 1.4

Run from `engine/` unless noted:

```powershell
# New Phase 1.4 focused suite, then preserved focused suites
npx mocha -r ts-node/register --reporter min '<new Phase 1.4 spec paths>'
npx mocha -r ts-node/register --reporter min 'src/ai/resources/planner.spec.ts'
npx mocha -r ts-node/register --reporter min 'src/ai/actions/expand.spec.ts'
npx mocha -r ts-node/register --reporter min 'src/ai/canonical-state.spec.ts'

# All offline AI and full engine
npx mocha -r ts-node/register --reporter min 'src/ai/**/*.spec.ts'
npx mocha -r ts-node/register --reporter min 'src/**/*.spec.ts' 'src/*.spec.ts' '*.spec.ts'
npx tsc --noEmit
```

Also run focused ESLint on every changed TypeScript file, a fresh Phase 0 manifest byte/golden/SHA
comparison, the explicit Phase 1.2 62-candidate replay/hydration digest check, the Phase 1.3 locked
completion/digest regression, `git diff --check`, untracked whitespace/final-newline checks, final
status, and changed-path plus production-import/export isolation audits.

## Stop conditions

Stop for owner guidance if Phase 1.4 appears to require:

- changing shared engine semantics;
- transient-state serialization or production hydration changes;
- unsafe conversion/macro dominance or dropping executable plans/diagnostics;
- a depth cap, timeout, weighted heuristic, or beam;
- changing Phase 0/1.1/1.2/1.3 outputs;
- viewer, Supabase, deployment, production export, feature-flag, or live-game changes; or
- beginning search, evaluation, federation solving, neural/training, or UI work.

## Required handoff

Report exact changed files, macro representation and completeness argument, corpus composition and
branch statistics, every verification count/hash, production-isolation evidence, remaining risks,
PASS/FAIL for every Phase 1.4/AI-5 criterion, and exact `git status`. Stop for owner review.

## Ready-to-paste Claude Code prompt (HISTORICAL — Phase 1.4 is complete; do not reuse)

```text
You are taking over Phase 1.4 of the Gaia Lost Fleet AI project in:

C:\Users\okimm\Documents\Projects\gaia-lost-fleet

Work from the latest origin/agent/phase-1-3-resource-planner. First run:

git status --short --branch
git fetch origin
git rev-parse HEAD
git rev-parse origin/agent/phase-1-3-resource-planner
git rev-parse origin/master

The starting tree should be clean and HEAD should match the remote agent branch. Do not work on or
push master: it is the Vercel production branch and real hosted games may be active.

Read completely before editing:

1. AGENTS.md
2. docs/lost-fleet/PROGRESS.md, especially Working agreements and Testing
3. docs/lost-fleet/RULES_CLARIFICATIONS.md
4. docs/lost-fleet/COMPONENTS.md
5. docs/lost-fleet/AI_IMPLEMENTATION_PLAN.md, especially §§1, 5.4, 14, 15, and 16
6. docs/lost-fleet/AI_PHASE_1_4_HANDOFF.md
7. engine/src/ai/README.md
8. every file under engine/src/ai/
9. the production committed-turn/replay, forced-follow-up, leech, end-turn, host, and fuzzer paths
   cited by the plan

Implement Phase 1.4 only: committed-turn macro construction plus the 1,000-state corpus campaign.
Do not start heuristic evaluation, MCTS/search, federation solving, opening books, neural features,
training, Web Workers/viewer integration, Supabase/backend work, or any later phase. Do not use
subagents unless the owner separately authorizes them.

Keep all changes offline under engine/src/ai/ and unreachable from production runtime paths. Do not
modify shared engine rules, serialization, hydration, replay semantics, viewer code, Supabase,
deployment configuration, production exports/entry points, hosted data, or feature flags. Do not
commit, push, deploy, migrate, or change flags without fresh owner approval.

Build each complete macro from the last committed snapshot and validate it by replay. Combine an
optional Phase 1.3 conversion plan, one Phase 1.2 main action, every required forced follow-up,
meaningful non-deferrable after-action choices, and EndTurn when required. Treat an intervening
committed leech choice as a separate subsequent edge. Forced one-choice decisions must not become
policy branches; meaningful choices must remain distinct. Never serialize arbitrary transient
engine states and never expose a DeadEnd or non-committed macro.

Preserve exactly:

- engine version 4.8.51
- Phase 0 semantic SHA:
  ce3bdd7322860484dfae771320b9f12967d0677b908f91cdc682d9c4427bf51e
- Phase 1.1 focused count: 12
- Phase 1.2 candidate count: 62
- Phase 1.2 digest:
  a28eb3d03e2b51e1bea28170b92f5e99991f41c76b1b1c8a2193a97a0ee704d9
- Phase 1.3 focused count: 15
- Phase 1.3 locked result: 36,159 reachable states, 9,985 frontier states, 45 candidate
  frontiers, maximum conversion depth 30
- Phase 1.3 digest:
  b4e266ef95ca8cc34cfd1cde4380a782ff01f4802a077d49ac9686924e222850
- current complete offline AI count: 41
- current complete engine result: 671 passing, 4 pending

Required Phase 1.4 gates:

- every emitted macro applies to a fresh clone and ends committed;
- no DeadEnd macro is exposed;
- stable macro keys and committed destination hashes match constructor replay, Engine.slowMotion,
  hydration, and host-style replay;
- actor transition, pass order, and leech interruption are correct;
- equivalent conversion prefixes do not duplicate macros;
- sampled macro play reaches EndGame without a conversion cap;
- at least 1,000 diverse committed corpus states pass hash/legal/apply/replay properties;
- locked command/follow-up types have explicit coverage;
- branch statistics before/after conversion integration are reported;
- unsupported custom federations are never silently treated as no federation;
- no production behavior/import/export changes.

Do not use arbitrary depth/sequence caps, algorithmic timeouts, weighted resource scores, heuristic
beams, unsafe dominance, or dropped diagnostics/executable plans. If Phase 1.4 appears to require a
shared-engine correction or changes any earlier phase output, stop and ask the owner.

Run the focused Phase 1.4 suite, preserved Phase 1.3/1.2/1.1/Phase 0 checks, complete offline AI,
the exact complete engine command from the handoff, npx tsc --noEmit, focused ESLint for every
changed TypeScript file, fresh Phase 0 byte/golden/SHA checks, explicit Phase 1.2 replay/hydration
digest, Phase 1.3 locked completion/digest, git diff --check, final-newline/whitespace checks, final
status, and changed-path plus production-import/export isolation audits.

Update the AI documentation with measured Phase 1.4 results. Report exact changed files, macro
representation and completeness argument, corpus composition and branch statistics, every test
count/hash, production-isolation evidence, remaining risks, PASS/FAIL for every AI-5 criterion, and
exact git status. Then stop for owner review; do not begin Phase 2.
```
