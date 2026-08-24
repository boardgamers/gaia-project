# Lost Fleet AI — Current Session Contract

> Canonical compact entry point for the next AI session. Last updated **2026-07-15** after the AI-7
> absolute-score/productivity investigation. Full-game attribution proved that the bots pass with
> unused economies and score far below competent play. One Pass-opportunity candidate improved
> ordinary-turn activity but remained absolutely weak; AI-7 stays open and AI-8 remains unstarted.
> Read this file completely and use the routed references below rather than reconstructing current
> state from historical documents.

## Document ownership

- **This file:** current branch, completed gate, next scope, preserved invariants, and verification
  cadence. Update it at each AI phase handoff.
- `engine/src/ai/STRATEGY_DOCTRINE.md`: canonical general strategy principles, evidence confidence,
  plan archetypes, and their translation into inspectable AI terms. Read it completely before any
  strategy/evaluator/planning change; do not copy seed-specific labels into it.
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
3. When the task changes strategy, evaluation, or planning, read
   `engine/src/ai/STRATEGY_DOCTRINE.md` completely. Otherwise do not preload it.
4. Read plan §1.1–§1.4, §6.3–§6.4, and §§14–15. Do not read the full plan.
5. Inspect these API surfaces first; read their full implementations only when the search design
   needs them:
   - `canonical-state.ts`: `CanonicalState`, `projectCanonicalState`, `canonicalStateHash`;
   - `actions/turn-builder.ts`: `CommittedTurnMacro`, `CommittedTurnMacroSet`, options, and
     `buildCommittedTurnMacros`;
   - `evaluation.ts`: report types, `terminalUtility`, and `evaluateHeuristic`;
   - `bots/types.ts`, `bots/common.ts`, and `bots/heuristic.ts`;
   - `testing/self-play.ts` and focused bot/evaluator specs.
6. Use `rg` and follow direct imports when a contract is unclear. Do not preload the generated
   manifest, corpus implementation/fixtures, resource planner internals, all canonical/macro specs,
   historical handoffs, rules/component ledgers, or the whole AI tree.

## Repository and production state

- Working branch: `claude/gaia-phase-1-4-yjb6qo`.
- Published AI-7 handoff checkpoint: `5d3d8e758ca9f42480beb4e42939cb8c92fa9c27` (`Add AI-7
strategic planning and diagnostics`). It is pushed to the identically named `origin` branch; the
  worktree was clean when this metadata follow-up began.
- Local/remote tip at AI-7 start: `16e0f0ae6cc0e4e1ba02d3083e461a0da6972008` (`Add AI-6 baselines
and lean handoff`). The older expected `7c92029e...` base in the owner prompt was one commit behind;
  no history was discarded. `origin/master` was separately at `23caf5cca85c03b5d4016bfb817be05ee55e783f`.
- Start from the published branch checkpoint, then treat `git status` as authoritative and preserve
  any later local changes exactly.
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
- AI-7: deterministic fixed-frame minimax PUCT over committed macros; inspectable state-only
  heuristic-softmax prior; seeded Gumbel/sequential-halving root allocation; selected-subtree reuse;
  guarded/ablatable transpositions; visit/value/spread/PV/performance/cache diagnostics; generic
  reference trees; paired strength and curated setup/Round-1 through Round-6 harnesses.
- AI-7 calibration: an optional probability-level `greedyMix` blends greedy and heuristic softmax
  priors while preserving the frozen heuristic-only behavior exactly at its default of zero.
- AI-7 productivity diagnostics: exact full-game VP attribution, per-round raw scores/action/pass
  counts, and end-state development are now part of baseline and search strength results.

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

## AI-7 implemented scope — search baseline and strength harness

All seven planned implementation items are present offline:

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

The implementation/search-correctness gate is complete. The original search arms did not beat both
greedy and heuristic, but the later scale-16/greedy-75 arm is now the current search-only leader on
paired margin. Both factions completed without command gaps, and fixed-budget cost/reuse/
transposition evidence was recorded. The formal statistically clear Phase 2 gate remains open.

## Frozen AI-7 measurement

The one deliberate campaign used eight simulations per candidate decision, conversion integration
and after-conversion integration both explicitly off, paired faction assignments, and common
evaluation seeds.

- Plain PUCT, one deterministic pair per opponent: vs greedy margins `[-12, -18]`, total `-30`, mean
  `-15`, 0-2; vs heuristic `[+10, +16]`, total `+26`, mean `+13`, 2-0.
- Gumbel/sequential halving, four seeds/eight games per opponent: vs greedy
  `[-16, -39, -6, -17, -14, -14, +14, -36]`, total `-128`, mean `-16`, 1-7; vs heuristic
  `[-10, -1, +11, +30, -1, -9, -6, -8]`, total `+6`, mean `+0.75`, 2-6.
