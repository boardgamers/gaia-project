# Claude Working Notes

This repo is the active Lost Fleet worktree for the shared Codex/Claude workflow.

## Current Branch

- **Push directly to `master`.** As of 2026-06-29 there is no separate long-lived feature branch —
  `claude/lost-fleet-viewer-support-95lled` was fully absorbed into `master` and is kept only as a
  historical ref.
- If your local clone is missing files this note references (`PERFORMANCE.md`, `AGENTS.md`,
  `CODEX_HANDOFF.md`, `viewer/src/components/SpaceMap.spec.ts`), your local `master` is stale —
  run `git fetch origin && git pull origin master` before doing anything else.
- `master` is the production/Vercel target, so every push goes live immediately.

## Shared Source Of Truth

Read these before coding:

1. `docs/lost-fleet/PROGRESS.md` — also read its **Working agreements** section first; it's a
   standing instruction, not optional.
2. `docs/lost-fleet/RULES_CLARIFICATIONS.md`
3. `docs/lost-fleet/COMPONENTS.md`
4. `docs/lost-fleet/PERFORMANCE.md` before touching viewer rendering

## Testing: run only what the change can break (owner instruction, 2026-08-04)

**Never run the full engine suite — and above all never the offline-AI suite (`engine/src/ai/**`,
`fuzz/`, the corpus campaigns) — for a change that doesn't touch those files.\*_ They take many
minutes, and in this container the full engine run is OOM-killed partway through (exit 137) so it
doesn't even produce an answer. Owner, verbatim: _"ai test is absolute no go when the implementation
has nothing to do with it!"\*

Pick the gate from what you actually edited:

| Changed                                            | Run                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| A viewer component / `viewer/src/**`               | that component's spec, then the viewer suite once at the end       |
| `engine/src/**` (not AI)                           | the affected engine specs, then the engine suite minus `src/ai/**` |
| `engine/src/ai/**`, `fuzz/`, planner/corpus inputs | the AI/corpus gates — the only time they're in scope               |
| Docs/markdown only                                 | nothing; prettier/diff check only                                  |

Always append `--reporter min` (see PROGRESS.md's **Testing** section — it's a standing instruction,
and it exists so a passing run costs ~2 lines of context instead of 700). Run the broad suite **once**,
after the source is stable — not after each edit, and never twice to restate the same number.

## Run prettier before every commit (2026-08-08)

