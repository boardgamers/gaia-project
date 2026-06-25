# Lost Fleet — Rules Clarifications & Derived Values

> **Purpose:** The single source of truth for every rule/value that is NOT stated plainly in the
> rulebook prose — values read off component artwork, inferred interactions, errata corrections,
> and judgment calls. A future Claude Code session should trust THIS file over re-deriving.
>
> **Rulebook version:** 1.0. **Errata checked against BGG:** ☑ CHECKED 2026-06-25 — see §K below.
> **Result: no official errata/FAQ document exists for Lost Fleet.** The v1.0 rulebook is authoritative.

## How to use this file
Every entry has:
- **Value/Rule** — the actual answer
- **Source** — one of: `RULEBOOK-TEXT p.N` | `BOARD-ART <component>` | `ERRATA <link>` | `COMMUNITY <link>` | `OUR-RULING`
- **Confidence** — `CONFIRMED` (read directly / official) | `INFERRED` (reasoned, unverified) | `TODO` (placeholder, needs filling)

When you read a value off the physical game, replace the placeholder, set Source = `BOARD-ART`,
and Confidence = `CONFIRMED`.

---

## A. ARCHITECTURE DECISIONS (locked)

- **A1. Expansion model.** Lost Fleet is its own expansion, NOT combinable with Frontiers.
  Keep Frontiers code in the repo as reference/reuse (ships, exploration, range helpers overlap).
  Source: `OUR-RULING`. Confidence: CONFIRMED.

  **LOCKED enum shape (approved 2026-06-25, repo-verified against `engine/src/enums.ts`):**
  ```ts
  export enum Expansion {
    // 1 was the old spaceships expansion
    None = 0,
    Frontiers = 2,                 // value UNCHANGED — keeps recorded-game fixtures (serialize "2") valid
    LostFleet = 4,                 // new, a distinct bit so it can never collide with a Frontiers check
    All = Frontiers | LostFleet,   // = 6 — "all content" sentinel for `.values()` enumeration ONLY,
                                   //         never a valid game-config selection
  }
  ```
  Verified facts that shaped this:
  - Current real enum is `None=0, Frontiers=2, All=2` (NOT `All=2` as additive — `All` aliases Frontiers).
  - **`Expansion.All` is used in 8 sites** (`player-data.ts`, `faction-boards/types.ts`, viewer charts,
    `available/ships.ts`, old-ui) as a "give me every value incl. expansion content" argument to the
    `Xxx.values(expansions)` filter helpers. It therefore **cannot be dropped**; it is redefined as
    `Frontiers | LostFleet = 6` so it means "all content" once LostFleet content is added.
  - The `.values()` filter helpers and game-config checks currently use **strict equality**
    (`expansions === Expansion.Frontiers`) — ~12 such sites (9 in `enums.ts`, plus `research-tracks.ts`,
    `available/buildings.ts`, viewer `ResearchTile.vue`, `Rules.vue`). To make `All=6` include BOTH
    expansions' content, **migrate these to bitwise** `(expansions & Expansion.Frontiers) !== 0`, and add
    parallel `(expansions & Expansion.LostFleet)` branches for new content. Because values are
    bit-disjoint (2 vs 4), a real single-selection game config (`expansions = Frontiers` only) still
    behaves correctly under bitwise checks, and `LostFleet & Frontiers === 0` (no false matches).
  - Add a `hasExpansion(expansions, exp)` helper = `(expansions & exp) !== 0` to centralize the bitwise
    test (makes the find-replace migration clean and keeps intent readable). Now justified (not optional).
  - **Mutual exclusivity** is enforced at game init: the selected `expansions` config must be exactly one
    of `None` / `Frontiers` / `LostFleet`; `All` is rejected as a config value (it is enumeration-only).
  - Total migration surface: ~20 files touch `Expansion.*`; most are harmless `Expansion.All` enumeration
    sites that keep working; the strict-equality config checks are the ones to convert to bitwise.
  Source: `OUR-RULING` + repo verification. Confidence: CONFIRMED.

- **A2. Undo.** Players may undo freely WITHIN their own turn. A turn is committed (and synced to
  others) only when the full turn completes — mirrors existing `self-contained.ts` "save only if a
  full turn was done." Source: `OUR-RULING`. Confidence: CONFIRMED.

- **A3. No Automa / no solo.** Source: `OUR-RULING`. Confidence: CONFIRMED.

