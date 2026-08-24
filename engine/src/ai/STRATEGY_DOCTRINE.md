# Lost Fleet AI strategy doctrine

> **Status:** canonical strategy input for offline AI work. This is not a rulebook, an opening book,
> or a list of fixed evaluator weights. Future sessions that change strategic evaluation or planning
> must read this file completely after `docs/lost-fleet/AI_CURRENT.md`.

## Purpose

The current bots make locally affordable moves but do not build a six-round engine. Their relative
wins are misleading because all measured policies score far below competent play. For the normal
setup, use the owner's calibration of roughly **150–160 as decent** and **200 as exceptionally
strong**. A 43–84 result is weak regardless of which weak baseline it beats.

This doctrine consolidates:

- the owner's expert strategy labels from the AI-7 session;
- recurring principles from BoardGameGeek strategy discussions;
- official Lost Fleet component/rule context; and
- the implementation lessons from the full-game productivity reports.

Its job is to make strategy actionable without teaching the AI one seed or one scripted sequence.

## Authority and confidence

Use evidence in this order:

1. Engine legality and official rules determine what an action actually does.
2. Repeated owner-confirmed general principles are strong strategy labels.
3. Advice repeated across independent expert discussions is a useful prior.
4. A single opening, tier list, tournament game, or seed-specific ranking is only a hypothesis.

Every strategic term must remain inspectable and ablatable. Disputed advice must not become an
unconditional bonus. Exact coordinates, move sequences, faction scripts, and permanent ship/tile
tiers are forbidden as general policy.

### Traceability registry

`strategy/knowledge.ts` is the machine-checkable companion to this doctrine. Its current
public-source/owner English-language sweep contains 20 sources and 37 deduplicated principles. Every principle records
its confidence, sources, scope, contrary evidence where relevant, and one or more allowed AI
applications: active feature, active plan, qualitative fixture, context modifier, documented
hypothesis, or rejected universal rule.

This is the enforceable meaning of “capture all internet tips”: conduct a broad reproducible sweep,
retain every distinct relevant claim found, and give every retained claim an explicit disposition.
It is not a claim that every webpage or private discussion on the internet can be enumerated. Audio
or inaccessible material is not treated as extracted strategy unless a reliable transcript or
written summary supports the claim.

## General strategy principles

### Plan an engine, not the next reward

- At the start of a round, compare a small set of coherent plans with a payoff horizon and fallback.
- Prefer actions that make an important later action feasible, not merely the largest immediate
  resource or VP reward.
- Reserve the credits, ore, knowledge, QIC, range, power, and building availability needed for the
  chosen plan. Penalize spending that destroys it.
- Re-plan when the required action becomes unavailable, the economy no longer supports it, or a
  clearly stronger opportunity appears. Do not oscillate after every small reward.
- Convert resources because a productive action needs the conversion. Never convert or burn power
  merely to look active or empty the wallet.

### Build productive capacity early

- Round 1 should normally produce an engine: an Academy, a Planetary Institute, a Research Lab plus
  flexible infrastructure, several efficient Mines, or a credible early Federation/advanced-tech
  line.
- A Round-1 Academy is a strong general plan because it supplies knowledge/tech tempo, but it is not
  mandatory. A PI or broad cheap-Mine opening can be better for the faction and board.
- Research steps and immediate-resource Standard Tech tiles can fund the opening rather than being
  valued only for their printed reward. Terraforming level 1 is often a useful cost reducer.
- Mines and Trading Stations, the Economy track, power cycling, and Labs/Academies with income tech
  are alternative economic engines. The AI should choose a compatible mix, not try to maximize all
  of them at once.
- Judge an opening by Round-2 readiness as well as Round-1 VP: income, bowl-3 power, knowledge/tech
  access, expansion reach, and a feasible next build all matter.

### Preserve tempo and useful resources

- Passing is acceptable when no meaningful, plan-compatible action remains—not simply because a
  shallow evaluator dislikes the legal actions.
