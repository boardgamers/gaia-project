# Codex Working Notes

This repo is the active Lost Fleet worktree for this project.

## Current Branch

- Branch: `gedyrk`
- Tracks: `origin/claude/lost-fleet-expansion-gedyrk`
- Repo root: `C:\Users\okimm\Documents\Codex\gaia-lost-fleet-gedyrk`

## Read Order

1. `docs/lost-fleet/PROGRESS.md`
2. `docs/lost-fleet/RULES_CLARIFICATIONS.md`
3. `docs/lost-fleet/COMPONENTS.md`
4. `docs/lost-fleet/PERFORMANCE.md` before touching viewer rendering
5. Recent commits on `gedyrk`

## What Is Already In Place

- Lost Fleet chunks 1 through 7b are implemented and tested.
- `new Engine([...], { lostFleet: true })` now builds a playable Lost Fleet board.
- Engine tests are currently recorded as `372/372` passing in `docs/lost-fleet/PROGRESS.md`.

## Open Work

The current next steps in the repo handoff are:

1. Spaceship Boards live gameplay wiring
2. Space Giants' Exploration-board special action
3. Tinkeroids and Moweyds after the remaining ambiguity is resolved
4. Viewer-side `Object.values(Faction)` cleanup
5. Revised Space Sector tiles 05/06/07 art-backed implementation

## Safety Rules

- Do not overwrite or revert changes that may have been made in another session.
- Check `git status --short --branch` before editing.
- If the task touches viewer rendering, read `docs/lost-fleet/PERFORMANCE.md` first.
- Prefer updating the handoff docs when the project state changes.