- Plain PUCT expanded 552 nodes / 18,176 edges over 71 candidate selections; mean measured search
  latency was 2,781 ms vs greedy and 1,802 ms vs heuristic. Reuse occurred on 63/71 selections.
- Four-seed Gumbel expanded 3,190 nodes / 92,106 edges over 435 selections; aggregate measured search
  time was 1,143,801 ms (2,629 ms/selection). Reuse occurred on 418/435 selections.
- The common-seed guarded-DAG ablation produced the same game margins and curated choices as the tree
  arm. It recorded 90 transposition hits and 90 successful parity checks, but no demonstrated latency
  benefit; transpositions therefore remain off by default.
- Seven deterministic committed probes covered setup and the first RoundMove position in rounds 1-6.
  Every probe conserved its eight-simulation budget and selected/applied a legal committed macro.

## AI-7 focused search calibration

The focused follow-up kept plain PUCT, Gumbel off, transpositions off, both conversion axes off, and
the existing exact macro builder. It compared the frozen heuristic-only prior with a 50/50
probability-level greedy/heuristic softmax blend at fixed budgets 1, 2, 4, 8, and 16 on the same seven
setup/Round-1–6 positions. This was a curated probe grid, not a strength campaign.

| Simulations | Heuristic prior: greedy / heuristic matches | 50/50 prior: greedy / heuristic matches | Seven-probe latency, heuristic / blend |
| ----------- | ------------------------------------------- | --------------------------------------- | -------------------------------------- |
| 1           | 1 / 7, 7 / 7                                | 1 / 7, 7 / 7                            | 4,267 / 4,297 ms                       |
| 2           | 1 / 7, 7 / 7                                | 1 / 7, 7 / 7                            | 6,628 / 6,667 ms                       |
| 4           | 1 / 7, 7 / 7                                | 1 / 7, 7 / 7                            | 10,116 / 10,076 ms                     |
| 8           | 2 / 7, 5 / 7                                | 2 / 7, 5 / 7                            | 14,823 / 14,964 ms                     |
| 16          | 1 / 7, 5 / 7                                | 1 / 7, 5 / 7                            | 33,793 / 34,020 ms                     |

The blend changed **0 of 35** paired curated choices. PUCT initializes an unvisited edge with its
full raw heuristic leaf value, while the exploration term is only about `1.25 × prior`; at these
budgets the heuristic Q scale therefore overwhelms a prior-only mixture. Budget scaling was also
non-monotonic against greedy: two matches at 8 simulations fell back to one at 16.

Two truncated eight-simulation traces (maximum 32 committed lines, never EndGame) identified the
first greedy-evaluator gaps of at least 1 point:

- Xenos line 7: PUCT chose `build m 5B2` over greedy's `build ts 6A4`, leaving 4.25 immediate
  greedy-value points. The heuristic primarily favored final-scoring projection (+5.4), projected
  ore income (+4), Gaia pipeline (+1.5), and sector progress (+1.25), despite current-score (-3),
  projected-credit (-3.3), and stock (-1.38) penalties. Fresh heuristic-prior and blended searches
  made the same mine choice.
- Hadsch Hallas line 9: PUCT chose `build m 5A9` over `build ts 4B5`, a 3.15 greedy-value gap. The
  leading tradeoff was projected ore income (+4), final scoring (+2.7), Round-tile timing (+2.069),
  and sector progress (+1.25) versus current score (-3) and projected credits (-3.3). Fresh and
  blended searches again chose the mine.
- Hadsch Hallas line 18: the stateful tree chose `up sci` over greedy's `pass booster8`, a 6.85
  greedy-value gap. A fresh heuristic-prior search and the fresh blend both chose `pass booster9`;
  the research choice was specific to a descendant reuse root with 5 retained visits, not repaired
  by changing the prior.

No diagnostic trace completed a game, so this pass has no final-score result and no raw final scores
to report. The strength result schema and campaign summary retain both raw seat scores for every
completed game; all future completed-game results must continue to print them.

The 50/50 blend is an ablation, not a promoted default or a campaign candidate. The next pass must
address heuristic/Q scaling and evaluator calibration, and separately decide how retained visits
should affect a new root, before autonomously freezing and measuring a new paired candidate.

## AI-7 scale/evaluator calibration and predeclared candidate

The follow-up added three independently ablatable controls without changing their frozen defaults:

- `puctValueScale` divides fixed-frame Q before PUCT adds its dimensionless exploration bonus;
- `leafGreedyMix` blends immediate greedy value into non-terminal heuristic leaf Q while leaving
  exact terminal margin untouched; and
- `rootReuseVisitPolicy="reset-subtree"` can retain expanded structure while clearing all reachable
  visit/value moments. Diagnostics report visits available before promotion separately from visits
  actually retained.