- Do not require literal resource depletion. Preserve useful bowl-3 power and next-round reserves,
  and avoid conversions or power spending with no productive destination.
- Account for income overflow and charging geometry. Spending before income can be valuable when it
  prevents capped resources or overcharging, but wasteful spending is still waste.
- Contested boosters, power actions, ship actions, tech tiles, advanced tech, and Federation tokens
  have timing value. A slightly lower nominal action can be correct if delay is likely to lose it.

### Score throughout the game

- A sound engine must ultimately produce VP. Forecast round-tile triggers, both final-scoring
  categories, Federation VP, research-track/endgame VP, and other immediate VP separately.
- Early engine actions can outweigh immediate VP, but repeated zero contribution to whole scoring
  categories is a strategic failure, not merely a different style.
- Federation planning must include building value, geometry, satellite/power cost, token reward,
  advanced-tech timing, and the chance that a desired token is taken.
- Research value depends on the next threshold, income or immediate reward, advanced-tech access,
  endgame position, and the actions remaining to exploit it.

## Setup geometry

Starting Mines should maximize several overlapping opportunities. Use distance bands—adjacent,
distance 2, then distance 3—with closer access worth more:

- spaceships, evaluated from their actual action and seeded tech/Federation rewards;
- planets of an opponent's home colour, which improve affordable Trading Station/charge prospects;
- Gaia planets and Asteroids;
- planet colours one terraforming step from the faction's home colour; and
- total nearby buildable-planet density and connectivity.

Also consider whether the two starting Mines complement one another: distinct expansion corridors,
shared Federation geometry, opponent interaction, ship access, range constraints, and blocking risk.
Outer positions can be stronger in Lost Fleet because they improve ship and Asteroid access.

The locked Xenos ranking `3A0 > 6A4 > 1A3 > 2A11` is a regression fixture proving that these general
features can break an evaluator tie. It is **not** an opening rule, a coordinate lookup, or evidence
that the full policy is strong.

## Round-1 plan archetypes

The first planning layer should compare archetypes rather than exact move scripts:

1. **Academy engine:** reach a Research Lab and Academy while preserving enough expansion and
   income to function in Round 2. Value tech/research gains and immediate-resource tiles that make
   the line feasible.
2. **Planetary Institute engine:** accelerate a faction-defining PI power or Federation geometry
   when its repeated value repays the slower alternative development.
3. **Mine spread:** place several cheap, well-connected Mines when the map, faction discounts, round
   scoring, income, or future Federation makes breadth stronger than an early top building.
4. **Research-Lab flexibility:** gain tech access while delaying the Academy/PI choice, then use the
   remaining economy for productive builds.
5. **Early Federation/advanced tech:** assemble value and track position early enough that the
   reward has several rounds or triggers left. Do not pursue it if the required infrastructure
   leaves the economy inert.
6. **Gaia/Asteroid expansion:** use a Gaiaformer, instant Gaiaforming, or an Asteroid action when it
   opens efficient builds, scores repeatedly, or completes a broader engine.
7. **Ship-action engine:** reach and repeatedly exploit one or two synergistic ships when their
   actual actions and seeded rewards fit the faction's resource production and scoring plan.

The opening booster belongs inside plan feasibility. The owner identifies four-charge and
range-plus-three as strong general Round-1 candidates, especially when charge scores large
buildings or range unlocks the plan. They are contested but not universally best; compare the
specific board, round scoring, income, and denial value.

## Research, technology, ships, and advanced tech

- Value a research step as a path, not an isolated reward: include the desired threshold, advanced
  tech, endgame standing, remaining knowledge cost, and timing.
- Value tech tiles by the actions they enable and the number of useful remaining triggers. Immediate
  resources can be extremely strong when they complete an opening.
- Value advanced tech by earliest realistic acquisition, remaining scoring/income opportunities,
  affordable expected uses, faction/plan synergy, track opportunity cost, and contest risk.
