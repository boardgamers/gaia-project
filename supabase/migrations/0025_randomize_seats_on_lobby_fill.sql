-- Owner request (Gaia 16): open-lobby seat assignment was purely join-order (first joiner after the
-- host always landed in seat 1, etc.) - randomize seat numbers once every seat is claimed and the
-- game is about to start, instead of leaving them in join order.
--
-- Safe to do here, and only here: `commit_turn` requires status = 'active' (0001_multiplayer.sql),
-- so while status is still 'open' no move rows exist yet whose seat ownership this could
-- invalidate. `starting_seat`/`current_seat` (set right after, unchanged below) was computed from a
-- scratch engine at `create_game` time - it names which *engine* seat moves first, not which human,
-- so reassigning humans to seat numbers afterward doesn't invalidate it. Likewise any locked-in
-- `setup_move` inserted at creation time (0020_open_lobby_games.sql's fixed `seat = player_count -
-- 1` convention) is a scripted, non-strategic setup action tied to a seat number, not a human.

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

  update public.players
  set user_id = v_uid,
      invited_email = v_email,
      display_name = coalesce(v_display_name, split_part(v_email, '@', 1))
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
      current_seat = case when v_claimed = v_game.player_count then starting_seat else null end
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;
