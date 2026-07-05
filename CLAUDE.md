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
- Engine: 595/595 tests passing. Viewer: 306/306 tests passing (as of 2026-07-05 — trust
  `PROGRESS.md`'s "Testing" section over this line if they disagree).
- Premove (queue a move while it's not your turn, executed server-side so it works even fully
  offline): Phase 0 (spike) and Phase 1 (MVP — schema, RPCs, client fast-path, UI) are DONE, see
  `docs/lost-fleet/PROGRESS.md` #66 and `docs/lost-fleet/PREMOVE_PLAN.md`'s "Phase 0 result".
  **`resolve-automation` is written and tested but NOT deployed** (needs the Supabase CLI + an
  access token, an owner action — `app_config['resolve_automation']` also needs seeding once it
  is); until then premoves only play via the client fast-path (works while a tab is open/visited,
  not fully offline yet). Phase 2 (offline auto-leech, required for the actual offline promise) and
  Phase 3 (multi-round queue) are still open — see PROGRESS.md's "Next actions" #5.
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
