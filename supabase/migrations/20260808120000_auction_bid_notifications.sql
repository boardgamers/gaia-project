-- Preference Split Auction: notifications for the simultaneous bid phase.
--
-- Every other "it's your move" push in this app rides on `games.current_seat` changing
-- (0001_multiplayer.sql's `games_notify_update` trigger). The Preference Split bid phase is the one
-- moment that signal cannot describe: every seat is on turn at the same time, the submissions are
-- held in `auction_sealed_bids` instead of `public.moves` (20260805120000), and `current_seat`
-- therefore sits unchanged - on whichever single seat the engine nominally names - from the last
-- faction pick right through to `reveal_sealed_bids`. Net effect before this migration: exactly one
-- player was told anything at all (their ordinary turn push, fired by the last faction pick), the
-- other N-1 were told nothing, and the recurring reminder sweep could nudge none of them
-- (planTurnReminder only ever looks at the current seat, and no move is committed while the auction
-- is open, so the whole game could stall on one person with no notification of any kind).
--
-- So the auction gets its own one-shot announcement - stamped on the game row, which is what makes
-- it exactly-once and what the trigger below turns into one push per player - plus its own per-seat
-- reminder bookkeeping for the sweep, since "who still owes a bid" is a set, not a single seat.

alter table public.games
  add column if not exists sealed_bid_announced_at timestamptz;

-- ---------------------------------------------------------------------------
-- The announcement: game row stamp -> pg_net -> `notify` Edge Function
-- ---------------------------------------------------------------------------

-- Same shape (and the same silent no-op when app_config['notify'] is unseeded) as
-- notify_game_event, but with its own body type: the edge function has to look up which seats have
-- NOT submitted yet, which none of the existing types need.
create or replace function public.notify_sealed_bid_auction()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg jsonb;
begin
  select value into v_cfg from public.app_config where key = 'notify';
  if v_cfg is null then
    return null;
  end if;
  perform net.http_post(
    url := v_cfg ->> 'url',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (v_cfg ->> 'key')
    ),
    body := jsonb_build_object('type', 'auction_bid', 'game_id', NEW.id)
  );
  return null;
end;
$$;

drop trigger if exists games_notify_sealed_bid_auction on public.games;

-- Only the null -> not-null transition, so re-stamping (or the reveal clearing the column again,
-- see below) can never re-announce.
create trigger games_notify_sealed_bid_auction
  after update on public.games
  for each row
  when (old.sealed_bid_announced_at is null and new.sealed_bid_announced_at is not null)
  execute function public.notify_sealed_bid_auction();

-- Called by any client that finds itself sitting in the bid phase (viewer/src/hosted/host.ts's
-- `refreshSealedBidState`), exactly like `reveal_sealed_bids` is called by whichever client first
-- notices the auction is complete. Idempotent by construction: the row is locked, the stamp is
-- written once, and every later caller returns false without touching anything - so it does not
-- matter how many clients race to announce, nor whether the client that committed the final faction
-- pick is still around.
create or replace function public.announce_sealed_bid_auction(p_game_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.games%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_game_member(p_game_id) then
    raise exception 'not a member of this game';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;

  -- Not an error, just "nothing to announce": the wrong variant, a game that is over, an auction
  -- that has already been announced, or one whose last bid is already in.
  if v_game.status <> 'active'
     or v_game.options ->> 'auction' is distinct from 'preference-split'
     or v_game.sealed_bid_announced_at is not null
     or public.sealed_bids_complete(p_game_id) then
    return false;
  end if;

  update public.games set sealed_bid_announced_at = now() where id = p_game_id;
  return true;
end;
$$;

revoke execute on function public.announce_sealed_bid_auction(uuid) from public, anon;
grant execute on function public.announce_sealed_bid_auction(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-seat reminder bookkeeping for the hourly sweep
-- ---------------------------------------------------------------------------

-- `games.last_turn_reminder_at` / `turn_reminder_count` can't be reused here: they describe ONE
-- pending player, and an open auction has up to five, each with their own interval and cap. Written
-- and read exclusively by the `notify` Edge Function (service role) - RLS on with no policies and
-- no grants to `authenticated` means no client can see or touch it.
create table if not exists public.auction_bid_reminders (
  game_id          uuid not null references public.games (id) on delete cascade,
  seat             int  not null check (seat >= 0),
  reminder_count   int  not null default 0,
  last_reminder_at timestamptz not null default now(),
  primary key (game_id, seat)
);

alter table public.auction_bid_reminders enable row level security;

grant all on table public.auction_bid_reminders to service_role;

-- ---------------------------------------------------------------------------
-- reveal_sealed_bids: close out the auction's notification state too
-- ---------------------------------------------------------------------------
--
-- Unchanged from 20260805120000 except for the final `update` and the cleanup after it:
--   * `latest_move_committed_at` is stamped, exactly as commit_turn does
--     (0026_cache_latest_move_committed_at.sql). The reveal appends real committed moves, so
--     leaving the column on the last faction pick's timestamp meant the turn that FOLLOWS the
--     auction inherited however long the auction itself took, and could be "12h overdue" to the
--     reminder sweep the very moment it began.
--   * `sealed_bid_announced_at` is cleared, so a closed auction drops straight out of the sweep's
--     candidate query instead of being re-fetched every hour forever. It can't be re-announced:
--     announce_sealed_bid_auction refuses once every seat has a row in auction_sealed_bids.
create or replace function public.reveal_sealed_bids(
  p_game_id uuid,
  p_seq int,
  p_next_seat int
) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_game public.games%rowtype;
  v_row  record;
  v_seq  int := p_seq;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not public.is_game_member(p_game_id) then
    raise exception 'not a member of this game';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if not public.sealed_bids_complete(p_game_id) then
    raise exception 'not every player has submitted their bids yet';
  end if;

  -- Already appended by whoever got here first (or by an earlier call of this very function).
  if exists (select 1 from public.moves
             where game_id = p_game_id and move like '% preferenceBid %') then
    return 0;
  end if;
  if p_seq is distinct from v_game.move_count + 1 then
    raise exception 'seq_conflict: expected %, got %', v_game.move_count + 1, p_seq;
  end if;
  if p_next_seat is null or p_next_seat < 0 or p_next_seat >= v_game.player_count then
    raise exception 'next_seat must be a valid seat';
  end if;

  for v_row in
    select b.seat,
           'p' || (b.seat + 1) || ' preferenceBid ' ||
           (select string_agg((e ->> 'faction') || ' ' || (e ->> 'points'), ' ' order by ord)
              from jsonb_array_elements(b.bids) with ordinality as t(e, ord)) as move
    from public.auction_sealed_bids b
    where b.game_id = p_game_id
    order by b.seat
  loop
    insert into public.moves (game_id, seq, seat, move, committed_by)
    values (p_game_id, v_seq, v_row.seat, v_row.move, v_uid);
    v_seq := v_seq + 1;
  end loop;

  update public.games
  set move_count               = v_seq - 1,
      current_seat             = p_next_seat,
      last_committed_by        = v_uid,
      latest_move_committed_at = now(),
      sealed_bid_announced_at  = null
  where id = p_game_id;

  delete from public.auction_bid_reminders where game_id = p_game_id;

  return v_seq - p_seq;
end;
$$;

revoke execute on function public.reveal_sealed_bids(uuid, int, int) from public, anon;
grant execute on function public.reveal_sealed_bids(uuid, int, int) to authenticated;
