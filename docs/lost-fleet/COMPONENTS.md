# Lost Fleet — Components Inventory

> **Purpose:** Complete checklist of every physical component in *Gaia Project: The Lost Fleet*
> that must be represented in code. Seeded from the rulebook component list (p.2) plus components
> that only appear later as graphics. Track implementation status here.
>
> **Rulebook version referenced:** 1.0 (printed on p.11 of the rulebook PDF).
> **Errata status:** ☑ Checked 2026-06-25 — **no official errata/FAQ exists**; v1.0 rulebook is
> authoritative. See `RULES_CLARIFICATIONS.md` §K. Community forum threads still need human review.
> See https://boardgamegeek.com/boardgame/396802/gaia-project-the-lost-fleet (Files & Forums).

## Status legend
- `☐ TODO` — not started
- `◐ SPEC` — values captured in RULES_CLARIFICATIONS.md, not yet coded
- `● DONE` — implemented + base-game tests still green
- `[NEED FROM BOARD]` — value must be read off the physical component (not in rulebook text)

`◐ SPEC` for any tile/token/board means all three of: effect text, source, AND a planned digital
depiction are filled in over in `RULES_CLARIFICATIONS.md` (see "How to use this file" → "Art
policy" there) — not just the effect text alone.

---

## 1. New Factions (4)

| Faction | Start planet | Maps to | Status |
|---|---|---|---|
| Tinkeroids | Asteroid | `Faction` enum + `faction-boards/tinkeroids.ts` | ☐ TODO (blocked on §B5 cost-3 scan-order ambiguity) |
| Darkanians | Asteroid | `Faction` enum + `faction-boards/darkanians.ts` | ● DONE |
| Moweyds | Protoplanet | `Faction` enum + `faction-boards/moweyds.ts` | ☐ TODO (blocked on §B5 cost-3 scan-order ambiguity) |
| Space Giants | Protoplanet | `Faction` enum + `faction-boards/space-giants.ts` | ● DONE except Exploration-board special action (subsystem not yet built) |

Each new faction needs (see RULES_CLARIFICATIONS for values):
- Starting income row(s) `[NEED FROM BOARD]`
- Starting resources + starting power Area I/II distribution `[NEED FROM BOARD]`
- Standard-planet terraform cost layout `[NEED FROM BOARD]`
- Passive ability (text in rulebook p.13)
- Planetary Institute ability (text in rulebook p.13)
- Note: opposite-faction/home-planet pairing logic — these factions have NO home planet,
  which breaks the base `oppositeFaction()` assumption in `factions.ts`. Flag in clarifications.

## 2. New Planet Types (2)

| Planet | Rule | Maps to | Status |
|---|---|---|---|
| Protoplanet | 3 terraform steps; +6 VP on mine (0 VP if starting planet — not yet codeable, no faction has this home planet; see PROGRESS.md "Done so far" #10) | `Planet` enum | ● DONE |
| Asteroid | requires sacrificing a Gaiaformer; no build cost | `Planet` enum | ● DONE |

- New "11 planet types" symbol replaces the base "different planet types" symbol — affects
  the `PlanetType` final-scoring and any planet-type counting logic.
- The 11th type in that symbol is the EXISTING base-game "Lost Planet" (gained at Navigation Level 5)
  — not a new physical token, just newly counted. Confirmed via rulebook text + the randomizer's
  `lostplanet.png` asset. See RULES_CLARIFICATIONS.md §G4b.

## 3. Lost Fleet Spaceship Boards (4)

> These are the board-game "Spaceship Boards", NOT the single-hex spaceship tiles on the map.

| Spaceship | Special note | Status |
|---|---|---|
| Twilight (Nautilaks) | Holds Artifacts; "Examine Artifact" action | ◐ Board data + setup ● DONE (`spaceships.ts`, `setup.ts`); core Explore action/state ● DONE; federation-claim ownership hook ● DONE; claimed-token gold-side execution ● DONE; QIC action (re-score owned Federation token) ● DONE; Knowledge action (1k → +3 range for Build a Mine/Gaiaforming/Exploring) ● DONE; Power action (3pw,2o → upgrade a Trading Station into a Research Lab) ● DONE; Artifact-token seeding + Examine Artifact action ☐ TODO |
| Rebellion (Vo'Kron) | NOT used in 2-player games | ◐ Board data + setup ● DONE (`spaceships.ts`, `setup.ts`); core Explore action/state ● DONE; federation-claim ownership hook ● DONE; claimed-token gold-side execution ● DONE; Standard-Tech claim hook ● DONE; QIC action (claim Tech tile) ● DONE; Knowledge action (2k → 2c+1q) ● DONE; Power action (3pw,1o → upgrade a Mine into a Trading Station, ignoring isolation) ● DONE |
| T F Mars (Gaia Federation) | Moweyds start with a shuttle here | ◐ Board data + setup ● DONE; core Explore action/state ● DONE; federation-claim ownership hook ● DONE; claimed-token gold-side execution ● DONE; Standard-Tech claim hook ● DONE; QIC action (VP scaled by owned Tech tiles) ● DONE; Power action / Instant-Gaiaforming (2pw → convert a Transdim planet in range, QIC-for-extra-range, into Gaia, no building placed) ● DONE; Credit action (3c → terraform + build a Mine in range, ore for steps beyond the first) ● DONE |
| Eclipse (Eridani Empire) | — | ◐ Board data + setup ● DONE; core Explore action/state ● DONE; federation-claim ownership hook ● DONE; claimed-token gold-side execution ● DONE; Standard-Tech claim hook ● DONE; QIC action (VP scaled by colonized planet types) ● DONE; Power action (3pw,2k → free research upgrade) ● DONE; Credit action (6c → free Mine on an Asteroid in range) ● DONE |

Each spaceship needs:
- Every action space on the board: type (Q.I.C. / Power / Knowledge / Credit), cost, effect, position
  — ● DONE, see `engine/src/spaceships.ts` (`spaceshipBoards`). Live availability/execution wiring
  (`available/spaceship-actions.ts`, `move/spaceship-actions.ts`, `engine.spaceshipActions` per-round
  lock) is ● DONE for all 12 of 12 actions (Twilight QIC + Knowledge + Power, Rebellion QIC + Knowledge
  + Power, T F Mars QIC + Power + Credit, Eclipse QIC + Power + Credit). Separately, and not
  counted in the 12, claimed ship Federation tokens' gold-side execution is now ● DONE for all 8
  tokens (`player.ts` direct rewards for 6, `available/federations.ts` +
  `move/federation.ts`'s `SubPhase.FederationTokenBuildMine` chain for Range/Terraform's bonus Build a
  Mine). Rescoring (QIC2 board action) is also ● DONE for ship-claimed tokens — they're offered in the
  rescore list alongside pool-drawn tokens and re-trigger their gold-side effect uniformly, same as
  pool tokens (`available/federations.ts`, `move/federation.ts`'s `rescoreSpaceshipFederationToken`).
  Only Twilight's Examine Artifact action remains ☐ TODO.
- Number of standard-tech slots — ● DONE: 0 (Twilight, has no Standard Tech slot at all), 1 each for
  Rebellion/T F Mars/Eclipse. Confirmed via owner board photos, see RULES_CLARIFICATIONS.md §C1/§C4.
- Which new federation token + standard tech is seeded onto it at setup — ● DONE, random
  setup-time assignment implemented in `engine/src/setup.ts` (`shipAssignmentFactory`); only the
  *seeding* was the first slice; redemption hooks are now live for seeded Standard Tech tiles and
  Federation tokens, while the ships' own action-space execution is still TODO.
- Core Explore action/state — ● DONE in engine (`exploration.ts`, `available/exploration.ts`,
  `move/exploration.ts`): range from colonized planets only, Q.I.C. extension, 2-player vs. 3/4-player
  shuttle limits, one shuttle per ship, lowest free slot, slot charge rewards `0/2/2/3`, Taklons /
  Nevlas / Itars / Bal T'aks deploy adjustments, and serialization of per-player explored ships.
  Remaining ship-board action execution / redemption hooks are still TODO.
- Federation-token claim hook — ● DONE in engine: when a player forms any federation, eligible
  ship-seeded Federation tokens from explored ships are added to the selectable federation-token
  choices, without requiring the ship to be adjacent to the formed federation. Claimed ship tokens are
  persisted as owned federation tokens for count / green-side consumption; their special gold-side
  action execution is now ● DONE too — Credit/Knowledge/OreQic/Tech/Vp/PowerTokens grant their reward
  immediately on claim (`pl.gainSpaceshipFederationToken()`), Range/Terraform chain into a one-time
  bonus Build a Mine action (`SubPhase.FederationTokenBuildMine`).
- Standard-Tech claim hook — ● DONE in engine: explored ships add their seeded Standard Tech tile to
  the normal `Command.ChooseTechTile` options, claiming the tile removes it from the ship and stores it
  as a normal coverable Standard Tech, and the normal follow-up free research advance still applies.
  The 3 Lost Fleet Standard Tech tiles' own gameplay effects remain a later live-effect slice.

## 4. Exploration Boards (per faction, all 18 factions get one)

Core Explore action/status: ● DONE in engine for currently coded factions. Remaining Exploration-board
special actions (notably Space Giants, and later Moweyds' pre-seeded shuttle once that faction exists)
are still TODO.

Each faction's Exploration board needs `[NEED FROM BOARD]`:
- Shuttle deployment cost (usually 5 VP; Bal T'aks 7 VP) — ● DONE in engine
- Faction-specific deploy adjustment (Taklons: Brainstone→Gaia; Nevlas/Itars: discard 1 power) — ● DONE in engine
- Number of shuttles (3 normally, 2 in 2-player) — ● DONE in engine
- Charge-power value at each numbered shuttle space (1–4) on the SPACESHIP board (see §3) — ● DONE in engine (`0/2/2/3`)

## 5. Exploration Shuttles
- 27 shuttles total (3 × 9 colors). Per-player-color piece. Status: ☐ TODO

## 6. Map Components

| Component | Count | Detail needed | Status |
|---|---|---|---|
| Deep Space Sector tiles | 8 (double-sided) | Planet layout per side — CONFIRMED for all 16 faces, see RULES_CLARIFICATIONS.md §H2 (the 3rd hex motif on 12a/13a/17a is Transdim, resolved 2026-06-27). **Data CODED** in `engine/src/lost-fleet-map.ts` `DEEP_SPACE_TILES` (Chunk 5); **placement onto the board CODED** in `lost-fleet-board.ts` `placeDeepSpaceTiles()` (Chunk 6, incl. the 2p 11-16 restriction and the 3p adjacent-notch "larger gap" rule, which needs no special-casing — see §H1 note 4) | ● CODED |
| Interspace tiles | 30, in 4 player-count sets | per-set composition (asteroid/protoplanet/spaceship/blank counts) CONFIRMED, see RULES_CLARIFICATIONS.md §H3; exact tile-by-tile identity not needed (random placement). **Data CODED** in `lost-fleet-map.ts` `INTERSPACE_SETS`/`interspaceSet()` (Chunk 5); **placement onto the board CODED** in `lost-fleet-board.ts` `placeInterspaceTiles()` (Chunk 6, incl. ship identities via `shipsInPlay()` and the §H1 spaceship-spacing constraint via rejection sampling) | ● CODED |
| Revised Space Sector tiles | replaces base "different planet types" components | which planets on revised sides `[NEED FROM BOARD]` — §H4. Stubbed/flagged in `lost-fleet-map.ts` `REVISED_SECTOR_FACES_TODO` (`available: false`, falls back to base-game face); `lost-fleet-board.ts` uses the base game's matching per-count face (B-side 2p/3p, A-side 4p) as that fallback | ☐ TODO (stubbed) |
| Shifted-sector setup geometry | per player count (2/3/4) | encode the offset-placement layout (rulebook p.4-5). **CODED & verified** in `lost-fleet-map.ts` `lostFleetSectorCenters()` + `findInterspaceHoles()` + `findDeepSpaceNotches()` (Chunk 5): 6/8/10 single-hex Interspace holes, 6/8/8 Deep Space triangle notches, 0 overlap. **Full `Grid<GaiaHex>` assembly CODED** in `lost-fleet-board.ts` `generateLostFleetBoard()` (Chunk 6, plus a German-rules-adjacency reroll loop added in a later session) — sector tiles + Interspace + Deep Space all placed, seed-deterministic. The `GaiaHex` addressing bug that blocked wiring this into `SpaceMap` is now **FIXED** (Chunk 7a, `sectorCenter` stamped in `Sector.create()`). **Wired into the real `SpaceMap`/`moveInit` (Chunk 7b):** `SpaceMap`'s constructor takes a `lostFleet` flag and calls `generateLostFleetBoard()` directly when set, bypassing the base game's tile-shuffle/`isValid()`-reroll machinery; `configuration()`/`parse()` got Lost-Fleet-aware branches (real sector centers for `rotateSector()`, a fallback for `IS<n>`/`DS<tileId>_<n>` coordinate strings); `moveInit()` threads `engine.options.lostFleet` through and rejects combining it with a custom `map.sectors` configuration or `customBoardSetup`; `Engine.fromData()` restores `map.lostFleet` on deserialization. Covered by `map.spec.ts`'s "Lost Fleet" test block. | ● CODED |

## 7. Tiles & Tokens

| Component | Count | Detail | Status |
|---|---|---|---|
| Standard Tech tiles (new) | 3 distinct types (1 in play per ship; rulebook's "4 each" is spare reprints) | exact effect of each type — CONFIRMED, see RULES_CLARIFICATIONS.md §G1 | ◐ SPEC |
| Advanced Tech tiles (new) | 6 | exact effects CONFIRMED for all 6 — RULES_CLARIFICATIONS.md §G2 (corrected 2026-06-27: "big" is PI/Academy-only, 6VP each max 18; the Deep Space clause belongs to the separate "deep" tile) | ◐ SPEC |
| Round Boosters (new) | 4 | income + pass bonus — CONFIRMED, see RULES_CLARIFICATIONS.md §G3 | ◐ SPEC |
| Round Scoring tiles (new) | 3 | text p.14 — CONFIRMED verbatim, see RULES_CLARIFICATIONS.md §G4 | ◐ SPEC |
| Final Scoring tiles (new) | 3 | "most asteroids", "PI–Academy distance", "most deep space sectors" — CONFIRMED verbatim, see RULES_CLARIFICATIONS.md §G4 | ◐ SPEC |
| Federation tokens (new) | 8 (gold outline) | exact effects CONFIRMED for all 8, see RULES_CLARIFICATIONS.md §G5; ALL 8 have a green side (standard base-game mechanic — only the base game's original 12-VP token lacks one), resolved 2026-06-27 | ◐ SPEC |
| Artifact tokens | 13 | effect CONFIRMED for all 13, see RULES_CLARIFICATIONS.md §G6; count of each type among the 13 inferred as 1-each, VERIFY `[NEED FROM BOARD]` | ◐ SPEC |
| Gaia Planet tokens | 4 | additive to base supply | ☐ TODO |
| Action tokens | 12 | mark used spaceship action spaces | ☐ TODO |
| Tinkering tiles | 6 (Tinkeroids only) | effect of each CONFIRMED, see RULES_CLARIFICATIONS.md §B1 (rounds 1-3: terra 1 / charge 4pw / 1 Q.I.C.; rounds 4-6: terra 3 / 3 knowledge / 2 Q.I.C.) | ◐ SPEC |
| Power Rings | 6 (Moweyds only) | +2 power value to a structure (text p.13) | ☐ TODO |

## 8. Revised / Adjusted Base Components

| Component | Detail | Status |
|---|---|---|
| Adjusted Economy Research tile (double-sided) | levels 3 & 4 rewards, BOTH sides — CONFIRMED, see RULES_CLARIFICATIONS.md §F1 | ◐ SPEC |
| Adjusted Lantids PI tile (double-sided) | solo/2p side AND 3p side — CONFIRMED verbatim (RULES_CLARIFICATIONS.md §I2); NOT rendered by the uiqoo.kr randomizer tool at all, text-only | ◐ SPEC |
| Colonization overlay | covers Q.I.C. actions on Research board; defines protoplanet/asteroid terraform | ☐ TODO |
| Scoring Board Extension (double-sided) | 25-VP side / 3-shuttle side; +1 advanced tech slot — CONFIRMED (was previously mislabeled "Adjusted Lantids PI tile" in early review passes; see RULES_CLARIFICATIONS.md §E6) | ◐ SPEC |

## 9. Existing-Faction Changes — AUDIT CLOSED 2026-06-27

> p.16's full 18-faction comparison graphic was screenshotted by the owner and transcribed in full
> into RULES_CLARIFICATIONS.md §I7. Result: only 3 existing factions get a genuinely new Lost-Fleet
> ability (Xenos, Gleens, Space Giants — all already captured); every other existing faction's
> deviation from the table's baseline is pre-existing vanilla personality, not a Lost Fleet change.

- Ivits — CLOSED, no delta found beyond power 2/2 (matches pre-existing vanilla value). §I1/§I7.
- Xenos — free action: spend 1 ore → 1 power Area III (text p.11). CONFIRMED, cross-validated by p.16. §I4.
- Gleens — special action incl. Explore +2 range (text p.11). CONFIRMED, cross-validated by p.16. §I5.
- Bescods — CLOSED, no delta found; "start with 3 knowledge" (p.8) just restates their existing
  vanilla baseline, not a deviation. §I3/§I7.
- Lantids — adjusted PI tile (§8) + income 1 power Area I (text p.8). CONFIRMED. §I2.
- Taklons / Nevlas / Itars / Bal T'aks — exploration-cost adjustments (text p.9, captured). §D5.
- ALL OTHER FACTIONS (Ambas, Hadsch Hallas, Geodens, Firaks) — diffed against p.16 art, no silent
  change found. §I6/§I7. Implementation note: when coding each faction's Lost Fleet config, diff
  §I7's table row against the existing `engine/src/faction-boards/*.ts` definition to be certain no
  non-ability income/PI/AC delta was missed — the table itself doesn't distinguish "changed by LF"
  from "always been true," only the engine's existing correct vanilla numbers can confirm that.

## 10. Player Pieces (new colors: turquoise, pink)
Per new color: 8 mines, 4 trading stations, 3 research labs, 2 academies, 1 PI,
3 gaiaformers, 25 satellites, 7 player tokens. → `color-codes.ts` + viewer SVG. Status: ☐ TODO

## 11. Explicitly OUT OF SCOPE
- ☒ Automa / solo-bot (all components: Automa Spaceship tiles, Automa Terraforming board, etc.)
- ☒ Frontiers expansion exposure (code kept as reference; not offered alongside Lost Fleet)
