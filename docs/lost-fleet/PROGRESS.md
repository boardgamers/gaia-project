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
5. ✅ **Base-faction LF deltas** captured (§I7): Lantids 4/0 + 13c + 1pw income, Ivits 2/2, Bal T'aks
   7-VP shuttle, Xenos/Gleens PI tweaks, etc. (community-sourced; cross-checks vs prose).
6. ✅ **Tile/booster/scoring/tech/federation/artifact EFFECTS** — covered by rulebook prose
   (Appendices II–VII), already read and referenced.
7. ◐ **Spaceship action COSTS** read from art (§C). Effects/slot-counts/charge-values still pending.
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
   *.ts for the 4 new factions, then exploration/ships (reuse Frontiers helpers), tiles.
2. **Viewer**: new player colors (turquoise/pink) + 2 new planet types first; then plain-SVG panels
   for spaceships/exploration/tracks (do NOT use scanned official art; style-match later).
3. **Supabase backend** glue + realtime sync — last, once single-browser play works end to end.

### Engine chunk sequence (each chunk = own tested commit, confirm before moving on)
- ✅ **Chunk 1 — `Expansion` enum bitwise restructure.** Done (see "Done so far" #3 above).
- **Chunk 2 (next, proposed) — Protoplanet & Asteroid planet types.** Universal mechanics for ALL
  18 factions (not just the 4 new ones) per rulebook "Changes to the Base Game Actions": Protoplanet
  = 3 terraform steps to mine, +6VP (0VP if a start planet); Asteroid = consumes a Gaiaformer
  permanently to build, mine has zero ore/credit cost. Touches `planets.ts`, `cost.ts`,
  `player.ts` build logic. Gated behind `hasExpansion(expansions, Expansion.LostFleet)`.
- **Chunk 3 — no-home-planet faction terraforming infra.** Split in two: (a) Darkanians (flat
  1-step to any base planet) / Space Giants (flat 2-step) first, since they're stateless flat-cost
  rules; (b) Tinkeroids/Moweyds shared randomized Terraforming board (satellite-cube draft setup
  procedure) after, since it's stateful setup logic shared between exactly those two factions.
- **Chunk 4+ — first full new faction end-to-end** (board income/PI/tech, likely Darkanians since
  its terraforming rule is simplest), then the remaining 3 factions, then ships/exploration/map
  content, then viewer work, then Supabase.

## Next actions
Chunk 1 is complete and verified (274/274 tests). Chunk 2 (Protoplanet/Asteroid planet types) is
proposed as the next unit of work — confirm with the user before starting it.

## Canonical files (trust order)
`PROGRESS.md` (this) → `RULES_CLARIFICATIONS.md` (values; §A decisions, §K errata) →
`COMPONENTS.md` (inventory/status) → `PERFORMANCE.md` (viewer perf investigation/findings, read
before touching viewer rendering) → `rulebook-v1.0.txt` / `.pdf` (source) →
`faction-overview-table.txt` (community faction data).
