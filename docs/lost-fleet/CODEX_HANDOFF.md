# Codex Handoff

This note exists so Codex can resume work quickly without re-reading the whole repo history.
The user switches between Claude Code and Codex on this project, so keep this current whenever a
session ends — it's the fastest on-ramp for whichever tool picks up next.

## Working Assumptions

- The user switches between Claude Code and Codex; treat the repo as shared with another session
  unless `git status --short --branch` is clean.
- The branch to continue from is `claude/lost-fleet-viewer-support-95lled`. This is the single
  consolidated branch — all unique work from every other Lost Fleet branch has been cherry-picked
  into it (see `PROGRESS.md` "Done so far" #35/#36).
- As of 2026-06-29, `origin/master` was fast-forwarded to exactly match this branch (`git diff
  origin/master origin/claude/lost-fleet-viewer-support-95lled --stat` is empty). Either ref gives
  the same code right now, but keep developing on `claude/lost-fleet-viewer-support-95lled` and
  push there — don't push new work straight to `master` without the user's explicit say-so again.
- 7 superseded branches still exist on `origin` (`claude/lost-fleet-advtech-tiles-c2fo8w`,
  `claude/lost-fleet-engine-work-l3bzsk`, `claude/spaceship-boards-gameplay-opnt1p-t991fv`,
  `codex/continue-lost-fleet-work`, `claude/lost-fleet-expansion-gedyrk`,
  `claude/quirky-thompson-gt0n0h`, `claude/spaceship-boards-gameplay-opnt1p`). They have no unique
  content left to cherry-pick but `git push origin --delete` fails with `HTTP 403` for this
  session's credentials — deletion needs the user's own GitHub access. Don't pull work from them.

## Resume Checklist

1. Run `git status --short --branch` and confirm you're on `claude/lost-fleet-viewer-support-95lled`.
2. Read `docs/lost-fleet/PROGRESS.md` in full — start with its **Working agreements** section
   (standing instruction, not optional), then the "Done so far" list and "Next actions".
3. Read `docs/lost-fleet/RULES_CLARIFICATIONS.md` and `COMPONENTS.md` if the task touches Lost
   Fleet rules or implementation.
4. Read `docs/lost-fleet/PERFORMANCE.md` before touching viewer rendering.
5. Confirm the next unit of work against `PROGRESS.md`'s "Next actions" before editing — it asks
   to confirm with the user first.

## Current Snapshot (as of 2026-06-29)

- Lost Fleet chunks 1-7b, Darkanians' Planetary Institute, the full Explore/federation/Standard-Tech
  claim hooks, all 12 Spaceship Board actions (live gameplay wiring complete), claimed-ship
  Federation token gold-side execution + rescoring, Space Giants' Exploration special action, the
  Scoring Board Extension's alternate Advanced Tech gate, the 6 Lost Fleet Advanced Tech tiles, and
  Examine Artifact + Artifact-token seeding are implemented and tested.
- Engine: **467/467** tests passing (`cd engine && npm test`). Viewer: **155/155** tests passing
  (`cd viewer && npx vue-cli-service test:unit --timeout 4000 'src/**/*.spec.ts'
  'src/logic/**/*.spec.ts'`).
- "Viewer Step Zero" is done: the viewer builds and type-checks clean against the Lost Fleet engine
  (the 6 `Object.values(Faction)` call sites and related gaps are all fixed).
- The viewer is deployed to Vercel with Git integration; both `master` and
  `claude/lost-fleet-viewer-support-95lled` auto-deploy on push (`master` is the production target).
- `CLAUDE.md` and `AGENTS.md` at the repo root both mirror this file's read order and current state
  — they were rewritten from scratch on 2026-06-29 after being found stale (wrong branch name, dead
  Windows path, old test counts). Keep all three in sync going forward.

## Next Likely Work

No new Lost Fleet UI work has started yet. Per `PROGRESS.md`'s "Next actions", in priority order:

1. **Tinkeroids/Moweyds** — blocked until the user resolves the §B5 scan-order ambiguity.
2. **New Lost Fleet UI work** — map rendering for Lost Fleet sectors, spaceship board panels,
   player-color turquoise/pink pieces (`COMPONENTS.md` §10). This is the main unblocked item now
   that Viewer Step Zero is done.
3. **Revised Space Sector tiles 05/06/07** (§H4) — the one remaining art-only TODO; needs a photo
   of the physical component.
4. Or a different unit of work entirely (viewer, Supabase), ahead of any blocked item.

Confirm with the user before starting any of the above — this is a standing instruction in
`PROGRESS.md`, not specific to this handoff.
