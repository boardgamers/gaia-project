# Lost Fleet AI — Current Session Contract

> Canonical compact entry point for the next AI session. Last updated **2026-07-15** after AI-6 and
> the token-economy review. Read this file completely; use the routed references below rather than
> reconstructing current state from historical documents.

## Document ownership

- **This file:** current branch, completed gate, next scope, preserved invariants, and verification
  cadence. Update it at each AI phase handoff.
- `engine/src/ai/README.md`: stable module/API semantics. Update only sections whose implementation
  changed; do not turn it into a second handoff.
- `AI_IMPLEMENTATION_PLAN.md`: architecture and actual decisions. Read only cited sections; append
  to its decision log only for a new architectural decision or final measured phase result.
- `PROGRESS.md`: project-wide current-task pointer. Keep its AI entry short and link here.
- `AI_PHASE_*_HANDOFF.md`: immutable historical evidence. Do not reread or update unless diagnosing
  that phase.

## Lean startup

1. Run `git status --short --branch`, `git log -5 --oneline`, and compare `HEAD` with the named
   remote branch. Do not switch branches, discard changes, commit, or push without owner approval.
2. Read `AGENTS.md`, its routed `PROGRESS.md` sections, and this file. The target startup context is
   under 4,000 lines / 200 KB.
3. Read plan §1.1–§1.4, §6.3–§6.4, and §§14–15. Do not read the full plan.
4. Inspect these API surfaces first; read their full implementations only when the search design
   needs them:
   - `canonical-state.ts`: `CanonicalState`, `projectCanonicalState`, `canonicalStateHash`;
   - `actions/turn-builder.ts`: `CommittedTurnMacro`, `CommittedTurnMacroSet`, options, and
     `buildCommittedTurnMacros`;
   - `evaluation.ts`: report types, `terminalUtility`, and `evaluateHeuristic`;
   - `bots/types.ts`, `bots/common.ts`, and `bots/heuristic.ts`;
   - `testing/self-play.ts` and focused bot/evaluator specs.
5. Use `rg` and follow direct imports when a contract is unclear. Do not preload the generated
   manifest, corpus implementation/fixtures, resource planner internals, all canonical/macro specs,
   historical handoffs, rules/component ledgers, or the whole AI tree.

## Repository and production state

- Working branch: `claude/gaia-phase-1-4-yjb6qo`.
- Base/remote tip at AI-6 handoff: `7c92029e644e437f1f8a04d1d4e585dc9073fef0`.
- The AI-6 implementation and token-economy documentation are currently uncommitted in the shared
  worktree; `git status` is authoritative. Preserve them exactly.
- `master` is the Vercel production deploy branch. Do not work on, merge to, or push it.
- Keep AI-7 offline under `engine/src/ai/`. Do not add production imports/exports or modify shared
  engine behavior, viewer code, Supabase, deployment configuration, hosted data, or feature flags.
- Do not commit, push, deploy, migrate, or change flags without fresh owner approval.

## Completed foundation

- Phase 0: challenge/golden/benchmarks; semantic SHA
  `ce3bdd7322860484dfae771320b9f12967d0677b908f91cdc682d9c4427bf51e`.
- Phase 1.1: committed canonical state/hash; 12 focused tests.
- Phase 1.2: typed atomic candidates; 62-candidate digest
  `a28eb3d03e2b51e1bea28170b92f5e99991f41c76b1b1c8a2193a97a0ee704d9`.
- Phase 1.3: exact conversion planning; 36,159 reachable / 9,985 frontier / 45 candidates / depth 30;
  digest `b4e266ef95ca8cc34cfd1cde4380a782ff01f4802a077d49ac9686924e222850`.
- Phase 1.4: committed-turn macros; locked 52 macros / 32 mains; digest
  `972a1e9b062ebcda5a96e2242039bbc29eee83934c9eb41e175a493bb1009096`;
  after integration 45 candidate frontiers / 130,532 exact seed pairs.
- AI-6: seeded random, immediate greedy, and deterministic inspectable heuristic bots; 28
  independently ablatable features; exact terminal margin and paired full-game harness.
- AI-6 paired results: greedy over random `+43` total / `+21.5` mean / 2–0; heuristic versus greedy
  `-36` total / `-18` mean / 0–2. The heuristic is a coverage baseline, not a promoted champion.
- Final AI-6 verification: 12 focused, 68 complete offline AI, full engine 698 passing / 4 pending,
  TypeScript and changed-file ESLint clean, production isolation clean. Engine version 4.8.51.

## Locked search semantics

