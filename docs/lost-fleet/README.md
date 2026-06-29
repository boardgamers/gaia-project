# Lost Fleet — project working notes

This folder is the **source of truth** for adding the official *Gaia Project: The Lost Fleet*
expansion to this fork of the open-source `boardgamers/gaia-project` engine + viewer, plus a thin
private Supabase multiplayer backend for invite-only async play among friends who own the game.

> 🟢 **New session / "what do I do next?" → read [`PROGRESS.md`](PROGRESS.md) first.** It's the
> running state + prioritized next actions, kept current each session.

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

## Status (as of 2026-06-29 — superseded almost entirely by PROGRESS.md; this section is
historical context only, not a current tracker)
- ☑ Rulebook + planning docs imported and version-controlled.
- ☑ Errata check done: **no official errata exists**; v1.0 is authoritative (§K).
- ☑ `Expansion` enum restructure (A1) decided and locked, verified against `engine/src/enums.ts`.
- ☑ Engine implementation behind the `Expansion.LostFleet` flag is essentially complete: 467/467
  engine tests pass, all 12 Spaceship Board actions, Explore/federation/Standard-Tech claim hooks,
  both faction specials, and the 6 Advanced Tech tiles are implemented and tested. See
  `PROGRESS.md`'s "Done so far" list for the full numbered history.
- ☐ Viewer-side Lost Fleet UI (map rendering, spaceship board panels, player-color pieces) — not
  started yet; see `PROGRESS.md`'s "Next actions".

## Repo setup
- Cloned from upstream `boardgamers/gaia-project`; that remote was originally named **`upstream`**.
- `origin` is now `kimphamnguyen/gaia-lost-fleet` on GitHub (private). The active branch is
  `claude/lost-fleet-viewer-support-95lled`; `master` is kept fast-forwarded to match it and is the
  Vercel production deploy target.
- Monorepo (pnpm workspaces): `engine/`, `viewer/`, `old-ui/`. Engine tests: `engine/` → `npm test`.
