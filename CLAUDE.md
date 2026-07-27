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
- Engine: 599/599 tests passing. Viewer: 308/308 tests passing (as of 2026-07-05 — trust
  `PROGRESS.md`'s "Testing" section over this line if they disagree).
- A "Gaia 4" UI polish pass (2026-07-04, PROGRESS.md #66) fixed 11 owner-reported viewer bugs:
  faction-wheel swatch spacing, the lobby game-bar's black-circle bug, taken artifacts vanishing
  instead of showing on the player board, tiny Examine Artifact icons, the
  round-scoring/power-action-row layout (now derived from a shared `researchBoardHeight` helper
  instead of a stale hardcoded height), a mobile-only dead gap between Turn Order and the first
  faction board (which turned out to share a root cause with an unreachable-log-tail bug), two
  Setup Preview layout bugs (duplicate scoring-tile column + a cropped-off research track),
  overlapping Twilight artifact icons, T F Mars's QIC action showing raw "tt" text instead of the
  tech-tile icon, and the Deep Space condition icon's color.
- **The 12th item (the Terraform Standard Tech tile's free-mine prompt) was fixed, shipped to
  `master`, then REVERTED the same session** after it broke loading the one real in-progress game:
  wiring an automatic trigger into `moveChooseTechTile` inserted a new required move into the game's
  move sequence, and the hosted app always reconstructs a game by replaying its _entire_ stored move
  history through current code (no version gate) - so a game that had already claimed that tile
  before the trigger existed had its historical log misinterpreted and threw during replay (blank
  screen under the banner). See PROGRESS.md #66's revert note before re-attempting this: it needs a
  way to tell old recorded history apart from a fresh move first, or any similar "new required move"
  change will hit the same failure mode.
- Premove (queue a move while it's not your turn, executed server-side so it works even fully
  offline): Phase 0 (spike), Phase 1 (MVP — schema, RPCs, client fast-path, UI), Phase 2 (offline
  auto-leech), and Phase 3 (multi-slot Sequential + Priority queues) are all DONE in code/schema/
  tests and DEPLOYED, see `docs/lost-fleet/PROGRESS.md` #66-#68, #71, #73 and
  `docs/lost-fleet/PREMOVE_PLAN.md`'s "Phase 0 result" and §10.1-10.8. A race-condition audit (#68)
  verified the existing validation mechanism already safely handles every "board state changed
  between queue-time and execution-time" scenario considered so far, with no code changes needed
  (its recommended regression tests remain unwritten — still open). `resolve-automation` (incl.
  Phase 2's RoundLeech branch) and migration `0012` (Phase 3's `mode` column + RPCs) are live on
  `mitawjpdxkheascdiffz`, `app_config['resolve_automation']` is seeded, and a live two-browser
  session confirmed a queued premove actually auto-fires — premoves and auto-leech now genuinely
  work fully offline, not just via the client-side fast-path. #73 also found and fixed a real bug
  while driving `PremoveModal.vue` through a real browser for the first time: `Game.vue`'s
  `applyPremoveMove()` broke on any premove needing more than one click to compose.
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

- The two side games (sidebar chess, research-panel renju) are **per-viewer** as of PROGRESS #118:
  which face a drawer shows lives in `localStorage` (per game, per account), not in
  `chess_board`/`renju_board`'s `panel_mode`. Their turn pushes are their own notification
  categories (`chess_pushes`/`renju_pushes`), and both they and the game bar's green pulse go quiet
  once the Gaia game is finished. `viewer/src/hosted/turn-kinds.ts` is the one list to extend for a
  future side game. **#118's migration `20260727120000_minigame_push_prefs.sql` and its `notify`
  Edge Function redeploy are not yet applied** — until they are, saving notification settings fails.

## Next Work

See `docs/lost-fleet/PROGRESS.md`'s "Next actions" section — confirm with the user before starting
any of the listed items.

## Switching Safety

- Check `git status --short --branch` before editing.
- Treat the repo as shared with another session unless the worktree is clean.
- Do not overwrite or revert changes made by another active session.
- Update `docs/lost-fleet/PROGRESS.md` when the project state changes.
