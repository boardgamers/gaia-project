-- The Silent Auction (engine AuctionVariant.Silent) joins the Preference Split on the
-- server-enforced sealed-bid path.
--
-- Both variants ask every player for one secret valuation of every faction up for auction, and in
-- both of them nothing may be derived - or readable - until the last submission is in. The
-- Preference Split has been collecting those simultaneously since 20260805120000; the Silent
-- Auction was still doing it one seat at a time, purely because it shipped first. Sequential
-- entry is not a secrecy problem (a committed `silentBid` move is public in `public.moves`, but by
-- the time you can read one you have already submitted your own), it is a *pace* problem: a
-- four-player bid round took four consecutive turns, each waiting on the previous player, for
-- information nobody was allowed to act on anyway.
--
-- So this generalizes the four sealed-bid RPCs from "the Preference Split's table" to "the sealed
-- bid table", keyed by the game's auction variant:
--
--   variant           move command     per-bid rule                   whole-submission rule
--   ----------------  ---------------  -----------------------------  ------------------------
--   preference-split  preferenceBid    0 .. budget                    must total exactly budget
--   silent            silentBid        0 .. MAX_SILENT_BID (40)       no total; bids independent
--
-- Everything else is shared and unchanged: one row per (game, seat), the payload is still an
-- ordered [{"faction": ..., "points": ...}] array in the game's pick order, RLS still shows a
-- player only their own row until `sealed_bids_complete()`, there are still no write policies, and
-- the reveal still appends one ordinary move per seat in one transaction.
--
-- Backward compatibility: a Silent Auction game that ALREADY has committed `silentBid` moves was
-- started under the sequential flow and must finish under it - `submit_sealed_bid` refuses such a
-- game outright (the client makes the same decision locally, see viewer/src/logic/sealed-bid.ts),
-- and `reveal_sealed_bids`'s existing "already appended" guard covers it a second time.

-- ---------------------------------------------------------------------------
-- Which variant, and what its moves are called
-- ---------------------------------------------------------------------------

-- Null for every auction type that does NOT bid simultaneously (standard, choose-bid,
-- bid-while-choosing), which is what every RPC below tests to decide whether the sealed table
-- applies to a game at all.
create or replace function public.sealed_bid_variant(p_options jsonb)
returns text
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select case p_options ->> 'auction'
           when 'preference-split' then 'preference-split'
           when 'silent'           then 'silent'
           else null
         end;
$$;

-- The engine command one sealed submission becomes at reveal time. Mirrored byte for byte in
-- viewer/src/hosted/host.ts's `sealedBidMove`, which has to predict the resulting move log to work
-- out which seat the game lands on.
create or replace function public.sealed_bid_command(p_variant text)
returns text
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select case p_variant when 'silent' then 'silentBid' else 'preferenceBid' end;
$$;

-- The Silent Auction's per-bid ceiling. Mirrors `MAX_SILENT_BID` in
-- engine/src/algorithms/silent-auction.ts; it is a generous ceiling rather than a balance dial,
-- and unlike the Preference Split's budget it is not stored per game.
create or replace function public.silent_auction_max_bid()
returns int
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select 40;
$$;

-- ---------------------------------------------------------------------------
-- submit_sealed_bid: one seat's whole submission, once
-- ---------------------------------------------------------------------------

create or replace function public.submit_sealed_bid(
  p_game_id uuid,
  p_seat int,
  p_bids jsonb
) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_game    public.games%rowtype;
  v_variant text;
  v_budget  int;
  v_max_bid int;
  v_count   int;
  v_total   int;
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

  v_variant := public.sealed_bid_variant(v_game.options);
  if v_variant is null then
    raise exception 'this game does not have a sealed-bid auction';
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
  -- A Silent Auction started before this migration collected its bids as ordinary sequential moves.
  -- Mixing the two would double-record the seats that already bid, so such a game finishes the way
  -- it started.
  if exists (select 1 from public.moves
             where game_id = p_game_id
               and move like '% ' || public.sealed_bid_command(v_variant) || ' %') then
    raise exception 'this auction is already being resolved move by move';
  end if;

  -- One bid per faction up for auction, and there is exactly one faction per player.
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

  select sum((b ->> 'points')::int) into v_total from jsonb_array_elements(p_bids) b;

  if v_variant = 'silent' then
    -- No budget: the bids are independent maximums, each capped on its own.
    v_max_bid := public.silent_auction_max_bid();
    if exists (select 1 from jsonb_array_elements(p_bids) b
               where (b ->> 'points')::int > v_max_bid) then
      raise exception 'no single bid may exceed % points', v_max_bid;
    end if;
  else
    v_budget := public.preference_split_budget(v_game.options, v_game.player_count);
    if v_total is distinct from v_budget then
      raise exception 'your bids must add up to exactly % points, got %', v_budget, v_total;
    end if;
  end if;

  insert into public.auction_sealed_bids (game_id, seat, bids, total, submitted_by)
  values (p_game_id, p_seat, p_bids, v_total, v_uid);

  select count(*) into v_count from public.auction_sealed_bids where game_id = p_game_id;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- sealed_bid_status: progress only, plus what the form needs to render
