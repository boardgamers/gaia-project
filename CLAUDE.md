# Claude Working Notes

This repo is the active Lost Fleet worktree for the shared Codex/Claude workflow.

## Current Branch

- **Push directly to `master`.** As of 2026-06-29 there is no separate long-lived feature branch —
  `claude/lost-fleet-viewer-support-95lled` was fully absorbed into `master` and is kept only as a
  historical ref.
- If your local clone is missing files this note references (`PERFORMANCE.md`, `AGENTS.md`,
  `CODEX_HANDOFF.md`, `viewer/src/components/SpaceMap.spec.ts`), your local `master` is stale —
  run `git fetch origin && git pull origin master` before doing anything else.
- `master` is the production/Vercel target, so every push goes live immediately.

## Shared Source Of Truth

Read these before coding:

1. `docs/lost-fleet/PROGRESS.md` — also read its **Working agreements** section first; it's a
   standing instruction, not optional.
2. `docs/lost-fleet/RULES_CLARIFICATIONS.md`
3. `docs/lost-fleet/COMPONENTS.md`
4. `docs/lost-fleet/PERFORMANCE.md` before touching viewer rendering

## Current State

- Lost Fleet chunks 1 through 7b, Darkanians' Planetary Institute, the full Explore/federation/
  Standard-Tech claim hooks, all 12 Spaceship Board actions, claimed-ship Federation token
  gold-side execution, Space Giants' Exploration special action, the Scoring Board Extension gate,
  the 6 Lost Fleet Advanced Tech tiles, and Examine Artifact + Artifact-token seeding are all
  implemented and tested.
- A new "Silent Auction" faction-selection variant (`AuctionVariant.Silent`, PROGRESS #61) is
  implemented and tested: sequential ban → sequential pick → sequential private bid submission →
  automatic ascending-auction resolution (`algorithms/silent-auction.ts`), with a setup picker
  (`hosted/CreateGame.vue`), ban/pick/bid UI (`Commands.vue`), and a statistics-panel log
  (`Charts.vue` → `SilentAuctionLog.vue`).
- Engine: 582/582 tests passing. Viewer: 303/303 tests passing (as of 2026-07-04 — trust
  `PROGRESS.md`'s "Testing" section over this line if they disagree).
- A "Gaia 4" UI polish pass (2026-07-04, PROGRESS.md #66) fixed 12 owner-reported viewer bugs:
  faction-wheel swatch spacing, the lobby game-bar's black-circle bug, taken artifacts vanishing
  instead of showing on the player board, the Terraform Standard Tech tile's free-mine prompt never
  firing, tiny Examine Artifact icons, the round-scoring/power-action-row layout (now derived from a
  shared `researchBoardHeight` helper instead of a stale hardcoded height), a mobile-only dead gap
  between Turn Order and the first faction board (which turned out to share a root cause with an
  unreachable-log-tail bug), two Setup Preview layout bugs (duplicate scoring-tile column + a
  cropped-off research track), overlapping Twilight artifact icons, T F Mars's QIC action showing
  raw "tt" text instead of the tech-tile icon, and the Deep Space condition icon's color.
- A premove feature (queue a move while it's not your turn, executed server-side so it works even
  fully offline) is fully designed and owner-approved but **not started** — see
  `docs/lost-fleet/PREMOVE_PLAN.md`, whose own "Phase 0 checklist" is the entry point for whoever
  picks it up next.
- The Lost Fleet component UI is reuse-first as of 2026-07-02 (PROGRESS #50-#53): all LF components
  render through base-game components (TechContent/Condition/Resource icons, FederationTile art,
  TechTile, SpecialAction octagons), one compact per-ship overview strip (`LostFleetShips.vue`),
  dynamic map viewBox with a left sidebar for the faction wheel/legends, and planet-labeled
  IS/DS hex buttons + map badges.
- The self-contained viewer can now boot Lost Fleet directly via `?lostFleet=1` (for example
  `?players=2&seed=lost-fleet-space-map&lostFleet=1`).
- Darkanians and Space Giants now correctly place only 1 starting mine in Lost Fleet's expansion-
  faction setup stage (after base-game factions finish their normal setup, before Ivits), and the
  viewer now uses Asteroid=pink / Protoplanet=turquoise.
- The viewer is deployed to Vercel with Git integration; `master` is the production deploy target,
  so every push to `master` goes live immediately.
- See `docs/lost-fleet/PROGRESS.md`'s "Done so far" list for the full numbered history and "Next
  actions" for what's still open.

## Next Work

See `docs/lost-fleet/PROGRESS.md`'s "Next actions" section — confirm with the user before starting
any of the listed items.

## Switching Safety

- Check `git status --short --branch` before editing.
- Treat the repo as shared with another session unless the worktree is clean.
- Do not overwrite or revert changes made by another active session.
- Update `docs/lost-fleet/PROGRESS.md` when the project state changes.