Focused probes narrowed the candidate to value scale 16 with a 75% greedy / 25% heuristic blend in
both leaf Q and the prior. The reproducible seven-position grid compared it with the frozen arm:

| Simulations | Frozen: greedy / heuristic matches | Candidate: greedy / heuristic matches |
| ----------- | ---------------------------------- | ------------------------------------- |
| 1           | 1 / 7, 7 / 7                       | 3 / 7, 4 / 7                          |
| 2           | 1 / 7, 7 / 7                       | 3 / 7, 4 / 7                          |
| 4           | 1 / 7, 7 / 7                       | 3 / 7, 4 / 7                          |
| 8           | 2 / 7, 5 / 7                       | 5 / 7, 3 / 7                          |
| 16          | 1 / 7, 5 / 7                       | 5 / 7, 3 / 7                          |

On the fixed candidate's two stateful 32-line traces, retained moments produced one stateful/fresh
choice difference across both seats. The reset arm produced four differences (one trace ended at
line 22), retained zero old visits, and did not expose any material immediate-greedy gap of at least
one point. Retain is therefore the falsifiable candidate policy; reset remains an ablation, not the
campaign arm.

Before any paired result was observed, `testing/strength-campaign.ts` predeclared exactly one new
campaign arm behind `--scaled-greedy-75-candidate`: plain PUCT, eight simulations per candidate
selection, value scale 16, `leafGreedyMix=0.75`, prior `greedyMix=0.75`, retained visits, Gumbel and
transpositions off, both conversion axes off, common seed `ai-7-common-01`, both faction assignments,
and both greedy and heuristic opponents.

That arm was frozen, verified, and run exactly once. Against greedy its candidate margins were
`[-7, +28]`: raw scores `65-72` as Xenos and `56-84` as Hadsch Hallas, total `+21`, mean `+10.5`,
record 1-1. Against heuristic its margins were `[+30, +18]`: raw scores `73-43` as Xenos and `49-67`
as Hadsch Hallas, total `+48`, mean `+24`, record 2-0. Relative to frozen plain PUCT, mean margin
improved by 25.5 points against greedy (`-15` to `+10.5`) and 11 points against heuristic (`+13` to
`+24`). The candidate therefore leads both baselines on paired margin, but one deterministic pair is
not a statistically clear claim and it lost the Xenos/greedy game by 7. Do not rerun, retune, or
reinterpret this measured arm.

Campaign cost: 36 candidate selections / 288 simulations / 9,630 expanded edges / 73,518 ms against
greedy (2,042 ms/selection), and 38 / 304 / 10,998 / 80,828 ms against heuristic (2,127 ms/selection).
Reuse retained all 63 and 75 available promoted-root visits respectively; transpositions remained
off. All four games reached EndGame without command gaps.

## AI-7 absolute-score diagnosis and ordinary-turn productivity

The earlier relative result was not competent play. A decent normal setup is roughly 150–160 VP and
200 is exceptional; the measured search/baseline range of 43–84 is therefore inadequate regardless
of paired margin.

`testing/full-game-report.ts` now attributes every completed game without changing the engine. It
records raw score after every round; per-round Round-tile, Federation, research-track, and other
immediate VP; both named final-scoring tiles/counts/VP; endgame resource and bid VP; ordinary actions,
action families, and Pass turn per round; and final buildings/research/tokens/resources. The reporter
reconciles both every round boundary and the final score exactly against the engine's advanced log.
It is attached to baseline and search game results and printed by the strength campaign.

Fresh heuristic-versus-greedy reporting exposed the common failure:

- the four players took only 1, 3, 4, and 9 ordinary actions over all six rounds, including many
  rounds with zero actions and an immediate Pass on turn 1;
- raw Round-6 scores before final scoring were only 13, 36, 32, and 20;
- every player scored zero Federation VP and zero research-track/endgame VP;
- endgame resource conversion was 18, 13, 13, and 19 VP, with several wallets at or near the 30-credit,
  15-ore, and 15-knowledge caps.

The first bounded hypothesis added an opt-in income-normalized greedy value while preserving the
frozen immediate default. It did not repair productivity: across paired games against greedy and
heuristic its scores remained 45–72, paired margins were `[-1,-25]` and `[-9,-5]`, and most rounds
still passed immediately. It remains an inspectable ablation, not a candidate.

The next diagnosis measured Pass versus the best ordinary macro at the seven curated boundaries.
At the problematic positions Pass led by only 0.25–3.4 actor-oriented value points. A new opt-in
`nonTerminalPassValuePenalty=4` therefore charges the action opportunity cost only to non-terminal
Pass leaf/prior values; zero preserves every frozen arm, and exact terminal utility is never changed.
At budgets 1/2/4/8/16 the new arm selected zero Passes in all 35 curated searches. At the campaign
budget it completed all 56 probe simulations and selected ordinary actions at every probe.

