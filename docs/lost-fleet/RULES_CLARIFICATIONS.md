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
  "instant" Round Booster, G3: convert a transdim planet in range into a Gaia planet without moving
  power tokens into the Gaia Area).
- Credit action: 3 credits → terraform 1 step AND build (same combined terraform+build as the base
  game's standard "Build a Mine" action, just paid in credits instead of ore).
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
  - **⚠️ Side-selection rule — UNRESOLVED CONFLICT, flagged 2026-06-27, needs owner re-check against the
    physical component before this can read CONFIRMED.** The rulebook states the rule twice, in two
    separate, cleanly-typeset passages (re-checked directly — this is not a column-merge/OCR artifact;
    both read unambiguously in isolation):
    - p.5, setup: *"Take the Scoring Board Extension. For 2 players, always use the side showing 25
      victory points. For 3 or 4 players, use the side showing 3 Exploration Shuttles. In later games,
      you can decide at random which side to use."*
    - p.10, the Advanced-Tech-conditions paragraph attached to "Action: Build a Mine" (NOT "Action:
      Upgrade Existing Structures" — that's a separate paragraph on the same physical page; corrects an
      earlier mis-citation): *"Instead, the conditions shown on the Scoring Board Extension are applied
      (either you have at least 25 victory points or have explored 3 different spaceships in the Lost
      Fleet; the latter condition only applies in 3- and 4-player games)."*
    Both passages agree with each other, and both tie side selection to player count by default:
    **2p always uses the 25-VP side** (no stated exception); **3-4p default to the ships-explored side**,
    with the rulebook explicitly allowing later games to randomize — but that randomization clause is
    scoped only to the 3-4p paragraph, and the second passage independently states the ships condition
    "only applies in 3- and 4-player games" at all, with no carve-out for 2p even under randomization.
    **Owner stated (2026-06-27) "25 vp or 3 ships is random and not tied to player count"** — this
    directly contradicts both printed passages above. An earlier edit to this entry accepted that
    correction at face value and speculated the printed text might be "an OCR/layout misread" — that
    speculation has since been checked and is wrong: both source passages are clean, well-structured,
    non-garbled text in this extraction, so the conflict is real, not an artifact of the `.txt` companion.
    Possible explanations, none yet confirmed: (a) this is a deliberate **house-rule** choice for the
    digital implementation — always randomize the side regardless of player count, overriding the
    printed default; (b) owner is recalling the "in later games, randomize" line and generalizing it to
    all player counts; (c) a physical insert/correction exists that isn't reflected in the v1.0 PDF text.
    **Needs an explicit owner call before implementing** — until then, the engine should default to the
    printed rule (2p forced to the 25-VP side; 3-4p forced to the ships side, with side selection only
    becoming a manual/random toggle for 3-4p games after the first).
  - The **2nd** condition (flip an owned, unflipped Federation token) and **3rd** condition (cover an
    owned Standard Tech tile in the matching Research Area with this Advanced Tech tile) are
    UNCHANGED — confirms owner's "AND also have a fed token" framing. Reaching level 4/5 on ANY
    research track is irrelevant for this one tile, exactly as owner stated.
  - Net gate for this one tile (pending the side-selection resolution above): (≥25 VP, or — in 3-4p,
    by default — explored 3 of 4 ships) AND flip an unflipped Federation token AND cover a matching
    Standard Tech tile. The other 5 Advanced Tech tiles in the game are still taken under the normal,
    unmodified 3-condition rule.
  Source: `RULEBOOK-TEXT` p.5 (setup/side selection) + p.10 (Advanced-Tech-conditions paragraph).
  Confidence: CONFIRMED (single tile; 2nd/3rd conditions unchanged) / **CONFLICT** (side-selection
  randomness — see flag above).

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
  - **big:** "Immediately and only once receive victory points for each Planetary Institute and/or
    Academy, and for each Deep Space sector in which you have colonized at least 1 planet." Source:
    RULEBOOK-TEXT (mechanism CONFIRMED; exact VP-per-unit value still needs the printed tile, `TODO`).
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
  - **instant:** no income row. Special action (once): perform "Start a Gaia Project" without moving
    power tokens into the Gaia Area, instantly converting a transdim planet (must be in range; Q.I.C.s
    may extend range) into a Gaia planet. CONFIRMED.
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
    reverse side letting you discover an Advanced Tech tile or research to the highest level of a
    Research Area. CONFIRMED (RULEBOOK-TEXT) for the gold face; the green-side trigger condition is
    still `TODO [BOARD-ART]`.
  - Which OTHER tokens (besides `vp`) carry a green side, if any: still `TODO [BOARD-ART]` — the
    rulebook only calls out `vp` as having one.
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
    3. The Interspace spacing rule's *wording* changes by player count (2p: "≥5 spaces," 3-4p: "not
       within 3 spaces") — likely the same underlying minimum-distance check scaled to a smaller (2p,
       7-tile) vs. larger (3-4p, 9/10-tile) ring, but this is inferred, not confirmed: whoever
       implements board generation should verify the two phrasings reduce to one formula (e.g., via the
       actual hex-distance layout) rather than assuming it without checking, since the rulebook gives
       no explicit unit conversion between the two framings.
