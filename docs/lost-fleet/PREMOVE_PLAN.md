# Premove — Implementation Plan (consolidated, ready for handoff)

> Status: **design finalized + reviewed, nothing built yet.** Originally written 2026-07-04 and
> owner-approved; **revised 2026-07-04 after an Opus design-review pass** that folded in nine
> correctness fixes, the UX flow, and one scope change (see "What changed from the original design"
> below). This document is self-contained: a fresh session (Sonnet is fine) should be able to
> execute it end-to-end without re-deriving anything. Read `BACKEND.md` first if you haven't
> touched the hosted-mode Supabase backend — this plan builds directly on it. **Start at Phase 0.**

---

## 0. What this feature is

"Premove": while it is **not** your turn, queue the move you intend to make. When your turn actually
arrives it plays **automatically, server-side, even if you are offline** — set it and forget it.
Scope is **hosted (multiplayer) mode only**; self-contained hot-seat has no "away from my turn"
concept.

The offline guarantee is the whole point, which is why this needs genuine server-side execution (a
Supabase Edge Function that decides and commits a move no human confirmed at that moment), not the
best-effort "only runs if a browser tab is open" path that auto-leech shipped with.

---

## What changed from the original owner-approved design (read this first)

The original plan was sound. The review changed these things — one is a genuine scope decision you
should be aware of, the rest are correctness fixes that don't change intent:

1. **Offline auto-leech is now in-scope, not "optional later."** *(The one real scope change.)*
   The original treated folding auto-leech into the same edge function as an optional Phase 4. But
   without it, the offline promise doesn't actually hold: a power-leech / charge-power decision
   (Gaia's `Phase.RoundLeech`) interrupts *before* your normal turn, and if you're fully offline the
   game stalls there — your premove never gets reached. So "premove that actually works offline" =
   premove **plus** offline auto-leech resolution. It's now Phase 2 (required for the feature to
   meet its goal), with multi-round queueing demoted to the genuinely-optional Phase 3. This reuses
   the auto-charge preference the user already sets today; it only adds *persisting* that preference
   so the server can honor it. If you'd rather ship premove-only first and accept "offline works
   only when no leech interrupts," that's a valid smaller cut — but say so explicitly, because it
   makes the headline feature conditional.

2. **The execute-time gate must match the offer-time gate (this was an outright bug).** The original
   edge-function logic attempted the queued premove whenever `engine.playerToMove === seat`. But a
   leech decision makes `playerToMove === seat` while the engine is in `Phase.RoundLeech` expecting a
   `charge`/`decline`, **not** a `RoundMove` build — so the premove would throw and be consumed as a
   bogus failure, deleting it before the player's real turn ever arrived. Fix: the edge function only
   attempts a premove when `engine.phase === Phase.RoundMove` (the same condition
   `previewAvailableCommandsFor` uses to *offer* it). See §4 step 3.

3. **A cheap trigger-level gate** so the edge function (and a full engine replay) only runs when
   there's actually work for the seat now on turn, instead of on every turn of every game forever.

4. **`commit_automated_turn` must mirror the *post-0009* `commit_turn`** (8 args incl.
   `current_round` + `player_updates`), and must set `committed_by` to the **seat owner's user_id**
   (there is no `auth.uid()` in the function).

5. **A premove is always a complete turn**, and the edge function has an explicit "applied but
   didn't complete a turn" failure branch.

6. **The edge function's own `seq_conflict` is a silent no-op**, never a premove failure.

7. **Vendoring = bundle the engine to a single ESM file** (esbuild), not copy source — because the
   engine imports bare specifiers (`lodash`, `hexagrid`, `seedrandom`, …) that Deno won't resolve
   from copied source without a hand-maintained import map. The same bundle includes the tiny
   `auto-decide.ts` helper so client and server run identical leech logic.

8. **A retained client-vs-server replay parity test** (not just the one-time Phase 0 spike) to catch
   engine/bundle drift, which is the thing that would silently misplay a real game.

