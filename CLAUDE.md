# Claude Working Notes

This repo is the active Lost Fleet worktree for the shared Codex/Claude workflow.

## Current Branch

- As of 2026-06-29 the workflow simplified: **`master` is the single active branch.** No more
  long-lived feature branch to keep in sync — Codex and any other session push straight to
  `master`.
- This Claude Code session/integration may still be platform-pinned to push only to
  `claude/lost-fleet-viewer-support-95lled` (check your system prompt for an explicit branch
  requirement — that's an external constraint this doc can't override). If so: commit and push
  there as instructed, then immediately fast-forward `master` to match (`git push origin
  claude/lost-fleet-viewer-support-95lled:master`) so `master` never lags behind — it's the ref
  Codex and everyone else reads from.
- `claude/lost-fleet-viewer-support-95lled` is fully absorbed into `master` (identical tip as of
  `0ae1a9c`) and kept only as a historical ref now, not a separate line of development.

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