Before full-game results were observed, `testing/strength-campaign.ts` predeclared the isolated
`--pass-opportunity-4-candidate` arm: plain PUCT, eight simulations, scale 16, 75% immediate-greedy
leaf/prior mix, retained visits, Pass opportunity cost 4, Gumbel/transpositions/conversion axes off,
and fresh seed `ai-7-productivity-01`. The historical scale-16/greedy-75 arm was not invoked.

The one-shot campaign completed all four games. Against greedy it scored `76-57` as Xenos and
`72-70` as Hadsch Hallas: margins `[+19,+2]`, mean `+10.5`, record 2-0. It used 39 candidate
selections / 312 simulations / 10,133 expanded edges / 79,912 ms (2,049 ms/selection), with all 61
available promoted-root visits reused. The retained output also records 77 VP and nine ordinary
actions for the candidate as Hadsch Hallas against heuristic, but the compact terminal capture
truncated the other heuristic game before it could be transcribed into this handoff; do not rerun
the arm merely to recover presentation output.

This is a real local productivity improvement, not the AI-7 exit. The retained candidate scores of
72, 76, and 77 remain far below 150–160; even those reported games still contained zero-action middle
rounds, zero Federation VP, zero research-track/endgame VP, and only 7–9 ordinary actions. Relative
wins between weak policies remain insufficient evidence of good play.

## AI-7 owner-labelled opening placement prior

The owner supplied an expert setup rule for the fixed challenge: prefer proximity at distances one,
two, then three to spaceships, the opponent's home colour, Gaia planets, Asteroids, one-step terrain
colours, and a dense set of nearby planets. Spaceship access must reflect the actual board plus its
seeded tech/Federation rewards; the ships are not interchangeable.

Before this label, all four legal Xenos first Mines evaluated to exactly `5.81`; `1A3` was selected
only by stable-key tie-break. `setup-placement.ts` now exposes the six component scores separately,
and the ablatable `setup-placement-opportunity` evaluator term is active only during setup. The
owner-labelled order is locked as `3A0 > 6A4 > 1A3 > 2A11`. Their placement contributions are
`20.20`, `17.85`, `17.35`, and `12.40`; full heuristic values are `26.01`, `23.66`, `23.16`, and
`18.21`. The leading `3A0` separates primarily through adjacent access to Eclipse and access within
three to three Gaia planets plus two Asteroids.

This is a corrected expert decision, not evidence of competent full-game play. The deterministic
heuristic-versus-greedy regression changed from `49-67` / `66-48` to `52-77` / `72-38`: three of
four raw seat scores rose, but the heuristic margins worsened from `[-18,-18]` to `[-25,-34]`.
No strength campaign was run. The coordinate order remains only a regression fixture; policy must
generalize through the reported geometry components rather than memorize the challenge seed.

## AI-7 consolidated strategy doctrine

The owner's expert labels and the BoardGameGeek/official Lost Fleet review are consolidated in
`engine/src/ai/STRATEGY_DOCTRINE.md`. It is now the durable input for strategic AI work and contains:

- general setup geometry, engine-building, tempo, passing, scoring, research, ship, and advanced-tech
  principles;
- plan archetypes rather than scripted openings;
- Xenos and Hadsch Hallas modifiers without forcing faction-specific routes;
- evidence/confidence and anti-overfitting rules; and
- the AI-7 translation into plan prerequisites, resource reservations, feasibility, progress, abort
  conditions, fallbacks, and inspectable action-value components.

Forum tier disagreements are preserved as evidence that value is contextual. No forum sequence,
coordinate, ship rank, or advanced-tech tier is an unconditional evaluator bonus.

`engine/src/ai/strategy/knowledge.ts` makes the research auditable: 20 sources currently map to 37
deduplicated principles, each with confidence, scope, contrary evidence where relevant, and an
explicit active feature/plan, qualitative fixture, context modifier, documented hypothesis, or
rejected-universal disposition. Its tests reject missing sources/applications and prevent contested
claims from silently becoming unconditional policy.

The first two active plan applications are implemented in `strategy/opening-plans.ts`,
`strategy/research-plan.ts`, and `bots/strategy-plan.ts`. The opening layer compares Academy, PI,
and Mine-spread plans during rounds 1–2. The continuation layer selects and retains a research /
Advanced Tech target during rounds 3–6 from the actual seeded tile, current track levels, green-
Federation readiness, remaining uses, and small faction-context modifiers. It reserves four
knowledge, rewards focused track/tech/Federation-readiness progress, and rejects fixed track orders
or permanent Advanced Tech tier lists. Both layers use inspectable completion, abort, material-
switch, reserve, and productive-Pass reports. The frozen heuristic baseline remains unchanged.

