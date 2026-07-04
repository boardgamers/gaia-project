# Premove — Implementation Plan

> Status: **design finalized, nothing built yet.** Written 2026-07-04 after scoping the "does it
> work while I'm offline" question for auto-leech and premove together, then confirmed with the
> owner (§ Decisions below resolves what used to be open questions). Read `BACKEND.md` first if
> you haven't touched the hosted-mode backend before — this plan builds directly on it. **Next
> session should start at Phasing → Phase 0.**

## The question this plan answers

Auto-leech (shipped this session) only resolves when a relevant browser tab is open — best-effort,
not "works while asleep." Premove's whole point is "set it and forget it," so best-effort isn't
good enough for it. This plan is the other route: genuine server-side execution, scoped to be as
small a new trust boundary as it can be.

## Why this *isn't* "reimplement the engine server-side"

`@gaia-project/engine`'s runtime dependencies (`eventemitter3`, `hexagrid`, `lodash`, `seedrandom`,
`semver-compare`, `shuffle-seed`) are plain JS with no native bindings — nothing Node-specific.
Supabase Edge Functions run on Deno, which already runs npm packages fine (the existing `notify`
function imports `npm:@supabase/supabase-js` this way). The engine already runs outside a browser
today — the whole test suite executes it under Node via `ts-node`/`mocha`. So "run the engine
server-side" is really "run the same package we already have in one more place," not new game
logic.

**The one real wrinkle**: `npm:@gaia-project/engine` on the public registry is upstream's version
(no Lost Fleet). This fork's actual engine only exists as a local workspace package
(`workspace:../engine` in `viewer/package.json`) — never published anywhere an `npm:` specifier
could reach. The edge function needs *this fork's* engine, which means vendoring/bundling it into
the function's own deploy directory rather than a plain npm import. Concretely: a small predeploy
step that copies `engine/src` (or `engine/dist` after `tsc`) into
`supabase/functions/_shared/engine/`, or a Deno import map pointing at a relative path within the
functions root. **Phase 0 below is a spike specifically to nail this down** before building
anything on top of the assumption.

## What's actually new here (the trust boundary, stated plainly)

Today, every move that reaches the database was validated by the *acting player's own browser*
before being submitted — the server has never made a game decision. This plan adds a second path:
a service-role Edge Function that decides and commits a move *no human confirmed at that moment*.
That's a real increase in blast radius for a bug (a broken edge function could misplay a real,
currently-running friends' game unattended), not just "one more RPC." Worth being honest about
that cost against the benefit before building it.

## Architecture

### 1. New engine method (client-side preview only — not part of the offline path)

To show "what could I legally do if it were my turn right now" while queuing a premove, the engine
needs a purpose-built query — not something to hack together by poking `currentPlayer`/
`tempCurrentPlayer` on a clone and hoping `generateAvailableCommands` doesn't depend on invariants
that setup breaks.

```ts
// engine/src/engine.ts
previewAvailableCommandsFor(seat: PlayerEnum): AvailableCommand[] | null
```

