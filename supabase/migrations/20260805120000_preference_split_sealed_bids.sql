-- Preference Split Auction (engine AuctionVariant.PreferenceSplit) — server-enforced sealed bidding.
--
-- Why this table exists at all: the engine is client-side and authoritative, and every committed
-- move lands in public.moves, which every seated player of the game can read (moves_select). That
-- is fine for ordinary turns, and it is fine for the older Silent Auction, whose bids are entered
-- strictly one seat at a time. It is NOT fine here: every player submits at the same time, and the
-- central rule of this auction is that no submission may be readable by anybody else — including
-- through an API response, a realtime payload or the move log — until the last one has landed.
--
-- So the bids never touch public.moves while the auction is open. They are collected here first,
-- behind a select policy that shows a player only their own row until every seat has submitted,
-- and are appended to the move log as ordinary `preferenceBid` moves — all of them, in one
-- transaction — by reveal_sealed_bids() once the last one is in. From the engine's point of view
-- nothing is special: it replays one normal move per seat, in seat order.
--
-- Writes go only through the security-definer RPCs below (no insert/update/delete policies), which
-- is also what makes a submission final: there is no code path that can change or delete a row.

create table public.auction_sealed_bids (
  game_id      uuid not null references public.games (id) on delete cascade,
  seat         int  not null check (seat >= 0),
  -- [{"faction": "itars", "points": 20}, ...], in the game's faction (pick) order. Ordered, so the
  -- move text built at reveal time is byte-identical no matter who triggers the reveal.
  bids         jsonb not null,
  total        int  not null check (total >= 0),
  submitted_at timestamptz not null default now(),
  submitted_by uuid not null references auth.users (id),
  primary key (game_id, seat)
);

-- ---------------------------------------------------------------------------
-- Security-definer helpers (used inside the RLS policy, so they must not
-- re-enter RLS on players/auction_sealed_bids and recurse)
-- ---------------------------------------------------------------------------

create or replace function public.owns_game_seat(p_game_id uuid, p_seat int)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.players p
    where p.game_id = p_game_id and p.seat = p_seat and p.user_id = auth.uid()
  );
$$;

