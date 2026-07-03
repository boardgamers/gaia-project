# Lost Fleet — Rules Clarifications & Derived Values

> **Purpose:** The single source of truth for every rule/value that is NOT stated plainly in the
> rulebook prose — values read off component artwork, inferred interactions, errata corrections,
> and judgment calls. A future Claude Code session should trust THIS file over re-deriving.
>
> **Rulebook version:** 1.0. **Errata checked against BGG:** ☑ CHECKED 2026-06-25 — see §K below.
> **Result: no official errata/FAQ document exists for Lost Fleet.** The v1.0 rulebook is authoritative.

## How to use this file
Every entry has:
- **Value/Rule** — the actual answer (the effect text)
- **Source** — one of: `RULEBOOK-TEXT p.N` | `BOARD-ART <component>` | `ERRATA <link>` | `COMMUNITY <link>` | `OUR-RULING`
- **Confidence** — `CONFIRMED` (read directly / official) | `INFERRED` (reasoned, unverified) | `TODO` (placeholder, needs filling)
- **Depiction** — how the viewer will render this component, in our own SVG style (see below).
  Required for every component-type entry (tiles, tokens, boards); not needed for pure numeric/
  text rules that have no physical card.

When you read a value off a physical/rendered component, replace the placeholder, set Source =
`BOARD-ART <component name/seed>` (a text pointer to *where* it was confirmed, never the image
file itself — see "Art policy" below), and Confidence = `CONFIRMED`.