-- ---------------------------------------------------------------------------

-- `variant` and `max_bid` are new. `budget` is kept unconditionally (null-safe for the Silent
-- Auction, which has none) so a client deployed before this migration keeps working: it reads
-- player_count/budget/submitted_seats and ignores the rest.
create or replace function public.sealed_bid_status(p_game_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_game    public.games%rowtype;
  v_variant text;
begin
  if not public.is_game_member(p_game_id) then
    raise exception 'not a member of this game';
  end if;
  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception 'game not found';
  end if;
  v_variant := public.sealed_bid_variant(v_game.options);

  return jsonb_build_object(
    'player_count', v_game.player_count,
    'variant', v_variant,
    'budget', case when v_variant = 'silent'
                   then null
                   else public.preference_split_budget(v_game.options, v_game.player_count) end,
    'max_bid', case when v_variant = 'silent' then public.silent_auction_max_bid() else null end,
    'submitted_seats', coalesce(
      (select jsonb_agg(seat order by seat) from public.auction_sealed_bids where game_id = p_game_id),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- announce_sealed_bid_auction: same one-shot push announcement, either variant
-- ---------------------------------------------------------------------------

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

  -- Not an error, just "nothing to announce": an auction type that doesn't bid simultaneously, a
  -- game that is over, an auction that has already been announced, or one whose last bid is in.
  if v_game.status <> 'active'
     or public.sealed_bid_variant(v_game.options) is null
     or v_game.sealed_bid_announced_at is not null
     or public.sealed_bids_complete(p_game_id) then
    return false;
  end if;

  update public.games set sealed_bid_announced_at = now() where id = p_game_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- reveal_sealed_bids: the same one-transaction close, with the variant's command
-- ---------------------------------------------------------------------------

create or replace function public.reveal_sealed_bids(
  p_game_id uuid,
  p_seq int,
  p_next_seat int
) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_game    public.games%rowtype;
  v_variant text;
  v_command text;
  v_row     record;
  v_seq     int := p_seq;
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

  v_variant := public.sealed_bid_variant(v_game.options);
  if v_variant is null then
    raise exception 'this game does not have a sealed-bid auction';
  end if;
  v_command := public.sealed_bid_command(v_variant);

  if not public.sealed_bids_complete(p_game_id) then
    raise exception 'not every player has submitted their bids yet';
  end if;

  -- Already appended by whoever got here first (or by an earlier call of this very function) - and,
  -- for a Silent Auction, also the guard against a game that recorded its bids sequentially.
  if exists (select 1 from public.moves
             where game_id = p_game_id and move like '% ' || v_command || ' %') then
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
           'p' || (b.seat + 1) || ' ' || v_command || ' ' ||
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

revoke execute on function public.sealed_bid_variant(jsonb) from public, anon;
revoke execute on function public.sealed_bid_command(text) from public, anon;
revoke execute on function public.silent_auction_max_bid() from public, anon;
revoke execute on function public.submit_sealed_bid(uuid, int, jsonb) from public, anon;
revoke execute on function public.sealed_bid_status(uuid) from public, anon;
revoke execute on function public.announce_sealed_bid_auction(uuid) from public, anon;
revoke execute on function public.reveal_sealed_bids(uuid, int, int) from public, anon;
grant execute on function public.sealed_bid_variant(jsonb) to authenticated;
grant execute on function public.sealed_bid_command(text) to authenticated;
grant execute on function public.silent_auction_max_bid() to authenticated;
grant execute on function public.submit_sealed_bid(uuid, int, jsonb) to authenticated;
grant execute on function public.sealed_bid_status(uuid) to authenticated;
grant execute on function public.announce_sealed_bid_auction(uuid) to authenticated;
grant execute on function public.reveal_sealed_bids(uuid, int, int) to authenticated;
