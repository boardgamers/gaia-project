# Codex Handoff

This note exists so Codex can resume work quickly without re-reading the whole repo history.
The user switches between Claude Code and Codex on this project, so keep this current whenever a
session ends — it's the fastest on-ramp for whichever tool picks up next.

## Working Assumptions

- The user switches between Claude Code and Codex; treat the repo as shared with another session
  unless `git status --short --branch` is clean.
- **Temporary exception: for the current Lost Fleet viewer pass, do active code work on
  `claude/lost-fleet-viewer-support-95lled`.** `master` and that branch were identical at
  `0e678332` when this Codex session started, and the user explicitly asked this session to
  continue the new viewer work there first. Later in the same session the user also explicitly asked
  to sync/push `master` so Vercel would deploy, so the current viewer-work tip now exists on both
  branches.
- Historical context: earlier on 2026-06-29 the project had briefly dropped the separate
  feature-branch workflow after `claude/lost-fleet-viewer-support-95lled` was fully absorbed into
  `master` (identical tip, `0ae1a9c`). That simplification is superseded for now by the user's later
  branch-specific instruction above.
- **If your local clone is missing files this doc references** (itself, `PERFORMANCE.md`,
  `AGENTS.md`, or `viewer/src/components/SpaceMap.spec.ts`), your local `master` is stale — run
  `git fetch origin && git pull origin master` before reading anything else. `master` was
  deliberately left untouched for most of this project's history (all work happened on feature
  branches), so an old local clone of `master` can predate huge amounts of work that's been on
  `origin` for a long time. This has already bitten one handoff — see `PROGRESS.md` #37/#38.
- `master` is also the Vercel production deploy target, so every push goes live immediately. This
  is an accepted tradeoff for a single-branch, single-contributor workflow, not a bug to fix.
- 7 superseded branches still exist on `origin` (`claude/lost-fleet-advtech-tiles-c2fo8w`,
  `claude/lost-fleet-engine-work-l3bzsk`, `claude/spaceship-boards-gameplay-opnt1p-t991fv`,
  `codex/continue-lost-fleet-work`, `claude/lost-fleet-expansion-gedyrk`,
  `claude/quirky-thompson-gt0n0h`, `claude/spaceship-boards-gameplay-opnt1p`). They have no unique
  content left to cherry-pick but `git push origin --delete` fails with `HTTP 403` for this
  session's credentials — deletion needs the user's own GitHub access. Don't pull work from them.

## Resume Checklist

1. Run `git status --short --branch` and confirm which branch you're on. For this viewer-work thread
   it should currently be `claude/lost-fleet-viewer-support-95lled`; if your local `master` is
   stale, still `git fetch origin && git pull origin master` first so the docs/codebase are current,
   then switch to the active feature branch before editing.
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
- Engine: **470/470** tests passing (`cd engine && npm test`). Viewer: **161/161** tests passing
  (`cd viewer && npx vue-cli-service test:unit --timeout 4000 'src/**/*.spec.ts'
  'src/logic/**/*.spec.ts'`).
- "Viewer Step Zero" is done: the viewer builds and type-checks clean against the Lost Fleet engine
  (the 6 `Object.values(Faction)` call sites and related gaps are all fixed).
- Lost Fleet map rendering has started: `SpaceMap.vue` now renders Interspace / Deep Space hexes
  directly from `engine.map.grid`, `SpaceHex.vue` distinguishes Lost Fleet sector types and spaceship
  tiles visually, and `SpaceMap.spec.ts` has a real Lost Fleet smoke test alongside the base-game one.
- Lost Fleet self-contained viewer links now work: `self-contained.ts` accepts `lostFleet=1`, and
  `FactionWheel.vue` now surfaces Asteroid / Protoplanet when Lost Fleet is active. Concrete demo
  seed: `?players=2&seed=lost-fleet-space-map&lostFleet=1`.
- Darkanians and Space Giants now correctly get only 1 setup placement in Lost Fleet setup, and the
  viewer now uses Asteroid=pink / Protoplanet=turquoise.
- The viewer is deployed to Vercel with Git integration; both `master` and
  `claude/lost-fleet-viewer-support-95lled` auto-deploy on push (`master` is the production target).
- `CLAUDE.md` and `AGENTS.md` at the repo root both mirror this file's read order and current state
  — they were rewritten from scratch on 2026-06-29 after being found stale (wrong branch name, dead
  Windows path, old test counts). Keep all three in sync going forward.

## Next Likely Work

Per `PROGRESS.md`'s "Next actions", in priority order:

1. **Tinkeroids/Moweyds** — blocked until the user resolves the §B5 scan-order ambiguity.
2. **Continue the new Lost Fleet UI work** — the first map-rendering slice is done, but remaining
   viewer work still includes richer map polish, spaceship board panels, and player-color
   turquoise/pink pieces (`COMPONENTS.md` §10).
3. **Revised Space Sector tiles 05/06/07** (§H4) — the one remaining art-only TODO; needs a photo
   of the physical component.
4. Or a different unit of work entirely (viewer, Supabase), ahead of any blocked item.

Confirm with the user before starting any of the above — this is a standing instruction in
`PROGRESS.md`, not specific to this handoff.