One non-promotional diagnostic game—not a paired campaign—put the plan bot's Xenos against greedy
Hadsch Hallas. It scored `74-61` in 45 committed lines and 54.1 seconds. Xenos took 14 ordinary
actions by round `[7,1,0,0,0,6]`, built Academy 2 plus eight Mines, explored two ships, formed one
Federation for 12 VP, and ended with 74 VP. It still scored zero research-track/endgame VP and took
zero actions in rounds 3–5. This validates the opening-plan mechanism but not strong play or the
AI-7 promotion gate.

The bounded research continuation was then measured once in the same diagnostic matchup after its
source and qualitative contracts were fixed. Xenos won `107-60` in 53 committed lines and 20.6
seconds. Its ordinary actions rose from 14 to 21, with per-round activity `[7,1,5,4,4,0]` instead of
`[7,1,0,0,0,6]`; raw scores after rounds 1–6 were `[4,11,23,42,56,72]`. It formed a Federation,
reached AI 5 / Terraforming 3 / Science 2, took three tech tiles, earned 16 research/endgame VP, and
finished at 107 rather than 74. This is material evidence that persistent midgame goals repair the
diagnosed empty rounds, but 107 remains far below the owner's 150–160 competent benchmark and is
not an AI-7 exit or a campaign result.

The next interaction audit rejected several tempting generalizations instead of promoting them.
Final-scoring track bonuses plus path-progress terms scored 103; a blunt Advanced Tech reachability
discount scored 88; productive-action Pass guards at 8 and 4 scored 105 and 99; and gating a multi-
turn Advanced Tech goal on a Federation formable that exact turn scored 94. The Pass guard and
same-turn Federation gate remain explicit opt-in diagnostics only; their defaults are zero/off. The
scoring and reachability experiments were removed. None replaced the 107-point policy.

The retained evidence-backed change simply carries the successful research plan through round 6.
In the same diagnostic it scored `110-60`, took 22 actions by round `[7,1,5,4,4,1]`, raised raw
Round-6 score from 72 to 76, spent four of seven stranded knowledge on Terraforming 4, and raised
research/endgame VP from 16 to 20. This is the current AI-7 plan default. It is a genuine local gain,
not an exact Round-6 solver, paired campaign, or competent-play claim; 110 remains well below 150–160.

## AI-7 offline economy-plan layer and the engine-building bottleneck (2026-07-15)

The recommended compatible-income / action-budget economic plan is implemented as
`strategy/economy-plan.ts` and wired into `StrategyPlanMacroBot` behind `economyPlanning` (default
`false`, bot schema v3→v4, nullable `economy` report field). It is committed at
`3501c22` on `claude/gaia-phase-1-4-yjb6qo`. The layer scores each macro against the plan's
`roundActionBudget` (the next up-to-three action cost bundles, not one prerequisite) with inspectable
terms: bundle-combination coverage, plan income coverage, cap-waste, stranded-surplus, wasteful-spend,
and a resource-preserving Pass. Default-off reproduces the frozen `110-60` diagnostic exactly.

The retained enabled arm is the multi-action budget: one non-promotional diagnostic (plan bot Xenos
vs greedy Hadsch) scored `110-50` with **Federation VP 0→8** and **stranded ore 15→9** at equal
absolute score — a healthier composition, not a promotion.

Four separate attempts to raise the **absolute** score from the evaluation layer each failed or
regressed, and they triangulate on one cause:

- income-normalized greedy value: `45–72`, no productivity repair (prior AI-7 note);
- plan-relative income coverage: inert — the mine-spread budget is ore-only and ore income is already
  adequate, so there is nothing to fix;
- a plan-independent operating-income floor (credits/knowledge) at weight 10: **regressed to `95`**,
  still built zero Trading Stations, and hoarded 23 credits;
- a late-game anti-hoard correction (claw back the frozen `resource-stock` over-valuation of held
  convertible resources toward their true 3:1 endgame worth): **regressed to `103`**.

Root cause (now well-evidenced, not a guess): the ceiling is **upstream in opening-plan selection**,
not in economy evaluation. For Xenos, `opening-plans.ts` ranks **mine-spread** top (+0.35 modifier), so
the bot builds ~8 mines and **one** non-mine building, ends with **0 Trading Stations / Labs / PI** and
**0 credit income**, and is therefore credit-locked into single-action rounds (observed 1-action rounds
2 and 5). Because the engine is that thin, the bot genuinely has **no higher-scoring late action** than
holding resources for 3:1 conversion — which is exactly why the anti-hoard correction _loses_ points:
it forces marginal spends worth less than the conversion it replaces. A transition evaluator can only
reweight macros the bot already generates and takes; it cannot manufacture the TS/Lab the bot never
adopts. The frozen `resource-stock` weights (ore 0.8, knowledge 1.0) plus `endgame-leftover-conversion`
(0.85) do over-price late held resources, but correcting that is only useful once better scoring
actions exist to spend on.