Returns `null` (premove not offered at all right now) when:
- `seat === this.playerToMove` (it's already their turn — show the real buttons, not a preview)
- `seat` has already passed this round (`this.passedPlayers.includes(seat)`) — nothing left to
  premove into *this* round
- `this.phase !== Phase.RoundMove` (setup, scoring, endgame, federation-formation sub-choices,
  etc. — "my normal next turn" isn't well-defined there)

Otherwise: clone, force `currentPlayer = seat` and clear `tempCurrentPlayer`, call the same
command-generation path the real current player uses, return the result. This is a self-contained,
engine-level addition — testable with plain engine unit tests, no viewer or backend involved. This
is the one piece I flagged as unverified last time; scoping it out this way avoids needing to
understand every invariant `generateAvailableCommands` relies on — the clone-and-override only ever
touches the two fields whose job is specifically "whose turn is it."

**Execution never uses this method.** Attempting a stored premove is just "wait until
`playerToMove` naturally *is* that seat, then try `engine.move(storedMove)`, catch failure" — the
exact same code path every move already goes through.

### 2. Data model

```sql
create table public.premoves (
  game_id    uuid not null references public.games(id) on delete cascade,
  seat       int  not null,
  seq        int  not null,  -- this seat's own queue order (1 = next to attempt)
  move       text not null,  -- exact move line, e.g. "terrans build m -1x2"
  created_at timestamptz not null default now(),
  primary key (game_id, seat, seq)
);
alter table public.premoves enable row level security;

-- Deliberately NARROWER than moves_select: a queued premove is private strategic intent,
-- not public history. Only the owning seat's own user can see their own queue.
create policy premoves_select on public.premoves
  for select to authenticated
  using (exists (select 1 from public.players
                 where game_id = premoves.game_id and seat = premoves.seat and user_id = auth.uid()));
```

Writes go through two narrow RPCs (mirroring this project's existing pattern — no direct
insert/update/delete policies, same as `moves`):

- `queue_premove(p_game_id uuid, p_move text)` — `security definer`, checks the caller owns a seat
  in the game, computes `seq = max(seq)+1` for that seat, inserts. **Does not re-validate game
  legality** — same trust model as `commit_turn` today (the client is already trusted to submit
  legal content; the RPC only enforces *who* can queue *what seat's* premove). The client only
  offers this button after building it from `previewAvailableCommandsFor`, so by the time this RPC
  is called the move has already been locally validated once.
- `cancel_premove(p_game_id uuid, p_seq int)` — `security definer`, deletes one of the caller's own
  queued entries.

### 2b. Failure notifications: durable table, not a one-shot broadcast

Decision (was an open question, now resolved): a **durable table**, not a Realtime broadcast.
A broadcast only reaches clients connected at the exact instant it fires — the one moment the
premove-setter is least likely to be watching, since if they were watching they wouldn't have
needed the premove there in the first place. A table sits there until read.

```sql
create table public.premove_failures (
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
```

A small `mark_premove_failure_read(p_game_id uuid, p_created_at timestamptz)` RPC (or just an
`update` the client can do directly, if a narrow update policy scoped the same way as the select
policy above is simpler) sets `read_at`, so the client only needs to show unread rows.

Being a real table also means it composes for free with the **existing push infrastructure**: the
`notify` Edge Function already sends a push off a `games` trigger using stored VAPID keys/
subscriptions (`BACKEND.md` §6). A sibling trigger —

```sql
create trigger premove_failures_notify
  after insert on public.premove_failures
  for each row execute function public.notify_game_event(); -- or a tiny dedicated variant
```

— gets you "your premove couldn't be played" as an actual push notification using plumbing that
already exists in production, rather than inventing a second, weaker in-app-only notification path.

### 3. Trigger

Reuse the *exact* existing pattern (`games_notify_update`, `BACKEND.md` §6) — same table, same
"current_seat changed" condition, since that's precisely "it is now someone's turn":

```sql
create trigger games_resolve_automation
  after update on public.games
  for each row
  when (old.current_seat is distinct from new.current_seat)
  execute function public.notify_resolve_automation();
```

`notify_resolve_automation()` is a near-copy of `notify_game_event()` — same `app_config`-driven
URL/key lookup, same `net.http_post`, calling a new `resolve-automation` Edge Function with
`{game_id, seat: new.current_seat}` instead of the notify payload shape.

### 4. The Edge Function (`resolve-automation`)

```
supabase/functions/resolve-automation/index.ts
```

On each invocation:
1. Load the game row + full move log (service role) — same shape as `host.ts`'s `buildEngine`.
2. Replay through the (vendored) engine, confirm `engine.playerToMove === payload.seat` (defends
   against a stale/out-of-order trigger delivery — if it's since moved on, no-op and return).
3. Check, in order: does this seat have a queued premove (`premoves` table, lowest `seq`)? If not,
   stop (auto-leech's *offline* backstop — see Phase 3 below — would also live here eventually, but
   isn't in scope for the premove MVP).
4. Try `engine.move(premove.move)`. If it throws: delete *only that* premove row, insert a
   `premove_failures` row (durable table, not a one-shot broadcast — see §2b) so the player gets a
   clear "your premove couldn't be played: <reason>" whenever they next look, not only if they
   happen to be connected at the exact moment it fails, and stop — deliberately not falling through
   to try `seq+1` automatically in the same pass (a failed premove likely means the situation
   changed in a way that makes the whole rest of the queued sequence suspect too; safer to stop and
   let the player look at fresh state before their later premoves fire).
5. If it succeeds and completes a turn: commit via a new `commit_automated_turn(...)` SQL function
   — identical to `commit_turn` (same atomic `for update` + `seq` check, same `players`/`round`
   cache-column update) but with the `auth.uid()`/seat-ownership check removed (there is no
   authenticated user in this context) and grants restricted to `service_role` only:
   `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;`.
   Delete the consumed premove row.
6. That commit's own `current_seat` update fires the *same* trigger again — the next seat's queued
   premove (or a different seat's, in a multi-seat test game) gets its own fresh invocation
   automatically. **No internal loop needed in the function** — chaining happens the same way the
   client-side `resolveAutoDecisions` recursion does, just via repeated trigger firings instead of a
   local `while`.

### 5. Race safety (client fast-path vs. edge function backstop)

If the premove-setter happens to have the game open when their turn arrives, *both* their own
client (if premove's client-side "fast path" is wired the same way auto-leech's
`resolveAutoDecisions` is) and the edge function could race to commit the same premove.
`commit_turn`'s (and `commit_automated_turn`'s) atomic `p_seq is distinct from v_game.move_count + 1`
check already makes this safe — whichever lands first wins, the loser gets a `seq_conflict` and
does nothing further. **One real fix needed**: `host.ts`'s current error handling treats *any*
`commitTurn` failure as alarming (`onError` → user-facing message). A `seq_conflict` specifically
means "someone else already handled this" and should silently resync instead — this is a real,
small bug this plan surfaces even for the auto-leech feature already shipped, not just premove.

### 6. Client-side additions

- A "Premove" button, shown whenever `previewAvailableCommandsFor(mySeat)` returns non-null,
  reusing the *existing* button-building logic in `logic/buttons/*` against the previewed
  commands (not new button code — just a new engine instance to build them from).
- Picking one calls `queue_premove` (not the normal move-submit path).
- A small persistent panel: "Queued: Build mine at 3x2 [✕]" per entry, reading the `premoves` table
  directly (RLS already scopes it to your own seat), plus any unread (`read_at is null`)
  `premove_failures` rows shown as a dismissible banner (dismiss = call the mark-read RPC).
- Multi-round queueing (2-3 ahead): premove #2's preview is built against a *simulated* clone with
  premove #1 already applied (chain the preview off the same disposable clone), not fresh
  current-state — otherwise "plan a sequence" isn't actually what's being planned. Surface in the
  UI that entries beyond the first are more likely to be skipped (they depend on premove #1 landing
  exactly as planned *and* on moves from other players that haven't happened yet).

## Phasing

1. **Spike (de-risk only, no schema, no user-facing change)**: get the fork's actual engine
   running inside a real deployed Edge Function — construct an `Engine`, replay a handful of test
   moves, confirm parity with the same replay run client-side. This is the one assumption the whole
   plan leans on; confirm it before writing anything else.
2. **MVP**: single premove per seat (no queue depth yet), `premoves` table + the two RPCs, the
   trigger + edge function, the engine's `previewAvailableCommandsFor`, the Premove button + cancel
   UI. Fix the `seq_conflict`-should-be-silent bug from §5 as part of this (needed either way once
   any automated path exists).
3. **Multi-round queue**: `seq`-ordered queue per seat, chained preview building, "more likely to be
   skipped" messaging.
4. **Optional later**: retrofit auto-leech onto the same edge function (add "does this seat have an
   `autoChargePower` preference" as a second check in step 3 above) so it also gets genuine offline
   execution instead of the client-only best-effort version shipped this session. Not required for
   premove to work — a separate decision once premove itself is proven out.

## Decisions (were open questions, now resolved with the owner)

1. **Scope: hosted mode only.** Self-contained hot-seat has no "away from my turn" concept (one
   browser, one person clicking through every seat in sequence) — premove doesn't apply there.
   Hosted-mode "test games" (one person owns every seat) aren't specially designed for either way;
   built seat-agnostically, whatever happens for that case happens, no extra work either direction.
2. **`premove_failures` is a durable table**, not a one-shot broadcast — see §2b above for the
   schema and the push-notification tie-in.
3. **Phase 0 spikes against the live Supabase project**, in two steps, both read-only (no writes,
   no trigger wired yet, nothing autonomous exists until Phase 0 passes):
   - A throwaway scratch 2-player game (the same "test game" pattern `Lobby.vue` already
     recognizes) — deploy the spike function, replay its move log, confirm parity with what the
     client already computes for that same game.
   - A **real, existing game's** move log, read-only (fetch + replay only, compare against the
     client's own replay of the same log) — catches anything a clean scratch game wouldn't exercise
     (Lost Fleet ship actions, artifacts, federations, whatever a live game's history actually has).
   - If either step fails, the vendoring/import approach needs rework before Phase 1 starts — that
     is the entire point of doing this before writing schema/RPCs/UI.

## Phase 0 checklist (start here)

- [ ] Decide the vendoring mechanism (predeploy copy of `engine/src` or `engine/dist` into
      `supabase/functions/_shared/engine/`, vs. a Deno import map) and document which was chosen
      and why in this file once picked.
- [ ] Write `supabase/functions/_spike-engine-replay/index.ts`: given a `game_id`, fetch
      `games`/`moves` (service role), replay via the vendored engine, return
      `{ playerToMove, round, phase, moveHistoryLength }` as JSON. No writes.
- [ ] Deploy it; invoke manually (curl or dashboard test-invoke) against a fresh scratch 2-player
      game created for this purpose.
- [ ] Invoke it against one real existing game's `game_id`; compare its output to what the running
      viewer shows for that same game at the same move count.
- [ ] Record the result in this file (pass/fail, and if fail, what broke) before starting Phase 1.
- [ ] Delete or disable the spike function once Phase 0 is confirmed (it isn't part of the shipped
      feature — Phase 1 introduces the real `resolve-automation` function from scratch, informed by
      whatever Phase 0 learned).