-- True once every seat of the game has a sealed bid on file — the moment the bids stop being
-- secret. Security definer for the same reason is_game_member() is: it is consulted by the policy
-- on the very table it reads.
create or replace function public.sealed_bids_complete(p_game_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select count(*) from public.auction_sealed_bids b where b.game_id = p_game_id)
      >= (select g.player_count from public.games g where g.id = p_game_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security: your own row always, everyone's rows only after the reveal
-- ---------------------------------------------------------------------------

alter table public.auction_sealed_bids enable row level security;

create policy auction_sealed_bids_select on public.auction_sealed_bids
  for select to authenticated
  using (
    public.is_game_member(game_id)
    and (
      public.owns_game_seat(game_id, seat)
      or public.sealed_bids_complete(game_id)
    )
  );

-- Explicit, matching the newer tables in this project (chess/renju/chat reads): select only, so
-- even a client that bypassed the RPCs could not write a bid, and the policy above is what decides
-- which rows that select can actually see.
grant select on table public.auction_sealed_bids to authenticated;
grant all on table public.auction_sealed_bids to service_role;

-- ---------------------------------------------------------------------------
-- RPCs (the only write paths)
-- ---------------------------------------------------------------------------

-- The game's configured per-player bid budget. Mirrors the engine's
-- `EngineOptions.auctionBudget ?? defaultPreferenceSplitBudget(players)`, INCLUDING the scaled
-- default (10 points per player), so the server can enforce the "exactly X, no more, no less" rule
-- without trusting the client that submitted the split. create_game always stores an explicit
-- budget for this variant, so the fallback should never actually be needed - but if the two sides
-- ever disagreed about it, every submission in the game would be rejected.
create or replace function public.preference_split_budget(p_options jsonb, p_player_count int)
returns int
language sql immutable
as $$
  select coalesce(nullif(p_options ->> 'auctionBudget', '')::int, 10 * p_player_count);
$$;

-- One player's whole split, submitted once. Returns how many seats have submitted so far.
create or replace function public.submit_sealed_bid(
  p_game_id uuid,
  p_seat int,
  p_bids jsonb
) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_game   public.games%rowtype;
  v_budget int;
  v_count  int;
  v_total  int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if v_game.options ->> 'auction' is distinct from 'preference-split' then
    raise exception 'this game is not a Preference Split Auction';
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;
  if exists (select 1 from public.auction_sealed_bids
             where game_id = p_game_id and seat = p_seat) then
    raise exception 'seat % has already submitted its bids', p_seat;
  end if;
  if public.sealed_bids_complete(p_game_id) then
    raise exception 'the auction is already closed';
  end if;

  if jsonb_typeof(p_bids) is distinct from 'array'
     or jsonb_array_length(p_bids) <> v_game.player_count then
    raise exception 'exactly % faction bids are required', v_game.player_count;
  end if;
  if (select count(distinct b ->> 'faction') from jsonb_array_elements(p_bids) b)
     <> v_game.player_count then
    raise exception 'each faction has to be bid on exactly once';
  end if;
  if exists (select 1 from jsonb_array_elements(p_bids) b
             where coalesce(b ->> 'faction', '') = ''
                or jsonb_typeof(b -> 'points') is distinct from 'number'
                or (b ->> 'points') !~ '^\d+$') then
    raise exception 'every bid must be a whole, non-negative number of points on a named faction';
  end if;

  v_budget := public.preference_split_budget(v_game.options, v_game.player_count);
  select sum((b ->> 'points')::int) into v_total from jsonb_array_elements(p_bids) b;
  if v_total is distinct from v_budget then
    raise exception 'your bids must add up to exactly % points, got %', v_budget, v_total;
  end if;

  insert into public.auction_sealed_bids (game_id, seat, bids, total, submitted_by)
  values (p_game_id, p_seat, p_bids, v_total, v_uid);

  select count(*) into v_count from public.auction_sealed_bids where game_id = p_game_id;
  return v_count;
end;
$$;

-- Progress only: how many seats (and which) have submitted. Never any points — this is what the
-- waiting screen polls, so it must stay safe to call from any seat at any time.
create or replace function public.sealed_bid_status(p_game_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.games%rowtype;
begin
  if not public.is_game_member(p_game_id) then
    raise exception 'not a member of this game';
  end if;
  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception 'game not found';
  end if;

  return jsonb_build_object(
    'player_count', v_game.player_count,
    'budget', public.preference_split_budget(v_game.options, v_game.player_count),
    'submitted_seats', coalesce(
      (select jsonb_agg(seat order by seat) from public.auction_sealed_bids where game_id = p_game_id),
      '[]'::jsonb
    )
  );
end;
$$;

-- Closes the auction: turns the sealed rows into ordinary committed moves, all in one transaction.
-- Any member may call it (whoever notices the last submission first, which is usually but not
-- necessarily the player who made it). It is exactly-once by construction: the caller has to name
-- the sequence number it expects to write at, `games` is locked for the duration, and a caller that
-- lost the race gets `seq_conflict`, which the client already knows means "someone else landed it,
-- resync". Returns the number of moves appended, or 0 when the reveal had already happened.
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
  set move_count        = v_seq - 1,
      current_seat      = p_next_seat,
      last_committed_by = v_uid
  where id = p_game_id;

  return v_seq - p_seq;
end;
$$;

revoke execute on function public.submit_sealed_bid(uuid, int, jsonb) from public, anon;
revoke execute on function public.sealed_bid_status(uuid) from public, anon;
revoke execute on function public.reveal_sealed_bids(uuid, int, int) from public, anon;
revoke execute on function public.sealed_bids_complete(uuid) from public, anon;
revoke execute on function public.owns_game_seat(uuid, int) from public, anon;
grant execute on function public.submit_sealed_bid(uuid, int, jsonb) to authenticated;
grant execute on function public.sealed_bid_status(uuid) to authenticated;
grant execute on function public.reveal_sealed_bids(uuid, int, int) to authenticated;
grant execute on function public.sealed_bids_complete(uuid) to authenticated;
grant execute on function public.owns_game_seat(uuid, int) to authenticated;