- **A4. No-home-planet factions.** The 4 new factions have no home planet. `factions.ts`
  `oppositeFaction()` / `factionPlanet()` assume a home planet exists. Needs a guarded code path so
  setup, terraforming-cost, and faction-pairing logic don't break. Source: `RULEBOOK-TEXT p.7`.
  Confidence: CONFIRMED (rule), INFERRED (code impact).

---

## B. NEW FACTION VALUES  (fill from faction boards + p.16)

### B1. Tinkeroids — start planet: Asteroid
- Starting resources (one-time): **2k, 4o, 15c, 1q** + **1 step Science track**.
  → engine income[0] ≈ `"2k,4o,15c,q,up-sci"`.
- Recurring base income (income[1]): **+1k, +1o** → `"+o,k"`.
- Starting power: **Area I = 4, Area II = 2** (`power.area1=4, area2=2`).
- Planetary Institute income: **+4pw, +1 token(B1)** (standard) → `["+4pw","+t"]`.
- TS/RL/AC incomes: standard (TS +3/4/4/5c, RL +k+tech, AC1 +2k, AC2 =>q). No building-cost deltas.
- Source: `COMMUNITY (faction-overview PDF, pp.1-2 table; base-faction rows in same table match known
  base values → high trust)`. Confidence: **CONFIRMED** (owner-verified 2026-06-25: 2k start + 4/2 power split).
- Terraform: 3 steps for 3 base planet types, 1 step for others; set after faction selection via
  the Moweyds/Tinkeroids Terraforming board. Gaia planet habitable = 2 Q.I.C. Source: `RULEBOOK-TEXT p.13`. CONFIRMED.
- Starts with Planetary Institute (not mines), placed in stage 2. Source: p.13. CONFIRMED.
- 6 Tinkering tiles (3 for rounds 1-3, 3 for 4-6); PI: once/round use current Tinkering tile as action.
  Individual tile effects: `TODO [BOARD-ART tinkering tiles]` (only the 1-free-terraform tile shown p.13).

### B2. Darkanians — start planet: Asteroid
- Starting resources (one-time): **3k, 7o, 15c, 1q** + **1 step Navigation AND 1 step Economy**.
  → engine income[0] ≈ `"3k,7o,15c,q,up-nav,up-eco"`. (Note: 7 ore is unusually high — confirm.)
- Recurring base income: **+1k, +1o** → `"+o,k"`.
- Starting power: **Area I = 4, Area II = 2**.
- PI income: **+4pw, +1 token(B1)** (standard). TS/RL/AC standard; no cost deltas.
- Source: `COMMUNITY (faction-overview PDF table)`. Confidence: **CONFIRMED** (owner-verified 2026-06-25)
  (esp. 7 ore start + the two research advances Nav+Eco).
- Starts with 1 mine (stage 2). Standard planet = 1 terraform step. Gaia habitable = 2 Q.I.C.
  Source: p.13. CONFIRMED.
- PI: first time colonizing in a Space/Deep Space sector, gain 2c + 1k. Interspace tiles ≠ sectors.
  Source: p.13. CONFIRMED.

### B3. Moweyds — start planet: Protoplanet
- Starting resources (one-time): **5k, 6o, 15c, 2q** + **1 step Gaiaforming track**.
  → engine income[0] ≈ `"5k,6o,15c,2q,up-gaia"`. (High start — compensates 1-mine + 0-VP protoplanet.)
- Recurring base income: **+1k, +1o** → `"+o,k"`.
- Starting power: **Area I = 4, Area II = 4**.
- PI income: **+4pw, +1 token(B1)** (standard). TS/RL/AC standard; no cost deltas.
- Source: `COMMUNITY (faction-overview PDF table)`. Confidence: **CONFIRMED** (owner-verified 2026-06-25)
  (esp. 5k / 6o / 2q start — notably generous).
- Starts with 1 mine (stage 2) AND an Exploration Shuttle already on T F Mars. 3 steps for 3 base
  planet types, 1 for others (Terraforming board). Source: p.13. CONFIRMED.
- PI: once/round place a Power Ring (action) on a planet with your building; +2 power value there.
  6 Power Rings available. Source: p.13. CONFIRMED.

### B4. Space Giants — start planet: Protoplanet
- Starting resources (one-time): **3k, 6o, 15c, 1q** + **1 step Navigation track**.
  → engine income[0] ≈ `"3k,6o,15c,q,up-nav"`.
- Recurring base income: **+1k, +1o** → `"+o,k"`.
- Starting power: **Area I = 4, Area II = 4**.
- **PI income: +6pw, +1 token(B1)** — NOTE: +6 power, not the standard +4. → `["+6pw","+t"]`.
  TS/RL/AC standard; no cost deltas.
