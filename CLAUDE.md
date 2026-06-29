# Claude Working Notes

This repo is the active Lost Fleet worktree for the shared Codex/Claude workflow.

## Current Branch

- Branch: `claude/lost-fleet-viewer-support-95lled`
- This is now the single consolidated branch — all unique work from the other Lost Fleet branches
  (`claude/lost-fleet-expansion-gedyrk`, `claude/quirky-thompson-gt0n0h`,
  `claude/spaceship-boards-gameplay-opnt1p`) has been cherry-picked in here. Develop and push only
  on this branch unless told otherwise.

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
- Engine: 467/467 tests passing. Viewer: 155/155 tests passing.
- The viewer is deployed to Vercel with Git integration (auto-deploys on push to this branch).
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
