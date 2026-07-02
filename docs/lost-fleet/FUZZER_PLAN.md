# Lost Fleet — Full-Game Playout Fuzzer: Implementation Plan (PROPOSED)

> Status: **PLAN ONLY — not started.** Owner asked for this plan 2026-07-02 after the
> multiplayer E2E (PROGRESS #48). Grounded in traced engine code (§0), per the standing
> working agreement. The defining requirement, stated by the owner: the fuzzer must
> **compare engine behavior against the actual Lost Fleet rules along the way** — it is a
> rules-conformance tool, not just a crash finder. That requirement is baked in as the
> oracle-traceability rule (§3) and the triage protocol (§5): every oracle cites its rule
> source, and no engine change happens without a CONFIRMED rules basis.

## 0. Code facts this plan is built on (traced 2026-07-02)

| Fact | Where |
| --- | --- |
| `engine.autoMove()` only auto-plays FORCED decisions (faction default, power charge via `decideChargeRequest`, income order, brainstone, optional auto-pass). There is **no general move generator** anywhere in the engine — that is the core thing to build. | `engine/src/move/auto.ts:8-60`, `engine/src/engine.ts:615` |
| `engine.generateAvailableCommands()` returns a **typed discriminated union** `AvailableCommand` per `Command`, with concrete data payloads (hexes, tiles, costs, federations…) — everything a generator needs to synthesize legal move strings. | `engine/src/available/types.ts:84-110`, `engine/src/available/*.ts` |
| The `Command` enum has ~30 members incl. the LF ones (`Explore`, `SpaceshipAction`, `ExamineArtifact`, `ChooseArtifactToken`, `ChooseTinkeringTile`, `PlacePowerRing`). Each needs a generator arm (many are trivial). | `engine/src/enums.ts:342-376` |
| `engine.advancedLog: LogEntry[]` records per-player, per-source resource/VP deltas — the substrate for conservation and VP-reconciliation oracles. The viewer's chart resource-counter already replays whole games off this log (prior art). | `engine/src/engine.ts:138,321`, `viewer/src/logic/charts/resource-counter*` |
| Determinism oracles are nearly free: `new Engine(moveHistory, options)` replay and `Engine.fromData(JSON)` round-trip both exist and are spec-tested in places; the fuzzer generalizes them to every generated game. | `engine/src/engine.ts` (`fromData`, `loadMoves`), `engine/wrapper.spec.ts` |
| Engine mutates the options object it is given (stamps `map`, `factionVariantVersion`) — the fuzzer must clone options per game, same lesson as PROGRESS #48. | PROGRESS #48; `viewer/src/hosted/new-game.ts` |
| Engine test convention: mocha specs in `engine/src/**/*.spec.ts`, run via `cd engine && npm test`; 490/490 green today and must stay green. | `engine/package.json`, PROGRESS "Testing" |
| Rules sources of truth, in trust order: `RULES_CLARIFICATIONS.md` (the §-ledger, values CONFIRMED with sources) → `rulebook-v1.0.txt` (searchable authoritative prose; no official errata exists, §K1) → PROGRESS.md integration flags / known gaps. | `docs/lost-fleet/` |

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

| Rule (one line) | Source |
| --- | --- |
| Protoplanet mine: exactly 3 terraform steps, +6 VP on build | §Chunk-2 ledger; rulebook "Changes to the Base Game Actions" |
| Asteroid mine: permanently consumes a Gaiaformer; zero ore/credit build cost | same |
| Darkanians: flat 1 terraform step to any color; Space Giants: flat 2 | §B2/§B4 |
| Darkanians & Space Giants pay 2 QIC to build on Gaia; Tinkeroids/Moweyds pay the normal 1 | §B2/§B4 vs §B1/§B5 |
| Tinkeroids/Moweyds cost-3 color set = other players' home colors first, topped up to exactly 3 | §B5 (revised) |
| Exploration charge track costs 0/2/2/3 across its 4 spaces | §C5 |
| Ship standard-tech slots: 0 on Twilight, 1 on each other ship; Twilight artifact slots = player count | §C |
| A ship's seeded Federation token is claimable once; claiming executes its gold side (incl. the 2 chained Build-a-Mine tokens; Asteroid hexes eligible given a spare Gaiaformer) | PROGRESS #24/#26 + BGG designer ruling |
| Each of the 12 ship board-actions is usable once per round (per-round lock) | PROGRESS #18-#23, §C1-C4 |
| Research-board QIC actions (Qic1-3) never available under LF; ship QIC "VP per planet type" has base 2 | §E4/§K3 |
| 7th Advanced Tech slot gate: 2p always ≥25 VP; 3-4p per-game random side (≥25 VP or 3 explored ships) | §E6 (owner ruling 2026-06-27) |
| Examine Artifact: all 13 token effects produce exactly their documented rewards | §G4/§G6, PROGRESS #32 |
| Same-color faction exclusivity incl. Tinkeroids↔Darkanians, Moweyds↔Space Giants | §A4 |
| LF-only tiles (boosters/scoring/adv-tech/federations/final tiles) never appear in base seeds, and vice versa | Integration flag 5; the #48 chart leak is the cautionary tale |
| Final scoring: recompute each final tile's ranking from end-state and match awarded VP | rulebook final scoring + §E6 |

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