- Source: `COMMUNITY (faction-overview PDF table)`. Confidence: **CONFIRMED** (owner-verified 2026-06-25)
  (esp. the +6-power PI income — only non-standard building value among the 4 new boards).
- Starts with 1 mine (stage 2). Standard planet = 2 terraform steps. Has a "Build a Mine" action
  with 2 free terraform steps on the Exploration board. Gaia habitable = 2 Q.I.C. Source: p.13. CONFIRMED.
- PI: immediately take 1 tech tile of choice (Upgrade rules apply); once only. Source: p.13. CONFIRMED.

### B5. Moweyds/Tinkeroids Terraforming board
- 7 spaces filled randomly with 1 satellite of each color at setup; determines which 3 base planet
  types cost 3 steps. Full setup procedure: Source: `RULEBOOK-TEXT p.8`. CONFIRMED.
- Exact board layout / space numbering: `TODO [BOARD-ART terraforming board]`.

---

## C. SPACESHIP BOARDS  (fill from the 4 spaceship boards)

For each ship, capture every action space: {type, cost, effect, grid-position} and tech-slot count.

> **Partial read from faction-overview PDF p.3** (the 4 ship boards are pictured). I can read each
> action tile's COST HEADER fairly reliably; the EFFECTS are small and need board confirmation.
> Provisional color→type mapping (confirm): **green = Q.I.C. action, purple = Power action,
> blue = Knowledge action, yellow = Credit action.** Each cost header shows power as a purple disc and
> any additional resource as a small shield/disc beside it. Source for all C1–C4 below:
> `BOARD-ART (overview scan p.3)`. Confidence: **INFERRED — confirm costs + effects on physical ships.**

### C1. Twilight (Nautilaks)
- Tile 1 (green): cost **3 Q.I.C.** → effect = "Gain a Tech Tile" (matches rulebook p.13: that action
  costs 3 Q.I.C.; take Standard Tech from a ship if you have a shuttle there).
- Tile 2 (purple): cost **3 power + 2 knowledge** → advance 1 research level (matches p.13).
- Tile 3 (blue): cost **1 knowledge** → **+3 Range** action (matches p.13: "+3 Range" costs 1 knowledge).
- Plus **artifact slots** (the asteroid-cluster art) — artifacts seed here; "Examine Artifact" = discard
  6 power → 1 artifact (D4). Number of artifact slots: `TODO [confirm count vs player count]`.
- Standard-tech slots (2 or 3): `TODO [confirm]`.

### C2. Rebellion (Vo'Kron)  — excluded in 2p
- Tile 1 (green): cost **3 Q.I.C.**.  Tile 2 (purple): cost **3 power + 1 knowledge**.
  Tile 3 (blue): cost **2 knowledge**. Effects: `TODO [confirm on board]`.
- Standard-tech slots: `TODO`.

### C3. T F Mars (Gaia Federation)
- Tile 1 (green): cost **2 Q.I.C.** → effect appears terraform/build related (shows "2" + "1") —
  likely "Build a Mine w/ 2 free terraform steps, pay 1 ore for a 3rd". `TODO confirm`.
- Tile 2 (purple): cost **2 power** → "Start a Gaia Project / transform transdim→Gaia" (green-planet
  icon; matches p.13). Tile 3 (yellow): cost **2 (credit action)** → gain resources / build-related.
  `TODO confirm effects`.
- Standard-tech slots: `TODO`.

### C4. Eclipse (Eridani Empire)
- Tile 1 (green): cost **2 Q.I.C.**.  Tile 2 (purple): cost **3 power + 2 (blue)**.
  Tile 3 (yellow): cost **2 (credit action)**. Effects: `TODO [confirm on board]`.
- Standard-tech slots: `TODO`.

### C5. Shuttle-space charge values
- Charge power gained when placing a shuttle on space N (1-5), if not first to explore: `TODO [BOARD-ART]`
- (Example from p.9: space 2 charges 2 power.)

---

## D. EXPLORATION ACTION (rules captured; values partial)

- D1. Explore: target spaceship tile must be in range from a colonized planet; Q.I.C./special can
  extend range. Need a shuttle on your Exploration board; never more than 1 shuttle per ship.
  Place on lowest-numbered free space; charge as shown unless first explorer. Source: p.9. CONFIRMED.
- D2. Deploy cost: usually 5 VP. Bal T'aks 7 VP. Taklons also move Brainstone to Gaia Area.
  Nevlas & Itars also discard 1 power to supply. Source: p.9. CONFIRMED.