### Art policy: original image vs. our depiction
We never commit official Lost Fleet artwork (scans, randomizer screenshots, photos) into this
repo — copyrighted third-party game art, and the project already keeps everything else
text-only (see `PROGRESS.md` "Done so far" #1: "no third-party art committed"). Source images are
a *reference used once to derive the rule and the depiction*, then discarded — only the derived
text (effect + depiction plan) is kept here. Concretely, each component-type entry has three parts:
1. **Original component** — identified by name (Source line), not stored as a file.
2. **Depiction** — how it's drawn in the viewer, reusing existing house style/components instead of
   replicating scanned art (already the stated viewer principle for Lost Fleet — see `PROGRESS.md`
   "Build order" #2). E.g. "icon row like `ResearchTile.vue`'s tech-content slot, new federation-gold
   border" rather than a redrawn version of the physical tile's background art.
3. **Value/Rule** — the actual game-mechanical effect, in engine-implementable terms.

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

- **A4. No-home-planet factions.** The 4 new factions have no home *terrain* planet (they start on
  Asteroid/Protoplanet). **Same-color exclusivity still applies (owner-confirmed 2026-06-27): only one
  faction per color per game, exactly like the base game.** The 4 new factions form 2 color pairs —
  Tinkeroids↔Darkanians (Asteroid/turquoise) and Moweyds↔Space Giants (Protoplanet/pink) — and are
  mutually exclusive within each pair. Implementation: give each its shared planet in the `factions.ts`
  map so the existing `oppositeFaction()` pairing enforces this unchanged. The ONLY thing to guard is
  terraform cost: `factionPlanet()` feeds `terraformingStepsRequired()`, whose planet-cycle math is
  meaningless for these factions (their cost is a flat/board rule, §B2/B4/B5) — so the terraform path,
  not the pairing path, needs the guarded branch. Source: `RULEBOOK-TEXT p.7` + `OUR-RULING`
  (same-color exclusivity). Confidence: CONFIRMED.

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
- Terraform: 3 steps for the "cost-3" base colors, 1 step for all others; the cost-3 set is
  determined at setup via the Moweyds/Tinkeroids Terraforming board (see revised §B5).
  **Gaia planet: a mine costs the normal 1 Q.I.C. — NOT 2** (corrected 2026-06-27; only Darkanians &
  Space Giants pay the 2-Q.I.C. Gaia surcharge, see §B2/§B4). Source: `RULEBOOK-TEXT p.13` + owner
  2026-06-27. CONFIRMED.
- Starts with Planetary Institute (not mines), placed in stage 2. Source: p.13. CONFIRMED.
- 6 Tinkering tiles (3 for rounds 1-3, 3 for 4-6); PI: once/round use current Tinkering tile as action.
  Individual tile effects, all confirmed (owner board-read 2026-06-27):
  - **Rounds 1-3** (one of these 3 is the active Tinkering tile each round): (1) terraform 1 step free;
    (2) charge 4 power; (3) gain 1 Q.I.C.
  - **Rounds 4-6:** (1) terraform 3 steps free; (2) gain 3 knowledge; (3) gain 2 Q.I.C.
  - Source: `BOARD-ART tinkering tiles` (owner board-read 2026-06-27). Confidence: CONFIRMED.

### B2. Darkanians — start planet: Asteroid
- Starting resources (one-time): **3k, 7o, 15c, 1q** + **1 step Navigation AND 1 step Economy**.
  → engine income[0] ≈ `"3k,7o,15c,q,up-nav,up-eco"`. (Note: 7 ore is unusually high — confirm.)
- Recurring base income: **+1k, +1o** → `"+o,k"`.
- Starting power: **Area I = 4, Area II = 2**.
- PI income: **+4pw, +1 token(B1)** (standard). TS/RL/AC standard; no cost deltas.
- Source: `COMMUNITY (faction-overview PDF table)`. Confidence: **CONFIRMED** (owner-verified 2026-06-25)
  (esp. 7 ore start + the two research advances Nav+Eco).
- Starts with 1 mine (stage 2). **Standard (terrain) planet = a flat 1 terraform step**, any color.
  **Gaia planet: a mine costs 2 Q.I.C. instead of the base 1** — a faction-specific surcharge on the
  mine-on-Gaia cost (maps to `gaiaFormingCost()` in `player.ts`, which is already faction-aware for
  Gleens). The gaiaforming PROJECT cost (converting transdim→Gaia) is untouched. Owner-confirmed
  2026-06-27. Source: p.13 + owner. CONFIRMED.
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
- Starts with 1 mine (stage 2) AND an Exploration Shuttle already on T F Mars. Terraform: 3 steps for
  the "cost-3" base colors, 1 step for all others; cost-3 set determined at setup via the Terraforming
  board (see revised §B5). **Gaia planet: a mine costs the normal 1 Q.I.C. — NOT 2** (corrected
  2026-06-27; only Darkanians & Space Giants pay the 2-Q.I.C. Gaia surcharge). Source: p.13 + owner
  2026-06-27. CONFIRMED.
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
- Starts with 1 mine (stage 2). **Standard (terrain) planet = a flat 2 terraform steps**, any color.
  Has a "Build a Mine" action with 2 free terraform steps on the Exploration board. **Gaia planet: a
  mine costs 2 Q.I.C. instead of the base 1** (same faction-specific mine-on-Gaia surcharge as
  Darkanians, §B2 — maps to `gaiaFormingCost()`; gaiaforming project cost untouched). Owner-confirmed
  2026-06-27. Source: p.13 + owner. CONFIRMED.
- PI: immediately take 1 tech tile of choice (Upgrade rules apply); once only. Source: p.13. CONFIRMED.

### B5. Moweyds/Tinkeroids Terraforming board — cost-3 color selection (REVISED 2026-06-30, owner-confirmed)
Determines which base planet colors cost 3 terraform steps (vs. 1 for all others) for these two
no-home-planet factions. **This is NOT a blind random draw** (corrects the earlier description).
Source: `RULEBOOK-TEXT p.8` + owner clarifications 2026-06-27 and 2026-06-30. Confidence: CONFIRMED.
- **There are always exactly 3 base colors that cost 3 steps; every other base color costs 1 step.**
- **Opponents' home colors always cost 3, and take priority.** Terraforming toward any color that is
  another player's faction home color costs 3 steps. (An opponent that is itself a no-home-planet
  faction — e.g. the *other* new faction in the game — contributes NO color, so the count of
  color-bearing opponents can be fewer than playerCount−1.)
- The remaining cost-3 slots (to always reach exactly 3) are filled from the random setup layout:
  - **4 players:** the 3 color-bearing opponents normally already supply all 3 → no random fill.
  - **3 players:** ~2 opponents' colors + 1 filled from the setup layout.
  - **2 players:** 1 opponent's color + 2 filled from the setup layout.
  (If a new-faction opponent reduces the color-bearing-opponent count, proportionally more slots are
  filled from the layout — the invariant is simply "exactly 3 cost-3 colors total.")
- **Random-fill procedure (owner-resolved 2026-06-30):** at setup the 7 base colors are placed on the
  board in a random order (one satellite of each color, p.8). After assigning/removing the mandatory
  opponent colors, scan that randomized 7-color row **left to right** and take the next remaining colors
  that are **not already another player's home color** until the board reaches exactly 3 cost-3 colors.
  If both Tinkeroids and Moweyds are in the game, the duplicate cubes exist only so both players can
  remove the mandatory opponent colors first; the remaining filler colors are then taken left-to-right
  in turn order from what remains on the shared row.
- **Engine implications:** this is stateful and per-GAME (not precomputable per faction) — the cost-3
  set depends on which other factions are in the game. `terraformingStepsRequired` for Tinkeroids/
  Moweyds must therefore consult this per-game cost-3 set + the target planet's color, not the base
  planet-cycle math (see PROGRESS.md Integration flag 1). Belongs to Chunk 3 (new-faction setup).

---

## C. SPACESHIP BOARDS  (fill from the 4 spaceship boards)

For each ship, capture every action space: {type, cost, effect, grid-position} and tech-slot count.

Each ship has exactly 3 action tiles: 1 Q.I.C.-cost action, 1 Power-cost action, and a 3rd that's
either a Knowledge-cost action (Twilight, Rebellion) or a Credit-cost action (T F Mars, Eclipse).
Color→type mapping CONFIRMED: **green = Q.I.C. action, purple = Power action, blue = Knowledge action,
yellow = Credit action.** Source for C1–C4 effects/costs below: owner board-read 2026-06-27. CONFIRMED.

### C1. Twilight (Nautilaks)
- Q.I.C. action: 3 Q.I.C. → re-score (re-trigger) a Federation token you already own (same mechanic as
  the base game's federation re-scoring / the Federation-token-shaped Artifact, G6).
- Power action: 3 power (Area III) + 2 ore → build a Research Lab.
- Knowledge action: 1 knowledge → +3 Range, usable for Build a Mine, Gaiaforming, or Exploring a ship.
- Plus **artifact slots** (the asteroid-cluster art) — artifacts seed here; "Examine Artifact" = discard
  6 power (any of Areas I/II/III) → 1 artifact (D4). **Artifact slot count = number of players.**
  Source: `RULEBOOK-TEXT` p.6: "Take as many Artifact tokens at random as there are players. Place the
  tokens face up on the corresponding spaces on the Twilight spaceship." (remaining tokens return to
  the box). Owner-confirmed 2026-06-27. CONFIRMED.
- Standard-tech slots: **0 — Twilight never gets a Standard Tech tile slot.** Only Rebellion, T F Mars,
  and Eclipse have one each; see the assignment note under C4. Source: `RULEBOOK-TEXT` p.6 (solo-mode
  setup names exactly those 3 ships for tile placement, omitting Twilight) + owner-confirmed
  2026-06-27. CONFIRMED.

### C2. Rebellion (Vo'Kron)  — excluded in 2p
- Q.I.C. action: 3 Q.I.C. → claim a Tech tile (same as the base game's "take a tech tile" Q.I.C. action).
- Power action: 3 power + 1 ore → build a Trading Station, ignoring the normal adjacency-to-a-mine
  requirement.
- Knowledge action: 2 knowledge → gain 2 credits + 1 Q.I.C.
- Standard-tech slots: 1 — randomly filled at setup with one of the 3 new Standard Tech tile types
  (see the assignment note under C4). Excluded entirely in 2p (ship not in play). Source:
  `RULEBOOK-TEXT` p.6. CONFIRMED.

### C3. T F Mars (Gaia Federation)
- Q.I.C. action: 2 Q.I.C. → gain 2 VP + 1 VP per Tech tile you have.
- Power action: charge 2 power → perform the Instant Gaiaforming action (same mechanic as the
  "instant" Round Booster, G3: start a Gaia Project on a transdim planet in range without moving
  power tokens into the Gaia Area, then immediately transform that planet into Gaia. A Gaiaformer is
  still required and occupies the planet until you later build a Mine there, at which point it
  returns for reuse in the same round).
- Credit action: 3 credits → terraform 1 step. The mine itself and any further terraforming steps
  still cost their normal building/ore price — the 3 credits replace only the ore cost of the first
  step (owner-confirmed 2026-06-28: "the 3 coins only covers 1 terraforming step. You still have to
  pay for the mine itself and any additional terraforming steps").
- Standard-tech slots: 1 — same mechanism, see the assignment note under C4. Source: `RULEBOOK-TEXT`
  p.6. CONFIRMED.

### C4. Eclipse (Eridani Empire)
- Q.I.C. action: 2 Q.I.C. → gain 2 VP + 1 VP per planet type colonized.
- Power action: 3 power + 2 knowledge → advance 1 level on any Research track of your choice.
- Credit action: 6 credits → place a Mine on an Asteroid under normal range rules; the mine itself is
  free (the 6 credits is the entire cost — distinct from the standard Asteroid-mine route in E2, which
  instead requires consuming a Gaiaformer and waives the normal build cost).
- Standard-tech slots: 1 — same mechanism. **Assignment mechanism (applies to C2–C4 collectively):**
  the box holds 4 copies each of the 3 new Standard Tech tile types (12 total), but only 3 are ever in
  play (1 of each type, matching G1) — shuffled and dealt at random, 1 tile per ship, onto Rebellion's
  / T F Mars's / Eclipse's single tech slot, so which specific ship gets which tile type varies by
  game. In 2p, Rebellion is removed (C2), so only 2 of the 3 drawn tiles get placed (T F Mars +
  Eclipse) and the 3rd is returned to the box unused. Source: `RULEBOOK-TEXT` p.6 ("Place the new
  Standard Tech tiles at random ... onto the corresponding 2 or 3 spots on the spaceships. If there
  are only 2 players, return the remaining Standard Tech tiles to the box.") + solo-mode setup (names
  exactly Rebellion/T F Mars/Eclipse). Owner-confirmed 2026-06-27 ("only 1 tech slot per ship... setup
  varies which ship has what"). CONFIRMED.
- **Federation-token setup distribution (separate from the Standard Tech assignment above; applies to
  all 4 ships, not just C2-C4) — transcribed verbatim from `rulebook-v1.0.txt` p.6, previously found
  but not yet quoted in this doc:** *"Take 4 of the new Federation tokens and distribute them on the 4
  spaceships at random. If there are 2 players, you will only be playing with 3 spaceships, so take 3
  of the new Federation tokens at random and place them onto those 3 spaceships. Return the remaining
  Federation tokens to the box."* So: 3-4p draws 4 of the 8 tokens (one per ship, all 4 ships incl.
  Twilight); 2p draws 3 of the 8 (one per ship, Rebellion excluded per C2); the rest go back in the box
  unused. CONFIRMED.

### C5. Shuttle-space charge values — CONFIRMED (owner board-read 2026-06-27)
- The Exploration track has **4 spaces per ship**, not 5 (corrects D1's earlier "5 spaces" guess).
  Never more than 1 shuttle per ship per player, so a ship caps out at 4 explorers.
- Space 1: no charge (whoever lands here is by definition the first explorer, per D1's exception).
  Space 2: charge 2 power. Space 3: charge 2 power. Space 4: charge 4 power.

---

## D. EXPLORATION ACTION (rules captured; values partial)

- D1. Explore: target spaceship tile must be in range from a colonized planet; Q.I.C./special can
  extend range. Need a shuttle on your Exploration board; never more than 1 shuttle per ship.
  Place on lowest-numbered free space (4 spaces total per ship, see C5); charge as shown unless first
  explorer. Source: p.9. CONFIRMED.
- D2. Deploy cost: usually 5 VP. Bal T'aks 7 VP. Taklons also move Brainstone to Gaia Area.
  Nevlas & Itars also discard 1 power to supply. Source: p.9. CONFIRMED.
- D3. A ship is EXPLORED, not colonized — range never measured from a ship. Source: p.9. CONFIRMED.
- D4. Examine Artifact (Twilight only): discard 6 power (any of Areas I/II/III) → gain 1 artifact.
  Source: p.9. CONFIRMED.
- D5. Per-faction shuttle deploy cost exceptions — RESOLVED, same 3 exceptions as D2, and confirmed
  exhaustive (no other faction has a board-printed deploy-cost exception beyond these 3): Bal T'aks
  pay 7 VP instead of 5; Taklons additionally move their Brainstone to their Gaia Area; Itars and
  Nevlas additionally discard 1 power token to the supply. Every other faction (incl. all 4 new Lost
  Fleet factions) pays a flat 5 VP, no extra cost. Source: `RULEBOOK-TEXT` p.9 (verbatim, "Action:
  Explore a Lost Fleet Spaceship"). Owner-confirmed 2026-06-27 ("that's it. For everyone else the cost
  is 5vp"). CONFIRMED.

---

## E. BASE-ACTION CHANGES (captured)

- E1. Build a Mine — Protoplanet: 3 terraform steps, +6 VP on mine (0 if it's your start planet).
  Source: p.10. CONFIRMED.
- E2. Build a Mine — Asteroid: needs an available Gaiaformer; Gaiaformer is consumed (placed on
  overlay, unusable rest of game); no 1o+2c build cost paid. Source: p.10. CONFIRMED.
- E3. Form a Federation — may NOT place a satellite on a spaceship tile. Explored ships with a
  remaining fed token grant it when you form a federation. **Owner-clarified 2026-06-27: the ship does
  NOT need to be adjacent to/part of the federation being formed — merely having it explored (a shuttle
  there) is sufficient to grant its fed token whenever you form any federation.** Source: p.10. CONFIRMED.
- E4. Power/Q.I.C. actions — the Research-board Q.I.C. actions are COVERED by the overlay and
  unavailable; ship actions replace them (incl. new Knowledge & Credit action types). Source: p.10. CONFIRMED.
- E5. Upgrade — explored ships offer extra Standard Tech; taking it advances 1 research level.
  Source: p.10. CONFIRMED.
- E6. Advanced Tech via Scoring Board Extension — the swap applies to exactly **ONE** Advanced Tech
  tile, not a change to the bonus-tech mechanism in general. At setup you take the double-sided Scoring
  Board Extension and place 1 randomly-drawn Advanced Tech tile onto it (p.5) — that single tile,
  whichever it turns out to be, is the only one affected. Confirms owner's elaboration on this part.
  - For that tile, the normal **1st** of the base game's 3 conditions for taking an Advanced Tech tile
    (player's marker at level 4 or 5 in the matching Research Area) is REPLACED by whichever side of
    the Extension is face up: side A = "≥25 VP", side B = "explored 3 of the 4 Lost Fleet spaceships."
  - **Side-selection rule — RESOLVED 2026-06-27 (owner ruling, `OUR-RULING`).** The rulebook states the
    rule twice (re-checked directly, not a column-merge/OCR artifact — both passages are clean,
    unambiguous text):
    - p.5, setup: *"Take the Scoring Board Extension. For 2 players, always use the side showing 25
      victory points. For 3 or 4 players, use the side showing 3 Exploration Shuttles. In later games,
      you can decide at random which side to use."*
    - p.10, the Advanced-Tech-conditions paragraph attached to "Action: Build a Mine" (NOT "Action:
      Upgrade Existing Structures" — that's a separate paragraph on the same physical page; corrects an
      earlier mis-citation): *"Instead, the conditions shown on the Scoring Board Extension are applied
      (either you have at least 25 victory points or have explored 3 different spaceships in the Lost
      Fleet; the latter condition only applies in 3- and 4-player games)."*
    Both passages agree with each other and tie side selection to player count by default: 2p always
    uses the 25-VP side; 3-4p default to the ships-explored side, with randomization offered only as an
    optional "in later games" house option for 3-4p. **Owner's final call: keep the printed 2p rule as-is
    (always forced to the 25-VP side), but for 3-4p, always randomize the side from game 1 onward**
    (exercising the rulebook's own "decide at random" option every game, rather than defaulting to the
    ships side with optional later randomization). This is now the engine's locked behavior — no conflict
    remains; this was never a misprint, just a digital house-rule choice to apply the rulebook's own
    randomization option unconditionally for 3-4p.
  - **Engine rule, final:** 2 players → side is always "25 VP." 3 or 4 players → side is chosen uniformly
    at random (50/50) at setup, every game.
  - The **2nd** condition (flip an owned, unflipped Federation token) and **3rd** condition (cover an
    owned Standard Tech tile in the matching Research Area with this Advanced Tech tile) are
    UNCHANGED — confirms owner's "AND also have a fed token" framing. Reaching level 4/5 on ANY
    research track is irrelevant for this one tile, exactly as owner stated.
  - Net gate for this one tile (pending the side-selection resolution above): (≥25 VP, or — in 3-4p,
    by default — explored 3 of 4 ships) AND flip an unflipped Federation token AND cover a matching
    Standard Tech tile. The other 5 Advanced Tech tiles in the game are still taken under the normal,
    unmodified 3-condition rule.
  Source: `RULEBOOK-TEXT` p.5 (setup/side selection) + p.10 (Advanced-Tech-conditions paragraph) +
  `OUR-RULING` (3-4p always-random side selection, owner-confirmed 2026-06-27).
  Confidence: CONFIRMED.

## F. RESEARCH TRACK CHANGES

- F1. Adjusted Economy track — levels 3 & 4 income, BOTH tile sides. Source: `BOARD-ART economy tile`
  (owner-read 2026-06-27 — corrects an earlier icon-only guess that had levels 3 and 4 swapped).
  Confidence: CONFIRMED.
  - **Side "pw" (power-charge side):** Level 3 = 1 ore + 2 credits + charge 3 power. Level 4 = 2 ore +
    2 credits + charge 2 power.
  - **Side "vp" (flat-VP side):** Level 3 = 1 ore + 3 credits + 1 VP. Level 4 = 2 ore + 4 credits + 1 VP.
  - One side is placed at random at setup, covering the base game's level-3/4 income symbols on the
    Economy research track. Source: `RULEBOOK-TEXT` (placement only, not the reward values). CONFIRMED.
  (Base + Frontiers economy strings are in `research-tracks.ts` for reference.)
- F2. No new research track is added (unlike Frontiers' Diplomacy) — Lost Fleet only modifies the
  existing Economy track via the F1 overlay tile, it doesn't add a 7th track. Owner-confirmed 2026-06-27.
  CONFIRMED.

## G. TILES — EXACT EFFECTS

- G1. New Standard Tech tiles seeded on spaceship boards (3 distinct types; the rulebook's "4 copies
  each" is just spare-reprint count — only 1 of each type is ever in play at a time, see COMPONENTS.md
  §3/§7). All 3 confirmed:
  - **Range tile:** "Your basic range increases by 1 for the rest of the game, as long as the tile is
    not covered by an Advanced Tech tile." Source: `RULEBOOK-TEXT` Appendix V. CONFIRMED.
  - **Terraform tile:** "Immediately and only once receive a 'Build a Mine' action with up to 2 free
    terraforming steps and without paying the cost for that mine. You may spend additional ore to get a
    third terraforming step, and Q.I.C.s to increase range." Source: `RULEBOOK-TEXT` Appendix V. CONFIRMED.
  - **Resource tile:** gain 1 ore + 3 knowledge. Source: `BOARD-ART` (owner-read 2026-06-27). CONFIRMED.
- G2. New Advanced Tech tiles (6), all confirmed (rulebook Appendix V for 2; owner board-read for the
  other 4, 2026-06-27):
  - **asteroidpass:** "When you pass, you gain 2 victory points for each asteroid that you have
    colonized." Source: RULEBOOK-TEXT. CONFIRMED.
  - **big:** Immediately and only once gain **6 VP per Planetary Institute and/or Academy** you've
    built (max 3 such buildings per player — 1 PI + 2 Academies — so max 18 VP). Source: `BOARD-ART`
    (owner-confirmed 2026-06-27). CONFIRMED. **Corrects an earlier mis-transcription:** Appendix V's
    printed text ("Immediately and only once receive victory points for each Planetary Institute
    and/or Academy, and for each Deep Space sector in which you have colonized at least 1 planet")
    reads as one combined sentence in the `.txt` extraction, but is actually **two separate tiles'**
    text concatenated by the same column-flattening artifact already seen elsewhere in this doc (see
    E6's mis-citation note) — the first clause ("...for each Planetary Institute and/or Academy") is
    `big`; the second clause ("...for each Deep Space sector...") is a different tile, already captured
    independently below as `deep` (its specific 4-VP multiplier came from BOARD-ART, since the rulebook
    text alone never states a quantity). `big` does NOT also reward Deep Space sectors — owner-confirmed
    these are two separate tiles, not one with a combined effect.
  - **deep:** Immediately gain 4 VP per Deep Space sector colonized; the Lost Planet counts if it's
    placed in a Deep Space sector you hadn't already colonized. Source: BOARD-ART. CONFIRMED.
  - **deeppass:** When you pass, gain 2 VP per Deep Space sector colonized (same Lost-Planet caveat as
    "deep"). Source: BOARD-ART. CONFIRMED.
  - **qaction:** Every time you take a Q.I.C. action, gain 4 VP. Source: BOARD-ART. CONFIRMED.
  - **terra:** Every time you terraform 1 step, gain 2 VP (3 steps on one planet = 6 VP; colonizing a
    Protoplanet, which costs 3 steps, gives the full 6). Cannot over-terraform for extra VP. Triggers
    off ANY action that grants free terraforming steps, including the "terra" New Federation token (3
    free steps + build a mine). Source: BOARD-ART. CONFIRMED.
  - (`planetpass` is a reskin of the base "planet" tile, not one of these 6 — see G4b below.)
- G3. Round Boosters (4), all confirmed verbatim from rulebook Appendix III:
  - **former:** income 1 ore. Pass bonus: 3 VP per Gaiaformer (on Faction board or deployed); none for
    Gaiaformers already used to colonize an asteroid. CONFIRMED.
  - **planet:** income 1 ore. Pass bonus: 1 VP per planet type colonized. CONFIRMED.
  - **deep:** income 3 credits. Pass bonus: 2 VP per Deep Space sector with ≥1 planet colonized. CONFIRMED.
  - **instant:** income 2 power. Special action (once): perform "Start a Gaia Project" without moving
    power tokens into the Gaia Area, instantly converting a transdim planet (must be in range; Q.I.C.s
    may extend range) into a Gaia planet. A Gaiaformer is still required, occupies that planet until
    you later build a Mine there, and then returns for reuse exactly like normal/base-game Gaiaforming.
    CONFIRMED.
- G4. Round Scoring (3) + Final Scoring (3): text p.14-15, all 6 CONFIRMED verbatim (lab4/sector3/
  planet3 round tiles; asteroid/deep/distance final tiles — exact quotes in the scratchpad review doc).
  Owner confirmed (2026-06-27) that the planet-type-counting tiles (G4b) explicitly count
  asteroids/protoplanets held only via an Artifact (G6) too, even though no mine is physically placed
  for those.
- G4b. Planet-type-counting tiles (3 reskins of existing base tiles, owner-confirmed 2026-06-27, same
  underlying template, now counting all 11 planet types incl. Asteroid/Protoplanet/Lost Planet):
  - Standard Tech `planetk`: immediately gain 1 knowledge per planet type colonized.
  - Advanced Tech `planetpass`: when you pass, gain 1 VP per planet type colonized.
  - Final Scoring `planet`: most planet types colonized (counts Protoplanet/Asteroid incl. via Artifact,
    and the Lost Planet).
- G5. New Federation tokens (8), all confirmed (rulebook Appendix VI for 4; owner board-read 2026-06-27
  for the other 4 — their gear-shaped badge is VP, not an unidentified resource as previously guessed):
  - **c:** Immediately gain 8 VP + 8 credits. CONFIRMED (BOARD-ART).
  - **k:** Immediately gain 4 VP + 4 knowledge. CONFIRMED (BOARD-ART).
  - **oq:** Immediately gain 4 VP + 2 ore + 1 Q.I.C. CONFIRMED (BOARD-ART).
  - **pwt:** Immediately gain 7 VP + 2 power tokens placed directly into Area III (new tokens, not
    charged up from Area II, per owner's reading). CONFIRMED (BOARD-ART).
  - **range:** Immediately and only once receive a "Build a Mine" action of limitless range without
    paying the build cost; ore still pays for terraforming, Q.I.C. still required for Gaia planets.
    CONFIRMED (RULEBOOK-TEXT).
  - **tech:** Immediately and only once receive 1 Tech tile of choice (same rules as "Upgrade Existing
    Structures"). CONFIRMED (RULEBOOK-TEXT).
  - **terra:** Immediately and only once receive a "Build a Mine" action with up to 3 free terraforming
    steps, without paying the build cost; Q.I.C.s may still increase range. CONFIRMED (RULEBOOK-TEXT).
  - **vp:** Immediately gain 12 VP. Unlike base-game 12-VP Federation tokens, this one ALSO has a green
    reverse side. CONFIRMED (RULEBOOK-TEXT) for the gold face.
  - **Green reverse side — RESOLVED 2026-06-27 (owner clarification, Source: `BOARD-ART` +
    `RULEBOOK-TEXT`, Confidence: CONFIRMED).** This is the base game's existing, universal Federation
    mechanic, not anything new or per-token-unique: in the base game, EVERY Federation token has a
    green reverse side EXCEPT the 12-VP token — flipping a token to its green side lets you discover an
    Advanced Tech tile, or research to the highest level of a Research Area, instead of gaining the
    gold side's resource reward. In Lost Fleet, this rule is unchanged for all the new tokens too — ALL
    8 new Federation tokens (`c`, `k`, `oq`, `pwt`, `range`, `tech`, `terra`, `vp`) have a green side
    using this same standard mechanic. The only thing notable about the new `vp` token specifically is
    that, unlike its base-game 12-VP counterpart (which has no green side at all), this Lost-Fleet `vp`
    token — found on the spaceships — DOES have one, so it can still be flipped for the Advanced
    Tech/research benefit despite being a 12-VP token. No per-token green-side variation to track; it's
    "has a green side" (all of them) vs. "has no green side" (only the base game's original 12-VP token).
- G6. Artifact tokens (13), all confirmed. 13 distinct names/images, no two alike — simplest reading is
  1 copy of each (owner to confirm physical box count if duplicates actually exist). Effects:
  - **1 Knowledge + 1 Ore:** ongoing — gain an extra 1 knowledge + 1 ore EVERY income phase (NOT a
    one-time examine bonus — corrects an earlier guess). Source: BOARD-ART (owner 2026-06-27). CONFIRMED.
  - **3 Credits + 3 Ore:** immediately (one-time, on examine) gain 3 credits + 3 ore. CONFIRMED.
  - **3 Knowledge + 1 Q.I.C.:** immediately gain 3 knowledge + 1 Q.I.C. CONFIRMED.
  - **5 Credits + 2 Ore:** immediately gain 5 credits + 2 ore. CONFIRMED.
  - **Power-charge:** gain 2 power as income, placed in Area III. Source: RULEBOOK-TEXT Appendix VII. CONFIRMED.
  - **Asteroid-themed / Protoplanet-themed** (shared template, 7 VP each): immediately and only once
    gain 7 VP; the artifact ALSO counts as if you're building a mine and colonizing an asteroid (or
    protoplanet) for that mine — not allocated to a sector (no new-sector credit, no 6 VP protoplanet
    bonus), no mine physically placed. Source: RULEBOOK-TEXT Appendix VII (verbatim, shared template). CONFIRMED.
  - **Research/Knowledge-themed (per-level):** immediately and only once gain 3 VP per level reached in
    the matching Research Area (rulebook's own worked example: Level 5 → 15 VP). Source: RULEBOOK-TEXT
    Appendix VII. CONFIRMED. ⚠️ Owner's review comment for this row was cut off mid-sentence ("T") —
    flag to owner to resend/finish in case it contained a correction.
  - **Research-track-themed (generic, count-based):** immediately and only once gain 3 VP for each
    Research Area at Level ≥3 (track-agnostic — distinct from the per-level one above). Source:
    RULEBOOK-TEXT Appendix VII. CONFIRMED.
  - **Federation-token-shaped:** re-score (re-trigger) a Federation token you ALREADY own — gold or
    green side, doesn't matter which. Reuses the base game's federation-scoring mechanic, just
    re-triggered by this artifact. Source: BOARD-ART (owner 2026-06-27 — corrects the earlier "grants a
    new federation token" guess). CONFIRMED.
  - **Gaia-Planet-themed:** immediately and only once gain 3 VP per step up the Gaiaforming track (same
    per-level-multiplier mechanism as the Research/Knowledge-themed artifact above, applied to the
    Gaiaforming track instead of a Research Area). Source: BOARD-ART (owner 2026-06-27). CONFIRMED.
  - **Planet-types-themed:** immediately and only once gain 3 VP + 1 VP per planet type colonized
    (counts planet types held only via another Artifact's asteroid/protoplanet effect, see above).
    Source: BOARD-ART (owner 2026-06-27). CONFIRMED.
  - **Deep-Space-themed:** immediately and only once gain 3 VP per Deep Space sector colonized; the
    Lost Planet counts if placed in a Deep Space sector you hadn't already colonized. Source: BOARD-ART
    (owner 2026-06-27). CONFIRMED.

## H. MAP / SETUP

- H1. Variable Gameboard Layout setup — full procedure (previously only a one-line summary in this
  doc; now captured verbatim from a fresh full read of `rulebook-v1.0.txt` p.4-5, 2026-06-27).
  Source: `RULEBOOK-TEXT` p.4-5. CONFIRMED.
  - **2 players:** Space Sector tiles **01-07** (7 of the base game's 10). Flip Sectors **05, 06, 07**
    to their *"black numbers outlined in white"* side (a Lost-Fleet-specific revised face — see H4).
    Randomly pick 1 of Sectors 01-04 for the center; arrange the other 6 around it, sliding each outer
    sector 1 space left/right so it only borders the inner sector along 2 spaces (not a full edge
    match like the base game) — this opens **6 holes**, 1 space each, around the center sector. Place
    the **6 Interspace tiles for 2p** into the holes at random, such that **each spaceship tile ends up
    ≥5 spaces from every other spaceship tile** (rulebook's suggested method: alternate
    holes-with-a-spaceship and holes-without as you place them). Then place the **6 Deep Space Sector
    tiles 11-16**, random side up, in the gaps around the outside edge. (H5's "flip tile 16 if <6
    asteroids in play" applies here.)
  - **3 players:** Space Sector tiles **01-10 except 08** (9 of 10; 08 returns to the box). Sectors
    05/06/07 flipped exactly as in 2p. Randomly pick 1 of Sectors 01-04 for the center; arrange 6 random
    others around it the same shifted way (6 holes) — then place the **2 remaining** sectors too,
    shifted the same way, extending the ring. Place the **8 Interspace tiles for 3p** into the (now
    more numerous) holes at random; the spacing rule is phrased differently at this player count: **no
    spaceship tile may be within 3 spaces of another** (vs. 2p's "≥5 spaces" framing — see the
    engine-implementation note below). Place the **8 Deep Space Sector tiles**, random side up, in the
    gaps around the outside edge — **3p-only rule: place 2 Deep Space tiles next to each other in the
    larger gap beside the last-placed sector.**
  - **4 players:** **All 10** Space Sector tiles. Sectors 05/06/07 stay on their normal *white numbers*
    side (4p is the only player count using the base-game-style face for those 3 tiles — no flip).
    Randomly pick 2 of Sectors 01-04 and place them adjacent in the center; arrange the other 8 around
    them at random, shifted the same way — 10 holes. Place the **10 Interspace tiles for 4p** at
    random; same "not within 3 spaces" spacing rule as 3p. Place the (same) **8 Deep Space Sector
    tiles**, random side up, in the gaps — no 3p-style "2 adjacent" rule at 4p.
  - **Engine-relevant details not previously captured in this doc:**
    1. Deep Space tile *count* is fixed at 8 in the physical set, but 2p games only place 6 of them
       (tiles 11-16 explicitly, by number) — 3p/4p both place all 8.
    2. Sectors 05/06/07 are genuine double-sided Lost-Fleet components (revised face for 2-3p, stock
       base-game face for 4p) — feeds directly into H4 below.
    3. **RESOLVED 2026-06-28 (empirical, engine-side):** the Interspace spacing rule's *wording* changes
       by player count (2p: "≥5 spaces," 3-4p: "not within 3 spaces") but is the **same underlying
       constraint**, not two different formulas. Computed all pairwise hex-distances between
       `findInterspaceHoles()` results at 2p/3p/4p: the only distances that ever occur are
       `{3, 5, 6, 7, 8, 9, 10, 11}` — **a distance of 4 never occurs at any player count.** Therefore
       "not within 3 spaces" (i.e. distance > 3) and "≥5 spaces" exclude exactly the same set of pairs
       (only the distance-3 minimum-adjacent pairs are excluded either way); there is no case where the
       two phrasings would disagree. Engine implementation: a single rule, "no two spaceship-bearing
       Interspace holes may be at hex-distance ≤ 3 of each other," applies uniformly at 2p/3p/4p.
    4. **RESOLVED 2026-06-28 — the 3p-only "place 2 Deep Space tiles next to each other in the larger
       gap by the sector you placed last" rule has an exact geometric match, not just an inferred
       convention.** All 8 notches are individually uniform in size (same 3-hex triangle, same local
       pocket), but checking pairwise hex-adjacency *between* notches (do any two notches share a hex
       border?) found exactly **one adjacent pair at 3p, and zero adjacent pairs at 2p and 4p** — this
       is a fixed structural property of `lostFleetSectorCenters()`'s geometry (sector centers are not
       randomized, only which physical tile goes where is), so it holds in every 3p game, never in 2p/4p
       games, matching the rulebook's "3p-only" framing exactly. The adjacent pair sits where ring sector
       index 2 meets *both* extra sectors (indices 7 and 8, the two sectors added after the base 6-ring
       in `lostFleetSectorCenters(3)`) — i.e. right beside index 8, the array's last sector, matching
       "the sector you placed last." Engine implementation: find the (3p-only) adjacent notch pair via
       hex-adjacency and place 2 Deep Space tiles there instead of the usual 1; no separate "last sector"
       bookkeeping is needed since the adjacency check alone reproduces the rule.
    5. **Tile shapes (owner-clarified 2026-06-28, was the cause of a long-running layout bug):** an
       **Interspace tile is a single hex**, placed only in the interior holes; a **Deep Space tile is a
       3-hex triangle**, placed only in the perimeter notches along the outside edge. A 3-hex cluster
       appearing *in the interior* between sectors is therefore a layout DEFECT (the interior must be
       clean single-hex holes), not a Deep Space slot. The "slide every outer sector the same way"
       rule must be applied consistently or the seam between two inner-adjacent sectors collapses two
       interior singles into a 3-hex middle cluster.
    6. **Geometry CODED & verified (Chunk 5):** `engine/src/lost-fleet-map.ts` —
       `lostFleetSectorCenters(nbPlayers)` (7/9/10 sectors), `findInterspaceHoles()` (6/8/10 isolated
       single hexes), `findDeepSpaceNotches()` (6/8/8 three-hex triangles), all with 0 sector overlap
       and no adjacent interior holes. Tile data: `DEEP_SPACE_TILES` (§H2), `INTERSPACE_SETS` (§H3).
       Not yet wired into a playable `SpaceMap` (planet placement + spacing rules still to do).
    7. **Blocker found 2026-06-28, deferred to a future chunk (owner-confirmed):** `GaiaHex.toString()` /
       `relativeCoordinates` (`engine/src/gaia-hex.ts`) compute a hex's move-string address (e.g. `"5A2"`)
       via a lattice-reduction algorithm built on the base game's `MATCHED_OFFSET` sector spacing. Lost
       Fleet sectors use `SHIFTED_OFFSET` instead. Verified by direct round-trip computation: for every
       non-origin sector at every player count, this address calculation is wrong (it does not throw —
       it silently returns an incorrect/mismatched suffix). Any future chunk that wires Lost Fleet
       sectors into a live, playable `SpaceMap` (move parsing, `available/*` command generation, etc.)
       must first fix or bypass this addressing system for `SHIFTED_OFFSET`-placed sectors. Chunk 6
       (this chunk) works only at the `Grid<GaiaHex>`/geometry level and never calls `.toString()` on a
       Lost-Fleet-placed hex, so it is unaffected, but this is a hard prerequisite for any move-command
       integration later.
- H2. Deep Space sector tiles (8 physical tiles, 2 sides each = 16 faces, each a 3-hex cluster). Hex
  contents read directly off the randomizer art (2026-06-27). Owner does NOT need the art itself
  redrawn pixel-for-pixel (own SVG style instead, per Art policy above) but DOES need this composition
  data for game logic — explicitly requested, not yet captured anywhere else:

  | Tile | Side a | Side b |
  |---|---|---|
  | 11 | Protoplanet, Asteroid, Blank | Asteroid, Blank, Blank |
  | 12 | **Transdim**, Protoplanet, Blank | Asteroid, Blank, Blank |
  | 13 | **Transdim**, Blank, Asteroid | Blank, Blank, Asteroid |
  | 14 | Protoplanet, Blank, Asteroid | Blank, Blank, Asteroid |
  | 15 | Protoplanet, Blank, Blank | Protoplanet, Blank, Asteroid |
  | 16 | Blank, Blank, Protoplanet | Asteroid, Blank, Asteroid |
  | 17 | **Transdim**, Blank, Blank | Blank, Asteroid, Blank |
  | 18 | Protoplanet, Blank, Blank | Asteroid, Blank, Blank |

  Source: `BOARD-ART` (randomizer asset read). Confidence: CONFIRMED — including the previously
  "unidentified" hex. **RESOLVED 2026-06-27:** the hex on tiles 12a/13a/17a (a solid violet/magenta
  cratered sphere, no glow) is a **Transdim planet** — confirmed by direct visual match against the
  randomizer's own `planet_transdim.png` base-game asset (same purple nebulous/cratered texture,
  side-by-side comparison). This is not a new Lost Fleet element; it's the base game's existing
  wildcard/ghost planet type (becomes Gaia when converted via Gaiaforming), simply also seeded onto
  Deep Space tiles alongside Protoplanet/Asteroid/Blank. Yes — the randomizer site's own asset set was
  sufficient to resolve this without needing the physical component; no further owner check needed.
  - Extends H5: tile 16 has 0 asteroid hexes on side a vs. 2 on side b — exactly the swing the setup
    code keys off (`advcond`-style forced logic) when deciding whether to flip tile 16 to reach the ≥6
    asteroid minimum. A full side-b set totals 9 asteroid hexes across all 8 tiles; a full side-a set
    totals only 3 — confirms why tile 16 specifically is the one the rulebook calls out to flip.
- H3. Interspace tile contents per player-count set (30 in 4 sets). Structural detail
  (`RULEBOOK-TEXT` p.5 sidebar, verbatim) explaining the "4 sets" framing: each Interspace tile has 2
  faces — **front** shows one of {Lost Fleet spaceship tile, planet tile (Protoplanet or Asteroid),
  blank}; **back** is marked for the player-count set it belongs to ("Only use the tiles that
  correspond to your player count"). This implies 4 genuinely distinct physical groups (solo=6, 2p=6,
  3p=8, 4p=10 → 30 total), matching this entry's existing count.
  - **Per-set composition, owner-confirmed 2026-06-27 (Source: `BOARD-ART interspace tiles`,
    Confidence: CONFIRMED):**
    | Set | Asteroid | Protoplanet | Spaceships | Blank | Total |
    |---|---|---|---|---|---|
    | Solo | 2 | 1 | 3 (excl. Rebellion) | 0 | 6 |
    | 2p | 2 | 1 | 3 (excl. Rebellion) | 0 | 6 |
    | 3p | 2 | 1 | 4 (all) | 1 | 8 |
    | 4p | 4 | 1 | 4 (all) | 1 | 10 |
  - **Note (low priority — solo/Automa is not implemented per A3):** the rulebook's own solo-setup text
    (p.6) excludes a different ship for solo play than what the owner stated above — it says *"Return
    the Twilight spaceship ... to the box. Put the other 3 spaceships [Rebellion, T F Mars, Eclipse]
    near the gameboard,"* i.e. solo excludes **Twilight**, not Rebellion. The owner's solo composition
    above says "no Rebellion" instead. Since solo play isn't being built (A3), this discrepancy is
    flagged for completeness only and isn't blocking — 2p (which IS in scope and does exclude Rebellion,
    per C2) matches the owner's data exactly.
  - Exact face-by-face identity of WHICH spaceship/planet-type goes on which specific numbered tile
    (as opposed to just the per-set counts above) is not needed for engine logic — at setup, the set's
    tiles are placed into the board's holes at random (per H1), so only the aggregate counts matter.
- H4. Revised Space Sector tile planet layouts: `TODO [BOARD-ART revised sectors]`. Newly confirmed
  which tiles are "revised" (`RULEBOOK-TEXT` p.4 setup text): specifically Sectors **05, 06, and 07**
  are genuinely double-sided Lost-Fleet components — one face matches the base game's appearance
  ("white numbers," used at 4p), the other is Lost-Fleet-specific ("black numbers outlined in white,"
  used at 2p and 3p). Sectors 01-04 and 08-10 are unmodified base-game tiles reused as-is (no revision).
  Still need the actual revised-side planet arrangement for 05/06/07 from the physical components.
  - **Fallback decision (owner-confirmed 2026-06-28), used until the real revised-face art is
    supplied:** match the base game's own existing per-player-count choice for these 3 sectors. The
    base game already ships both faces (`s5`/`s6`/`s7` = "A" side, `s5b`/`s6b`/`s7b` = "B" side in
    `engine/src/map.ts`) and already picks B-side for its 2-3p `smallConfiguration` and A-side for its
    4-5p `bigConfiguration`. Lost Fleet board generation reuses that exact same split — B-side
    (`s5b`/`s6b`/`s7b`) for LF 2p/3p, A-side (`s5`/`s6`/`s7`) for LF 4p — even though it isn't
    confirmed to be the *correct* Lost-Fleet-specific revised art, since it's the closest available
    proxy and keeps 4p genuinely unrevised (matching the rulebook's explicit "white numbers" note for
    4p above).
- H5. "Most asteroids" final scoring needs ≥6 asteroids in play (flip Deep Space tile 16 if not). p.4. CONFIRMED.

## I. EXISTING-FACTION DELTAS — RESOLVED 2026-06-27 via p.16 screenshot

- **I7. Full 18-faction comparison table — CONFIRMED (Source: `BOARD-ART p.16`, owner screenshot
  2026-06-27 of the rulebook's own per-faction comparison graphic; supersedes the earlier `COMMUNITY`/
  `INFERRED` partial extract).** Green-highlighted cells in the original mark "deviation from a generic
  baseline faction" (≈ 2 mines / 2pw Area I+4pw Area II / 3k,4o,15c,1q / no start research / +1k+1o
  basic income / +3/4/4/5c TS / +4pw+1 token PI / +1k RL / +2k AC1 / 1q AC2 / 5VP shuttle / no special
  ability) — transcribed verbatim below, abbreviations: M=Mine, PI=Planetary Institute (starting
  buildings); B1/B2=power Area I/II; K=knowledge, R=ore, C=credit, Q=Q.I.C. (resources/income); P=power;
  PB1/PB2=token(s) gained into Area I/II; "de" (Ambas TS) = a board-printed footnote abbreviation, not
  yet decoded — flag if it matters when implementing Ambas.

  | Faction | Bldgs | Power B1/B2 | Resources | Start research | Basic income | TS 1/2/3/4 | PI | RL | AC1 | AC2 | Ship cost | LF special ability |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Terrans | 2M | 4/4 | 3K,4R,15C,1Q | GF | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |
  | Lantids | 2M | 4/0 | 3K,4R,13C,1Q | None | +1K,+1R,+1PB1 | +3/4/4/5C | +4P | +1K | +2K | 1Q | 5VP | None |
  | Xenos | 3M | 2/4 | 3K,4R,15C,1Q | AI | +1K,+1R | +3/4/4/5C | +4P,+1Q | +1K | +2K | 1Q | 5VP | 1R→1PB3 free action |
  | Gleens | 2M | 2/4 | 3K,4R,15C | Nav | +1K,+1R | +3/4/4/5C | +4P,+1R | +1K | +2K | 1Q | 5VP | +2 range special action |
  | Taklons | 2M | 2+BS/4 | 3K,4R,15C,1Q | None | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP + BS to gaia area | None |
  | Ambas | 2M | 2/4 | 3K,4R,15C,1Q | Nav | +1K,+2R | +3/4/4/5C de | +4P,+2PB1 | +1K | +2K | 1Q | 5VP | None |
  | Hadsch Hallas | 2M | 2/4 | 3K,4R,15C,1Q | Eco | +1K,+1R,+3C | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |
  | Ivits | 1PI | 2/2 | 3K,4R,15C,1Q | None | +1K,+1R,+1Q | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |
  | Geodens | 2M | 2/4 | 3K,4R,15C,1Q | TF | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |
  | Bal T'aks | 2M | 2/2 | 3K,4R,15C | GF | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 4C | 7VP | None |
  | Firaks | 2M | 2/4 | 2K,4R,15C,1Q | None | +2K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |
  | Bescods | 2M | 2/4 | 3K,4R,15C,1Q | None | +1R | +1/1/1/1K | +4P,+2PB1 | +2K | +3/4/5C | 1Q | 5VP | None |
  | Nevlas | 2M | 2/4 | 2K,4R,15C,1Q | Sci | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +2P | +2K | 1Q | 5VP + burn 1P | None |
  | Itars | 2M | 4/4 | 3K,5R,15C,1Q | None | +1K,+1R,+1PB1 | +3/4/4/5C | +4P,+1PB1 | +1K | +3K | 1Q | 5VP + burn 1P | None |
  | Moweyds | 1M | 4/4 | 5K,6R,15C,2Q | GF | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |
  | Space Giants | 1M | 4/4 | 3K,6R,15C,1Q | Nav | +1K,+1R | +3/4/4/5C | +6P,+1PB1 | +1K | +2K | 1Q | 5VP | 2 dig special action |
  | Darkanians | 1M | 4/2 | 3K,7R,15C,1Q | Nav,Eco | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |
  | Tinkeroids | 1PI | 4/2 | 2K,4R,15C,1Q | Sci | +1K,+1R | +3/4/4/5C | +4P,+1PB1 | +1K | +2K | 1Q | 5VP | None |

  **Important caveat before using this for I1/I3/I6 below:** most of the green-highlighted deviations
  above (e.g. Ivits' 1-PI start, Taklons' Brainstone, Bescods' all-knowledge research income, Ambas'
  extra ore) are this faction's **pre-existing base-game personality**, not something Lost Fleet
  changed — the table just shows each faction's actual current numbers, it doesn't separately flag
  "changed by this expansion" vs. "always been true." The one column that DOES isolate genuinely NEW
  Lost-Fleet content is **"LF special ability"**, and it shows non-`None` for exactly 3 existing
  factions: **Xenos** (matches I4's `1o→1pw(AreaIII)` free action — same ability, table's "R" = ore),
  **Gleens** (matches I5's `+2 range` special action), and **Space Giants** (matches B4's "2 free
  terraform steps" Build-a-Mine action — "2 dig" in the table's shorthand). Every other faction,
  including Lantids/Ivits/Bescods/Itars, shows `None` here.
  **Resolution for I1/I3/I6:** there is no further Lost-Fleet-specific delta to chase for Ivits,
  Bescods, or any of the other existing factions beyond what's already captured (I2 Lantids, I4 Xenos,
  I5 Gleens) — the LF-special-ability column is empty for all of them. The other column values above
  (income, PI, AC1/AC2, etc.) are each faction's correct CURRENT numbers under Lost Fleet, useful as a
  direct implementation reference, but determining whether any specific cell differs from that
  faction's pre-existing vanilla number (the only way a "silent" non-ability rule change could hide)
  isn't something to guess at from memory — **when actually coding each base faction's Lost Fleet
  config, diff this table's row against that faction's existing `engine/src/faction-boards/*.ts`
  definition** (which already encodes correct, tested vanilla numbers); any mismatch found that way is
  the real delta to apply, anything matching needs no change. No further owner input is needed for I1/
  I3/I6 — this is now a coding-time verification step, not an open question.
- I1. Ivits — **CLOSED**, see I7: power 2/2 (table-confirmed, matches p.8 and pre-existing vanilla
  value), no LF-specific ability or other delta found.
- I2. Lantids: +1 power Area I income (CONFIRMED, p.8). Adjusted PI tile, text-only (no image in the
  uiqoo.kr randomizer, see COMPONENTS.md §8), both sides: **solo/2-player side** — gain 2 knowledge
  both when adding a mine to a colonized planet AND when building a mine on the Lantids' home planet
  type (Terra = the blue planet in this viewer's palette, see `viewer/src/data/planets.ts`), even
  without using their faction ability. **3-player side** — gain 2 knowledge AND charge 1 additional
  power when adding a mine to a colonized planet. **Owner board-read 2026-06-27 corrects the rulebook
  prose** (`RULEBOOK-TEXT` p.8's "Choosing Your Faction" recap only mentioned the power charge for the 3p side,
  omitting the knowledge gain that's also on the physical tile — abbreviated narrative vs. full tile
  text). Only relevant with fewer than 4 players (a 4-player game uses the unadjusted base PI tile,
  which itself already grants 2 knowledge per additional mine when a Planetary Institute is built —
  see `player.ts` `gainRewards([new Reward("2k")], Faction.Lantids)`). CONFIRMED.
- I3. Bescods — **CLOSED**, see I7: table shows no LF-specific ability; the "starts 3 knowledge"
  recap on p.8 just restates their pre-existing vanilla starting resources (3K is the table's own
  baseline value, not a deviation) — no Lost-Fleet delta found for Bescods.
- I4. Xenos: free action 1o→1pw(AreaIII) (p.11). Board deltas: cross-validated by I7's table — no
  further deltas beyond this one ability. CONFIRMED.
- I5. Gleens: special action incl. Explore +2 range (p.11). Board deltas: cross-validated by I7's
  table — no further deltas beyond this one ability. CONFIRMED.
- I6. Every other faction (Taklons, Ambas, Hadsch Hallas, Geodens, Bal T'aks, Firaks, Nevlas, Itars) —
  **CLOSED**, see I7: table shows `None` in the LF-special-ability column for all of them; their
  other column values are pre-existing vanilla traits (Brainstone, inverted research income, etc.),
  not new Lost Fleet content. Per-faction implementation should still diff against existing engine
  code per I7's note, but no owner input is needed.

## J. MULTIPLAYER / SYNC RULINGS
- J1. Turn commitment: only completed turns persist + broadcast (ties to A2 undo). OUR-RULING. CONFIRMED.
- J2. Leech/charge-power interrupts: another player may owe a charge decision mid-turn. The sync
  layer must surface "who can act now" from the engine's available-commands, not assume strict
  sequential turns. Source: OUR-RULING / engine behavior. CONFIRMED (need), INFERRED (impl).
- J3. Seed fixed at game creation, stored, never regenerated (engine is deterministic from seed +
  moves). OUR-RULING. CONFIRMED.
- J4. Notifications: ~~email on turn-change (works everywhere). PWA push optional later~~ —
  **AMENDED by owner ruling 2026-07-01: Web Push notifications are the one notification channel;
  turn-change emails are dropped entirely** (owner doesn't check email and doesn't want the spam).
  The only emails in the system are Supabase Auth's built-in magic-link sign-in emails. Accepted
  caveats, raised and acknowledged: iOS requires the viewer added to the home screen as a PWA
  (iOS 16.4+) before push works, and each device must grant notification permission once; a
  player with no subscribed device simply gets no notification (the game itself is unaffected).
  Source: OUR-RULING (owner, 2026-07-01). CONFIRMED.

## K. ERRATA CHECK LOG (2026-06-25)

- **K1. No official errata/FAQ document exists for Lost Fleet.** Capstone's official product page links
  exactly one rules file, `GP_Exp_Rule_EN_V1_Web.pdf` (the v1.0 rulebook already in this repo) — no separate
  errata or FAQ. The "Gaia FAQ and Errata" file on BGG (filepage 155926) is dated Feb 2018, predates Lost
  Fleet by 6 years, and is base-game only. **The v1.0 rulebook prose is authoritative.**
  Source: `ERRATA` (negative result) — https://capstone-games.com/products/gaia-project-the-lost-fleet
  Confidence: CONFIRMED.
- **K2. Lost-Fleet corrections exist only as BGG community forum threads** (not official errata, and BGG
  blocks automated fetch with HTTP 403, so they must be read by a human). Threads to review and, if a
  ruling is found, record with `COMMUNITY` source (NOT `ERRATA`). **Owner pre-authorized 2026-06-27:
  if a thread states a clear ruling on a question this doc has open, record it directly as
  `Confidence: CONFIRMED`** (not `INFERRED`) — no separate owner re-confirmation needed after the
  human read, since the read itself IS the confirmation step here.
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
2. ◐ Fill all `TODO [BOARD-ART]` placeholders from the physical game. Remaining open: H4 (revised
   Sector 05/06/07 planet layout — still needs the physical component). Everything else closed
   2026-06-27 (H2 Transdim ID, H3 Interspace composition, B1 Tinkering tiles, B5 closed as
   not-needed, G2 "big" tile fix, G5 green-side rule, full §I faction audit).
3. ☑ Decide final `Expansion` enum restructure shape (A1) before touching enums.ts. → LOCKED, see §A1.
4. ☑ Confirm no new research track (F2). → DONE, owner-confirmed 2026-06-27, see §F2.
5. ☑ Complete the p.16 existing-faction audit (section I). → DONE 2026-06-27 via owner screenshot of
   p.16; see §I7's full 18-faction table. No Lost-Fleet-specific delta found beyond what was already
   captured (Lantids/Xenos/Gleens/Space Giants); diff-against-engine-code note left for implementation time.
6. ☑ Resolve the E6 side-selection conflict. → DONE, owner ruling 2026-06-27: 2p always forced to the
   25-VP side (matches rulebook); 3-4p always randomize the side every game (exercising the rulebook's
   own "decide at random" option unconditionally, rather than as an optional later-game variant). See §E6.
7. ☐ K2: human review of the 4 BGG community threads (owner has BGG access) — any clear ruling found
   should be recorded directly as CONFIRMED, per owner's 2026-06-27 pre-authorization. See §K2.
8. ☑ **Rescore-with-no-owned-token gate (fuzzer finding LF-2, 2026-07-03).** May a player take a
   "re-score a Federation token you already own" effect while owning NO Federation token (pool or
   ship-claimed)? Affects 2 Lost Fleet surfaces: (a) the Federation-token-shaped **Artifact** (§G6)
   being choosable on Examine Artifact, and (b) **Twilight's Q.I.C. action** (§C1, 3 Q.I.C.).
   **Owner ruling 2026-07-03 (revised same day): YES — the action/token stays choosable, it just
   has no effect.** Unlike the base game's identical QIC2 rescore mechanic (which hides the
   action entirely with no owned token — `engine/src/available/actions.ts`, "Prevent using the
   rescore action if no federation token"), the owner explicitly chose the opposite UX for these
   2 Lost Fleet surfaces: pay the cost/claim the token as normal, and if nothing is owned to
   rescore, the effect silently resolves as a no-op (previously this threw/dead-ended — that was
   the actual bug LF-2 reported). Both surfaces are flagged with a warning so a future UI can
   tell the player in advance: `AvailableSpaceshipBoardAction.warnings` (new
   `BuildWarning.noOwnedFederationToRescore`) for Twilight's Q.I.C. action, and
   `Command.ChooseArtifactToken`'s new `noEffectTokens` field for the Federation-shaped Artifact.
   Source: `OUR-RULING` (owner, 2026-07-03). Confidence: CONFIRMED. Fixed in
   `engine/src/engine.ts` (the shared `gain-${Resource.RescoreFederation}` listener is no longer
   `required`) and `available/federations.ts`'s `possibleFederationTiles()` (the rescore branch
   returns no command at all — not one with an empty `tiles` list — when the player owns nothing,
   so the non-required `processNextMove` call resolves it as a genuine no-op instead of an
   unanswerable forced choice).
