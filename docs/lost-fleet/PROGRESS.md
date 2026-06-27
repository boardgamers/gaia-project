# Lost Fleet — Progress & Next-Session Handoff

> **New session? Start here.** This file is the running state of the project. Read it, then read
> `RULES_CLARIFICATIONS.md` (the value ledger) and `COMPONENTS.md` (the inventory/status). If the
> task touches viewer rendering/perf, also read `PERFORMANCE.md` first — it has hard-measured
> findings that should not be rediscovered. Then ask the user "what next?" and use the **Next
> actions** section below to guide them.
> Last updated: **2026-06-27**.

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
   (= player count), and the 4-space exploration charge track (0/2/2/4). Owner board-read 2026-06-27.
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

## Still MISSING — only one art-only item left
As of 2026-06-27, every item that used to be on this list is resolved EXCEPT:
1. **Revised Space Sector tiles 05/06/07** — the actual planet arrangement on the Lost-Fleet-specific
   face (which tiles are double-sided and why is confirmed; the layout itself still needs a photo of
   the physical component). (§H4)

Resolved this session (2026-06-27), for reference: Adjusted Economy tile (§F1), 4 Spaceship boards
(§C), Tinkering tiles (§B1), Federation token green sides (§G5), Deep Space hex composition incl. the
"unidentified" Transdim hex (§H2), Interspace tile per-player-count composition (§H3), Moweyds/
Tinkeroids Terraforming board layout (§B5, closed as not-needed for engine logic), the full p.16
existing-faction delta audit (§I, via owner screenshot), and a transcription error in the "big"
Advanced Tech tile (§G2, was wrongly merged with the Deep Space tile due to a column-layout artifact).
Artifact token type-counts (§G6) remain an unconfirmed "1-of-each" assumption — low priority, the
effects are already known regardless of count.

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
- **Chunk 3 (next, proposed) — no-home-planet faction terraforming infra.** Split in two: (a) Darkanians (flat
  1-step to any base planet) / Space Giants (flat 2-step) first, since they're stateless flat-cost
  rules; (b) Tinkeroids/Moweyds shared randomized Terraforming board (satellite-cube draft setup
  procedure) after, since it's stateful setup logic shared between exactly those two factions.
- **Chunk 4+ — first full new faction end-to-end** (board income/PI/tech, likely Darkanians since
  its terraforming rule is simplest), then the remaining 3 factions, then ships/exploration/map
  content, then viewer work, then Supabase.

## Integration risks & code-grounded flags (2026-06-27 plan review)
Read of the actual base-game engine, cross-checked against the now-complete spec. These are the
places where the new content does NOT slot cleanly into existing assumptions — resolve each as part
of the chunk that touches it. (File:line refs are to `engine/src/`.)

1. **The 4 new factions have non-standard terraform cost on BOTH axes — terrain steps AND Gaia QIC.**
   These are two different code paths; the plan must touch both:
   - **Terrain-step axis (`terraformingStepsRequired`, `planets.ts:3`):** keys cost off the faction's
     home-planet index in a hardcoded 7-base-planet `planetCycle`. The new factions have no terrain
     home planet, so the cycle math is meaningless for them. Their step cost:
     • **Darkanians** flat 1 to any terrain color; • **Space Giants** flat 2 to any terrain color
     (both simple, faction-only). • **Tinkeroids/Moweyds** 3 steps for the "cost-3" colors, 1 for all
     others — and the cost-3 set is NOT a blind random draw: it's the OTHER players' home colors first
     (always cost 3), topped up from the random setup layout to always total exactly 3 (§B5, fully
     revised). This makes their terrain cost **per-game and opponent-dependent**, so the override needs
     access to game state (the per-game cost-3 color set), not just `(faction, targetPlanet)` — a
     deeper signature change than a static per-faction table. Also: Protoplanet/Asteroid themselves
     aren't in the cycle and need flat early-returns (Protoplanet=3 steps §E1; Asteroid via
     gaiaformer-consume §E2), like the existing `Gaia`/`Transdim` → 0 early-return at `planets.ts:14`.
   - **Gaia-QIC axis (`gaiaFormingCost()`, `player.ts:911`):** SEPARATE from terrain steps — the QIC
     paid to build a mine ON a Gaia planet. Base = 1 QIC; already faction-aware (Gleens pays 1 ore).
     **Only Darkanians & Space Giants pay 2 QIC here; Tinkeroids & Moweyds pay the normal 1**
     (owner-confirmed 2026-06-27 — corrects an earlier "all 4" note). The gaiaforming PROJECT cost
     (transdim→Gaia, the `gaiaFormingDiscount`/GaiaFormer path) is untouched for all of them. Plan: add
     a Darkanians/Space-Giants branch returning 2 QIC. Belongs to Chunk 3 (new factions), not Chunk 2.
