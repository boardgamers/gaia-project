-- Hosted seat ownership drift fix:
-- reads/UI have long treated either {players.user_id == auth.uid()} OR
-- {players.invited_email == auth.jwt().email} as "this is my seat", but several
-- write-side RPCs still only trusted user_id. That mismatch lets a session play
-- locally and read the game, yet fail to persist turns/premoves after refresh.
--
-- Align every seat-scoped RPC/policy with the same ownership rule used by
-- is_game_member()/host.ts's mySeats(). This intentionally covers future games;
-- no data backfill is required.

create or replace function public.is_seat_owner(p_game_id uuid, p_seat int)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.players p
      where p.game_id = p_game_id
        and p.seat = p_seat
        and (
          p.user_id = auth.uid()
          or p.invited_email = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    );
$$;

revoke execute on function public.is_seat_owner(uuid, int) from public, anon;
grant execute on function public.is_seat_owner(uuid, int) to authenticated;

drop policy if exists premoves_select on public.premoves;
create policy premoves_select on public.premoves
  for select to authenticated
  using (public.is_seat_owner(game_id, seat));

drop policy if exists premove_failures_select on public.premove_failures;
create policy premove_failures_select on public.premove_failures
  for select to authenticated
  using (public.is_seat_owner(game_id, seat));

create or replace function public.commit_turn(
  p_game_id uuid,
  p_seq int,
  p_seat int,
  p_move text,
  p_next_seat int,
  p_finished boolean,
  p_current_round int default null,
  p_latest_move_summary text default null,
  p_player_updates jsonb default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_move is null or length(trim(p_move)) = 0 then
    raise exception 'empty move';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;
  if p_seq is distinct from v_game.move_count + 1 then
    raise exception 'seq_conflict: expected %, got %', v_game.move_count + 1, p_seq;
  end if;
  if not p_finished and (p_next_seat is null or p_next_seat < 0
                         or p_next_seat >= v_game.player_count) then
    raise exception 'next_seat must be a valid seat while the game is active';
  end if;

  insert into public.moves (game_id, seq, seat, move, committed_by)
  values (p_game_id, p_seq, p_seat, p_move, v_uid);

  update public.games
  set move_count           = p_seq,
      current_seat         = case when p_finished then null else p_next_seat end,
      status               = case when p_finished then 'finished' else status end,
      last_committed_by    = v_uid,
      current_round        = coalesce(p_current_round, current_round),
      latest_move_summary  = coalesce(p_latest_move_summary, latest_move_summary)
  where id = p_game_id;

  if p_player_updates is not null then
    update public.players pl
    set faction = coalesce(u.faction, pl.faction),
        score   = coalesce(u.score, pl.score)
    from jsonb_to_recordset(p_player_updates) as u(seat int, faction text, score int)
    where pl.game_id = p_game_id and pl.seat = u.seat;
  end if;
end;
$$;

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
  if not public.is_seat_owner(p_game_id, p_seat) then
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

create or replace function public.cancel_premove(p_game_id uuid, p_seat int, p_seq int)
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
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  delete from public.premoves where game_id = p_game_id and seat = p_seat and seq = p_seq;
end;
$$;

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
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  delete from public.premoves where game_id = p_game_id and seat = p_seat;
end;
$$;

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
  if not public.is_seat_owner(p_game_id, p_seat) then
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
    return;
  end if;

  update public.premoves set seq = -1 where game_id = p_game_id and seat = p_seat and seq = p_seq;
  update public.premoves set seq = p_seq where game_id = p_game_id and seat = p_seat and seq = v_neighbor;
  update public.premoves set seq = v_neighbor where game_id = p_game_id and seat = p_seat and seq = -1;
end;
$$;

create or replace function public.edit_premove(p_game_id uuid, p_seat int, p_seq int, p_move text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_mode text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  select mode into v_mode from public.premoves where game_id = p_game_id and seat = p_seat and seq = p_seq;
  if v_mode is null then
    raise exception 'no premove queued at that position';
  end if;

  update public.premoves set move = p_move
  where game_id = p_game_id and seat = p_seat and seq = p_seq;

  if v_mode = 'sequential' then
    delete from public.premoves
    where game_id = p_game_id and seat = p_seat and seq > p_seq;
  end if;
end;
$$;

create or replace function public.mark_premove_failure_read(p_id uuid)
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

  update public.premove_failures pf
  set read_at = now()
  where pf.id = p_id
    and public.is_seat_owner(pf.game_id, pf.seat);
end;
$$;

create or replace function public.set_auto_charge(p_game_id uuid, p_seat int, p_pref text)
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
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  update public.players set auto_charge = coalesce(p_pref, 'ask')
  where game_id = p_game_id and seat = p_seat;
end;
$$;

create or replace function public.mark_seat_active(p_game_id uuid, p_seat int)
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
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  update public.players set last_active_at = now()
  where game_id = p_game_id and seat = p_seat;
end;
$$;

create or replace function public.commit_automated_turn(
  p_game_id uuid,
  p_seq int,
  p_seat int,
  p_move text,
  p_next_seat int,
  p_finished boolean,
  p_current_round int default null,
  p_player_updates jsonb default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_game      public.games%rowtype;
  v_committer uuid;
begin
  if p_move is null or length(trim(p_move)) = 0 then
    raise exception 'empty move';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if p_seq is distinct from v_game.move_count + 1 then
    raise exception 'seq_conflict: expected %, got %', v_game.move_count + 1, p_seq;
  end if;
  if not p_finished and (p_next_seat is null or p_next_seat < 0 or p_next_seat >= v_game.player_count) then
    raise exception 'next_seat must be a valid seat while the game is active';
  end if;

  select coalesce(
           p.user_id,
           (select u.id from auth.users u where lower(u.email::text) = p.invited_email limit 1)
         )
  into v_committer
  from public.players p
  where p.game_id = p_game_id and p.seat = p_seat;

  if v_committer is null then
    v_committer := v_game.created_by;
  end if;

  insert into public.moves (game_id, seq, seat, move, committed_by)
  values (p_game_id, p_seq, p_seat, p_move, v_committer);

  update public.games
  set move_count        = p_seq,
      current_seat      = case when p_finished then null else p_next_seat end,
      status            = case when p_finished then 'finished' else status end,
      last_committed_by = v_committer,
      current_round     = coalesce(p_current_round, current_round)
  where id = p_game_id;

  if p_player_updates is not null then
    update public.players pl
    set faction = coalesce(u.faction, pl.faction),
        score   = coalesce(u.score, pl.score)
    from jsonb_to_recordset(p_player_updates) as u(seat int, faction text, score int)
    where pl.game_id = p_game_id and pl.seat = u.seat;
  end if;
end;
$$;
