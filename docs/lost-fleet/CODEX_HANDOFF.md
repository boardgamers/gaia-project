# Codex Handoff

This note exists so Codex can resume work quickly without re-reading the whole repo history.

## Working Assumptions

- The user may switch between Claude Code and Codex.
- The branch to continue from is `gedyrk`.
- The branch tracks `origin/claude/lost-fleet-expansion-gedyrk`.
- The repo state should be treated as shared with another session unless `git status` is clean.

## Resume Checklist

1. Run `git status --short --branch`.
2. Read `docs/lost-fleet/PROGRESS.md`.
3. Read `docs/lost-fleet/RULES_CLARIFICATIONS.md` and `COMPONENTS.md` if the task touches Lost Fleet rules or implementation.
4. Read `docs/lost-fleet/PERFORMANCE.md` before touching viewer rendering.
5. Confirm the next unit of work against `PROGRESS.md` before editing.

## Current Snapshot

- The Lost Fleet map subsystem is already implemented on this branch.
- The branch tip is beyond the map work and now focuses on the remaining Spaceship Boards live gameplay wiring.
- The core Explore action is now implemented in the engine (persistent shuttle state, range/Q.I.C. reach, slot charging, and deploy-cost exceptions).
- Federation-claim redemption from explored ships is now wired into federation formation as additional selectable token choices.
- Ship-seeded Standard Tech redemption is now wired into the normal tech-pick / upgrade flow, including the extra follow-up research advance.
- The docs record `372/372` engine tests passing.

## Next Likely Work

The highest-priority remaining item in the repo handoff is the rest of Spaceship Boards live gameplay wiring:
the remaining ship/token action execution and Twilight artifact handling.
After that, the next explicit item is Space Giants' Exploration-board special action, which is no longer blocked on
core Explore plumbing but still needs its own action hook.
