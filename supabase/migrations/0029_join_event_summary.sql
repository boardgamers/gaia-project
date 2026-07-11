-- Owner request (Gaia 21): the lobby's "last turn summary" line only ever reflected committed
-- moves - joining an open-lobby game (before it fills and goes active) produced no visible event
-- at all in that line, just a silent bump of the "X/Y seats joined" badge. Piggyback on the same
-- latest_move_summary/latest_move_committed_at cache columns commit_turn already writes (see
-- 0019/0026) so a join reads exactly like a turn event: "Luke joined the game".
--
-- Safe to just overwrite unconditionally here: while status = 'open', no moves exist yet (commit_turn
-- requires status = 'active'), so latest_move_summary is still null/stale from a previous game - once
-- the game goes active, commit_turn's own writes take back over on the first real move.

create or replace function public.join_open_game_seat(p_game_id uuid, p_seat int)
returns public.games
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_display_name text;
  v_game public.games%rowtype;
  v_claimed int;
  v_shuffled int[];
  i int;
begin
  if v_uid is null or v_email = '' then
    raise exception 'not signed in';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'open' then
    raise exception 'game is no longer open';
  end if;
  if p_seat < 0 or p_seat >= v_game.player_count then
    raise exception 'seat must be between 0 and %', v_game.player_count - 1;
  end if;
  if exists (
    select 1 from public.players
    where game_id = p_game_id and user_id = v_uid and seat <> p_seat
  ) then
    raise exception 'you already occupy a seat in this game';
  end if;
  if exists (
    select 1 from public.players
    where game_id = p_game_id and seat = p_seat and user_id is not null and user_id <> v_uid
  ) then
    raise exception 'seat already taken';
  end if;

  select coalesce(
           nullif(raw_user_meta_data ->> 'full_name', ''),
           nullif(raw_user_meta_data ->> 'name', ''),
           split_part(email::text, '@', 1)
         )
  into v_display_name
  from auth.users
  where id = v_uid;

  v_display_name := coalesce(v_display_name, split_part(v_email, '@', 1));

  update public.players
  set user_id = v_uid,
      invited_email = v_email,
      display_name = v_display_name
  where game_id = p_game_id and seat = p_seat;

  select count(*) into v_claimed
  from public.players
  where game_id = p_game_id and user_id is not null;

  if v_claimed = v_game.player_count then
    -- Randomly permute the seat column among this game's now-fully-claimed players. Two-pass
    -- (temp negative seats, then the real shuffled values) so intermediate writes never collide
    -- with the (game_id, seat) primary key.
    select array_agg(seat order by random()) into v_shuffled
    from public.players
    where game_id = p_game_id;

    update public.players set seat = -1 - seat where game_id = p_game_id;

    for i in 0 .. v_game.player_count - 1 loop
      update public.players set seat = v_shuffled[i + 1] where game_id = p_game_id and seat = -1 - i;
    end loop;
  end if;

  update public.games
  set status = case when v_claimed = v_game.player_count then 'active' else 'open' end,
      current_seat = case when v_claimed = v_game.player_count then starting_seat else null end,
      latest_move_summary = v_display_name || ' joined the game',
      latest_move_committed_at = now()
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;