Three further attempts confirmed the diagnosis and sharpened it from "engine selection" to
"multi-turn planning":

- a cost-gated cheap-Trading-Station opening reward (only the ~3-credit adjacent variant, never the
  6-credit isolated one; ablatable): **inert** — the move trace shows the bot already builds one
  Trading Station on 1B2, then upgrades that same piece TS→Lab→Academy (MV 17/27/32), so it ends
  with **0 Trading Stations and 0 credit income**. It is not failing to build a TS; it consumes its
  only one for the research line;
- a "retain credit engine" guard penalising a transition that collapses existing credit income to
  ~zero (ablatable): **regressed to `102`** and _still_ ended with 0 Trading Stations. Any Lab/Academy
  is built by upgrading a Trading Station, so keeping a credit engine while climbing research needs a
  **second** income building the bot never builds (and which may need a second cheap opponent-adjacent
  spot on this board);
- every combination with the economy layer regressed further (`92–100`).

Sharpened conclusion (owner-confirmed): the frozen `110` line — rush research to the Academy for
Intelligence-5 (~20 research/endgame VP) and take one-off credit from the Eclipse ship action — is a
**robust local optimum on this seed**, and it is defended by a real structural limit, not a missing
weight. `StrategyPlanMacroBot` is **1-ply**: it scores one macro at a time and cannot represent
"upgrade away credit income this round, then restore sensible income next round" — form a
credit-paying Federation, or claim the credit power action first thing next round given bowl-3 power.
That is a sequencing/lookahead requirement. Myopic evaluator terms can only fake it with an
instantaneous penalty/reward, which is why all seven attempts either did nothing or forced a worse
immediate trade. The AI-7 PUCT search is the right mechanism for such lookahead but scores worse
(`43–84`) at feasible budgets. Single-seed relative results are also not valid promotion evidence.

Recommended next AI-7 direction: stop tuning the myopic bot for absolute score on this seed — that
avenue is exhausted. The real feature is an explicit **multi-turn income/restoration plan**: allow an
upgrade that breaks the economy for an action or two only when a concrete restoration path is reserved
(a formable credit-Federation, or sufficient bowl-3 power for the credit power action next round), and
validate it with paired campaigns across multiple seeds, not one diagnostic game. Do **not** add more
economy-evaluation weight terms for absolute score. The committed default-off economy layer (Federation
channel 0→8, ore stranding 15→9 at equal score) stands as the retained deliverable.

## Claude handoff: strategic implementation map

This section is the compact handoff view. `STRATEGY_DOCTRINE.md` remains the canonical strategy
input and `strategy/knowledge.ts` remains the checked 20-source / 37-principle disposition registry.
The labels below distinguish an implemented evaluator signal from an implemented persistent plan;
having a feature does not mean the bot can yet pursue it coherently across turns.

