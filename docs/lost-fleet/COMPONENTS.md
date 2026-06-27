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
| Tinkeroids | Asteroid | `Faction` enum + `faction-boards/tinkeroids.ts` | ☐ TODO |
| Darkanians | Asteroid | `Faction` enum + `faction-boards/darkanians.ts` | ☐ TODO |
| Moweyds | Protoplanet | `Faction` enum + `faction-boards/moweyds.ts` | ☐ TODO |
| Space Giants | Protoplanet | `Faction` enum + `faction-boards/space-giants.ts` | ☐ TODO |

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
| Protoplanet | 3 terraform steps; +6 VP on mine (0 VP if starting planet) | `Planet` enum | ☐ TODO |
| Asteroid | requires sacrificing a Gaiaformer; no build cost | `Planet` enum | ☐ TODO |

- New "11 planet types" symbol replaces the base "different planet types" symbol — affects
  the `PlanetType` final-scoring and any planet-type counting logic.

## 3. Lost Fleet Spaceship Boards (4)

> These are the board-game "Spaceship Boards", NOT the single-hex spaceship tiles on the map.

| Spaceship | Special note | Status |
|---|---|---|
| Twilight (Nautilaks) | Holds Artifacts; "Examine Artifact" action | ☐ TODO |
| Rebellion (Vo'Kron) | NOT used in 2-player games | ☐ TODO |
| T F Mars (Gaia Federation) | Moweyds start with a shuttle here | ☐ TODO |
| Eclipse (Eridani Empire) | — | ☐ TODO |

Each spaceship needs `[NEED FROM BOARD]`:
- Every action space on the board: type (Q.I.C. / Power / Knowledge / Credit), cost, effect, position
- Number of standard-tech slots (2 or 3)
- Which new federation token + standard tech is seeded onto it at setup (random, but model the slots)

## 4. Exploration Boards (per faction, all 18 factions get one)

Each faction's Exploration board needs `[NEED FROM BOARD]`:
- Shuttle deployment cost (usually 5 VP; Bal T'aks 7 VP)
- Faction-specific deploy adjustment (Taklons: Brainstone→Gaia; Nevlas/Itars: discard 1 power)
- Number of shuttles (3 normally, 2 in 2-player)
- Charge-power value at each numbered shuttle space (1–5) on the SPACESHIP board (see §3)

## 5. Exploration Shuttles
- 27 shuttles total (3 × 9 colors). Per-player-color piece. Status: ☐ TODO

## 6. Map Components

| Component | Count | Detail needed | Status |
|---|---|---|---|
| Deep Space Sector tiles | 8 (double-sided) | Planet layout per side `[NEED FROM BOARD]` | ☐ TODO |
| Interspace tiles | 30, in 4 player-count sets | spaceship / planet / blank per tile, per set `[NEED FROM BOARD]` | ☐ TODO |
| Revised Space Sector tiles | replaces base "different planet types" components | which planets on revised sides `[NEED FROM BOARD]` | ☐ TODO |
| Shifted-sector setup geometry | per player count (2/3/4) | encode the offset-placement layout (rulebook p.4-5) | ☐ TODO |

## 7. Tiles & Tokens

| Component | Count | Detail | Status |
|---|---|---|---|
| Standard Tech tiles (new) | 12 (4 each of 3 types) | exact effect of each type — text p.13-15, VERIFY counts `[NEED FROM BOARD]` | ☐ TODO |
| Advanced Tech tiles (new) | 6 | exact effects `[NEED FROM BOARD]` (text p.15 partial) | ☐ TODO |
| Round Boosters (new) | 4 | income + pass bonus (text p.14, verify icons) | ☐ TODO |
| Round Scoring tiles (new) | 3 | text p.14 | ☐ TODO |
| Final Scoring tiles (new) | 3 | "most asteroids", "PI–Academy distance", "most deep space sectors" (text p.15) | ☐ TODO |
| Federation tokens (new) | 8 (gold outline) | exact effects + which have green side `[NEED FROM BOARD]` (text p.15 partial) | ☐ TODO |
| Artifact tokens | 13 | effect + count of each type among the 13 `[NEED FROM BOARD]` (text p.15 lists types) | ☐ TODO |
| Gaia Planet tokens | 4 | additive to base supply | ☐ TODO |
| Action tokens | 12 | mark used spaceship action spaces | ☐ TODO |
| Tinkering tiles | 6 (Tinkeroids only) | effect of each; 3 for rounds 1-3, 3 for 4-6 `[NEED FROM BOARD]` (one shown p.13) | ☐ TODO |
| Power Rings | 6 (Moweyds only) | +2 power value to a structure (text p.13) | ☐ TODO |

## 8. Revised / Adjusted Base Components

| Component | Detail | Status |
|---|---|---|
| Adjusted Economy Research tile (double-sided) | levels 3 & 4 rewards, BOTH sides `[NEED FROM BOARD]` | ☐ TODO |
| Adjusted Lantids PI tile (double-sided) | solo/2p side AND 3p side exact values `[NEED FROM BOARD]` | ☐ TODO |
| Colonization overlay | covers Q.I.C. actions on Research board; defines protoplanet/asteroid terraform | ☐ TODO |
| Scoring Board Extension (double-sided) | 25-VP side / 3-shuttle side; +1 advanced tech slot | ☐ TODO |

## 9. Existing-Faction Changes  ⚠️ HIGHEST-RISK GAP

> Community sources (Paia Groject podcast) confirm Lost Fleet **changes** several base factions.
> Some changes are encoded ONLY in revised-component art / faction-summary art (p.16), not prose.
> Audit p.16 of the rulebook against the BASE-GAME faction boards to find every delta.

Confirmed-to-need-auditing (from podcast timestamps + rulebook text):
- Ivits — `[NEED FROM BOARD]` (start power: 2 Area I + 2 Area II per p.8; verify other deltas)
- Xenos — free action: spend 1 ore → 1 power Area III (text p.11); verify board deltas `[NEED FROM BOARD]`
- Gleens — special action incl. Explore (text p.11); verify `[NEED FROM BOARD]`
- Bescods — start with 3 knowledge (text p.8); verify `[NEED FROM BOARD]`
- Lantids — adjusted PI tile (§8) + income 1 power Area I (text p.8) `[NEED FROM BOARD]`
- Taklons / Nevlas / Itars / Bal T'aks — exploration-cost adjustments (text p.9, captured)
- ALL OTHER FACTIONS — diff each against p.16 art to confirm no silent change `[NEED FROM BOARD]`

## 10. Player Pieces (new colors: turquoise, pink)
Per new color: 8 mines, 4 trading stations, 3 research labs, 2 academies, 1 PI,
3 gaiaformers, 25 satellites, 7 player tokens. → `color-codes.ts` + viewer SVG. Status: ☐ TODO

## 11. Explicitly OUT OF SCOPE
- ☒ Automa / solo-bot (all components: Automa Spaceship tiles, Automa Terraforming board, etc.)
- ☒ Frontiers expansion exposure (code kept as reference; not offered alongside Lost Fleet)