- Do not assign permanent global tiers to ships. Use their current action, seeded tech/Federation
  reward, access cost, likely repeat uses, resource fit, scoring synergy, and opponent contest.
- Starting beside a ship can compound from Round 1 because ship actions behave like additional
  economic actions. Expert reports often prefer fully exploiting two synergistic ships to touching
  three shallowly, while recognizing that some boards justify three.
- Asteroids and instant Gaiaforming are broadly valuable because they add expansion options and can
  support scoring, but their value still depends on build cost, action access, and the active plan.

## Faction identity is a modifier, not a script

General plans remain the candidates; faction traits alter feasibility and payoff.

### Xenos

- Treat Xenos as flexible rather than forcing one opening.
- Their extra starting Mine, Federation advantage, and Lost Fleet outer access can support fast
  research, broad expansion, and earlier Federations.
- An Artificial Intelligence-track rush is attractive when the QIC action and available advanced
  tech justify it. The owner specifically identifies the early three-knowledge advanced tech as a
  strong target, potentially in Round 2, with a PI/Federation line and range tech supporting access.
- Navigation or Terraforming can be the second track when it unlocks valuable planets, Asteroids,
  ship actions, or a synergistic advanced tech. These are candidate-plan reasons, not fixed track
  orders.

### Hadsch Hallas

- Their credit production and PI conversion make credit-rich plans and flexible resource timing
  stronger than for a generic faction.
- The owner identifies an early Gaia-track route to the five-credit/one-QIC advanced tech as a
  strong Round-2 candidate, especially with nearby transdim/Gaia and Asteroid opportunities.
- Navigation and credit-funded ship/Asteroid actions can extend that engine. The AI must still
  verify access, contest, and repeated use rather than force the route.

The Eclipse Federation reward and its economic action were identified as especially desirable for
both example factions. Encode that through actual projected income, uses, timing, and contest—not a
hard-coded faction bonus.

## AI representation

Represent a strategic plan with inspectable fields such as:

```text
id; horizon; goals; prerequisites; reserved resources; expected engine gain;
expected scoring gain; contest/timing risk; abort conditions; fallback plans
```

Candidate action value should conceptually combine:

```text
immediate value
+ plan progress
+ change in plan feasibility
+ future income/action capacity
+ forecast scoring
+ contest/denial value
- resource and opportunity cost
- reserve violation
- stranded-engine and tempo risk
```

Do not choose weights from prose alone. Add each component to reports, lock qualitative fixtures,
then calibrate only after the policy demonstrates the intended behavior.

## AI-7 implementation order and validation gate

Stay in AI-7. The next evidence-backed improvement is a small ordinary-turn planning layer, not
another Pass penalty, search-scale sweep, or seed-specific setup term:

1. Add inspectable plan generation for **Academy engine**, **PI engine**, and **Mine spread**.
2. Track prerequisites, resource reservations, progress, feasibility, and explicit fallback/switch
   reasons across actions and rounds.
3. Feed plan progress and reserve violations into evaluation with independent ablations.
4. Add focused fixtures showing productive first-round construction, purposeful tech/research,
   preservation of resources for the next required action, and justified plan switching.
5. Extend to early Federation/advanced-tech and Gaia/Asteroid/ship plans only after the first three
   work as intended.
6. Use full-game reports to require materially more ordinary actions, functioning Round-2–5
   economies, and nonzero contributions from the relevant scoring channels before spending time on
   a paired strength campaign.

The first three-plan layer now exists in `strategy/opening-plans.ts` and
`bots/strategy-plan.ts`. It retains a selected Round-1/2 plan, reports priorities and switch reasons,
rewards progress/affordability, protects the next prerequisite reserve, and penalizes Pass only when
a productive plan transition exists. Its first single-game diagnostic is evidence of local behavior,
not promotion: Xenos scored 74 against greedy's 61, took 14 ordinary actions, built an Academy and
eight Mines, and earned 12 Federation VP, but still took zero actions in rounds 3–5 and earned zero
research-track/endgame VP.