- D3. A ship is EXPLORED, not colonized — range never measured from a ship. Source: p.9. CONFIRMED.
- D4. Examine Artifact (Twilight only): discard 6 power (any of Areas I/II/III) → gain 1 artifact.
  Source: p.9. CONFIRMED.
- D5. Per-faction shuttle deploy cost (Exploration board, lower-left): `TODO [BOARD-ART per faction]`.

---

## E. BASE-ACTION CHANGES (captured)

- E1. Build a Mine — Protoplanet: 3 terraform steps, +6 VP on mine (0 if it's your start planet).
  Source: p.10. CONFIRMED.
- E2. Build a Mine — Asteroid: needs an available Gaiaformer; Gaiaformer is consumed (placed on
  overlay, unusable rest of game); no 1o+2c build cost paid. Source: p.10. CONFIRMED.
- E3. Form a Federation — may NOT place a satellite on a spaceship tile. Explored ships with a
  remaining fed token grant it when you form a federation. Source: p.10. CONFIRMED.
- E4. Power/Q.I.C. actions — the Research-board Q.I.C. actions are COVERED by the overlay and
  unavailable; ship actions replace them (incl. new Knowledge & Credit action types). Source: p.10. CONFIRMED.
- E5. Upgrade — explored ships offer extra Standard Tech; taking it advances 1 research level.
  Source: p.10. CONFIRMED.
- E6. Advanced Tech via Scoring Board Extension: the +1 advanced tech ignores the level-4/5
  requirement; instead requires ≥25 VP OR explored 3 ships (3-4p only). Other 2 conditions unchanged.
  Source: p.10. CONFIRMED.

## F. RESEARCH TRACK CHANGES

- F1. Adjusted Economy track — levels 3 & 4 income, BOTH tile sides: `TODO [BOARD-ART economy tile]`.
  (Base + Frontiers economy strings are in `research-tracks.ts` for reference.)
- F2. No new research track is added (unlike Frontiers' Diplomacy). Confirm. Source: INFERRED. TODO verify.

## G. TILES — EXACT EFFECTS

- G1. New Standard Tech tiles (12 = 4×3 types): the 3 types are described p.13-15. Exact effect of
  each + confirm 3 distinct types × 4: `TODO [BOARD-ART standard tech tiles]`.
- G2. New Advanced Tech (6): effects partly p.15. Exact 6: `TODO [BOARD-ART]`.
- G3. Round Boosters (4): income (1o / 3c / 2pw) + pass bonus. Text p.14 lists all four — transcribe
  & verify against tiles: `TODO [verify BOARD-ART]`.
- G4. Round Scoring (3) + Final Scoring (3): text p.14-15. Transcribe exactly: mostly CONFIRMED, verify icons.
- G5. New Federation tokens (8): effects p.15 (partial). Which carry the green side: `TODO [BOARD-ART]`.
- G6. Artifacts (13): types listed p.15; count of each among 13 tokens: `TODO [BOARD-ART artifact tokens]`.

## H. MAP / SETUP

- H1. Shifted-sector layouts for 2/3/4p (offset placement, 6/holes, interspace + deep-space): p.4-5. CONFIRMED (procedure).
- H2. Deep Space sector planet layouts (8 tiles, 2 sides each): `TODO [BOARD-ART deep space tiles]`.
- H3. Interspace tile contents per player-count set (30 in 4 sets): `TODO [BOARD-ART interspace tiles]`.
- H4. Revised Space Sector tile planet layouts: `TODO [BOARD-ART revised sectors]`.
- H5. "Most asteroids" final scoring needs ≥6 asteroids in play (flip Deep Space tile 16 if not). p.4. CONFIRMED.

## I. EXISTING-FACTION DELTAS  ⚠️ audit p.16 vs base boards
- I1. Ivits: start 2 power Area I + 2 Area II (p.8). Other deltas: `TODO [BOARD-ART p.16]`.
- I2. Lantids: +1 power Area I income; adjusted PI tile (solo/2p vs 3p sides): `TODO [BOARD-ART]`.
- I3. Bescods: start 3 knowledge (p.8). Other deltas: `TODO [BOARD-ART]`.
- I4. Xenos: free action 1o→1pw(AreaIII) (p.11). Board deltas: `TODO [BOARD-ART]`.
- I5. Gleens: special action incl. Explore +2 range (p.11). Board deltas: `TODO [BOARD-ART]`.
- I6. Every other faction: diff vs p.16 to catch silent changes: `TODO [BOARD-ART p.16 full audit]`.
- **I7. Audit source acquired:** the faction-overview PDF (pp.1-2) tabulates **full starting conditions
  for all 18 factions** (buildings, power B1/B2, resources, starting research, basic income, TS/PI/RL/AC
  incomes, shuttle cost, special ability). Its base-faction rows match known base values, so it can be
  diffed to find LF deltas. Captured from it (Source: `COMMUNITY overview`, Confidence INFERRED —
  confirm vs board):
  - **Lantids**: power **4/0**; start credits **13c** (not 15c) — **owner-confirmed 2026-06-25**;
    basic income gains **+1 power(B1)** (the LF adjustment, matches p.8). PI income standard +4pw.
  - **Ivits**: power **2/2** (matches p.8).  **Bescods**: starts **3k** + inverted-research income line
    (Bescods-specific).  **Itars**: basic income includes **+1 power(B1)**; AC1 **+3k** (Itars-specific).
  - **Xenos**: PI income **+1 Q.I.C.**; free action **1o→1pw(area III)** (p.11).
  - **Gleens**: special action with **+2 range** (p.11); PI income **+1 ore**.
  - **Bal T'aks**: power 2/2; start **0 q**; shuttle deploy **7 VP** (matches p.9).
  - Full per-faction numbers are in `rulebook-v1.0.txt` companion + the overview; transcribe remaining
    rows into code when building base-faction LF variants.

## J. MULTIPLAYER / SYNC RULINGS
- J1. Turn commitment: only completed turns persist + broadcast (ties to A2 undo). OUR-RULING. CONFIRMED.
- J2. Leech/charge-power interrupts: another player may owe a charge decision mid-turn. The sync
  layer must surface "who can act now" from the engine's available-commands, not assume strict
  sequential turns. Source: OUR-RULING / engine behavior. CONFIRMED (need), INFERRED (impl).
- J3. Seed fixed at game creation, stored, never regenerated (engine is deterministic from seed +
  moves). OUR-RULING. CONFIRMED.
- J4. Notifications: email on turn-change (works everywhere). PWA push optional later — note iOS
  requires installed PWA (iOS 16.4+) so email is the reliable default. OUR-RULING. CONFIRMED.

## K. ERRATA CHECK LOG (2026-06-25)

- **K1. No official errata/FAQ document exists for Lost Fleet.** Capstone's official product page links
  exactly one rules file, `GP_Exp_Rule_EN_V1_Web.pdf` (the v1.0 rulebook already in this repo) — no separate
  errata or FAQ. The "Gaia FAQ and Errata" file on BGG (filepage 155926) is dated Feb 2018, predates Lost
  Fleet by 6 years, and is base-game only. **The v1.0 rulebook prose is authoritative.**
  Source: `ERRATA` (negative result) — https://capstone-games.com/products/gaia-project-the-lost-fleet
  Confidence: CONFIRMED.
- **K2. Lost-Fleet corrections exist only as BGG community forum threads** (not official errata, and BGG
  blocks automated fetch with HTTP 403, so they must be read by a human). Threads to review and, if a
  ruling is found, record with `COMMUNITY` source (NOT `ERRATA`):
  - "Confusing things after first reading" — https://boardgamegeek.com/thread/3278038
  - "Geodens' Planetary Institute and Protoplanets/Asteroids" — https://boardgamegeek.com/thread/3354496
    (directly relevant to §I: does an existing per-planet-type bonus fire on the 2 new planet types?)
  - "How The Lost Fleet affects Gaia Project's design" — https://boardgamegeek.com/thread/3353396
  - "Another Update from Feuerland" — https://boardgamegeek.com/thread/3253233
  Status: ☐ awaiting human review (owner has BGG access).
- **K3.** Confirmed from rulebook prose (so `RULEBOOK-TEXT`, not errata): the "Gain VP for Planet types"
  Q.I.C. action base is reduced to **2** points (p.13), because there are now more planet types.

---

## OPEN QUESTIONS / TODO BEFORE CODING
1. ☑ Check BGG errata thread; record any corrections here with `ERRATA` source. → DONE: no official
   errata exists (§K1). Remaining: human review of community threads (§K2).
2. ☐ Fill all `TODO [BOARD-ART]` placeholders from the physical game.
3. ☑ Decide final `Expansion` enum restructure shape (A1) before touching enums.ts. → LOCKED, see §A1.
4. ☐ Confirm no new research track (F2).
5. ☐ Complete the p.16 existing-faction audit (section I).
