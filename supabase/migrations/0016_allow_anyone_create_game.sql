-- Reopens create_game to every authenticated user. Delete remains admin-only
-- through delete_game; only the create restriction is being relaxed here.
create or replace function public.create_game(
  p_name text,
  p_seed text,
  p_player_count int,
  p_options jsonb,
  p_invites jsonb,
  p_current_seat int,
  p_setup_move text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_game uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_seed is null or length(trim(p_seed)) = 0 then
    raise exception 'seed required';
  end if;
  if p_player_count is null or p_player_count < 2 or p_player_count > 4 then
    raise exception 'player_count must be 2-4';
  end if;
  if jsonb_typeof(p_options) is distinct from 'object' then
    raise exception 'options must be a json object';
  end if;
  if jsonb_typeof(p_invites) is distinct from 'array'
     or jsonb_array_length(p_invites) <> p_player_count then
    raise exception 'invites must list exactly % players', p_player_count;
  end if;
  if (select count(distinct (i ->> 'seat')::int) from jsonb_array_elements(p_invites) i
        where (i ->> 'seat')::int between 0 and p_player_count - 1) <> p_player_count then
    raise exception 'invite seats must be exactly 0..%', p_player_count - 1;
  end if;
  if exists (select 1 from jsonb_array_elements(p_invites) i
             where coalesce(i ->> 'user_id', '') = '') then
    raise exception 'each seat needs an invited user';
  end if;
  if exists (select 1 from jsonb_array_elements(p_invites) i
             where not exists (select 1 from auth.users u where u.id = (i ->> 'user_id')::uuid)) then
    raise exception 'an invited user no longer exists';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_invites) i
                 where (i ->> 'user_id')::uuid = v_uid) then
    raise exception 'the game creator must occupy one of the seats';
  end if;
  if p_current_seat is null or p_current_seat < 0 or p_current_seat >= p_player_count then
    raise exception 'current_seat must be a valid seat';
  end if;

  insert into public.games (created_by, name, seed, player_count, options, current_seat)
  values (v_uid, coalesce(p_name, ''), p_seed, p_player_count, p_options, p_current_seat)
  returning id into v_game;

  insert into public.players (game_id, seat, invited_email, display_name, user_id)
  select v_game,
         (i ->> 'seat')::int,
         lower(u.email),
         coalesce(i ->> 'display_name', ''),
         u.id
  from jsonb_array_elements(p_invites) i
  join auth.users u on u.id = (i ->> 'user_id')::uuid;

  if p_setup_move is not null and length(trim(p_setup_move)) > 0 then
    insert into public.moves (game_id, seq, seat, move, committed_by)
    values (v_game, 1, p_player_count - 1, p_setup_move, v_uid);

    update public.games set move_count = 1 where id = v_game;
  end if;

  return v_game;
end;
$$;

revoke execute on function public.create_game(text, text, int, jsonb, jsonb, int, text) from public, anon;
grant execute on function public.create_game(text, text, int, jsonb, jsonb, int, text) to authenticated;