| Strategic area          | Implemented now                                                                                                                                                                                                              | Still missing / limitation                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absolute play diagnosis | Exact per-round actions, Pass timing, raw score, VP-channel attribution, final scoring, development, and leftover resources                                                                                                  | More faction/seed evidence; 110 is still far below 150–160                                                                                                                |
| Starting placement      | Setup-only distances to actual seeded ships/rewards, opponent colour, Gaia, Asteroids, cheap terrain, and planet density; owner fixture `3A0 > 6A4 > 1A3 > 2A11`                                                             | Broader owner-labelled boards/factions; never promote the fixture coordinates into policy                                                                                 |
| Opening engine          | Persistent Academy, PI, and Mine-spread archetypes; next-building costs, reserves, progress, affordability, completion, abort, and material switching                                                                        | Research-Lab-flexibility, early-Federation, Gaia/Asteroid, and ship-engine archetypes are not primary opening candidates                                                  |
| Research / technology   | Persistent rounds 3–6 research target; actual seeded Advanced Tech event, remaining uses, current level, four-knowledge reserve, Standard/Advanced Tech progress, green-Federation readiness, and small Xenos/Hadsch context | Real multi-turn acquisition feasibility, cover choice, opponent contest, and track/action opportunity cost remain approximate                                             |
| Passing / tempo         | Opening/research Pass penalty activates only when a measurable plan transition exists                                                                                                                                        | General “productive action” guards at 4/8 scored 99/105 and are opt-in/off; purposeful stalling and booster-order timing are not planned                                  |
| Economy                 | Resource stock, projected income by resource, uncovered building income, Trading Station adjacency, endgame conversion, and per-plan prerequisite reserves                                                                   | **Primary next gap:** no compatible-income/action-budget plan; the retained game ends at 15 ore / 4 credits, so resource complementarity and cap waste are not controlled |
| Federation              | Current token/green-token value, structure-value progress, legal engine-enumerated Federation macros, Federation-readiness reward inside research planning                                                                   | No persistent Federation payoff/geometry plan; exact/custom geometry remains AI-8/out of scope; same-turn feasibility gate scored 94 and is off                           |
| Gaia / Asteroids        | Setup access, Gaia pipeline, Asteroid/Gaia counts, legal actions, evaluator scoring, and final-score projection                                                                                                              | No persistent Gaia/Asteroid expansion plan with former/QIC/power/build reserves, expected uses, timing, abort, and fallback                                               |
| Lost Fleet ships        | Actual seeded action board, tech/Federation reward, setup access, explored-ship value, action availability, and legal repeated use; the 110 game explores and uses two ships                                                 | No retained ship-engine/synergy plan, contest forecast, or explicit “two deep versus three shallow” expected-use model                                                    |
| Round/final scoring     | Current/future round-tile potential, exact current final-scoring projection, and full-game VP attribution                                                                                                                    | No persistent engine-to-scoring conversion plan; attempted track/final-scoring coupling scored 103 and was removed                                                        |
| Power / leech           | Power-bowl capacity, shared actions, exact marginal charge/VP report, and resource valuation                                                                                                                                 | No multi-round bowl-3 budget or contest schedule; do not force depletion before Pass                                                                                      |
| Faction identity        | General plans plus small Xenos and Hadsch Hallas modifiers; no coordinate scripts                                                                                                                                            | Only Xenos has the retained full-game strategy diagnostic; Hadsch remains a very weak opponent and faction-specific feasibility needs broader validation                  |
| Search                  | Deterministic committed-macro PUCT/Gumbel, reuse, diagnostics, strength harnesses, and frozen measured arms                                                                                                                  | Strategy-plan bot is not a promoted search champion; scale-16/greedy-75 and Pass-opportunity-4 must not be rerun or retuned                                               |
| Exact endgame           | Round-6 research plan now avoids one observed immediate Pass                                                                                                                                                                 | Exact Round-6 solving is AI-8 and must not start yet                                                                                                                      |

### Retained defaults and rejected ablations

- `StrategyPlanMacroBot` with default options is the current 110-point policy.
- `productivePassPenalty` defaults to `0`; values 4 and 8 are retained only for inspection.
- `federationFeasibilityGate` defaults to `false`; the current-turn gate is not a multi-turn
  feasibility model.
- Final-scoring track bonuses and the blunt Advanced Tech reachability discount were removed.
- The frozen heuristic, greedy baseline, shared engine, production imports, and hosted code remain
  unchanged by the plan layer.

### Recommended next bounded AI-7 task

Implement one inspectable **compatible-income/action-budget economic plan**. It should forecast the
cost bundles of the plan's next meaningful actions, value credit/ore/knowledge/QIC combinations
rather than raw stock independently, detect cap waste and stranded surplus, protect prerequisites,
and allow Pass when only wasteful conversions or negative-value spending remain. Lock qualitative
fixtures before one non-promotional diagnostic. Do not begin with another weight sweep, forced-Pass
rule, coordinate label, paired campaign, or AI-8 Federation/endgame solver.

Claude should start with `AGENTS.md`, this file, `STRATEGY_DOCTRINE.md`,
`strategy/knowledge.ts`, `strategy/opening-plans.ts`, `strategy/research-plan.ts`,
`bots/strategy-plan.ts`, and their focused specs. Continue from the published AI-7 checkpoint on
`claude/gaia-phase-1-4-yjb6qo`; preserve any later dirty worktree and do not switch, pull, commit,
push, deploy, or touch `master` unless the owner supplies new authority.

## AI-7 non-goals

- No alpha-beta or exact late-game solver.
- No federation solver, Round-6 solver, opening book, neural features/models/training, Web Worker,
  viewer integration, backend/Supabase work, ranked authority, or production flag.
- No separate learned human/opponent model.
- No shared engine legality, serialization, hydration, replay, or availability changes.

## AI-7 verification record

- Frozen focused suite: 12/12 passing (reference core plus committed-engine integration/smoke).
- Development-only directly affected evaluator/bot suite: 12/12 passing.
- Complete three-glob engine suite: 710 passing / 4 pending in 14 minutes. The first exact command
  was externally terminated after 182 seconds with Windows status `0x40010004` and no Mocha failure;
  the unchanged recovery run completed successfully.
- Final `npx tsc --noEmit` and focused changed-file ESLint passed. Diff/whitespace/newline and
  changed-path/production-import isolation audits were clean.
- No complete historical AI suite, duplicate campaign, or ad hoc digest script was run after source
  freeze. Documentation-only handoff edits followed the completed source gates.
