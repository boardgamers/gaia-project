# Lost Fleet — project working notes

This folder is the **source of truth** for adding the official *Gaia Project: The Lost Fleet*
expansion to this fork of the open-source `boardgamers/gaia-project` engine + viewer, plus a thin
private Supabase multiplayer backend for invite-only async play among friends who own the game.

## Canonical documents (read in this order)
1. **`rulebook-v1.0.pdf`** — the official rulebook (v1.0). The PDF holds the component artwork.
2. **`rulebook-v1.0.txt`** — searchable text layer extracted from the PDF (`pdftotext -layout`).
   Prose is complete here; **numeric values that live only as artwork are NOT in the text** (faction
   income strings, terraform layouts, spaceship action spaces, tile counts, the p.16 faction-summary
   deltas — p.16 extracts as just a list of faction names).
3. **`COMPONENTS.md`** — full physical-component inventory + implementation status tracker.
4. **`RULES_CLARIFICATIONS.md`** — the authoritative ledger for every value/rule not stated plainly
   in prose. Trust this file over re-deriving. Architecture decisions are in §A; the locked
   `Expansion` enum shape is §A1; the errata-check result is §K.

## Status (as of 2026-06-25)
- ☑ Rulebook + planning docs imported and version-controlled.
- ☑ Errata check done: **no official errata exists**; v1.0 is authoritative (§K).
- ☑ `Expansion` enum restructure (A1) decided and locked, verified against `engine/src/enums.ts`.
- ☐ Fill `TODO [BOARD-ART]` values from the physical game (next: 4 new faction boards + adjusted
  Economy + Lantids tiles — they gate the most downstream code).
- ☐ Engine implementation behind the `Expansion.LostFleet` flag (base-game tests must stay green).

## Repo setup
- Cloned from upstream `boardgamers/gaia-project`; that remote is named **`upstream`** (not `origin`).
- **No `origin` yet.** Intended posture: a **new private GitHub repo** as `origin` (a public *fork*
  would violate the privacy/legal requirement — keep it invite-only, no public URL, no scraped art).
  Pull engine fixes from `upstream`; push work to the private `origin`.
- Monorepo (pnpm workspaces): `engine/`, `viewer/`, `old-ui/`. Engine tests: `engine/` → `npm test`.
