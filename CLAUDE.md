# Claude Working Notes

This repo is the active Lost Fleet worktree for the shared Codex/Claude workflow.

## Current Branch

- Branch: `gedyrk`
- Tracks: `origin/claude/lost-fleet-expansion-gedyrk`
- Repo root: `C:\Users\okimm\Documents\Codex\gaia-lost-fleet-gedyrk`

## Shared Source Of Truth

Read these before coding:

1. `docs/lost-fleet/PROGRESS.md`
2. `docs/lost-fleet/RULES_CLARIFICATIONS.md`
3. `docs/lost-fleet/COMPONENTS.md`
4. `docs/lost-fleet/PERFORMANCE.md` before touching viewer rendering

## Current State

- Lost Fleet chunks 1 through 7b are implemented.
- Darkanians' Planetary Institute ability is now implemented and tested.
- `docs/lost-fleet/PROGRESS.md` records `362/362` passing engine tests.

## Next Work

The highest-priority remaining implementation item is Spaceship Boards live gameplay wiring.

## Switching Safety

- Check `git status --short --branch` before editing.
- Treat the repo as shared with another session unless the worktree is clean.
- Do not overwrite or revert changes made by another active session.
- Update `docs/lost-fleet/PROGRESS.md` when the project state changes.