- Focused calibration verification: 13/13 search tests; complete engine 711 passing / 4 pending in
  13 minutes; final TypeScript and changed-AI-file ESLint clean. No strength campaign was run.
- Scale/evaluator source freeze: 16/16 focused search/integration tests; complete engine 714 passing /
  4 pending in 13 minutes; TypeScript and changed-AI-file ESLint clean; diff/whitespace, changed-path,
  and production-import isolation clean. The predeclared campaign then completed without source
  changes; only documentation was updated afterward.
- Productivity source freeze: 16/16 focused bot/search tests; complete engine 717 passing / 4 pending
  in 13 minutes; TypeScript, focused changed-file ESLint, and diff/whitespace checks clean. The
  predeclared Pass-opportunity campaign then ran exactly once without source changes; only
  documentation was updated afterward.
- Strategy corpus/opening-plan source check: 9/9 focused traceability and behavioral tests; 18/18
  with the directly affected evaluator suite; `npx tsc --noEmit`; focused ESLint clean. One
  single-game productivity diagnostic completed; no
  paired campaign or measured-arm rerun was performed.
- Research/tempo continuation source check: 11/11 focused research/tempo tests; `npx tsc --noEmit`;
  focused ESLint clean. Development diagnostics recorded and rejected every weaker default before
  retaining the 110-point round-6 continuation. No paired campaign and no measured
  scale-16/greedy-75 or Pass-opportunity-4 rerun was performed.

## AI-7 autonomous execution authority

Offline AI-7 work no longer requires an owner checkpoint between calibration and strength
measurement. A fresh session is authorized to:

1. diagnose and change offline search, prior, evaluator, reuse, diagnostics, tests, and AI docs under
   `engine/src/ai/` while preserving shared-engine and production isolation;
2. use focused traces and curated positions to select one falsifiable candidate;
3. predeclare its fixed campaign configuration in the canonical handoff or checked-in campaign
   source before seeing the paired results;
4. freeze and verify source, then run that one comparable paired campaign autonomously against both
   greedy and heuristic with common seeds, fixed budgets, both faction assignments, and both raw
   final scores for every game; and
5. record an unsuccessful result honestly and begin another bounded AI-7 hypothesis without asking
   the owner, provided it changes source/config for an evidence-backed reason and does not rerun or
   cherry-pick seeds from the failed campaign.

This is continuing authorization, not a request for repeated confirmations. Stop only when work
would cross into AI-8, shared-engine/viewer/backend/production changes, commit/push/deploy, private or
external data, or another material scope expansion. Full-suite and campaign cadence still follows
the source-freeze/no-duplicate rules in `PROGRESS.md`.

## Next autonomous AI-7 step

- Do not start AI-8. The Pass-opportunity arm improved ordinary-turn activity and went 2-0 against
  greedy, but its retained 72–77 VP scores are still grossly inadequate absolute play and the formal
  statistically clear gate is not established.
- Do not campaign the measured 50/50 prior: it changed no curated choice.
- Do not rerun or retune the measured scale-16/greedy-75 arm, and do not rerun the
  Pass-opportunity-4 campaign merely to recover its truncated console presentation.
- The Academy/PI/Mine-spread opening and rounds 3–6 research/Advanced Tech continuation are locally
  validated. Do not promote from the `110-60` diagnostic alone.
- Do not enable the productive-Pass or same-turn Federation gates by default: their measured scores
  were 99/105 and 94. Do not restore the removed scoring/reachability experiments.
- The next bounded hypothesis should address the current 15-ore/4-credit imbalance through a real
  economic plan with compatible income and action budgets, not forced spending. Federation payoff
  and Gaia/Asteroid goals remain relevant, but existing ship use was already active and should not
  receive a flat bonus.
- After one such evidence-backed interaction improves a qualitative trace, consider one fresh,
  predeclared paired campaign. Do not rerun either previously measured campaign arm.
- Primary risks: the improved candidate still scored only 110 and took only one action in round 6;
  Hadsch Hallas remained a 60-point weak opponent; Federation VP attribution was zero despite taking
  a Federation reward; one deterministic diagnostic is not
  statistically clear; exact macro expansion costs roughly 2 seconds per measured selection; and
  the current DAG shares states correctly but did not show practical benefit.

## Handoff discipline

At completion, update this file with AI-7 status, measurements, final counts, risks, and the next
phase pointer. Update the AI README only for new stable APIs; append to the plan decision log only
for actual decisions/results; keep the PROGRESS current-task entry to a short link here. Do not
create another long phase handoff unless the owner explicitly requests an archival evidence file.

The final response should contain only: changed files, search design, paired measurements, final
verification summary, production-isolation result, remaining risks, exact git status, and the next
phase stop. Link here for inherited hashes/details instead of repeating this document verbatim.
