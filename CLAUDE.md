# Claude Working Notes

This repo is the active Lost Fleet worktree for the shared Codex/Claude workflow.

## Current Branch

- **Temporary exception: continue the current Lost Fleet viewer work on
  `claude/lost-fleet-viewer-support-95lled`, then sync `master` when the user explicitly asks for a
  deploy.** `master` and that branch were identical at `0e678332` when this Codex session started;
  later in the same session the user asked to push `master` so Vercel would deploy, so the current
  viewer-work tip now exists on both branches.
- Historical context: earlier on 2026-06-29 the workflow had briefly simplified to "push directly
  to `master`" after `claude/lost-fleet-viewer-support-95lled` was fully absorbed there. That
  simplification is superseded for now by the user's later branch-specific instruction above.
- `master` remains the production/Vercel target, and the current viewer-work tip has already been
  synced there.

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
- Engine: 470/470 tests passing. Viewer: 161/161 tests passing.
- The self-contained viewer can now boot Lost Fleet directly via `?lostFleet=1` (for example
  `?players=2&seed=lost-fleet-space-map&lostFleet=1`).
- Darkanians and Space Giants now correctly place only 1 starting mine during Lost Fleet setup, and
  the viewer now uses Asteroid=pink / Protoplanet=turquoise.
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
