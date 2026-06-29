# Codex Working Notes

This repo is the active Lost Fleet worktree for this project.

## Current Branch

- Branch: `claude/lost-fleet-viewer-support-95lled`
- This is now the single consolidated branch — all unique work from the other Lost Fleet branches
  has been cherry-picked in here. Develop and push only on this branch unless told otherwise.

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
- The viewer is deployed to Vercel (Git integration, auto-deploys on push to this branch).

## Open Work

See `docs/lost-fleet/PROGRESS.md`'s "Next actions" section for the current prioritized list —
confirm with the user before starting any item.

## Safety Rules

- Do not overwrite or revert changes that may have been made in another session.
- Check `git status --short --branch` before editing.
- If the task touches viewer rendering, read `docs/lost-fleet/PERFORMANCE.md` first.
- Prefer updating the handoff docs when the project state changes.