- Utility always uses a fixed seat-0 frame: final `seat0 score - seat1 score`.
- At every node, seat 0 maximizes and seat 1 minimizes the same un-negated value. Actor changes do
  not imply sign changes; free/forced decisions may keep the actor, and leech may switch it.
- A search edge is exactly one Phase 1.4 committed macro. It is replayed host-style on a fresh
  hydrated state, ends at `newTurn`, and matches its canonical destination hash and next actor.
- Terminal utility is exact. Non-terminal leaves use the inspectable AI-6 heuristic.
- Deterministic behavior uses canonical macro keys for ordering/tie-breaking. Any sampling uses an
  explicit reproducible evaluation-only seed.
- Search configurations must pin and report `macroBuildOptions`. The AI-6 baseline defaults both
  expensive conversion-integration axes off; changing that policy requires a measured comparison,
  and enabling an axis must retain the existing exact uncapped planner.
- Fixed simulation counts define comparable search budgets. Do not use wall-clock early exit,
  device-dependent silent downgrade, heuristic beams, or caps inside macro/conversion generation.

## AI-7 scope — search baseline and strength harness

Implement offline search only:

1. Deterministic minimax MCTS/PUCT over Phase 1.4 committed macros, with actual-actor max/min backup
   and the AI-6 heuristic at non-terminal leaves.
2. An explicit, inspectable non-neural prior policy; no neural or learned opponent model.
3. Seeded Gumbel root action sampling plus sequential halving for the planned low-budget/root
   allocation variant. The fixed-budget plain PUCT baseline must remain independently measurable.
4. Tree reuse after an actual selected move.
5. Transposition support only after parity tests prove equal canonical keys, legal macro sets, and
   values. Keep it ablatable and report whether it materially helps; correctness comes first.
6. Diagnostics sufficient to inspect visits, prior, mean/fixed-frame value, value spread or
   uncertainty, principal variation, expansions/second, reuse, and transposition/cache hits.
7. A strength harness with paired faction assignments, common deterministic seeds, fixed simulation
   budgets, margins/wins/nodes/latency, and curated committed positions across setup and rounds 1–6.

The exit gate is a statistically credible paired-margin improvement over greedy and heuristic, both
factions completing without command gaps, measured fixed-budget cost, and evidence about whether
tree reuse/transpositions help. Do not promote on a single game or favorable seed.

## AI-7 non-goals

- No alpha-beta or exact late-game solver.
- No federation solver, Round-6 solver, opening book, neural features/models/training, Web Worker,
  viewer integration, backend/Supabase work, ranked authority, or production flag.
- No separate learned human/opponent model.
- No shared engine legality, serialization, hydration, replay, or availability changes.

## Verification cadence

During development:

- Run only new search/reference-tree tests and directly affected evaluator/bot tests.
- Use tiny fixed simulation budgets in unit tests; keep strength campaigns out of the ordinary inner
  loop.
- Run `npx tsc --noEmit` and focused ESLint after source changes settle.

Required AI-7 focused coverage:

- tiny reference trees for max/min backup, repeated actor, actor switch/leech, and exact terminals;
- deterministic macro-key tie-breaking and seeded Gumbel/sequential-halving allocation;
- every expanded/selected edge belongs to the committed macro set and applies host-style;
- visit/value accounting and fixed simulation-budget conservation;
- tree-reuse equivalence against a fresh tree;
- transposition on/off value/legal parity if transpositions are implemented;
- diagnostics determinism and ablation isolation;
- both factions reach EndGame without manual commands at a smoke budget.

After source freeze, run exactly once:

1. the AI-7 focused suite and one deliberate paired strength campaign;
2. the complete engine command:
   `npx mocha -r ts-node/register --reporter min 'src/**/*.spec.ts' 'src/*.spec.ts' '*.spec.ts'`;
3. `npx tsc --noEmit`, ESLint for changed TypeScript, `git diff --check`, whitespace/newline checks,
   and changed-path/production-import isolation audits.

The full engine command already includes all offline AI tests and locked digest assertions. Do not
also rerun the complete AI suite, each historical phase suite, or equivalent ad hoc hash scripts on
the same source unless isolating a failure. Documentation-only changes after the source-freeze run
need only Markdown/diff/whitespace checks.

## Handoff discipline

At completion, update this file with AI-7 status, measurements, final counts, risks, and the next
phase pointer. Update the AI README only for new stable APIs; append to the plan decision log only
for actual decisions/results; keep the PROGRESS current-task entry to a short link here. Do not
create another long phase handoff unless the owner explicitly requests an archival evidence file.

The final response should contain only: changed files, search design, paired measurements, final
verification summary, production-isolation result, remaining risks, exact git status, and the next
phase stop. Link here for inherited hashes/details instead of repeating this document verbatim.
