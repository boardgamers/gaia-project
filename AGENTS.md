# Codex Working Notes

This repo is the active Lost Fleet worktree for this project.

## Current Branch

- **Push directly to `master`.** As of 2026-06-29 there is no separate long-lived feature branch —
  `claude/lost-fleet-viewer-support-95lled` was fully absorbed into `master` and is kept only as a
  historical ref.
- If your local clone is missing files you'd expect (e.g. this file, `PERFORMANCE.md`,
  `CODEX_HANDOFF.md`, or `viewer/src/components/SpaceMap.spec.ts`), your local `master` is stale —
  run `git fetch origin && git pull origin master` before doing anything else. `master` was
  deliberately left untouched for most of this project's history, so an old local clone of it can
  be missing a huge amount of work that has long existed on the feature branches.
- Note: `master` is the Vercel production deploy target — every push goes live immediately.
- An explicit owner handoff may instead name a phase branch and forbid `master`. Follow that
  task-specific branch instruction over this default; do not switch, pull, commit, or push merely
  as part of startup unless the task authorizes it.

## Context-Efficient Read Routing

Always start with:

1. `git status --short --branch` and the recent commits on the current branch.
2. `docs/lost-fleet/PROGRESS.md`'s **Working agreements**, **Current task index**, and the current
   policy/commands at the start of **Testing — required going forward**. Stop at its labeled
   historical rerun log; do **not** read the project history cover to cover.
3. The files to be changed, their direct imports/callers, and the focused tests that establish their
   contract.

Load additional documents only when the task touches their subject:

- `RULES_CLARIFICATIONS.md` for game-rule interpretation or shared engine legality/scoring work.
- `COMPONENTS.md` for component inventory, shared-engine architecture, or viewer integration.
- `PERFORMANCE.md` before viewer rendering/performance work.
- For offline AI work, read `docs/lost-fleet/AI_CURRENT.md` first. It is the canonical compact
  session contract and names the relevant README/plan sections and source API surfaces. Enumerate
  `engine/src/ai/` with `rg --files`, then inspect only the requested phase's files and dependencies.

Explicit owner instructions still override this routing. Handoff authors should name exact sections
and source files rather than saying to read large documents or directories completely.

## Token Economy

- Target no more than about 4,000 lines / 200 KB of startup context. This is a routing target, not a
  correctness cap: if more is genuinely needed, explain the dependency or uncertainty before
  loading it.
- Use `rg` for headings, exports, symbols, and filenames, then read scoped ranges. Read a file over
  500 lines completely only when editing it or when its whole contract is directly under review.
- Never print a complete generated manifest, corpus fixture, long test log, or repository-wide diff
  into the conversation. Prefer counts, hashes, `git diff --stat`, and focused hunks.
- Do not reread material already loaded in the same logical task or preserved in a compaction
  summary. Follow links only when the current source leaves a real ambiguity.
- Keep one current source of truth for status and measurements. Historical handoffs stay immutable;
  link to them instead of copying their contents into each new handoff.
- Follow `PROGRESS.md`'s risk-based testing cadence. One final full suite after source freeze is more
  useful than overlapping or premature exhaustive runs.

## What Is Already In Place

- Lost Fleet chunks 1 through 7b, Darkanians' Planetary Institute, the full Explore/federation/
  Standard-Tech claim hooks, all 12 Spaceship Board actions (live gameplay wiring complete),
  claimed-ship Federation token gold-side execution + rescoring, Space Giants' Exploration special
  action, the Scoring Board Extension's alternate Advanced Tech gate, the 6 Lost Fleet Advanced
  Tech tiles, and Examine Artifact + Artifact-token seeding are all implemented and tested.
- `new Engine([...], { lostFleet: true })` builds a real, playable Lost Fleet board.
- Engine tests: 490/490 passing. Viewer tests: 168/168 passing.
- The self-contained viewer can now boot Lost Fleet directly via `?lostFleet=1` (for example
  `?players=2&seed=lost-fleet-space-map&lostFleet=1`).
- Darkanians and Space Giants now correctly place only 1 starting mine in Lost Fleet's expansion-
  faction setup stage (after base-game factions finish their normal setup, before Ivits), and the
  viewer now uses Asteroid=pink / Protoplanet=turquoise.
- The viewer now shows Lost Fleet ship actions as a compact second row that reuses the base board
  action tile dimensions, with a separate rewards board for ship tech / federation / artifacts.
- Lost Fleet player pieces now use the correct turquoise/pink faction-color treatment independently
  of Asteroid/Protoplanet planet colors (for example, Darkanians pieces render turquoise on pink
  Asteroid planets, and Space Giants pieces render pink on turquoise Protoplanets).
- Lost Fleet map polish now includes explicit `IS` / `DS` map badges for Interspace / Deep Space
  hexes, clearer spaceship hex markers plus a lightweight map legend, and matching T/R/M/E ship
  markers reused in the ship-action and ship-rewards panels.
- The viewer is deployed to Vercel (Git integration); `master` is the production deploy target.

## Open Work

See `docs/lost-fleet/PROGRESS.md`'s "Current task index" first. Treat the much larger "Next actions"
section as a searchable historical ledger. Confirm before selecting an item when the user has not
already supplied a concrete task.

## Safety Rules

- Do not overwrite or revert changes that may have been made in another session.
- Check `git status --short --branch` before editing.
- If the task touches viewer rendering, read `docs/lost-fleet/PERFORMANCE.md` first.
- Prefer updating the handoff docs when the project state changes.