9. **Client fast-path is part of the MVP** (instant local execution when you're watching), with the
   edge function as the offline backstop — so a watched turn doesn't wait for a trigger round-trip.

Plus the UX flow in §7.

---

## The trust boundary (stated plainly, unchanged from original)

Today every move that reaches the database was validated by the acting player's own browser before
submission — the server has never made a game decision. This plan adds a second path: a service-role
edge function that decides and commits a move no human confirmed at that moment. That's a real
increase in blast radius for a bug (a broken function could misplay a real, currently-running game
unattended). Two things keep it bounded:

- **The server never invents game logic** — it replays the exact same engine the client runs and
  only *attempts* a move the client already validated once when it was queued. The move log stays
  the sole source of truth (`BACKEND.md §0`).
- **The engine that runs server-side must be byte-for-byte the same logic as the client's** — which
  is why the bundle is built from *this fork's* `engine/src` (not public npm) and why the parity
  test (finding #8) is retained in CI, not one-shot.

---

## 1. Vendoring the engine into the edge function (resolves Phase 0's core question)

**Decision: bundle, don't copy.** `npm:@gaia-project/engine` on the public registry is upstream
(no Lost Fleet); this fork's engine only exists as the local workspace package. The engine's source
uses **bare** imports (`import _ from "lodash"`, `hexagrid`, `seedrandom`, `semver-compare`,
`shuffle-seed`, `eventemitter3`), so copying `engine/src` into the function would force a
hand-maintained Deno import map mapping every bare specifier to the exact `npm:` version — fragile,
and a silent drift vector.

Instead, a **predeploy build step bundles the engine + its deps into one ESM file** the function
imports directly:

- Tool: **esbuild** (`format=esm`, `platform=neutral` or `browser`, `bundle=true`), entry point a
  tiny `supabase/functions/_shared/engine-entry.ts` that re-exports what the functions need:
  ```ts
  export { default as Engine, Phase } from "../../../engine/src/engine";
  export { autoDecideChargePower, parseAutoChargePreference } from "../../../viewer/src/logic/auto-decide";
  ```
  (`auto-decide.ts` only depends on the engine, so it bundles cleanly and guarantees the server's
  leech logic is identical to the client's.)
- Output: `supabase/functions/_shared/engine.bundle.js` — committed **or** rebuilt in the deploy
  step; either way the rebuild is **wired into the function-deploy command**, never a manual copy
  (finding #4/drift). A `package.json` script like
  `"build:edge-engine": "esbuild supabase/functions/_shared/engine-entry.ts --bundle --format=esm --platform=neutral --outfile=supabase/functions/_shared/engine.bundle.js"`.
- Edge functions import from `_shared/engine.bundle.js`.

**Phase 0 verifies this actually runs under Deno** before anything is built on it. Specifically
confirm the deps that reach for host globals behave: `seedrandom`/`shuffle-seed` (may touch
`crypto`/`self`/`window`), and that no bare Node built-in (`assert`, `crypto`, …) sneaks in without
a `node:` prefix.

---

## 2. Engine method (client-side preview only — never on the offline path)

To show "what could I legally do if it were my turn right now" while queuing, add one engine query.

```ts
// engine/src/engine.ts
previewAvailableCommandsFor(seat: PlayerEnum): AvailableCommand[] | null
```

Returns `null` (premove not offered) when **any** of:
- `seat === this.playerToMove` — it's already their turn; show the real buttons.
- the seat has already passed this round (verify the exact field during impl — `passedPlayers`
  or equivalent) — nothing to premove into *this* round.
- `this.phase !== Phase.RoundMove` — setup, income, gaia, leech, scoring, endgame, auction: "my
  normal next turn" isn't well-defined.

Otherwise: clone (`Engine.fromData(JSON.parse(JSON.stringify(this)))`), set `currentPlayer = seat`,
`tempCurrentPlayer = undefined`, call the normal `generateAvailableCommands()` path, return the
result. Self-contained, unit-testable with plain engine tests, no viewer/backend involved.

**Fidelity caveat (verify in Phase 1):** `generateAvailableCommands` may read `turnOrder`/position,
not only `currentPlayer`. This is *fine for a preview* — worst case a queued move fails cleanly later
and the player is notified — but add a test that the previewed commands for a seat match what that
seat actually gets when its turn genuinely arrives, on a couple of real mid-round board states.

**Execution never uses this method.** Playing a stored premove is just "wait until `playerToMove`
naturally is that seat and `phase === RoundMove`, then `engine.move(storedMove)`, catch failure" —
the same path every move already goes through.

---

## 3. Data model

```sql
-- One queued premove line per (seat, seq). seq = that seat's own queue order (1 = next to attempt).
create table public.premoves (
  game_id           uuid not null references public.games(id) on delete cascade,
  seat              int  not null,
  seq               int  not null,
  move              text not null,          -- exact complete turn line, e.g. "terrans build m -1x2"
  queued_move_count int  not null,          -- games.move_count when queued (staleness display, finding #9)
  created_at        timestamptz not null default now(),
  primary key (game_id, seat, seq)
);
alter table public.premoves enable row level security;

-- Deliberately NARROWER than moves_select: a queued premove is private strategic intent, not public
-- history. Only the owning seat's own user sees their own queue.
create policy premoves_select on public.premoves
  for select to authenticated
  using (exists (select 1 from public.players
                 where game_id = premoves.game_id and seat = premoves.seat and user_id = auth.uid()));

-- Durable failure inbox (NOT a one-shot broadcast — a broadcast only reaches a client connected at
-- the instant it fires, i.e. the one moment the premove-setter is least likely to be watching).
create table public.premove_failures (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  seat       int  not null,
  move       text not null,
  reason     text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
alter table public.premove_failures enable row level security;

create policy premove_failures_select on public.premove_failures
  for select to authenticated
  using (exists (select 1 from public.players
                 where game_id = premove_failures.game_id and seat = premove_failures.seat
                   and user_id = auth.uid()));

-- Phase 2 (offline auto-leech): persist the user's existing auto-charge preference per seat so the
-- server can honor it. 'ask' (default) = never auto-decide, same as today's online behavior.
alter table public.players add column if not exists auto_charge text not null default 'ask';
```

**Do NOT add `premoves`/`premove_failures` to the realtime publication.** DELETE events + RLS on old
rows are awkward, and the client already has a natural refresh point: **refetch the caller's own
`premoves` + unread `premove_failures` whenever a `moves` row arrives** (and on load). That covers
"my premove was consumed" and "it failed" without a second realtime channel.

---

## 4. Write paths (RPCs) and the edge function

### 4a. RPCs (mirror the existing "no direct writes, security-definer only" pattern)

- **`queue_premove(p_game_id uuid, p_seat int, p_move text) returns int`** — `security definer`.
  Assert the caller owns `p_seat` (`players.user_id = auth.uid()`). Compute `seq = coalesce(max(seq),0)+1`
  for that seat. Insert with `queued_move_count = games.move_count`. Returns the new `seq`. Does
  **not** re-validate game legality (same trust model as `commit_turn`; the client only offers the
  button after building it from `previewAvailableCommandsFor`, so it's been validated once already).
  `p_seat` is explicit (not inferred) so a multi-seat owner is never ambiguous.

- **`cancel_premove(p_game_id uuid, p_seat int, p_seq int) returns void`** — `security definer`,
  deletes one of the caller's own queued entries (assert seat ownership).

- **`mark_premove_failure_read(p_id uuid) returns void`** — `security definer`, sets `read_at = now()`
  on one of the caller's own failure rows (assert seat ownership via the row's game/seat).

- **`set_auto_charge(p_game_id uuid, p_seat int, p_pref text) returns void`** *(Phase 2)* —
  `security definer`, sets `players.auto_charge` for a seat the caller owns. The client calls this
  when the user changes their auto-charge preference while in that game (so the server copy tracks
  the local one).

- **`commit_automated_turn(...)`** *(the offline commit path)* — **identical to the post-0009
  `commit_turn`** (same 8 inputs: `p_game_id, p_seq, p_seat, p_move, p_next_seat, p_finished,
  p_current_round, p_player_updates`; same atomic `select … for update` + `seq = move_count+1` check;
  same `games`/`players` cache-column updates) with two differences:
  - **No `auth.uid()`/seat-ownership check** (there is no authenticated user here).
  - **`committed_by` / `last_committed_by` = the seat owner's `user_id`**, looked up from `players`
    (fall back to `games.created_by` if somehow null). This keeps `notify`'s "skip the last
    committer" logic correct — the *next* seat gets the push, the automated seat's owner doesn't.
  - Grants: `revoke execute … from public, anon, authenticated; grant execute … to service_role;`.

  All new RPCs get the same `revoke from public, anon` + `grant to authenticated` treatment as the
  existing ones (except `commit_automated_turn`, which is `service_role` only). Follow the exact
  grant/`drop function` discipline in `0009` (widening args via `create or replace` creates a second
  overload — always `drop function` the old signature first).

### 4b. Trigger (fires the edge function only when there's work)

```sql
create or replace function public.notify_resolve_automation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cfg jsonb;
begin
  -- Cheap gate (finding #3): only invoke when the seat now on turn actually has a premove queued.
  -- Phase 2 widens this to: premove exists OR that seat's players.auto_charge <> 'ask'.
  if new.current_seat is null then return null; end if;
  if not exists (select 1 from public.premoves
                 where game_id = new.id and seat = new.current_seat) then
    return null;
  end if;
  select value into v_cfg from public.app_config where key = 'resolve_automation';
  if v_cfg is null then return null; end if;   -- unseeded = silent no-op, same as notify
  perform net.http_post(
    url := v_cfg ->> 'url',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || (v_cfg ->> 'key')),
    body := jsonb_build_object('game_id', new.id, 'seat', new.current_seat));
  return null;
end; $$;

create trigger games_resolve_automation
  after update on public.games
  for each row when (old.current_seat is distinct from new.current_seat)
  execute function public.notify_resolve_automation();
```

Seed `app_config['resolve_automation']` = `{"url": …, "key": …}` out-of-band (same pattern as the
`notify` config; never committed). Until seeded, the trigger is a harmless no-op.

### 4c. The `resolve-automation` edge function

`supabase/functions/resolve-automation/index.ts`. Service-role client (like `notify`). Payload
`{game_id, seat}`. **Resolves exactly ONE committed turn per invocation, then returns** — the
commit's own `current_seat` change re-fires the trigger for the next seat/decision. No internal
loop (mirrors the client's recursion via repeated trigger firings).

Per invocation:

1. Load `games` row + full `moves` log (service role). Build the engine exactly as `host.ts`
   `buildEngine` does: `new Engine(["init <player_count> <seed>", ...moves], engineOptions(game))`
   then `generateAvailableCommandsIfNeeded()`. (Reuse `engineOptions`'s `map`-stripping — see
   `host.ts` / `BACKEND.md §13.4`.)
2. **Stale-trigger guard:** if `engine.playerToMove !== seat`, no-op return (the game moved on).
3. **Branch on phase (the symmetric gate, finding #2):**
   - **`engine.phase === Phase.RoundLeech`** (a pending charge/leech decision for `seat`)
     *(Phase 2)*: read `players.auto_charge` for `seat`. If `'ask'` → **no-op return** (wait for the
     human; leaves any queued premove untouched behind the leech). Else resolve **one** auto-charge
     turn: on a clone, set `engine.player(seat).settings.autoChargePower = parseAutoChargePreference(pref)`
     and call `engine.autoMove()` **once**; if it produced a completed turn, `commit_automated_turn`
     it and return. *(Resolve one turn only — do NOT commit a multi-turn ". "-joined string as one
     `moves` row; that breaks the one-row-per-turn / `seq` invariant. Let the trigger re-fire for any
     further leech. Verify `autoMove()`'s single-call behavior against the engine during impl.)*
   - **`engine.phase === Phase.RoundMove`:** find this seat's lowest-`seq` `premoves` row. None →
     no-op return. Otherwise, on a clone, `engine.move(premove.move)`:
     - **throws** → delete *only that* premove row, insert a `premove_failures` row
       (`reason` = the error message), return. **Do not** fall through to `seq+1` — a failed premove
       usually means the situation changed enough to make the rest of the queue suspect; stop and let
       the player look at fresh state.
     - **applies but `!copy.newTurn`** (incomplete turn — shouldn't happen if queuing enforced
       completeness, defensive) → delete the premove, insert a `premove_failures` row
       (`reason: "premove did not complete a turn"`), return.
     - **applies and `copy.newTurn`** → `commit_automated_turn(seat, move, next_seat = finished ? null
       : copy.playerToMove, finished = copy.phase === Phase.EndGame, current_round = copy.round,
       player_updates = playerUpdates(copy))`, then delete the consumed premove row, return.
   - **any other phase** (setup, income, gaia, scoring, endgame) → no-op return.
4. **`seq_conflict` from the commit is a silent no-op** (finding #6): if `commit_automated_turn`
   raises `seq_conflict`, another path (the player's own fast-path, or a duplicate trigger delivery)
   already committed — just return, do **not** write a `premove_failures` row and do **not** delete
   the premove (the winning path already consumed it).

Because each successful commit changes `current_seat`, the trigger re-fires and the next
seat's/decision's premove or leech gets its own fresh invocation automatically.

---

## 5. Client fast-path + the `seq_conflict` bug fix (both part of the MVP)

- **Fast-path (finding #9):** when the premove-setter has the game open and their turn arrives, run
  the queued premove locally *immediately* through the existing `applyAndCommit` path (wired the
  same way auto-leech's `resolveAutoDecisions` is in `host.ts`) instead of waiting for the
  trigger→edge→commit→realtime round-trip. The edge function stays the offline backstop.
- **Race safety** is already handled by `commit_turn`/`commit_automated_turn`'s atomic
  `p_seq is distinct from v_game.move_count + 1` check: whichever of {fast-path, edge function}
  lands first wins; the loser gets `seq_conflict` and does nothing.
- **The `seq_conflict`-should-be-silent bug (real, pre-existing, affects auto-leech too):**
  `host.ts`'s `applyAndCommit` currently treats *any* `commitTurn` failure as alarming
  (`onError` → user-facing message, then resync). A `seq_conflict` specifically means "someone else
  already handled this" and should **silently resync** (no error toast). Fix this in `host.ts` as
  part of the MVP — it's needed the moment any second automated committer exists. (Detect by the
  `seq_conflict:` prefix the RPC raises.)

---

## 6. RLS / realtime summary

- `premoves`, `premove_failures`: SELECT scoped to the owning seat's own user (§3). No direct
  writes — all writes via the RPCs. **Not** in the realtime publication; the client refetches them on
  load and on every incoming `moves` row.
- `commit_automated_turn` is `service_role`-only; everything else `authenticated`-only, `anon`/`public`
  revoked (match `0001`/`0009`).

---

## 7. Client UI / UX flow

The hard part isn't the buttons — it's the new mental model ("the game moves for me while I'm
away"). Everything below serves making that legible and trustworthy. Assume **mobile / PWA** is the
primary surface (push is the primary channel; screens are small).

1. **Premove is an explicit opt-in, not always-on.** During an opponent's turn the board is today's
   read-only spectator view. Add a single **"Plan my move ▸"** affordance (shown only when
   `previewAvailableCommandsFor(mySeat)` is non-null). Toggling it in puts the board into a visually
   distinct **premove mode**: a persistent banner ("PREMOVE — plays automatically on your turn") and
   action buttons styled as *queue* affordances (e.g. dashed outline), never looking like "play now."
   This is the #1 footgun to avoid — the user must never confuse queuing with moving.

2. **A premove is a complete turn.** Reuse the existing partial-move accumulation (Game.vue's ". "
   command joining) but against the **preview clone**, and only enable **"Queue this move"** once the
   previewed turn reaches `newTurn` on the clone (ties to finding #5 — a half-turn premove can never
   validly execute). Show the assembled turn in plain language before queuing:
   *"Build mine at 3x2, then charge 2 power."* Queuing calls `queue_premove` (not the normal
   move-submit path).

3. **Queue panel.** Compact, collapsible. Per entry: *"Queued: Build mine at 3x2 [✕]"* (✕ =
   `cancel_premove`). For multi-round (Phase 3), number by rank and mark entries beyond the first
   *"may be skipped — depends on your earlier move landing."* Optionally surface staleness from
   `queued_move_count` vs current `move_count` ("queued 18 moves ago").

4. **Failure banner.** Unread `premove_failures` rows shown as a dismissible banner on next open
   (dismiss = `mark_premove_failure_read`), plus the push (see below). Actionable copy:
   *"Your premove couldn't be played in <game> — open to take your turn."*

5. **Success feedback / trust.** On a successful offline play the board just silently advanced.
   Early on users won't trust the automation, so tag auto-played moves in the game log
   (*"Played automatically from your queue"*). Cheap, and it's what makes people rely on it.

6. **First-run explainer (the single most important UX element).** One-time:
   *"Premoves play automatically when your turn comes, even if you're offline. If the board changed
   and your move is no longer legal, it's skipped and we'll notify you."* If Phase 2 ships, add:
   *"Leech/charge decisions before your turn are auto-resolved using your auto-charge setting."*

7. **Suppress where it makes no sense.** When the user owns **all** seats (no-lock hot-seat / test
   games, `mySeats.length >= playerCount`), hide the premove UI entirely — there's no offline
   scenario, and `previewAvailableCommandsFor` would otherwise offer premoves for your *other* seats.

8. **Cancel-vs-executed feedback.** Rare but real: you open intending to cancel, but your turn
   arrived and the edge function already played it. Realtime resync fixes the state; make `cancel`
   give clear feedback when the entry is already gone/played ("that move already played") rather than
   silently doing nothing.

### Notification tie-in

`premove_failures` composes with the existing push infra. Add a sibling trigger that calls the same
notify path (or a tiny variant) on `insert into premove_failures`, so "your premove couldn't be
played" is a real push, not in-app-only. Reuse the `notify` function / `app_config` VAPID plumbing
(`BACKEND.md §6`).

**Known cosmetic interaction (accept or decide):** `notify` and `resolve-automation` both fire on the
same `current_seat` change, so a premove that plays instantly can produce a spurious "your turn" push
a beat before it auto-plays. The §3 trigger gate reduces the surface; if it annoys, have `notify`
skip a seat that has a queued premove. Owner already accepted a similar leech-chain wart in
`BACKEND.md §6`, so this is a decision, not a blocker.

---

## 8. Phasing

- **Phase 0 — Spike (de-risk only, no schema, no user-facing change).** ✅ **DONE 2026-07-05** — see
  "Phase 0 result" below. Prove the fork's engine runs in a real deployed edge function via the
  bundle. Read-only. See the checklist below. **Gate: pass Phase 0 and check in with the owner
  before Phase 1.**

- **Phase 1 — Premove MVP.** ✅ **DONE (code/schema/tests) 2026-07-05, `resolve-automation` NOT YET
  DEPLOYED** — see PROGRESS.md #66. Single premove per seat (no queue depth). `premoves` +
  `premove_failures` tables, `queue_premove`/`cancel_premove`/`mark_premove_failure_read`/
  `commit_automated_turn` RPCs, the gated trigger, the `resolve-automation` function (with the
  `RoundMove`-only gate and `seq_conflict` no-op — but **without** the leech branch yet),
  `previewAvailableCommandsFor`, the Premove button + queue/cancel UI + failure banner, the client
  fast-path, and the `host.ts` `seq_conflict`-silent fix. **Limitation to document loudly:** offline
  progress works *as long as no leech decision intervenes* before your turn; if one does, the premove
  stays safely queued (not consumed) but the game waits at the leech until you're online. Phase 2
  closes that gap.

- **Phase 2 — Offline auto-leech (required for the full offline promise).** ✅ **DONE (code/schema/
  tests) 2026-07-05, same caveat as Phase 1 — `resolve-automation` not yet deployed** — see
  PROGRESS.md #67. Added `players.auto_charge` + `set_auto_charge`, persisted the client's existing
  auto-charge preference to it, widened the trigger gate to `premove exists OR auto_charge <>
  'ask'`, added the `RoundLeech` branch to `resolve-automation` (a single `engine.autoMove()` call
  per invocation, never looped server-side), bundled `auto-decide.ts`'s `parseAutoChargePreference`
  into the engine bundle (already wired in `engine-entry.ts` since Phase 0). Once `resolve-automation`
  is actually deployed, a fully-offline player with auto-charge enabled will progress past leech
  interrupts into their queued premove.

- **Phase 3 — Multi-round queue (genuinely optional).** Not started. `seq`-ordered depth per seat;
  premove #2's preview is built against a disposable clone with premove #1 already applied (chain
  the preview off the same clone), not fresh current-state; "more likely to be skipped" UI
  messaging.

**Deploying `resolve-automation` is now the single remaining blocker** for the whole feature's
offline promise (Phases 1 and 2 are both otherwise complete) — see PROGRESS.md #66's note on why
this session couldn't do it (no Supabase CLI access token) and what's needed (`supabase functions
deploy resolve-automation --project-ref mitawjpdxkheascdiffz`, then seed
`app_config['resolve_automation']` per BACKEND.md §11's pattern).

### Open decisions to confirm with the owner (don't block Phase 0)

- **Stale-queue on pass / round boundary (finding #9):** if you queue a move then *manually pass*
  before your turn, should the queue auto-clear? Cleanly-illegal stale premoves fail safely; the risk
  is a still-*legal*-but-unwanted move. Recommendation: clear a seat's premoves when it passes, and
  keep `queued_move_count` for a staleness warning regardless. Confirm.
- **Spurious "your turn" push** (§7 notification tie-in): accept, or have `notify` skip
  premove-queued seats? Recommendation: accept for MVP, revisit if annoying.
- **Ship Phase 1 alone, or Phase 1+2 together?** The feature's headline ("works offline") is only
  fully true after Phase 2. Recommendation: ship them together, or ship Phase 1 with the limitation
  stated in-product.

---

## 9. Testing strategy

- **Engine unit tests** for `previewAvailableCommandsFor` (the three null cases; a real RoundMove
  case; the fidelity check in §2).
- **Host unit tests** for the `seq_conflict`-silent fix and the client fast-path (extend
  `host.spec.ts` style — mocked backend, asserts silent resync on `seq_conflict`, commits premove on
  own turn).
- **Edge-function tests** for `resolve-automation`: RoundMove premove success/commit; premove throws
  → failure row + premove deleted, no cascade; incomplete-turn → failure row; wrong-phase (RoundLeech)
  → no-op, premove untouched; stale trigger (`playerToMove !== seat`) → no-op; `seq_conflict` → silent
  no-op. Phase 2: RoundLeech + `auto_charge` → one auto-charge turn committed; `auto_charge = 'ask'`
  → no-op.
- **Retained parity test (finding #8):** replay a recorded game's move log through the **bundled**
  engine and through the client engine; assert identical `playerToMove / round / phase /
  moveHistory.length` at every step. This is the drift guard — keep it in CI, don't delete it after
  Phase 0.
- **E2E:** extend `viewer/e2e/hosted-multiplayer.e2e.js` (two real browsers vs. the live project) to
  queue a premove in one browser, advance the game from the other until the premover's turn, and
  assert the premove auto-plays and fans out.

---

## Phase 0 checklist (START HERE — read-only, no writes, no trigger, nothing autonomous)

> The live Supabase project is **`gaia-lost-fleet`** — find its ref via `list_projects` (do not
> assume). This is a **live project with real running games**; both steps below are strictly
> read-only (fetch + replay + compare). If you are ever unsure whether an action mutates anything,
> **stop and ask.**

- [ ] Confirm the live schema state first (`BACKEND.md §14` notes migrations `0006/0007` may not be
      applied live) — read-only via MCP, so Phase 1 migrations stack on the right base.
- [ ] Set up the bundle: `engine-entry.ts` (§1), the esbuild `build:edge-engine` script, produce
      `supabase/functions/_shared/engine.bundle.js`. Confirm it imports under Deno
      (`deno check`) — watch `seedrandom`/`shuffle-seed`/host globals and bare Node built-ins (§1).
- [ ] Write `supabase/functions/_spike-engine-replay/index.ts`: given `{game_id}`, fetch
      `games`/`moves` (service role), replay via the bundled engine, return
      `{ playerToMove, round, phase, moveHistoryLength }` as JSON. **No writes.**
- [ ] Deploy it; invoke it (curl / dashboard test-invoke) against a **fresh scratch 2-player test
      game** created for this purpose; confirm parity with what the running viewer computes for that
      same game at the same move count.
- [ ] Invoke it against **one real existing game's** `game_id`; compare its output to what the viewer
      shows for that game at the same move count (catches Lost Fleet ship actions, artifacts,
      federations, auction — whatever a live history exercises that a clean game wouldn't).
- [ ] Record the result here (pass/fail; if fail, what broke and how the bundling approach needs to
      change) **before** starting Phase 1.
- [ ] Delete/disable the spike function once confirmed (Phase 1 introduces the real
      `resolve-automation` from scratch, informed by what Phase 0 learned).
- [ ] Turn the scratch-game replay into the **retained parity test** (§9, finding #8) rather than
      throwing that harness away.

### Phase 0 result (filled in 2026-07-05)

- **Date:** 2026-07-05
- **Pass / fail: PASS.** The fork's actual engine (with Lost Fleet) bundles to a single ESM file via
  esbuild and produces byte-identical replay results (`playerToMove`/`round`/`phase`/
  `moveHistory.length`) to the plain TypeScript engine, for both a fresh scratch game and a real
  live game exercising Lost Fleet ship actions, artifacts, and spaceship actions.

- **Live schema state (checklist item 1):** confirmed via `list_migrations` + a direct `pg_proc`
  query. The *functions* for migrations `0006_delete_game.sql` and `0007_registered_user_invites.sql`
  **do exist live** (`delete_game`, `list_registered_users`, and `create_game` with the `user_id`-based
  invite signature all present) — but `supabase_migrations.schema_migrations` jumps straight from
  `drop_stale_create_game_overload` (0005) to `0008_admin_only_create_game`, skipping 0006/0007
  entirely. Someone applied 0006/0007's SQL directly (dashboard SQL editor or similar), bypassing
  migration tracking. **Net effect: the live schema is functionally at 0009** (confirmed: `games` has
  `current_round`, `players` has `faction`/`score`, `commit_turn` has the full 8-arg signature) — so
  Phase 1's new migration can safely build on top of everything through 0009. The only wrinkle: if
  anyone ever runs the local `0006_delete_game.sql`/`0007_registered_user_invites.sql` files through a
  strict sequential-migration tool, they'll "re-apply" — harmless since both are pure
  `create or replace function` + idempotent grants, but worth knowing so it doesn't look like a
  live/local drift bug.

- **Bundling approach that worked:** `esbuild --bundle --format=esm --platform=neutral`, entry point
  `supabase/functions/_shared/engine-entry.ts` (re-exports `Engine` from `engine/src/engine` and
  `Phase` from `engine/src/enums` — **not** from `engine/src/engine`, which imports `Phase` but never
  re-exports it; the original plan snippet had this wrong). Two extra flags beyond the plan's original
  spec, both required:
  - `--alias:assert=node:assert --external:node:assert` — the engine uses bare `import assert from
    "assert"` throughout (17+ files); Deno has no bare `"assert"` module, but does resolve `"node:
    assert"` natively.
  - `--banner:js="globalThis.seedrandom=globalThis.seedrandom;"` — see the surprise below. Everything
    else (lodash, hexagrid, seedrandom, shuffle-seed, semver-compare, eventemitter3) bundles cleanly
    with **no** import-map or externalization needed; tried externalizing all six to Deno's native
    `npm:` specifiers to shrink the bundle, but both `lodash` and `eventemitter3`'s CJS exports aren't
    statically analyzable for named imports (`import { set } from "npm:lodash@..."` fails under Deno
    with "does not provide an export named 'set'"), so full self-contained bundling (the plan's
    original recommendation) is correct, not just simpler.
  - `npm run build:edge-engine` (added to root `package.json`) wraps this so it's a repeatable command,
    not a hand-run one-off.

- **The single most surprising thing about running the engine in Deno:** `shuffle-seed@1.1.6`'s own
  source (`shuffleSeed.shuffle`, used by `engine/src/setup.ts`/`map.ts`/`factions.ts`) relies on a
  genuine **Node sloppy-mode quirk**, not just a missing global. Its `index.js` does
  `require('seedrandom')` (which, as a side effect, sets `Math.seedrandom` unconditionally), then its
  own `shuffle-seed.js` does `if (Math.seedrandom) seedrandom = Math.seedrandom;` — an assignment to
  an **undeclared** bare identifier. In non-strict Node CommonJS this silently creates an implicit
  global (`globalThis.seedrandom`) that the rest of the file then reads. **ES modules are always
  strict mode**, and strict mode turns that same assignment into a hard `ReferenceError: seedrandom is
  not defined` — so the bundle threw immediately on the very first shuffle, deep inside setup/map
  generation, with a confusing stack trace pointing at `shuffle-seed`'s own vendored code. Fix: predeclare
  a global binding with a `--banner:js` prelude (`globalThis.seedrandom=globalThis.seedrandom;`) so the
  later assignment lands on an *existing* global instead of an undeclared one (assigning to an
  existing global property is legal in strict mode; only creating a new implicit one isn't). Confirmed
  fixed by running the exact fixture from `viewer/src/logic/auto-decide.spec.ts` through the bundle
  under `deno run` — shuffle/setup and a real leech auto-decide (`autoDecideChargePower`) both work.
  Nothing else was surprising: `assert`/`node:assert` aliasing was the only other Deno-specific
  adjustment needed, and there were no `crypto`/`self`/`window` issues from `seedrandom` itself (it
  degrades gracefully without them; only `shuffle-seed`'s own global-patching trick needed the fix
  above).

- **What was actually verified, and how (see "a practical constraint" below for why it's split this
  way):**
  1. **Full real engine, locally under `deno run`:** the committed `supabase/functions/_shared/
     engine.bundle.js` (built from this fork's real `engine/src`, not npm) correctly replays a base-game
     2p setup fixture and a Lost Fleet setup fixture, reaching the expected phase/player/round every
     time, including a real leech auto-decide via the also-bundled `autoDecideChargePower`.
  2. **Full real engine, parity against real Supabase data:** fetched (read-only, via
     `mcp__Supabase__execute_sql`) the move logs for (a) a fresh scratch 2-player test game created for
     this purpose (`00000000-0000-0000-0000-000000000001`, deleted again after use) and (b) one real,
     currently-active 4-player Lost Fleet game (39-40 moves in, exercising ship builds, spaceship
     actions, artifact examination, deep-space tiles). Replayed both move logs through the bundle
     (`deno run`) **and** through the real TypeScript engine (`ts-node`), and the two outputs
     (`playerToMove`/`round`/`phase`/`moveHistory.length`) were byte-identical in both cases.
  3. **Bundling mechanism, live on the actual deployed Supabase Edge Runtime:** deployed a small
     "canary" function (`spike-deno-canary`, since deleted/disabled — see below) built with the
     identical esbuild flags/banner, bundling the same real npm deps the engine depends on for
     randomness/shuffling (`seedrandom`, `shuffle-seed`, plus `eventemitter3`/`semver-compare`).
     Invoked it live via `curl` against the real project (`https://mitawjpdxkheascdiffz.supabase.co/
     functions/v1/spike-deno-canary`) and got HTTP 200 with output identical to the local `deno run`
     result — confirming the exact bundling/banner-shim approach works on Supabase's actual Edge
     Runtime, not only the local Deno CLI.
  4. **A practical constraint that shaped the above:** the full self-contained bundle is 566KB
     unminified / ~230KB minified. Getting that much text into (and back out of) a single tool-call
     argument for `deploy_edge_function` is impractical in an assistant session (the minified form
     collapses to a handful of 100–170KB *single lines*, which can't even be paginated in; a
     line-wrapped/prettified form is readable but pushes total size past what's sensible to relay
     twice through one session). Rather than force it, step 3 substitutes a much smaller
     same-dependency canary to prove the live-Supabase-Deno-Runtime leg specifically, while steps 1-2
     use the real, full, committed bundle for the actual replay-correctness proof (just executed via
     local `deno run` instead of an HTTP round trip). **This is a real operational finding for Phase
     1:** don't plan on deploying `resolve-automation` (which needs this same full bundle) by having an
     assistant paste its content into a tool call each time engine/src changes — that doesn't scale
     past this one spike. Phase 1 should deploy via the Supabase CLI (`supabase functions deploy`) from
     a normal shell/CI context (e.g. a GitHub Action with a stored `SUPABASE_ACCESS_TOKEN`), which
     reads the built file straight off disk with no such size ceiling.
  5. **Retained parity test (finding #8, checklist's last item):** turned into
     `engine/edge-bundle-parity.spec.ts` (runs as part of the normal `npm test` / mocha suite, no Deno
     dependency needed since the bundle is plain ESM that Node can also `import()`) — replays the same
     base-game and Lost Fleet fixtures through both the real engine and the dynamically-imported bundle
     and asserts identical results; skips itself (doesn't fail) if the bundle hasn't been built yet.
     Full suite: **585/585 passing** (583 previous + this file's 2 new tests) after adding it.

- **Anything that needs to change before Phase 1:**
  1. Phase 1's actual `resolve-automation` deploy should go through the Supabase CLI /
     CI, not manual MCP tool calls with inline content (see the practical constraint above).
  2. Nothing about the schema needs to change — Phase 1's migration can assume 0001-0009 are all live
     (see the schema-state finding above), but should apply cleanly via `mcp__Supabase__apply_migration`
     (this session's tool) to keep migration tracking consistent going forward, rather than raw
     `execute_sql`.
  3. Nothing about the vendoring/bundling approach needs to change — `engine-entry.ts` + `npm run
     build:edge-engine` + the seedrandom banner are ready to reuse as-is for the real
     `resolve-automation` function (which will also need `auto-decide.ts`'s exports for Phase 2, already
     included in `engine-entry.ts`).
