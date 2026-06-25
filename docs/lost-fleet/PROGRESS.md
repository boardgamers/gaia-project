# Lost Fleet — Progress & Next-Session Handoff

> **New session? Start here.** This file is the running state of the project. Read it, then read
> `RULES_CLARIFICATIONS.md` (the value ledger) and `COMPONENTS.md` (the inventory/status). Then ask
> the user "what next?" and use the **Next actions** section below to guide them.
> Last updated: **2026-06-25**.

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
3. ✅ **Expansion enum (A1) LOCKED & verified** against `engine/src/enums.ts`
   (`RULES_CLARIFICATIONS.md` §A1): `None=0, Frontiers=2, LostFleet=4, All=Frontiers|LostFleet=6`;
   keep `All` (8 enumeration sites use it); migrate the ~12 strict-equality `=== Expansion.Frontiers`
   checks to bitwise; add `hasExpansion()`; enforce single-selection at game init. **Not yet coded.**
4. ✅ **4 new faction boards — owner-CONFIRMED** (`RULES_CLARIFICATIONS.md` §B): Tinkeroids,
   Darkanians, Moweyds, Space Giants (starting resources/power/research/PI income, in engine syntax).
5. ✅ **Base-faction LF deltas** captured (§I7): Lantids 4/0 + 13c + 1pw income, Ivits 2/2, Bal T'aks
   7-VP shuttle, Xenos/Gleens PI tweaks, etc. (community-sourced; cross-checks vs prose).
6. ✅ **Tile/booster/scoring/tech/federation/artifact EFFECTS** — covered by rulebook prose
   (Appendices II–VII), already read and referenced.
7. ◐ **Spaceship action COSTS** read from art (§C). Effects/slot-counts/charge-values still pending.
8. ✅ Evaluated the uiqoo.kr randomizer: it's a seeded PNG image-renderer of setups with **no effect
   text** — not a viable source for "what components do." Skip it (maybe use only for map-tile images).

## Still MISSING — all art-only, need photos (no text/randomizer source exists)
Priority order (gates the most downstream code first):
1. **Adjusted Economy research tile** — level 3 & 4 income, BOTH sides. (§F1)
2. **4 Spaceship boards** (Twilight, Rebellion, T F Mars, Eclipse) — each action space's exact
   EFFECT, the Standard-Tech slot count (2 or 3), Twilight's artifact-slot count, and the
   shuttle-space charge values (spaces 1–5). (§C)
3. **Tinkering tiles** — 5 of 6 effects (rulebook shows only 1). (§B1)
4. **Artifact tokens** — count of each type among the 13 (effects already known). (§G6)
5. **Federation tokens** — which of the 8 carry the green side (effects already known). (§G5)
6. **Map tile planet layouts** — Deep Space (8×2 sides), Interspace (per player count), Revised
   Space Sectors. (§H2–H4) ← the one place the randomizer could substitute, via tile images.
7. **Moweyds/Tinkeroids Terraforming board** layout (mostly random-fill; low priority). (§B5)

**How to fill:** user photographs the item → drop the image in chat → render/read with PyMuPDF or
read the image directly → transcribe into `RULES_CLARIFICATIONS.md` with Source `BOARD-ART` /
Confidence `CONFIRMED`, and flip the matching `COMPONENTS.md` row to `◐ SPEC`.

## Build order once the spec is filled (from the brief)
1. **Engine**: Lost Fleet behind `Expansion.LostFleet`; all existing base-game tests stay green
   (`cd engine && npm test`). Start with enums.ts (A1), then Planet/Faction enums, faction-boards/
   *.ts for the 4 new factions, then exploration/ships (reuse Frontiers helpers), tiles.
2. **Viewer**: new player colors (turquoise/pink) + 2 new planet types first; then plain-SVG panels
   for spaceships/exploration/tracks (do NOT use scanned official art; style-match later).
3. **Supabase backend** glue + realtime sync — last, once single-browser play works end to end.

## Canonical files (trust order)
`PROGRESS.md` (this) → `RULES_CLARIFICATIONS.md` (values; §A decisions, §K errata) →
`COMPONENTS.md` (inventory/status) → `rulebook-v1.0.txt` / `.pdf` (source) →
`faction-overview-table.txt` (community faction data).
