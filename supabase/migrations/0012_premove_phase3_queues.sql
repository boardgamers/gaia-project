-- Premove Phase 3 (docs/lost-fleet/PREMOVE_PLAN.md §10.1-10.8): multi-slot premove queues. Two
-- mutually-exclusive per-seat modes, both capped at depth 3, disambiguated by a new `mode` column:
--   - sequential: a chain of the seat's next N turns (turn-order == seq order).
--   - priority:   up to N ranked alternatives for the single upcoming turn (seq == rank).
-- All of a seat's queued rows share one mode; switching modes requires clearing the queue first
-- (enforced in queue_premove below, surfaced client-side as "switch mode clears your queue first").

alter table public.premoves
  add column if not exists mode text not null default 'sequential'
    check (mode in ('sequential', 'priority'));

-- queue_premove gains p_mode (§10.4). Widening args via create-or-replace creates a second overload
-- instead of truly replacing (the exact 0009 lesson PREMOVE_PLAN.md calls out) - drop the Phase 1/2
-- 3-arg signature first.
drop function if exists public.queue_premove(uuid, int, text);

create or replace function public.queue_premove(p_game_id uuid, p_seat int, p_move text, p_mode text default 'sequential')
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid           uuid := auth.uid();
  v_game          public.games%rowtype;
  v_seq           int;
  v_existing_mode text;
  v_count         int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_move is null or length(trim(p_move)) = 0 then
    raise exception 'empty move';
  end if;
  if p_mode not in ('sequential', 'priority') then
    raise exception 'invalid mode %', p_mode;
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;

  select mode, count(*) into v_existing_mode, v_count
  from public.premoves where game_id = p_game_id and seat = p_seat
  group by mode;

  if v_existing_mode is not null and v_existing_mode <> p_mode then
    raise exception 'mode_mismatch: seat''s queue is already in % mode - clear it before switching to %',
      v_existing_mode, p_mode;
  end if;
  if coalesce(v_count, 0) >= 3 then
    raise exception 'queue is full (max 3)';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
  from public.premoves where game_id = p_game_id and seat = p_seat;

  insert into public.premoves (game_id, seat, seq, move, mode, queued_move_count)
  values (p_game_id, p_seat, v_seq, p_move, p_mode, v_game.move_count);

  return v_seq;
end;
$$;

revoke execute on function public.queue_premove(uuid, int, text, text) from public, anon;
grant execute on function public.queue_premove(uuid, int, text, text) to authenticated;

-- cancel_all_premoves (§10.4) - clears a seat's whole queue in one call: the mode-toggle confirm,
-- and the §10.7 reconciliation cases (Priority always clears on a manual move; Sequential falls
-- back to this when the consumed head can't be matched).
create or replace function public.cancel_all_premoves(p_game_id uuid, p_seat int)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  delete from public.premoves where game_id = p_game_id and seat = p_seat;
end;
$$;

revoke execute on function public.cancel_all_premoves(uuid, int) from public, anon;
grant execute on function public.cancel_all_premoves(uuid, int) to authenticated;

-- reorder_premove (§10.4, Priority only) - swaps a row's seq with its immediate neighbour so the
-- user can re-rank without cancel+rebuild. Order in Sequential is turn-order, not a preference, so
-- reordering there is rejected rather than silently doing something meaningless.
create or replace function public.reorder_premove(p_game_id uuid, p_seat int, p_seq int, p_direction text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_mode     text;
  v_neighbor int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'invalid direction %', p_direction;
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  select mode into v_mode from public.premoves
  where game_id = p_game_id and seat = p_seat and seq = p_seq;
  if not found then
    raise exception 'no such queued premove';
  end if;
  if v_mode <> 'priority' then
    raise exception 'reordering only applies to a priority queue';
  end if;

  select seq into v_neighbor from public.premoves
  where game_id = p_game_id and seat = p_seat
    and seq = (case when p_direction = 'up' then p_seq - 1 else p_seq + 1 end);
  if not found then
    return; -- already at the top/bottom of the ranking - a no-op, not an error
  end if;

  -- Swap via a transient negative seq to dodge the (game_id, seat, seq) primary key mid-update.
  update public.premoves set seq = -1 where game_id = p_game_id and seat = p_seat and seq = p_seq;
  update public.premoves set seq = p_seq where game_id = p_game_id and seat = p_seat and seq = v_neighbor;
  update public.premoves set seq = v_neighbor where game_id = p_game_id and seat = p_seat and seq = -1;
end;
$$;

revoke execute on function public.reorder_premove(uuid, int, int, text) from public, anon;
grant execute on function public.reorder_premove(uuid, int, int, text) to authenticated;