Run **`pnpm run prettier`** from the repo root before committing anything, including docs. The `All`
workflow gates `prettier --check` on every push to every branch, so unformatted code turns CI red and
the owner gets a "run failed" push notification. This is not theoretical: 95 files had drifted (see
PROGRESS.md #146), most formatted at prettier's default 80 columns instead of the repo's
`printWidth: 120` — i.e. by a tool that never read the root `.prettierrc`. The husky pre-commit hook
only exists if `pnpm install` has run in this container, so don't rely on it.

When writing markdown, **never let a backticked code span wrap across a line break inside a list
item.** Prettier's markdown printer then re-indents the _following_ paragraph by +6 spaces on every
run, so `prettier --check` fails no matter how many times you run `--write`. One such span had pushed
a PROGRESS.md paragraph to 383 spaces of indentation.

## Current State

- Lost Fleet chunks 1 through 7b, Darkanians' Planetary Institute, the full Explore/federation/
  Standard-Tech claim hooks, all 12 Spaceship Board actions, claimed-ship Federation token
  gold-side execution, Space Giants' Exploration special action, the Scoring Board Extension gate,
  the 6 Lost Fleet Advanced Tech tiles, and Examine Artifact + Artifact-token seeding are all
  implemented and tested.
- A **"Preference Split Auction"** faction-selection variant (`AuctionVariant.PreferenceSplit`,
  PROGRESS #137) is implemented: one picked faction per player at any supported player count (2–5),
  everyone secretly splits one fixed budget (**20 points per player** since 2026-08-06 — it was 10
  when the variant shipped the day before; fixed by the player count and
  not settable at setup — the budget is the table's whole bill, so payments always sum to it) across
  them all at the same time, then factions are
  ranked by total bid and awarded top-first to the highest still-unassigned bidder, priced at the
  faction average — **always** the average, with no cap at the winner's own bid (owner decision; a cap
  handed table-valued factions out for free), so a winner can pay more VP than they bid. Rules + file map: `docs/lost-fleet/
PREFERENCE_SPLIT_AUCTION.md`. Unlike the Silent Auction, its secrecy is **server-enforced** —
  simultaneous bids never touch `public.moves`; they sit in `auction_sealed_bids` behind RLS and are
  appended as one move per seat in a single transaction by `reveal_sealed_bids()`. **Its three
  migrations ARE applied live** on `mitawjpdxkheascdiffz` (2026-08-05, ledger versions
  `20260805122251 preference_split_sealed_bids`, `20260805130145 lock_down_auction_sealed_bids_grants`,
  `20260805131046 pin_preference_split_budget_search_path`) and verified against the live objects.
  **`resolve-automation` is deployed too** (version 4, 2026-08-05), carrying the
  `_shared/engine.bundle.js` rebuilt for the new `preferenceBid` command, so offline premove/
  auto-leech automation works for this variant. Getting there needed the repo's expired
  `SUPABASE_ACCESS_TOKEN` secret rotated — the `Supabase - Deploy Edge Function` workflow had been
  failing on `401 Unauthorized` since at least 2026-07-27, which had also left `notify` stuck on
  version 13 (now 14). **If that workflow ever starts 401ing again, the secret has expired again;
  that is the whole diagnosis.**
- **Auction pushes + per-device push presence (PROGRESS #143, 2026-08-08).** The Preference Split bid phase notified nobody
  but one player (simultaneous bidding never moves `games.current_seat`, which is what every turn
  push rides on), and mobile push suppression read `players.last_active_at` — one row per seat shared
  by every device — so an open desktop tab silenced the same user's phone. Fixed by
  `announce_sealed_bid_auction()` + `auction_bid_reminders` (migration `20260808120000`) and
  `push_subscriptions.active_game_id`/`active_at` + `mark_device_viewing()` (migration
  `20260808121000`). **Neither migration is applied live yet and `notify` has NOT been redeployed** —
  none of it works until both happen. The Silent Auction was never affected (sequential moves).
- A "Silent Auction" faction-selection variant (`AuctionVariant.Silent`, PROGRESS #61) is
  implemented and tested: sequential ban → sequential pick → sequential private bid submission →
  automatic ascending-auction resolution (`algorithms/silent-auction.ts`), with a setup picker
  (`hosted/CreateGame.vue`), ban/pick/bid UI (`Commands.vue`), and a statistics-panel log
  (`Charts.vue` → `SilentAuctionLog.vue`).
- Engine: 599/599 tests passing. Viewer: 308/308 tests passing (as of 2026-07-05 — trust
  `PROGRESS.md`'s "Testing" section over this line if they disagree).
- A "Gaia 4" UI polish pass (2026-07-04, PROGRESS.md #66) fixed 11 owner-reported viewer bugs:
  faction-wheel swatch spacing, the lobby game-bar's black-circle bug, taken artifacts vanishing
  instead of showing on the player board, tiny Examine Artifact icons, the
  round-scoring/power-action-row layout (now derived from a shared `researchBoardHeight` helper
  instead of a stale hardcoded height), a mobile-only dead gap between Turn Order and the first
  faction board (which turned out to share a root cause with an unreachable-log-tail bug), two
  Setup Preview layout bugs (duplicate scoring-tile column + a cropped-off research track),
  overlapping Twilight artifact icons, T F Mars's QIC action showing raw "tt" text instead of the
  tech-tile icon, and the Deep Space condition icon's color.
- **The 12th item (the Terraform Standard Tech tile's free-mine prompt) was fixed, shipped to
  `master`, then REVERTED the same session** after it broke loading the one real in-progress game:
  wiring an automatic trigger into `moveChooseTechTile` inserted a new required move into the game's
  move sequence, and the hosted app always reconstructs a game by replaying its _entire_ stored move
  history through current code (no version gate) - so a game that had already claimed that tile
  before the trigger existed had its historical log misinterpreted and threw during replay (blank
  screen under the banner). See PROGRESS.md #66's revert note before re-attempting this: it needs a
  way to tell old recorded history apart from a fresh move first, or any similar "new required move"
  change will hit the same failure mode.
- Premove (queue a move while it's not your turn, executed server-side so it works even fully
  offline): Phase 0 (spike), Phase 1 (MVP — schema, RPCs, client fast-path, UI), Phase 2 (offline
  auto-leech), and Phase 3 (multi-slot Sequential + Priority queues) are all DONE in code/schema/
  tests and DEPLOYED, see `docs/lost-fleet/PROGRESS.md` #66-#68, #71, #73 and
  `docs/lost-fleet/PREMOVE_PLAN.md`'s "Phase 0 result" and §10.1-10.8. A race-condition audit (#68)
  verified the existing validation mechanism already safely handles every "board state changed
  between queue-time and execution-time" scenario considered so far, with no code changes needed
  (its recommended regression tests remain unwritten — still open). `resolve-automation` (incl.
  Phase 2's RoundLeech branch) and migration `0012` (Phase 3's `mode` column + RPCs) are live on
  `mitawjpdxkheascdiffz`, `app_config['resolve_automation']` is seeded, and a live two-browser
  session confirmed a queued premove actually auto-fires — premoves and auto-leech now genuinely
  work fully offline, not just via the client-side fast-path. #73 also found and fixed a real bug
  while driving `PremoveModal.vue` through a real browser for the first time: `Game.vue`'s
  `applyPremoveMove()` broke on any premove needing more than one click to compose.
- The Lost Fleet component UI is reuse-first as of 2026-07-02 (PROGRESS #50-#53): all LF components
  render through base-game components (TechContent/Condition/Resource icons, FederationTile art,
  TechTile, SpecialAction octagons), one compact per-ship overview strip (`LostFleetShips.vue`),
  dynamic map viewBox with a left sidebar for the faction wheel/legends, and planet-labeled
  IS/DS hex buttons + map badges.
- The self-contained viewer can now boot Lost Fleet directly via `?lostFleet=1` (for example
  `?players=2&seed=lost-fleet-space-map&lostFleet=1`).
- Darkanians and Space Giants now correctly place only 1 starting mine in Lost Fleet's expansion-
  faction setup stage (after base-game factions finish their normal setup, before Ivits), and the
  viewer now uses Asteroid=pink / Protoplanet=turquoise.
- The viewer is deployed to Vercel with Git integration; `master` is the production deploy target,
  so every push to `master` goes live immediately.
- See `docs/lost-fleet/PROGRESS.md`'s "Done so far" list for the full numbered history and "Next
  actions" for what's still open.

- An online game can keep a **synced offline copy** as of PROGRESS #126 (viewer v5.47.0): the hosted
  gear menu's "Convert to offline game" setting (`viewer/src/hosted/offline-mirror.ts`, per device,
  localStorage only — no database change) puts the game in the offline library and writes every
  committed hosted turn into it. **Two-way, and it never goes backwards:** the copy is refreshed only
  from an online state strictly further along the SAME history (`compareMoveHistories`), and moves
  played offline are uploaded instead (`planOfflineUpload` + `hosted.ts`'s loop), so a copy that is
  ahead is never reverted. A genuinely diverged copy is left alone on both sides. Offline play of a
  copy is seat-locked to `mirrorSeats` (`self-contained.ts`), because only an owned seat can ever be
  committed for online. The three sidebar minigames travel with the copy under the same guarantee
  (`viewer/src/logic/offline-minigame-sync.ts`): their rows hold only a current position, so offline
  play is recorded as an ordered op log (each op carrying its own `previous`/`next`) and replayed
  through the existing `move(previous, next, …)` RPCs, whose own staleness check is what detects a
  conflict. Offline minigame play is colour-locked for the same reason Gaia play is seat-locked. `HostedGameHost.onCommittedState` is what keeps a half-composed turn from
  ever being persisted; use it for anything else that saves/exports hosted state.
- The two side games (sidebar chess, research-panel renju) are **per-viewer** as of PROGRESS #118:
  which face a drawer shows lives in `localStorage` (per game, per account), not in
  `chess_board`/`renju_board`'s `panel_mode`. Their turn pushes are their own notification
  categories (`chess_pushes`/`renju_pushes`), and both they and the game bar's green pulse go quiet
  once the Gaia game is finished. `viewer/src/hosted/turn-kinds.ts` is the one list to extend for a
  future side game. **#118's migration (`minigame_push_prefs`) and its `notify` Edge Function
  redeploy are both live** on `mitawjpdxkheascdiffz` as of 2026-07-27 (verified 2026-07-29:
  `notification_prefs.chess_pushes`/`renju_pushes` exist and the deployed `notify` reads them), so
  saving notification settings works.
- Renju marks BOTH colours' latest stones as of PROGRESS #125 (viewer v5.45.3), and an uncommitted
  first tap no longer hides those markers. **Its migration `20260729120000_renju_previous_move.sql`
  (`renju_board.prev_move`, plus `move_renju`/`reset_renju`) is live too** (applied 2026-07-29,
  ledger version `20260729175859`; verified: the column exists and both functions reference it), so
  the second marker now survives a page reload.
- **Live-vs-repo migration drift, 2026-07-29:** the ledger on `mitawjpdxkheascdiffz` records
  `20260728180129 side_game_pushes_opt_in`, which has no file under `supabase/migrations/`, and
  `minigame_push_prefs` twice (`20260727154543`, `20260729175737`) under versions that don't match
  the repo's `20260727120000_…` filename. Nothing is broken — the live schema is ahead, not behind —
  but don't infer "unapplied" from a filename that isn't in the ledger; check the ledger itself.
- **Chat has read checks as of PROGRESS #136 (viewer v5.50.0):** both the per-game chat and the
  lobby chat show who has read the thread so far — initials under the last message each person has
  read, plus a "Read by …" line on the newest one. Receipts live in `game_chat_reads`/
  `lobby_chat_reads` (migration `20260804202928_chat_read_receipts`, applied via `apply_migration`
  and in the ledger) and are written ONLY through the `mark_game_chat_read`/`mark_lobby_chat_read`
  RPCs, which `greatest()` the position so a receipt can never rewind. Shared client logic lives in
  `viewer/src/hosted/chat-reads.ts` — extend that, not the two panels, for anything receipt-shaped.
- **…and the drift can also run the other way — a repo migration that never reached the database
  (2026-08-04, PROGRESS #133).** In-game chat pushes were silently dead for ~a month because
  `0033_notify_chat_message.sql` existed in the repo but its function and trigger were never created
  live. None of the numbered `00xx_*.sql` files are in the ledger at all (they were applied by hand
  via the SQL editor), so a skipped one leaves no trace. **When a backend feature "doesn't work",
  check the live object before re-reading the code** — `pg_trigger` / `to_regproc` / `list_tables`,
  not the migration filename. Fixed and verified; if you add a trigger-backed feature, apply it with
  `apply_migration` so it lands in the ledger.

## Next Work

See `docs/lost-fleet/PROGRESS.md`'s "Next actions" section — confirm with the user before starting
any of the listed items.

## Switching Safety

- Check `git status --short --branch` before editing.
- Treat the repo as shared with another session unless the worktree is clean.
- Do not overwrite or revert changes made by another active session.
- Update `docs/lost-fleet/PROGRESS.md` when the project state changes.