2. **Faction availability has NO expansion gate.** `remainingFactions(Object.values(Faction))`
   (`factions.ts:61`, `available/setup.ts:33`) offers EVERY `Faction` enum value in every game. Add
   the 4 new factions to the enum and they leak into base/Frontiers games. Plan: thread `expansions`
   into `remainingFactions` and filter (new 4 only when `hasExpansion(.., LostFleet)`; conversely the
   14 base factions stay available without it).
3. **`oppositeFaction` pairing is CORRECT to keep for the new factions (owner-confirmed 2026-06-27).**
   Same-color factions are mutually exclusive exactly like the base game — only one per game.
   Tinkeroids↔Darkanians share the Asteroid "color"; Moweyds↔Space Giants share Protoplanet (this
   matches the 2 new player colors, turquoise/pink — see COMPONENTS.md §10). So add them to the
   `factions` map (`factions.ts:4`) with `planet: Asteroid` / `planet: Protoplanet` and the existing
   `oppositeFaction` shared-planet logic enforces the one-per-game rule with no change. **The one
   subtlety:** the `planet` field does double duty in the base game — it drives BOTH faction pairing
   AND terraform origin (`factionPlanet()` feeds `terraformingStepsRequired`, see flag 1). For these
   factions it must drive pairing only; their terraform cost is a flat/board rule, so the flag-1
   override must NOT route them through the planet-cycle math. Also note the `factions` map type is
   exhaustive `{[key in Faction]: {planet}}` — adding enum values forces filling it or TS won't compile.
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
   substring — use a `"lostfleet"`/`"lf"` marker). The 8 new federation tokens (§G5) are seeded on
   spaceships and form a SEPARATE pool from the 6 standard federation tiles — don't merge them.
6. **Planet-type counting misses Artifact-granted "virtual" planets.** `Condition.PlanetType`
   (`player.ts:939`) = `uniq(ownedPlanets.map(h => h.data.planet))`, i.e. distinct planet of hexes
   the player has a building on. Adding Protoplanet/Asteroid as `Planet` values makes normal mines on
   them count automatically — good. BUT §G4b/§G6 let an Artifact grant an asteroid/protoplanet *type*
   with NO hex and no mine placed; this count will miss those. Plan: maintain a separate
   virtual-planet-type set (from artifacts) and union it into the `PlanetType` count. (The Lost Planet
   is already handled separately — see `lostPlanet` in `Condition.Mine`, `player.ts:923`.)
7. **Q.I.C. board actions get overlaid (§E4/§K3).** Under Lost Fleet the Research-board Q.I.C.
   actions (`BoardAction.Qic1-3`) are covered by the Colonization overlay and replaced by ship
   actions; the "gain VP per planet type" Q.I.C. action's base also drops from 3 to 2 (§K3, because
   there are now more planet types). Gate these in `available/actions.ts`.

**Already in place / no work needed:** mutual-exclusivity guard (`move/setup.ts:15`); the Lost Planet
+ `PlaceLostPlanet` + Navigation-5 infra all exist, so the "11th planet type" is purely a counting
concern, not new placement code; Chunk 1's `hasExpansion` + bitwise enum is the right foundation for
all the gating above.

**Refined ordering takeaway (superseded by Chunk 2's actual scope, see "Done so far" #10):** this
section originally said Chunk 2 must also carry the *full* `planets.ts` terraform-cost refactor (flag
1) and the virtual-planet-type counting hook (flag 6), or it'd be half-done. In practice flag 1 splits
cleanly into a faction-agnostic half (Protoplanet/Asteroid flat early-returns — done in Chunk 2) and a
faction-specific half (the 4 new factions' per-faction/per-game terrain cost — needs factions that
don't exist yet, so it stayed in Chunk 3 as originally sequenced). Flag 6 only needed a seam comment
since there's no Artifact code yet to union in. Chunk 3 (new factions) is still blocked on flags 2-3
(gating + pairing) before any board values matter. The tile-gating convention (flag 5) is now
established (`Planet.values(expansions)`, Chunk 2) — reuse that exact shape for adv-tech/federation/
booster/scoring enum members when those chunks come up.

## Next actions
Chunk 1 and Chunk 2 are complete and verified (280/280 tests: 274 baseline + 6 new). Chunk 3
(no-home-planet faction terraforming infra, split into Darkanians/Space-Giants flat-cost then
Tinkeroids/Moweyds randomized-board setup) is proposed as the next unit of work. Confirm with the
user before starting it.

## Canonical files (trust order)
`PROGRESS.md` (this) → `RULES_CLARIFICATIONS.md` (values; §A decisions, §K errata) →
`COMPONENTS.md` (inventory/status) → `PERFORMANCE.md` (viewer perf investigation/findings, read
before touching viewer rendering) → `rulebook-v1.0.txt` / `.pdf` (source) →
`faction-overview-table.txt` (community faction data).
