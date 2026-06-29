# Codex Working Notes

This repo is the active Lost Fleet worktree for this project.

## Current Branch

- **Temporary exception to the earlier single-branch note: continue the current Lost Fleet viewer
  work on `claude/lost-fleet-viewer-support-95lled`, then sync `master` when the user explicitly
  asks for a Vercel deploy.** `master` and that branch were identical at `0e678332` when this Codex
  session started; later in the same session the user asked to push `master` so Vercel would
  deploy, so the current viewer-work tip now exists on both branches.
- Historical context: earlier on 2026-06-29 the project had briefly simplified to "push directly to
  `master`" after `claude/lost-fleet-viewer-support-95lled` was fully absorbed there. That
  simplification is superseded for now by the user's later branch-specific request above.
- If your local clone is missing files you'd expect (e.g. this file, `PERFORMANCE.md`,
  `CODEX_HANDOFF.md`, or `viewer/src/components/SpaceMap.spec.ts`), your local `master` is stale —
  run `git fetch origin && git pull origin master` before doing anything else. `master` was
  deliberately left untouched for most of this project's history, so an old local clone of it can
  be missing a huge amount of work that has long existed on the feature branches.
- Note: `master` is still the Vercel production deploy target, and the current viewer-work tip has
  already been synced there for deployment.

## Read Order

1. `docs/lost-fleet/PROGRESS.md` — read its **Working agreements** section first; it's a standing
   instruction, not optional.
2. `docs/lost-fleet/RULES_CLARIFICATIONS.md`
3. `docs/lost-fleet/COMPONENTS.md`
4. `docs/lost-fleet/PERFORMANCE.md` before touching viewer rendering
5. Recent commits on this branch

## What Is Already In Place

- Lost Fleet chunks 1 through 7b, Darkanians' Planetary Institute, the full Explore/federation/
  Standard-Tech claim hooks, all 12 Spaceship Board actions (live gameplay wiring complete),
  claimed-ship Federation token gold-side execution + rescoring, Space Giants' Exploration special
  action, the Scoring Board Extension's alternate Advanced Tech gate, the 6 Lost Fleet Advanced
  Tech tiles, and Examine Artifact + Artifact-token seeding are all implemented and tested.
- `new Engine([...], { lostFleet: true })` builds a real, playable Lost Fleet board.
- Engine tests: 467/467 passing. Viewer tests: 160/160 passing.
- The self-contained viewer can now boot Lost Fleet directly via `?lostFleet=1` (for example
  `?players=2&seed=lost-fleet-space-map&lostFleet=1`).
- The viewer is deployed to Vercel (Git integration); `master` is the production deploy target.

## Open Work

See `docs/lost-fleet/PROGRESS.md`'s "Next actions" section for the current prioritized list —
confirm with the user before starting any item.

## Safety Rules

- Do not overwrite or revert changes that may have been made in another session.
- Check `git status --short --branch` before editing.
- If the task touches viewer rendering, read `docs/lost-fleet/PERFORMANCE.md` first.
- Prefer updating the handoff docs when the project state changes.