- H2. Deep Space sector tiles (8 physical tiles, 2 sides each = 16 faces, each a 3-hex cluster). Hex
  contents read directly off the randomizer art (2026-06-27). Owner does NOT need the art itself
  redrawn pixel-for-pixel (own SVG style instead, per Art policy above) but DOES need this composition
  data for game logic — explicitly requested, not yet captured anywhere else:

  | Tile | Side a | Side b |
  |---|---|---|
  | 11 | Protoplanet, Asteroid, Blank | Asteroid, Blank, Blank |
  | 12 | **Unidentified†**, Protoplanet, Blank | Asteroid, Blank, Blank |
  | 13 | **Unidentified†**, Blank, Asteroid | Blank, Blank, Asteroid |
  | 14 | Protoplanet, Blank, Asteroid | Blank, Blank, Asteroid |
  | 15 | Protoplanet, Blank, Blank | Protoplanet, Blank, Asteroid |
  | 16 | Blank, Blank, Protoplanet | Asteroid, Blank, Asteroid |
  | 17 | **Unidentified†**, Blank, Blank | Blank, Asteroid, Blank |
  | 18 | Protoplanet, Blank, Blank | Asteroid, Blank, Blank |

  Source: `BOARD-ART` (randomizer asset read). Confidence: CONFIRMED for the Asteroid/Protoplanet/Blank
  classifications. **† Unidentified (tiles 12a, 13a, 17a only):** a solid violet/magenta cratered
  sphere with no glow — visually distinct from the confirmed teal-glow Protoplanet motif, and doesn't
  match any of the 9 base-game planet colors either. Deliberately NOT guessed further (that's exactly
  the kind of icon-only call that's been wrong elsewhere in this review) — flagged `TODO [BOARD-ART]`
  for the owner to check against the physical tiles. If it turns out to be decorative-only, those 3
  cells are effectively Blank; if it's a real 4th hex type, the table undercounts it.
  - Extends H5: tile 16 has 0 asteroid hexes on side a vs. 2 on side b — exactly the swing the setup
    code keys off (`advcond`-style forced logic) when deciding whether to flip tile 16 to reach the ≥6
    asteroid minimum. A full side-b set totals 9 asteroid hexes across all 8 tiles; a full side-a set
    totals only 3 — confirms why tile 16 specifically is the one the rulebook calls out to flip.
- H3. Interspace tile contents per player-count set (30 in 4 sets): `TODO [BOARD-ART interspace tiles]`.
  Structural detail newly confirmed (`RULEBOOK-TEXT` p.5 sidebar, verbatim) explaining the "4 sets"
  framing: each Interspace tile has 2 faces — **front** shows one of {Lost Fleet spaceship tile,
  planet tile (Protoplanet or Asteroid), blank}; **back** is marked for the player-count set it
  belongs to ("Only use the tiles that correspond to your player count"). This implies 4 genuinely
  distinct physical groups (solo=6, 2p=6, 3p=8, 4p=10 → 30 total), matching this entry's existing
  count. Exact face-by-face spaceship/planet-type assignment per tile is still `TODO [BOARD-ART]`.
- H4. Revised Space Sector tile planet layouts: `TODO [BOARD-ART revised sectors]`. Newly confirmed
  which tiles are "revised" (`RULEBOOK-TEXT` p.4 setup text): specifically Sectors **05, 06, and 07**
  are genuinely double-sided Lost-Fleet components — one face matches the base game's appearance
  ("white numbers," used at 4p), the other is Lost-Fleet-specific ("black numbers outlined in white,"
  used at 2p and 3p). Sectors 01-04 and 08-10 are unmodified base-game tiles reused as-is (no revision).
  Still need the actual revised-side planet arrangement for 05/06/07 from the physical components.
- H5. "Most asteroids" final scoring needs ≥6 asteroids in play (flip Deep Space tile 16 if not). p.4. CONFIRMED.

## I. EXISTING-FACTION DELTAS  ⚠️ audit p.16 vs base boards
- I1. Ivits: start 2 power Area I + 2 Area II (p.8). Other deltas: `TODO [BOARD-ART p.16]`.
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
4. ☑ Confirm no new research track (F2). → DONE, owner-confirmed 2026-06-27, see §F2.
5. ☐ Complete the p.16 existing-faction audit (section I).
6. ☐ Resolve the E6 side-selection conflict: owner says random/not player-count-gated, but the
   rulebook states player-count-gated (2p always 25-VP; 3-4p default ships, optional later-game
   randomize) in two independent, clean passages (p.5 and p.10). Needs an explicit owner call — see
   the ⚠️ flag in §E6 — before the engine's default behavior is locked in.