That midgame extension now exists in `strategy/research-plan.ts`. During rounds 3–6 it retains a
setup-aware track/Advanced Tech goal, protects four knowledge, values the seeded tile from its actual
event and remaining contextual uses rather than a fixed tier, and rewards focused research, tech,
and green-Federation readiness. Its final single-game diagnostic moved Xenos from 74 to 107 VP, from
14 to 21 actions, from `[0,0,0]` to `[5,4,4]` actions in rounds 3–5, and from 0 to 16 research/endgame
VP. This clears the qualitative continuation check, not the strength gate: 107 is still below the
150–160 competent-play benchmark. Carrying the same plan through round 6 then converted four
stranded knowledge into Terraforming 4, 20 research/endgame VP, and a 110-point finish. Broader
scoring, reachability, forced-Pass, and same-turn Federation gates all measured worse (88–105) and
are removed or opt-in rather than doctrine. The next bounded work is a compatible-income/action-
budget economic plan, not more plan-weight tuning.

Absolute score and score composition remain the primary health check. Do not treat a relative win
between sub-100 bots as promotion evidence. Do not rerun or retune the already measured
scale-16/greedy-75 or Pass-opportunity-4 campaign arms.

## Source ledger

The forum material is expert anecdotal evidence, not official strategy law. The useful signal is
the repeated principle or the documented disagreement, not a copied move order.

- [Lost Fleet official product/rules context](https://capstone-games.com/products/gaia-project-the-lost-fleet)
- [Strategic considerations after the Milan tournament](https://boardgamegeek.com/thread/3533221/strategic-considerations-after-the-milan-tournamen)
- [Strategy tips for the game with the expansion](https://boardgamegeek.com/thread/3520828/strategy-tips-for-the-game-with-the-expansion)
- [Dream openings](https://boardgamegeek.com/thread/3533518/dream-openings)
- [Advanced-tech tier discussion](https://boardgamegeek.com/thread/3410541/advanced-tech-tier-list)
- [Ship access and colour differences](https://boardgamegeek.com/thread/3533630/access-to-ships-colour-difference)
- [Openings for the new factions](https://boardgamegeek.com/thread/3444360/lets-talk-about-openings-for-new-factions)
- [Was this game lost at setup?](https://boardgamegeek.com/thread/3708930/was-this-game-lost-at-setup)
- [Should you always build a Round-1 Academy?](https://boardgamegeek.com/thread/2871643/should-you-always-build-an-academy-at-r1)
- [Opening discussion](https://boardgamegeek.com/thread/3173378/opening)
- [Getting the economy rolling](https://boardgamegeek.com/thread/2764434/i-cant-get-my-economy-rolling)
- [Xenos strategy discussion](https://boardgamegeek.com/thread/2592514/lets-talk-about-xenos-a-strategy-discussion-series)
- [Standard openings](https://boardgamegeek.com/thread/1974293/standard-openings)
- [Designer-approved Federation FAQ](https://boardgamegeek.com/wiki/page/Federation_FAQ)
- [Play-by-forum game summaries](https://boardgamegeek.com/thread/1997564/post-pbf-game-write-upsummaries/page/2)
- [General community strategy discussion](https://www.reddit.com/r/boardgames/comments/uqr157/how_the_do_you_play_gaia_project/)
- [Starting strategy discussion](https://www.reddit.com/r/boardgames/comments/shw5bt/help_for_starting_gaia_project/)
- [Lost Fleet community impressions](https://www.reddit.com/r/boardgames/comments/1e4jnz2/anyone_played_the_gaia_project_expansion_yet/)
- [All-base-faction secondary overview](https://victoryconditions.com/gaia-project-factions/)

## Maintenance rule

Add new advice here only when it changes a general principle, creates a plan archetype, resolves a
documented ambiguity, or supplies a useful faction modifier. Record contrary evidence. Seed-specific
labels belong in focused regression fixtures and `AI_CURRENT.md`, not in the general doctrine.
