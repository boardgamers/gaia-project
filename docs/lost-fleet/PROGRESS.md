# Lost Fleet — Progress & Next-Session Handoff

> **New session? Start here.** This file is the running state of the project. Read it, then read
> `RULES_CLARIFICATIONS.md` (the value ledger) and `COMPONENTS.md` (the inventory/status). If the
> task touches viewer rendering/perf, also read `PERFORMANCE.md` first — it has hard-measured
> findings that should not be rediscovered. Read **Working agreements** below before doing
> anything else, including the **Testing — required going forward** section it points to — both
> are standing process, not optional. Then ask the user "what next?" and use the **Next actions**
> section below to guide them.
> Last updated: **2026-07-01**.

## Working agreements (read every session, not optional)
1. **Before writing any implementation plan, go read the current mechanics/code it will touch
   first.** Don't propose a plan from memory or assumption — trace the actual component tree,
   data flow, or engine logic involved, the same way the turn-order and persistence questions
   below were answered by reading `self-contained.ts`/`Game.vue`/`launcher.ts` rather than
   guessing. A plan that doesn't reflect how the existing code actually works isn't useful.
2. **Testing convention** — see the **Testing — required going forward** section below; it's the
   same kind of standing instruction.

## What this project is
Add the official **Gaia Project: The Lost Fleet** expansion to a private fork of the open-source
`boardgamers/gaia-project` engine + viewer, plus a thin Supabase backend for invite-only async
multiplayer among friends who own the game. Architecture decisions are locked in
`RULES_CLARIFICATIONS.md` §A (don't relitigate: skip the official mono-repo; Vue viewer static on
Vercel; engine runs client-side; Supabase stores append-only move lists synced via Realtime; Lost
Fleet is its own expansion, mutually exclusive with Frontiers; no Automa/solo; email turn
notifications).

## Repo & environment
- **Location:** `C:\Users\okimm\Documents\Projects\gaia-lost-fleet` (a clone of upstream).
- **Remotes:** `origin` → `github.com/kimphamnguyen/gaia-lost-fleet` (**PRIVATE**, your repo, push here).
  `upstream` → `boardgamers/gaia-project` (read-only; pull engine fixes, never push).
- **To make Claude Code "be" in this project:** open a terminal here and run `claude`:
  ```powershell
  cd C:\Users\okimm\Documents\Projects\gaia-lost-fleet
  claude
  ```
  (Earlier sessions ran from the unrelated `habit-competition-app` folder and reached this repo via
  absolute paths — that works but the terminal/CLAUDE.md belong to the other project. A session
  started here is cleaner for code work.)
- **Monorepo (pnpm workspaces):** `engine/`, `viewer/`, `old-ui/`. Engine tests: in `engine/`, `npm test`.
- **PDF/board-art tooling note:** `pdftoppm` is NOT installed, but `pdftotext` works and **PyMuPDF**
  (`pip install pymupdf`) renders PDF pages to PNG without external binaries — that's how rulebook
  page art and supplied photos get read. Example used: `fitz.open(pdf)[n].get_pixmap(dpi=300)`.

## Done so far
1. ✅ **Source docs imported & version-controlled** in `docs/lost-fleet/`: rulebook v1.0 (PDF +
   `rulebook-v1.0.txt` searchable text), `COMPONENTS.md`, `RULES_CLARIFICATIONS.md`,
   `faction-overview-table.txt` (community faction data, text-only — no third-party art committed).
2. ✅ **Errata check** — no official Lost Fleet errata/FAQ exists; v1.0 rulebook is authoritative
   (`RULES_CLARIFICATIONS.md` §K). Community BGG threads still want a human skim (links in §K2).
3. ✅ **Expansion enum (A1) LOCKED, CODED & TESTED** (`RULES_CLARIFICATIONS.md` §A1; Chunk 1 of the
   build, done 2026-06-27): `engine/src/enums.ts` now has
   `None=0, Frontiers=2, LostFleet=4, All=Frontiers|LostFleet=6` plus a new `hasExpansion(expansions,
   exp)` helper. Migrated all ~12 strict-equality `=== Expansion.Frontiers` checks to bitwise
   (`enums.ts`, `available/buildings.ts`, `research-tracks.ts`, viewer `Rules.vue`,
   `ResearchTile.vue`, `PlayerInfo.vue`, `PlayerBoard/Info.vue`). `EngineOptions` gained a
   `lostFleet?: boolean` flag mirroring `frontiers?: boolean`; `moveInit()` asserts the two can't be
   combined. New `engine/src/enums.spec.ts` covers `hasExpansion`, `All` composition, the
   `Building.values(All)` regression, the `engine.expansions` getter, and the exclusivity guard.
   **274/274 engine tests pass.** (Note: `tsc --noEmit` throws parse errors inside
   `@types/lodash@4.17.24`'s `.d.ts` — verified pre-existing on a clean baseline via `git stash`, a
   TypeScript 3.9.10 / lodash-types version mismatch unrelated to this work; not a regression, not
   blocking, left alone.)
4. ✅ **4 new faction boards — owner-CONFIRMED** (`RULES_CLARIFICATIONS.md` §B): Tinkeroids,
   Darkanians, Moweyds, Space Giants (starting resources/power/research/PI income, in engine syntax).
5. ✅ **Existing-faction audit CLOSED** (§I7): full 18-faction p.16 comparison table transcribed from
   owner screenshot (2026-06-27, BOARD-ART, CONFIRMED). Only Xenos/Gleens/Space Giants get a genuinely
   new LF ability (all already captured); every other faction's deviation is pre-existing vanilla
   personality. Implementation note: diff each row vs. existing `faction-boards/*.ts` at coding time.
6. ✅ **Tile/booster/scoring/tech/federation/artifact EFFECTS** — all CONFIRMED (rulebook Appendices
   II–VII for the prose ones; owner board-reads 2026-06-27 for the art-only values). See §G1–G6.
7. ✅ **Spaceship boards fully captured** (§C1–C5): all 3 action tiles per ship (type/cost/effect),
   the standard-tech-slot assignment (0 on Twilight, 1 each on the other 3), Twilight's artifact slots
   (= player count), and the 4-space exploration charge track (0/2/2/3). Owner board-read 2026-06-27.
8. ✅ Evaluated the uiqoo.kr randomizer: it's a seeded PNG image-renderer of setups with **no effect
   text** — not a viable source for "what components do." Skip it (maybe use only for map-tile images).
9. ✅ **Viewer deployed** to Vercel (Git integration, auto-deploy on push to this branch) and
   **performance foundation work done** before starting Lost Fleet feature coding (user's explicit
   request — get the foundation right first). Full investigation, root causes, fixes, measured
   before/after numbers, and the Vue 2 vs Vue 3 decision are in `PERFORMANCE.md` — **read that file**
   before touching viewer rendering again. Bottom line: engine logic was never the bottleneck
   (~3.6 ms/move); it was Vue 2 deep reactivity over the whole engine state + ~4,500 duplicate SVG
   `<defs>` nodes. Fixed (`markRaw`, hoisted federation gradient defs): load -16%, worst click
   (Build a Mine) -45%. Vue 3 migration was evaluated and rejected for now (wouldn't fix the actual
   bottleneck, huge migration cost in this stack) — see `PERFORMANCE.md` for the full reasoning.
10. ✅ **Protoplanet & Asteroid planet types (Chunk 2) CODED & TESTED** (`COMPONENTS.md` §2, done
    2026-06-27): `Planet` enum gained `Protoplanet`/`Asteroid`, gated via a new `Planet.values(expansions)`
    namespace function mirroring `ResearchField.values()`'s pattern — establishing the gating convention
    flag 5 asked for, ahead of the adv-tech/federation/booster/scoring tiles that also need it.
    `planets.ts`'s `terraformingStepsRequired()` gained flat early-returns (Protoplanet=3 steps;
    Asteroid=0, folded into the existing Gaia/Transdim branch). `player.ts`'s `canBuild()`/`build()`
    wire the build path: Protoplanet mines get a +6VP bonus (encoded as a `-6vp` cost reward);
    Asteroid mines require an available Gaiaformer (`canBuild` returns `null` otherwise), permanently
    consume it (new `PlayerData.gaiaformersUsedForAsteroid` field, factored into
    `getResources(GaiaFormer)`), and waive the board's ore/credit mine cost via `Reward.negative()`.
    `Condition.PlanetType` needed no code change (purely hex-driven on owned hexes), so flag 6's
    "virtual planet type" seam is a one-line comment at the count site for now — there's no Artifact
    code yet to union in, so a real data structure would be speculative; revisit when Chunk 4+ codes
    Artifacts. **280/280 engine tests pass** (274 baseline + new `planets.spec.ts` + 4 new cases in
    `player.spec.ts`).
    **Scope deviation flagged, not guessed past:** the "Refined ordering takeaway" below originally
    said Chunk 2 should carry flag 1's full terraform-cost refactor too. That refactor is specifically
    for the 4 *new* no-home-planet factions (Darkanians/Space Giants flat steps, Tinkeroids/Moweyds
    per-game randomized cost-3 set) — none of which are coded yet, so there is no `factionPlanet()`
    value to route and nothing concrete to test. Chunk 2 only added the flat Protoplanet/Asteroid
    early-returns that flag 1 also called out (the part that's faction-agnostic); the per-faction
    terrain-step override is still Chunk 3 as originally sequenced. **Known gap, not yet hit:** the
    +6VP Protoplanet bonus is unconditional — it does not yet check "0 VP if a start planet" (§E1),
    because no currently-coded faction has Protoplanet as a home planet, so `factionPlanet(this.faction)
    === Planet.Protoplanet` can never be true today and there's no way to test the branch. This must
    be added when Moweyds/Space Giants are coded (Chunk 4+), not before.
11. ✅ **Darkanians + Space Giants, FULL board (Chunk 3) CODED & TESTED** (`RULES_CLARIFICATIONS.md`
    §B2/§B4, done 2026-06-27). **Scope changed mid-chunk, confirmed with the user first:** the original
    plan (below, "Engine chunk sequence") split "terraforming infra" (Chunk 3) from "full faction
    board" (Chunk 4) for the same faction — but `factions.ts`'s home-planet map and
    `faction-boards/index.ts`'s `factionBoards` map are both exhaustive `{[key in Faction]: X}` types,
    so a `Faction` enum member cannot exist without a complete board (income/power/building costs/PI)
    or the engine crashes at runtime the moment that faction is loaded. Surfaced via `AskUserQuestion`;
    user picked "Darkanians + Space Giants, full board" over a Darkanians-only or pure-refactor option.
    What's coded: `Faction.Darkanians`/`Faction.SpaceGiants` added to the enum, gated through a new
    `Faction.values(expansions)` (same shape as `Planet.values`/`ResearchField.values`); `factions.ts`
    map entries (`planet: Asteroid`/`Protoplanet`, pairing-only, see flag 1/3 below);
    `remainingFactions()` now takes `expansions` and threads it through both call sites
    (`available/setup.ts`, `move/setup.ts`); `terraformingStepsRequired()` signature changed from
    `(factionPlanet: Planet, target: Planet)` to `(faction: Faction, target: Planet)` so it can
    special-case Darkanians (flat 1 step) / Space Giants (flat 2 steps) before falling through to the
    existing planet-cycle math for everyone else; `gaiaFormingCost()` gained a Darkanians/Space-Giants
    branch paying 2 QIC instead of 1 (separate from terrain steps, flag 1's other axis); new
    `faction-boards/darkanians.ts` (income `3k,7o,15c,q,up-nav,up-eco` / `+o,k`; power 4/2; standard
    building costs — no deltas) and `faction-boards/space-giants.ts` (income `3k,6o,15c,q,up-nav` /
    `+o,k`; power 4/4; standard building costs except PI income bumped from `+4pw` to `+6pw` plus an
    appended literal `"tech"` reward, reusing the existing `Resource.TechTile` → `gain-tech` →
    `Command.ChooseTechTile` machinery already used by ResearchLab/Academy2/Bescods — zero new engine
    code needed for "immediately take 1 tech tile of choice"); both registered in
    `faction-boards/index.ts`'s exhaustive map. **299/299 engine tests pass** (280 baseline + 19 new:
    `planets.spec.ts` faction-keyed cases, `player.spec.ts` terraform-step + Gaia-QIC-surcharge cases,
    new `faction-boards/darkanians.spec.ts` + `space-giants.spec.ts` board-shape checks).
    **Pre-existing tests broken by the `Faction.values` merged namespace, fixed as part of this chunk
    (not a regression in new code, but newly exposed by it):** TS namespace-merging means
    `Object.values(Faction)` now also returns the `values` function itself (same shape as
    `BoardAction`/`Planet`/`ResearchField`), which broke `factions.ts`'s `oppositeFaction()` (iterated
    `Object.values(Faction)` directly, crashed on `factions[fn].planet`) and two
    `available-command.spec.ts` assertions that used `Object.values(Faction)` as a stand-in for "all
    choosable factions." Fixed `oppositeFaction` to use `Faction.values(Expansion.All)`; fixed the
    spec assertions to use `Faction.values(Expansion.None)` (matching the no-expansion `new Engine()`
    they construct). **Known, not yet fixed:** the same `Object.values(Faction)` pattern exists in 6
    places under `viewer/src/` (`Filters.vue`, `Rules.vue`, `balance-sheet.ts`, `chart-factory.ts`,
    `graphics/utils.ts` ×2) — these will now also pick up the stray `values` function whenever the
    viewer package builds/runs. Out of scope for this engine-only chunk (viewer hasn't been touched
    anywhere in this project yet) but flagged here so a future viewer chunk doesn't rediscover it from
    scratch.
    **Explicitly deferred, not guessed past:**
    - **Darkanians' Planetary Institute ability** ("first time colonizing in a Space/Deep Space sector,
      gain 2c+1k") is NOT implemented. It needs sector-type classification (Space vs. Deep Space vs.
      Interspace) on `GaiaHex`, which doesn't exist yet — `GaiaHex.data.sector` is just a printed-tile-
      ID string today. This is Lost Fleet map content, still `☐ TODO`/`◐ SPEC` per `COMPONENTS.md` §6.
      Build it once the Lost Fleet map subsystem exists, not before.
    - **Space Giants' Exploration-board "2 free terraform steps" special action** is out of scope —
      the Exploration-board subsystem itself isn't built (see flag 4 below; `COMPONENTS.md` §4).
    - **Tinkeroids/Moweyds remain entirely untouched**, still blocked on the §B5 "highest from left"
      scan-order ambiguity the user has not yet resolved.
