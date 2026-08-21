# Lost Fleet — Full-Game Playout Fuzzer: Implementation Plan

> Status: **DONE (2026-07-03).** All 5 phases implemented, tested, and landed (`engine/src/fuzz/`);
> see §8 for the campaign report and findings table. Owner asked for this plan 2026-07-02 after the
> multiplayer E2E (PROGRESS #48). Grounded in traced engine code (§0), per the standing
> working agreement. The defining requirement, stated by the owner: the fuzzer must
> **compare engine behavior against the actual Lost Fleet rules along the way** — it is a
> rules-conformance tool, not just a crash finder. That requirement is baked in as the
> oracle-traceability rule (§3) and the triage protocol (§5): every oracle cites its rule
> source, and no engine change happens without a CONFIRMED rules basis.

## 0. Code facts this plan is built on (traced 2026-07-02)

| Fact                                                                                                                                                                                                                                                           | Where                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `engine.autoMove()` only auto-plays FORCED decisions (faction default, power charge via `decideChargeRequest`, income order, brainstone, optional auto-pass). There is **no general move generator** anywhere in the engine — that is the core thing to build. | `engine/src/move/auto.ts:8-60`, `engine/src/engine.ts:615`                  |
| `engine.generateAvailableCommands()` returns a **typed discriminated union** `AvailableCommand` per `Command`, with concrete data payloads (hexes, tiles, costs, federations…) — everything a generator needs to synthesize legal move strings.                | `engine/src/available/types.ts:84-110`, `engine/src/available/*.ts`         |
| The `Command` enum has ~30 members incl. the LF ones (`Explore`, `SpaceshipAction`, `ExamineArtifact`, `ChooseArtifactToken`, `ChooseTinkeringTile`, `PlacePowerRing`). Each needs a generator arm (many are trivial).                                         | `engine/src/enums.ts:342-376`                                               |
| `engine.advancedLog: LogEntry[]` records per-player, per-source resource/VP deltas — the substrate for conservation and VP-reconciliation oracles. The viewer's chart resource-counter already replays whole games off this log (prior art).                   | `engine/src/engine.ts:138,321`, `viewer/src/logic/charts/resource-counter*` |
| Determinism oracles are nearly free: `new Engine(moveHistory, options)` replay and `Engine.fromData(JSON)` round-trip both exist and are spec-tested in places; the fuzzer generalizes them to every generated game.                                           | `engine/src/engine.ts` (`fromData`, `loadMoves`), `engine/wrapper.spec.ts`  |
| Engine mutates the options object it is given (stamps `map`, `factionVariantVersion`) — the fuzzer must clone options per game, same lesson as PROGRESS #48.                                                                                                   | PROGRESS #48; `viewer/src/hosted/new-game.ts`                               |
| Engine test convention: mocha specs in `engine/src/**/*.spec.ts`, run via `cd engine && npm test`; 490/490 green today and must stay green.                                                                                                                    | `engine/package.json`, PROGRESS "Testing"                                   |
| Rules sources of truth, in trust order: `RULES_CLARIFICATIONS.md` (the §-ledger, values CONFIRMED with sources) → `rulebook-v1.0.txt` (searchable authoritative prose; no official errata exists, §K1) → PROGRESS.md integration flags / known gaps.           | `docs/lost-fleet/`                                                          |

## 1. Goal and shape

Auto-play **hundreds of seeded, fully-random-but-legal Lost Fleet games to completion**
(plus base-game control seeds), checking three tiers of oracles on every move, minimizing
any failure to a small deterministic regression spec, and triaging each finding **against
the written rules** before anything is changed. The 490 unit tests cover mechanics in
isolation; this covers the interaction space (artifacts × ship federations × new factions ×
boosters × final scoring × leech chains) where game-night bugs live.

Engine-only: no viewer changes, no `engine/` public-API changes expected — the fuzzer sits
beside the engine (`engine/src/fuzz/`) and consumes its existing surface. If a fuzzer need
seems to require changing non-fuzz engine code for any reason OTHER than a confirmed rules
bug, stop and flag it.

## 2. Architecture

```
engine/src/fuzz/
  random-player.ts    AvailableCommand -> concrete move string (seeded RNG)
  driver.ts           game loop: init -> loop(generate, move, oracles) -> EndGame
  oracles/
    structural.ts     tier 1 (crash/termination/determinism/commitment)
    conservation.ts   tier 2 (resources, power tokens, VP-vs-log, tile pools)
    lost-fleet.ts     tier 3 (rules oracles, each with a source citation)
  shrink.ts           failure minimizer (greedy turn-prefix/segment removal + replay)
  corpus.ts           seed corpus definition (counts, player counts, LF/base mix)
  regressions/        minimized failure fixtures (committed; replayed by a fast spec)
  fuzz.spec.ts        SMALL smoke corpus, part of `npm test` (seconds, fixed seeds)
  run.ts              CLI campaign runner: `npm run fuzz -- --games 300 --seed-base X`
```

- **`random-player.ts`** is the main construction effort: one arm per `Command` member,
  choosing uniformly (with tuned weights) among the command's offered `data` options and
  emitting the exact move-string grammar the engine parses (the grammar is documented by
  existing specs' fixtures, e.g. `engine/src/engine.spec.ts`, and by `Commands.vue`'s
  string-building for the interactive path). Design rules:
  - Consume ONLY `AvailableCommand.data` — never re-derive legality — so the generator
    cannot mask availability bugs (if the engine offers it, the fuzzer may play it; if
    playing an offered command throws, that is itself a tier-1 finding).
  - Forced sub-decisions (charge/income/brainstone) can either reuse `autoMove`'s deciders
    or be randomized; randomize them (with the auto-decider as one weighted option) — leech
    interrupts are §J2-critical territory.
  - Guard against free-action loops (`Spend`, `BurnPower`): cap conversions per turn, then
    force progress (build/pass weighting grows as the round ages).
  - v1 scope: `factionVariant: "standard"`, no auction, no `customBoardSetup`, players 2-4,
    faction choice randomized by the generator. Auction/variants later if wanted.
- **`driver.ts`**: per game — clone options (see §0), `new Engine([init n seed], options)`,
  loop `generateAvailableCommandsIfNeeded()` → generator → `move()` → run oracles; hard cap
  on total moves (~1500) so a stuck game is a termination failure, not a hang. Every game
  records `{seed, options, moveHistory}` so ANY failure replays exactly.
- **`shrink.ts`**: on failure, greedily drop/trim turns from the tail-back and replay until
  minimal (replay-based shrinking is sound because the engine is deterministic from
  seed+moves — §J3). Output: a fixture in `regressions/` + auto-generated spec assertion.
- **Runtime placement**: the big campaign is a separate script (`npm run fuzz`), NOT part of
  `npm test`. What IS in `npm test`: `fuzz.spec.ts` (a handful of fixed seeds end-to-end,
  seconds) + the `regressions/` replayer, so every found bug stays fixed forever.

## 3. Oracles — with the rules-traceability rule

**The rule that implements "compare with the actual Lost Fleet rules along the way":**
every tier-3 oracle carries, in code, a citation to its rule source
(`RULES_CLARIFICATIONS.md §x` and/or `rulebook-v1.0.txt` section), and the oracle's
assertion text repeats the rule in one sentence. An oracle without a citation does not get
merged. When an oracle fires, the triage protocol (§5) starts from that citation.

### Tier 1 — structural (no rules knowledge)

- Every non-`EndGame` state offers ≥1 available command that is not `DeadEnd`; playing an
  offered command never throws; games terminate within the move cap.
- Determinism: at game end (and at N random mid-points), `new Engine(moveHistory, options)`
  replay produces JSON-identical state; `Engine.fromData(JSON(engine))` round-trips
  identically (generalizes existing spot specs).
- Commitment: `newTurn` is true after every completed line (the multiplayer stack depends
  on this — §J1).
- `playerToMove` is always a seated player; leech interrupts resolve (no stuck
  `tempCurrentPlayer`).

### Tier 2 — conservation / accounting (rules-adjacent, base+LF)

- No resource ever negative (ore/credits/knowledge/QIC/VP where applicable/power in bowls).
- Power-token conservation across bowls modulo documented sources/sinks (gains, burn,
  Itars' gaia-area consumption, brainstone) — the exception list itself cites rules.
- **VP reconciliation**: each player's VP equals the sum of their `advancedLog` VP deltas
  (catches "state changed without a logged cause" — the class of bug that silently breaks
  the viewer's charts and score trust).
- Tile-pool conservation: boosters, tech/adv-tech tiles, federation tokens, LF artifact
  tokens — nothing duplicated or leaked between pool/players/ships.
- Base-game **control corpus**: the same tier-1/2 oracles run on non-LF seeds. The mature
  base engine should be near-silent; noise there means the ORACLE is wrong (calibration
  step before trusting LF findings).

### Tier 3 — Lost Fleet rules oracles (each row = one oracle + citation)

| Rule (one line)                                                                                                                                                                 | Source                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Protoplanet mine: exactly 3 terraform steps, +6 VP on build                                                                                                                     | §Chunk-2 ledger; rulebook "Changes to the Base Game Actions"  |
| Asteroid mine: permanently consumes a Gaiaformer; zero ore/credit build cost                                                                                                    | same                                                          |
| Darkanians: flat 1 terraform step to any color; Space Giants: flat 2                                                                                                            | §B2/§B4                                                       |
| Darkanians & Space Giants pay 2 QIC to build on Gaia; Tinkeroids/Moweyds pay the normal 1                                                                                       | §B2/§B4 vs §B1/§B5                                            |
| Tinkeroids/Moweyds cost-3 color set = other players' home colors first, topped up to exactly 3                                                                                  | §B5 (revised)                                                 |
| Exploration charge track costs 0/2/2/3 across its 4 spaces                                                                                                                      | §C5                                                           |
| Ship standard-tech slots: 0 on Twilight, 1 on each other ship; Twilight artifact slots = player count                                                                           | §C                                                            |
| A ship's seeded Federation token is claimable once; claiming executes its gold side (incl. the 2 chained Build-a-Mine tokens; Asteroid hexes eligible given a spare Gaiaformer) | PROGRESS #24/#26 + BGG designer ruling                        |
| Each of the 12 ship board-actions is usable once per round (per-round lock)                                                                                                     | PROGRESS #18-#23, §C1-C4                                      |
| Research-board QIC actions (Qic1-3) never available under LF; ship QIC "VP per planet type" has base 2                                                                          | §E4/§K3                                                       |
| 7th Advanced Tech slot gate: 2p always ≥25 VP; 3-4p per-game random side (≥25 VP or 3 explored ships)                                                                           | §E6 (owner ruling 2026-06-27)                                 |
| Examine Artifact: all 13 token effects produce exactly their documented rewards                                                                                                 | §G4/§G6, PROGRESS #32                                         |
| Same-color faction exclusivity incl. Tinkeroids↔Darkanians, Moweyds↔Space Giants                                                                                                | §A4                                                           |
| LF-only tiles (boosters/scoring/adv-tech/federations/final tiles) never appear in base seeds, and vice versa                                                                    | Integration flag 5; the #48 chart leak is the cautionary tale |
| Final scoring: recompute each final tile's ranking from end-state and match awarded VP                                                                                          | rulebook final scoring + §E6                                  |

### Pre-declared known gaps (report if hit, do NOT "fix" silently, do NOT count as new finds)

- Protoplanet "+6 VP unless it's your starting planet" carve-out is **deliberately not
  coded** (no coded faction could hit it when Chunk 2 landed — PROGRESS "Done" #10). If the
  fuzzer proves a coded faction CAN hit it now, that's a real, known-shape finding.
- §H4: LF-specific faces of sectors 05/06/07 still use base-game fallbacks (art blocked).
- §K2: four BGG community threads remain human-unread; rulings there may adjust oracles.

## 4. Seed corpus & campaign

- Committed corpus definition: e.g. 300 LF seeds × {2,3,4} players + 100 base-game control
  seeds, all derived from a fixed base seed so campaigns are reproducible and diffable.
- Campaign output: a findings table — seed, minimized fixture path, oracle fired, **rule
  citation**, triage class, resolution — appended to this file per campaign.

## 5. Triage protocol (hard constraint, the other half of "compare with the rules")

For every oracle failure, in order:

1. **Minimize** with `shrink.ts`; commit the fixture to `regressions/` FIRST (red test).
2. **Read the rule**: the oracle's citation → `RULES_CLARIFICATIONS.md` entry → the exact
   `rulebook-v1.0.txt` passage. Quote the passage in the finding.
3. **Classify**:
   - **Engine bug** — engine contradicts a CONFIRMED rule: fix the engine, regression spec
     goes green, note in PROGRESS.
   - **Oracle bug** — the oracle mis-encodes the rule: fix the oracle, document the
     misreading in the oracle's comment (so it isn't re-introduced).
   - **Rules ambiguity** — rulebook text genuinely unclear/silent: record in
     `RULES_CLARIFICATIONS.md` as an open question (Source `OUR-RULING`-pending, Confidence
     `INFERRED`), pick the conservative interpretation for the oracle, and **ask the owner**
     — never resolve ambiguity unilaterally.
4. **Never** weaken an oracle just to make a campaign pass, and **never** change engine
   code without step 2's confirmed basis. (An unexplained fix is worse than a known bug —
   it corrupts the ruleset silently.)

## 6. Delivery phases (each = own tested commit; all 490 base tests stay green throughout)

1. **Generator core + driver**: play seeded 2p BASE games to completion; tier-1 oracles
   only. Deliverable: `fuzz.spec.ts` smoke seeds green in `npm test`.
2. **Tier-2 oracles + base-game control campaign** (calibration: silence expected; noise =
   fix oracles). LF seeds switched on for tier-1/2 once base is quiet.
3. **Tier-3 oracles, first half** (planets/factions/costs/VP rows of the table) + LF
   campaign; triage per §5.
4. **Tier-3 oracles, second half** (ships/artifacts/adv-tech gate/QIC overlay/final
   scoring) + full campaign.
5. **Campaign report**: findings table appended here; PROGRESS.md "Done so far" entry;
   regression corpus committed; any §5.3 ambiguities queued for the owner.

## 7. Execution notes

- Runtime budget: engine replays full games in milliseconds; a 400-game campaign should be
  minutes, not hours — if it isn't, profile the oracle layer, not the engine.
- Clone options per game (see §0). Use a tiny seeded PRNG (e.g. mulberry32) — no deps.
- The fuzzer must also run `generateAvailableCommandsIfNeeded()` exactly like real hosts do,
  so availability-generation itself is inside the tested surface.
- Model guidance (owner asked): build phases 1-4 and all §5 triage with a **high-judgment
  model (Fable)** — encoding rules into oracles and classifying findings against rulebook
  prose is exactly where misjudgment silently corrupts the ruleset. Re-running campaigns,
  adding seeds, and mechanical regression upkeep after the oracles are stable is fine work
  for a smaller model (Sonnet).

## 8. Campaign report (2026-07-03)

**Status: DONE.** All 5 phases implemented and landed as separate tested commits (`engine/src/fuzz/`);
490 base engine tests were the starting baseline and the suite grew to **564/564** (the merge with
another concurrent session's engine work raised the baseline to 520 before this work started — see
PROGRESS.md #49). Emphasis, per the owner's explicit 2026-07-03 instruction: prioritize the Lost
Fleet rules surface (changes to base-game actions, new mechanics) over base-game archaeology — the
base `boardgamers/gaia-project` implementation is trusted/working, so base-only findings are
recorded and NOT fixed here (see the last 2 rows).

Total campaign volume this session: 100 base-control seeds (tier-1/2 calibration, 2p/3p/4p, all
clean) + roughly 1,000 Lost Fleet seeds across targeted and mixed-player-count sweeps (phases 3-5),
plus the final two `npm run fuzz` campaigns below.

| #        | Seed(s)                                                                                                    | Fixture                                                                                                                                                                                         | Oracle                                                                       | Rule citation                                                                                                                                                                                                                                                                                                                                                                                                        | Classification                           | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LF-1     | `fuzz-lf-2p-0` (found), minimized `lf-b5-cost3-row`                                                        | `fuzz/regressions/lf-001-b5-cost3-row-nondeterministic.json`                                                                                                                                    | `tier1.structural.determinism`                                               | RULES_CLARIFICATIONS.md §J3 ("engine is deterministic from seed + moves"); §B5 (rulebook p.8, cost-3 row placed once at setup)                                                                                                                                                                                                                                                                                       | **Engine bug** — CONFIRMED               | **Fixed** (commit `b8f34c4`): `engine.lostFleetTerraformingRow` computed once in `moveInit` and persisted, instead of being recomputed lazily from `map.seed` (which `SpaceMap.toJSON()` never serializes, so every host-style fromData clone shuffled from seed `undefined`). Regression fixture red-then-green verified (constructor vs. `Engine.slowMotion` host-style replay).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| LF-2     | n/a (structural — any Examine Artifact / Twilight Q.I.C. action with 0 owned Federation tokens)            | none (deliberately not forced into the corpus; hit incidentally during phase-2 sweeps)                                                                                                          | generator robustness (`fuzz/random-player.ts` `pickOrNull`)                  | RULES_CLARIFICATIONS.md §G6 (Federation-shaped Artifact), §C1 (Twilight Q.I.C. "same mechanic as the base game's federation re-scoring")                                                                                                                                                                                                                                                                             | **Rules ambiguity → RESOLVED**           | **Fixed** (owner ruling 2026-07-03, recorded in `RULES_CLARIFICATIONS.md` **Open Question #8**, revised same session): unlike the base game's QIC2 (which hides the action entirely without an owned token), both LF surfaces stay offered/choosable with zero owned Federation tokens and simply have no effect. `engine.ts`'s shared `gain-${Resource.RescoreFederation}` listener is no longer `required`; `available/federations.ts`'s rescore branch returns no command (not one with an empty `tiles` list) when nothing is owned, so it resolves as a genuine no-op instead of an unanswerable forced choice. New `BuildWarning.noOwnedFederationToRescore` / `ChooseArtifactToken.noEffectTokens` surface the condition as data for a future UI. 5 new/updated regression tests; 170-seed validation campaign clean. |
| LF-3     | `fuzz-lf-2p-2`                                                                                             | `move/spaceship-actions.spec.ts` + `engine.spec.ts` regression tests (2 new, not a JSON fixture — the finding was a unit-level cost-attribution bug, more naturally expressed as focused tests) | `tier2.conservation.non-negative`                                            | RULES_CLARIFICATIONS.md §E2 (rulebook p.10, Asteroid mine "needs an available Gaiaformer; Gaiaformer is consumed"); §C4 (Eclipse Credit action, "the mine itself is free... distinct from the standard Asteroid-mine route in E2, which instead requires consuming a Gaiaformer"); §G3 (rulebook Appendix III, "former" booster: "3 VP per Gaiaformer... none for Gaiaformers already used to colonize an asteroid") | **Engine bug** — CONFIRMED               | **Fixed** (commit `1eb9aa4`): `player.build()` unconditionally consumed a Gaiaformer on any new Asteroid colonization, including starting-building setup placement (§B1/§B2 factions own 0 Gaiaformers at setup — this permanently cost Tinkeroids/Darkanians one Gaiaformer of capacity) and Eclipse's Credit action (§C4 explicitly waives it). Symptom: the §G3 "former" booster paid **−3 VP on pass** once the negative-capacity bug accumulated. New `AvailableBuilding.consumesAsteroidGaiaformer` flag (default true; false at the 2 non-consuming sites). 2 red-then-green regression tests.                                                                                                                                                                                                                        |
| oracle-1 | `fuzz-lf-2p-6`, `-17`, `-21`, `-23`, `-24`, `-29`; Ivory Beacon                                           | `engine.spec.ts` + `player.spec.ts` regressions                                                                                                                                                  | `tier3.lf.build-offers`                                                      | RULES_CLARIFICATIONS.md §E1 (rulebook p.10, "+6 VP on mine (0 if it's your start planet)")                                                                                                                                                                                                                                                                                                                           | **Engine bug — CONFIRMED**               | **Corrected 2026-08-21:** the earlier triage incorrectly treated every Moweyds/Space Giants Protoplanet as "your start planet." The carve-out applies only to the free Phase.SetupBuilding placement. Every later Build-a-Mine action receives +6 VP, regardless of faction. Removed the engine's home-type suppression, restored the oracle's +6 expectation after setup, and locked both halves of the distinction with regressions.                                                                                                                                                                                                                                                                                                                                                                                 |
| oracle-2 | `fuzz-lf-mix-4p-95`                                                                                        | n/a (oracle-only)                                                                                                                                                                               | `tier3.lf.artifact-effects` / `tier3.lf.ship-federation-gold-side` (phase-4) | RULES_CLARIFICATIONS.md §G6 (KnowledgeQic artifact, "gain 3 knowledge + 1 Q.I.C."); §G5 (OreQic ship Federation token)                                                                                                                                                                                                                                                                                               | **Oracle bug**                           | **Fixed in the oracle**: both oracles expected a flat "+1 Q.I.C." reward, missing the **pre-existing base-game Gleens rule** (`player.ts` `factionReward`: every Q.I.C. grant from any source becomes Ore for Gleens until Academy2 is built). Not Lost Fleet content, but the new LF reward paths correctly interact with it — the oracle's expectation was wrong, not the engine. Root-caused via a full instrumented trace of the reward pipeline. Fixed via a shared `applyGleensQicSubstitution()` helper.                                                                                                                                                                                                                                                                                                              |
| oracle-3 | `fuzz-lf-2p-34`                                                                                            | n/a (oracle-only)                                                                                                                                                                               | `tier3.lf.final-scoring-counts` (phase-4)                                    | RULES_CLARIFICATIONS.md §H2/§G4 (Deep Space sector colonization counting)                                                                                                                                                                                                                                                                                                                                            | **Oracle bug**                           | **Fixed in the oracle**: the independent Deep-Space-sector re-derivation counted any hex with `buildingOf(player) !== undefined`, which incorrectly includes a Lantids-style "additional mine" (guest, non-main-occupier) hex; the engine's own trusted `ownedPlanets`-based convention (main-occupier only) correctly excludes it. Oracle fixed to check `hex.isMainOccupier(player)`, matching the engine convention.                                                                                                                                                                                                                                                                                                                                                                                                      |
| BASE-1   | `fuzz-lf-3p-33` (81 lines, minimal — every line load-bearing), `fuzz-lf-mix-4p-110` (shrunk 119→105 lines) | `fuzz/known-issues/base-001-*.json`, `base-002-*.json` (reference only — deliberately NOT in `fuzz/regressions/`, which `npm test` asserts green)                                               | `tier1.structural.determinism`                                               | **None** — base-game Taklons + Brainstone + RoundIncome/RoundLeech machinery; no `RULES_CLARIFICATIONS.md` entry exists for base Taklons behavior                                                                                                                                                                                                                                                                    | **Engine bug (suspected), OUT OF SCOPE** | **Not fixed.** Two independent seeds (3p and 4p) show live incremental play requiring Taklons to resolve a Brainstone placement that a fresh sequential replay of the identical seed+moves does not, both during Taklons' Planetary-Institute-boosted leech/income interrupts (`available/leech.ts` `getTaklonsExtraLeechOffers`). Zero Lost Fleet content involved; per the owner's explicit 2026-07-03 instruction the base implementation is trusted and this session's effort stays on Lost Fleet rules — no rules basis exists to touch engine code regardless. Flagged for a future base-game-focused session.                                                                                                                                                                                                         |
| BASE-2   | `lost-fleet-fuzz-v1-lf-2p-61` (shrunk 58→35 lines)                                                         | `fuzz/known-issues/base-003-federation-cache-staleness-nondeterminism.json` (reference only)                                                                                                    | `tier1.structural.determinism`                                               | **None** — base-game `Player.availableFederations()` caching; federations are vanilla Gaia Project content, no Lost Fleet ledger entry applies                                                                                                                                                                                                                                                                       | **Engine bug (suspected), OUT OF SCOPE** | **Not fixed.** A fresh sequential replay ends up offering no `Command.FormFederation` at all where live/host-style play correctly does; root-caused (via a full instrumented trace) to `player.federationCache`'s early-return cache-hit path in `availableFederations()`, which is keyed only on `maxSatellites <= federationCache.availableSatellites` with no check that the underlying occupied-hex set changed since the cache was warmed. Surfaced by (not caused by) a Lost Fleet ship-federation claim move; the caching bug itself is pure base-game machinery. Flagged for a future base-game-focused session.                                                                                                                                                                                                     |

**Oracle-calibration notes** (not findings — recorded so they aren't rediscovered): `fuzz/state.ts`'s
`normalizedEngineState()` intentionally excludes `players[*].data.tiles.booster`'s `undefined`-vs-`null`
representational difference (last-round pass) and `players[*].federationCache` from state-equality
comparisons. The `federationCache` exclusion does NOT mask BASE-2 above — that finding was caught by
the separate "replay must not throw" check, which is independent of state-field comparison, so the
exclusion remains safe for its original purpose (avoiding noise in the field-diff check specifically).

**Regression corpus**: `fuzz/regressions/lf-001-b5-cost3-row-nondeterministic.json` (auto-replayed,
asserted green, in `npm test`) plus 2 focused unit tests for LF-3. `fuzz/known-issues/` holds the 3
base-game reference reproducers (base-001/002/003), deliberately excluded from the `npm test`
regression loader so the suite stays green while the reproducers remain available for a future session.

**Queued for the owner**: none remaining — `RULES_CLARIFICATIONS.md` Open Question #8 (LF-2, the
rescore-with-no-owned-token gate) was resolved by owner ruling the same session; see the LF-2 row
above.
