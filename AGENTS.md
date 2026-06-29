# Codex Working Notes

This repo is the active Lost Fleet worktree for this project.

## Current Branch

- **Push directly to `master`.** As of 2026-06-29 there is no separate long-lived feature branch —
  `claude/lost-fleet-viewer-support-95lled` was fully absorbed into `master` (identical tip,
  `0ae1a9c`) and is kept only as a historical ref. Develop and commit on `master`.
- If your local clone is missing files you'd expect (e.g. this file, `PERFORMANCE.md`,
  `CODEX_HANDOFF.md`, or `viewer/src/components/SpaceMap.spec.ts`), your local `master` is stale —
  run `git fetch origin && git pull origin master` before doing anything else. `master` was
  deliberately left untouched for most of this project's history, so an old local clone of it can
  be missing a huge amount of work that has long existed on the feature branches.
- Note: `master` is also the Vercel production deploy target — every push goes live immediately.
  That's an accepted tradeoff for a single-branch workflow with one contributor, not a mistake.

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
- Engine tests: 467/467 passing. Viewer tests: 155/155 passing.
- The viewer is deployed to Vercel (Git integration); `master` is the production deploy target.

## Open Work

See `docs/lost-fleet/PROGRESS.md`'s "Next actions" section for the current prioritized list —
confirm with the user before starting any item.

## Safety Rules

- Do not overwrite or revert changes that may have been made in another session.
- Check `git status --short --branch` before editing.
- If the task touches viewer rendering, read `docs/lost-fleet/PERFORMANCE.md` first.
- Prefer updating the handoff docs when the project state changes.