12. ✅ **Spaceship Boards — data + setup only (Chunk 4) CODED & TESTED** (`COMPONENTS.md` §3,
    `RULES_CLARIFICATIONS.md` §C, done 2026-06-28). **Scope explicitly limited, confirmed with the user
    via `AskUserQuestion`** ("Data + setup only first") — this chunk covers the 4 boards' static
    config and setup-time randomization ONLY; every live-gameplay hook is deferred (see below).
    What's coded: 3 brand-new enums in `enums.ts` — `Spaceship` (Twilight/Rebellion/TFMars/Eclipse),
    `SpaceshipTechTile` (Range/Terraform/Resource), `SpaceshipFederation` (8 values: Credit/Knowledge/
    OreQic/PowerTokens/Range/Tech/Terraform/Vp) — each gated via its own `.values(expansions)`
    namespace function (same `Planet.values`/`Faction.values` shape, returns `[]` without
    `Expansion.LostFleet`). **Deliberately NOT merged into the existing `TechTile`/`Federation`
    enums**, even though flag 5 below originally suggested extending them: `engine.tiles.federations`
    is a live count-based pool decremented by `move/federation.ts`/read by `available/federations.ts`,
    and `TechTile`/`AnyTechTilePos` are live-consumed by `move/research.ts`/`available/research.ts` —
    extending either would auto-wire untested ship-seeded content into existing action-availability
    checks before the "must have explored that ship" gating logic exists. New
    `engine/src/spaceships.ts` holds the static per-ship board data (`spaceshipBoards`: 3 actions each
    — type qic/power/knowledge-or-credit, cost, effect text; `hasStandardTechSlot`: false for Twilight,
    true for the other 3), the shared `EXPLORATION_CHARGE_TRACK = [0, 2, 2, 3]`, `artifactSlotCount()`
    (= player count, Twilight only), and `shipsInPlay(expansions, nbPlayers)` (excludes Rebellion at
    2p). New `tiles/spaceship-techs.ts`/`tiles/spaceship-federations.ts` hold plain descriptive effect
    text for the 3 tech tiles / 8 federation tokens (NOT Reward/Event-parseable yet — no execution-side
    consumer exists for these new mechanics, so inventing parsing grammar now would be speculative).
    `engine.ts`'s `Engine.tiles` gained `spaceshipTechs`/`spaceshipFederations` (both
    `{[key in Spaceship]?: T}`, default `{}`). `setup.ts` gained a new generic
    `shipAssignmentFactory<T>()` setup-factory builder (mirrors the existing `techFactory`'s
    shuffle-once-then-shift determinism) and 2 new factory instances wired into `getFactories()`,
    giving both the automatic (`applyRandomBoardSetup`) and manual/custom setup flows seeded
    Standard-Tech-tile and Federation-token assignment for free. Transcribed the exact rulebook
    setup-distribution quotes verbatim into `RULES_CLARIFICATIONS.md` §C4 (previously found but not
    yet quoted): Standard Tech tiles place 1 per ship onto Rebellion/T F Mars/Eclipse's single slot (2
    of 3 placed at 2p, all 3 at 3-4p); Federation tokens place 1 per ship onto all ships in play (3 of 8
    at 2p, 4 of 8 at 3-4p) — both leave the rest in the box. **321/321 engine tests pass** (299
    baseline + 22 new: `spaceships.spec.ts`, `tiles/spaceship-techs.spec.ts`,
    `tiles/spaceship-federations.spec.ts`, `setup.spec.ts` covering 2p/3p/4p seeding counts, Rebellion
    exclusion, no-duplicates, no-op without the expansion, and same-seed determinism).
    **Explicitly deferred, not guessed past (all out of this chunk's locked-in scope):**
    - The **Explore action** itself (shuttle deployment onto a spaceship's exploration track, the
      power-charge cost per §C5, range/Q.I.C. extension per D1) — no exploration-board subsystem
      exists yet (flag 4 below).
    - The **12 ship board-actions' live availability/execution** (re-score a Federation token, build a
      Research Lab/Trading Station as a granted action, instant Gaiaforming, advance a Research
      track, etc.) — `spaceshipBoards`' `cost`/`effect` strings are descriptive only, not wired to
      `available/actions.ts` or any `move/*.ts` handler.
    - **Examine Artifact** (Twilight-only: discard 6 power → gain 1 Artifact) and **Twilight's
      Artifact-token setup seeding** (= player count, drawn from the 13 Artifact tokens) — paired
      together for a future chunk since the seeding has no standalone value without the action that
      consumes it.
    - The **Form-a-Federation / Upgrade-Existing-Structures hooks** that let a player actually redeem
      a ship-seeded Standard Tech tile or Federation token once they've explored that ship — the
      seeding now happens at setup, but nothing yet lets a player claim what's seeded.
13. ✅ **Lost Fleet map subsystem — geometry + tile data (Chunk 5) CODED & TESTED**
    (`RULES_CLARIFICATIONS.md` §H1–H5, `COMPONENTS.md` §6, done 2026-06-28). New self-contained
    `engine/src/lost-fleet-map.ts` (+ `lost-fleet-map.spec.ts`, 16 tests) that **does not touch the
    base-game `SpaceMap` generation** (so all base tests stay valid). What's coded:
    - `lostFleetSectorCenters(nbPlayers)` — the "Variable Gameboard Layout" sector centres for 2p
      (1 inner + 6 shifted ring = 7), 3p (+2 shifted extras = 9), 4p (2 adjacent inner hubs + 8
      shifted outer = 10). Built parametrically from a single `SHIFTED_OFFSET = (5,-1,-4)` ("slide
      one space, border the inner sector along only 2 spaces") rotated 6 ways via the engine's own
      `Hex.rotateRight`, so it shares the grid's coordinate/rotation convention.
    - `findInterspaceHoles(centers)` — the single-hex interior holes (Interspace slots). Returns
      exactly **6 / 8 / 10** isolated singles for 2/3/4p, matching the rulebook hole counts. Found via
      halo connected-components: every bounded (non-outer) component is size 1.
    - `findDeepSpaceNotches(centers)` — the perimeter 3-hex triangle gaps (Deep Space slots). Returns
      **6 / 8 / 8** triangles, one per adjacent-outer-sector wedge, matching the tiles physically
      placed (`deepSpaceTileCount()`).
    - `DEEP_SPACE_TILES` (§H2, all 8 tiles × 2 faces of Protoplanet/Asteroid/Transdim/Blank, incl. the
      tile-16 asteroid swing §H5 keys off), `DEEP_SPACE_TILES_2P` (11–16), `INTERSPACE_SETS`/
      `interspaceSet()` (§H3 per-player-count composition, Rebellion excluded at 2p).
    - **§H4 stub, flagged not guessed:** `REVISED_SECTOR_FACES_TODO` records that sectors 5/6/7 need a
      Lost-Fleet revised face at 2p/3p (`available: false` → callers fall back to the base-game face)
      until the physical art is supplied. Still the one remaining art-only TODO.
    - **Key correction captured this session (was the long-standing "picture 11" defect):** Deep Space
      tiles are **3-hex triangles** (perimeter only) and Interspace tiles are **single hexes**
      (interior only). The earlier draft 4p layout wrongly produced two 3-hex clusters in the *middle*;
      the fix slides the offending sectors one hex so all interior gaps are clean singles. The geometry
      is now verified for all three player counts (0 overlap, correct hole/notch counts, no adjacent
      interior holes). **337/337 engine tests pass** (321 baseline + 16 new).
    **Deferred (out of this chunk's scope):** wiring these layouts into a playable `SpaceMap` (planet
    placement onto Interspace/Deep Space hexes, the "no spaceship within 3 spaces" Interspace spacing
    rule §H1, the 3p "2 adjacent Deep Space tiles in the larger gap" rule), and the `GaiaHex`
    sector-type classification (Space / Deep Space / Interspace) that Darkanians' PI ability needs —
    the geometry foundation for that classification now exists.
14. ✅ **Lost Fleet board assembly — full `Grid<GaiaHex>` generation (Chunk 6) CODED & TESTED**
    (`COMPONENTS.md` §6, done 2026-06-28). New self-contained `engine/src/lost-fleet-board.ts`
    (+ `lost-fleet-board.spec.ts`, 8 tests), completing the deferred items from Chunk 5. What's coded:
    - `generateSectorGrid()` places the (shuffled, randomly rotated) Space Sector tiles onto
      `lostFleetSectorCenters()`, reusing the existing `s1..s10`/`s5b/s6b/s7b` planet-layout strings
      from `map.ts` (newly exported for this) instead of re-encoding them — §H4's revised-face gap is
      filled with the base game's matching per-count choice (B-side 2p/3p, A-side 4p), per the
      owner-confirmed fallback.
    - `placeInterspaceTiles()` fills the Interspace holes per §H3's composition, drawing ship
      identities from the existing `shipsInPlay()` (Rebellion excluded at 2p) and enforcing the §H1
      spacing rule (no two spaceship tiles within hex-distance 4) via rejection sampling — verified
      empirically to converge in practice (~7-10% of random subsets are valid at every player count).
    - `placeDeepSpaceTiles()` fills the Deep Space notches per §H2 (tile pool restricted to ids 11-16
      at 2p). The 3p-only "2 tiles in the larger gap" rule needed **no special-casing**: a new
      `findAdjacentNotchPairs()` (in `lost-fleet-map.ts`) found that exactly one pair of notches is
      itself hex-adjacent at 3p, and none at 2p/4p — a fixed property of the (never-randomized)
      sector-center geometry — so the rule falls out for free from uniform one-tile-per-notch
      placement. This upgraded an earlier weaker "deterministic convention" approach (which the user
      had approved via `AskUserQuestion` as a fallback) to a fully confirmed geometric match; see
      RULES_CLARIFICATIONS.md §H1 note 4 for the full writeup.
    - `LostFleetSectorType`/`classifySectorId()` (in `lost-fleet-map.ts`) classify any `GaiaHex` as
      Space/Deep Space/Interspace from its `sector` id string (`IS<n>`/`DS<tileId>`/anything else) —
      the classification Darkanians' PI ability needs (still not wired to that ability itself, see
      flag 6 below).
    - `gaia-hex.ts` gained an optional `spaceship?: Spaceship` field on `GaiaHexData` (ship-bearing
      Interspace tiles use `Planet.Empty` + this field, since `Planet` has no "ship" value).
    - **Bug found, documented, NOT fixed (out of scope for "data structure only"):**
      `GaiaHex.toString()`/`relativeCoordinates` assume the base game's `MATCHED_OFFSET` sector
      spacing and will silently miscalculate for Lost-Fleet-placed (`SHIFTED_OFFSET`) sectors. The new
      module never calls `.toString()` on its hexes, so it's unaffected, but this MUST be fixed before
      any future chunk wires Lost Fleet sectors into live move-command parsing
      (`SpaceMap`/`moveInit`/`move/setup.ts`). See RULES_CLARIFICATIONS.md §H1 note 7.
    - **Still standalone, per the agreed "data structure only" scope** (confirmed with the user before
      starting): NOT wired into `SpaceMap`/`moveInit` — that needs the addressing fix above first.
    **345/345 engine tests pass** (337 baseline + 8 new).
15. ✅ **`GaiaHex` addressing bug FIXED (Chunk 7a)** (done 2026-06-28). Fixes the bug flagged in
    "Done so far" #14 above, as its own commit per the user-confirmed plan:
    - `Sector.create()` (`sector.ts`) now stamps every hex it creates with the `center` it was built
      around (`sectorCenter?: CubeCoordinates` on `GaiaHexData`).
    - `GaiaHex.relativeCoordinates` (`gaia-hex.ts`) prefers that stamped `sectorCenter` (exact: direct
      subtraction) when present, falling back to the old lattice-reduction guess only for hexes built
      without going through `Sector.create()` (legacy serialized game state, or direct
      `new GaiaHex(...)` calls e.g. in `player.spec.ts`). Verified mathematically and empirically
      identical to the old guess for every base-game sector (rotation-safe too, since
      `Hex.rotateRight(times, center)` pivots around `center`, which never moves).
    - `GaiaHex.toString()` now special-cases non-Space sector ids (`classifySectorId()`) to return the
      raw sector id directly, instead of asserting on a suffix-table lookup that doesn't exist for
      Interspace/Deep Space hexes.
    - Deep Space sector ids changed from the shared `DS<tileId>` to the per-hex-unique
      `DS<tileId>_<0-2>` (`lost-fleet-board.ts`), since all 3 hexes of one notch previously shared one
      id — now each has its own unique address.
    - New `gaia-hex.spec.ts` (7 tests) covers: stamped-center hexes match the legacy suffix for an
      unshifted sector, a sector centered away from the origin, rotation-safety, the no-`sectorCenter`
      fallback path, and the new Interspace/Deep Space `toString()` behavior (no throw, raw id
      returned).
    **352/352 engine tests pass** (345 baseline + 7 new). Zero regressions — every existing
    base-game `toString()`/coordinate-parsing test (e.g. `map.spec.ts`, full-game replays) still
    passes unchanged, confirming the fix is a behavior-preserving no-op for the base game.
    **Still NOT wired into `SpaceMap`/`moveInit`** — that's Chunk 7b, see "Next actions" below; scoping
    it surfaced more complexity than originally anticipated (see that section).
16. ✅ **German-rules adjacency reroll on the assembled Lost Fleet board, + Chunk 7b `SpaceMap`/
    `moveInit` wiring, CODED & TESTED** (done 2026-06-28; this entry backfills an undocumented fix from
    a prior session alongside this session's Chunk 7b work).
    - **Backfilled, previously undocumented:** `generateLostFleetBoard()` (`lost-fleet-board.ts`) gained
      its own German-rules reroll loop (`isValidBoard()` + `MAX_LAYOUT_ATTEMPTS = 50`, re-deriving the
      RNG per attempt), mirroring the guarantee the base game's `SpaceMap` constructor already provides
      via its own `isValid()` retry loop — Chunk 6 had assembled the board but never checked the
      no-same-planet-adjacent rule across sector boundaries. **352/352 → 353/353** (+1 test: "should
      never place two hexes of the same planet type next to each other").
    - **Chunk 7b — wired into `SpaceMap`/`moveInit`.** First extended `generateLostFleetBoard()` to also
      return per-sector placement metadata (tile name/rotation/center, reusing the existing
      `SectorInMapConfiguration` type from `map.ts`) so a `MapConfiguration`-shaped record could be
      populated for sector-suffix coordinate parsing. **353/353 → 354/354** (+1 test).
      Then: `SpaceMap`'s constructor gained a 5th `lostFleet` parameter — when set, it calls
      `generateLostFleetBoard()` directly and assigns `this.grid`/`this.placement`, bypassing the base
      game's random-tile-shuffle/`isValid()`-reroll loop entirely (Lost Fleet has its own, see above).
      `configuration()` gained a Lost-Fleet branch (real sector centers, empty fixed-tile pool, so
      `rotateSector()`'s center-validation assertion still works correctly). `parse()` gained a fallback
      branch for non-Space-sector coordinate strings (`IS<n>`/`DS<tileId>_<n>`, via
      `classifySectorId()`) that linear-scans the grid for the matching hex's `toString()`, since those
      hexes have no sector-suffix table entry to reverse through. `moveInit()` (`move/setup.ts`) threads
      `engine.options.lostFleet` through to the `SpaceMap` constructor, and gained two new incompatibility
      asserts: Lost Fleet cannot be combined with a custom pinned `map.sectors` configuration (only
      seed-based random generation is supported by this generator), nor with `customBoardSetup` (manual
      board drafting calls `engine.map.generate()` directly, which would silently build a base-game-
      shaped board). `Engine.fromData()` restores `map.lostFleet` on deserialization, mirroring the
      existing `map.layout` restore, so `configuration()`/`rotateSector()` keep working after replay.
      **Verified safe, by design, with no further code changes needed:** `rotateSector()`'s mechanics
      (rotates only the 19 hexes of a sector's own hexagon around its fixed center — Interspace/Deep
      Space holes are geometrically outside any sector's hexagon, so rotation never touches them);
      `Grid.recalibrate()` (hexagrid library; pure shape-agnostic re-index, no Lost-Fleet-specific
      concern); the `advancedRules + lostFleet` combination (pre-game sector rotation is an intentional,
      still-supported Lost Fleet feature, not an incompatibility); and the `map.ts` ↔ `lost-fleet-board.ts`
      circular import (safe — all cross-references are inside function bodies, never at module-evaluation
      top level).
      New `map.spec.ts` "Lost Fleet" test block (7 tests): `SpaceMap(..., lostFleet=true)` matches
      `generateLostFleetBoard()` exactly for a given seed; `getS()`/`toString()` round-trip across Space,
      Interspace, and Deep Space hex addressing; `rotateSector()` accepts a real Lost Fleet center and
      rejects a non-center coordinate, preserving hex count/no collisions; the two new incompatibility
      asserts fire; and an end-to-end `Engine` game builds a genuinely Lost-Fleet-shaped board that
      survives a `toJSON()`/`fromData()` serialization round trip. **354/354 → 361/361** (+7 tests).
17. ✅ **Darkanians' Planetary Institute ability, CODED & TESTED** (done 2026-06-28).
    The deferred Chunk-3 gap is now closed using the Lost Fleet sector-type foundation added in Chunks
    5/6/7b. `engine/src/faction-boards/darkanians.ts` now hooks `build-m` and `build-colony` so that,
    once the PI is built, the Darkanians gain **2 credits + 1 knowledge** the first time they colonize a
    **Space** sector or **Deep Space** sector; **Interspace** is explicitly ignored per the rulebook.
    Deep Space is grouped per physical tile, not per addressed hex (`DS14_0` / `DS14_1` / `DS14_2`
    collapse to `DS14` for this ability), so the reward only fires once per Deep Space sector.
    The implementation intentionally counts prior colonization history even if it happened before the PI
    was built, matching the engine's existing Geodens pattern for PI-gated "first/new" checks.
    New `player.spec.ts` integration coverage proves all four edges through the real `build()` flow:
    no retroactive reward for a sector first colonized before PI, reward once for the first later Space
    sector, no reward for Interspace, and reward once per Deep Space tile. **361/361 → 362/362** (+1
    test). No base-game behavior changed.
18. ✅ **Lost Fleet Explore action core, CODED & TESTED** (done 2026-06-28).
    The first live-gameplay slice of Spaceship Boards is now in place without touching the viewer.
    New `engine/src/exploration.ts` centralizes the reusable rules/data hooks: per-player explored-ship
    state, 2-player vs. 3/4-player shuttle limits, "one shuttle per ship," lowest-free-slot placement,
    the shared `0/2/2/3` slot-charge track, range measurement **from colonized planets only** (never
    from a spaceship, matching §D3), and the faction-specific deploy adjustments for Taklons, Nevlas,
    Itars, and Bal T'aks. `player-data.ts` now persists `explorationShips` through `toJSON()` /
    `fromData()`, giving later chunks a clean foundation for "explored ship" gating.
    Live command plumbing is in with a dedicated `Command.Explore`: `available/exploration.ts` exposes
    reachable ships during `BeforeMove`, and the existing temporary-range subphase
    (`BuildMineOrGaiaFormer`) now also offers Explore, so temporary-range effects can feed spaceship
    exploration cleanly instead of remaining build-only. `move/exploration.ts` executes the action:
    pay the deploy + Q.I.C. cost, apply the Taklons brainstone move when relevant, record the occupied
    slot, and immediately grant the slot's charge-power reward.
    Focused coverage in new `exploration.spec.ts` proves 2-player Rebellion exclusion, cost payment,
    slot assignment / charge timing, one-shuttle-per-ship + 2-player shuttle-cap enforcement,
    Taklons/Nevlas deploy adjustments, and serialization round-trip safety. **362/362 → 366/366** (+4
    tests). Full engine suite passes at **366/366**.
19. ✅ **Spaceship Federation claim hook, CODED & TESTED** (done 2026-06-28).
    Forming any federation can now also redeem a ship-seeded Lost Fleet Federation token from an
    explored ship, without any adjacency requirement between that ship and the formed federation
    (`RULES_CLARIFICATIONS.md` §E3). `available/federations.ts` now surfaces the currently claimable
    ship-token choices on the existing `Command.FormFederation` command, keyed purely off
    `explorationShips` plus the unclaimed token still seeded on that ship. `move/federation.ts` now
    treats those ship tokens as **additional selectable federation options** during federation
    formation, rather than as an extra auto-claim layered onto a normal federation pick.
    Claimed ship tokens are persisted separately in `player-data.ts` so the engine can already treat
    them as owned federation tokens for **counting and green-side consumption** (`Condition.Federation`,
    `hasGreenFederation()`, `removeGreenFederation()`), without prematurely guessing at the still-open
    gold-side execution for the special build-action tokens. Focused additions in `exploration.spec.ts`
    prove the non-adjacent redemption rule, that explored ship tokens join the federation choice list,
    that multiple explored ships present multiple selectable ship-token options, and the
    owned-token counting/green-side seam.
    Full engine suite passes at **370/370**.
20. ✅ **Spaceship Standard Tech claim hook, CODED & TESTED** (done 2026-06-28).
    Explored ships now surface their seeded Lost Fleet Standard Tech tile directly on the existing
    `Command.ChooseTechTile` flow, alongside the normal research-board choices. The claim path stays
    engine-native instead of inventing a parallel command: `available/research.ts` adds explored /
    unclaimed ship tiles as extra tech choices, `move/research.ts` removes a claimed tile from
    `engine.tiles.spaceshipTechs`, and the claimed tile is stored in `player.data.tiles.techs` as a
    normal **coverable** Standard Tech so later Advanced Tech flow can still treat it like any other
    claimable tech slot. The follow-up Lost Fleet research advance is handled by the same post-claim
    upgrade subphase already used by the existing tech-pick machinery. To avoid guessing ahead of the
    still-open "live ship-board actions / tile effects" slice, the 3 new Lost Fleet Standard Tech
    tiles are still effect-text-only for now — this hook lands ownership, availability, removal, and
    coverability, not their unique effect execution yet. Focused additions in `exploration.spec.ts`
    prove availability from explored ships, removal from the ship on claim, the extra research
    advance, and later coverability by an Advanced Tech tile.
    Full engine suite passes at **372/372**.
21. ✅ **Spaceship Boards live-gameplay wiring, first slice — CODED & TESTED** (done 2026-06-28).
    Explored ships now expose their board actions through the normal turn-action flow instead of
    only owning static cost/effect text. New `engine.spaceshipActions` field tracks a per-round,
    per-ship-action lock (`{[ship]?: {[actionType]?: PlayerEnum}}`), reset alongside the base game's
    own board-action reset in `move/phase.ts`'s `cleanUpPhase()` — once any player takes a given
    ship's action, it's locked for everyone until the next round. `available/spaceship-actions.ts`
    surfaces only affordable, unlocked actions on explored ships during `SubPhase.BeforeMove`; the
    existing `Command.SpaceshipAction` move handler in `move/spaceship-actions.ts` pays the cost and
    loads the action's effect as a normal `Event`, reusing — not duplicating — base-game reward
    machinery: Rebellion's QIC action chains into the same `Resource.TechTile` listener the base
    game's QIC1 board action uses (`SubPhase.ChooseTechTile`), and Twilight's QIC action chains into
    the same `Resource.RescoreFederation` listener the base game's QIC2 board action uses
    (`SubPhase.RescoreFederationTile`) — both pre-existing engine mechanisms, reused unmodified.
    This slice wires exactly 6 of the 12 total ship actions, the set the user confirmed as in scope:
    Twilight QIC (3q → re-score an owned Federation token), Rebellion QIC (3q → claim a Tech tile,
    same as the base game's QIC1 action) and Knowledge (2k → 2c + 1q), T F Mars QIC (2q → 2vp + 1vp
    per owned Tech tile), and Eclipse QIC (2q → 2vp + 1vp per distinct colonized planet type) and
    Power (3pw,2k → a free research-track upgrade of choice). Deliberately deferred to a later chunk
    (still ☐ TODO, see "Next actions" below): every build-bypass ship action, T F Mars's Power action
    (Instant-Gaiaforming), Examine Artifact + Twilight's Artifact-token seeding, and the gold-side
    execution for claimed ship Federation tokens.
    New `move/spaceship-actions.spec.ts` proves: no action offered before a ship is explored, no
    action offered if unaffordable, an affordable action is offered/locks for every player once
    taken/survives serialization, and each of the 6 actions' full cost-payment + effect for both
    immediate-reward and chained-subphase effects (Twilight's federation re-score, Rebellion's
    tech-claim + chained research upgrade, Eclipse's chained research upgrade). **372/372 → 387/387**
    (+9 tests). No base-game behavior changed — `Resource.RescoreFederation` and the tech-claim
    listener are pre-existing base-game mechanisms, only reused, not modified.
22. ✅ **T F Mars's Power action — Instant-Gaiaforming — CODED & TESTED** (done 2026-06-28). T F Mars's
    Power action (2pw) converts a Transdim planet within range into a Gaia planet immediately — no
    `Building.GaiaFormer` is placed, and the player doesn't wait for the next `RoundGaia` phase to flip
    it, unlike the base game's normal Gaiaforming path. New `Command.GaiaFormTransdim` /
    `SubPhase.InstantGaiaforming` chain off the existing `Command.SpaceshipAction` handler (mirroring
    how Eclipse's Power action already chains into `SubPhase.UpgradeResearch`):
    `available/spaceship-actions.ts`'s new `possibleInstantGaiaforming()` lists every reachable,
    unbuilt Transdim hex, reusing the base game's own `qicForDistance()` range-cost helper (same one
    `possibleSpaceLostPlanet()` uses) so off-range targets cost extra Q.I.C., exactly like the base
    game's Lost-Planet placement; `move/spaceship-actions.ts`'s new `moveGaiaFormTransdim()` pays that
    Q.I.C. cost and flips the target hex's `planet` field straight to `Planet.Gaia`. `spaceships.ts`'s
    `spaceshipActionEffects[Spaceship.TFMars]` gained an empty `power: []` entry (the same convention
    Eclipse's Power action already uses) to mark the action as wired-via-bespoke-logic rather than
    through the declarative Reward/Event grammar. New test in `move/spaceship-actions.spec.ts` finds
    the cheapest reachable Transdim hex on the randomly-seeded Lost Fleet board, takes the action, and
    asserts the 2-power cost, the dynamically-computed Q.I.C. range cost, the planet flip, and that no
    building was placed. One pre-existing test ("should not offer an action the player cannot afford")
    needed updating: it relied on T F Mars having only one wired action (QIC) so a low QIC balance
    alone made the ship's whole action list unavailable; now that the Power action is also wired, the
    test additionally zeroes the player's power tokens so neither action is affordable. **387/387 →
    388/388** (+1 test). This wires the 7th of the 12 ship-board actions; see "Next actions" below for
    the remaining 5 plus the two separate not-counted-in-12 features (Examine Artifact, Federation
    gold-side execution).
23. ✅ **Spaceship Boards live-gameplay wiring, COMPLETE — all 12 of 12 actions CODED & TESTED**
    (done 2026-06-28). The remaining 5 ship-board actions are now live, closing out the
    "Next actions" item #1 below.
    - **Twilight's Knowledge action** (1k → +3 range for Build a Mine/Gaiaforming/Exploring a ship)
      needed only a declarative `spaceshipActionEffects[Twilight].knowledge = ["3range"]` entry —
      zero new Command/SubPhase code. Granting `Resource.TemporaryRange` already triggers the
      engine's existing `gain-${Resource.TemporaryRange}` listener (`engine.ts`), which forces
      `SubPhase.BuildMineOrGaiaFormer` — a subphase that already bundles exactly the 3 documented
      uses (`possibleMineBuildings(..., true)` + `possibleExplorations(...)`).
    - **The other 4 (Eclipse Credit, T F Mars Credit, Rebellion Power, Twilight Power)** all place or
      upgrade a building, so each is wired as bespoke `Command.Build`-shaped available-command data —
      reusing the existing `moveBuild`/`placeBuilding` machinery unmodified (zero new move code),
      exactly mirroring how `possibleLabDowngrades`/`possiblePISwaps` already produce non-build-cost
      `Command.Build` data. Two new `SubPhase`s chain off `moveSpaceshipAction()` after the fixed
      ship-board fee is paid: `SpaceshipBuildMine` (Eclipse Credit / T F Mars Credit, via new
      `possibleSpaceshipBuildMine()`) and `SpaceshipUpgradeBuilding` (Rebellion Power / Twilight Power,
      via new `possibleSpaceshipUpgradeBuilding()`), both in `available/spaceship-actions.ts`.
      - Eclipse Credit: free Mine on any in-range, unoccupied Asteroid (`pl.canOccupy`); cost is QIC
        range-extension only, the 6c fee covers the mine itself.
      - T F Mars Credit: Mine on any in-range, non-Transdim/non-Asteroid hex; the 3c fee covers only 1
        terraforming step — the mine's normal building cost (`pl.board.cost(Building.Mine)`, 2c+1o) and
        ore for any `terraformingStepsRequired(...) - 1` further steps are still paid through the
        `Command.Build` data, plus QIC for range extension (owner-confirmed 2026-06-28 correction; an
        earlier draft of this action had mistakenly folded the mine's building cost into the 3c fee).
      - Rebellion Power: upgrades a Mine the player already owns into a Trading Station, **ignoring
        the normal isolation check** — no new hex, so no range/QIC/terraform applies at all (confirmed
        with the user: only a genuinely new hex placement needs those).
      - Twilight Power: upgrades a Trading Station the player already owns into a Research Lab, same
        no-range/no-terraform reasoning.
    - `spaceshipActionEffects` gained empty-array placeholders (`power: []` / `credit: []`) for these 4
      actions, marking them wired-via-bespoke-SubPhase rather than declarative Reward/Event strings —
      the same convention already used for Eclipse/T F Mars's Power actions.
    - New tests in `move/spaceship-actions.spec.ts` cover all 5 actions end-to-end (fee payment, any
      leftover per-hex QIC/ore cost, and the resulting building placement/upgrade), including a
      Twilight-Power case that chains through the Research Lab's granted Tech-tile + free research-track
      reward. One pre-existing test ("should not offer an action the player cannot afford") needed an
      added `credits = 2` so T F Mars's now-wired Credit action doesn't make the ship's action list
      affordable again. **388/388 → 393/393** (+5 tests: 1 for Knowledge, 4 for the build-bypass
      actions). All 12 of 12 Spaceship Board actions are now live; only Examine Artifact + Twilight's
      Artifact-token seeding and the gold-side execution for claimed ship Federation tokens remain as
      separate, not-counted-in-12 features (see "Next actions" below).
24. ✅ **Federation tokens' gold-side execution, COMPLETE for all 8 claimed-ship tokens** (done
    2026-06-28). Closes out the "gold-side execution for claimed ship Federation tokens" half of the
    item flagged in #23 above; only Twilight's Examine Artifact + Artifact-token seeding remains (see
    "Next actions" below).
    - **6 direct-reward tokens** (Credit/Knowledge/OreQic/Tech/Vp/PowerTokens) grant their income the
      moment the ship's federation is claimed, via `pl.gainSpaceshipFederationToken()` in `player.ts`:
      Credit/Knowledge/OreQic/Tech/Vp parse straight into `Reward.parse`-compatible income strings;
      PowerTokens is the one exception, mutating `power.area3` directly since no `Resource` grants
      power tokens straight into Area III.
    - **Range/Terraform** each grant a one-time bonus Build a Mine action instead of a direct reward.
      A new `SubPhase.FederationTokenBuildMine` chains off `moveFormFederation()`'s claimed-ship branch
      in `move/federation.ts` (mirrors the `SpaceshipBuildMine` chaining pattern from #23), generating
      commands via a new `possibleFederationTokenBuildMine()` in `available/federations.ts`: excludes
      Transdim/Asteroid hexes (same as the non-Eclipse branch of `possibleSpaceshipBuildMine`); Gaia
      planets still cost their normal `gaiaFormingCost()` QIC (a habitability cost, not the build cost,
      so it is never waived by either token); Range waives range-extension QIC entirely (limitless
      range) but still charges full terraforming ore with no discount; Terraform charges normal range
      QIC but discounts terraforming ore by up to 3 steps — since `terraformingStepsRequired()` never
      exceeds 3 for any faction in the game, this discount is in practice always a full waiver of
      terraforming ore, never a partial one.
    - New tests: 5 unit tests directly on `possibleFederationTokenBuildMine` (Transdim/Asteroid
      exclusion, Range's zero-QIC/full-ore cost shape, Terraform's normal-QIC/discounted-ore cost
      shape, Gaia-hex QIC stacking for both tokens, mine-limit exhaustion returns no commands) in new
      `available/federations.spec.ts`, plus 2 end-to-end tests in `exploration.spec.ts` exercising the
      full claim-ship-federation → chained Build-a-Mine pipeline for both tokens. Direct-reward token
      coverage lives in `player.spec.ts`. **393/393 → 399/399** (verified via `git checkout` at this
      entry's final commit, `7d38a88`; a previous draft of this entry overstated the total as
      407/407 — corrected here since that wrong baseline was about to propagate into later entries).
25. ✅ **Rescore (QIC2 board action) now offers claimed ship Federation tokens, not just pool-drawn
    ones — CODED & TESTED** (done 2026-06-29). User report: "Restoring a Fed you should be able to
    choose from whichever fed tile you have which also includes the ship federations if you've
    claimed one." `possibleFederationTiles(engine, player, "player")` (the rescore branch) previously
    only listed `pl.data.tiles.federations` (pool tokens); it now also lists
    `pl.data.spaceshipFederations` (ship-claimed tokens), via `available/federations.ts`. The
    `Command.ChooseFederationTile` data's `tiles` field widened from `Federation[]` to the existing
    `AvailableFederationChoice` union (`available/types.ts`), mirroring `Command.FormFederation`'s
    existing use of the same union.
    `move/federation.ts`'s `moveChooseFederationTile()` now branches the rescore case on whether the
    chosen tile is a `SpaceshipFederation` (`Object.values(SpaceshipFederation).includes(...)`, not
    `Federation.values()` — the latter deliberately excludes the PI-only `Federation.Gleens`, which
    would have been a subtly wrong reuse) or a pool `Federation`, dispatching to a new
    `rescoreSpaceshipFederationToken()` helper for the former. Per explicit user decision (confirmed
    via `AskUserQuestion`: "Treat 're-score = re-trigger the gold-side text' literally for every
    token"), rescoring is uniform across all 8 tokens with **no "only once" carve-out**: the 6
    direct-reward tokens re-grant their full income again (Credit/Knowledge/OreQic/Tech/Vp/
    PowerTokens), and Range/Terraform re-grant another one-time bonus Build a Mine action via the same
    `SubPhase.FederationTokenBuildMine` chain used on initial claim (`#24` above) — i.e. rescoring
    Range/Terraform a second time grants a second free mine, and rescoring Tech a second time grants
    another free Tech tile pick. Rescoring never removes the token from `spaceshipFederations` (it
    stays available to rescore again later, same as pool tokens staying in `tiles.federations`).
    New `describe("rescoring Federation tokens (§C1/§G6: re-score applies uniformly to pool and ship
    tokens)")` in `available/federations.spec.ts` covers: ship tokens appearing alongside pool tokens
    in the rescore list; a direct-reward token's exact gold-side numbers re-granted without removing
    it; PowerTokens' bespoke `power.area3` mutation re-applied; Range's bonus Build-a-Mine re-offered;
    Tech's free tile pick re-offered. Tests use a new `giveShipFederationTile()` helper that seeds
    `spaceshipFederations` directly (bypassing `gainSpaceshipFederationToken()`'s own reward grant) so
    each test's rescore call is the only reward grant, avoiding `MAX_CREDIT`-style cap clamping that
    would otherwise make the Credit token's assertion flaky. **399/399 → 404/404** (+5 tests).
26. ✅ **Federation token Build-a-Mine now includes Asteroid hexes (gated on a spare Gaiaformer),
    instead of blanket-excluding them — CODED & TESTED** (done 2026-06-29). User-shared BGG ruling
    from the designer (@theagricolan): the Range/Terraform tokens' cost waiver applies only to the
    mine's *building* cost — terraforming costs (ore for steps, QIC for Gaia, **and a Gaiaformer for
    Asteroid**) are still owed regardless. `possibleFederationTokenBuildMine()` previously excluded
    `Planet.Asteroid` hexes outright, treating the Gaiaformer requirement as if it conflicted with the
    waiver; that was wrong per the ruling — Asteroid's own *build* cost is already 0 ore/credit (same
    as the base game), so the token waiver changes nothing there besides making it a valid target once
    a spare Gaiaformer is available. Fixed by replacing the blanket Asteroid exclusion with the same
    gate `canBuild()` uses for normal Asteroid colonization
    (`pl.data.hasResource(new Reward(1, Resource.GaiaFormer))`); Transdim stays excluded (needs
    `Command.GaiaFormTransdim`, a separate action, not a cost). The Gaiaformer is consumed
    automatically by `player.build()` once the mine is placed, same as any other Asteroid mine.
    Replaced the old single "excludes Transdim and Asteroid hexes" test in `available/federations.spec.ts`
    with 3 tests: Transdim exclusion alone, Asteroid inclusion at `"~"` (zero) cost plus permanent
    Gaiaformer consumption on build, and Asteroid exclusion once `gaiaformers = 0`. **404/404 →
    406/406** (net +2 tests: 1 old test removed, 3 new ones added).
27. ✅ **Space Giants' Exploration-board special action — CODED & TESTED** (done 2026-06-29). Per
    explicit user decision (confirmed via `AskUserQuestion`), this was the next item picked off the
    "Next actions" list. Added a once-per-round "Build a Mine with 2 free terraforming steps" special
    action by appending a single `"=> 2step"` entry to `space-giants.ts`'s base `income` array — no new
    engine logic was needed anywhere else. This reuses, unmodified: the existing `Operator.Activate`
    ("=>") lifecycle (`Player.activateEvent()` sets `activated = true`; `move/phase.ts`'s
    `cleanUpPhase()` resets it every round-end, exactly like the `bescods.ts` precedent
    `"=> up-lowest"`, which proved a non-building-gated base-income Activate entry works as a recurring
    special action from turn 1); `possibleSpecialActions()` (already iterates `events[Operator.Activate]`
    generically, so no faction-specific gating code was required — other factions simply never have this
    event); the `Resource.TemporaryStep` ("step") reward type and its `gain-step` engine hook (auto-
    transitions into `SubPhase.BuildMine`); and `terraformingCost()`'s existing discount formula (already
    generic over however many free steps are granted). Added
    `describe("Space Giants - Exploration board special action")` to `space-giants.spec.ts` (3 new
    tests, using the same lightweight `createLostFleetRoundMoveEngine()` + direct-function-call pattern
    established in `available/federations.spec.ts`/`move/spaceship-actions.spec.ts`): the special action
    is offered once per round and fully covers a flat 2-step terraform (then locks for the rest of the
    round); a 3-step target (a Protoplanet, which always needs 3 steps regardless of faction) still
    charges ore for the 1 step beyond the 2 free ones; and the action is never offered to any
    non-Space-Giants faction. **416/416 → 419/419** (net +3 tests).
    (Note: `git stash` confirmed the actual pre-existing baseline at session start was **416/416**, not
    the 406/406 this doc had stated — a stale/miscounted tally predating this session, corrected here.)
28. ✅ **Scoring Board Extension's alternate Advanced Tech gate (§E6) — CODED & TESTED** (done
    2026-06-29). User confirmed there is no "medium Adv Tech tile" (a misspelling) and asked for this
    exact item — previously flagged as a gap in "Next actions" #2 — to be implemented. Added
    `AdvTechTilePos.ScoringExtension = "adv-ext"`, a 7th Advanced Tech slot not tied to any research
    field, included in `AdvTechTilePos.values(expansions)` only when Lost Fleet is active; the existing
    `techFactory`/`applyRandomBoardSetup` shuffle-and-assign machinery in `setup.ts` automatically seeds
    it with 1 randomly-drawn Advanced Tech tile from the general pool, with zero other changes needed —
    confirming the architectural finding that Lost Fleet always uses this automatic random-setup path
    (interactive/drafted setup is asserted against for Lost Fleet in `move/setup.ts`). Added a new
    `ScoringBoardExtensionSide` enum (`VictoryPoints` | `ExploredShips`) and an `Engine.scoringExtensionSide`
    field, decided once per game in `applyRandomBoardSetup()`: 2p always forces `VictoryPoints` (no RNG
    call at all, to leave 2p Lost Fleet's existing rng-call sequence untouched); 3-4p draw a 50/50
    `engine.map.rng()` call. `canTakeAdvancedTechTile()` (`available/research.ts`) now special-cases
    `AdvTechTilePos.ScoringExtension`: instead of the normal `data.research[field] < 4` check, it
    requires `data.victoryPoints >= 25` (VP side) or `data.exploredShipsCount() >= 3` (ships side,
    via the existing `PlayerData.exploredShipsCount()` helper) — the other 2 conditions (unflipped
    Federation token via `hasGreenFederation()`, an owned enabled Standard Tech tile to cover) are
    untouched, exactly as the rule requires, and were already field-agnostic in the existing code (no
    changes needed there). Verified by brute-forcing seeds where each side of the 50/50 split occurs at
    3p and 4p (`lf-ext-3p-0`/`lf-ext-3p-1`, `lf-ext-4p-0`/`lf-ext-4p-2`), confirming genuine
    randomization rather than a constant-folded branch. Added a new `describe("Scoring Board Extension
    (§E6)")` block to `setup.spec.ts` (6 tests: tile placement, no-op without Lost Fleet, 2p always
    forced, 3p and 4p randomize, deterministic-per-seed) and a new `available/research.spec.ts` (8
    tests: VP side gates on VP not research level, ships side gates on explored-ship count, Federation
    token and cover-tile conditions still apply, tile-stock check still applies, and the other 6 normal
    Advanced Tech tiles are unaffected — still gated by research level as before). **419/419 → 433/433**
    (net +14 tests). Separately noted, not yet actioned (see "Next actions"): the 6 newly-named Lost
    Fleet Advanced Tech tiles from §G2 (`asteroidpass`, `big`, `deep`, `deeppass`, `qaction`, `terra`)
    have never been implemented as engine content — confirmed via `git log --all -p` that all 15
    existing `AdvTechTile` enum members predate Lost Fleet entirely (a 2022 upstream bot commit). This
    Scoring Extension feature doesn't need them, since its randomly-drawn tile comes from the existing
    general pool — it's a separate, larger, not-yet-requested body of work.
29. ✅ **The 6 newly-named Lost Fleet Advanced Tech tiles (§G2) — CODED & TESTED** (done 2026-06-29).
    Added `AdvTechTile.AsteroidPass`/`Big`/`Deep`/`DeepPass`/`QAction`/`Terra`, gated behind
    `hasExpansion(expansions, Expansion.LostFleet)` inside `AdvTechTile.values(expansions)` — fixing the
    latent gap flagged in flag 5 above, where that function ignored its `expansions` parameter entirely.
    Added 3 new `Condition` members (`Asteroid`, `DeepSpaceSector`, `SpaceshipQicAction`) and wired their
    counts in `Player.eventConditionCount()`, the latter reusing the already-implemented
    `colonizedDeepSpaceSectorCount()` dedup helper from `lost-fleet-map.ts` for `deep`/`deeppass`. New
    `techTileSpec` DSL entries in `tiles/techs.ts`: `asteroidpass` = `ast | 2vp` (2 VP per colonized
    Asteroid, on pass); `big` = `PA > 6vp` (6 VP per Academy/PI built, immediately, max 3 buildings);
    `deep` = `ds > 4vp` (4 VP per distinct colonized Deep Space sector, immediately); `deeppass` =
    `ds | 2vp` (2 VP per distinct colonized Deep Space sector, on pass); `qaction` = `shipq >> 4vp` (4 VP
    per Q.I.C. spaceship action, wired via a new hook in `move/spaceship-actions.ts`'s
    `moveSpaceshipAction()`); `terra` = `step >> 2vp` (2 VP per terraforming step, scales with
    multi-step colonizations). All 6 effects confirmed unambiguous in `RULES_CLARIFICATIONS.md` §G2
    before coding. Added 1 regression test (`enums.spec.ts`, confirming the 6 tiles appear in
    `AdvTechTile.values(LostFleet)` and not in `.values(None)`), 5 effect tests (new
    `tiles/lost-fleet-techs.spec.ts`, one per tile except `qaction`), and 1 integration test
    (`move/spaceship-actions.spec.ts`, exercising `qaction` through the real `moveSpaceshipAction()`
    Q.I.C. hook). **433/433 → 440/440** (net +7 tests).
30. ✅ **Research-board Q.I.C. actions (qic1-3) now correctly disabled under Lost Fleet — RESOLVES flag
    #7** (done 2026-06-29). Owner-confirmed: in Lost Fleet, the base research-board Q.I.C. actions
    (`BoardAction.Qic1-3`) are entirely replaced by the 4 spaceship boards' own Q.I.C. actions, not
    offered alongside them (RULES_CLARIFICATIONS.md §E4/§K3). `BoardAction.values(expansions)`
    (`enums.ts`) previously ignored its `expansions` parameter entirely (same bug shape as flag 5,
    `AdvTechTile.values()`) — now mirrors that fix: Power1-7 always included, Qic1-3 included only when
    `!hasExpansion(expansions, Expansion.LostFleet)`. No other code changes were needed —
    `move/setup.ts` and `move/phase.ts` already called `BoardAction.values(engine.expansions)` when
    (re-)initializing `engine.boardActions`, so under Lost Fleet the `qic1`/`qic2`/`qic3` keys simply
    never get seeded to `null`, and the existing `actions[pwract] === null` availability check in
    `available/actions.ts` naturally excludes them (an `undefined` slot, never having existed, doesn't
    pass that check) — confirmed this holds through the real `Command.Action` flow, not just the
    enum function in isolation. Added a unit test (`enums.spec.ts`: `BoardAction.values(LostFleet)`
    excludes qic1-3, `.values(None)`/`.values(Frontiers)` include them), an availability-layer test
    (`available-command.spec.ts`: `possibleBoardActions` excludes qic1-3 under Lost Fleet even when
    affordable, base game unaffected), and an end-to-end test (`move/spaceship-actions.spec.ts`: a real
    Lost Fleet `Command.Action` never lists qic1/2/3). **440/440 → 443/443** (net +3 tests).
31. ✅ **`terra` Advanced Tech tile audited against "ANY source of free terraforming steps" — no bug
    found, confirmed by a new regression test** (done 2026-06-29). RULES_CLARIFICATIONS.md §G2 requires
    `terra` to fire on every terraforming step regardless of how it's paid for, explicitly calling out
    the "terra" New Federation token's 3-free-step Build-a-Mine as an example. Audited every production
    call site of `Player.build()`'s `stepsReq` parameter (the single place `receiveTerraformingStepTriggerIncome`
    is invoked, `player.ts`): (1) normal builds (`move/buildings.ts`'s `placeBuilding()` → `available/
    buildings.ts`'s `canBuild.steps`, computed as the full `terraformingStepsRequired()` count regardless
    of any cost discount) — correct; (2) the Federation tokens' bonus Build-a-Mine chain (`available/
    federations.ts`'s `possibleFederationTokenBuildMine()`) — also pushes the full, undiscounted `steps`
    count even though the Terraform token discounts the ore *cost* for those same steps — correct; (3)
    Space Giants' Exploration-board special action — reuses the same normal-build path (temporary step
    discount only affects cost, not the `steps` count) — correct; (4) `move/buildings.ts`'s
    `moveLostPlanet()` hardcodes `stepsReq=0` — correct, since placing the (wildcard) Lost Planet never
    requires terraforming; (5) `move/ships.ts`'s Customs Post build omits `stepsReq` entirely — correct,
    ships aren't terraformed. No code changes were needed. Added one regression test
    (`available/federations.spec.ts`: builds the same hex via the Terraform Federation token's free
    Build-a-Mine both with and without `terra` loaded, and confirms the VP delta between the two runs
    equals exactly `2 * steps` — i.e. `terra` fires on the discounted/free steps too, not just paid
    ones) directly covering the rules text's own worked example. **443/443 → 444/444** (net +1 test).
32. ✅ **Examine Artifact + Twilight's Artifact-token seeding, all 13 token effects CODED & TESTED**
    (`RULES_CLARIFICATIONS.md` §G6; `COMPONENTS.md` "Lost Fleet Spaceship Boards" row 1; the last item
    from "Next actions" #1). This was kept as 2 separate commands (`Command.ExamineArtifact`,
    `Command.ChooseArtifactToken`) rather than a 4th `SpaceshipActionType`, since `spaceships.spec.ts`
    hard-asserts exactly 3 actions per ship — but otherwise follows the same layered pattern as the
    other 12 ship actions (static data in `spaceships.ts`/`tiles/artifacts.ts`, availability in
    `available/artifacts.ts`, move handling in `move/artifacts.ts`, setup seeding via a new
    `scoringFactory(SetupType.ArtifactToken, ...)` entry in `setup.ts`). Examine Artifact costs 6 power
    (`"6t"`, discarded from any power area) and lets the player immediately claim one of the remaining
    Artifact tokens; all 13 tokens' effects are wired — 8 immediate-reward/VP tokens via a switch in
    `applyArtifactToken()`, the Federation token chains into the existing rescore subphase exactly like
    the ship-claimed Federation tokens, and the 5 simple resource/income tokens go through the existing
    DSL reward parser (`KnowledgeOre` in particular resolves as an `Operator.Income` event, i.e. ongoing
    income, not an immediate gain — confirmed by testing `player.resourceIncome()` deltas rather than
    instant balance changes). **Bug found and fixed while writing seeding tests**: the new
    `ArtifactToken` setup factory computed its target slot count via `artifactSlotCount(Spaceship.Twilight,
    nbPlayers)`, which doesn't itself check the active expansion — so without Lost Fleet, the factory
    still tried to seed `nbPlayers` slots from an empty `ArtifactToken.values(engine.expansions)` pool,
    leaving `engine.tiles.artifacts` as `[undefined, ...]` instead of `[]`. Fixed by gating the
    `setup.ts` call site on `hasExpansion(engine.expansions, Expansion.LostFleet)`, now covered by a
    regression test. The `ResearchLevel` token's Research Area (`ResearchField.Science`) remains a
    flagged ⚠️VERIFY best guess — the owner's rules-text comment on this token was cut off mid-sentence
    and was never confirmed; see the comment in `tiles/artifacts.ts` and `move/artifacts.ts`.
    **444/444 → 467/467** (net +23 tests: 18 in new `move/artifacts.spec.ts`, 5 new seeding/gating cases
    in `setup.spec.ts`).
33. ✅ **Viewer "Step Zero" — all pre-existing compile/runtime gaps surfaced by the Lost Fleet engine
    work are now fixed; `viewer/` builds and tests clean** (done 2026-06-29; this is prerequisite
    plumbing, not new Lost Fleet UI — see "Next actions" item 2 below, now resolved). Originally scoped
    as "6 missing `AdvTechTile` entries + 6 `Object.values(Faction)` call sites" but running the
    viewer's test suites surfaced a longer cascading chain of gaps, all fixed in this pass:
    - `data/factions.ts`: added the missing `factionData` entries for Darkanians/Space Giants
      (name/ability/PI text/shortcut), closing the exhaustive `{[key in Faction]: X}` map.
    - `planetsWithSteps`'s signature changed from `(planet: Planet, steps: number)` to
      `(faction: Faction, steps: number)` (Darkanians/Space Giants have no real home planet, so the
      function now derives the planet internally via `factionPlanet(faction)`); ripple fixed across
      `logic/charts/terraforming.ts` (`planetsForSteps`, 2 call sites) and `PlayerInfo.vue`.
    - `data/planets.ts` + `stylesheets/planets.css`: added color-data entries (`--asteroid` turquoise
      `#30d5c8`, `--protoplanet` pink `#ff66b3`, picked by Claude — COMPONENTS.md §10 names the colors
      but gives no exact hex) and `planetNames` entries for `Planet.Asteroid`/`Planet.Protoplanet`.
      This was the one genuine **runtime crash** in the batch (`TypeError` reading `.color` of
      `undefined` in `graphics/utils.ts`'s `newPlanetColors()`), not just a compile error — every other
      item in this list is a type-check-only fix.
    - Confirmed the engine's `.values(expansions)` namespace-merge pattern (established for `Faction`
      in Chunk 3/§I) is systemic across many more enums (`Planet`, `ResearchField`, `Building`,
      `RoundScoring`, `Booster`, `TechTile`/`AdvTechTile` + their `*Pos` variants, `BoardAction`,
      `ScoringTile`, `FinalTile`, `Spaceship`, `SpaceshipTechTile`, `SpaceshipFederation`,
      `ArtifactToken`). Grepped the whole viewer for every `Object.values(X)` call site against this
      list; found and fixed 2 more beyond the known 6 `Faction` sites: `logic/table/planets.ts`
      (`Planet.values(engine.expansions)`, per-game context) and `components/definitions/Filters.vue`
      (`Planet.values(Expansion.All)`, module-level static SVG-filter generator with no engine
      instance). No other call sites of this shape remain anywhere in `viewer/src`.
    - `data/tech-tiles.ts`: added a new `spaceshipTechTileData` table for the 3 `SpaceshipTechTile`
      Standard Tech tiles seeded onto Rebellion/T F Mars/Eclipse boards at setup (Range/Terraform/
      Resource — effects sourced from RULES_CLARIFICATIONS.md §G1), and widened `techTileData()`'s
      parameter type to `AnyTechTile | SpaceshipTechTile`. The engine's `ChooseTechTile` type
      (`available/types.ts`) already included `SpaceshipTechTileWithPos` alongside the normal tech/adv
      tech union, so `p.data.tiles.techs[].tile` was wider than the viewer's display-data lookup;
      `logic/table/research.ts`'s `techCell()` widened to match.
    - `logic/charts/testdata/all-families/planets.json`: updated the literal JSON fixture for the
      "Planets" chart to include the 2 new always-present Asteroid/Protoplanet columns (this chart's
      source list is `Object.keys(planetNames)`, not expansion-filtered — same existing convention as
      the always-present "Lantids guest mine" column — so the fixture, not the source, was the stale
      side).
    - **Verification:** `npm run quick-test` → **152/152 passing**, 0 TypeScript compile errors.
      `npm test` (full mochapack/webpack suite incl. Vue component specs) → **152 passing, 2 failing**;
      both failures are `BoardAction.spec.ts`'s `TypeError: moves.some is not a function`, confirmed
      **pre-existing and unrelated** to this work: the getter (`BoardAction.vue`'s `get recent()`) and
      its test's `makeTestStore()` mock (`recentCommands: () => []`, a function, vs. the component's
      bare-property read expecting an already-evaluated array — real Vuex getters don't need invoking)
      were introduced together in the same ancestor commit (`5d00aedd`, an old `master` release tag,
      long before any Lost Fleet work) and have never been touched since; none of this session's edited
      files are anywhere near `BoardAction.vue`/`BoardAction.spec.ts`/`store.ts`. Confirmed structurally
      (mock shape vs. usage pattern) rather than fixed, since it's out of Step Zero's scope — flagged to
      the user as a separately-tracked, already-broken test.
34. ✅ **Vercel deployment fixed — 3 independent root causes found and fixed in sequence** (done
    2026-06-29; infra/deploy-pipeline work, not Lost Fleet UI). The Vercel deploy for this branch had
    been failing since before this session; root-caused and fixed all 3 issues:
    - **Dead `popper` devDependency → SSH git-clone failure.** Both `viewer/package.json` AND
      `old-ui/package.json` (independently) had a stray bare `popper` devDependency (distinct from the
      actively-used `popper.js`), with zero references in either package's source. It transitively
      pulled in `rijs.sync` → a git-pinned `buble` fork resolved via an SSH URL
      (`git@github.com:pemrouz/buble.git`). Vercel's sandboxed build container has no SSH credentials,
      so `pnpm install` failed with `Command failed with exit code 128: git clone git@github.com:...`.
      Removing `popper` from both `package.json`s and regenerating both `pnpm-lock.yaml`s (workspace
      root `pnpm install`, since `shared-workspace-lockfile=false` means per-package lockfiles, but
      Vercel's `installCommand` runs at the workspace root and installs all 4 packages regardless)
      dropped the entire `buble`/`rijs` transitive subtree. Took 2 commits to find both occurrences,
      because fixing `viewer/`'s copy alone left `old-ui/`'s identical copy still triggering the same
      failure on the next deploy.
    - **Stale `.pnpm-store` build-cache corruption.** With the SSH issue fixed, the next deploy failed
      differently: `ENOENT: no such file or directory, open '/vercel/path0/.pnpm-store/v3/files/.../*-
      index.json'`, immediately after a build log line reading "Restored build cache from previous
      deployment." Vercel's persisted `.pnpm-store` (pnpm's content-addressable package store) from an
      earlier, failed deployment had a missing/corrupted content blob — unrelated to whether the
      lockfiles were correct (already proven via a from-scratch clean install). Fixed by having
      `vercel.json`'s `installCommand` `rm -rf .pnpm-store` before running `pnpm install`.
    - **`node_modules` was *also* being restored from the cache, defeating the `.pnpm-store` fix.** The
      very next deploy hit the *exact same* `ENOENT` on the *same* content hash, even with `.pnpm-store`
      cleared. Cause: Vercel's cache restoration also restores `node_modules` (root + each workspace
      package's own `node_modules`), which still contains pnpm's virtual store
      (`node_modules/.pnpm/...`) and `.modules.yaml` pointing at the now-wiped store. Seeing matching
      `node_modules`, pnpm treated the install as incremental ("Lockfile is up to date, resolution step
      is skipped") and tried to link the handful of changed packages against a store that no longer had
      their content. Fixed by also clearing `node_modules`, `engine/node_modules`, `viewer/node_modules`,
      and `old-ui/node_modules` in `installCommand`, alongside `.pnpm-store` — matching the exact
      from-scratch local repro that had already proven the lockfiles/build correct.
    - **Verification methodology:** for each fix, ran the *exact* Vercel `installCommand` then
      `buildCommand` locally from a fully clean state (`rm -rf` every `node_modules` + `.pnpm-store`
      first) rather than trusting an already-populated local install, since that's the only way to
      genuinely reproduce Vercel's fresh sandboxed container. **Final outcome confirmed via the Vercel
      MCP tools**, not just local repro: deployment `dpl_4Sy7WME2ZoK4g8Hih3hexLfbmis9` (commit
      `ca63d25`) reached **`READY`**, build completed in ~1m with 0 errors (only pre-existing
      bundle-size warnings, unrelated). The site is live at
      `gaia-lost-fleet-git-claude-lost-fl-6bd3b1-kimphamnguyensproject.vercel.app` (branch alias) and
      will auto-update on every future push to this branch.
35. ✅ **Branch consolidation — all Lost Fleet work merged onto this branch** (done 2026-06-29).
    The project had accumulated work spread across several parallel branches. Per the user's
    explicit choice (consolidate onto this branch, not master; delete superseded branches),
    cherry-picked every commit with unique value from the 3 branches that still had any:
    - `claude/spaceship-boards-gameplay-opnt1p` → `d50b75d`, "Fix T F Mars QIC action to count only
      Standard Tech tiles": `Condition.TechTile` was counting every tech tile including ones
      covered by an `AdvTechTile` at the same position, double-counting VP. Fixed by filtering with
      `isAdvanced(tech.pos)` (`engine/src/tiles/techs.ts`) before counting, in `player.ts`. Its
      other unique commit (`3e020cf`, refreshing `CLAUDE.md`/`AGENTS.md`) was stale by the time of
      this merge and superseded by the fresh rewrite below instead of being cherry-picked verbatim.
    - `claude/quirky-thompson-gt0n0h` → `25e9da5`, "add hex-map render smoke test, fix BoardAction
      mock": added `viewer/src/components/SpaceMap.spec.ts`, the first test that mounts the real
      `SpaceMap → Sector → SpaceHex` + `Definitions`/`FederationGradients` tree against a fixture
      Engine — the test that would have caught the `<defs>`-duplication regression in
      `PERFORMANCE.md` had it existed first. Also fixed 2 pre-existing broken tests in
      `BoardAction.spec.ts` (mock Vuex getters were zero-arg functions instead of plain values).
      Then `e4b1409`, "consolidate turn-order/persistence findings, add working agreements": added
      a **Working agreements** section (read current code before planning; the testing convention)
      and documented that the single-browser demo has no turn-locking or persistence by design
      (`Game.vue`'s `canPlay`, `self-contained.ts`'s fresh-Engine-per-load, `launcher.ts`'s
      `"player"`-event hook) — not bugs, just the current build stage; `Wrapper.vue`'s Export/Load
      buttons are today's manual workaround.
    - `claude/lost-fleet-expansion-gedyrk` → only unique commit was `52508fa`, a docs-only entry
      recording a Codex-branch merge and 2 regression fixes (exploration charge track reverted to
      the owner-confirmed `0/2/2/4`; a `SeededSpaceshipTech` `{tile, count}` shape mismatch in
      specs). The underlying code commits (`751bb69`, `6cf4ae7`, merge `f73b011`) were already
      ancestors of this branch and remain correctly in place (verified `EXPLORATION_CHARGE_TRACK =
      [0, 2, 2, 4]` in `spaceships.ts`, asserted by a test in `spaceships.spec.ts`) — only the
      *narrative* of that doc commit was new, and it was written against doc line numbers/test
      counts (`372/372` → `378/378`) many revisions out of date with this branch's `467/467` and
      35-item "Done so far" list, so it was skipped rather than cherry-picked verbatim.
    All cherry-picks verified with the project's real test commands (not raw `mocha`): engine
    `cd engine && npm test` → still 467/467; viewer `cd viewer && npx vue-cli-service test:unit
    --timeout 4000 'src/**/*.spec.ts' 'src/logic/**/*.spec.ts'` → 155/155, including the new
    `SpaceMap.spec.ts` test and the fixed `BoardAction.spec.ts` tests passing for the first time.
    Also rewrote `CLAUDE.md`/`AGENTS.md` from scratch (both were stale — wrong branch name, a dead
    Windows path, a `362/362`/`372/372` test count) to reflect the actual consolidated branch and
    current test counts. Branches with zero remaining unique value were deleted from `origin`:
    `claude/lost-fleet-advtech-tiles-c2fo8w`, `claude/lost-fleet-engine-work-l3bzsk`,
    `claude/spaceship-boards-gameplay-opnt1p-t991fv`, `codex/continue-lost-fleet-work` (already
    fully contained before this session), plus the 3 source branches above once their unique
    commits were absorbed: `claude/lost-fleet-expansion-gedyrk`, `claude/quirky-thompson-gt0n0h`,
    `claude/spaceship-boards-gameplay-opnt1p`. `master` was left untouched, per the user's explicit
    choice not to merge into it at the time. **Correction (same day, see #36): both of these
    decisions changed shortly after.**
36. ✅ **`master` fast-forwarded to match this branch; branch deletion still blocked** (done
    2026-06-29). Two corrections to #35 above:
    - The `git push origin --delete` calls for all 7 superseded branches actually **failed with
      `HTTP 403`** — this session's git credentials/proxy can push/forward commits (proven by the
      master push below) but are not scoped to delete refs. No GitHub MCP tool exists for branch
      deletion either. **None of the 7 branches listed in #35 have actually been deleted** —
      `claude/lost-fleet-advtech-tiles-c2fo8w`, `claude/lost-fleet-engine-work-l3bzsk`,
      `claude/spaceship-boards-gameplay-opnt1p-t991fv`, `codex/continue-lost-fleet-work`,
      `claude/lost-fleet-expansion-gedyrk`, `claude/quirky-thompson-gt0n0h`,
      `claude/spaceship-boards-gameplay-opnt1p` all still exist on `origin` and need manual deletion
      (GitHub web UI or a CLI with delete-scoped credentials).
    - The user then explicitly reversed the "don't touch master" choice ("Push the branch to master
      I want everything there now... so I have everything consolidated in the GitHub master").
      Verified safety first: `master` was a clean ancestor of this branch with zero unique commits
      of its own (`git rev-list --left-right --count origin/master...HEAD` → `0  33`), so the push
      was a pure fast-forward, not a merge. Executed `git push origin
      claude/lost-fleet-viewer-support-95lled:master` (`751bb69..e6e7e43`). Confirmed
      `git diff origin/master origin/claude/lost-fleet-viewer-support-95lled --stat` is empty —
      **`master` and this branch are now identical.** Vercel's production deployment (configured
      target branch = `master`) auto-deployed the new tip (`dpl_79PiRMyvhtFzGsWkcL8FKbebanLa`,
      commit `e6e7e43`, `target: "production"`, `state: "READY"`) without any manual trigger needed.
37. ✅ **Workflow simplified to a single branch ahead of the Claude→Codex handoff** (done
    2026-06-29). With `master` and `claude/lost-fleet-viewer-support-95lled` identical and the user
    about to start switching between Claude and Codex sessions, keeping a separate long-lived
    feature branch in sync (cherry-pick → verify → fast-forward, every session) was decided to be
    unnecessary overhead for a single-contributor project. New decision: **push directly to
    `master`** going forward; no more feature-branch juggling. `claude/lost-fleet-viewer-support-
    95lled` is kept only as a historical ref, not a separate line of development. Accepted
    tradeoff: `master` is also the Vercel production deploy target, so every push goes live
    immediately, including WIP commits — the user chose this explicitly over a staging branch.
    Updated `CLAUDE.md`, `AGENTS.md`, and `docs/lost-fleet/CODEX_HANDOFF.md` to record the new
    policy. (Caveat: a Claude-Code-on-the-web session's platform config may still pin it to push
    only to the named feature branch regardless of this doc — if so, fast-forward `master` to match
    immediately after, per the note in `CLAUDE.md`.)
38. ✅ **Caught a stale local clone on the very first Codex handoff attempt** (2026-06-29). The user
    ran the Codex handoff prompt against their local desktop clone ("Kims_desktop") and Codex
    correctly reported it was on `master` but with `AGENTS.md`, `CODEX_HANDOFF.md`,
    `PERFORMANCE.md`, and `viewer/src/components/SpaceMap.spec.ts` all missing. Root cause: that
    local clone's `master` predates today's fast-forward (and likely predates most of this
    project's history, since `master` was deliberately untouched until earlier today) — it had
    never been `git pull`ed. Not a problem with `origin` (verified all 4 files/paths exist on
    `origin/master`). Fix communicated to the user: `git fetch origin && git checkout master &&
    git pull origin master` on the desktop clone before retrying Codex. Added the same warning +
    fix to `CODEX_HANDOFF.md`'s working assumptions and resume checklist so the next handoff
    catches this before wasting a Codex turn on it.
39. ✅ **Lost Fleet viewer map rendering, first slice, CODED & TESTED** (done 2026-06-29). The first
    real Lost Fleet UI work is now in place: the viewer no longer silently drops Interspace and Deep
    Space hexes just because they are not part of a 19-hex sector.
    - `viewer/src/components/SpaceMap.vue` now keeps the existing per-sector render path for regular
      Space sectors, but also renders every non-Space hex directly from `engine.map.grid` using the
      engine's own `classifySectorId()` / `LostFleetSectorType` helpers. This preserves sector
      rotation grouping for base sectors while finally making Lost Fleet's Interspace and Deep Space
      geometry visible.
    - `viewer/src/components/SpaceHex.vue` now tags Interspace / Deep Space polygons with their own
      CSS classes, adds a first-pass on-map marker for Lost Fleet spaceship tiles (Twilight /
      Rebellion / T F Mars / Eclipse), and extends tooltips with sector-type / spaceship-name text so
      non-sector hexes are inspectable instead of looking like anonymous empty cells.
    - `viewer/src/components/SpaceMap.spec.ts` now has a second smoke test that renders a real
      `new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true })` board and asserts three
      invariants: sector groups still match `map.configuration().centers`, rendered hex count matches
      `map.grid.size` including the extra Lost Fleet cells, and the spaceship-tile markers render once
      per ship-bearing Interspace hex.
    - Verification: engine `cd engine && npm test` → **467/467** passing; viewer `cd viewer && npx
      vue-cli-service test:unit --timeout 4000 'src/**/*.spec.ts' 'src/logic/**/*.spec.ts'` →
      **156/156** passing (the new Lost Fleet `SpaceMap` smoke test is the +1).
40. ✅ **Branch routing temporarily moved back onto
    `claude/lost-fleet-viewer-support-95lled` for viewer work** (done 2026-06-29). Although the docs
    had briefly been rewritten earlier the same day for a single-branch `master` workflow (#37), the
    user explicitly asked this Codex session to continue the new Lost Fleet viewer work on
    `claude/lost-fleet-viewer-support-95lled` and decide separately later if/when to sync `master`
    again. This session therefore committed and pushed the map-rendering slice to
    `claude/lost-fleet-viewer-support-95lled` (commit `3657117`) and updated the handoff docs so the
    next session does not silently drift back onto `master`.
41. âœ… **Lost Fleet self-contained viewer links now work, and the faction wheel exposes the 2 new
    Lost Fleet planet colors, CODED & TESTED** (done 2026-06-29). This finished the next smallest
    viewer slice after the first map-rendering pass: there is now a real URL-level way to boot the
    deployed viewer into a Lost Fleet game, and the map-side faction wheel no longer hides
    Asteroid/Protoplanet once Lost Fleet is active.
    - `viewer/src/self-contained.ts` now factors its URL/env parsing into a tested
      `parseSelfContainedSetup()` helper and adds a real `lostFleet` flag alongside `frontiers`.
      This means the self-contained harness can finally create `new Engine([...], { lostFleet:
      true })` from a plain link instead of always silently booting base Gaia Project. As part of the
      same change, explicit falsy env/query values like `lostFleet=0` / `VUE_APP_frontiers=0` are
      now parsed correctly instead of truthy-string coercion treating any non-empty value as "on".
    - `viewer/src/components/FactionWheel.vue` keeps the standard 7-planet ring intact for base
      Gaia Project, but when Lost Fleet is active it now adds Asteroid + Protoplanet as extra
      visible wheel entries, with the same remaining-planet counts / click-to-highlight behavior as
      the existing Gaia and Transdim entries. The ring-rotation logic is also guarded so
      Darkanians/Space Giants do not corrupt the 7-planet orbit by trying to rotate Asteroid or
      Protoplanet into a slot that only exists in the extra row.
    - New tests: `viewer/src/self-contained.spec.ts` covers URL/env Lost Fleet flag parsing; new
      `viewer/src/components/FactionWheel.spec.ts` asserts the base-game 9-planet wheel stays
      unchanged while Lost Fleet grows it to 11 visible planet entries including Asteroid and
      Protoplanet.
    - Verification: engine `cd engine && npm test` â†’ **467/467** passing; viewer `cd viewer && npx
      vue-cli-service test:unit --timeout 4000 'src/**/*.spec.ts' 'src/logic/**/*.spec.ts'` â†’
      **160/160** passing (+4 viewer tests this slice). A concrete Lost Fleet demo seed now exists
      for the self-contained viewer: `?players=2&seed=lost-fleet-space-map&lostFleet=1`.
42. Ã¢Å“â€¦ **Lost Fleet one-mine setup factions now actually get one setup placement, and Asteroid /
    Protoplanet colors were swapped per user request, CODED & TESTED** (done 2026-06-29).
    - Engine fix: `engine/src/move/phase.ts` no longer hardcodes setup as "everyone twice, Xenos
      three times, Ivits special-case". It now uses new setup helpers in `engine/src/factions.ts`,
      so Lost Fleet setup follows the rulebook's 3-stage order: base-game factions place their 2 or
      3 mines "as usual", the currently coded expansion factions (Darkanians and Space Giants)
      place their single starting mine afterward in clockwise turn order, and Ivits still keep
      their PI-last behavior.
    - New engine regression coverage: `engine/src/factions.spec.ts` asserts the special setup
      placement counts plus Lost Fleet setup stage, and `engine/src/engine.spec.ts` now checks that
      Darkanians / Space Giants place after base-game factions finish setup and that Ivits still
      remain after the expansion-faction stage.
    - Viewer color swap: `viewer/src/data/planets.ts` and `viewer/src/stylesheets/planets.css` now
      map **Asteroid Ã¢â€ â€™ pink** and **Protoplanet Ã¢â€ â€™ turquoise** (the inverse of the previous
      mapping). `viewer/src/data/planets.spec.ts` locks that mapping with a direct unit test.
    - Verification: engine `cd engine && npm test` → **473/473** passing; viewer `cd viewer && npx
      vue-cli-service test:unit --timeout 4000 'src/**/*.spec.ts' 'src/logic/**/*.spec.ts'` Ã¢â€ â€™
      **161/161** passing.
43. ✅ **Lost Fleet viewer ship actions moved into a compact horizontal second row, reusing the base
    board-action footprint** (done 2026-06-30).
    - User-facing layout change: the oversized per-ship action cards were replaced with a compact,
      horizontally aligned ship-action strip. The base-game board-action row remains exactly where
      it already was on the research/scoring board, and Lost Fleet ship actions now render as a
      separate second row beneath it.
    - Rendering approach: added `viewer/src/components/LostFleetShipActionsRow.vue`, which renders
      each ship's 3 actions in a bordered ship group using the same `56x56` action-tile dimensions
      and `SpecialAction` footprint as the existing board actions. Each ship group also exposes its
      4 access slots as compact faction-colored markers so it is immediately visible which players
      have access to that ship's actions.
    - Rewards/info board split: `viewer/src/components/LostFleetSpaceships.vue` was reduced to the
      persistent reward state only (seeded Standard Tech, Federation token, Twilight artifacts).
      The action UI no longer lives in those cards.
    - New viewer coverage: `viewer/src/components/LostFleetShipActionsRow.spec.ts` asserts the
      compact ship groups, action count, and faction-colored access markers; the updated
      `LostFleetSpaceships.spec.ts` now locks the rewards-board-only rendering.
    - Verification: viewer `cd viewer && npx vue-cli-service test:unit --timeout 4000
      'src/**/*.spec.ts' 'src/logic/**/*.spec.ts'` → **165/165** passing.
44. ✅ **Lost Fleet player-piece turquoise/pink treatment, CODED & TESTED** (done 2026-06-30).
    - The viewer had been deriving faction-colored pieces directly from `factionPlanet(...)`, which
      is wrong for Lost Fleet's no-home-planet factions now that the planet colors are
      Asteroid=pink / Protoplanet=turquoise. Added a separate viewer-side piece-color mapping:
      Tinkeroids + Darkanians now render with the **Asteroid-side** player color and Moweyds +
      Space Giants with the **Protoplanet-side** player color, while the underlying Asteroid /
      Protoplanet hex colors stay unchanged.
    - Wired that split through the real faction-colored render paths instead of a one-off override:
      faction colors / log colors (`graphics/utils.ts`, `graphics/colors.ts`), federation-line
      gradients (`graphics/hex.ts`), used-action owner markers (`BoardAction.vue`), map trade-token
      / overlay planet markers (`SpaceHex.vue`), player circles (`PlayerCircle.vue`), faction
      backgrounds (`Rules.vue`, `data/factions.ts`), and all piece paths that already flow through
      `Planet.vue` / `planetClass(...)`.
    - Adjacent Lost Fleet polish: `Planet.vue` itself now has real Asteroid / Protoplanet fill and
      stroke classes (`.a` / `.p`) so those planet types render consistently in every SVG path that
      reuses the shared planet component, including colonized-planet faction overlays.
    - New render regression coverage: `SpaceMap.spec.ts` now mounts a real Lost Fleet board with a
      Darkanians mine placed on an Asteroid and a Moweyds mine placed on a Protoplanet, then
      asserts that the **planet** stays pink/turquoise while the **piece/faction overlay** uses the
      correct Asteroid / Protoplanet faction pairing. This follows the standing render-test rule from
      `PERFORMANCE.md`, extending the actual `SpaceMap` tree instead of only unit-testing helpers.
    - Verification: viewer `cd viewer && npx vue-cli-service test:unit --timeout 4000
      'src/**/*.spec.ts' 'src/logic/**/*.spec.ts'` → **166/166** passing.
45. ✅ **Tinkeroids + Moweyds full faction/rules slice, CODED & TESTED** (done 2026-06-30).
    - Added the 2 remaining Lost Fleet factions to the real engine surface: `Faction.Tinkeroids` /
      `Faction.Moweyds`, full faction-board registration, setup-stage placement rules (Tinkeroids
      start with a PI, Moweyds with 1 mine), and viewer faction metadata so the updated engine still
      compiles cleanly through the viewer test path.
    - Closed the §B5 blocker with the user's 2026-06-30 ruling: the shared Terraforming-board helper
      now assigns the mandatory opponent colors first for all relevant players, then fills the
      remaining cost-3 colors left-to-right from the randomized row in turn order. This is persisted
      per player via `PlayerData.lostFleetCost3Planets`, and every relevant build path now reads it
      (`player.canBuild`, ship Build-a-Mine actions, Federation-token Build-a-Mine actions).
    - Tinkeroids: round-income flow now interrupts at the start of each round with a mandatory
      `ChooseTinkeringTile` command, loads that round's chosen tile as a once-per-round action, and
      cleans it up at round end so each tile can only be used once in its 3-round band.
    - Moweyds: the faction now starts the game with an Exploration Shuttle already on `T F Mars`,
      and their PI action is wired as a real placement subphase (`PlacePowerRing`) rather than a
      passive counter. Placed rings persist on the hex, are serialized, and add +2 structure power
      value for federation / leech / scoring logic through `player.buildingValue(...)`. Power Rings
      are also locked by regression as placeable on a Moweyds Lost Planet mine once that mine exists.
    - Adjacent rules fix required by the new factions: Protoplanet's +6 VP bonus is now correctly
      suppressed on home-Protoplanet setup builds for Moweyds and Space Giants, while remaining live
      elsewhere.
    - New engine regression coverage: added dedicated `tinkeroids.spec.ts` / `moweyds.spec.ts` board
      + rules tests, expanded `factions.spec.ts`, `planets.spec.ts`, `player.spec.ts`, and updated
      the Space Giants Protoplanet expectation. This covers the real round-income interruption, the
      Power Ring placement chain, the T F Mars starting shuttle, and the cost-3 assignment order.
    - Verification: engine `cd engine && npm test` → **490/490** passing; viewer `cd viewer && cmd /c
      npx vue-cli-service test:unit --timeout 4000 "src/**/*.spec.ts" "src/logic/**/*.spec.ts"` →
      **166/166** passing.

46. ✅ **Lost Fleet viewer map-polish slice, CODED & TESTED** (done 2026-06-30).
    - `SpaceHex.vue` now gives Lost Fleet's non-base spaces immediate on-map identity instead of
      relying on tooltip text alone: Interspace hexes render an `IS` badge, Deep Space hexes render
      a `DS` badge, and spaceship hexes get a clearer Nautilaks/Vo'Kron/T F Mars/Eclipse marker with
      an orbit ring and "Ship" pill while keeping the existing compact map rendering footprint.
    - `SpaceMap.vue` now carries a lightweight in-map Lost Fleet legend reusing the same visual
      language (`IS`, `DS`, `T/R/M/E`) so the extra map semantics are readable at a glance without
      opening rules text or hovering each hex.
    - Adjacent UI refinement landed alongside the map work instead of inventing a second visual
      language: the compact ship-action row and the separate ship-rewards cards now both show the
      same T/R/M/E ship markers in their headers, matching the map markers and keeping the Lost Fleet
      ship surfaces visually tied together.
    - New render regression coverage extends the real Lost Fleet `SpaceMap` smoke test with the new
      visible markers (Interspace / Deep Space badges plus the map legend), and both Lost Fleet ship
      panel specs now lock the shared marker treatment in the rendered DOM. This follows the
      standing render-test rule from `PERFORMANCE.md` by extending the real map/panel render path
      rather than only unit-testing helpers or class lists.
    - Verification: viewer `cd viewer && cmd /c npx vue-cli-service test:unit --timeout 4000
      "src/**/*.spec.ts" "src/logic/**/*.spec.ts"` → **168/168** passing.
47. ✅ **Supabase multiplayer backend + viewer hosted mode (2026-07-01)** — the last build-order
    step ("Supabase backend glue + realtime sync") is implemented. Design settled first in
    `docs/lost-fleet/BACKEND.md` (read that for the full architecture; §0 lists the code facts it
    was grounded in), including an owner ruling amending §J4: **Web Push notifications replace
    turn-change emails entirely** (owner 2026-07-01; the only emails left are Supabase Auth's
    magic-link sign-in emails). Highlights:
    - **Supabase project `gaia-lost-fleet`** (ref `mitawjpdxkheascdiffz`, eu-west-1, free tier),
      separate from the owner's unrelated existing project. Schema in
      `supabase/migrations/0001_multiplayer.sql` + `0002_function_grants.sql`, both applied:
      `games` (seed/options/status + denormalized `current_seat`/`move_count` for lobby+notify
      only), `players` (seat = engine player index, invite email, claimed user), append-only
      `moves` (`seq` = `moveHistory` index, PK `(game_id, seq)`), `push_subscriptions`,
      service-role-only `app_config`. **No direct write policies anywhere** — all writes go
      through security-definer RPCs (`create_game` / `claim_my_seats` / `commit_turn`), so the
      move log is structurally append-only and `commit_turn`'s `seq` check makes double-commits
      race-safe. RLS: one `is_game_member` predicate (user id or invited email) on all reads;
      `moves` is in the realtime publication.
    - **Viewer hosted mode** (`?game=<uuid>` / `?lobby=1` in `main.ts`; every existing
      self-contained/scenario/state URL is untouched): `viewer/src/hosted.ts` + `viewer/src/hosted/`
      with magic-link sign-in, seat claiming, a minimal lobby (list games / create game with
      seat-ordered email invites; seed generated once at creation per §J3, `current_seat` computed
      from a probe engine), and `HostedGameHost` (`hosted/host.ts`) — the Supabase-backed
      counterpart of `self-contained.ts`: replays `seed + stored moves` into the engine, renders
      partial turn lines locally only, and persists a line **only when `copy.newTurn`** via
      `commit_turn` (§J1/§A2 exactly as before). Turn locking finally feeds the existing hook:
      `emitter.emit("player", { index: seat })` → `Game.vue`'s `canPlay`, and since
      `currentPlayer(engine)` is `engine.playerToMove` (returns `tempCurrentPlayer`), **mid-turn
      leech interrupts lock/unlock the right browsers with zero new turn-order code (§J2)**.
      Realtime `moves` INSERTs apply incrementally with full-replay resync on gaps/conflicts/
      reconnects/tab-refocus. supabase-js v2 ships as a **version-pinned runtime UMD bundle**
      (webpack 4 can't parse the npm package's syntax; TS 3.9 can't read its types) behind a
      typed facade; the testable core takes an injected backend instead.
    - **Push notifications**: `push_subscriptions` + PWA manifest + minimal `public/sw.js`
      (push display + click-through only, deliberately no offline caching so it can never serve
      a stale build) + an explicit "Enable notifications" opt-in button (iOS needs
      Add-to-Home-Screen first, per the accepted §J4 caveats). Server side: pg_net trigger on
      `games` (insert = invites, update of `current_seat`/`status` = turn/finished) → `notify`
      Edge Function (`supabase/functions/notify/index.ts`, `jsr:@negrel/webpush`), which reads
      everything via service role and never runs the engine. VAPID keypair generated locally,
      seeded into `app_config` (private key never committed; the public
      `applicationServerKey` in `viewer/src/hosted/config.ts` was verified to match the seeded
      pair via a local Deno import test; `deno check` passes on the function).
    - **Verification:** 11 new host unit tests (`viewer/src/hosted/host.spec.ts`) covering
      load-replay + name stamping, seat mapping, commit seat/next-seat derivation, the §J2
      leech-decider next-seat case (real engine fixture), local rejection of illegal moves,
      seq-conflict resync, incremental realtime apply, echo skip, gap resync, and
      render-without-persist for incomplete lines. Full suite: **189 passing + 2 failing chart
      fixtures that pre-exist on `master`** (verified via `git stash` at HEAD `173d35d`:
      178 passing + the same 2 failures without any of this work — the stale fixtures come from
      an earlier master commit, out of scope here). Production build clean.
    - **Not done / needs owner (~5 min, see BACKEND.md §11):** the Edge Function deploy and the
      Supabase Auth URL configuration are dashboard/CLI actions this session's tooling couldn't
      perform (deploy required an interactive approval). Games are fully playable without them —
      the trigger's HTTP call just 404s harmlessly until the function exists.
48. ✅ **Two-browser E2E verification of hosted multiplayer against PRODUCTION, plus the 2 real
    bugs it flushed out (2026-07-01, merged to `master` on owner instruction).** After #47
    shipped, the owner asked for the next most complex gap; the answer was that the whole
    multiplayer stack had never executed in a real browser. Built
    `viewer/e2e/hosted-multiplayer.e2e.js` (see BACKEND.md §12): Playwright drives **two real
    Chromium sessions against the live Vercel deployment and the real Supabase project** —
    lobby boot from a seeded session, game creation through the real form, per-browser seat
    locking, faction picks through the real Commands UI (button → modal → confirm), realtime
    fan-out to the other browser with **no reload**, reload-resume from the stored move log,
    and a first-mine placement via a real map hex click + "Confirm Mine". **All 10 checks
    pass against production.** Supporting pieces: two throwaway password auth users
    (`e2e-*@lostfleet.test`, sign in via password grant, bypassing the not-yet-configured
    magic-link Site URL) and `viewer/e2e/proxy-network.js`, a network adapter for sandboxes
    whose TLS-intercepting egress proxy kills Chromium's post-quantum ClientHello (all HTTP
    via Playwright's Node-side request API; WebSockets bridged over a manual CONNECT tunnel).
    Bugs found and fixed along the way, both now regression-tested (viewer suite **193/193 —
    fully green, first time since the stale-fixture failures appeared on master**):
    - **Final-scoring chart leak (pre-existing on master, was misdiagnosed as "2 stale chart
      fixtures"):** `finalScoringSourceFactory` ignored the `expansion` argument all its
      sibling factories take, so the 3 Lost Fleet conditions (Asteroids, PI↔Academy distance,
      Deep Space sectors) appeared in base-game charts and inflated totals — the exact
      ungated-enumeration pattern from Integration flag 5. Now filtered by
      `FinalTile.values(expansion)`.
    - **Persisted engine-mutated options bricked Lost Fleet games:** Engine mutates the
      options object it's given (stamps generated `map` layout + `factionVariantVersion`
      into it); Lobby's probe engine shared that object with the `create_game` RPC, and on
      reload `moveInit` rejects `map.sectors` + `lostFleet` → permanent silent
      AssertionError. Fixed via a testable `buildCreateGameParams`
      (`viewer/src/hosted/new-game.ts`, probe gets a clone), option-cloning in
      `HostedGameHost.buildEngine`, and a visible load-error alert instead of a dead empty
      board. The owner's real in-flight game was checked and unaffected (no `map` key).

## Still MISSING — only one art-only item left
As of 2026-06-27, every item that used to be on this list is resolved EXCEPT:
1. **Revised Space Sector tiles 05/06/07** — the actual planet arrangement on the Lost-Fleet-specific
   face (which tiles are double-sided and why is confirmed; the layout itself still needs a photo of
   the physical component). (§H4)

## Testing — required going forward
Real test commands (don't use raw `mocha -r ts-node/register` for the viewer — it hits stricter
TS resolution than the real webpack-based path and gives false failures; use the actual scripts):
- Engine: `cd engine && npm test` (or `npx mocha -r ts-node/register 'src/**/*.spec.ts' 'src/*.spec.ts'`
  — equivalent for engine, which has no webpack step). **490 tests passing as of 2026-06-30.**
- Viewer: `cd viewer && npx vue-cli-service test:unit --timeout 4000 'src/**/*.spec.ts' 'src/logic/**/*.spec.ts'`
  (this is what `pnpm test` runs — uses `mochapack`/webpack, required for files that touch engine
  types). **168 tests passing as of 2026-06-30.**

**Latest full rerun after #46:** engine **490/490**, viewer **168/168**.

**Convention for future sessions:** there was no test that mounted the actual hex-map component
tree (`SpaceMap.vue` → `Sector.vue` → `SpaceHex.vue` + the global `Definitions.vue`/
`FederationGradients.vue`), so the `PERFORMANCE.md` `<defs>`-duplication regression class could
have shipped silently. `viewer/src/components/SpaceMap.spec.ts` now covers this: it builds a real
`Engine` from `engine/fixtures/Beta-2.json` via `Engine.fromData()`, installs it into a store made
with `makeStore()` (`viewer/src/store.ts`), renders `SpaceMap` with `@testing-library/vue`, and
asserts structural invariants (sector count matches `map.configuration().centers`, hex count
matches `map.grid.size`, `<defs>` count stays flat/small instead of scaling per-hex). **Any future
session that touches viewer rendering components (hex map, `SpaceHex`, `Definitions`, federation/
building/ship rendering, or anything else in that render tree) must add to or extend this test —
or add a sibling test using the same pattern — covering the new rendering path, not just rely on
existing tests staying green.** This is a standing instruction, not a one-time task.
As of 2026-06-29, that same smoke-test file now also includes a real Lost Fleet render case, so
future map work should extend the base-game and Lost-Fleet paths together rather than treating Lost
Fleet as an untested special case.

Also fixed this session: `viewer/src/components/BoardAction.spec.ts` had 2 pre-existing broken
tests (predating this fork) — its mock store `getters` were plain functions (`recentCommands: ()
=> []`) but real Vuex getters resolve to already-evaluated values, not callables. Fixed by using
plain values. If a future session sees a similar `TypeError: ... is not a function` from a getter
in a test, check whether the mock is calling vs. holding the getter's result.

Resolved this session (2026-06-27), for reference: Adjusted Economy tile (§F1), 4 Spaceship boards
(§C), Tinkering tiles (§B1), Federation token green sides (§G5), Deep Space hex composition incl. the
"unidentified" Transdim hex (§H2), Interspace tile per-player-count composition (§H3), Moweyds/
Tinkeroids Terraforming board layout (§B5, closed as not-needed for engine logic), the full p.16
existing-faction delta audit (§I, via owner screenshot), and a transcription error in the "big"
Advanced Tech tile (§G2, was wrongly merged with the Deep Space tile due to a column-layout artifact).
Artifact token type-counts (§G6) remain an unconfirmed "1-of-each" assumption — low priority, the
effects are already known regardless of count.

## Current mechanics: single-browser demo, no persistence, no turn locking (as of 2026-06-27)

> **SUPERSEDED 2026-07-01 for hosted play** — both gaps below are now closed by the Supabase
> hosted mode (`?game=`/`?lobby=1`, see "Done so far" #47 and `BACKEND.md`): real per-session
> seat locking via the `"player"` event, and automatic persistence via the append-only `moves`
> log + Realtime. The analysis below stays because it's accurate for the DEFAULT self-contained
> URLs (which intentionally still behave this way) and because it documents the hooks the
> hosted mode is built on.

Two things the user noticed while testing that are **expected at this build stage, not bugs**:

- **One browser can act for every player.** `viewer/src/store.ts`'s `state.player` (the "which
  player is *this session*" identity) defaults to `null` and nothing in `self-contained.ts` ever
  sets it. `Game.vue`'s `canPlay` getter is `!ended && (!state.player || sessionPlayer ===
  current-turn-player)` — with `state.player` always null, that's unconditionally `true`, so the
  move UI never checks whose turn it actually is. The locking mechanism already exists and is
  wired for it: `launcher.ts:41` listens for a `"player"` event → `store.commit("player", data)`.
  A real per-session host (the eventual Supabase integration) would emit that to lock a browser
  to one player; `self-contained.ts` just never does, by design (it's a local hot-seat harness).
- **Reloading the link always starts a brand-new game.** `self-contained.ts:48` always runs `new
  Engine([`init ${players} ${seed}`, ...moves])` on load. There is zero persistence code anywhere
  in `viewer/src` (`localStorage`/`sessionStorage`/backend — none exist, confirmed by grep). Two
  compounding causes: (1) nothing saves move history anywhere — `moves` can only come from a
  *build-time* env var, not the URL; (2) unless `?seed=` is in the URL, the seed is also
  randomized per load (`Math.floor(Math.random() * 10000)`), so even the initial deal changes.
  **Manual workaround that already works today**, no new code needed: the debug `Wrapper.vue` UI
  has "Export"/"Load" buttons — Export copies the current game JSON, paste it back into Load next
  time to resume. Real automatic persistence (append-only move list via Supabase) is the
  already-planned last build-order step below — this is expected to stay this way until then.

**How to fill the one remaining item:** user photographs Sector tiles 05/06/07's Lost-Fleet-specific
face → drop the image in chat → render/read with PyMuPDF or read the image directly → transcribe into
`RULES_CLARIFICATIONS.md` §H4 with Source `BOARD-ART` / Confidence `CONFIRMED`, and flip the matching
`COMPONENTS.md` row to `◐ SPEC`.

## Build order once the spec is filled (from the brief)
1. **Engine**: Lost Fleet behind `Expansion.LostFleet`; all existing base-game tests stay green
   (`cd engine && npm test`). Start with enums.ts (A1), then Planet/Faction enums, faction-boards/
   *.ts for the 4 new factions, then exploration (a NEW subsystem — only the range/`ShipRange`
   helpers carry over from Frontiers, not the ship-unit/move/trade code; see Integration flag 4), tiles.
2. **Viewer**: new player colors (turquoise/pink) + 2 new planet types first; then plain-SVG panels
   for spaceships/exploration/tracks (do NOT use scanned official art; style-match later).
3. **Supabase backend** glue + realtime sync — last, once single-browser play works end to end.

### Engine chunk sequence (each chunk = own tested commit, confirm before moving on)
- ✅ **Chunk 1 — `Expansion` enum bitwise restructure.** Done (see "Done so far" #3 above).
- ✅ **Chunk 2 — Protoplanet & Asteroid planet types.** Done (see "Done so far" #10 above). Universal
  mechanics for ALL 18 currently-coded factions per rulebook "Changes to the Base Game Actions":
  Protoplanet = 3 terraform steps to mine, +6VP; Asteroid = consumes a Gaiaformer permanently to
  build, mine has zero ore/credit cost. Touched `enums.ts`, `planets.ts`, `player-data.ts`, `player.ts`
  build logic. Gated behind `hasExpansion(expansions, Expansion.LostFleet)`. Did **not** touch the
  "0VP if a start planet" carve-out (no coded faction can hit it yet — see the known-gap note in
  "Done so far" #10) or the new factions' terrain-step cost (still Chunk 3, flag 1).
- ✅ **Chunk 3 — Darkanians + Space Giants, FULL board.** Done (see "Done so far" #11 above).
  **Scope changed mid-chunk, confirmed with the user via `AskUserQuestion`:** the exhaustive
  `{[key in Faction]: X}` maps in `factions.ts`/`faction-boards/index.ts` make it impossible to add a
  `Faction` enum member without a complete board, so part (a) of the original plan below ("terraforming
  infra only") collapsed into "full board for that faction" the moment Darkanians/Space Giants were
  added to the enum — there was no way to do less than that. Part (b) (Tinkeroids/Moweyds shared
  randomized Terraforming board) is **unchanged and still NOT started** — still blocked on the §B5
  scan-order ambiguity, deferred to a future chunk once the user resolves it.
- ✅ **Chunk 4 — Spaceship Boards, data + setup only.** Done (see "Done so far" #12 above). Scope
  deliberately narrowed to static board config + setup-time randomization; all live-gameplay wiring
  (Explore action, board-action execution, Examine Artifact, Form-a-Federation hooks) deferred to a
  future chunk, to be confirmed with the user before starting.
- ✅ **Chunk 5 — Lost Fleet map geometry + tile data.** Done (see "Done so far" #13 above). Standalone
  `lost-fleet-map.ts`: sector-center geometry, Interspace/Deep Space hole-finding, tile composition
  data. Did not touch `SpaceMap` or place any tiles yet.
- ✅ **Chunk 6 — Lost Fleet board assembly (full `Grid<GaiaHex>` generation).** Done (see "Done so far"
  #14 above). Standalone `lost-fleet-board.ts`: sector-tile placement, Interspace/Deep Space tile
  placement (incl. the §H1 spacing rule and the 3p larger-gap rule, which needed no special-casing),
  and `GaiaHex` sector-type classification. Still NOT wired into `SpaceMap`/`moveInit` — blocked on the
  `GaiaHex.toString()`/`relativeCoordinates` addressing bug (§H1 note 7).
- ✅ **Chunk 7a — `GaiaHex` addressing bug fix.** Done (see "Done so far" #15 above). Stamped
  `sectorCenter` at hex-creation time in `Sector.create()`; `relativeCoordinates`/`toString()` now
  handle shifted sectors and Interspace/Deep Space hexes correctly. 352/352 tests, zero regressions.
- ✅ **Chunk 7b — Wire `generateLostFleetBoard()` into `SpaceMap`/`moveInit`.** Done (see "Done so far"
  #16 above). `SpaceMap` constructor/`configuration()`/`parse()` got Lost-Fleet-aware branches;
  `moveInit()` threads `engine.options.lostFleet` through and rejects the two unsupported combinations
  (custom `map.sectors`, `customBoardSetup`); `Engine.fromData()` restores `map.lostFleet`. **361/361
  engine tests pass.**

## Integration risks & code-grounded flags (2026-06-27 plan review)
Read of the actual base-game engine, cross-checked against the now-complete spec. These are the
places where the new content does NOT slot cleanly into existing assumptions — resolve each as part
of the chunk that touches it. (File:line refs are to `engine/src/`.)

1. **The 4 new factions have non-standard terraform cost on BOTH axes — terrain steps AND Gaia QIC.**
   ✅ **Darkanians/Space Giants halves DONE (Chunk 3).** Tinkeroids/Moweyds halves still open, blocked
   on §B5.
   - **Terrain-step axis (`terraformingStepsRequired`, `planets.ts`):** signature changed from
     `(factionPlanet: Planet, target: Planet)` to `(faction: Faction, target: Planet)` (Chunk 3) so it
     can special-case by faction before falling through to the existing home-planet-cycle math.
     ✅ **Darkanians** flat 1 to any terrain color — coded & tested. ✅ **Space Giants** flat 2 to any
     terrain color — coded & tested. ☐ **Tinkeroids/Moweyds** still need 3 steps for the "cost-3"
     colors, 1 for all others — and the cost-3 set is NOT a blind random draw: it's the OTHER players'
     home colors first (always cost 3), topped up from the random setup layout to always total exactly
     3 (§B5, fully revised, but the scan-order itself is still ambiguous — that's the actual blocker).
     This makes their terrain cost **per-game and opponent-dependent**, so the override will need
     access to game state (the per-game cost-3 color set), not just `(faction, targetPlanet)` — a
     deeper signature change still to come on top of Chunk 3's. Protoplanet/Asteroid's own flat
     early-returns were already done in Chunk 2.
   - **Gaia-QIC axis (`gaiaFormingCost()`, `player.ts`):** SEPARATE from terrain steps — the QIC paid
     to build a mine ON a Gaia planet. Base = 1 QIC; already faction-aware (Gleens pays 1 ore).
     ✅ **Darkanians & Space Giants now pay 2 QIC here — coded & tested (Chunk 3).** ☐ Tinkeroids &
     Moweyds still need confirming/coding once they exist (owner-confirmed 2026-06-27 they pay the
     normal 1, so no code change will be needed for them on this axis — just verify once they're coded).
     The gaiaforming PROJECT cost (transdim→Gaia, the `gaiaFormingDiscount`/GaiaFormer path) remains
     untouched for all 4 factions.
2. ✅ **RESOLVED (Chunk 3).** Faction availability is now expansion-gated: `Faction.values(expansions)`
   (mirrors `Planet.values`/`ResearchField.values`) is the authoritative enumeration, threaded through
   `remainingFactions(chosenFactions, expansions)` and both call sites
   (`available/setup.ts`, `move/setup.ts`). Darkanians/Space Giants only appear with
   `hasExpansion(.., LostFleet)`; the 14 base factions are unaffected. (Note: do NOT use
   `Object.values(Faction)` anywhere — TS namespace-merging means it also returns the `values`
   function itself as a stray array element; see "Done so far" #11 for the full bug writeup and the
   still-open viewer-side instances of this same pattern.)
3. ✅ **RESOLVED for Darkanians/Space Giants (Chunk 3); confirmed still correct in principle for
   Tinkeroids/Moweyds once they exist.** Same-color factions are mutually exclusive exactly like the
   base game — only one per game. Tinkeroids↔Darkanians share the Asteroid "color"; Moweyds↔Space
   Giants share Protoplanet (matches the 2 new player colors, turquoise/pink — see COMPONENTS.md §10).
   Darkanians/Space Giants are now in the `factions` map (`factions.ts`) with `planet: Asteroid` /
   `planet: Protoplanet`, and the existing `oppositeFaction` shared-planet logic enforces the
   one-per-game rule with no change needed — verified via `factions.spec.ts`. Since Tinkeroids/Moweyds
   don't exist yet, no actual exclusion between the two pairs is exercised yet (only Darkanians'/Space
   Giants' OWN pairing slot is real today; their would-be partners are absent) — this is expected and
   harmless, not a gap. **The one subtlety, confirmed handled correctly:** the `planet` field does
   double duty in the base game — it drives BOTH faction pairing AND terraform origin (`factionPlanet()`
   used to feed `terraformingStepsRequired`). For Darkanians/Space Giants it now drives pairing ONLY;
   `terraformingStepsRequired(faction, target)` special-cases them by faction directly and never
   touches the planet-cycle math for them (see flag 1). Will need the same care when Tinkeroids/Moweyds
   are added.
4. **Lost Fleet "Spaceship Boards" are NOT Frontiers ships — limited reuse.** `move/ships.ts` +
   `Building` enum show Frontiers ships are movable units (`moved` flag, `location`, `MoveShip`
   command, trade system). LF spaceships are STATIONARY map tiles you *explore* by placing a shuttle
   and charging power on a 4-space track (§C5) — a different mechanic. Reuse is limited to the range /
   `Resource.ShipRange` helpers (measuring distance to a target hex), not the ship-unit/move/trade
   code. Treat LF exploration + the per-faction Exploration board as a NEW subsystem, not a reskin of
   Frontiers ships. (The "Build order" line below that says "reuse Frontiers helpers" overstates it.)
5. **New tiles/tokens leak without a gating convention.** `AdvTechTile.values()` (`enums.ts:474`)
   returns every `advtech*` with NO expansion filter — adding the 6 LF adv-tech tiles would surface
   them in base games. Same shape: `Federation.values` hardcodes `fed1-6`; `Booster`/`ScoringTile`/
   `FinalTile` `.values()` ignore their `expansions` arg. Each new LF tile/booster/scoring/federation
   needs a naming + filter convention (mirror how `TechTile.values` keys off the `"frontiers"`
   substring — use a `"lostfleet"`/`"lf"` marker). **✅ RESOLVED for the 8 spaceship-seeded Federation
   tokens and 3 spaceship-seeded Standard Tech tiles specifically (Chunk 4):** these got their own
   dedicated `SpaceshipFederation`/`SpaceshipTechTile` enums + `.values(expansions)` functions instead
   of being merged into `Federation`/`TechTile` — both a gating-convention fix AND a deliberate
   separation from the existing live-gameplay pools (see "Done so far" #12). The remaining instances
   of this flag (base `AdvTechTile`/`Federation`/`Booster`/`ScoringTile`/`FinalTile` `.values()` still
   ignoring `expansions`) are still open — not touched by Chunk 4, since none of the Lost Fleet content
   coded so far actually adds new members to those 5 enums.
6. **Planet-type counting misses Artifact-granted "virtual" planets.** `Condition.PlanetType`
   (`player.ts:939`) = `uniq(ownedPlanets.map(h => h.data.planet))`, i.e. distinct planet of hexes
   the player has a building on. Adding Protoplanet/Asteroid as `Planet` values makes normal mines on
   them count automatically — good. BUT §G4b/§G6 let an Artifact grant an asteroid/protoplanet *type*
   with NO hex and no mine placed; this count will miss those. Plan: maintain a separate
   virtual-planet-type set (from artifacts) and union it into the `PlanetType` count. (The Lost Planet
   is already handled separately — see `lostPlanet` in `Condition.Mine`, `player.ts:923`.)
7. ✅ **RESOLVED (see "Done so far" #30).** Q.I.C. board actions get overlaid (§E4/§K3): under Lost
   Fleet the Research-board Q.I.C. actions (`BoardAction.Qic1-3`) are covered by the Colonization
   overlay and replaced by ship actions — owner-confirmed 2026-06-29, now gated via
   `BoardAction.values(expansions)`. The "gain VP per planet type" Q.I.C. action's base dropping from
   3 to 2 (§K3, because there are now more planet types) turned out to already be correctly coded: one
   spaceship board's own Q.I.C. action (`spaceships.ts`) already reads `["2vp", "pt > vp"]`, the
   exact replacement for the base game's `BoardAction.Qic3` (`["3vp", "pt > vp"]`) — no separate
   change was needed there.

**Already in place / no work needed:** mutual-exclusivity guard (`move/setup.ts:15`); the Lost Planet
+ `PlaceLostPlanet` + Navigation-5 infra all exist, so the "11th planet type" is purely a counting
concern, not new placement code; Chunk 1's `hasExpansion` + bitwise enum is the right foundation for
all the gating above.

**Refined ordering takeaway (superseded by Chunk 2/3's actual scope, see "Done so far" #10/#11):** this
section originally said Chunk 2 must also carry the *full* `planets.ts` terraform-cost refactor (flag
1) and the virtual-planet-type counting hook (flag 6), or it'd be half-done. In practice flag 1 splits
cleanly into a faction-agnostic half (Protoplanet/Asteroid flat early-returns — done in Chunk 2) and a
faction-specific half (the new factions' per-faction/per-game terrain cost). That faction-specific half
itself split again once Darkanians/Space Giants actually got coded in Chunk 3: their flat per-faction
cost was simple enough to land alongside the rest of their full board, while Tinkeroids/Moweyds'
per-game/opponent-dependent cost is still blocked on §B5 and remains unstarted. Flag 6 only needed a
seam comment since there's no Artifact code yet to union in. Flags 2-3 (gating + pairing) are now
resolved for the 2 factions that exist; the tile-gating convention (flag 5) is now established
(`Planet.values(expansions)`, Chunk 2; reused as `Faction.values(expansions)`, Chunk 3) — reuse that
exact shape for adv-tech/federation/booster/scoring enum members when those chunks come up.

## Next actions
Chunks 1-7b plus Darkanians' PI follow-up, the core Explore action, the federation-claim hook, the
Standard-Tech claim hook, the full Spaceship Boards live-gameplay wiring, the gold-side execution
for all 8 claimed-ship Federation tokens, rescoring ship Federation tokens, including Asteroid
hexes in the Federation tokens' Build-a-Mine (per BGG designer ruling), Space Giants'
Exploration-board special action, the Scoring Board Extension's alternate Advanced Tech gate
(§E6), the 6 newly-named Lost Fleet Advanced Tech tiles (§G2), the research-board Q.I.C.
actions' Lost Fleet overlay (§E4/§K3), an audit confirming the `terra` Advanced Tech tile
correctly fires on every free/discounted terraforming step, not just paid ones, and Examine Artifact
plus Twilight's Artifact-token seeding (all 13 token effects), are complete and verified —
**490/490 engine tests pass**
(274 baseline → 280 after Chunk 2 → 299 after Chunk 3 → 321 after Chunk 4 → 337 after Chunk 5 → 345
after Chunk 6 → 352 after Chunk 7a → 353 after the German-rules reroll fix → 354 after Chunk 7b's
placement-metadata step → 361 after Chunk 7b's `SpaceMap`/`moveInit` wiring + integration tests → 362
after Darkanians' PI integration test → 366 after the Explore-action slice → 370 after the
federation-claim slice → 372 after the Standard-Tech claim slice → 387 after the Spaceship Boards
live-gameplay wiring slice → 388 after T F Mars's Instant-Gaiaforming Power action → 393 after wiring
the remaining 5 ship-board actions (Twilight Knowledge/Power, Rebellion Power, T F Mars Credit, Eclipse
Credit) → 399 after wiring the gold-side execution for all 8 claimed-ship Federation tokens → 404 after
fixing rescore to offer and re-trigger ship Federation tokens → 406 after fixing Federation tokens'
Build-a-Mine to include Asteroid hexes once a spare Gaiaformer is available → 419 after Space Giants'
Exploration-board special action → 433 after the Scoring Board Extension's alternate Advanced Tech
gate → 440 after the 6 newly-named Lost Fleet Advanced Tech tiles (§G2) → 443 after the research-board
Q.I.C. actions' Lost Fleet overlay → 444 after the `terra` free-terraforming-steps audit → 467 after
Examine Artifact + Twilight's Artifact-token seeding → 489 after the Tinkeroids/Moweyds faction slice,
see "Done so far" #16-#32 and #45).
(Note: the 399 and 404 figures here are git-verified; an earlier draft of this doc had momentarily
overstated them as 407/412 before the correction in "Done so far" #24-#25 above. The 406 figure was
also stale by session start — `git stash` confirmed the real baseline was 416 — see #27's note.)
Darkanians and Space Giants are fully playable factions for every mechanic that doesn't depend on an
unbuilt subsystem; the 4 Spaceship Boards' static config and setup-time tile/token seeding are coded
and tested; the **core Explore action** is live in the engine; explored ships can redeem their seeded
Federation token through federation formation and their seeded Standard Tech tile through the normal
tech-pick flow; all 12 of the 12 ship board-actions are now live through a new
`Command.SpaceshipAction`, with a per-round per-action lock (see #18-#23); claiming a ship's seeded
Federation token now executes its gold-side effect — direct rewards for 6 of the 8 tokens, and a
chained bonus Build a Mine action for the other 2 (Range/Terraform), see #24; rescoring (QIC2 board
action) now offers and re-triggers ship-claimed Federation tokens exactly like pool-drawn ones, see
#25; that chained Build a Mine action now correctly includes Asteroid hexes (gated on a spare
Gaiaformer) instead of blanket-excluding them, per a designer ruling on BGG, see #26; Space
Giants now have their Exploration-board special action (once-per-round Build a Mine with 2 free
terraforming steps), see #27; the 7th Advanced Tech slot from the Scoring Board Extension (gated
on ≥25 VP, or in 3-4p on a 50/50-randomized choice between ≥25 VP and 3 explored ships) is now seeded
at setup and correctly gates `canTakeAdvancedTechTile()`, see #28; the 6 newly-named Lost Fleet
Advanced Tech tiles from §G2 (`asteroidpass`, `big`, `deep`, `deeppass`, `qaction`, `terra`) are now
real, gated `AdvTechTile` enum members with wired effects, see #29; the research-board Q.I.C.
actions (`BoardAction.Qic1-3`) are now correctly disabled under Lost Fleet, replaced entirely by the
spaceship boards' own Q.I.C. actions, see #30; `terra` has been audited against every source of
free terraforming steps in the engine (normal builds, the Federation tokens' bonus Build-a-Mine,
Space Giants' special action, Lost Planet placement, ship buildings) with no bug found, see #31; and
Examine Artifact + Twilight's Artifact-token seeding (all 13 token effects) are now coded and tested,
see #32. The Lost Fleet
variable-map geometry, tile data, full board assembly, `GaiaHex` addressing fix, AND the
`SpaceMap`/`moveInit` wiring are all coded and tested (see #13-#16) — `new Engine([...], { lostFleet: true })`
now produces a real, playable Lost Fleet board through the normal engine entry points. Every Spaceship-
Boards-adjacent feature is now wired: all 12 ship-board actions, the gold-side execution and rescoring
of claimed ship Federation tokens, and Examine Artifact + Artifact-token seeding. Explicitly still
open, in priority order the user should pick from:
1. **Continue the new Lost Fleet UI work** — the viewer is now unblocked for richer Lost Fleet map
   polish and adjacent UI refinement beyond the current ship/rewards boards.
2. ~~**Viewer-side `Object.values(Faction)` fix**~~ — **DONE** (see "Done so far" #33, 2026-06-29,
   "Viewer Step Zero"): the 6 `Faction` call sites plus a cascading chain of related gaps (Darkanians/
   Space Giants `factionData`, `planetsWithSteps` signature, Asteroid/Protoplanet color data, 2 more
   `Object.values(Planet)` sites, `SpaceshipTechTile` display data, a stale chart fixture) are all
   fixed. `viewer/` now builds and type-checks clean against the Lost Fleet engine (`npm run
   quick-test` 152/152; `npm test` 152/154, the 2 failures pre-existing/unrelated, see #33). The
   viewer is now unblocked for new Lost Fleet UI work. **Lost Fleet viewer work is now in 3 tested
   slices** (see #39, #41, and #43): Interspace / Deep Space hexes and spaceship tiles render on
   the map, self-contained viewer links can now boot Lost Fleet directly via `lostFleet=1`, the
   faction wheel exposes Asteroid / Protoplanet. A 4th tested slice is now also done (see #44):
   Lost Fleet player pieces render in the correct turquoise/pink faction colors independently of
   Asteroid / Protoplanet hex colors. A 5th tested slice is now also done (see #46): Interspace /
   Deep Space hexes now have explicit `IS` / `DS` map badges, spaceship hexes have clearer ship
   markers, the map has a lightweight Lost Fleet legend, and the ship action/reward panels reuse the
   same T/R/M/E marker language. A 6th tested slice is now also done (2026-06-30): the self-contained
   viewer supports exact `state=` share URLs, short named `scenario=` URLs, and an in-viewer **Test
   Scenarios** launcher for common Lost Fleet mechanics; the serialized viewer state now also preserves
   temporary range/step mid-turn state so those links can restore action-dependent overlays faithfully.
   The scenario catalog now includes direct-entry states for Explore, Twilight `+3 range`, ship-tech
   claim, ship-federation claim, artifact choice, Space Giants' special action, T F Mars instant
   Gaiaforming, Eclipse's asteroid mine, both Federation-token Build-a-Mine follow-ups, Rebellion's
   ship upgrade, Moweyds' power-ring action, and the Lost Fleet terraforming-board setup state.
   The remaining viewer work is any further map polish or panel/UI
   refinement beyond those current markers and boards.
3. **Revised Space Sector tiles 05/06/07** (§H4, the one remaining art-only TODO — see "Still MISSING"
   above) — would let Lost Fleet stop falling back to the base game's per-count face for those 3 tiles.
3b. **Full-game playout fuzzer with rules-conformance oracles** — plan written and owner-requested
   (2026-07-02), see `docs/lost-fleet/FUZZER_PLAN.md`: seeded random legal playouts to completion,
   three oracle tiers (structural / conservation / Lost-Fleet rules oracles each citing its
   rulebook/§-ledger source), failure minimization into committed regression specs, and a strict
   triage protocol (no engine change without a CONFIRMED rules basis). Not started — next up.
4. ~~Or a different unit of work entirely (viewer, Supabase)~~ — **Supabase multiplayer is DONE**
   (see "Done so far" #47 and `BACKEND.md`), pending two ~5-minute owner actions listed in
   `BACKEND.md` §11: deploy the `notify` Edge Function and set the Supabase Auth URL
   configuration. The `claude/backend-state-multiplayer-sbhf6c-bov526` branch was merged to
   `master` on owner instruction 2026-07-01 (fast-forward), so the hosted mode is live on the
   production Vercel deploy. Natural follow-ups once real games run: the Phase-2 snapshot cache
   (BACKEND.md §8), lobby polish, or realtime lobby updates.

Confirm with the user before starting any of the above.

## Canonical files (trust order)
`PROGRESS.md` (this) → `RULES_CLARIFICATIONS.md` (values; §A decisions, §K errata) →
`COMPONENTS.md` (inventory/status) → `PERFORMANCE.md` (viewer perf investigation/findings, read
before touching viewer rendering) → `rulebook-v1.0.txt` / `.pdf` (source) →
`faction-overview-table.txt` (community faction data).
